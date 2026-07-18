import Foundation
import UIKit
import CoreImage

/// Dummy for DVEnhancementBridge (Assuming it exists in the ObjC++ part of the app)
class DVEnhancementBridge {
    func correctPerspective(image: UIImage, corners: [CGFloat]) throws -> UIImage {
        return image
    }
    func runPipeline(image: UIImage, corners: [CGFloat], qualityMode: Int) throws -> DVEnhancementResult {
        return DVEnhancementResult(colorEnhanced: image, grayscale: image, binary: image, homographyData: Array(repeating: 0.0, count: 9), aspectRatio: 1.0, textCoverage: 0.5, totalMs: 100)
    }
}

class DVEnhancementResult {
    let colorEnhanced: UIImage
    let grayscale: UIImage
    let binary: UIImage?
    let homographyData: [Float]
    let aspectRatio: Float
    let textCoverage: Float
    let totalMs: Int
    init(colorEnhanced: UIImage, grayscale: UIImage, binary: UIImage?, homographyData: [Float], aspectRatio: Float, textCoverage: Float, totalMs: Int) {
        self.colorEnhanced = colorEnhanced
        self.grayscale = grayscale
        self.binary = binary
        self.homographyData = homographyData
        self.aspectRatio = aspectRatio
        self.textCoverage = textCoverage
        self.totalMs = totalMs
    }
}

/// Swift-native result type for the enhancement pipeline.
struct iOSEnhancementResult {
    let colorEnhanced: UIImage
    let grayscale: UIImage
    let binary: UIImage?
    let homographyData: [Float]  // 9 floats
    let aspectRatio: Float
    let textCoverage: Float
    let totalMs: Int
}

enum DocumentProcessingError: LocalizedError {
    case invalidCorners
    case imageConversionFailed
    case nativePipelineError(String)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidCorners: return "Invalid document corner coordinates"
        case .imageConversionFailed: return "Failed to convert image for processing"
        case .nativePipelineError(let msg): return "Processing error: \(msg)"
        case .unknown: return "An unknown error occurred during document processing"
        }
    }
}

/// iOS implementation of the document processing pipeline.
/// Delegates pixel-level work to DVEnhancementBridge (C++ via ObjC++).
final class iOSDocumentProcessor {
    
    private let bridge = DVEnhancementBridge()
    private let processingQueue = DispatchQueue(
        label: "com.docvision.processing",
        qos: .userInitiated
    )
    
    // MARK: - Public API
    
    /// Run the full enhancement pipeline asynchronously.
    /// - Parameters:
    ///   - image: Full-resolution captured UIImage.
    ///   - corners: Array of 8 CGFloat values [x_tl,y_tl,x_tr,y_tr,x_br,y_br,x_bl,y_bl] in pixel coords.
    ///   - quality: 0=PREVIEW, 1=STANDARD, 2=MAXIMUM
    ///   - completion: Called on main thread with result.
    func process(
        image: UIImage,
        corners: [CGFloat],
        quality: Int = 1,
        completion: @escaping (iOSEnhancementResult?, Error?) -> Void
    ) {
        processingQueue.async { [weak self] in
            guard let self = self else { return }
            do {
                let result = try self.runPipeline(image: image, corners: corners, quality: quality)
                DispatchQueue.main.async { completion(result, nil) }
            } catch {
                DispatchQueue.main.async { completion(nil, error) }
            }
        }
    }
    
    /// Swift async/await version.
    func processAsync(
        image: UIImage,
        corners: [CGFloat],
        quality: Int = 1
    ) async throws -> iOSEnhancementResult {
        try await withCheckedThrowingContinuation { continuation in
            process(image: image, corners: corners, quality: quality) { result, error in
                if let result = result {
                    continuation.resume(returning: result)
                } else {
                    continuation.resume(throwing: error ?? DocumentProcessingError.unknown)
                }
            }
        }
    }
    
    /// Fast perspective-only correction (< 500ms target).
    func quickCorrect(image: UIImage, corners: [CGFloat]) async throws -> UIImage {
        guard corners.count == 8 else {
            throw DocumentProcessingError.invalidCorners
        }
        return try await withCheckedThrowingContinuation { continuation in
            processingQueue.async { [weak self] in
                guard let self = self else { return }
                do {
                    let result = try self.bridge.correctPerspective(image: image, corners: corners)
                    DispatchQueue.main.async {
                        continuation.resume(returning: result)
                    }
                } catch {
                    DispatchQueue.main.async {
                        continuation.resume(throwing: error)
                    }
                }
            }
        }
    }
    
    // MARK: - Private
    
    private func runPipeline(image: UIImage, corners: [CGFloat], quality: Int) throws -> iOSEnhancementResult {
        guard corners.count == 8 else {
            throw DocumentProcessingError.invalidCorners
        }
        
        do {
            let result = try bridge.runPipeline(image: image, corners: corners, qualityMode: quality)
            
            return iOSEnhancementResult(
                colorEnhanced: result.colorEnhanced,
                grayscale: result.grayscale,
                binary: result.binary,
                homographyData: result.homographyData,
                aspectRatio: result.aspectRatio,
                textCoverage: result.textCoverage,
                totalMs: result.totalMs
            )
        } catch {
            throw DocumentProcessingError.nativePipelineError(error.localizedDescription)
        }
    }
}
