#include <opencv2/opencv.hpp>
#include <opencv2/core/core.hpp>
#include <iostream>

#if defined(__unix__) || defined(__APPLE__) || defined(__linux__)
#include <sys/mman.h>
#define HAS_MLOCK 1
#else
#define HAS_MLOCK 0
#endif

namespace dvc {

/**
 * @brief A custom OpenCV memory allocator that prevents swapping of sensitive image data 
 * to disk using mlock and securely zeroes out memory upon deallocation.
 */
class SecureMatAllocator : public cv::MatAllocator {
public:
    cv::UMatData* allocate(int dims, const int* sizes, int type,
                           void* data, size_t* step, cv::AccessFlag flags, cv::UMatUsageFlags usageFlags) const override {
        cv::UMatData* u = cv::Mat::getStdAllocator()->allocate(dims, sizes, type, data, step, flags, usageFlags);
        if (u && u->data) {
            #if HAS_MLOCK
            // Lock the memory page to prevent it from being swapped out to disk
            mlock(u->data, u->size);
            #endif
        }
        return u;
    }

    bool allocate(cv::UMatData* data, cv::AccessFlag accessflags, cv::UMatUsageFlags usageFlags) const override {
        return cv::Mat::getStdAllocator()->allocate(data, accessflags, usageFlags);
    }

    void deallocate(cv::UMatData* data) const override {
        if (data && data->data) {
            // Secure wipe using a volatile loop to prevent the compiler from optimizing it away
            volatile unsigned char* p = static_cast<volatile unsigned char*>(data->data);
            for (size_t i = 0; i < data->size; ++i) {
                p[i] = 0;
            }
            #if HAS_MLOCK
            // Unlock the memory page
            munlock(data->data, data->size);
            #endif
        }
        cv::Mat::getStdAllocator()->deallocate(data);
    }
};

static SecureMatAllocator g_secureAllocator;

/**
 * @brief Enables the secure memory allocator globally for all cv::Mat instances.
 */
void enableSecureAllocator() {
    cv::Mat::setDefaultAllocator(&g_secureAllocator);
}

/**
 * @brief Manually and securely zeroes out a given cv::Mat buffer.
 * 
 * @param mat The matrix to clear. Must be continuous.
 */
void secureZeroMat(cv::Mat& mat) {
    if (mat.empty() || !mat.isContinuous()) return;
    
    volatile unsigned char* ptr = mat.ptr<volatile unsigned char>();
    size_t size = mat.total() * mat.elemSize();
    
    for (size_t i = 0; i < size; ++i) {
        ptr[i] = 0;
    }
}

} // namespace dvc
