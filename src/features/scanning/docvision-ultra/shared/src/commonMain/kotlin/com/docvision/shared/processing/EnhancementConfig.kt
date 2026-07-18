package com.docvision.shared.processing

/**
 * Configuration for the full document image enhancement pipeline.
 * Mirrors the C++ EnhancementConfig struct.
 */
data class EnhancementConfig(
    val quality: OutputQuality = OutputQuality.STANDARD,
    val documentFormat: DocumentFormat = DocumentFormat.AUTO,
    val maxOutputLongEdge: Int = 2480,
    val produceColorOutput: Boolean = true,
    val produceBinaryOutput: Boolean = true,
    val autoRotate: Boolean = true,
    val illumination: IlluminationConfig = IlluminationConfig(),
    val denoising: DenoisingMethod = DenoisingMethod.AUTO,
    val binarization: BinarizationMethod = BinarizationMethod.SAUVOLA,
    val sharpening: SharpeningConfig = SharpeningConfig()
)

enum class OutputQuality { PREVIEW, STANDARD, MAXIMUM }

enum class DocumentFormat {
    AUTO, A4, A5, LETTER, LEGAL, BUSINESS_CARD, ID_CARD, RECEIPT, SQUARE
}

data class IlluminationConfig(
    val applyClahe: Boolean = true,
    val claheClipLimit: Float = 2.0f,
    val claheTileSize: Int = 8,
    val applyBackgroundSubtraction: Boolean = true,
    val bgBlurKernel: Int = 101,
    val applyWhiteBalance: Boolean = true,
    val targetWhitePercentile: Float = 95.0f
)

enum class DenoisingMethod { AUTO, FAST_NL_MEANS, BILATERAL, GAUSSIAN_ADAPTIVE, NONE }

enum class BinarizationMethod { SAUVOLA, OTSU, ADAPTIVE_GAUSSIAN, NICK, AUTO }

data class SharpeningConfig(
    val strength: Float = 1.5f,
    val sigma: Float = 1.0f,
    val edgeOnly: Boolean = false
)
