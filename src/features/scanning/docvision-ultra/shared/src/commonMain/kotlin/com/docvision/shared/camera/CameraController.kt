package com.docvision.shared.camera

import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Pixel formats supported by the camera hardware.
 */
enum class PixelFormat {
    YUV_420_888, RGB_888, BGRA_8888
}

/**
 * Hardware level capabilities of the camera.
 */
enum class CameraHardwareLevel {
    LEGACY, LIMITED, FULL, LEVEL_3
}

/**
 * State of the camera hardware and capture pipeline.
 */
enum class CameraState {
    UNINITIALIZED, INITIALIZING, READY, CAPTURING, ERROR
}

/**
 * Represents a single frame captured by the camera during preview.
 *
 * @property pixels Raw pixel data of the frame.
 * @property width Width of the frame in pixels.
 * @property height Height of the frame in pixels.
 * @property format Format of the pixel data.
 * @property timestampNs Timestamp of the frame in nanoseconds.
 */
class CameraFrame(
    val pixels: ByteArray,
    val width: Int,
    val height: Int,
    val format: PixelFormat,
    val timestampNs: Long
)

/**
 * Results of a photo capture operation.
 *
 * @property jpegBytes Processed JPEG representation of the capture, if requested.
 * @property rawDngBytes Raw DNG representation of the capture, if requested and supported.
 * @property depthMapBytes Depth map associated with the capture, if requested and supported.
 * @property exposureTimeNs Exposure time used for the capture in nanoseconds.
 * @property iso ISO sensitivity used for the capture.
 * @property focusDistance Focus distance used for the capture in diopters.
 * @property timestampNs Timestamp of the capture in nanoseconds.
 */
class CaptureResult(
    val jpegBytes: ByteArray?,
    val rawDngBytes: ByteArray?,
    val depthMapBytes: ByteArray?,
    val exposureTimeNs: Long,
    val iso: Int,
    val focusDistance: Float,
    val timestampNs: Long
)

/**
 * Platform-agnostic camera controller interface.
 * Implemented natively on Android (CameraX + Camera2) and iOS (AVFoundation).
 */
interface CameraController {
    /** Flow of continuous preview frames from the camera. */
    val previewFrames: SharedFlow<CameraFrame>
    
    /** Flow of final capture results. */
    val captureResults: SharedFlow<CaptureResult>
    
    /** Current state of the camera. */
    val cameraState: StateFlow<CameraState>
    
    /**
     * Initializes the camera hardware and prepares it for use.
     */
    suspend fun initialize()
    
    /**
     * Starts providing preview frames to the [previewFrames] flow.
     */
    suspend fun startPreview()
    
    /**
     * Stops providing preview frames.
     */
    suspend fun stopPreview()
    
    /**
     * Initiates a high-quality photo capture.
     * @return The result of the capture.
     */
    suspend fun capturePhoto(): CaptureResult
    
    /**
     * Sets the exposure compensation value.
     */
    fun setExposureCompensation(ev: Float)
    
    /**
     * Sets the ISO sensitivity.
     */
    fun setISO(iso: Int)
    
    /**
     * Sets the manual focus distance.
     * @param diopters Focus distance in diopters (1 / distance in meters).
     */
    fun setFocusDistance(diopters: Float)
    
    /**
     * Sets the white balance color temperature.
     */
    fun setWhiteBalance(temperature: Int)
    
    /** Locks auto-exposure. */
    fun lockAE()
    
    /** Locks auto-focus. */
    fun lockAF()
    
    /** Locks auto-white-balance. */
    fun lockAWB()
    
    /**
     * Triggers a one-shot auto-focus operation at the specified coordinates.
     * @param x X coordinate (0.0 to 1.0) relative to the frame.
     * @param y Y coordinate (0.0 to 1.0) relative to the frame.
     */
    fun triggerAF(x: Float, y: Float)
    
    /**
     * Retrieves the hardware level of the currently active camera.
     */
    fun getHardwareLevel(): CameraHardwareLevel
    
    /**
     * Releases camera resources.
     */
    fun release()
}
