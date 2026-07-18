#include <docvision/sharpening.hpp>
#include <opencv2/imgproc.hpp>
#include <algorithm>

namespace dvc {

cv::Mat sharpen_document(const cv::Mat& src, const SharpeningConfig& config) {
    if (src.empty()) return src;

    int ksize = config.kernel_size;
    if (ksize <= 0) {
        ksize = static_cast<int>(2.0f * (3.0f * config.sigma)) + 1;
        if (ksize % 2 == 0) ksize++;
        ksize = std::max(3, ksize);
    }

    cv::Mat blurred;
    cv::GaussianBlur(src, blurred, cv::Size(ksize, ksize), config.sigma);

    cv::Mat src_float, blur_float;
    src.convertTo(src_float, CV_32F);
    blurred.convertTo(blur_float, CV_32F);
    
    cv::Mat sharp;

    if (config.edge_only) {
        cv::Mat gray;
        if (src.channels() == 3) cv::cvtColor(src, gray, cv::COLOR_BGR2GRAY);
        else gray = src.clone();

        cv::Mat grad_x, grad_y, grad_mag;
        cv::Sobel(gray, grad_x, CV_32F, 1, 0, 3);
        cv::Sobel(gray, grad_y, CV_32F, 0, 1, 3);
        cv::magnitude(grad_x, grad_y, grad_mag);

        cv::Mat edge_mask;
        cv::threshold(grad_mag, edge_mask, config.edge_threshold, 1.0, cv::THRESH_BINARY);
        
        if (src.channels() == 3) {
            std::vector<cv::Mat> mask_channels = {edge_mask, edge_mask, edge_mask};
            cv::merge(mask_channels, edge_mask);
        }

        cv::Mat diff = src_float - blur_float;
        cv::Mat scaled_diff = diff.mul(edge_mask) * config.strength;
        sharp = src_float + scaled_diff;
    } else {
        cv::addWeighted(src_float, 1.0 + config.strength, blur_float, -config.strength, 0.0, sharp);
    }

    cv::Mat result;
    sharp.convertTo(result, src.type(), 1.0, 0.0);
    return result;
}

cv::Mat adaptive_sharpen(const cv::Mat& src, const SharpeningConfig& config) {
    if (src.empty()) return src;
    
    cv::Mat grad_x, grad_y, grad_mag;
    cv::Sobel(src, grad_x, CV_32F, 1, 0, 3);
    cv::Sobel(src, grad_y, CV_32F, 0, 1, 3);
    cv::magnitude(grad_x, grad_y, grad_mag);

    cv::Mat mask;
    cv::normalize(grad_mag, mask, 0.0, 1.0, cv::NORM_MINMAX);
    cv::GaussianBlur(mask, mask, cv::Size(5, 5), 0);

    if (src.channels() == 3) {
        std::vector<cv::Mat> mask_channels = {mask, mask, mask};
        cv::merge(mask_channels, mask);
    }

    SharpeningConfig strong_cfg = config;
    strong_cfg.strength = config.strength * 2.0f;
    SharpeningConfig weak_cfg = config;
    weak_cfg.strength = config.strength * 0.3f;

    cv::Mat strong = sharpen_document(src, strong_cfg);
    cv::Mat weak = sharpen_document(src, weak_cfg);

    cv::Mat strong_f, weak_f, result_f;
    strong.convertTo(strong_f, CV_32F);
    weak.convertTo(weak_f, CV_32F);
    
    result_f = mask.mul(strong_f) + (1.0f - mask).mul(weak_f);
    
    cv::Mat result;
    result_f.convertTo(result, src.type());
    return result;
}

} // namespace dvc
