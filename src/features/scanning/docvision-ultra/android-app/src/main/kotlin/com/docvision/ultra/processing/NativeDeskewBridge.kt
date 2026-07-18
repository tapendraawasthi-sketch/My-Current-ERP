package com.docvision.ultra.processing

/**
 * Kotlin JNI wrapper for deskew operations via DocVisionCore.
 */
object NativeDeskewBridge {
    init { System.loadLibrary("docvisioncore") }
    
    external fun detectSkewAngle(pixels: ByteArray, width: Int, height: Int): FloatArray // [angle, confidence]
    external fun deskewImage(pixels: ByteArray, width: Int, height: Int, angleDegrees: Float): ByteArray
    external fun detectPageOrientation(pixels: ByteArray, width: Int, height: Int): Int // 0, 90, 180, 270
}
