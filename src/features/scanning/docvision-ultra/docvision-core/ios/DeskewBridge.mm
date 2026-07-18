#import "DeskewBridge.h"
#import <opencv2/core.hpp>
#import <opencv2/imgproc.hpp>
#import <opencv2/imgcodecs/ios.h>
#include "docvision/deskew.hpp"

@implementation DVDeskewResult
@end

@implementation DVDeskewBridge

- (DVDeskewResult*)detectSkew:(UIImage*)binaryImage maxAngle:(float)maxAngle {
    cv::Mat mat;
    UIImageToMat(binaryImage, mat);
    
    if (mat.channels() == 4) {
        cv::cvtColor(mat, mat, cv::COLOR_RGBA2GRAY);
    } else if (mat.channels() == 3) {
        cv::cvtColor(mat, mat, cv::COLOR_RGB2GRAY);
    }
    
    dvc::SkewDetectionResult cppResult = dvc::detect_skew(mat, maxAngle);
    
    DVDeskewResult* result = [[DVDeskewResult alloc] init];
    result.angleDegrees = cppResult.angle_degrees;
    result.confidence = cppResult.confidence;
    result.lineCount = cppResult.line_count;
    
    return result;
}

- (UIImage*)deskew:(UIImage*)image angle:(float)angleDegrees {
    cv::Mat mat;
    UIImageToMat(image, mat);
    
    cv::Mat deskewed = dvc::deskew(mat, angleDegrees);
    
    return MatToUIImage(deskewed);
}

- (NSInteger)detectPageOrientation:(UIImage*)binaryImage {
    cv::Mat mat;
    UIImageToMat(binaryImage, mat);
    
    if (mat.channels() == 4) {
        cv::cvtColor(mat, mat, cv::COLOR_RGBA2GRAY);
    } else if (mat.channels() == 3) {
        cv::cvtColor(mat, mat, cv::COLOR_RGB2GRAY);
    }
    
    int orientation = dvc::detect_page_orientation(mat);
    return (NSInteger)orientation;
}

@end
