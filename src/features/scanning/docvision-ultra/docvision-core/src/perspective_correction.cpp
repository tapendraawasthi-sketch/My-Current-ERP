#include <docvision/perspective_correction.hpp>
#include <opencv2/imgproc.hpp>
#include <cmath>
#include <algorithm>

namespace dvc {

std::pair<int, int> compute_output_dimensions(
    const std::vector<cv::Point2f>& corners,
    DocumentFormat format,
    int max_long_edge
) {
    if (corners.size() != 4) return {max_long_edge, max_long_edge};

    float top_width = static_cast<float>(cv::norm(corners[0] - corners[1]));
    float bottom_width = static_cast<float>(cv::norm(corners[3] - corners[2]));
    float left_height = static_cast<float>(cv::norm(corners[0] - corners[3]));
    float right_height = static_cast<float>(cv::norm(corners[1] - corners[2]));

    float avg_width = (top_width + bottom_width) / 2.0f;
    float avg_height = (left_height + right_height) / 2.0f;
    float aspect_ratio = avg_width / std::max(1e-5f, avg_height);

    float target_aspect = aspect_ratio;
    
    auto snap_if_close = [&](float ratio) {
        if (std::abs(aspect_ratio - ratio) / ratio < 0.05f) {
            target_aspect = ratio;
        }
    };

    switch (format) {
        case DocumentFormat::AUTO:
            snap_if_close(1.4142f); // A4
            snap_if_close(0.7071f); // A5
            snap_if_close(1.2941f); // LETTER
            snap_if_close(1.6471f); // LEGAL
            snap_if_close(1.75f);   // BUSINESS_CARD
            snap_if_close(1.5862f); // ID_CARD
            snap_if_close(1.0f);    // SQUARE
            break;
        case DocumentFormat::A4: target_aspect = 1.4142f; break;
        case DocumentFormat::A5: target_aspect = 0.7071f; break;
        case DocumentFormat::LETTER: target_aspect = 1.2941f; break;
        case DocumentFormat::LEGAL: target_aspect = 1.6471f; break;
        case DocumentFormat::BUSINESS_CARD: target_aspect = 1.75f; break;
        case DocumentFormat::ID_CARD: target_aspect = 1.5862f; break;
        case DocumentFormat::RECEIPT: target_aspect = 0.35f; break;
        case DocumentFormat::SQUARE: target_aspect = 1.0f; break;
    }

    int width, height;
    if (target_aspect > 1.0f) {
        width = max_long_edge;
        height = static_cast<int>(width / target_aspect);
    } else {
        height = max_long_edge;
        width = static_cast<int>(height * target_aspect);
    }

    return {std::max(1, width), std::max(1, height)};
}

PerspectiveCorrectionResult correct_perspective(
    const cv::Mat& src,
    const std::vector<cv::Point2f>& corners,
    DocumentFormat format,
    int max_long_edge
) {
    PerspectiveCorrectionResult result;
    if (corners.size() != 4 || src.empty()) return result;

    auto dims = compute_output_dimensions(corners, format, max_long_edge);
    result.output_width = dims.first;
    result.output_height = dims.second;
    result.aspect_ratio = static_cast<float>(dims.first) / std::max(1, dims.second);
    result.used_a4_snap = (format != DocumentFormat::AUTO); // Simplified flag

    std::vector<cv::Point2f> dst_corners = {
        {0.0f, 0.0f},
        {static_cast<float>(dims.first - 1), 0.0f},
        {static_cast<float>(dims.first - 1), static_cast<float>(dims.second - 1)},
        {0.0f, static_cast<float>(dims.second - 1)}
    };

    result.homography = cv::getPerspectiveTransform(corners, dst_corners);
    cv::warpPerspective(src, result.corrected_image, result.homography, 
                        cv::Size(dims.first, dims.second), 
                        cv::INTER_LANCZOS4, cv::BORDER_REPLICATE);
                        
    return result;
}

cv::Point2f map_point_to_original(
    const cv::Point2f& corrected_pt,
    const cv::Mat& homography
) {
    if (homography.empty()) return corrected_pt;
    cv::Mat H_inv = homography.inv();
    std::vector<cv::Point2f> src = {corrected_pt};
    std::vector<cv::Point2f> dst;
    cv::perspectiveTransform(src, dst, H_inv);
    return dst.empty() ? corrected_pt : dst[0];
}

bool is_landscape(const std::vector<cv::Point2f>& corners) {
    if (corners.size() != 4) return false;
    float avg_width = (cv::norm(corners[0] - corners[1]) + cv::norm(corners[3] - corners[2])) / 2.0f;
    float avg_height = (cv::norm(corners[0] - corners[3]) + cv::norm(corners[1] - corners[2])) / 2.0f;
    return avg_width > avg_height;
}

cv::Mat auto_rotate_to_portrait(const cv::Mat& corrected, float aspect_ratio) {
    if (aspect_ratio <= 1.0f || corrected.empty()) {
        return corrected;
    }
    cv::Mat rotated;
    cv::rotate(corrected, rotated, cv::ROTATE_90_CLOCKWISE);
    return rotated;
}

} // namespace dvc
