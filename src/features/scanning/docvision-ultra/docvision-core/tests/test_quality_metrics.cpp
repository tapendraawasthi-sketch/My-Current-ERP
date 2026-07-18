#include <gtest/gtest.h>
#include <docvision/quality_metrics.hpp>
#include <opencv2/imgproc.hpp>

TEST(QualityMetrics, SharpImageHasHighSharpnessScore) {
    cv::Mat sharp = cv::Mat::zeros(256, 256, CV_8UC1);
    for (int i=0;i<256;i++) for(int j=0;j<256;j++) sharp.at<uint8_t>(i,j)=(((i/8)+(j/8))%2)*255;
    float score = dvc::compute_sharpness_score(sharp, 1500.0);
    EXPECT_GT(score, 0.1f);
}

TEST(QualityMetrics, BlurImageHasLowSharpnessScore) {
    cv::Mat blur = cv::Mat(256, 256, CV_8UC1, cv::Scalar(128));
    float score = dvc::compute_sharpness_score(blur, 1500.0);
    EXPECT_NEAR(score, 0.0f, 1e-4);
}

TEST(QualityMetrics, UniformIlluminationScoreNearOne) {
    cv::Mat uniform = cv::Mat(256, 256, CV_8UC1, cv::Scalar(200));
    float score = dvc::compute_illumination_uniformity(uniform);
    EXPECT_NEAR(score, 1.0f, 1e-4);
}

TEST(QualityMetrics, GradientIlluminationScoreLow) {
    cv::Mat grad(256, 256, CV_8UC1);
    for (int i=0;i<256;i++) grad.row(i).setTo(cv::Scalar(i));
    float score = dvc::compute_illumination_uniformity(grad);
    EXPECT_LT(score, 1.0f);
}

TEST(QualityMetrics, WhiteImageHasNoGlare) {
    cv::Mat white(100, 100, CV_8UC3, cv::Scalar(255, 255, 255));
    dvc::GlareResult res = dvc::detect_glare(white);
    EXPECT_NEAR(res.score, 1.0f, 1e-4); // Saturation is 0, so no glare detected.
}

TEST(QualityMetrics, SpecularHighlightDetectedAsGlare) {
    cv::Mat img = cv::Mat::zeros(100, 100, CV_8UC3);
    // Draw a bright low-saturation spot
    cv::circle(img, cv::Point(50, 50), 20, cv::Scalar(255, 255, 255), -1);
    dvc::GlareResult res = dvc::detect_glare(img);
    EXPECT_LT(res.score, 1.0f);
}

TEST(QualityMetrics, OcclusionScoreWithNoSkinIsOne) {
    cv::Mat img = cv::Mat::zeros(100, 100, CV_8UC3); // black image, no skin tones
    float score = dvc::detect_occlusion_score(img);
    EXPECT_NEAR(score, 1.0f, 1e-4);
}

TEST(QualityMetrics, ShadowScoreWithUniformImageIsOne) {
    cv::Mat img = cv::Mat(100, 100, CV_8UC1, cv::Scalar(200));
    float score = dvc::detect_shadow_score(img);
    EXPECT_NEAR(score, 1.0f, 1e-4);
}
