cmake_minimum_required(VERSION 3.22)
project(docvision-core)

set(CMAKE_CXX_STANDARD 17)

if(PLATFORM STREQUAL "ANDROID")
    add_subdirectory(android)
else()
    # iOS or general static build
    find_package(OpenCV REQUIRED)
    include_directories(include)
    
    add_library(docvisioncore STATIC
        src/image_utils.cpp
        src/quality_metrics.cpp
        src/corner_refinement.cpp
        src/temporal_smoother.cpp
        src/perspective_correction.cpp
        src/illumination.cpp
        src/denoising.cpp
        src/binarization.cpp
        src/sharpening.cpp
        src/enhancement_pipeline.cpp
    )
    
    target_link_libraries(docvisioncore ${OpenCV_LIBS})
endif()

if(BUILD_TESTING)
    enable_testing()
    add_subdirectory(tests)
endif()
