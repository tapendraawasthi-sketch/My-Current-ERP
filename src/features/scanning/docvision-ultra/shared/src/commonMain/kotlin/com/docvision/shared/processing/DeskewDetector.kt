package com.docvision.shared.processing

/**
 * Detects and measures document skew angle from the perspective-corrected image.
 * After perspective correction, the document should be close to 0° but may
 * still have small rotational skew (< 5°) from imperfect corner detection.
 *
 * Uses the Hough transform (via native bridge) to detect text line angles.
 */
interface DeskewDetector {
    /**
     * Estimate skew angle of a binarized document image.
     * @param binaryPng PNG bytes of the binarized document.
     * @return Skew angle in degrees. Positive = clockwise. Range [-45, 45].
     */
    suspend fun detectSkew(binaryPng: ByteArray): Float
    
    /**
     * Returns true if the image needs deskewing (|angle| > threshold).
     */
    fun needsDeskew(angleDegs: Float, threshold: Float = 0.5f): Boolean = 
        Math.abs(angleDegs) > threshold
}

/** Deskew result with rotation metadata. */
data class DeskewResult(
    val correctedPng: ByteArray,
    val angleApplied: Float,
    val confidence: Float     // How confident the Hough estimate is (0.0-1.0)
)

interface NativeDeskewBridge {
    fun detectSkewAngle(binaryGrayPixels: ByteArray, width: Int, height: Int): Pair<Float, Float> // angle, confidence
    fun rotateImage(pixels: ByteArray, width: Int, height: Int, angleDeg: Float): ByteArray
}
