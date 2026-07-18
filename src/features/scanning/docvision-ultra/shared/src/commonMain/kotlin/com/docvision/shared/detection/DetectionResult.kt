package com.docvision.shared.detection

import kotlin.math.abs

/**
 * A 2D point represented by x and y coordinates.
 */
data class Point2D(val x: Float, val y: Float)

/**
 * A quadrilateral shape defined by its four corners.
 */
data class Quadrilateral(
    val topLeft: Point2D,
    val topRight: Point2D,
    val bottomRight: Point2D,
    val bottomLeft: Point2D
) {
    /**
     * Calculates the area of the quadrilateral using the Shoelace formula.
     * @return The area.
     */
    fun area(): Float {
        val pts = toList()
        var sum = 0f
        for (i in pts.indices) {
            val p1 = pts[i]
            val p2 = pts[(i + 1) % pts.size]
            sum += (p1.x * p2.y) - (p2.x * p1.y)
        }
        return abs(sum) / 2f
    }

    /**
     * Checks if the quadrilateral is valid based on its area.
     * A real implementation might also check winding order or convex shape.
     * @return True if valid, false otherwise.
     */
    fun isValid(): Boolean {
        // A simple check: area must be strictly positive
        return area() > 0.001f
    }

    /**
     * Converts the corners into a list of points in clockwise order.
     * @return List of 4 corner points.
     */
    fun toList(): List<Point2D> = listOf(topLeft, topRight, bottomRight, bottomLeft)
}

/**
 * Method used to detect the document in the frame.
 */
enum class DetectionMethod { 
    CORNER_REGRESSION, 
    SEGMENTATION_FALLBACK, 
    NONE 
}

/**
 * Result of a document detection operation.
 *
 * @property corners The detected corners of the document, or null if not found.
 * @property confidence Confidence score of the detection from 0.0 to 1.0.
 * @property detectionMethod The method used for this detection.
 * @property processingTimeMs Time taken to process the detection in milliseconds.
 */
data class DetectionResult(
    val corners: Quadrilateral?,
    val confidence: Float,
    val detectionMethod: DetectionMethod,
    val processingTimeMs: Long
)
