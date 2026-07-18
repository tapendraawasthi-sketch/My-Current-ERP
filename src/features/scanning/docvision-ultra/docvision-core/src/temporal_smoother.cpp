#include "docvision/temporal_smoother.hpp"
#include <cmath>

namespace dvc {

TemporalSmoother::TemporalSmoother(float alpha, float jump_threshold_fraction)
    : alpha_(alpha), jump_threshold_fraction_(jump_threshold_fraction), initialized_(false) {}

std::vector<cv::Point2f> TemporalSmoother::smooth(const std::vector<cv::Point2f>& corners, float frame_diagonal) {
    if (corners.size() != 4) return corners;

    if (!initialized_) {
        ema_corners_ = corners;
        initialized_ = true;
        return ema_corners_;
    }

    float jump_thresh = jump_threshold_fraction_ * frame_diagonal;
    bool jump_detected = false;

    for (size_t i = 0; i < 4; ++i) {
        float dx = corners[i].x - ema_corners_[i].x;
        float dy = corners[i].y - ema_corners_[i].y;
        float dist = std::sqrt(dx * dx + dy * dy);
        if (dist > jump_thresh) {
            jump_detected = true;
            break;
        }
    }

    if (jump_detected) {
        ema_corners_ = corners;
        return ema_corners_;
    }

    for (size_t i = 0; i < 4; ++i) {
        ema_corners_[i].x = alpha_ * corners[i].x + (1.0f - alpha_) * ema_corners_[i].x;
        ema_corners_[i].y = alpha_ * corners[i].y + (1.0f - alpha_) * ema_corners_[i].y;
    }

    return ema_corners_;
}

void TemporalSmoother::reset() {
    initialized_ = false;
    ema_corners_.clear();
}

bool TemporalSmoother::has_state() const {
    return initialized_;
}

} // namespace dvc
