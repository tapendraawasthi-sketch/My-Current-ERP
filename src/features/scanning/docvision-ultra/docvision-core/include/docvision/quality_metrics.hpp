#pragma once
#include <opencv2/core.hpp>
#include <vector>
#include <cstdint>

namespace dvc {

/** Result of glare detection. */
struct GlareResult {
    float score;                    ///< 0.0 = severe glare, 1.0 = no glare
    cv::Mat mask;                   ///< Binary mask (255 = glare pixel)
    float coverage_fraction;        ///< Fraction of document area with glare
};

/** Blur type classification result. */
enum class BlurType { SHARP, DEFOCUS, MOTION };
struct BlurResult {
    BlurType type;
    float severity;     ///< 0.0 = sharp, 1.0 = severely blurred
    float direction_deg; ///< Motion blur direction (only valid if type == MOTION)
};

/**
 * Compute normalized sharpness score from Laplacian variance.
 * @param doc_region  Warped document image (any size).
 * @param reference_variance  Calibrated maximum variance for normalization (~1500.0).
 * @return Score in [0.0, 1.0].
 */
float compute_sharpness_score(const cv::Mat& doc_region, double reference_variance = 1500.0);

/**
 * Compute illumination uniformity score.
 * Divides the document into an 8x8 grid and measures brightness coefficient of variation.
 */
float compute_illumination_uniformity(const cv::Mat& doc_gray);

/**
 * Detect glare in the document region.
 */
GlareResult detect_glare(const cv::Mat& doc_region);

/**
 * Detect shadows.
 */
float detect_shadow_score(const cv::Mat& doc_gray);

/**
 * Detect skin-colored occlusion (finger detection) on document borders.
 */
float detect_occlusion_score(const cv::Mat& doc_region, int border_px = 30);

/**
 * Refine detected document corners to sub-pixel accuracy.
 * Uses Hough lines on patches around each coarse corner.
 */
std::vector<cv::Point2f> refine_corners(
    const cv::Mat& full_res_frame,
    const std::vector<cv::Point2f>& coarse_corners,
    int patch_size = 64
);

} // namespace dvc
