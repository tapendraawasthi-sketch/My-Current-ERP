#include <gtest/gtest.h>
#include <docvision/image_utils.hpp>
#include <opencv2/imgcodecs.hpp>

TEST(ImageUtils, LaplacianVarianceSharpImage) {
    cv::Mat sharp = cv::Mat::zeros(256, 256, CV_8UC1);
    for (int i=0;i<256;i++) for(int j=0;j<256;j++) sharp.at<uint8_t>(i,j)=(((i/8)+(j/8))%2)*255;
    double var = dvc::compute_laplacian_variance(sharp);
    EXPECT_GT(var, 100.0);
}

TEST(ImageUtils, LaplacianVarianceBlurImage) {
    cv::Mat blur = cv::Mat(256, 256, CV_8UC1, cv::Scalar(128));
    double var = dvc::compute_laplacian_variance(blur);
    EXPECT_LT(var, 1.0);
}

TEST(ImageUtils, ResizeMaintainsContent) {
    cv::Mat src = cv::Mat::ones(100, 100, CV_8UC1) * 255;
    cv::Mat dst = dvc::resize(src, 50, 50);
    EXPECT_EQ(dst.cols, 50);
    EXPECT_EQ(dst.rows, 50);
    EXPECT_EQ(dst.at<uint8_t>(25, 25), 255);
}

TEST(ImageUtils, ColorConversionBGRtoGray) {
    cv::Mat src(10, 10, CV_8UC3, cv::Scalar(0, 0, 255)); // Red
    cv::Mat dst = dvc::convert_colorspace(src, dvc::ColorSpace::BGR, dvc::ColorSpace::GRAY);
    EXPECT_EQ(dst.channels(), 1);
    // OpenCV BGR2GRAY for red gives ~76
    EXPECT_NEAR(dst.at<uint8_t>(5, 5), 76, 5);
}

TEST(ImageUtils, HistogramSumsToPixels) {
    cv::Mat src = cv::Mat::zeros(10, 10, CV_8UC1);
    src.at<uint8_t>(0,0) = 128;
    std::vector<float> hist = dvc::compute_histogram(src, 0);
    EXPECT_EQ(hist[0], 99.0f);
    EXPECT_EQ(hist[128], 1.0f);
}

TEST(ImageUtils, WarpPerspectiveQuadOutputSize) {
    cv::Mat src = cv::Mat::zeros(100, 100, CV_8UC1);
    std::vector<cv::Point2f> corners = {
        cv::Point2f(10,10), cv::Point2f(90,10),
        cv::Point2f(90,90), cv::Point2f(10,90)
    };
    cv::Mat dst = dvc::warp_perspective_quad(src, corners, 50, 50);
    EXPECT_EQ(dst.cols, 50);
    EXPECT_EQ(dst.rows, 50);
}

TEST(ImageUtils, RotatePreservesCenter) {
    cv::Mat src = cv::Mat::zeros(10, 10, CV_8UC1);
    src.at<uint8_t>(5,5) = 255;
    cv::Mat dst = dvc::rotate(src, 90.0);
    EXPECT_GT(dst.cols, 0);
    EXPECT_GT(dst.rows, 0);
}

TEST(ImageUtils, UnsupportedColorConversionThrows) {
    cv::Mat src(10, 10, CV_8UC3);
    EXPECT_THROW(dvc::convert_colorspace(src, dvc::ColorSpace::GRAY, dvc::ColorSpace::HSV), std::invalid_argument);
}
