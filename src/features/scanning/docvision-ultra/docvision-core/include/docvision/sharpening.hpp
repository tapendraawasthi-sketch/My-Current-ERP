#pragma once
#include <opencv2/core.hpp>

namespace dvc {

/** Sharpening configuration. */
struct SharpeningConfig {
    float strength      = 1.5f;   ///< Unsharp mask strength (0.5=subtle, 3.0=aggressive)
    int kernel_size     = 0;      ///< Gaussian kernel size (0 = auto from sigma)
    float sigma         = 1.0f;   ///< Gaussian sigma for unsharp mask
    bool edge_only      = false;  ///< Only sharpen detected edge regions
    float edge_threshold = 15.0f; ///< Sobel magnitude threshold for edge_only mode
};

/**
 * Apply unsharp masking to sharpen a document image.
 *
 * USM formula: result = src + strength * (src - gaussian_blur(src))
 * Result is clamped to [0, 255].
 *
 * This enhances text edge crispness, improving OCR accuracy on moderately
 * blurred images.
 *
 * @param src     Grayscale or BGR document image.
 * @param config  Sharpening parameters.
 * @return Sharpened image (same type and size as src).
 */
cv::Mat sharpen_document(const cv::Mat& src, const SharpeningConfig& config = {});

/**
 * Adaptive sharpening: applies stronger sharpening to text regions
 * (detected as high-frequency areas) and weaker to smooth background.
 *
 * Computes a local frequency map from Sobel gradients, uses it as a
 * blend mask to mix strong and weak sharpening results.
 *
 * @param src     Grayscale document image.
 * @param config  Base sharpening config (strength applies to text regions).
 * @return Adaptively sharpened image.
 */
cv::Mat adaptive_sharpen(const cv::Mat& src, const SharpeningConfig& config = {});

} // namespace dvc
