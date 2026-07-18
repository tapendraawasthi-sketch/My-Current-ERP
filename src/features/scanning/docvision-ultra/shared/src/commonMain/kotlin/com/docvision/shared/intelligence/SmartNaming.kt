package com.docvision.shared.intelligence

/**
 * Utility for intelligently extracting metadata and generating titles 
 * from OCR-processed document text.
 */
object SmartNaming {
    
    // Matches standard ISO dates (YYYY-MM-DD)
    private val dateRegexIso = Regex("""(?:\b|(?<=[^0-9]))(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12][0-9]|3[01])\b""")
    
    // Matches common US dates (MM-DD-YYYY or MM/DD/YYYY)
    private val dateRegexUS = Regex("""\b(?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12][0-9]|3[01])[-/.](?:19|20)\d{2}\b""")
    
    // Matches currency amounts (e.g. $1,000.00, €50, ₹150)
    private val amountRegex = Regex("""[$€£₹]\s?\d+(?:,\d{3})*(?:\.\d{2})?""")

    /**
     * Extracts the first recognized date from the provided OCR text.
     */
    fun extractDate(ocrText: String): String? {
        dateRegexIso.find(ocrText)?.value?.let { return it }
        dateRegexUS.find(ocrText)?.value?.let { return it }
        return null
    }

    /**
     * Extracts the first recognized monetary amount from the provided OCR text.
     */
    fun extractAmount(ocrText: String): String? {
        return amountRegex.find(ocrText)?.value
    }

    /**
     * Generates a smart filename using the document type and extracted data.
     */
    fun generateFilename(ocrText: String, docType: String): String {
        val date = extractDate(ocrText)
        val amount = extractAmount(ocrText)
        
        val baseName = if (docType.isNotBlank()) docType else "Document"
        val datePart = if (date != null) "_$date" else ""
        val amountPart = if (amount != null) "_$amount" else ""
        
        val cleanAmountPart = amountPart.replace(" ", "")
        val combined = "${baseName}${datePart}${cleanAmountPart}"
        
        // Sanitize for file systems
        return combined.replace(Regex("[\\\\/:*?\"<>|]"), "_")
    }
}
