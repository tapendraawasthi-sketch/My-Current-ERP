#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

/**
 * HDR Exposure Fusion using Mertens-Kautz-Van Reeth algorithm.
 *
 * @param frames Bracketed frames (e.g., -2EV, 0EV, +2EV).
 * @return Fused HDR image.
 */
cv::Mat hdr_exposure_fusion(const std::vector<cv::Mat>& frames);

} // namespace dvc
