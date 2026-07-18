#include <docvision/denoising.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/photo.hpp>
#include <algorithm>

namespace dvc {

float estimate_noise_sigma(const cv::Mat& src) {
    cv::Mat gray;
    if (src.channels() == 3) {
        cv::cvtColor(src, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = src;
    }

    cv::Mat laplacian;
    cv::Laplacian(gray, laplacian, CV_16S);
    
    cv::Mat abs_lap;
    laplacian.convertTo(abs_lap, CV_32F);
    abs_lap = cv::abs(abs_lap);

    cv::Mat flat = abs_lap.reshape(1, 1);
    cv::Mat sorted;
    cv::sort(flat, sorted, cv::SORT_EVERY_ROW + cv::SORT_ASCENDING);

    float median = sorted.at<float>(0, sorted.cols / 2);
    
    // MAD estimator for Laplacian
    float sigma = median / 0.6745f / 1.4826f;
    return std::clamp(sigma, 0.0f, 50.0f);
}

cv::Mat denoise_document(
    const cv::Mat& src,
    DenoisingMethod method,
    float estimated_sigma
) {
    if (src.empty() || method == DenoisingMethod::NONE) return src.clone();

    float sigma = estimated_sigma;
    if (sigma < 0.0f) {
        sigma = estimate_noise_sigma(src);
    }

    cv::Mat dst;

    if (method == DenoisingMethod::FAST_NL_MEANS) {
        float h = std::clamp(sigma * 0.8f, 3.0f, 20.0f);
        if (src.channels() == 3) {
            cv::fastNlMeansDenoisingColored(src, dst, h, h, 7, 21);
        } else {
            cv::fastNlMeansDenoising(src, dst, h, 7, 21);
        }
    } else if (method == DenoisingMethod::BILATERAL) {
        float sigmaColor = sigma * 2.0f;
        float sigmaSpace = 15.0f;
        cv::bilateralFilter(src, dst, 9, sigmaColor, sigmaSpace);
    } else if (method == DenoisingMethod::GAUSSIAN_ADAPTIVE) {
        int k = (sigma < 8.0f) ? 3 : 5;
        cv::GaussianBlur(src, dst, cv::Size(k, k), sigma * 0.5f);
    }

    return dst;
}

} // namespace dvc
