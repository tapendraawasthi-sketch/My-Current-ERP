#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

/**
 * Multi-shot glare removal.
 *
 * @param frames Frames taken from slightly different angles.
 * @return Image with specular glare removed.
 */
cv::Mat remove_glare_multishot(const std::vector<cv::Mat>& frames);

} // namespace dvc
