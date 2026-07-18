package com.docvision.shared.processing

import com.docvision.shared.detection.DetectionResult

/**
 * Platform-independent interface for the document image processing pipeline.
 * Implementations call the native C++ DocVisionCore enhancement pipeline.
 */
interface DocumentProcessor {
    /**
     * Process a captured document image through the full enhancement pipeline.
     *
     * @param jpegBytes       Full-resolution captured image as JPEG bytes.
     * @param detectionResult Detection result containing the refined corner positions.
     * @param config          Enhancement configuration.
     * @return EnhancementResult with all output images and metadata.
     */
    suspend fun process(
        jpegBytes: ByteArray,
        detectionResult: DetectionResult,
        config: EnhancementConfig = EnhancementConfig()
    ): EnhancementResult

    /**
     * Fast perspective correction only — for the post-capture preview.
     * Should complete in < 500ms.
     */
    suspend fun quickCorrect(
        jpegBytes: ByteArray,
        detectionResult: DetectionResult
    ): ByteArray // Returns JPEG of corrected image

    /**
     * Re-process an already perspective-corrected image with different settings.
     * Skips the perspective correction step.
     */
    suspend fun reprocess(
        correctedJpeg: ByteArray,
        config: EnhancementConfig
    ): EnhancementResult
}

class ProcessingException(message: String, cause: Throwable? = null) : Exception(message, cause)

interface ProcessingProgressCallback {
    fun onProgress(progress: ProcessingProgress)
}

data class ProcessingProgress(
    val stage: String,
    val percentComplete: Float
)
