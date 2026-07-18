#include <docvision/enhancement_pipeline.hpp>
#include <docvision/perspective_correction.hpp>
#include <docvision/illumination.hpp>
#include <docvision/denoising.hpp>
#include <docvision/binarization.hpp>
#include <docvision/sharpening.hpp>
#include <opencv2/imgproc.hpp>
#include <chrono>

using Clock = std::chrono::steady_clock;
auto now_ms = []() { return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now().time_since_epoch()).count(); };

namespace dvc {

EnhancementResult run_enhancement_pipeline(
    const cv::Mat& src,
    const std::vector<cv::Point2f>& corners,
    const EnhancementConfig& config,
    float illumination_score
) {
    EnhancementResult result;
    auto t_start = now_ms();
    
    // 1. Perspective correction
    auto t0 = now_ms();
    int max_edge = config.quality == OutputQuality::PREVIEW ? config.max_output_long_edge / 2 : config.max_output_long_edge;
    auto persp = correct_perspective(src, corners, config.doc_format, max_edge);
    result.homography = persp.homography;
    result.aspect_ratio = persp.aspect_ratio;
    
    cv::Mat working = persp.corrected_image;
    if (config.auto_rotate) {
        working = auto_rotate_to_portrait(working, persp.aspect_ratio);
    }
    result.timings.perspective_ms = now_ms() - t0;
    
    // 2-5. Illumination pipeline
    auto t1 = now_ms();
    IlluminationConfig illum_config = config.illumination;
    if (config.quality == OutputQuality::PREVIEW) {
        illum_config.apply_bg_subtraction = false;
    }
    working = run_illumination_pipeline(working, illum_config);
    result.timings.illumination_ms = now_ms() - t1;
    
    // 6. Denoising
    auto t2 = now_ms();
    if (config.quality != OutputQuality::PREVIEW) {
        cv::Mat gray_for_noise;
        if (working.channels() == 3) cv::cvtColor(working, gray_for_noise, cv::COLOR_BGR2GRAY);
        else gray_for_noise = working;

        float noise_sigma = estimate_noise_sigma(gray_for_noise);
        DenoisingMethod denoise_method = config.denoising;
        
        if (config.quality == OutputQuality::MAXIMUM && noise_sigma > 5.0f) {
            denoise_method = DenoisingMethod::FAST_NL_MEANS;
        } else if (noise_sigma < 5.0f) {
            denoise_method = DenoisingMethod::NONE;
        }
        
        if (denoise_method != DenoisingMethod::NONE) {
            working = denoise_document(working, denoise_method, noise_sigma);
        }
    }
    result.timings.denoising_ms = now_ms() - t2;
    
    if (config.produce_color_output) {
        result.color_enhanced = working.clone();
    }
    
    // Grayscale
    if (working.channels() == 3) {
        cv::cvtColor(working, result.grayscale, cv::COLOR_BGR2GRAY);
    } else {
        result.grayscale = working.clone();
    }
    
    // 7. Sharpening
    auto t3 = now_ms();
    SharpeningConfig sharp_config = config.sharpening;
    if (config.quality == OutputQuality::MAXIMUM) {
        result.grayscale = adaptive_sharpen(result.grayscale, sharp_config);
    } else if (config.quality == OutputQuality::STANDARD) {
        result.grayscale = sharpen_document(result.grayscale, sharp_config);
    }
    result.timings.sharpening_ms = now_ms() - t3;
    
    // 8. Binarization
    auto t4 = now_ms();
    if (config.produce_binary_output) {
        BinarizationMethod bin_method = config.binarization;
        if (config.quality == OutputQuality::PREVIEW) {
            bin_method = BinarizationMethod::OTSU;
        } else if (config.quality == OutputQuality::MAXIMUM && illumination_score < 0.5f) {
            bin_method = BinarizationMethod::NICK;
        }
        
        result.binarization_meta = binarize_document(result.grayscale, bin_method, illumination_score);
        result.binary = post_process_binary(result.binarization_meta.binary);
    }
    result.timings.binarization_ms = now_ms() - t4;
    result.timings.total_ms = now_ms() - t_start;
    
    return result;
}

} // namespace dvc
