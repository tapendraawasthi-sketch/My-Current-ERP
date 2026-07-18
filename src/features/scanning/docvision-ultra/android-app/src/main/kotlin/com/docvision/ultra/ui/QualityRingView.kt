package com.docvision.ultra.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

@Composable
fun QualityRingView(
    dcqi: Float,
    modifier: Modifier = Modifier
) {
    val animatedDcqi by animateFloatAsState(
        targetValue = dcqi.coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 200, easing = LinearEasing)
    )

    val sweepAngle = animatedDcqi * 360f

    val color = when {
        animatedDcqi >= 0.8f -> Color.Green
        animatedDcqi >= 0.5f -> Color.Yellow
        else -> Color.Red
    }

    Canvas(modifier = modifier) {
        val strokeWidth = 6.dp.toPx()
        val sizeVal = size.minDimension - strokeWidth
        
        // Background track
        drawArc(
            color = Color.White.copy(alpha = 0.2f),
            startAngle = 0f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = Offset(strokeWidth / 2, strokeWidth / 2),
            size = Size(sizeVal, sizeVal),
            style = Stroke(width = strokeWidth)
        )

        // Quality arc
        if (sweepAngle > 0) {
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = sweepAngle,
                useCenter = false,
                topLeft = Offset(strokeWidth / 2, strokeWidth / 2),
                size = Size(sizeVal, sizeVal),
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
            )
        }
    }
}
