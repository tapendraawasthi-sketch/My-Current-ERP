#include <jni.h>
#include <opencv2/core.hpp>
#include "docvision/deskew.hpp"

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_docvision_ultra_processing_NativeDeskewBridge_detectSkewAngle(
    JNIEnv* env, jobject /* this */, jbyteArray pixels, jint width, jint height) {
    
    jbyte* data = env->GetByteArrayElements(pixels, NULL);
    cv::Mat img(height, width, CV_8UC1, (unsigned char*)data);
    
    dvc::SkewDetectionResult result = dvc::detect_skew(img);
    
    env->ReleaseByteArrayElements(pixels, data, JNI_ABORT);
    
    jfloatArray ret = env->NewFloatArray(2);
    jfloat ret_data[2] = { result.angle_degrees, result.confidence };
    env->SetFloatArrayRegion(ret, 0, 2, ret_data);
    
    return ret;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_docvision_ultra_processing_NativeDeskewBridge_deskewImage(
    JNIEnv* env, jobject /* this */, jbyteArray pixels, jint width, jint height, jfloat angle_degrees) {
    
    jbyte* data = env->GetByteArrayElements(pixels, NULL);
    cv::Mat img(height, width, CV_8UC1, (unsigned char*)data);
    
    cv::Mat deskewed = dvc::deskew(img, angle_degrees);
    
    env->ReleaseByteArrayElements(pixels, data, JNI_ABORT);
    
    int size = deskewed.total() * deskewed.elemSize();
    jbyteArray ret = env->NewByteArray(size);
    env->SetByteArrayRegion(ret, 0, size, (jbyte*)deskewed.data);
    
    return ret;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_docvision_ultra_processing_NativeDeskewBridge_detectPageOrientation(
    JNIEnv* env, jobject /* this */, jbyteArray pixels, jint width, jint height) {
    
    jbyte* data = env->GetByteArrayElements(pixels, NULL);
    cv::Mat img(height, width, CV_8UC1, (unsigned char*)data);
    
    int angle = dvc::detect_page_orientation(img);
    
    env->ReleaseByteArrayElements(pixels, data, JNI_ABORT);
    
    return angle;
}
