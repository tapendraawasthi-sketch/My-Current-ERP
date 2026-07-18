package com.docvision.ultra

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.docvision.ultra.camera.AndroidCameraController
import com.docvision.ultra.ui.CameraScreen
import com.docvision.ultra.ui.ReviewScreen
import java.util.UUID

class MainActivity : ComponentActivity() {

    private lateinit var cameraController: AndroidCameraController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        cameraController = AndroidCameraController(this, this)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    var hasCameraPermission by remember {
                        mutableStateOf(
                            ContextCompat.checkSelfPermission(
                                this,
                                Manifest.permission.CAMERA
                            ) == PackageManager.PERMISSION_GRANTED
                        )
                    }

                    val permissionLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.RequestPermission()
                    ) { isGranted ->
                        hasCameraPermission = isGranted
                        if (!isGranted) {
                            Toast.makeText(this, "Camera permission is required", Toast.LENGTH_LONG).show()
                        }
                    }

                    LaunchedEffect(Unit) {
                        if (!hasCameraPermission) {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    }

                    if (hasCameraPermission) {
                        NavHost(navController = navController, startDestination = "camera") {
                            composable("camera") {
                                CameraScreen(
                                    cameraController = cameraController,
                                    onCapture = { captureResult ->
                                        val sessionId = UUID.randomUUID().toString()
                                        // In a real app, save result to a repository keyed by sessionId
                                        ReviewScreen.captureResultCache = captureResult
                                        navController.navigate("review/$sessionId")
                                    }
                                )
                            }
                            composable(
                                route = "review/{sessionId}",
                                arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
                            ) { backStackEntry ->
                                val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
                                ReviewScreen(
                                    sessionId = sessionId,
                                    onRetake = {
                                        navController.popBackStack()
                                    },
                                    onSaved = {
                                        navController.popBackStack()
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::cameraController.isInitialized) {
            cameraController.release()
        }
    }
}
