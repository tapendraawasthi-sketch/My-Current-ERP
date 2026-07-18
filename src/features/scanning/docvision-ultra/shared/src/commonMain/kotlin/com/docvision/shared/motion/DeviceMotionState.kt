package com.docvision.shared.motion

import kotlinx.coroutines.flow.SharedFlow
import kotlin.math.sqrt

/**
 * A 3-dimensional vector used for sensor data (accelerometer, gyroscope).
 */
data class Vec3(val x: Float, val y: Float, val z: Float) {
    /** Calculates the magnitude (length) of the vector. */
    fun magnitude(): Float = sqrt(x * x + y * y + z * z)
    
    /** Subtracts another vector from this one. */
    operator fun minus(other: Vec3): Vec3 = Vec3(x - other.x, y - other.y, z - other.z)
    
    /** Adds another vector to this one. */
    operator fun plus(other: Vec3): Vec3 = Vec3(x + other.x, y + other.y, z + other.z)
}

/**
 * Snapshot of the device's motion state at a specific point in time.
 *
 * @property angularVelocity Angular velocity around the x, y, and z axes in radians/second.
 * @property linearAcceleration Linear acceleration along the x, y, and z axes in meters/second^2 (excluding gravity).
 * @property timestampNs Timestamp of the measurement in nanoseconds.
 */
data class DeviceMotionState(
    val angularVelocity: Vec3,       // rad/s
    val linearAcceleration: Vec3,    // m/s^2
    val timestampNs: Long
) {
    /**
     * Computes the total angular velocity in degrees per second.
     */
    fun angularVelocityDegPerSec(): Float {
        return Math.toDegrees(angularVelocity.magnitude().toDouble()).toFloat()
    }
    
    /**
     * Determines if the device is held stably enough for a clear capture.
     * @param maxDegPerSec Maximum allowed angular velocity in degrees/second.
     * @return True if stable, false otherwise.
     */
    fun isStable(maxDegPerSec: Float = 0.5f): Boolean {
        return angularVelocityDegPerSec() < maxDegPerSec
    }
}

/**
 * Provides continuous motion sensor updates.
 * Implemented natively for Android (SensorManager) and iOS (CoreMotion).
 */
interface MotionSensorProvider {
    /** Hot flow emitting the latest device motion state. */
    val motionState: SharedFlow<DeviceMotionState>
    
    /** Starts listening to hardware sensors. */
    fun start()
    
    /** Stops listening to hardware sensors to save battery. */
    fun stop()
}
