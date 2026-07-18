package com.docvision.ultra.ui

import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.docvision.shared.processing.EnhancementResult

@Composable
fun EnhancedDocumentScreen(
    result: EnhancementResult,
    onSaveAsPdf: () -> Unit,
    onSaveAsImage: () -> Unit,
    onAddPage: () -> Unit,
    onRetake: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    
    val state = rememberTransformableState { zoomChange, offsetChange, _ ->
        scale = (scale * zoomChange).coerceIn(1f, 5f)
        offset += offsetChange
    }

    Scaffold(
        topBar = {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                    Text("Color", modifier = Modifier.padding(16.dp))
                }
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                    Text("Grayscale", modifier = Modifier.padding(16.dp))
                }
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }) {
                    Text("Binary (OCR)", modifier = Modifier.padding(16.dp))
                }
            }
        },
        bottomBar = {
            BottomAppBar {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    TextButton(onClick = onRetake) { Text("Retake") }
                    TextButton(onClick = onAddPage) { Text("Add Page") }
                    TextButton(onClick = onSaveAsImage) { Text("Save Image") }
                    Button(onClick = onSaveAsPdf) { Text("Save PDF") }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .transformable(state = state)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer(
                        scaleX = scale,
                        scaleY = scale,
                        translationX = offset.x,
                        translationY = offset.y
                    )
            ) {
                Text(
                    text = "Image Placeholder for Tab $selectedTab",
                    modifier = Modifier.align(Alignment.Center)
                )
            }
            
            // Quality Badge
            Surface(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp),
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Text(
                    text = "Text Cov: ${(result.textCoverage * 100).toInt()}%",
                    modifier = Modifier.padding(8.dp),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}
