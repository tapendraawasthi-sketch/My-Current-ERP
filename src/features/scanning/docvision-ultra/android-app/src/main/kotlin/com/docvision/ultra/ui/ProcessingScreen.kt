package com.docvision.ultra.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.docvision.shared.detection.DetectionResult
import com.docvision.shared.processing.DocumentProcessor
import com.docvision.shared.processing.EnhancementResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ProcessingScreen(
    jpegBytes: ByteArray,
    detectionResult: DetectionResult,
    processor: DocumentProcessor,
    onComplete: (EnhancementResult) -> Unit,
    onError: (String) -> Unit
) {
    var progress by remember { mutableFloatStateOf(0f) }
    var currentStep by remember { mutableIntStateOf(0) }
    
    val steps = listOf(
        "Correcting perspective",
        "Balancing lighting",
        "Sharpening",
        "Optimizing for text"
    )

    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 500)
    )
    
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(Unit) {
        scope.launch {
            try {
                // Progress animation while background processes
                launch {
                    for (i in 0..3) {
                        currentStep = i
                        progress = (i + 1) * 0.25f
                        delay(500)
                    }
                }
                
                val result = processor.process(jpegBytes, detectionResult)
                progress = 1.0f
                onComplete(result)
            } catch (e: Exception) {
                onError(e.message ?: "Unknown error occurred")
            }
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                progress = animatedProgress,
                modifier = Modifier.size(64.dp),
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(24.dp))
            
            steps.forEachIndexed { index, stepName ->
                val isActive = index <= currentStep
                AnimatedVisibility(visible = isActive) {
                    Text(
                        text = stepName,
                        style = MaterialTheme.typography.bodyLarge,
                        color = if (index == currentStep) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        
        Button(
            onClick = { onError("Cancelled") },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(32.dp)
        ) {
            Text("Cancel")
        }
    }
}
