#import "DocVisionBridge.h"
#include <docvision/image_utils.hpp>
#include <docvision/quality_metrics.hpp>
#include <docvision/temporal_smoother.hpp>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

@implementation DocVisionBridge {
    dispatch_queue_t _workQueue;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _workQueue = dispatch_queue_create("com.docvision.core", DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

- (cv::Mat)cvPixelBufferToCvMat:(CVPixelBufferRef)pixelBuffer {
    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    void* baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer);
    size_t width = CVPixelBufferGetWidth(pixelBuffer);
    size_t height = CVPixelBufferGetHeight(pixelBuffer);
    size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
    OSType formatType = CVPixelBufferGetPixelFormatType(pixelBuffer);
    
    cv::Mat mat;
    if (formatType == kCVPixelFormatType_32BGRA) {
        cv::Mat bgra((int)height, (int)width, CV_8UC4, baseAddress, bytesPerRow);
        cv::cvtColor(bgra, mat, cv::COLOR_BGRA@BGR); // drop alpha
    } else {
        // Fallback assumes gray or already handled via some other way
        cv::Mat tmp((int)height, (int)width, CV_8UC1, baseAddress, bytesPerRow);
        mat = tmp.clone();
    }
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    return mat;
}

- (std::vector<cv::Point2f>)nsArrayToCorners:(NSArray<NSNumber*>*)arr width:(int)w height:(int)h {
    std::vector<cv::Point2f> corners;
    for (NSUInteger i=0; i<arr.count; i+=2) {
        float x = arr[i].floatValue * w;
        float y = arr[i+1].floatValue * h;
        corners.push_back(cv::Point2f(x, y));
    }
    return corners;
}

- (float)computeSharpness:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners {
    __block float result = 0.0f;
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        cv::Mat warped = dvc::warp_perspective_quad(mat, pts, 500, 500);
        result = dvc::compute_sharpness_score(warped);
    });
    return result;
}

- (float)computeIlluminationUniformity:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners {
    __block float result = 0.0f;
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        cv::Mat warped = dvc::warp_perspective_quad(mat, pts, 500, 500);
        cv::Mat gray = dvc::convert_colorspace(warped, dvc::ColorSpace::BGR, dvc::ColorSpace::GRAY);
        result = dvc::compute_illumination_uniformity(gray);
    });
    return result;
}

- (NSDictionary*)detectGlare:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners {
    __block NSDictionary* resultDict;
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        cv::Mat warped = dvc::warp_perspective_quad(mat, pts, 500, 500);
        dvc::GlareResult g = dvc::detect_glare(warped);
        
        NSData* maskData = [NSData dataWithBytes:g.mask.data length:g.mask.total() * g.mask.elemSize()];
        resultDict = @{
            @"score": @(g.score),
            @"mask": maskData
        };
    });
    return resultDict;
}

- (float)detectShadows:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners {
    __block float result = 0.0f;
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        cv::Mat warped = dvc::warp_perspective_quad(mat, pts, 500, 500);
        cv::Mat gray = dvc::convert_colorspace(warped, dvc::ColorSpace::BGR, dvc::ColorSpace::GRAY);
        result = dvc::detect_shadow_score(gray);
    });
    return result;
}

- (float)detectOcclusion:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners {
    __block float result = 0.0f;
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        cv::Mat warped = dvc::warp_perspective_quad(mat, pts, 500, 500);
        result = dvc::detect_occlusion_score(warped);
    });
    return result;
}

- (NSArray<NSNumber*>*)refineCorners:(CVPixelBufferRef)pixelBuffer coarseCorners:(NSArray<NSNumber*>*)corners {
    __block NSMutableArray* result = [NSMutableArray array];
    dispatch_sync(_workQueue, ^{
        cv::Mat mat = [self cvPixelBufferToCvMat:pixelBuffer];
        auto pts = [self nsArrayToCorners:corners width:mat.cols height:mat.rows];
        auto refined = dvc::refine_corners(mat, pts);
        for(const auto& pt : refined) {
            [result addObject:@(pt.x / mat.cols)];
            [result addObject:@(pt.y / mat.rows)];
        }
    });
    return result;
}

@end
