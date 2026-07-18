package com.docvision.shared.quality

/**
 * Defines the type of blur detected in the image.
 */
enum class BlurType {
    SHARP, DEFOCUS_BLUR, MOTION_BLUR
}

/**
 * Guidance messages to display to the user based on quality metrics.
 * 
 * @property text The localized or standard text to display.
 * @property priority Higher number means higher priority.
 */
enum class GuidanceMessage(
    val text: String,
    val priority: Int
) {
    HOLD_STEADY("Hold the phone steadier", 5),
    MOTION_BLUR("Hold still — motion detected", 5),
    DEFOCUS_BLUR("Tap to refocus", 5),
    UNEVEN_LIGHTING("Find more even lighting", 4),
    GLARE("Tilt slightly to reduce glare", 4),
    SHADOW("Move to reduce shadows", 3),
    INCOMPLETE("Move back — document is cut off", 6),
    FINGER("Move your fingers from the edges", 6),
    CAPTURING("Hold steady — capturing...", 1),
    NONE("", 0)
}

/**
 * Quality metrics computed for a captured frame or photo.
 */
data class QualityMetrics(
    val sharpnessScore: Float,       // 0.0 - 1.0
    val blurType: BlurType,
    val blurSeverity: Float,         // 0.0 - 1.0
    val illuminationUniformity: Float, // 0.0 - 1.0
    val glareScore: Float,           // 0.0 - 1.0
    val shadowScore: Float,          // 0.0 - 1.0
    val completenessScore: Float,    // 0.0 - 1.0
    val occlusionScore: Float,       // 0.0 - 1.0
    val dcqi: Float,                  // Composite: 0.0 - 1.0
    val glareMask: ByteArray?,        // Optional mask for UI overlay
    val processingTimeMs: Long
) {
    companion object {
        // Document Capture Quality Index (DCQI) weights as per spec
        const val W_SHARPNESS = 0.25f
        const val W_BLUR = 0.10f
        const val W_ILLUMINATION = 0.15f
        const val W_GLARE = 0.20f
        const val W_SHADOW = 0.10f
        const val W_COMPLETENESS = 0.10f
        const val W_OCCLUSION = 0.10f

        /**
         * Computes the final DCQI composite score using the weighted average of individual metrics.
         */
        fun computeDcqi(
            sharpness: Float,
            blur: Float,
            illumination: Float,
            glare: Float,
            shadow: Float,
            completeness: Float,
            occlusion: Float
        ): Float {
            // Inverting negative metrics so 1.0 is always "perfect"
            val blurScore = 1.0f - blur
            val invertedGlare = 1.0f - glare
            val invertedShadow = 1.0f - shadow
            val invertedOcclusion = 1.0f - occlusion

            return (sharpness * W_SHARPNESS) +
                   (blurScore * W_BLUR) +
                   (illumination * W_ILLUMINATION) +
                   (invertedGlare * W_GLARE) +
                   (invertedShadow * W_SHADOW) +
                   (completeness * W_COMPLETENESS) +
                   (invertedOcclusion * W_OCCLUSION)
        }
    }

    /**
     * Determines the highest priority guidance message to show the user based on the current metrics.
     * @return The most relevant GuidanceMessage.
     */
    fun getPrimaryGuidanceMessage(): GuidanceMessage {
        var highestPriorityMsg = GuidanceMessage.NONE
        var highestPriority = -1

        fun checkAndSet(condition: Boolean, msg: GuidanceMessage) {
            if (condition && msg.priority > highestPriority) {
                highestPriorityMsg = msg
                highestPriority = msg.priority
            }
        }

        checkAndSet(completenessScore < 0.8f, GuidanceMessage.INCOMPLETE)
        checkAndSet(occlusionScore > 0.2f, GuidanceMessage.FINGER)
        
        checkAndSet(blurType == BlurType.MOTION_BLUR && blurSeverity > 0.4f, GuidanceMessage.MOTION_BLUR)
        checkAndSet(blurType == BlurType.DEFOCUS_BLUR && blurSeverity > 0.4f, GuidanceMessage.DEFOCUS_BLUR)
        checkAndSet(sharpnessScore < 0.6f, GuidanceMessage.HOLD_STEADY)

        checkAndSet(glareScore > 0.3f, GuidanceMessage.GLARE)
        checkAndSet(shadowScore > 0.4f, GuidanceMessage.SHADOW)
        checkAndSet(illuminationUniformity < 0.6f, GuidanceMessage.UNEVEN_LIGHTING)

        return highestPriorityMsg
    }
}
