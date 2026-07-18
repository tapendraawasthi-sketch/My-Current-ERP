#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

/**
 * Multi-Frame Noise Reduction (MFNR).
 * Aligns a burst of frames and fuses them to reduce noise while rejecting motion.
 *
 * @param frames Burst of frames to fuse.
 * @return Fused, denoised image.
 */
cv::Mat multi_frame_denoise(const std::vector<cv::Mat>& frames);

} // namespace dvc
