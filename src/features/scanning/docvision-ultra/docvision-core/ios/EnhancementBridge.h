#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <CoreVideo/CoreVideo.h>

NS_ASSUME_NONNULL_BEGIN

/** Result of the enhancement pipeline exposed to Swift. */
@interface DVEnhancementResult : NSObject
@property (nonatomic, strong) UIImage *colorEnhanced;
@property (nonatomic, strong) UIImage *binary;
@property (nonatomic, strong) UIImage *grayscale;
@property (nonatomic, assign) float aspectRatio;
@property (nonatomic, strong) NSArray<NSNumber*> *homographyData; // 9 floats
@property (nonatomic, assign) long totalMs;
@property (nonatomic, assign) float textCoverage;
@end

/** ObjC++ bridge for DocVisionCore enhancement pipeline. */
@interface DVEnhancementBridge : NSObject

/**
 * Run the full enhancement pipeline on a captured photo.
 * @param image     Full-resolution UIImage from AVCapturePhoto.
 * @param corners   Flat array of 8 NSNumber floats [x_tl,y_tl,...,x_bl,y_bl] in pixel coords.
 * @param qualityMode  0=PREVIEW, 1=STANDARD, 2=MAXIMUM.
 */
- (DVEnhancementResult*)runPipeline:(UIImage*)image
                            corners:(NSArray<NSNumber*>*)corners
                        qualityMode:(NSInteger)qualityMode;

/** Perspective correction only — for fast preview. */
- (UIImage*)correctPerspective:(UIImage*)image corners:(NSArray<NSNumber*>*)corners;

/** Binarize only (for OCR path). */
- (UIImage*)binarize:(UIImage*)grayscaleImage method:(NSInteger)method;

@end

NS_ASSUME_NONNULL_END
