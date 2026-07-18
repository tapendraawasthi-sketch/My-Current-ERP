#include <docvision/binarization.hpp>
#include <opencv2/imgproc.hpp>
#include <cmath>

namespace dvc {

static cv::Mat compute_local_threshold(const cv::Mat& gray, int window_size, float k, bool is_sauvola) {
    cv::Mat gray_f;
    gray.convertTo(gray_f, CV_32F);
    
    cv::Mat sq_img, sum_img;
    cv::integral(gray_f, sum_img, sq_img, CV_64F);

    int r = window_size / 2;
    int w = gray.cols;
    int h = gray.rows;
    float N = static_cast<float>(window_size * window_size);

    cv::Mat binary = cv::Mat::zeros(h, w, CV_8U);

    for (int y = 0; y < h; ++y) {
        int y1 = std::max(0, y - r);
        int y2 = std::min(h, y + r + 1);
        
        for (int x = 0; x < w; ++x) {
            int x1 = std::max(0, x - r);
            int x2 = std::min(w, x + r + 1);

            float area = static_cast<float>((y2 - y1) * (x2 - x1));

            double sum = sum_img.at<double>(y2, x2) - sum_img.at<double>(y2, x1) - 
                         sum_img.at<double>(y1, x2) + sum_img.at<double>(y1, x1);
            
            double sq_sum = sq_img.at<double>(y2, x2) - sq_img.at<double>(y2, x1) - 
                            sq_img.at<double>(y1, x2) + sq_img.at<double>(y1, x1);

            float mean = static_cast<float>(sum / area);
            float var = static_cast<float>((sq_sum / area) - (mean * mean));
            if (var < 0) var = 0;
            float std_dev = std::sqrt(var);

            float T = 0.0f;
            if (is_sauvola) {
                T = mean * (1.0f + k * (std_dev / 128.0f - 1.0f));
            } else { // NICK
                float nick_var = static_cast<float>((sq_sum / area) - (mean * mean));
                if (nick_var < 0) nick_var = 0;
                T = mean + k * std::sqrt(nick_var);
            }

            if (gray.at<uchar>(y, x) < T) {
                binary.at<uchar>(y, x) = 0;
            } else {
                binary.at<uchar>(y, x) = 255;
            }
        }
    }
    return binary;
}

cv::Mat sauvola_threshold(const cv::Mat& gray, int window_size, float k) {
    return compute_local_threshold(gray, window_size, k, true);
}

cv::Mat nick_threshold(const cv::Mat& gray, int window_size, float k) {
    return compute_local_threshold(gray, window_size, k, false);
}

BinarizationResult binarize_document(
    const cv::Mat& gray,
    BinarizationMethod method,
    float illumination_uniformity
) {
    BinarizationResult result;
    
    cv::Mat otsu_binary;
    result.otsu_threshold = static_cast<float>(cv::threshold(gray, otsu_binary, 0, 255, cv::THRESH_BINARY | cv::THRESH_OTSU));

    if (method == BinarizationMethod::AUTO) {
        if (illumination_uniformity >= 0.8f) method = BinarizationMethod::OTSU;
        else if (illumination_uniformity >= 0.5f) method = BinarizationMethod::SAUVOLA;
        else method = BinarizationMethod::NICK;
    }

    result.used = method;

    if (method == BinarizationMethod::OTSU) {
        result.binary = otsu_binary;
    } else if (method == BinarizationMethod::ADAPTIVE_GAUSSIAN) {
        cv::adaptiveThreshold(gray, result.binary, 255, cv::ADAPTIVE_THRESH_GAUSSIAN_C, cv::THRESH_BINARY, 15, 8);
    } else if (method == BinarizationMethod::SAUVOLA) {
        result.binary = sauvola_threshold(gray);
    } else if (method == BinarizationMethod::NICK) {
        result.binary = nick_threshold(gray);
    }

    // text is 0, paper is 255, count zeroes
    int text_pixels = (result.binary.rows * result.binary.cols) - cv::countNonZero(result.binary);
    result.text_coverage = static_cast<float>(text_pixels) / (result.binary.rows * result.binary.cols);

    return result;
}

cv::Mat post_process_binary(const cv::Mat& binary, bool remove_noise, bool fill_holes) {
    if (binary.empty()) return binary;
    
    cv::Mat inverted;
    cv::bitwise_not(binary, inverted); // text is now 255
    
    cv::Mat kernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(2, 2));

    if (remove_noise) {
        cv::morphologyEx(inverted, inverted, cv::MORPH_OPEN, kernel);
    }
    
    if (fill_holes) {
        cv::morphologyEx(inverted, inverted, cv::MORPH_CLOSE, kernel);
    }

    cv::bitwise_not(inverted, inverted); // text is back to 0
    return inverted;
}

} // namespace dvc
