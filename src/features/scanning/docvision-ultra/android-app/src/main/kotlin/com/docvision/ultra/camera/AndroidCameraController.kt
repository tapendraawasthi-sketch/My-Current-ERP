package com.docvision.ultra.camera

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.DngCreator
import android.media.Image
import android.util.Size
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.nio.ByteBuffer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

data class CameraFrame(val imageProxy: ImageProxy, val timestamp: Long)
data class CaptureResult(val jpegBytes: ByteArray, val rawDngBytes: ByteArray? = null)
data class DeviceMotionState(val accelX: Float, val accelY: Float, val accelZ: Float, val gyroX: Float, val gyroY: Float, val gyroZ: Float)

interface CameraController {
    val previewFrames: SharedFlow<CameraFrame>
    suspend fun initialize()
    fun startPreview()
    fun stopPreview()
    suspend fun capturePhoto(): CaptureResult
    fun setExposureCompensation(ev: Int)
    fun setISO(iso: Int)
    fun setFocusDistance(diopters: Float)
    fun setWhiteBalance(temperature: Int)
    fun lockAE()
    fun lockAF()
    fun lockAWB()
    fun triggerAF(x: Float, y: Float)
    fun getHardwareLevel(): Int
    fun release()
}

@SuppressLint("UnsafeOptInUsageError")
class AndroidCameraController(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner
) : CameraController, SensorEventListener {

    private lateinit var cameraProvider: ProcessCameraProvider
    private lateinit var camera: Camera
    private lateinit var imageCapture: ImageCapture
    private lateinit var imageAnalysis: ImageAnalysis
    private lateinit var preview: Preview

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private val _previewFrames = MutableSharedFlow<CameraFrame>(
        replay = 0, extraBufferCapacity = 2, onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val previewFrames: SharedFlow<CameraFrame> = _previewFrames.asSharedFlow()

    private val _motionStates = MutableSharedFlow<DeviceMotionState>(
        replay = 1, extraBufferCapacity = 10, onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val motionStates: SharedFlow<DeviceMotionState> = _motionStates.asSharedFlow()

    private var sensorManager: SensorManager? = null
    private var accelValues = FloatArray(3)
    private var gyroValues = FloatArray(3)

    private var isPreviewStarted = false

    override suspend fun initialize(): Unit = suspendCoroutine { continuation ->
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                setupSensors()
                continuation.resume(Unit)
            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun setupSensors() {
        sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val accel = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val gyro = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        sensorManager?.registerListener(this, accel, 5000) // 200Hz = 5000us
        sensorManager?.registerListener(this, gyro, 5000)
    }

    override fun startPreview() {
        if (isPreviewStarted) return
        
        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        preview = Preview.Builder().build()
        
        imageAnalysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(640, 480))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
            .build()
            
        imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
            _previewFrames.tryEmit(CameraFrame(imageProxy, imageProxy.imageInfo.timestamp))
            // Do not close imageProxy here if you are passing it to flow consumers.
            // Consumers must close it. Or if only one consumer, do it there.
        }

        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .build()

        try {
            cameraProvider.unbindAll()
            camera = cameraProvider.bindToLifecycle(
                lifecycleOwner, cameraSelector, preview, imageAnalysis, imageCapture
            )
            isPreviewStarted = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun stopPreview() {
        if (::cameraProvider.isInitialized) {
            cameraProvider.unbindAll()
            isPreviewStarted = false
        }
    }

    override suspend fun capturePhoto(): CaptureResult = suspendCoroutine { continuation ->
        imageCapture.takePicture(
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    val buffer: ByteBuffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.capacity())
                    buffer.get(bytes)
                    image.close()
                    // DNG generation omitted for simplicity, but setup ready
                    continuation.resume(CaptureResult(jpegBytes = bytes))
                }

                override fun onError(exception: ImageCaptureException) {
                    continuation.resumeWithException(exception)
                }
            }
        )
    }

    override fun setExposureCompensation(ev: Int) {
        if (::camera.isInitialized) {
            camera.cameraControl.setExposureCompensationIndex(ev)
        }
    }

    override fun setISO(iso: Int) {
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
            setCaptureRequestOption(CaptureRequest.SENSOR_SENSITIVITY, iso)
        }
    }

    override fun setFocusDistance(diopters: Float) {
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
            setCaptureRequestOption(CaptureRequest.LENS_FOCUS_DISTANCE, diopters)
        }
    }

    override fun setWhiteBalance(temperature: Int) {
        // Simplified mapping for WB temp to ColorCorrectionGains
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_OFF)
            // Need actual R,G,B gains mapping here for full implementation
        }
    }

    override fun lockAE() {
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AE_LOCK, true)
        }
    }

    override fun lockAF() {
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO)
        }
    }

    override fun lockAWB() {
        applyCamera2Interop {
            setCaptureRequestOption(CaptureRequest.CONTROL_AWB_LOCK, true)
        }
    }

    override fun triggerAF(x: Float, y: Float) {
        if (::camera.isInitialized) {
            val factory = SurfaceOrientedMeteringPointFactory(1f, 1f)
            val point = factory.createPoint(x, y)
            val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF).build()
            camera.cameraControl.startFocusAndMetering(action)
        }
    }

    override fun getHardwareLevel(): Int {
        if (::camera.isInitialized) {
            val info = Camera2CameraInfo.from(camera.cameraInfo)
            return info.getCameraCharacteristic(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL) ?: -1
        }
        return -1
    }

    override fun release() {
        stopPreview()
        cameraExecutor.shutdown()
        sensorManager?.unregisterListener(this)
    }

    private fun applyCamera2Interop(block: CaptureRequestOptions.Builder.() -> Unit) {
        if (::camera.isInitialized) {
            val builder = CaptureRequestOptions.Builder()
            builder.block()
            Camera2CameraControl.from(camera.cameraControl).addCaptureRequestOptions(builder.build())
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event ?: return
        if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
            accelValues = event.values.clone()
        } else if (event.sensor.type == Sensor.TYPE_GYROSCOPE) {
            gyroValues = event.values.clone()
        }
        _motionStates.tryEmit(
            DeviceMotionState(
                accelValues[0], accelValues[1], accelValues[2],
                gyroValues[0], gyroValues[1], gyroValues[2]
            )
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    
    fun getPreviewSurfaceProvider(): Preview.SurfaceProvider? {
        return if (::preview.isInitialized) preview.surfaceProvider else null
    }
}
