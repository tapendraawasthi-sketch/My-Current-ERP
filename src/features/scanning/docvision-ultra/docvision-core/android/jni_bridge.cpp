#include <jni.h>
#include <android/bitmap.h>
#include <docvision/image_utils.hpp>
#include <docvision/quality_metrics.hpp>
#include <docvision/temporal_smoother.hpp>
#include <opencv2/core.hpp>

extern "C" {

static cv::Mat bitmap_to_mat(JNIEnv* env, jobject bitmap) {
    AndroidBitmapInfo info;
    void* pixels;
    AndroidBitmap_getInfo(env, bitmap, &info);
    AndroidBitmap_lockPixels(env, bitmap, &pixels);
    cv::Mat mat(info.height, info.width, CV_8UC4, pixels); // ARGB_8888
    cv::Mat cloned = mat.clone(); // clone so we can unlock
    AndroidBitmap_unlockPixels(env, bitmap, pixels);
    return cloned;
}

static cv::Mat byte_array_to_mat(JNIEnv* env, jbyteArray pixels, jint width, jint height) {
    jbyte* data = env->GetByteArrayElements(pixels, NULL);
    cv::Mat mat(height, width, CV_8UC4, data); // Assuming NV21 or similar decoded to RGBA/BGRA byte array
    cv::Mat cloned = mat.clone();
    env->ReleaseByteArrayElements(pixels, data, JNI_ABORT);
    return cloned;
}

static std::vector<cv::Point2f> float_array_to_corners(JNIEnv* env, jfloatArray arr) {
    std::vector<cv::Point2f> corners;
    jfloat* data = env->GetFloatArrayElements(arr, NULL);
    jsize len = env->GetArrayLength(arr);
    for(int i = 0; i < len; i += 2) {
        corners.push_back(cv::Point2f(data[i], data[i+1]));
    }
    env->ReleaseFloatArrayElements(arr, data, JNI_ABORT);
    return corners;
}

JNIEXPORT jfloat JNICALL
Java_com_docvision_ultra_ml_NativeQualityBridge_computeSharpness(
    JNIEnv* env, jobject /* this */,
    jbyteArray pixels, jint width, jint height, jfloatArray cornersArray
) {
    cv::Mat img = byte_array_to_mat(env, pixels, width, height);
    auto corners = float_array_to_corners(env, cornersArray);
    cv::Mat warped = dvc::warp_perspective_quad(img, corners, 500, 500); // normalized size
    return dvc::compute_sharpness_score(warped);
}

JNIEXPORT jfloat JNICALL
Java_com_docvision_ultra_ml_NativeQualityBridge_computeIlluminationUniformity(
    JNIEnv* env, jobject /* this */,
    jbyteArray pixels, jint width, jint height, jfloatArray cornersArray
) {
    cv::Mat img = byte_array_to_mat(env, pixels, width, height);
    auto corners = float_array_to_corners(env, cornersArray);
    cv::Mat warped = dvc::warp_perspective_quad(img, corners, 500, 500);
    cv::Mat gray = dvc::convert_colorspace(warped, dvc::ColorSpace::BGR, dvc::ColorSpace::GRAY);
    return dvc::compute_illumination_uniformity(gray);
}

JNIEXPORT jfloatArray JNICALL
Java_com_docvision_ultra_ml_NativeQualityBridge_refineCorners(
    JNIEnv* env, jobject,
    jbyteArray pixels, jint width, jint height, jfloatArray coarseCorners
) {
    cv::Mat img = byte_array_to_mat(env, pixels, width, height);
    auto corners = float_array_to_corners(env, coarseCorners);
    auto refined = dvc::refine_corners(img, corners);
    
    jfloatArray result = env->NewFloatArray(refined.size() * 2);
    std::vector<jfloat> out;
    for (const auto& pt : refined) { out.push_back(pt.x); out.push_back(pt.y); }
    env->SetFloatArrayRegion(result, 0, out.size(), out.data());
    return result;
}

} // extern "C"
