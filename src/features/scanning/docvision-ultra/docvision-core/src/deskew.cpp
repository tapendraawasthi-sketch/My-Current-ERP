#include "docvision/deskew.hpp"
#include <opencv2/imgproc.hpp>
#include <cmath>
#include <algorithm>
#include <iostream>

namespace dvc {

SkewDetectionResult detect_skew(const cv::Mat& binary_or_gray, float max_angle) {
    cv::Mat binary;
    if (binary_or_gray.channels() == 3) {
        cv::cvtColor(binary_or_gray, binary, cv::COLOR_BGR2GRAY);
        cv::adaptiveThreshold(binary, binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 11, 2);
    } else if (binary_or_gray.channels() == 4) {
        cv::cvtColor(binary_or_gray, binary, cv::COLOR_BGRA2GRAY);
        cv::adaptiveThreshold(binary, binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 11, 2);
    } else {
        cv::adaptiveThreshold(binary_or_gray, binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY_INV, 11, 2);
    }

    cv::Mat dilated;
    cv::Mat horizontal_kernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(40, 1));
    cv::dilate(binary, dilated, horizontal_kernel);

    std::vector<cv::Vec4i> lines;
    cv::HoughLinesP(dilated, lines, 1, CV_PI / 180.0, 100, binary.cols * 0.3, 20);

    std::vector<float> line_angles;
    for (const auto& l : lines) {
        float angle = std::atan2(l[3] - l[1], l[2] - l[0]) * 180.0f / CV_PI;
        
        if (std::abs(angle) < max_angle || std::abs(std::abs(angle) - 180.0f) < max_angle) {
            if (angle > 90.0f) angle -= 180.0f;
            else if (angle < -90.0f) angle += 180.0f;
            
            line_angles.push_back(angle);
        }
    }

    SkewDetectionResult result;
    result.line_count = line_angles.size();
    result.line_angles = line_angles;

    if (line_angles.empty()) {
        result.angle_degrees = 0.0f;
        result.confidence = 0.0f;
        return result;
    }

    std::sort(line_angles.begin(), line_angles.end());
    result.angle_degrees = line_angles[line_angles.size() / 2];
    
    if (result.angle_degrees > 45.0f) result.angle_degrees -= 90.0f;
    else if (result.angle_degrees < -45.0f) result.angle_degrees += 90.0f;

    result.confidence = std::clamp(result.line_count / 10.0f, 0.0f, 1.0f);
    
    return result;
}

cv::Mat deskew(const cv::Mat& src, float angle_degrees, int fill_color) {
    cv::Point2f center(src.cols / 2.0f, src.rows / 2.0f);
    
    double angle_rad = angle_degrees * CV_PI / 180.0;
    int new_w = std::round(std::abs(src.cols * std::cos(angle_rad)) + std::abs(src.rows * std::sin(angle_rad)));
    int new_h = std::round(std::abs(src.cols * std::sin(angle_rad)) + std::abs(src.rows * std::cos(angle_rad)));

    cv::Mat M = cv::getRotationMatrix2D(center, -angle_degrees, 1.0);
    M.at<double>(0, 2) += (new_w / 2.0f) - center.x;
    M.at<double>(1, 2) += (new_h / 2.0f) - center.y;

    cv::Mat dst;
    cv::Scalar fill_scalar;
    if (src.channels() == 1) {
        fill_scalar = cv::Scalar(fill_color);
    } else if (src.channels() == 3) {
        fill_scalar = cv::Scalar(fill_color, fill_color, fill_color);
    } else {
        fill_scalar = cv::Scalar(fill_color, fill_color, fill_color, fill_color);
    }
    
    cv::warpAffine(src, dst, M, cv::Size(new_w, new_h), cv::INTER_LANCZOS4, cv::BORDER_CONSTANT, fill_scalar);
    
    return dst;
}

std::pair<cv::Mat, SkewDetectionResult> detect_and_deskew(const cv::Mat& src, float min_confidence, float angle_threshold) {
    auto result = detect_skew(src);
    if (result.confidence > min_confidence && std::abs(result.angle_degrees) > angle_threshold) {
        return {deskew(src, result.angle_degrees), result};
    }
    return {src.clone(), result};
}

int detect_page_orientation(const cv::Mat& binary) {
    int best_angle = 0;
    double max_variance = -1.0;
    
    std::vector<int> angles = {0, 90, 180, 270};
    for (int angle : angles) {
        cv::Mat rotated;
        if (angle == 0) rotated = binary;
        else if (angle == 90) cv::rotate(binary, rotated, cv::ROTATE_90_CLOCKWISE);
        else if (angle == 180) cv::rotate(binary, rotated, cv::ROTATE_180);
        else if (angle == 270) cv::rotate(binary, rotated, cv::ROTATE_90_COUNTERCLOCKWISE);
        
        cv::Mat row_sums;
        cv::reduce(rotated, row_sums, 1, cv::REDUCE_SUM, CV_32F);
        
        cv::Scalar mean, stddev;
        cv::meanStdDev(row_sums, mean, stddev);
        double variance = stddev[0] * stddev[0];
        
        if (variance > max_variance) {
            max_variance = variance;
            best_angle = angle;
        }
    }
    
    return best_angle;
}

} // namespace dvc
