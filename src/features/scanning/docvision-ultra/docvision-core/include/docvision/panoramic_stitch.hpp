#pragma once
#include <opencv2/core.hpp>
#include <vector>

namespace dvc {

/**
 * Panoramic Stitching for oversized documents.
 *
 * @param tiles Sequential overlapping tiles.
 * @return Seamlessly stitched large image.
 */
cv::Mat stitch_panoramic_document(const std::vector<cv::Mat>& tiles);

} // namespace dvc
