#include "docvision/quality_metrics.hpp"
#include "docvision/image_utils.hpp"
#include <opencv2/imgproc.hpp>
#include <algorithm>
#include <cmath>

namespace dvc {

float compute_sharpness_score(const cv::Mat& doc_region, double reference_variance) {
    cv::Mat gray = (doc_region.channels() == 3) ? convert_colorspace(doc_region, ColorSpace::BGR, ColorSpace::GRAY) : doc_region.clone();
    double var = compute_laplacian_variance(gray);
    float score = static_cast<float>(var / reference_variance);
    return std::max(0.0f, std::min(score, 1.0f));
}

float compute_illumination_uniformity(const cv::Mat& doc_gray) {
    if (doc_gray.empty()) return 0.0f;
    int cell_w = doc_gray.cols / 8;
    int cell_h = doc_gray.rows / 8;
    std::vector<double> means;
    means.reserve(64);
    
    for (int r = 0; r < 8; ++r) {
        for (int c = 0; c < 8; ++c) {
            cv::Rect roi(c * cell_w, r * cell_h, cell_w, cell_h);
            if (roi.x + roi.width > doc_gray.cols) roi.width = doc_gray.cols - roi.x;
            if (roi.y + roi.height > doc_gray.rows) roi.height = doc_gray.rows - roi.y;
            if (roi.width <= 0 || roi.height <= 0) continue;
            cv::Scalar mean = cv::mean(doc_gray(roi));
            means.push_back(mean[0]);
        }
    }
    
    if (means.empty()) return 0.0f;
    double sum = 0, sq_sum = 0;
    for (double v : means) {
        sum += v;
        sq_sum += v * v;
    }
    double mean_val = sum / means.size();
    double var = (sq_sum / means.size()) - (mean_val * mean_val);
    double stddev = std::sqrt(std::max(0.0, var));
    double cv = mean_val > 0 ? (stddev / mean_val) : 0;
    
    float score = 1.0f - static_cast<float>(std::min(cv / 0.5, 1.0));
    return std::max(0.0f, std::min(score, 1.0f));
}

GlareResult detect_glare(const cv::Mat& doc_region) {
    cv::Mat hsv = convert_colorspace(doc_region, ColorSpace::BGR, ColorSpace::HSV);
    std::vector<cv::Mat> channels;
    cv::split(hsv, channels);
    
    cv::Mat maskV, maskS, mask;
    cv::threshold(channels[2], maskV, 240, 255, cv::THRESH_BINARY);
    cv::threshold(channels[1], maskS, 30, 255, cv::THRESH_BINARY_INV);
    cv::bitwise_and(maskV, maskS, mask);
    
    int non_zero = cv::countNonZero(mask);
    float coverage = static_cast<float>(non_zero) / (mask.rows * mask.cols);
    float score = 1.0f - std::min(coverage / 0.15f, 1.0f);
    return GlareResult{score, mask, coverage};
}

float detect_shadow_score(const cv::Mat& doc_gray) {
    cv::Mat blurred;
    cv::GaussianBlur(doc_gray, blurred, cv::Size(21, 21), 0);
    cv::Mat thresh;
    cv::adaptiveThreshold(blurred, thresh, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 101, 10);
    int non_zero = cv::countNonZero(thresh);
    float coverage = static_cast<float>(non_zero) / (thresh.rows * thresh.cols);
    float score = 1.0f - std::min(coverage / 0.30f, 1.0f);
    return std::max(0.0f, std::min(score, 1.0f));
}

float detect_occlusion_score(const cv::Mat& doc_region, int border_px) {
    if (doc_region.cols <= 2*border_px || doc_region.rows <= 2*border_px) return 1.0f;
    cv::Mat ycrcb = convert_colorspace(doc_region, ColorSpace::BGR, ColorSpace::YCrCb);
    cv::Mat mask;
    cv::inRange(ycrcb, cv::Scalar(0, 133, 77), cv::Scalar(255, 173, 127), mask);
    
    cv::Mat border_mask = cv::Mat::zeros(mask.size(), CV_8UC1);
    cv::rectangle(border_mask, cv::Point(0,0), cv::Point(mask.cols-1, mask.rows-1), cv::Scalar(255), border_px);
    
    cv::Mat occlusion;
    cv::bitwise_and(mask, border_mask, occlusion);
    int non_zero = cv::countNonZero(occlusion);
    int border_area = (mask.cols * mask.rows) - ((mask.cols - 2*border_px) * (mask.rows - 2*border_px));
    
    float fraction = static_cast<float>(non_zero) / border_area;
    float score = 1.0f - std::min(fraction / 0.05f, 1.0f);
    return std::max(0.0f, std::min(score, 1.0f));
}

} // namespace dvc
