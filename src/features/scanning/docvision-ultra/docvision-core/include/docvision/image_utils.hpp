#pragma once
#include <opencv2/core.hpp>
#include <vector>
#include <cstdint>

namespace dvc {

/** Color space identifiers for convert_colorspace(). */
enum class ColorSpace {
    BGR, RGB, GRAY, HSV, YUV_NV21, YUV_I420, LAB, YCrCb
};

/** Interpolation method. */
enum class Interpolation {
    NEAREST, BILINEAR, BICUBIC, LANCZOS4
};

/**
 * Convert a cv::Mat from one color space to another.
 * @param src     Input image.
 * @param from    Source color space.
 * @param to      Target color space.
 * @return        Converted image (new allocation).
 * @throws std::invalid_argument if conversion is unsupported.
 */
cv::Mat convert_colorspace(const cv::Mat& src, ColorSpace from, ColorSpace to);

/**
 * Resize an image to the specified dimensions.
 */
cv::Mat resize(const cv::Mat& src, int width, int height, Interpolation interp = Interpolation::BILINEAR);

/**
 * Rotate an image by angle_degrees (positive = counter-clockwise).
 * The output image is sized to contain the full rotated image (no cropping).
 */
cv::Mat rotate(const cv::Mat& src, double angle_degrees);

/**
 * Compute the Laplacian variance of a grayscale image (or region of interest).
 * This is the primary focus/sharpness metric.
 * @param src   Grayscale image.
 * @param roi   Optional region of interest. If empty rect, whole image is used.
 * @return      Variance of the Laplacian (higher = sharper).
 */
double compute_laplacian_variance(const cv::Mat& src, const cv::Rect& roi = {});

/**
 * Compute a 256-bin histogram for a single channel of an image.
 * @param src       Single-channel or multi-channel image.
 * @param channel   Channel index (0 = B/Y, 1 = G/Cb, 2 = R/Cr for BGR).
 * @return          256-element float vector.
 */
std::vector<float> compute_histogram(const cv::Mat& src, int channel);

/**
 * Warp a quadrilateral region from src to a destination rectangle.
 * Corners must be ordered: top-left, top-right, bottom-right, bottom-left.
 */
cv::Mat warp_perspective_quad(
    const cv::Mat& src,
    const std::vector<cv::Point2f>& src_corners,
    int dst_width,
    int dst_height
);

} // namespace dvc
