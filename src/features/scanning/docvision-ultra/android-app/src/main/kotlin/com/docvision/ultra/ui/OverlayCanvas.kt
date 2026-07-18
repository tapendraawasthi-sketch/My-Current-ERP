package com.docvision.ultra.ui

import android.graphics.PointF
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

@Composable
fun OverlayCanvas(
    corners: List<PointF>,
    dcqi: Float,
    modifier: Modifier = Modifier,
    showGlareMask: Boolean = false
) {
    val color = when {
        dcqi >= 0.8f -> Color.Green
        dcqi >= 0.5f -> Color.Yellow
        else -> Color.Red
    }

    // Animation states for the 4 corners
    val animatedCorners = corners.map { pt ->
        val x by animateFloatAsState(
            targetValue = pt.x,
            animationSpec = spring(stiffness = Spring.StiffnessMedium)
        )
        val y by animateFloatAsState(
            targetValue = pt.y,
            animationSpec = spring(stiffness = Spring.StiffnessMedium)
        )
        Offset(x, y)
    }

    Canvas(modifier = modifier) {
        if (animatedCorners.size == 4) {
            val path = Path().apply {
                moveTo(animatedCorners[0].x, animatedCorners[0].y)
                lineTo(animatedCorners[1].x, animatedCorners[1].y)
                lineTo(animatedCorners[2].x, animatedCorners[2].y)
                lineTo(animatedCorners[3].x, animatedCorners[3].y)
                close()
            }

            // Fill
            drawPath(
                path = path,
                color = color.copy(alpha = 0.1f),
                style = Fill
            )

            // Border
            drawPath(
                path = path,
                color = color,
                style = Stroke(width = 2.dp.toPx())
            )

            // Corner circles
            animatedCorners.forEach { offset ->
                drawCircle(
                    color = color,
                    radius = 4.dp.toPx(),
                    center = offset,
                    style = Fill
                )
            }
        }

        if (showGlareMask) {
            // Optional glare mask implementation
            drawRect(
                color = Color.Red.copy(alpha = 0.3f),
                size = size
            )
        }
    }
}
