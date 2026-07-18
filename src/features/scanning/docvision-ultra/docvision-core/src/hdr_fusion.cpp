#include "docvision/hdr_fusion.hpp"
#include <opencv2/photo.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/calib3d.hpp>

namespace dvc {

cv::Mat hdr_exposure_fusion(const std::vector<cv::Mat>& frames) {
    if (frames.empty()) return cv::Mat();
    if (frames.size() == 1) return frames[0].clone();

    // 1. Align frames using Median Threshold Bitmap
    auto alignMTB = cv::createAlignMTB();
    std::vector<cv::Mat> aligned_frames;
    alignMTB->process(frames, aligned_frames);

    // 2. Blend using Mertens
    auto mergeMertens = cv::createMergeMertens();
    cv::Mat fused;
    mergeMertens->process(aligned_frames, fused);

    // 3. Convert back to 8-bit
    cv::Mat final_out;
    fused.convertTo(final_out, CV_8UC3, 255.0);
    return final_out;
}

} // namespace dvc
