package com.docvision.shared.accessibility

/**
 * Interface representing the Text-To-Speech engine.
 */
interface TTSEngine {
    fun speak(text: String)
    fun stop()
}

/**
 * Interface for playing spatial audio cues.
 */
interface SpatialAudioEngine {
    /**
     * Plays an audio cue with spatial properties.
     * @param soundId The identifier for the sound cue.
     * @param pan The panning value from -1.0 (full left) to 1.0 (full right).
     * @param pitch The pitch value, 1.0 is normal.
     */
    fun playCue(soundId: String, pan: Float, pitch: Float)
}

/**
 * Data class representing a bounding box on the screen.
 * Coordinates are expected to be normalized between 0.0 and 1.0.
 */
data class BoundingBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float
) {
    val centerX: Float get() = (left + right) / 2.0f
    val centerY: Float get() = (top + bottom) / 2.0f
}

/**
 * Protocol/interface for handling voice commands.
 */
interface VoiceCommandListener {
    fun onCommandCapture()
    fun onCommandRead()
    fun onCommandUnknown(command: String)
}

/**
 * AudioGuide provides accessibility features including TTS announcements,
 * spatial audio cues for document positioning, and voice command handling.
 */
class AudioGuide(
    private val ttsEngine: TTSEngine,
    private val spatialAudioEngine: SpatialAudioEngine
) {
    private var voiceCommandListener: VoiceCommandListener? = null

    /**
     * Sets the listener for voice commands.
     */
    fun setVoiceCommandListener(listener: VoiceCommandListener) {
        this.voiceCommandListener = listener
    }

    /**
     * Speaks an arbitrary announcement.
     */
    fun announce(message: String) {
        ttsEngine.speak(message)
    }
    
    /**
     * Convenience method to announce when a document is detected.
     */
    fun announceDocumentDetected() {
        announce("Document detected")
    }
    
    /**
     * Convenience method to announce when a photo has been captured.
     */
    fun announcePhotoCaptured() {
        announce("Photo captured")
    }

    /**
     * Computes panning and pitch based on the document's bounding box relative to the screen.
     * centerX < 0.5 pans left, centerX > 0.5 pans right.
     * centerY < 0.5 increases pitch (higher up), centerY > 0.5 decreases pitch (lower down).
     * 
     * @param box Normalized bounding box of the document.
     */
    fun playSpatialCueForDocument(box: BoundingBox) {
        // Calculate panning: -1.0 to 1.0 based on centerX (0.0 to 1.0)
        // centerX = 0.5 means pan = 0.0
        val pan = (box.centerX - 0.5f) * 2.0f
        
        // Calculate pitch: 0.5 to 1.5 based on centerY
        // centerY = 0.5 means pitch = 1.0
        // centerY = 0.0 (top) means pitch = 1.5
        // centerY = 1.0 (bottom) means pitch = 0.5
        val pitch = 1.5f - box.centerY
        
        // Keep pitch within a reasonable range (0.5 to 1.5)
        val clampedPitch = pitch.coerceIn(0.5f, 1.5f)
        val clampedPan = pan.coerceIn(-1.0f, 1.0f)
        
        spatialAudioEngine.playCue("document_blip", clampedPan, clampedPitch)
    }

    /**
     * Processes a transcribed voice command.
     */
    fun processVoiceCommand(transcript: String) {
        val normalized = transcript.trim().lowercase()
        when {
            normalized.contains("capture") || normalized.contains("take photo") -> {
                voiceCommandListener?.onCommandCapture()
            }
            normalized.contains("read") || normalized.contains("read document") -> {
                voiceCommandListener?.onCommandRead()
            }
            else -> {
                voiceCommandListener?.onCommandUnknown(transcript)
            }
        }
    }
}
