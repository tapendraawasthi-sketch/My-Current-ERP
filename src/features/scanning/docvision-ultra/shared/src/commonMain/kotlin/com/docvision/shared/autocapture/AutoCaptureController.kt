package com.docvision.shared.autocapture

import com.docvision.shared.camera.CameraFrame
import com.docvision.shared.detection.DetectionResult
import com.docvision.shared.detection.Quadrilateral
import com.docvision.shared.motion.DeviceMotionState
import com.docvision.shared.quality.QualityMetrics
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.hypot
import kotlin.math.max

/**
 * Configuration for the auto-capture state machine.
 */
data class AutoCaptureConfig(
    val minConfidence: Float = 0.7f,
    val minDcqi: Float = 0.80f,
    val maxAngularVelocity: Float = 0.5f,  // degrees/sec
    val maxCornerMovement: Float = 0.02f,  // fraction of diagonal
    val holdDurationMs: Long = 500L,
    val cooldownMs: Long = 1000L
)

/**
 * States of the auto-capture process.
 */
enum class AutoCaptureState { 
    SEARCHING, 
    CANDIDATE_DETECTED, 
    QUALITY_HOLD, 
    ARMED, 
    CAPTURED, 
    COOLDOWN 
}

/**
 * Command emitted when a capture is triggered.
 */
data class CaptureCommand(
    val useBestBufferedFrame: Boolean,
    val bestFrameIndex: Int? = null
)

/**
 * Circular buffer to hold recent frames and their metrics to allow retrospective capture
 * of the best frame if the user moved exactly when the shutter triggered.
 */
class CircularFrameBuffer(val capacity: Int) {
    private data class Entry(
        val frame: CameraFrame?, // Kept null for this mock to prevent memory leaks in example
        val metrics: QualityMetrics,
        val timestamp: Long
    )
    
    private val buffer = ArrayDeque<Entry>(capacity)
    
    fun add(frame: CameraFrame?, metrics: QualityMetrics) {
        if (buffer.size >= capacity) {
            buffer.removeFirst()
        }
        buffer.addLast(Entry(frame, metrics, System.currentTimeMillis()))
    }
    
    fun clear() {
        buffer.clear()
    }
    
    /**
     * Finds the index of the frame with the highest DCQI in the buffer.
     */
    fun getBestFrameIndex(): Int? {
        if (buffer.isEmpty()) return null
        var bestIdx = 0
        var bestDcqi = -1f
        
        buffer.forEachIndexed { index, entry ->
            if (entry.metrics.dcqi > bestDcqi) {
                bestDcqi = entry.metrics.dcqi
                bestIdx = index
            }
        }
        return bestIdx
    }
}

/**
 * Manages the state machine for automatic document capture.
 */
class AutoCaptureController(
    private val config: AutoCaptureConfig = AutoCaptureConfig()
) {
    private val _state = MutableStateFlow(AutoCaptureState.SEARCHING)
    val state: StateFlow<AutoCaptureState> = _state.asStateFlow()
    
    private val _captureEvent = MutableSharedFlow<CaptureCommand>(extraBufferCapacity = 1)
    val captureEvent: SharedFlow<CaptureCommand> = _captureEvent.asSharedFlow()
    
    private val frameBuffer = CircularFrameBuffer(capacity = 30)
    
    private var stateEnterTime: Long = 0
    private var lastValidCorners: Quadrilateral? = null

    /**
     * Processes a new frame with its detection, quality, and motion data to update the state machine.
     */
    suspend fun processFrame(
        detection: DetectionResult,
        quality: QualityMetrics,
        motion: DeviceMotionState
    ) {
        val now = System.currentTimeMillis()
        
        // Add to history buffer
        frameBuffer.add(null, quality) // Pass actual frame in real implementation
        
        val isDocumentFound = detection.confidence >= config.minConfidence && detection.corners != null
        val isHighQuality = quality.dcqi >= config.minDcqi
        val isStable = motion.isStable(config.maxAngularVelocity) &&
                       !isDocumentMoving(lastValidCorners, detection.corners)
                       
        if (isDocumentFound) {
            lastValidCorners = detection.corners
        }

        when (_state.value) {
            AutoCaptureState.SEARCHING -> {
                if (isDocumentFound) {
                    transitionTo(AutoCaptureState.CANDIDATE_DETECTED, now)
                }
            }
            AutoCaptureState.CANDIDATE_DETECTED -> {
                if (!isDocumentFound) {
                    transitionTo(AutoCaptureState.SEARCHING, now)
                } else if (isHighQuality && isStable) {
                    transitionTo(AutoCaptureState.QUALITY_HOLD, now)
                }
            }
            AutoCaptureState.QUALITY_HOLD -> {
                if (!isDocumentFound || !isStable) {
                    transitionTo(AutoCaptureState.SEARCHING, now)
                } else if (!isHighQuality) {
                    transitionTo(AutoCaptureState.CANDIDATE_DETECTED, now)
                } else if (now - stateEnterTime >= config.holdDurationMs) {
                    transitionTo(AutoCaptureState.ARMED, now)
                }
            }
            AutoCaptureState.ARMED -> {
                // Instantly capture once armed
                triggerCapture()
                transitionTo(AutoCaptureState.CAPTURED, now)
            }
            AutoCaptureState.CAPTURED -> {
                transitionTo(AutoCaptureState.COOLDOWN, now)
            }
            AutoCaptureState.COOLDOWN -> {
                if (now - stateEnterTime >= config.cooldownMs) {
                    frameBuffer.clear()
                    transitionTo(AutoCaptureState.SEARCHING, now)
                }
            }
        }
    }
    
    /**
     * Manually forces a capture regardless of the current state.
     */
    suspend fun manualCapture() {
        if (_state.value != AutoCaptureState.CAPTURED && _state.value != AutoCaptureState.COOLDOWN) {
            triggerCapture()
            transitionTo(AutoCaptureState.CAPTURED, System.currentTimeMillis())
        }
    }
    
    private suspend fun triggerCapture() {
        val bestIdx = frameBuffer.getBestFrameIndex()
        _captureEvent.emit(CaptureCommand(useBestBufferedFrame = bestIdx != null, bestFrameIndex = bestIdx))
    }

    private fun transitionTo(newState: AutoCaptureState, timestamp: Long) {
        if (_state.value != newState) {
            _state.value = newState
            stateEnterTime = timestamp
        }
    }

    private fun isDocumentMoving(old: Quadrilateral?, new: Quadrilateral?): Boolean {
        if (old == null || new == null) return false
        
        val d1 = hypot(old.topLeft.x - new.topLeft.x, old.topLeft.y - new.topLeft.y)
        val d2 = hypot(old.topRight.x - new.topRight.x, old.topRight.y - new.topRight.y)
        val d3 = hypot(old.bottomRight.x - new.bottomRight.x, old.bottomRight.y - new.bottomRight.y)
        val d4 = hypot(old.bottomLeft.x - new.bottomLeft.x, old.bottomLeft.y - new.bottomLeft.y)

        val maxDist = max(max(d1, d2), max(d3, d4))
        // Consider moving if max corner movement exceeds threshold (normalized coords)
        return maxDist > config.maxCornerMovement * 1.414f
    }
}
