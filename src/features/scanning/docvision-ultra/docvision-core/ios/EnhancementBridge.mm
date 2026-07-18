#import "EnhancementBridge.h"
#import <opencv2/core.hpp>
#import <opencv2/imgcodecs/ios.h>
#import <docvision/enhancement_pipeline.hpp>

@implementation DVEnhancementResult
@end

@implementation DVEnhancementBridge {
    dispatch_queue_t _processingQueue;
}

- (instancetype)init {
    if (self = [super init]) {
        _processingQueue = dispatch_queue_create("com.docvision.enhancement", DISPATCH_QUEUE_SERIAL);
    }
    return self;
}

- (DVEnhancementResult*)runPipeline:(UIImage*)image
                            corners:(NSArray<NSNumber*>*)corners
                        qualityMode:(NSInteger)qualityMode {
    if (!image || corners.count < 8) return nil;
    
    cv::Mat src;
    UIImageToMat(image, src);
    if (src.channels() == 4) {
        cv::cvtColor(src, src, cv::COLOR_RGBA2BGR);
    } else if (src.channels() == 3) {
        cv::cvtColor(src, src, cv::COLOR_RGB2BGR);
    }

    std::vector<cv::Point2f> cvCorners = {
        cv::Point2f(corners[0].floatValue, corners[1].floatValue),
        cv::Point2f(corners[2].floatValue, corners[3].floatValue),
        cv::Point2f(corners[4].floatValue, corners[5].floatValue),
        cv::Point2f(corners[6].floatValue, corners[7].floatValue)
    };

    dvc::EnhancementConfig config;
    if (qualityMode == 0) config.quality = dvc::OutputQuality::PREVIEW;
    else if (qualityMode == 1) config.quality = dvc::OutputQuality::STANDARD;
    else config.quality = dvc::OutputQuality::MAXIMUM;

    dvc::EnhancementResult cppResult = dvc::run_enhancement_pipeline(src, cvCorners, config);

    DVEnhancementResult *res = [[DVEnhancementResult alloc] init];
    
    if (!cppResult.color_enhanced.empty()) {
        cv::Mat rgb;
        cv::cvtColor(cppResult.color_enhanced, rgb, cv::COLOR_BGR2RGB);
        res.colorEnhanced = MatToUIImage(rgb);
    }
    
    if (!cppResult.binary.empty()) {
        res.binary = MatToUIImage(cppResult.binary);
    }
    
    if (!cppResult.grayscale.empty()) {
        res.grayscale = MatToUIImage(cppResult.grayscale);
    }

    res.aspectRatio = cppResult.aspect_ratio;
    res.totalMs = cppResult.timings.total_ms;
    res.textCoverage = cppResult.binarization_meta.text_coverage;

    if (!cppResult.homography.empty()) {
        cv::Mat H;
        cppResult.homography.convertTo(H, CV_32F);
        NSMutableArray<NSNumber*> *hArr = [NSMutableArray arrayWithCapacity:9];
        for (int i = 0; i < 9; ++i) {
            [hArr addObject:@(((float*)H.data)[i])];
        }
        res.homographyData = hArr;
    }

    return res;
}

- (UIImage*)correctPerspective:(UIImage*)image corners:(NSArray<NSNumber*>*)corners {
    if (!image || corners.count < 8) return nil;
    
    cv::Mat src;
    UIImageToMat(image, src);
    if (src.channels() == 4) cv::cvtColor(src, src, cv::COLOR_RGBA2BGR);
    else if (src.channels() == 3) cv::cvtColor(src, src, cv::COLOR_RGB2BGR);

    std::vector<cv::Point2f> cvCorners = {
        cv::Point2f(corners[0].floatValue, corners[1].floatValue),
        cv::Point2f(corners[2].floatValue, corners[3].floatValue),
        cv::Point2f(corners[4].floatValue, corners[5].floatValue),
        cv::Point2f(corners[6].floatValue, corners[7].floatValue)
    };

    auto pRes = dvc::correct_perspective(src, cvCorners);
    cv::Mat corrected = dvc::auto_rotate_to_portrait(pRes.corrected_image, pRes.aspect_ratio);

    cv::Mat rgb;
    if (corrected.channels() == 3) cv::cvtColor(corrected, rgb, cv::COLOR_BGR2RGB);
    else rgb = corrected;

    return MatToUIImage(rgb);
}

- (UIImage*)binarize:(UIImage*)grayscaleImage method:(NSInteger)method {
    if (!grayscaleImage) return nil;
    
    cv::Mat gray;
    UIImageToMat(grayscaleImage, gray);
    if (gray.channels() > 1) {
        cv::cvtColor(gray, gray, cv::COLOR_BGR2GRAY);
    }

    dvc::BinarizationMethod cppMethod = dvc::BinarizationMethod::SAUVOLA;
    if (method == 1) cppMethod = dvc::BinarizationMethod::OTSU;
    else if (method == 2) cppMethod = dvc::BinarizationMethod::ADAPTIVE_GAUSSIAN;
    else if (method == 3) cppMethod = dvc::BinarizationMethod::NICK;

    auto bRes = dvc::binarize_document(gray, cppMethod);
    cv::Mat cleanBin = dvc::post_process_binary(bRes.binary);
    
    return MatToUIImage(cleanBin);
}

@end
