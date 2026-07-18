#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface DVDeskewResult : NSObject
@property float angleDegrees;
@property float confidence;
@property int lineCount;
@end

@interface DVDeskewBridge : NSObject
- (DVDeskewResult*)detectSkew:(UIImage*)binaryImage maxAngle:(float)maxAngle;
- (UIImage*)deskew:(UIImage*)image angle:(float)angleDegrees;
- (NSInteger)detectPageOrientation:(UIImage*)binaryImage;
@end
