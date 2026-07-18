#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <CoreVideo/CoreVideo.h>

NS_ASSUME_NONNULL_BEGIN

/// ObjC++ bridge exposing DocVisionCore functions to Swift.
@interface DocVisionBridge : NSObject

/// Compute sharpness score (0.0-1.0) for the given pixel buffer.
/// @param pixelBuffer  YpCbCr or BGRA CVPixelBuffer.
/// @param corners      Flat array of 8 floats: [x0,y0,x1,y1,x2,y2,x3,y3] normalized [0,1].
- (float)computeSharpness:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners;

- (float)computeIlluminationUniformity:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners;

/// Returns dict with @"score" (NSNumber<float>) and @"mask" (NSData with raw bytes).
- (NSDictionary*)detectGlare:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners;

- (float)detectShadows:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners;

- (float)detectOcclusion:(CVPixelBufferRef)pixelBuffer corners:(NSArray<NSNumber*>*)corners;

/// Refine 4 coarse corners. Returns array of 8 NSNumber floats.
- (NSArray<NSNumber*>*)refineCorners:(CVPixelBufferRef)pixelBuffer coarseCorners:(NSArray<NSNumber*>*)corners;

@end

NS_ASSUME_NONNULL_END
