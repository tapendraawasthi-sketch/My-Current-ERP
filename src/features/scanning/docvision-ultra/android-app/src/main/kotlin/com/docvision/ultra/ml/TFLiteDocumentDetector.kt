package com.docvision.ultra.ml

import android.content.Context
import android.graphics.PointF
import com.docvision.ultra.camera.CameraFrame
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.nnapi.NnApiDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

data class DetectionResult(
    val corners: List<PointF>,
    val confidence: Float,
    val dcqi: Float
)

interface DocumentDetector {
    suspend fun initialize(modelPath: String)
    fun detect(frame: CameraFrame): DetectionResult
}

class TemporalSmoother(private val alpha: Float = 0.2f) {
    private var prevCorners: List<PointF>? = null

    fun smooth(newCorners: List<PointF>): List<PointF> {
        val prev = prevCorners
        if (prev == null || prev.size != newCorners.size) {
            prevCorners = newCorners
            return newCorners
        }

        val smoothed = newCorners.zip(prev) { n, p ->
            PointF(
                p.x + alpha * (n.x - p.x),
                p.y + alpha * (n.y - p.y)
            )
        }
        prevCorners = smoothed
        return smoothed
    }
}

class TFLiteDocumentDetector(private val context: Context) : DocumentDetector {
    private var interpreter: Interpreter? = null
    private val smoother = TemporalSmoother(alpha = 0.3f)
    private val yuvConverter = YuvToRgbConverter(context)

    override suspend fun initialize(modelPath: String) {
        val delegate = NnApiDelegate()
        val options = Interpreter.Options().apply {
            addDelegate(delegate)
            setNumThreads(2)
        }
        
        val assetFileDescriptor = context.assets.openFd(modelPath)
        val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
        val fileChannel = fileInputStream.channel
        val startOffset = assetFileDescriptor.startOffset
        val declaredLength = assetFileDescriptor.declaredLength
        val mappedByteBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
        
        interpreter = Interpreter(mappedByteBuffer, options)
    }

    override fun detect(frame: CameraFrame): DetectionResult {
        if (interpreter == null) {
            frame.imageProxy.close()
            return DetectionResult(emptyList(), 0f, 0f)
        }

        val width = 256
        val height = 256
        val rgbBuffer = ByteBuffer.allocateDirect(width * height * 3 * 4)
        rgbBuffer.order(ByteOrder.nativeOrder())

        // 1. Convert YUV to RGB and resize to 256x256
        yuvConverter.yuvToRgbFloat(frame.imageProxy, rgbBuffer, width, height)
        
        // Output array: 8 floats for 4 (x,y) corners, 1 float for confidence
        val outputBuffer = Array(1) { FloatArray(9) }

        // 2. Inference
        interpreter?.run(rgbBuffer, outputBuffer)
        
        val outputs = outputBuffer[0]
        val rawCorners = listOf(
            PointF(outputs[0], outputs[1]),
            PointF(outputs[2], outputs[3]),
            PointF(outputs[4], outputs[5]),
            PointF(outputs[6], outputs[7])
        )
        val confidence = outputs[8]
        
        // 3. Scale back to frame coordinates
        val frameWidth = frame.imageProxy.width.toFloat()
        val frameHeight = frame.imageProxy.height.toFloat()
        val scaledCorners = rawCorners.map {
            PointF(it.x * frameWidth, it.y * frameHeight)
        }

        // 4. Smoothing
        val finalCorners = smoother.smooth(scaledCorners)
        
        frame.imageProxy.close()

        // Mock DCQI calculation based on confidence and corner stability
        val dcqi = confidence.coerceIn(0f, 1f)

        return DetectionResult(finalCorners, confidence, dcqi)
    }
}

// Simple placeholder for YUV to RGB Converter
class YuvToRgbConverter(private val context: Context) {
    fun yuvToRgbFloat(image: androidx.camera.core.ImageProxy, outputBuffer: ByteBuffer, targetWidth: Int, targetHeight: Int) {
        // Implementation for YUV -> RGB -> Float32 scaling would go here via Renderscript or intrinsic
        // This is a stub for the required structure
        outputBuffer.rewind()
        for (i in 0 until targetWidth * targetHeight * 3) {
            outputBuffer.putFloat(0.5f) // Dummy data
        }
    }
}
