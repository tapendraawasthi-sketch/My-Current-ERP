package com.docvision.ultra.processing

/**
 * Kotlin wrapper around the JNI bridge to the C++ DocVisionCore enhancement pipeline.
 * All JNI calls are blocking — call from a background dispatcher.
 */
object NativeEnhancementBridge {
    init {
        System.loadLibrary("docvisioncore")
    }
    
    /** Run the full enhancement pipeline. Returns EnhancementResultJni. */
    external fun runEnhancementPipeline(
        jpegBytes: ByteArray,
        width: Int,
        height: Int,
        corners: FloatArray,
        qualityMode: Int
    ): EnhancementResultJni
    
    /** Perspective correction only. Returns JPEG bytes. */
    external fun correctPerspectiveOnly(
        jpegBytes: ByteArray,
        width: Int,
        height: Int,
        corners: FloatArray
    ): ByteArray
    
    /** Binarize only. Returns PNG bytes. */
    external fun binarizeOnly(
        grayscaleBytes: ByteArray,
        width: Int,
        height: Int,
        method: Int
    ): ByteArray
}

/** JNI result object (mirrors Java-accessible EnhancementResultJni class). */
data class EnhancementResultJni(
    val colorEnhancedJpeg: ByteArray,
    val binaryPng: ByteArray,
    val homographyData: FloatArray,
    val totalMs: Long,
    val textCoverage: Float
)
