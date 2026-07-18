#include <gtest/gtest.h>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <docvision/perspective_correction.hpp>
#include <docvision/illumination.hpp>
#include <docvision/denoising.hpp>
#include <docvision/binarization.hpp>
#include <docvision/sharpening.hpp>
#include <docvision/enhancement_pipeline.hpp>

using namespace dvc;

TEST(PerspectiveCorrection, OutputSizeA4Format) {
    std::vector<cv::Point2f> corners = {
        {100, 100}, {900, 120},
        {880, 1100}, {120, 1120}
    };
    auto dims = compute_output_dimensions(corners, DocumentFormat::A4, 1000);
    float aspect = (float)dims.first / dims.second;
    EXPECT_NEAR(aspect, 1.4142f, 0.05f) << "Expected A4 aspect ratio, got " << aspect;
}

TEST(PerspectiveCorrection, HomographyInverseMapping) {
    cv::Mat H = cv::Mat::eye(3, 3, CV_64F);
    H.at<double>(0,0) = 2.0; 
    H.at<double>(1,1) = 2.0; 
    cv::Point2f pt(100.0f, 100.0f);
    cv::Point2f mapped = map_point_to_original(pt, H);
    EXPECT_NEAR(mapped.x, 50.0f, 1e-4);
    EXPECT_NEAR(mapped.y, 50.0f, 1e-4);
}

TEST(Illumination, BackgroundSubtractionUniformizesGradient) {
    cv::Mat gray(500, 500, CV_8UC1);
    for (int y = 0; y < 500; ++y) {
        gray.row(y).setTo(cv::Scalar(50 + y * 200 / 500));
    }
    IlluminationConfig config;
    config.apply_clahe = false;
    config.apply_white_balance = false;
    config.bg_blur_kernel = 51;
    cv::Mat norm = normalize_illumination(gray, config);
    
    cv::Scalar mean, stddev;
    cv::meanStdDev(norm, mean, stddev);
    float cv_score = stddev[0] / mean[0];
    EXPECT_LT(cv_score, 0.1f);
}

TEST(Illumination, WhiteBalanceCorrectsTint) {
    cv::Mat bgr(100, 100, CV_8UC3, cv::Scalar(200, 200, 250)); // Blue tint
    cv::Mat corrected = correct_white_balance(bgr);
    cv::Scalar mean = cv::mean(corrected);
    EXPECT_NEAR(mean[0], 255.0, 5.0);
    EXPECT_NEAR(mean[1], 255.0, 5.0);
    EXPECT_NEAR(mean[2], 255.0, 5.0);
}

TEST(Denoising, NlMeansReducesNoise) {
    cv::Mat gray = cv::Mat::zeros(100, 100, CV_8UC1);
    gray.setTo(cv::Scalar(128));
    cv::Mat noise(100, 100, CV_8UC1);
    cv::randn(noise, 0, 20);
    gray += noise;
    
    cv::Mat denoised = denoise_document(gray, DenoisingMethod::FAST_NL_MEANS, 20.0f);
    
    cv::Scalar m1, s1, m2, s2;
    cv::meanStdDev(gray, m1, s1);
    cv::meanStdDev(denoised, m2, s2);
    
    EXPECT_LT(s2[0], s1[0] * 0.5);
}

TEST(Binarization, SauvolaPreservesTextOnUnevenBackground) {
    cv::Mat gray(100, 100, CV_8UC1, cv::Scalar(200));
    // add dark text
    cv::rectangle(gray, cv::Rect(40, 40, 20, 20), cv::Scalar(50), -1);
    
    cv::Mat bin = sauvola_threshold(gray, 25, 0.34f);
    EXPECT_EQ(bin.at<uchar>(50, 50), 0); // Text should be 0
    EXPECT_EQ(bin.at<uchar>(10, 10), 255); // Bg should be 255
}

TEST(Binarization, OtsuOnCleanDocumentClean) {
    cv::Mat gray(100, 100, CV_8UC1, cv::Scalar(255));
    cv::rectangle(gray, cv::Rect(40, 40, 20, 20), cv::Scalar(0), -1);
    
    auto res = binarize_document(gray, BinarizationMethod::OTSU, 1.0f);
    EXPECT_EQ(res.binary.at<uchar>(50, 50), 0);
    EXPECT_EQ(res.binary.at<uchar>(10, 10), 255);
}

TEST(Sharpening, UnsharpMaskIncreasesLaplacianVariance) {
    cv::Mat gray(100, 100, CV_8UC1, cv::Scalar(128));
    cv::rectangle(gray, cv::Rect(40, 40, 20, 20), cv::Scalar(50), -1);
    cv::GaussianBlur(gray, gray, cv::Size(5, 5), 2.0); // blur it
    
    cv::Mat lap1, lap2;
    cv::Laplacian(gray, lap1, CV_32F);
    
    SharpeningConfig cfg;
    cfg.strength = 3.0f;
    cfg.sigma = 1.0f;
    cv::Mat sharp = sharpen_document(gray, cfg);
    cv::Laplacian(sharp, lap2, CV_32F);
    
    cv::Scalar m1, s1, m2, s2;
    cv::meanStdDev(lap1, m1, s1);
    cv::meanStdDev(lap2, m2, s2);
    
    EXPECT_GT(s2[0], s1[0] * 1.5);
}

TEST(FullPipeline, StandardQualityCompletes) {
    cv::Mat src(800, 600, CV_8UC3, cv::Scalar(240, 240, 240));
    std::vector<cv::Point2f> corners = {
        {50, 50}, {550, 40},
        {530, 750}, {40, 740}
    };
    
    EnhancementConfig cfg;
    cfg.quality = OutputQuality::STANDARD;
    
    auto res = run_enhancement_pipeline(src, corners, cfg, 0.9f);
    
    EXPECT_FALSE(res.color_enhanced.empty());
    EXPECT_FALSE(res.binary.empty());
    EXPECT_LT(res.timings.total_ms, 6000);
}

TEST(FullPipeline, PreviewQualityIsFast) {
    cv::Mat src(800, 600, CV_8UC3, cv::Scalar(240, 240, 240));
    std::vector<cv::Point2f> corners = {
        {50, 50}, {550, 40},
        {530, 750}, {40, 740}
    };
    
    EnhancementConfig cfg;
    cfg.quality = OutputQuality::PREVIEW;
    
    auto res = run_enhancement_pipeline(src, corners, cfg, 0.9f);
    
    EXPECT_LT(res.timings.total_ms, 1500); // Usually < 500ms
}

TEST(FullPipeline, AutoRotatePortrait) {
    cv::Mat src(600, 800, CV_8UC3, cv::Scalar(240, 240, 240));
    std::vector<cv::Point2f> corners = {
        {50, 50}, {750, 40},
        {740, 550}, {40, 540}
    };
    
    EnhancementConfig cfg;
    cfg.quality = OutputQuality::PREVIEW;
    
    auto res = run_enhancement_pipeline(src, corners, cfg, 0.9f);
    
    // Original was landscape (800x600). Output should be portrait (height > width).
    EXPECT_GT(res.color_enhanced.rows, res.color_enhanced.cols);
}
