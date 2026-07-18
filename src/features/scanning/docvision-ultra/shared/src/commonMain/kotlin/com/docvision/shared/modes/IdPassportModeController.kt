package com.docvision.shared.modes

class IdPassportModeController {
    
    companion object {
        const val ID_ASPECT_RATIO = 1.586f // ID-1 format (85.60 x 53.98 mm)
    }
    
    data class MrzData(
        val documentType: String,
        val issuingCountry: String,
        val primaryName: String,
        val secondaryName: String,
        val documentNumber: String,
        val nationality: String,
        val dateOfBirth: String,
        val sex: String,
        val dateOfExpiry: String,
        val personalNumber: String,
        val isValid: Boolean
    )

    /**
     * Validates if a detected rectangle matches the ID-1 aspect ratio.
     */
    fun isValidIdAspectRatio(width: Float, height: Float, tolerance: Float = 0.05f): Boolean {
        val ratio = if (width > height) width / height else height / width
        return kotlin.math.abs(ratio - ID_ASPECT_RATIO) <= tolerance
    }

    /**
     * Parses a standard 2-line or 3-line MRZ string (ICAO 9303 standard for TD3).
     * Basic parsing logic for demonstration.
     */
    fun parseMrz(mrzLines: List<String>): MrzData? {
        if (mrzLines.size < 2) return null
        
        val line1 = mrzLines[0]
        val line2 = mrzLines[1]
        
        if (line1.length < 44 || line2.length < 44) return null
        
        val docType = line1.substring(0, 2).replace("<", "")
        val country = line1.substring(2, 5).replace("<", "")
        
        val namesPart = line1.substring(5).split("<<")
        val primaryName = namesPart.getOrNull(0)?.replace("<", " ")?.trim() ?: ""
        val secondaryName = namesPart.getOrNull(1)?.replace("<", " ")?.trim() ?: ""
        
        val docNum = line2.substring(0, 9).replace("<", "")
        val docNumCheck = line2.substring(9, 10)
        
        val nationality = line2.substring(10, 13).replace("<", "")
        val dob = line2.substring(13, 19)
        val dobCheck = line2.substring(19, 20)
        
        val sex = line2.substring(20, 21)
        val expiry = line2.substring(21, 27)
        val expiryCheck = line2.substring(27, 28)
        
        val personalNum = line2.substring(28, 42).replace("<", "")
        
        val isValid = validateCheckDigit(docNum, docNumCheck) &&
                      validateCheckDigit(dob, dobCheck) &&
                      validateCheckDigit(expiry, expiryCheck)
                      
        return MrzData(
            documentType = docType,
            issuingCountry = country,
            primaryName = primaryName,
            secondaryName = secondaryName,
            documentNumber = docNum,
            nationality = nationality,
            dateOfBirth = dob,
            sex = sex,
            dateOfExpiry = expiry,
            personalNumber = personalNum,
            isValid = isValid
        )
    }
    
    private fun validateCheckDigit(data: String, checkDigit: String): Boolean {
        if (checkDigit == "<") return true // Empty check digit
        if (data.isEmpty() || checkDigit.isEmpty()) return false
        
        val weights = intArrayOf(7, 3, 1)
        var sum = 0
        for (i in data.indices) {
            val char = data[i]
            val value = when {
                char in '0'..'9' -> char - '0'
                char in 'A'..'Z' -> char - 'A' + 10
                char == '<' -> 0
                else -> return false
            }
            sum += value * weights[i % 3]
        }
        
        val expected = (sum % 10).toString()
        return expected == checkDigit
    }
}
