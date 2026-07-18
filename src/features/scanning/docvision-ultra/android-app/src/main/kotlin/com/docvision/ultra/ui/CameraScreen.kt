package com.docvision.ultra.ui

import android.graphics.PointF
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.docvision.ultra.camera.AndroidCameraController
import com.docvision.ultra.camera.CaptureResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun CameraScreen(
    cameraController: AndroidCameraController,
    onCapture: (captureResult: CaptureResult) -> Unit
) {
    val context = LocalContext.current
    val view = LocalView.current
    val coroutineScope = rememberCoroutineScope()
    
    var dcqi by remember { mutableStateOf(0.0f) }
    var documentCorners by remember { mutableStateOf<List<PointF>>(emptyList()) }
    var isCapturing by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        cameraController.startPreview()
        
        // Mocking the detector output loop
        launch {
            while(true) {
                delay(100)
                // In real app, listen to previewFrames, pass to detector, update state
                // dcqi = detector.detect(frame).dcqi
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).apply {
                    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    val provider = cameraController.getPreviewSurfaceProvider()
                    if (provider != null) {
                        this.surfaceProvider = provider
                    }
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        OverlayCanvas(
            corners = documentCorners,
            dcqi = dcqi,
            modifier = Modifier.fillMaxSize()
        )

        GuidanceText(
            dcqi = dcqi,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 140.dp)
        )

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp)
                .size(96.dp), // Space for ring
            contentAlignment = Alignment.Center
        ) {
            QualityRingView(dcqi = dcqi, modifier = Modifier.fillMaxSize())
            
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .clickable(enabled = !isCapturing) {
                        isCapturing = true
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                        coroutineScope.launch {
                            try {
                                val result = cameraController.capturePhoto()
                                view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                                onCapture(result)
                            } catch (e: Exception) {
                                isCapturing = false
                            }
                        }
                    }
            )
        }
    }
}

@Composable
fun GuidanceText(dcqi: Float, modifier: Modifier = Modifier) {
    val text = when {
        dcqi < 0.5f -> "Move closer and align document"
        dcqi < 0.8f -> "Hold still..."
        else -> "Ready to capture!"
    }
    
    val color = when {
        dcqi < 0.5f -> Color.White
        dcqi < 0.8f -> Color.Yellow
        else -> Color.Green
    }

    Text(
        text = text,
        color = color,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.5f), shape = CircleShape)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    )
}
