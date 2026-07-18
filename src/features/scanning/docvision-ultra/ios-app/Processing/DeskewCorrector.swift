import Foundation
import UIKit
import CoreImage

/// Detects and corrects residual skew in a perspective-corrected document image.
/// Uses CIDetector (text feature detection) to find dominant text line angles.
final class DeskewCorrector {
    
    private let context = CIContext()
    
    /// Estimate skew angle of a document image.
    /// Uses CIDetector with CIDetectorTypeRectangle or text line Hough on the binary image.
    /// - Returns: Skew angle in degrees. Positive = clockwise. Range [-45, 45].
    func detectSkew(binaryImage: UIImage) -> Float {
        guard let cgImage = binaryImage.cgImage else { return 0.0 }
        let ciImage = CIImage(cgImage: cgImage)
        
        let detector = CIDetector(ofType: CIDetectorTypeRectangle, context: context, options: [CIDetectorAccuracy: CIDetectorAccuracyLow])
        let features = detector?.features(in: ciImage) as? [CIRectangleFeature] ?? []
        
        var angles: [Float] = []
        for feature in features {
            let dx = Float(feature.topRight.x - feature.topLeft.x)
            let dy = Float(feature.topRight.y - feature.topLeft.y)
            let angle = atan2(dy, dx) * (180.0 / .pi)
            if abs(angle) < 45.0 {
                angles.append(angle)
            }
        }
        
        guard !angles.isEmpty else { return 0.0 }
        
        // Return average angle
        let avgAngle = angles.reduce(0, +) / Float(angles.count)
        return avgAngle
    }
    
    /// Rotate a UIImage by the given angle (degrees).
    func rotate(image: UIImage, byDegrees angle: Float) -> UIImage {
        guard angle != 0.0 else { return image }
        let radians = CGFloat(angle) * .pi / 180.0
        
        let size = image.size
        let newSize = CGSize(
            width: abs(size.width * cos(radians)) + abs(size.height * sin(radians)),
            height: abs(size.width * sin(radians)) + abs(size.height * cos(radians))
        )
        
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let rotated = renderer.image { ctx in
            ctx.cgContext.translateBy(x: newSize.width / 2, y: newSize.height / 2)
            ctx.cgContext.rotate(by: radians)
            image.draw(in: CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height))
        }
        return rotated
    }
    
    /// Full deskew: detect + rotate.
    /// - Returns: (deskewed image, angle applied)
    func deskew(image: UIImage, threshold: Float = 0.5) -> (UIImage, Float) {
        let angle = detectSkew(binaryImage: image)
        guard abs(angle) > threshold else { return (image, 0.0) }
        let corrected = rotate(image: image, byDegrees: -angle)
        return (corrected, angle)
    }
}
