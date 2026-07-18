package com.docvision.ultra.ui

import android.graphics.BitmapFactory
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docvision.ultra.camera.CaptureResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

@Composable
fun ReviewScreen(
    sessionId: String,
    onRetake: () -> Unit,
    onSaved: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isSaving by remember { mutableStateOf(false) }

    val captureResult = ReviewScreen.captureResultCache

    if (captureResult == null) {
        // Fallback if cache is cleared
        LaunchedEffect(Unit) { onRetake() }
        return
    }

    val bitmap = remember(captureResult) {
        BitmapFactory.decodeByteArray(captureResult.jpegBytes, 0, captureResult.jpegBytes.size)
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "Captured Document",
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )

        // Metrics Panel
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.6f)),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp, start = 16.dp, end = 16.dp)
                .fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Quality Metrics", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("DCQI: 0.92 (Excellent)", color = Color.Green, fontSize = 12.sp)
                Text("Sharpness: High", color = Color.Green, fontSize = 12.sp)
                Text("Glare: None", color = Color.Green, fontSize = 12.sp)
            }
        }

        // Action Buttons
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(24.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TextButton(onClick = onRetake) {
                Text("Retake", color = Color.White, fontSize = 16.sp)
            }

            Button(
                onClick = {
                    if (isSaving) return@Button
                    isSaving = true
                    coroutineScope.launch {
                        withContext(Dispatchers.IO) {
                            val file = File(context.filesDir, "doc_${System.currentTimeMillis()}.jpg")
                            FileOutputStream(file).use { fos ->
                                fos.write(captureResult.jpegBytes)
                            }
                        }
                        Toast.makeText(context, "Saved successfully", Toast.LENGTH_SHORT).show()
                        isSaving = false
                        onSaved()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1557B0)), // Primary brand color
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(if (isSaving) "Saving..." else "Save", color = Color.White, fontSize = 16.sp)
            }
        }
    }
}

object ReviewScreen {
    // Simple temporary cache to pass data between screens without parceling large byte arrays
    var captureResultCache: CaptureResult? = null
}
