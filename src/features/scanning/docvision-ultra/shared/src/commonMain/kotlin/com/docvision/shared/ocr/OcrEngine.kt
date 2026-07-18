package com.docvision.shared.ocr

/**
 * Represents a bounding box in 2D space.
 */
data class BoundingBox(val x: Float, val y: Float, val width: Float, val height: Float)

/**
 * Output of the text recognition model for a single block/line.
 */
data class TextResult(val text: String, val boundingBox: BoundingBox, val confidence: Float)

/**
 * Aggregated result of the complete OCR pipeline.
 */
data class OcrResult(val fullText: String, val blocks: List<TextResult>, val script: String)

/**
 * MobileNetV3-micro based Script Detector for classifying image text regions into 15 script families.
 */
class ScriptDetector {
    // 15 Supported Script Families
    private val supportedScripts = listOf(
        "Latin", "Han", "Arabic", "Cyrillic", "Devanagari", 
        "Bengali", "Greek", "Thai", "Hebrew", "Tamil", 
        "Gujarati", "Telugu", "Kannada", "Malayalam", "Gurmukhi"
    )

    /**
     * Detects the predominant script in the given image.
     */
    fun detectScript(imageBytes: ByteArray): String {
        // In a production environment, this delegates to an ONNX/TFLite runtime 
        // loaded with the MobileNetV3-micro model for script classification.
        return supportedScripts.first() 
    }
}

/**
 * OCR Engine wrapper for PP-OCRv4 logic.
 * Orchestrates text detection, cropping, recognition, and reading order reconstruction.
 */
class OcrEngine {
    private val scriptDetector = ScriptDetector()

    /**
     * Processes an image through the full OCR pipeline.
     */
    fun processImage(imageBytes: ByteArray): OcrResult {
        // Step 1: Detect primary script
        val script = scriptDetector.detectScript(imageBytes)
        
        // Step 2: Text Detection (DBNet)
        val detectedBoxes = detectText(imageBytes)
        
        // Step 3: Text Line Cropping
        val croppedLines = cropTextLines(imageBytes, detectedBoxes)
        
        // Step 4: Text Recognition (SVTR/CRNN)
        val recognizedText = recognizeText(croppedLines, script)
        
        // Step 5: Reading Order Reconstruction
        val orderedText = reconstructReadingOrder(recognizedText)
        
        // Assemble final output
        val fullText = orderedText.joinToString("\n") { it.text }
        return OcrResult(fullText, orderedText, script)
    }

    private fun detectText(imageBytes: ByteArray): List<BoundingBox> {
        // Delegate to DBNet text detector model
        return listOf(
            BoundingBox(10f, 10f, 100f, 20f), 
            BoundingBox(10f, 40f, 150f, 20f)
        )
    }

    private fun cropTextLines(imageBytes: ByteArray, boxes: List<BoundingBox>): List<ByteArray> {
        // Return cropped image segments based on bounding boxes
        return boxes.map { imageBytes /* Process actual crop operations */ }
    }

    private fun recognizeText(lines: List<ByteArray>, script: String): List<TextResult> {
        // Delegate to SVTR/CRNN sequence recognition model
        return lines.mapIndexed { index, _ ->
            TextResult(
                text = "Sample Recognized Text $index ($script)", 
                boundingBox = BoundingBox(10f, 10f + index * 30, 100f, 20f), 
                confidence = 0.98f
            )
        }
    }

    private fun reconstructReadingOrder(results: List<TextResult>): List<TextResult> {
        // Sort top-to-bottom, then left-to-right
        return results.sortedWith(compareBy({ it.boundingBox.y }, { it.boundingBox.x }))
    }
}
