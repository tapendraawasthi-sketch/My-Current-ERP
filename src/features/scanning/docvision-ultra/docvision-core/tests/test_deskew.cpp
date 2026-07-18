#include <gtest/gtest.h>
#include <docvision/deskew.hpp>
#include <opencv2/imgproc.hpp>
#include <cmath>

using namespace dvc;

cv::Mat create_skewed_text(int width, int height, float angle_degrees, int num_lines = 10) {
    cv::Mat img(height, width, CV_8UC1, cv::Scalar(255));
    cv::Point2f center(width / 2.0f, height / 2.0f);
    
    for (int i = 0; i < num_lines; ++i) {
        int y = (height / (num_lines + 1)) * (i + 1);
        cv::line(img, cv::Point(0, y), cv::Point(width, y), cv::Scalar(0), 2);
    }
    
    cv::Mat M = cv::getRotationMatrix2D(center, -angle_degrees, 1.0);
    cv::Mat rotated;
    cv::warpAffine(img, rotated, M, img.size(), cv::INTER_LINEAR, cv::BORDER_CONSTANT, cv::Scalar(255));
    
    return rotated;
}

TEST(Deskew, DetectsPositiveSkew) {
    cv::Mat img = create_skewed_text(800, 600, 3.0f);
    auto result = detect_skew(img);
    EXPECT_NEAR(result.angle_degrees, 3.0f, 1.0f);
}

TEST(Deskew, DetectsNegativeSkew) {
    cv::Mat img = create_skewed_text(800, 600, -5.0f);
    auto result = detect_skew(img);
    EXPECT_NEAR(result.angle_degrees, -5.0f, 1.0f);
}

TEST(Deskew, ZeroSkewImageUnchanged) {
    cv::Mat img = create_skewed_text(800, 600, 0.0f);
    auto [deskewed, result] = detect_and_deskew(img, 0.3f, 0.5f);
    EXPECT_LT(std::abs(result.angle_degrees), 0.5f);
    EXPECT_EQ(deskewed.size(), img.size());
}

TEST(Deskew, DeskewReducesSkew) {
    cv::Mat img = create_skewed_text(800, 600, 3.0f);
    auto [deskewed, result] = detect_and_deskew(img);
    auto new_result = detect_skew(deskewed);
    EXPECT_LT(std::abs(new_result.angle_degrees), 0.5f);
}

TEST(Deskew, DetectOrientationPortrait) {
    cv::Mat img = create_skewed_text(800, 1000, 0.0f, 20);
    cv::Mat binary;
    cv::threshold(img, binary, 128, 255, cv::THRESH_BINARY_INV);
    int angle = detect_page_orientation(binary);
    EXPECT_EQ(angle, 0);
}

TEST(Deskew, DetectOrientation90) {
    cv::Mat img = create_skewed_text(800, 1000, 0.0f, 20);
    cv::Mat binary, rotated;
    cv::threshold(img, binary, 128, 255, cv::THRESH_BINARY_INV);
    cv::rotate(binary, rotated, cv::ROTATE_90_CLOCKWISE);
    int angle = detect_page_orientation(rotated);
    EXPECT_TRUE(angle == 90 || angle == 270);
}

TEST(Deskew, DetectAndDeskewHighConfidence) {
    cv::Mat img = create_skewed_text(800, 600, 4.0f, 15);
    auto result = detect_skew(img);
    EXPECT_GT(result.confidence, 0.5f);
}
