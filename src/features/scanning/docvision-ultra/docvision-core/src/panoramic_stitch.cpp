#include "docvision/panoramic_stitch.hpp"
#include <opencv2/stitching.hpp>
#include <iostream>

namespace dvc {

cv::Mat stitch_panoramic_document(const std::vector<cv::Mat>& tiles) {
    if (tiles.empty()) return cv::Mat();
    if (tiles.size() == 1) return tiles[0].clone();

    cv::Mat pano;
    cv::Ptr<cv::Stitcher> stitcher = cv::Stitcher::create(cv::Stitcher::SCANS);
    
    cv::Stitcher::Status status = stitcher->stitch(tiles, pano);
    
    if (status != cv::Stitcher::OK) {
        std::cerr << "Can't stitch images, error code = " << int(status) << std::endl;
        return cv::Mat();
    }
    
    return pano;
}

} // namespace dvc
