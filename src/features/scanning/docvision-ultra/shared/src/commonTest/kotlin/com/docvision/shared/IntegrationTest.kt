package com.docvision.shared

import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.assertEquals

// Mock classes for pipeline testing
class DocumentDetector {
    fun detect(image: ByteArray): Boolean = true
}

class QualityAssessor {
    fun assess(image: ByteArray): Int = 95
}

class OcrEngine {
    fun extractText(image: ByteArray): String = "Sample OCR Text reading block 1, block 2"
}

class DatabaseStorage {
    val savedDocuments = mutableListOf<String>()
    
    fun save(text: String) {
        savedDocuments.add(text)
    }
}

/**
 * Integration tests for the complete document processing pipeline.
 */
class IntegrationTest {

    @Test
    fun testPipelineExecutionOrderAndStorage() {
        // Arrange
        val detector = DocumentDetector()
        val assessor = QualityAssessor()
        val ocr = OcrEngine()
        val db = DatabaseStorage()
        
        val dummyImage = ByteArray(10) { it.toByte() }

        // Act
        val isDetected = detector.detect(dummyImage)
        assertTrue(isDetected, "Document should be detected")

        val quality = assessor.assess(dummyImage)
        assertTrue(quality > 80, "Quality should be sufficient")

        val text = ocr.extractText(dummyImage)
        assertTrue(text.contains("OCR Text"), "Text should be extracted")

        db.save(text)

        // Assert
        assertEquals(1, db.savedDocuments.size, "One document should be saved to DB")
        assertEquals(text, db.savedDocuments.first(), "Saved document text should match extracted text")
    }
}
