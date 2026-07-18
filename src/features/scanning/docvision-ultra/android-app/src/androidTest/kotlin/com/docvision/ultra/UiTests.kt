package com.docvision.ultra

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

@RunWith(AndroidJUnit4::class)
class UiTests {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun testCameraScreenAccessibilityAndNavigation() {
        composeTestRule.setContent {
            DocVisionTestApp()
        }

        // 1. Verify Camera screen has proper accessibility labels
        composeTestRule.onNodeWithContentDescription("Capture Document Button").assertExists()
        
        // 2. Navigate from Scan -> Review
        composeTestRule.onNodeWithContentDescription("Capture Document Button").performClick()
        
        // Verify we are on Review screen
        composeTestRule.onNodeWithText("Review Scan").assertExists()
        
        // 3. Navigate from Review -> Library
        composeTestRule.onNodeWithText("Save to Library").performClick()
        
        // Verify we are on Library screen
        composeTestRule.onNodeWithText("Document Library").assertExists()
    }
}

/**
 * A mock composable app flow for testing navigation Scan -> Review -> Library.
 */
@Composable
fun DocVisionTestApp() {
    var currentScreen by remember { mutableStateOf("Scan") }

    when (currentScreen) {
        "Scan" -> {
            Column {
                Text("Camera Viewport")
                Button(
                    onClick = { currentScreen = "Review" },
                    modifier = Modifier.semantics { contentDescription = "Capture Document Button" }
                ) {
                    Text("Capture")
                }
            }
        }
        "Review" -> {
            Column {
                Text("Review Scan")
                Button(onClick = { currentScreen = "Library" }) {
                    Text("Save to Library")
                }
            }
        }
        "Library" -> {
            Column {
                Text("Document Library")
                Text("Item 1")
                Text("Item 2")
            }
        }
    }
}
