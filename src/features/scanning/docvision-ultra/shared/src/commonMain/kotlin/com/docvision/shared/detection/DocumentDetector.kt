package com.docvision.shared.detection

import com.docvision.shared.camera.CameraFrame
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.math.hypot
import kotlin.math.max

/**
 * Interface for detecting documents within camera frames.
 */
interface DocumentDetector {
    /**
     * Initializes the detector with the necessary machine learning model.
     * @param modelPath Path to the ML model file.
     */
    suspend fun initialize(modelPath: String)
    
    /**
     * Performs document detection on the given frame.
     * @param frame The camera frame to analyze.
     * @return The result of the detection.
     */
    fun detect(frame: CameraFrame): DetectionResult
    
    /**
     * Releases resources associated with the detector.
     */
    fun release()
}

/**
 * Temporally smooths document detection results across multiple frames
 * to reduce jitter and improve stability using an Exponential Moving Average (EMA).
 */
class TemporalSmoother(private val alpha: Float = 0.3f) {
    private val mutex = Mutex()
    private var lastValidCorners: Quadrilateral? = null
    private val jumpThreshold = 0.1f // 10% of frame diagonal

    /**
     * Applies smoothing to the given detection result based on history.
     * @param result The current detection result.
     * @return A new DetectionResult with smoothed corners, or the original if smoothing isn't applicable.
     */
    suspend fun smooth(result: DetectionResult): DetectionResult = mutex.withLock {
        val currentCorners = result.corners ?: return result.also { lastValidCorners = null }

        if (lastValidCorners == null) {
            lastValidCorners = currentCorners
            return result
        }

        val previousCorners = lastValidCorners!!
        
        // Check for large jumps
        if (isLargeJump(previousCorners, currentCorners)) {
            // Reset EMA if the document moved significantly
            lastValidCorners = currentCorners
            return result
        }

        // Apply EMA
        val smoothedCorners = Quadrilateral(
            topLeft = smoothPoint(previousCorners.topLeft, currentCorners.topLeft),
            topRight = smoothPoint(previousCorners.topRight, currentCorners.topRight),
            bottomRight = smoothPoint(previousCorners.bottomRight, currentCorners.bottomRight),
            bottomLeft = smoothPoint(previousCorners.bottomLeft, currentCorners.bottomLeft)
        )

        lastValidCorners = smoothedCorners
        return result.copy(corners = smoothedCorners)
    }

    private fun smoothPoint(old: Point2D, new: Point2D): Point2D {
        return Point2D(
            x = old.x + alpha * (new.x - old.x),
            y = old.y + alpha * (new.y - old.y)
        )
    }

    private fun isLargeJump(old: Quadrilateral, new: Quadrilateral): Boolean {
        // Simple heuristic: if any point moved by more than 10% of a normalized 1.0x1.0 square diagonal
        val threshold = jumpThreshold * 1.414f // sqrt(2) max diagonal in normalized coords
        
        val d1 = hypot(old.topLeft.x - new.topLeft.x, old.topLeft.y - new.topLeft.y)
        val d2 = hypot(old.topRight.x - new.topRight.x, old.topRight.y - new.topRight.y)
        val d3 = hypot(old.bottomRight.x - new.bottomRight.x, old.bottomRight.y - new.bottomRight.y)
        val d4 = hypot(old.bottomLeft.x - new.bottomLeft.x, old.bottomLeft.y - new.bottomLeft.y)

        val maxDist = max(max(d1, d2), max(d3, d4))
        return maxDist > threshold
    }
}
