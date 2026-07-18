cmake_minimum_required(VERSION 3.22)
project(docvision-core)

set(CMAKE_CXX_STANDARD 17)

find_package(OpenCV REQUIRED)

include_directories(../include)

add_library(docvisioncore SHARED
    ../src/image_utils.cpp
    ../src/quality_metrics.cpp
    ../src/corner_refinement.cpp
    ../src/temporal_smoother.cpp
    ../src/perspective_correction.cpp
    ../src/illumination.cpp
    ../src/denoising.cpp
    ../src/binarization.cpp
    ../src/sharpening.cpp
    ../src/enhancement_pipeline.cpp
    ./jni_bridge.cpp
    ./jni_enhancement_bridge.cpp
)

target_link_libraries(docvisioncore
    android
    log
    jnigraphics
    ${OpenCV_LIBS}
)
