#pragma once
#include <opencv2/core.hpp>
#include <string>
#include <vector>

namespace dvc {

struct OcrTextRegion {
    std::string text;
    std::vector<cv::Point> polygon;
    float confidence;
    bool is_handwritten;
};

struct ScannedPageData {
    cv::Mat image; // The enhanced image
    bool is_binary; // True if it's a B&W binarized image (use CCITT G4)
    std::vector<OcrTextRegion> ocr_regions;
};

class PdfGenerator {
public:
    PdfGenerator();
    ~PdfGenerator();
    
    // Generates a PDF/A-2b compliant file
    bool generate_pdf_a(const std::vector<ScannedPageData>& pages, 
                        const std::string& output_path,
                        const std::string& title);
};

} // namespace dvc
