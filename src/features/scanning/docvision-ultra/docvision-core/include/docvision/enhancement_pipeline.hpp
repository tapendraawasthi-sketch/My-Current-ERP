#pragma once
#include <opencv2/core.hpp>
#include <docvision/perspective_correction.hpp>
#include <docvision/illumination.hpp>
#include <docvision/denoising.hpp>
#include <docvision/binarization.hpp>
#include <docvision/sharpening.hpp>
#include <vector>
#include <chrono>

namespace dvc {

/** Output quality mode — trades speed for quality. */
enum class OutputQuality {
    PREVIEW,    ///< Fast: skip heavy denoising, fast binarization. Target: < 500ms
    STANDARD,   ///< Balanced: full pipeline. Target: < 2s
    MAXIMUM     ///< Best quality: NL-Means, Sauvola, adaptive sharpening. Target: < 4s
};

/** Configuration for the full enhancement pipeline. */
struct EnhancementConfig {
    OutputQuality quality         = OutputQuality::STANDARD;
    DocumentFormat doc_format     = DocumentFormat::AUTO;
    int max_output_long_edge      = 2480;       ///< 210 DPI for A4
    IlluminationConfig illumination;
    DenoisingMethod denoising     = DenoisingMethod::FAST_NL_MEANS;
    BinarizationMethod binarization = BinarizationMethod::SAUVOLA;
    SharpeningConfig sharpening;
    bool produce_color_output     = true;  ///< If true, also return colour-corrected image
    bool produce_binary_output    = true;  ///< If true, return binarized image for OCR
    bool auto_rotate              = true;  ///< Auto-rotate to portrait if needed
};

/** Full result of the enhancement pipeline. */
struct EnhancementResult {
    cv::Mat color_enhanced;     ///< Colour corrected + illumination normalized image
    cv::Mat grayscale;          ///< Grayscale version of color_enhanced
    cv::Mat binary;             ///< Binarized image optimized for OCR
    cv::Mat homography;         ///< Perspective homography for coordinate mapping
    float aspect_ratio;         ///< Output document aspect ratio
    BinarizationResult binarization_meta;  ///< Binarization details
    struct Timings {
        long perspective_ms;    ///< Perspective correction time
        long illumination_ms;   ///< Illumination normalization time
        long denoising_ms;      ///< Denoising time
        long sharpening_ms;     ///< Sharpening time
        long binarization_ms;   ///< Binarization time
        long total_ms;          ///< Total pipeline time
    } timings;
};

/**
 * Run the complete document image enhancement pipeline.
 *
 * Pipeline order (for STANDARD quality):
 * 1. Perspective correction (Lanczos4 warp)
 * 2. Auto-rotate to portrait if needed
 * 3. White balance correction
 * 4. Background illumination subtraction
 * 5. CLAHE local contrast enhancement
 * 6. Denoising (method depends on estimated noise level)
 * 7. Unsharp mask sharpening (adaptive)
 * 8. Binarization (for OCR output)
 *
 * For PREVIEW quality: skip step 6, use OTSU binarization, reduce to 50% size.
 * For MAXIMUM quality: use NL-Means denoising, NICK binarization for degraded docs.
 *
 * @param src       Full-resolution captured image (BGR).
 * @param corners   Refined 4-corner positions in src (TL, TR, BR, BL).
 * @param config    Pipeline configuration.
 * @param illumination_score  Score from QualityAssessor (for adaptive decisions).
 * @return EnhancementResult containing all output images and metadata.
 */
EnhancementResult run_enhancement_pipeline(
    const cv::Mat& src,
    const std::vector<cv::Point2f>& corners,
    const EnhancementConfig& config = {},
    float illumination_score = 1.0f
);

} // namespace dvc
