#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

/** Result of a perspective correction operation. */
struct PerspectiveCorrectionResult {
    cv::Mat corrected_image;     ///< Warped, flattened document image
    cv::Mat homography;          ///< 3x3 homography matrix (float64)
    float aspect_ratio;          ///< Estimated width/height ratio of the physical document
    int output_width;            ///< Output image width in pixels
    int output_height;           ///< Output image height in pixels
    bool used_a4_snap;           ///< Whether aspect ratio was snapped to A4/Letter
};

/** Standard document aspect ratios for snapping. */
enum class DocumentFormat {
    AUTO,           ///< Estimate from corner geometry
    A4,             ///< 1.414 (210x297mm)
    A5,             ///< 0.707
    LETTER,         ///< 1.294 (8.5x11in)
    LEGAL,          ///< 1.647 (8.5x14in)
    BUSINESS_CARD,  ///< 1.75
    ID_CARD,        ///< 1.586 (CR80)
    RECEIPT,        ///< Narrow, tall — auto width, fixed ratio ~0.35
    SQUARE          ///< 1.0
};

/**
 * Compute the output dimensions for a perspective-corrected document.
 * Uses the physical aspect ratio estimated from the quadrilateral geometry
 * (averaging the widths of top/bottom edges and heights of left/right edges).
 *
 * @param corners   4 corners: TL, TR, BR, BL (in image pixel coords).
 * @param format    Document format for aspect ratio snapping. AUTO = estimate.
 * @param max_long_edge  Maximum length of the longer output dimension (pixels).
 *                       Preserves aspect ratio. Default 2480 (A4 @ 210 DPI).
 * @return Pair of {width, height} in pixels.
 */
std::pair<int,int> compute_output_dimensions(
    const std::vector<cv::Point2f>& corners,
    DocumentFormat format = DocumentFormat::AUTO,
    int max_long_edge = 2480
);

/**
 * Apply perspective correction to produce a flat, orthogonal document image.
 *
 * Steps:
 * 1. compute_output_dimensions() to determine output size.
 * 2. cv::getPerspectiveTransform() from 4 source corners to 4 destination corners.
 * 3. cv::warpPerspective() with INTER_LANCZOS4 + BORDER_REPLICATE.
 * 4. Store the homography matrix for later use (e.g., mapping OCR bounding boxes
 *    back to the original image coordinates).
 *
 * @param src       Full-resolution source image (BGR or grayscale).
 * @param corners   Refined 4-corner positions in src pixel coordinates.
 *                  Order: TL, TR, BR, BL.
 * @param format    Document format for output sizing.
 * @param max_long_edge  Max output pixel dimension.
 * @return PerspectiveCorrectionResult.
 */
PerspectiveCorrectionResult correct_perspective(
    const cv::Mat& src,
    const std::vector<cv::Point2f>& corners,
    DocumentFormat format = DocumentFormat::AUTO,
    int max_long_edge = 2480
);

/**
 * Map a point from the corrected (output) image back to the original image
 * using the inverse homography. Useful for overlaying OCR results on the
 * original preview frame.
 *
 * @param corrected_pt  Point in the corrected image coordinate system.
 * @param homography    The homography returned by correct_perspective().
 * @return              Corresponding point in the original image.
 */
cv::Point2f map_point_to_original(
    const cv::Point2f& corrected_pt,
    const cv::Mat& homography
);

/**
 * Estimate whether detected corners correspond to a landscape or portrait document.
 * Returns true if the document is landscape orientation.
 */
bool is_landscape(const std::vector<cv::Point2f>& corners);

/**
 * Auto-rotate the corrected image to canonical portrait orientation if needed.
 * Applies 90° rotation when aspect_ratio < 1.0 (wider than tall after correction).
 */
cv::Mat auto_rotate_to_portrait(const cv::Mat& corrected, float aspect_ratio);

} // namespace dvc
