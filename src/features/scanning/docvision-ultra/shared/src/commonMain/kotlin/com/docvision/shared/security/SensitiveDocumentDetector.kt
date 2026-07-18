package com.docvision.shared.security

/**
 * Detector for sensitive information within OCR output texts.
 * Scans for SSNs, Credit Cards (using Luhn algorithm), and Passport MRZs.
 */
class SensitiveDocumentDetector {

    private val ssnRegex = Regex("""\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b""")
    private val creditCardRegex = Regex("""\b(?:\d[ -]*?){13,16}\b""")
    // Basic Passport MRZ detection (2 lines of 44 chars starting with P)
    private val mrzRegex = Regex("""P[<A-Z][A-Z0-9<]{42}\n[A-Z0-9<]{44}""")

    /**
     * Analyzes text to determine if it contains sensitive information.
     * 
     * @param ocrText The text extracted from a document.
     * @return true if sensitive information is detected, false otherwise.
     */
    fun isSensitive(ocrText: String): Boolean {
        if (ssnRegex.containsMatchIn(ocrText)) {
            return true
        }

        if (mrzRegex.containsMatchIn(ocrText)) {
            return true
        }

        // Check for credit cards and validate with Luhn
        val ccMatches = creditCardRegex.findAll(ocrText)
        for (match in ccMatches) {
            val digits = match.value.replace(Regex("""\D"""), "")
            if (digits.length in 13..16 && passesLuhnCheck(digits)) {
                return true
            }
        }

        return false
    }

    /**
     * Validates a numeric string using the Luhn algorithm.
     */
    private fun passesLuhnCheck(ccNumber: String): Boolean {
        var sum = 0
        var alternate = false
        for (i in ccNumber.length - 1 downTo 0) {
            var n = ccNumber[i].toString().toInt()
            if (alternate) {
                n *= 2
                if (n > 9) {
                    n = (n % 10) + 1
                }
            }
            sum += n
            alternate = !alternate
        }
        return sum % 10 == 0
    }
}
