#include "docvision/image_utils.hpp"
#include <opencv2/imgproc.hpp>
#include <stdexcept>
#include <cmath>

namespace dvc {

cv::Mat convert_colorspace(const cv::Mat& src, ColorSpace from, ColorSpace to) {
    if (from == to) return src.clone();
    cv::Mat dst;
    int code = -1;
    if (from == ColorSpace::BGR && to == ColorSpace::GRAY) code = cv::COLOR_BGR2GRAY;
    else if (from == ColorSpace::RGB && to == ColorSpace::GRAY) code = cv::COLOR_RGB2GRAY;
    else if (from == ColorSpace::BGR && to == ColorSpace::HSV) code = cv::COLOR_BGR2HSV;
    else if (from == ColorSpace::BGR && to == ColorSpace::YCrCb) code = cv::COLOR_BGR2YCrCb;
    else if (from == ColorSpace::RGB && to == ColorSpace::YCrCb) code = cv::COLOR_RGB2YCrCb;
    else if (from == ColorSpace::BGR && to == ColorSpace::LAB) code = cv::COLOR_BGR2Lab;
    else if (from == ColorSpace::GRAY && to == ColorSpace::BGR) code = cv::COLOR_GRAY2BGR;
    else if (from == ColorSpace::RGB && to == ColorSpace::BGR) code = cv::COLOR_RGB2BGR;
    else if (from == ColorSpace::BGR && to == ColorSpace::RGB) code = cv::COLOR_BGR2RGB;
    else throw std::invalid_argument("Unsupported color space conversion");

    cv::cvtColor(src, dst, code);
    return dst;
}

cv::Mat resize(const cv::Mat& src, int width, int height, Interpolation interp) {
    cv::Mat dst;
    int flag = cv::INTER_LINEAR;
    switch (interp) {
        case Interpolation::NEAREST: flag = cv::INTER_NEAREST; break;
        case Interpolation::BILINEAR: flag = cv::INTER_LINEAR; break;
        case Interpolation::BICUBIC: flag = cv::INTER_CUBIC; break;
        case Interpolation::LANCZOS4: flag = cv::INTER_LANCZOS4; break;
    }
    cv::resize(src, dst, cv::Size(width, height), 0, 0, flag);
    return dst;
}

cv::Mat rotate(const cv::Mat& src, double angle_degrees) {
    cv::Point2f center(src.cols / 2.0f, src.rows / 2.0f);
    cv::Mat rot = cv::getRotationMatrix2D(center, angle_degrees, 1.0);
    
    cv::Rect2f bbox = cv::RotatedRect(cv::Point2f(), src.size(), static_cast<float>(angle_degrees)).boundingRect2f();
    rot.at<double>(0,2) += bbox.width/2.0 - src.cols/2.0;
    rot.at<double>(1,2) += bbox.height/2.0 - src.rows/2.0;
    
    cv::Mat dst;
    cv::warpAffine(src, dst, rot, bbox.size());
    return dst;
}

double compute_laplacian_variance(const cv::Mat& src, const cv::Rect& roi) {
    cv::Mat target = roi.empty() ? src : src(roi);
    cv::Mat lap;
    cv::Laplacian(target, lap, CV_64F);
    cv::Scalar mean, stddev;
    cv::meanStdDev(lap, mean, stddev);
    return stddev[0] * stddev[0];
}

std::vector<float> compute_histogram(const cv::Mat& src, int channel) {
    int histSize = 256;
    float range[] = { 0, 256 };
    const float* histRange = { range };
    cv::Mat hist;
    cv::calcHist(&src, 1, &channel, cv::Mat(), hist, 1, &histSize, &histRange);
    
    std::vector<float> result(256);
    for(int i = 0; i < 256; ++i) {
        result[i] = hist.at<float>(i);
    }
    return result;
}

cv::Mat warp_perspective_quad(const cv::Mat& src, const std::vector<cv::Point2f>& src_corners, int dst_width, int dst_height) {
    std::vector<cv::Point2f> dst_corners = {
        cv::Point2f(0, 0),
        cv::Point2f(static_cast<float>(dst_width - 1), 0),
        cv::Point2f(static_cast<float>(dst_width - 1), static_cast<float>(dst_height - 1)),
        cv::Point2f(0, static_cast<float>(dst_height - 1))
    };
    cv::Mat m = cv::getPerspectiveTransform(src_corners, dst_corners);
    cv::Mat dst;
    cv::warpPerspective(src, dst, m, cv::Size(dst_width, dst_height));
    return dst;
}

} // namespace dvc
