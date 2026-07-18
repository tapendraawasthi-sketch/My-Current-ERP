#include <docvision/illumination.hpp>
#include <opencv2/imgproc.hpp>
#include <vector>
#include <algorithm>

namespace dvc {

cv::Mat estimate_background(const cv::Mat& gray, int kernel_size) {
    cv::Mat bg;
    int k = kernel_size % 2 == 0 ? kernel_size + 1 : kernel_size;
    cv::GaussianBlur(gray, bg, cv::Size(k, k), 0, 0, cv::BORDER_REPLICATE);
    cv::Mat bg_float;
    bg.convertTo(bg_float, CV_32FC1);
    return bg_float;
}

cv::Mat normalize_illumination(const cv::Mat& src, const IlluminationConfig& config) {
    if (src.empty()) return src;
    
    auto process_channel = [&](const cv::Mat& channel) {
        cv::Mat bg = estimate_background(channel, config.bg_blur_kernel);
        cv::Mat ch_float;
        channel.convertTo(ch_float, CV_32F);
        
        double mean_val = cv::mean(bg)[0];
        
        cv::Mat result_float;
        cv::divide(ch_float, bg + 1e-6f, result_float, mean_val);
        
        cv::Mat result;
        result_float.convertTo(result, CV_8U, 1.0, 0.0);
        return result;
    };

    if (src.channels() == 1) {
        return process_channel(src);
    } else {
        std::vector<cv::Mat> channels;
        cv::split(src, channels);
        for (size_t i = 0; i < channels.size(); ++i) {
            channels[i] = process_channel(channels[i]);
        }
        cv::Mat merged;
        cv::merge(channels, merged);
        return merged;
    }
}

cv::Mat apply_clahe(const cv::Mat& gray, float clip_limit, int tile_grid_size) {
    cv::Mat result;
    auto clahe = cv::createCLAHE(clip_limit, cv::Size(tile_grid_size, tile_grid_size));
    clahe->apply(gray, result);
    return result;
}

cv::Mat correct_white_balance(const cv::Mat& src, float percentile) {
    if (src.empty() || src.channels() == 1) return src.clone();

    std::vector<cv::Mat> channels;
    cv::split(src, channels);

    for (int c = 0; c < 3; ++c) {
        cv::Mat flat = channels[c].reshape(1, 1);
        cv::Mat sorted;
        cv::sort(flat, sorted, cv::SORT_EVERY_ROW + cv::SORT_ASCENDING);
        
        int idx = static_cast<int>(sorted.cols * (percentile / 100.0f));
        idx = std::max(0, std::min(sorted.cols - 1, idx));
        float p_val = static_cast<float>(sorted.at<uchar>(0, idx));
        
        if (p_val > 0) {
            float scale = 255.0f / p_val;
            channels[c].convertTo(channels[c], -1, scale, 0);
        }
    }

    cv::Mat result;
    cv::merge(channels, result);
    return result;
}

cv::Mat run_illumination_pipeline(const cv::Mat& src, const IlluminationConfig& config) {
    cv::Mat working = src.clone();

    if (config.apply_white_balance && working.channels() == 3) {
        working = correct_white_balance(working, config.target_white_percentile);
    }

    if (config.apply_bg_subtraction) {
        working = normalize_illumination(working, config);
    }

    if (config.apply_clahe) {
        if (working.channels() == 3) {
            cv::Mat lab;
            cv::cvtColor(working, lab, cv::COLOR_BGR2Lab);
            std::vector<cv::Mat> lab_channels;
            cv::split(lab, lab_channels);
            lab_channels[0] = apply_clahe(lab_channels[0], config.clahe_clip_limit, config.clahe_tile_size);
            cv::merge(lab_channels, lab);
            cv::cvtColor(lab, working, cv::COLOR_Lab2BGR);
        } else {
            working = apply_clahe(working, config.clahe_clip_limit, config.clahe_tile_size);
        }
    }

    return working;
}

} // namespace dvc
