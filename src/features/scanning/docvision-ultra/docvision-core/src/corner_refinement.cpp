#include "docvision/quality_metrics.hpp"
#include <opencv2/imgproc.hpp>
#include <cmath>

namespace dvc {

std::vector<cv::Point2f> refine_corners(const cv::Mat& full_res_frame, const std::vector<cv::Point2f>& coarse_corners, int patch_size) {
    std::vector<cv::Point2f> refined;
    cv::Mat gray;
    if (full_res_frame.channels() == 3) {
        cv::cvtColor(full_res_frame, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = full_res_frame.clone();
    }
    
    int half = patch_size / 2;
    for (const auto& corner : coarse_corners) {
        cv::Rect roi(
            std::max(0, static_cast<int>(corner.x) - half),
            std::max(0, static_cast<int>(corner.y) - half),
            patch_size, patch_size
        );
        if (roi.x + roi.width > gray.cols) roi.width = gray.cols - roi.x;
        if (roi.y + roi.height > gray.rows) roi.height = gray.rows - roi.y;
        
        cv::Mat patch = gray(roi);
        cv::Mat edges;
        cv::Canny(patch, edges, 50, 150, 3);
        
        std::vector<cv::Vec2f> lines;
        cv::HoughLines(edges, lines, 1, CV_PI / 180, 30);
        
        cv::Point2f best_pt = corner; // default to original
        
        if (lines.size() >= 2) {
            cv::Vec2f l1 = lines[0];
            cv::Vec2f l2;
            bool found = false;
            for (size_t i = 1; i < lines.size(); ++i) {
                float diff = std::abs(l1[1] - lines[i][1]);
                if (diff > CV_PI/4.0f && diff < 3.0f*CV_PI/4.0f) {
                    l2 = lines[i];
                    found = true;
                    break;
                }
            }
            
            if (found) {
                float rho1 = l1[0], theta1 = l1[1];
                float rho2 = l2[0], theta2 = l2[1];
                float ct1 = std::cos(theta1), st1 = std::sin(theta1);
                float ct2 = std::cos(theta2), st2 = std::sin(theta2);
                float det = ct1 * st2 - st1 * ct2;
                if (std::abs(det) > 1e-6) {
                    float x = (st2 * rho1 - st1 * rho2) / det;
                    float y = (-ct2 * rho1 + ct1 * rho2) / det;
                    if (x >= 0 && x < roi.width && y >= 0 && y < roi.height) {
                        best_pt = cv::Point2f(x + roi.x, y + roi.y);
                        refined.push_back(best_pt);
                        continue;
                    }
                }
            }
        }
        
        // Fallback to goodFeaturesToTrack
        std::vector<cv::Point2f> corners;
        cv::goodFeaturesToTrack(patch, corners, 1, 0.01, 10);
        if (!corners.empty()) {
            cv::cornerSubPix(patch, corners, cv::Size(5, 5), cv::Size(-1, -1), cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 40, 0.001));
            best_pt = cv::Point2f(corners[0].x + roi.x, corners[0].y + roi.y);
        }
        refined.push_back(best_pt);
    }
    
    return refined;
}

} // namespace dvc
