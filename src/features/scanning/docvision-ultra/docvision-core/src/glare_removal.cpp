#include "docvision/glare_removal.hpp"
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <iostream>

namespace dvc {

cv::Mat remove_glare_multishot(const std::vector<cv::Mat>& frames) {
    if (frames.empty()) return cv::Mat();
    if (frames.size() == 1) return frames[0].clone();

    cv::Mat ref_frame = frames[0];
    cv::Mat ref_gray;
    cv::cvtColor(ref_frame, ref_gray, cv::COLOR_BGR2GRAY);

    auto orb = cv::ORB::create();
    std::vector<cv::KeyPoint> ref_kp;
    cv::Mat ref_desc;
    orb->detectAndCompute(ref_gray, cv::noArray(), ref_kp, ref_desc);
    auto matcher = cv::BFMatcher::create(cv::NORM_HAMMING, true);

    std::vector<cv::Mat> aligned_frames;
    aligned_frames.push_back(ref_frame);

    for (size_t i = 1; i < frames.size(); ++i) {
        cv::Mat gray;
        cv::cvtColor(frames[i], gray, cv::COLOR_BGR2GRAY);

        std::vector<cv::KeyPoint> kp;
        cv::Mat desc;
        orb->detectAndCompute(gray, cv::noArray(), kp, desc);

        if (desc.empty()) continue;

        std::vector<cv::DMatch> matches;
        matcher->match(desc, ref_desc, matches);

        if (matches.size() < 10) continue;

        std::vector<cv::Point2f> src_pts, dst_pts;
        for (const auto& m : matches) {
            src_pts.push_back(kp[m.queryIdx].pt);
            dst_pts.push_back(ref_kp[m.trainIdx].pt);
        }

        cv::Mat H = cv::findHomography(src_pts, dst_pts, cv::RANSAC, 3.0);
        if (H.empty()) continue;

        cv::Mat aligned;
        cv::warpPerspective(frames[i], aligned, H, ref_frame.size());
        aligned_frames.push_back(aligned);
    }

    // Soft-min compositing to select lowest glare pixels (lower brightness)
    cv::Mat result = cv::Mat::zeros(ref_frame.size(), CV_8UC3);
    
    for (int y = 0; y < ref_frame.rows; ++y) {
        for (int x = 0; x < ref_frame.cols; ++x) {
            int min_val = 255 * 3;
            cv::Vec3b best_pixel = ref_frame.at<cv::Vec3b>(y, x);
            
            for (const auto& f : aligned_frames) {
                cv::Vec3b p = f.at<cv::Vec3b>(y, x);
                int val = p[0] + p[1] + p[2];
                if (val < min_val && val > 0) { // skip black pixels from warping
                    min_val = val;
                    best_pixel = p;
                }
            }
            result.at<cv::Vec3b>(y, x) = best_pixel;
        }
    }
    
    return result;
}

} // namespace dvc
