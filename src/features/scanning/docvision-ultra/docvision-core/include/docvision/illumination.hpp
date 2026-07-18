#pragma once
#include <opencv2/core.hpp>

namespace dvc {

/** Configuration for the illumination normalization pipeline. */
struct IlluminationConfig {
    bool apply_clahe         = true;   ///< Apply CLAHE for local contrast enhancement
    float clahe_clip_limit   = 2.0f;   ///< CLAHE clip limit (1.0-8.0)
    int clahe_tile_size      = 8;      ///< CLAHE tile grid size (NxN)
    bool apply_bg_subtraction = true;  ///< Subtract estimated background illumination
    int bg_blur_kernel       = 101;    ///< Gaussian kernel size for background estimation
    bool apply_white_balance = true;   ///< Apply document white balance correction
    float target_white_percentile = 95.0f; ///< Percentile to treat as "paper white"
};

/**
 * Estimate the illumination background of a document image.
 *
 * Uses a large Gaussian blur to approximate the low-frequency illumination
 * component (the "background field"), separate from text/content.
 *
 * @param gray  Grayscale document image.
 * @param kernel_size  Gaussian kernel size (must be odd, >= 51).
 * @return Background illumination map (same size as gray, float32).
 */
cv::Mat estimate_background(const cv::Mat& gray, int kernel_size = 101);

/**
 * Perform background illumination subtraction to normalize uneven lighting.
 *
 * Method:
 * 1. Estimate background B using estimate_background().
 * 2. Normalize: result = (foreground / B) * mean(B), clamp to [0, 255].
 * This brings all regions to a uniform brightness level while preserving
 * local contrast (text ink relative to local paper brightness).
 *
 * @param src   Grayscale or BGR document image (will process each channel
 *              independently if BGR).
 * @param config  Configuration parameters.
 * @return Illumination-normalized image (same type as src).
 */
cv::Mat normalize_illumination(const cv::Mat& src, const IlluminationConfig& config = {});

/**
 * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to a
 * grayscale image to boost local contrast.
 *
 * @param gray  Input grayscale image (CV_8UC1).
 * @param clip_limit  Contrast limit for CLAHE (default 2.0).
 * @param tile_grid_size  Size of the grid for histogram equalization (default 8x8).
 * @return CLAHE-enhanced image.
 */
cv::Mat apply_clahe(const cv::Mat& gray, float clip_limit = 2.0f, int tile_grid_size = 8);

/**
 * Correct the white balance of a document image so that the paper background
 * becomes pure white.
 *
 * Method: Estimate the paper colour by finding the Nth percentile brightness
 * per channel (BGR). Scale each channel so that the paper colour maps to 255.
 * This removes the yellowish/bluish tint from artificial lighting.
 *
 * @param bgr   BGR document image.
 * @param percentile  Percentile of pixels treated as "paper white" (default 95).
 * @return White-balanced BGR image.
 */
cv::Mat correct_white_balance(const cv::Mat& bgr, float percentile = 95.0f);

/**
 * Full illumination normalization pipeline.
 * Applies (in order): white balance → background subtraction → CLAHE.
 *
 * @param src    BGR or grayscale corrected document image.
 * @param config Pipeline configuration.
 * @return Illumination-normalized image (same type as src).
 */
cv::Mat run_illumination_pipeline(const cv::Mat& src, const IlluminationConfig& config = {});

} // namespace dvc
