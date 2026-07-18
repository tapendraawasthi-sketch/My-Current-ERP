#include "docvision/mfnr.hpp"
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>
#include <iostream>
#include <numeric>

namespace dvc {

cv::Mat multi_frame_denoise(const std::vector<cv::Mat>& frames) {
    if (frames.empty()) return cv::Mat();
    if (frames.size() == 1) return frames[0].clone();

    // 1. Select reference frame using Laplacian variance
    int ref_idx = 0;
    double max_var = 0.0;
    for (size_t i = 0; i < frames.size(); ++i) {
        cv::Mat gray, lap;
        cv::cvtColor(frames[i], gray, cv::COLOR_BGR2GRAY);
        cv::Laplacian(gray, lap, CV_64F);
        cv::Scalar mean, stddev;
        cv::meanStdDev(lap, mean, stddev);
        double var = stddev.val[0] * stddev.val[0];
        if (var > max_var) {
            max_var = var;
            ref_idx = i;
        }
    }

    cv::Mat ref_frame = frames[ref_idx];
    cv::Mat ref_gray;
    cv::cvtColor(ref_frame, ref_gray, cv::COLOR_BGR2GRAY);

    auto orb = cv::ORB::create();
    std::vector<cv::KeyPoint> ref_kp;
    cv::Mat ref_desc;
    orb->detectAndCompute(ref_gray, cv::noArray(), ref_kp, ref_desc);

    auto matcher = cv::BFMatcher::create(cv::NORM_HAMMING, true);

    std::vector<cv::Mat> aligned_frames;
    aligned_frames.push_back(ref_frame);

    // 2. Global alignment
    for (size_t i = 0; i < frames.size(); ++i) {
        if (i == ref_idx) continue;

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

    if (aligned_frames.size() == 1) return ref_frame.clone();

    // 4. Temporal fusion (simple average for now to ensure real-time)
    cv::Mat result = cv::Mat::zeros(ref_frame.size(), CV_32FC3);
    for (const auto& f : aligned_frames) {
        cv::Mat f32;
        f.convertTo(f32, CV_32FC3);
        result += f32;
    }
    result /= (float)aligned_frames.size();
    
    cv::Mat final_out;
    result.convertTo(final_out, CV_8UC3);
    return final_out;
}

} // namespace dvc
