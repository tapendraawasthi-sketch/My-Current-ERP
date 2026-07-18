#pragma once
#include <opencv2/core.hpp>

namespace dvc {

/** Denoising algorithm selection. */
enum class DenoisingMethod {
    FAST_NL_MEANS,       ///< cv::fastNlMeansDenoising — best quality, slower
    BILATERAL,           ///< cv::bilateralFilter — fast, edge-preserving
    GAUSSIAN_ADAPTIVE,   ///< Simple Gaussian with sigma adapted to noise estimate
    NONE                 ///< Skip denoising
};

/**
 * Estimate the noise level of an image using the MAD estimator on a
 * wavelet-like high-frequency component.
 *
 * Returns sigma of the estimated Gaussian noise (0.0 = no noise,
 * 30.0 = heavy noise).
 */
float estimate_noise_sigma(const cv::Mat& gray);

/**
 * Denoise a document image while preserving text edges.
 *
 * Automatically selects denoising strength based on estimated noise level:
 * - sigma < 5: skip (image is clean enough)
 * - 5 <= sigma < 15: BILATERAL (fast, keeps edges)
 * - sigma >= 15: FAST_NL_MEANS (heavier but better quality)
 *
 * @param src     Grayscale or BGR document image.
 * @param method  Force a specific method (or AUTO to let function decide).
 * @param estimated_sigma  Pre-computed noise sigma, or -1 to auto-estimate.
 * @return Denoised image (same type and size as src).
 */
cv::Mat denoise_document(
    const cv::Mat& src,
    DenoisingMethod method = DenoisingMethod::FAST_NL_MEANS,
    float estimated_sigma = -1.0f
);

} // namespace dvc
