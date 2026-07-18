package com.docvision.shared.quality

import com.docvision.shared.camera.CameraFrame
import com.docvision.shared.detection.DetectionResult
import kotlin.system.measureTimeMillis

/**
 * Interface to the platform-specific native C++ bridge for image processing.
 * These methods analyze raw pixel data to determine quality metrics.
 */
interface NativeQualityBridge {
    fun computeSharpness(pixels: ByteArray, width: Int, height: Int, corners: FloatArray): Float
    fun computeIlluminationUniformity(pixels: ByteArray, width: Int, height: Int, corners: FloatArray): Float
    fun detectGlare(pixels: ByteArray, width: Int, height: Int, corners: FloatArray): Pair<Float, ByteArray?>
    fun detectShadows(pixels: ByteArray, width: Int, height: Int, corners: FloatArray): Float
    fun detectOcclusion(pixels: ByteArray, width: Int, height: Int, corners: FloatArray): Float
}

/**
 * Assesses the quality of a given frame and document detection.
 * Utilizes a NativeQualityBridge for heavy image processing tasks.
 */
class QualityAssessor(
    private val nativeBridge: NativeQualityBridge
) {
    /**
     * Assesses the quality of a camera frame given the detected document corners.
     *
     * @param frame The raw camera frame.
     * @param detection The document detection result containing corners.
     * @return QualityMetrics representing various quality aspects of the frame.
     */
    fun assess(frame: CameraFrame, detection: DetectionResult): QualityMetrics {
        val corners = detection.corners
        if (corners == null) {
            // If no document is detected, return baseline bad metrics
            return QualityMetrics(
                sharpnessScore = 0f,
                blurType = BlurType.DEFOCUS_BLUR,
                blurSeverity = 1f,
                illuminationUniformity = 0f,
                glareScore = 1f,
                shadowScore = 1f,
                completenessScore = 0f,
                occlusionScore = 1f,
                dcqi = 0f,
                glareMask = null,
                processingTimeMs = 0
            )
        }

        // Flatten corners into a FloatArray for the native bridge [x1, y1, x2, y2, x3, y3, x4, y4]
        val cornerArray = floatArrayOf(
            corners.topLeft.x, corners.topLeft.y,
            corners.topRight.x, corners.topRight.y,
            corners.bottomRight.x, corners.bottomRight.y,
            corners.bottomLeft.x, corners.bottomLeft.y
        )

        var sharpness = 0f
        var illumination = 0f
        var glareResult: Pair<Float, ByteArray?> = Pair(0f, null)
        var shadow = 0f
        var occlusion = 0f
        
        val timeMs = measureTimeMillis {
            sharpness = nativeBridge.computeSharpness(frame.pixels, frame.width, frame.height, cornerArray)
            illumination = nativeBridge.computeIlluminationUniformity(frame.pixels, frame.width, frame.height, cornerArray)
            glareResult = nativeBridge.detectGlare(frame.pixels, frame.width, frame.height, cornerArray)
            shadow = nativeBridge.detectShadows(frame.pixels, frame.width, frame.height, cornerArray)
            occlusion = nativeBridge.detectOcclusion(frame.pixels, frame.width, frame.height, cornerArray)
        }

        // Approximate blur metrics based on sharpness for now
        val blurSeverity = 1.0f - sharpness
        val blurType = if (blurSeverity > 0.5f) BlurType.DEFOCUS_BLUR else BlurType.SHARP
        
        // Completeness is derived from confidence and edge proximity in a real implementation
        // Here we use a proxy based on detection confidence
        val completeness = detection.confidence

        val dcqi = QualityMetrics.computeDcqi(
            sharpness = sharpness,
            blur = blurSeverity,
            illumination = illumination,
            glare = glareResult.first,
            shadow = shadow,
            completeness = completeness,
            occlusion = occlusion
        )

        return QualityMetrics(
            sharpnessScore = sharpness,
            blurType = blurType,
            blurSeverity = blurSeverity,
            illuminationUniformity = illumination,
            glareScore = glareResult.first,
            shadowScore = shadow,
            completenessScore = completeness,
            occlusionScore = occlusion,
            dcqi = dcqi,
            glareMask = glareResult.second,
            processingTimeMs = timeMs
        )
    }
}
