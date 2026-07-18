cmake_minimum_required(VERSION 3.22)

include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/03597a01ee50ed33e9dfd640b249b4be3799d395.zip
)
FetchContent_MakeAvailable(googletest)

add_executable(docvisioncore_tests
    test_image_utils.cpp
    test_quality_metrics.cpp
    test_enhancement_pipeline.cpp
)

target_link_libraries(docvisioncore_tests
    docvisioncore
    gtest_main
    ${OpenCV_LIBS}
)

include(GoogleTest)
gtest_discover_tests(docvisioncore_tests)
