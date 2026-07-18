#pragma once
#include <opencv2/core.hpp>

namespace dvc {

/** Binarization algorithm. */
enum class BinarizationMethod {
    SAUVOLA,            ///< Sauvola's local thresholding (best for OCR)
    OTSU,               ///< Global Otsu thresholding (fast, good for clean docs)
    ADAPTIVE_GAUSSIAN,  ///< cv::adaptiveThreshold with Gaussian weights
    NICK,               ///< NICK thresholding (good for degraded/historical docs)
    AUTO                ///< Auto-select based on illumination uniformity score
};

/** Output of binarization — binary image + metadata. */
struct BinarizationResult {
    cv::Mat binary;          ///< CV_8UC1 binary image (0=black/text, 255=white/paper)
    BinarizationMethod used; ///< Method actually used
    float otsu_threshold;    ///< Global Otsu threshold value (for diagnostics)
    float text_coverage;     ///< Fraction of pixels that are text (0.0-1.0)
};

/**
 * Apply Sauvola's local adaptive thresholding to a grayscale image.
 *
 * Sauvola's formula:
 *   T(x,y) = mean(x,y) * [1 + k * (std(x,y)/R - 1)]
 * where:
 *   - mean(x,y) and std(x,y) are local statistics in a window_size x window_size window
 *   - k = 0.34 (controls sensitivity to local statistics)
 *   - R = 128 (maximum value of standard deviation for uint8)
 *
 * This is computed efficiently using integral images for O(1) per pixel.
 *
 * @param gray        Grayscale input image.
 * @param window_size Local window size (must be odd, default 25).
 * @param k           Sauvola sensitivity parameter (default 0.34).
 * @return Binary image (0=ink, 255=background).
 */
cv::Mat sauvola_threshold(const cv::Mat& gray, int window_size = 25, float k = 0.34f);

/**
 * Apply NICK thresholding (an improvement over Niblack/Sauvola for
 * degraded documents with very light ink).
 *
 * T(x,y) = mean(x,y) + k * sqrt((sum_sq(x,y)/N) - mean(x,y)^2)
 * k = -0.1 to -0.2 for NICK
 */
cv::Mat nick_threshold(const cv::Mat& gray, int window_size = 25, float k = -0.1f);

/**
 * Binarize a document image using the specified or auto-selected method.
 *
 * AUTO selection logic:
 * - illumination_uniformity >= 0.8: OTSU (clean, well-lit document)
 * - 0.5 <= illumination_uniformity < 0.8: SAUVOLA
 * - illumination_uniformity < 0.5: NICK (heavily degraded)
 *
 * @param gray                   Grayscale document image.
 * @param method                 Binarization method.
 * @param illumination_uniformity Score from quality assessor (for AUTO selection).
 * @return BinarizationResult.
 */
BinarizationResult binarize_document(
    const cv::Mat& gray,
    BinarizationMethod method = BinarizationMethod::SAUVOLA,
    float illumination_uniformity = 1.0f
);

/**
 * Post-process a binary document image:
 * - Remove isolated noise pixels (morphological opening with 2x2 kernel)
 * - Fill small holes in text strokes (morphological closing with 2x2 kernel)
 * - Optionally remove speckling with median filter
 *
 * @param binary  Input binary image.
 * @param remove_noise  Apply morphological noise removal.
 * @param fill_holes    Apply hole filling.
 * @return Cleaned binary image.
 */
cv::Mat post_process_binary(const cv::Mat& binary, bool remove_noise = true, bool fill_holes = true);

} // namespace dvc
