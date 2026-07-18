import Foundation
import UIKit
import Vision

/// Detects page orientation using VNDetectTextRectanglesRequest.
/// After perspective correction, text may still be rotated 90° or 180°.
/// This uses Vision text detection to determine the true reading orientation.
final class PageOrientationDetector {
    
    enum PageOrientation: Int {
        case portrait = 0          // Text reads left-to-right, top-to-bottom (normal)
        case landscape90 = 90      // Rotated 90° clockwise
        case landscape270 = 270    // Rotated 90° counter-clockwise  
        case upsideDown = 180      // Upside down
    }
    
    /// Detect the reading orientation of a document image.
    /// Uses VNRecognizeTextRequest (iOS 13+) to detect text blocks and
    /// analyzes their bounding box orientations to determine canonical orientation.
    func detectOrientation(image: UIImage) async -> PageOrientation {
        guard let cgImage = image.cgImage else { return .portrait }
        
        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                guard let observations = request.results as? [VNRecognizedTextObservation], !observations.isEmpty else {
                    continuation.resume(returning: .portrait)
                    return
                }
                
                // For simplicity in a basic detection, VNRecognizeTextRequest usually returns horizontal text if run without orientation.
                // However, recognizing text angles is often complex.
                // Assuming Vision has aligned text in the observation.
                // In iOS 13+, text observation has `bottomLeft`, `bottomRight` etc.
                
                var angles: [CGFloat] = []
                for obs in observations {
                    let bl = obs.bottomLeft
                    let br = obs.bottomRight
                    
                    let dx = br.x - bl.x
                    let dy = br.y - bl.y
                    
                    let angle = atan2(dy, dx)
                    angles.append(angle)
                }
                
                let avgAngle = angles.reduce(0, +) / CGFloat(angles.count)
                let degrees = avgAngle * 180 / .pi
                
                if abs(degrees) <= 45 {
                    continuation.resume(returning: .portrait)
                } else if degrees > 45 && degrees < 135 {
                    continuation.resume(returning: .landscape270)
                } else if degrees < -45 && degrees > -135 {
                    continuation.resume(returning: .landscape90)
                } else {
                    continuation.resume(returning: .upsideDown)
                }
            }
            
            request.recognitionLevel = .fast
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: .portrait)
            }
        }
    }
    
    /// Apply the necessary rotation to bring an image to portrait orientation.
    func normalizeOrientation(image: UIImage, orientation: PageOrientation) -> UIImage {
        guard orientation != .portrait else { return image }
        let degrees: CGFloat
        switch orientation {
        case .landscape90: degrees = -90
        case .landscape270: degrees = 90
        case .upsideDown: degrees = 180
        default: degrees = 0
        }
        return rotateImage(image, byDegrees: degrees)
    }
    
    private func rotateImage(_ image: UIImage, byDegrees degrees: CGFloat) -> UIImage {
        let radians = degrees * .pi / 180.0
        let size = image.size
        
        let newSize = CGSize(
            width: abs(size.width * cos(radians)) + abs(size.height * sin(radians)),
            height: abs(size.width * sin(radians)) + abs(size.height * cos(radians))
        )
        
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { context in
            context.cgContext.translateBy(x: newSize.width / 2, y: newSize.height / 2)
            context.cgContext.rotate(by: radians)
            image.draw(in: CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height))
        }
    }
}
