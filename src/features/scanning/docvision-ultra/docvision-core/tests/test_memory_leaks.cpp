#include <gtest/gtest.h>
#include <opencv2/opencv.hpp>

namespace dvc {
    // Forward declarations from memory_hygiene.cpp
    void enableSecureAllocator();
    void secureZeroMat(cv::Mat& mat);
}

namespace {
    /**
     * @brief Dummy enhancement pipeline to simulate processing document data.
     */
    void runEnhancementPipeline(const cv::Mat& input, cv::Mat& output) {
        cv::Mat gray, blurred, thresholded;
        
        // 1. Grayscale conversion
        cv::cvtColor(input, gray, cv::COLOR_BGR2GRAY);
        
        // 2. Blur to reduce noise
        cv::GaussianBlur(gray, blurred, cv::Size(5, 5), 0);
        
        // 3. Adaptive threshold for text extraction
        cv::adaptiveThreshold(blurred, thresholded, 255, 
                              cv::ADAPTIVE_THRESH_GAUSSIAN_C, 
                              cv::THRESH_BINARY, 11, 2);
        
        // 4. Dummy composition
        cv::Mat temp = cv::Mat::zeros(input.size(), CV_8UC1);
        cv::addWeighted(thresholded, 0.8, temp, 0.2, 0, output);
    }
}

/**
 * @brief Stress tests the secure memory allocator and enhancement pipeline.
 * Runs 100 iterations of full processing to check for memory leaks and anomalies.
 */
TEST(MemoryHygieneTest, StressTestEnhancementPipeline) {
    // Enable the secure memory allocator
    dvc::enableSecureAllocator();
    
    const int numIterations = 100;
    const int width = 1920;
    const int height = 1080;
    
    // Create a dummy document image with some drawn content
    cv::Mat inputImage = cv::Mat::ones(height, width, CV_8UC3) * 200;
    cv::rectangle(inputImage, cv::Point(100, 100), cv::Point(width - 100, height - 100), cv::Scalar(0, 0, 0), -1);
    
    for (int i = 0; i < numIterations; ++i) {
        cv::Mat outputImage;
        runEnhancementPipeline(inputImage, outputImage);
        
        // Verify output integrity
        ASSERT_FALSE(outputImage.empty());
        ASSERT_EQ(outputImage.rows, height);
        ASSERT_EQ(outputImage.cols, width);
        
        // Test explicit secure wipe on an active matrix
        dvc::secureZeroMat(outputImage);
        
        // Verify the matrix was completely zeroed
        double minVal, maxVal;
        cv::minMaxLoc(outputImage, &minVal, &maxVal);
        ASSERT_EQ(minVal, 0.0);
        ASSERT_EQ(maxVal, 0.0);
    }
    
    SUCCEED();
}
