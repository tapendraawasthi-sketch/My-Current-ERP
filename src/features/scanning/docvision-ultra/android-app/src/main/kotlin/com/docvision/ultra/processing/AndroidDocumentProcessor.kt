package com.docvision.ultra.processing

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import com.docvision.shared.detection.DetectionResult
import com.docvision.shared.processing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * Android implementation of [DocumentProcessor].
 * Delegates to [NativeEnhancementBridge] (JNI → C++ DocVisionCore).
 */
class AndroidDocumentProcessor : DocumentProcessor {
    
    override suspend fun process(
        jpegBytes: ByteArray,
        detectionResult: DetectionResult,
        config: EnhancementConfig
    ): EnhancementResult = withContext(Dispatchers.Default) {
        val (width, height) = decodeImageDimensions(jpegBytes)
        val corners = cornersToFloatArray(detectionResult)
        
        val qualityMode = when (config.quality) {
            OutputQuality.PREVIEW -> 0
            OutputQuality.STANDARD -> 1
            OutputQuality.MAXIMUM -> 2
        }

        val jniResult = NativeEnhancementBridge.runEnhancementPipeline(
            jpegBytes = jpegBytes,
            width = width,
            height = height,
            corners = corners,
            qualityMode = qualityMode
        )

        val grayscaleJpeg = toGrayscaleJpeg(jniResult.colorEnhancedJpeg)
        
        EnhancementResult(
            colorEnhancedJpeg = jniResult.colorEnhancedJpeg,
            grayscaleJpeg = grayscaleJpeg,
            binaryPng = if (config.produceBinaryOutput) jniResult.binaryPng else null,
            homographyData = jniResult.homographyData,
            aspectRatio = if (height > 0) width.toFloat() / height.toFloat() else 1f,
            textCoverage = jniResult.textCoverage,
            timings = ProcessingTimings(0L, 0L, 0L, 0L, 0L, jniResult.totalMs)
        )
    }
    
    override suspend fun quickCorrect(
        jpegBytes: ByteArray,
        detectionResult: DetectionResult
    ): ByteArray = withContext(Dispatchers.Default) {
        val (width, height) = decodeImageDimensions(jpegBytes)
        val corners = cornersToFloatArray(detectionResult)
        NativeEnhancementBridge.correctPerspectiveOnly(jpegBytes, width, height, corners)
    }
    
    override suspend fun reprocess(
        correctedJpeg: ByteArray,
        config: EnhancementConfig
    ): EnhancementResult = withContext(Dispatchers.Default) {
        val (width, height) = decodeImageDimensions(correctedJpeg)
        val corners = floatArrayOf(
            0f, 0f, 
            width.toFloat(), 0f, 
            width.toFloat(), height.toFloat(), 
            0f, height.toFloat()
        )
        
        val qualityMode = when (config.quality) {
            OutputQuality.PREVIEW -> 0
            OutputQuality.STANDARD -> 1
            OutputQuality.MAXIMUM -> 2
        }

        val jniResult = NativeEnhancementBridge.runEnhancementPipeline(
            jpegBytes = correctedJpeg,
            width = width,
            height = height,
            corners = corners,
            qualityMode = qualityMode
        )

        val grayscaleJpeg = toGrayscaleJpeg(jniResult.colorEnhancedJpeg)
        
        EnhancementResult(
            colorEnhancedJpeg = jniResult.colorEnhancedJpeg,
            grayscaleJpeg = grayscaleJpeg,
            binaryPng = if (config.produceBinaryOutput) jniResult.binaryPng else null,
            homographyData = jniResult.homographyData,
            aspectRatio = if (height > 0) width.toFloat() / height.toFloat() else 1f,
            textCoverage = jniResult.textCoverage,
            timings = ProcessingTimings(0L, 0L, 0L, 0L, 0L, jniResult.totalMs)
        )
    }
    
    private fun cornersToFloatArray(detection: DetectionResult): FloatArray {
        return floatArrayOf(
            detection.corners.topLeft.x, detection.corners.topLeft.y,
            detection.corners.topRight.x, detection.corners.topRight.y,
            detection.corners.bottomRight.x, detection.corners.bottomRight.y,
            detection.corners.bottomLeft.x, detection.corners.bottomLeft.y
        )
    }
    
    private fun decodeImageDimensions(jpegBytes: ByteArray): Pair<Int, Int> {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size, opts)
        return opts.outWidth to opts.outHeight
    }
    
    private fun toGrayscaleJpeg(jpegBytes: ByteArray): ByteArray {
        val bmp = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
        val grayBmp = Bitmap.createBitmap(bmp.width, bmp.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(grayBmp)
        val paint = Paint()
        val colorMatrix = ColorMatrix()
        colorMatrix.setSaturation(0f)
        val filter = ColorMatrixColorFilter(colorMatrix)
        paint.colorFilter = filter
        canvas.drawBitmap(bmp, 0f, 0f, paint)
        
        val out = ByteArrayOutputStream()
        grayBmp.compress(Bitmap.CompressFormat.JPEG, 90, out)
        bmp.recycle()
        grayBmp.recycle()
        return out.toByteArray()
    }
}
