#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

class TemporalSmoother {
public:
    explicit TemporalSmoother(float alpha = 0.3f, float jump_threshold_fraction = 0.10f);
    
    /// Apply EMA smoothing to a set of corners.
    /// @param corners  4 corner points (top-left, top-right, bottom-right, bottom-left)
    /// @param frame_diagonal  Diagonal of the frame in pixels (for jump detection)
    std::vector<cv::Point2f> smooth(
        const std::vector<cv::Point2f>& corners,
        float frame_diagonal
    );
    
    void reset();
    bool has_state() const;
    
private:
    float alpha_;
    float jump_threshold_fraction_;
    std::vector<cv::Point2f> ema_corners_;
    bool initialized_;
};

} // namespace dvc
