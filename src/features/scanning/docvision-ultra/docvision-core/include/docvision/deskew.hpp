#pragma once
#include <opencv2/core.hpp>
#include <vector>
#include <optional>

namespace dvc {

/**
 * Result of skew angle detection.
 */
struct SkewDetectionResult {
    float angle_degrees;      ///< Detected skew angle in degrees. Positive = clockwise.
    float confidence;         ///< Confidence in [0.0, 1.0]. Low = unreliable.
    int line_count;           ///< Number of Hough lines used to estimate the angle.
    std::vector<float> line_angles; ///< All detected line angles (for diagnostics).
};

/**
 * Detect the skew angle of a document image using the Hough line transform.
 *
 * Algorithm:
 * 1. If image is not binary: apply adaptive threshold to get binary image.
 * 2. Apply morphological dilation (horizontal kernel 40x1) to connect text characters
 *    into horizontal text lines — this makes lines easier to detect.
 * 3. Run cv::HoughLinesP on the dilated binary image with:
 *    rho=1, theta=pi/180, threshold=100, minLineLength=width*0.3, maxLineGap=20.
 * 4. Filter lines to those within ±15° of horizontal (text lines).
 * 5. Compute the median angle of all detected horizontal lines.
 * 6. Confidence = min(line_count / 10.0, 1.0).
 *
 * @param binary_or_gray  Binary (0=bg, 255=text) or grayscale document image.
 * @param max_angle       Maximum skew magnitude to detect (default 15°).
 * @return SkewDetectionResult.
 */
SkewDetectionResult detect_skew(
    const cv::Mat& binary_or_gray,
    float max_angle = 15.0f
);

/**
 * Apply skew correction (deskewing) to an image.
 *
 * Rotates the image by -angle_degrees around its center.
 * The output image is sized to contain the full rotated image (expanded canvas)
 * with white background fill.
 *
 * @param src           Source image (grayscale or BGR).
 * @param angle_degrees Skew angle to correct (from detect_skew).
 * @param fill_color    Background fill color (default 255 = white).
 * @return Deskewed image.
 */
cv::Mat deskew(
    const cv::Mat& src,
    float angle_degrees,
    int fill_color = 255
);

/**
 * Detect and correct skew in one step.
 * Only applies correction if confidence > min_confidence AND |angle| > threshold.
 *
 * @param src             Source image.
 * @param min_confidence  Minimum confidence to apply correction (default 0.3).
 * @param angle_threshold Minimum |angle| in degrees to bother correcting (default 0.3°).
 * @return Pair of {deskewed image, detection result}.
 */
std::pair<cv::Mat, SkewDetectionResult> detect_and_deskew(
    const cv::Mat& src,
    float min_confidence = 0.3f,
    float angle_threshold = 0.3f
);

/**
 * Detect page content orientation (0°, 90°, 180°, 270°) using projection profiles.
 *
 * For each candidate rotation (0, 90, 180, 270):
 * 1. Rotate image to that angle.
 * 2. Compute horizontal projection profile (sum of pixel values per row).
 * 3. Compute variance of projection profile — higher variance = more text structure.
 * The rotation with the highest projection variance is the correct orientation.
 *
 * @param binary  Binary document image.
 * @return Rotation angle to apply to bring document to canonical orientation (degrees).
 *         One of: 0, 90, 180, 270.
 */
int detect_page_orientation(const cv::Mat& binary);

} // namespace dvc
