#include <jni.h>
#include <opencv2/core.hpp>
#include <opencv2/imgcodecs.hpp>
#include <docvision/enhancement_pipeline.hpp>
#include <vector>

extern "C" {

JNIEXPORT jobject JNICALL
Java_com_docvision_ultra_processing_NativeEnhancementBridge_runEnhancementPipeline(
    JNIEnv *env, jobject /*this*/,
    jbyteArray pixels, jint /*width*/, jint /*height*/,
    jfloatArray corners_array, jint quality_mode)
{
    // Decode JPEG
    jsize len = env->GetArrayLength(pixels);
    jbyte *buf = env->GetByteArrayElements(pixels, nullptr);
    cv::Mat src = cv::imdecode(cv::Mat(1, len, CV_8UC1, buf), cv::IMREAD_COLOR);
    env->ReleaseByteArrayElements(pixels, buf, JNI_ABORT);

    if (src.empty()) return nullptr;

    // Parse corners
    jfloat *c_arr = env->GetFloatArrayElements(corners_array, nullptr);
    std::vector<cv::Point2f> corners = {
        cv::Point2f(c_arr[0], c_arr[1]),
        cv::Point2f(c_arr[2], c_arr[3]),
        cv::Point2f(c_arr[4], c_arr[5]),
        cv::Point2f(c_arr[6], c_arr[7])
    };
    env->ReleaseFloatArrayElements(corners_array, c_arr, JNI_ABORT);

    dvc::EnhancementConfig config;
    if (quality_mode == 0) config.quality = dvc::OutputQuality::PREVIEW;
    else if (quality_mode == 1) config.quality = dvc::OutputQuality::STANDARD;
    else config.quality = dvc::OutputQuality::MAXIMUM;

    dvc::EnhancementResult result = dvc::run_enhancement_pipeline(src, corners, config);

    // Encode outputs
    std::vector<uchar> color_buf, binary_buf;
    if (!result.color_enhanced.empty()) {
        std::vector<int> params = {cv::IMWRITE_JPEG_QUALITY, 95};
        cv::imencode(".jpg", result.color_enhanced, color_buf, params);
    }
    if (!result.binary.empty()) {
        std::vector<int> params = {cv::IMWRITE_PNG_COMPRESSION, 9};
        cv::imencode(".png", result.binary, binary_buf, params);
    }

    // Prepare Homography array
    jfloatArray H_array = env->NewFloatArray(9);
    if (!result.homography.empty()) {
        cv::Mat H_float;
        result.homography.convertTo(H_float, CV_32F);
        env->SetFloatArrayRegion(H_array, 0, 9, (jfloat*)H_float.data);
    }

    // Java byte arrays
    jbyteArray jColor = env->NewByteArray(color_buf.size());
    env->SetByteArrayRegion(jColor, 0, color_buf.size(), (jbyte*)color_buf.data());

    jbyteArray jBinary = env->NewByteArray(binary_buf.size());
    env->SetByteArrayRegion(jBinary, 0, binary_buf.size(), (jbyte*)binary_buf.data());

    // Create Java EnhancementResultJni
    jclass resultClass = env->FindClass("com/docvision/ultra/processing/EnhancementResultJni");
    jmethodID constructor = env->GetMethodID(resultClass, "<init>", "([B[B[FJF)V");
    
    return env->NewObject(resultClass, constructor, 
                          jColor, jBinary, H_array, 
                          (jlong)result.timings.total_ms, 
                          (jfloat)result.binarization_meta.text_coverage);
}

JNIEXPORT jbyteArray JNICALL
Java_com_docvision_ultra_processing_NativeEnhancementBridge_correctPerspectiveOnly(
    JNIEnv *env, jobject /*this*/,
    jbyteArray pixels, jfloatArray corners_array)
{
    jsize len = env->GetArrayLength(pixels);
    jbyte *buf = env->GetByteArrayElements(pixels, nullptr);
    cv::Mat src = cv::imdecode(cv::Mat(1, len, CV_8UC1, buf), cv::IMREAD_COLOR);
    env->ReleaseByteArrayElements(pixels, buf, JNI_ABORT);
    
    if (src.empty()) return nullptr;

    jfloat *c_arr = env->GetFloatArrayElements(corners_array, nullptr);
    std::vector<cv::Point2f> corners = {
        cv::Point2f(c_arr[0], c_arr[1]), cv::Point2f(c_arr[2], c_arr[3]),
        cv::Point2f(c_arr[4], c_arr[5]), cv::Point2f(c_arr[6], c_arr[7])
    };
    env->ReleaseFloatArrayElements(corners_array, c_arr, JNI_ABORT);

    dvc::PerspectiveCorrectionResult p_res = dvc::correct_perspective(src, corners);
    cv::Mat corrected = dvc::auto_rotate_to_portrait(p_res.corrected_image, p_res.aspect_ratio);

    std::vector<uchar> out_buf;
    std::vector<int> params = {cv::IMWRITE_JPEG_QUALITY, 95};
    cv::imencode(".jpg", corrected, out_buf, params);

    jbyteArray jOut = env->NewByteArray(out_buf.size());
    env->SetByteArrayRegion(jOut, 0, out_buf.size(), (jbyte*)out_buf.data());
    return jOut;
}

JNIEXPORT jbyteArray JNICALL
Java_com_docvision_ultra_processing_NativeEnhancementBridge_binarizeOnly(
    JNIEnv *env, jobject /*this*/,
    jbyteArray pixels, jint method_id)
{
    jsize len = env->GetArrayLength(pixels);
    jbyte *buf = env->GetByteArrayElements(pixels, nullptr);
    cv::Mat src = cv::imdecode(cv::Mat(1, len, CV_8UC1, buf), cv::IMREAD_GRAYSCALE);
    env->ReleaseByteArrayElements(pixels, buf, JNI_ABORT);

    if (src.empty()) return nullptr;

    dvc::BinarizationMethod method = dvc::BinarizationMethod::SAUVOLA;
    if (method_id == 1) method = dvc::BinarizationMethod::OTSU;
    else if (method_id == 2) method = dvc::BinarizationMethod::ADAPTIVE_GAUSSIAN;
    else if (method_id == 3) method = dvc::BinarizationMethod::NICK;
    
    dvc::BinarizationResult b_res = dvc::binarize_document(src, method);
    cv::Mat clean_bin = dvc::post_process_binary(b_res.binary);

    std::vector<uchar> out_buf;
    std::vector<int> params = {cv::IMWRITE_PNG_COMPRESSION, 9};
    cv::imencode(".png", clean_bin, out_buf, params);

    jbyteArray jOut = env->NewByteArray(out_buf.size());
    env->SetByteArrayRegion(jOut, 0, out_buf.size(), (jbyte*)out_buf.data());
    return jOut;
}

}
