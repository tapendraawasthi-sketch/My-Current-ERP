#pragma once

#define DVC_VERSION_MAJOR 1
#define DVC_VERSION_MINOR 0
#define DVC_VERSION_PATCH 0

#if defined(_WIN32) && defined(DVC_BUILD_SHARED)
    #define DVC_API __declspec(dllexport)
#elif defined(_WIN32)
    #define DVC_API __declspec(dllimport)
#else
    #define DVC_API __attribute__((visibility("default")))
#endif

#include "docvision/image_utils.hpp"
#include "docvision/quality_metrics.hpp"
#include "docvision/temporal_smoother.hpp"
