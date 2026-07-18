package com.docvision.shared.processing

/**
 * Result of the full document enhancement pipeline.
 * All image data is returned as ByteArrays (JPEG for color, PNG for binary).
 */
data class EnhancementResult(
    val colorEnhancedJpeg: ByteArray,      // JPEG bytes of color-corrected image
    val grayscaleJpeg: ByteArray,          // JPEG bytes of grayscale image
    val binaryPng: ByteArray?,             // PNG bytes of binarized image (null if not requested)
    val homographyData: FloatArray,        // 9 floats of the 3x3 perspective homography
    val aspectRatio: Float,
    val textCoverage: Float,               // Fraction of pixels that are text (0.0-1.0)
    val timings: ProcessingTimings
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as EnhancementResult

        if (!colorEnhancedJpeg.contentEquals(other.colorEnhancedJpeg)) return false
        if (!grayscaleJpeg.contentEquals(other.grayscaleJpeg)) return false
        if (binaryPng != null) {
            if (other.binaryPng == null) return false
            if (!binaryPng.contentEquals(other.binaryPng)) return false
        } else if (other.binaryPng != null) return false
        if (!homographyData.contentEquals(other.homographyData)) return false
        if (aspectRatio != other.aspectRatio) return false
        if (textCoverage != other.textCoverage) return false
        if (timings != other.timings) return false

        return true
    }

    override fun hashCode(): Int {
        var result = colorEnhancedJpeg.contentHashCode()
        result = 31 * result + grayscaleJpeg.contentHashCode()
        result = 31 * result + (binaryPng?.contentHashCode() ?: 0)
        result = 31 * result + homographyData.contentHashCode()
        result = 31 * result + aspectRatio.hashCode()
        result = 31 * result + textCoverage.hashCode()
        result = 31 * result + timings.hashCode()
        return result
    }
}

data class ProcessingTimings(
    val perspectiveMs: Long,
    val illuminationMs: Long,
    val denoisingMs: Long,
    val sharpeningMs: Long,
    val binarizationMs: Long,
    val totalMs: Long
) {
    /** True if all steps met the performance budget. */
    fun meetsStandardBudget(): Boolean = totalMs <= 3000L
    fun meetsMaximumBudget(): Boolean = totalMs <= 6000L
}
