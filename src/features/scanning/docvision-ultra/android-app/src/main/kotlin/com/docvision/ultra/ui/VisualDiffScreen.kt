package com.docvision.ultra.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/**
 * Displays a side-by-side synchronized view of two documents with simple diff highlighting.
 */
@Composable
fun VisualDiffScreen(
    oldText: String,
    newText: String,
    modifier: Modifier = Modifier
) {
    val oldState = rememberLazyListState()
    val newState = rememberLazyListState()

    // Synchronize scrolling between the two lists
    LaunchedEffect(oldState.firstVisibleItemScrollOffset, oldState.firstVisibleItemIndex) {
        if (oldState.isScrollInProgress) {
            newState.scrollToItem(oldState.firstVisibleItemIndex, oldState.firstVisibleItemScrollOffset)
        }
    }
    LaunchedEffect(newState.firstVisibleItemScrollOffset, newState.firstVisibleItemIndex) {
        if (newState.isScrollInProgress) {
            oldState.scrollToItem(newState.firstVisibleItemIndex, newState.firstVisibleItemScrollOffset)
        }
    }

    val oldLines = oldText.lines()
    val newLines = newText.lines()

    Row(modifier = modifier.fillMaxSize()) {
        // Left Column: Original Text
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Original",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF5F5F5))
                    .padding(8.dp)
            )
            LazyColumn(state = oldState, modifier = Modifier.fillMaxSize()) {
                items(oldLines.size) { index ->
                    val line = oldLines[index]
                    val isDeleted = !newLines.contains(line) // Simple mock diff logic
                    Text(
                        text = line,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (isDeleted) Color(0xFFFFCDD2) else Color.Transparent)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        color = Color.Black
                    )
                }
            }
        }
        
        // Divider
        Spacer(modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(Color.LightGray))
            
        // Right Column: Modified Text
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Modified",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF5F5F5))
                    .padding(8.dp)
            )
            LazyColumn(state = newState, modifier = Modifier.fillMaxSize()) {
                items(newLines.size) { index ->
                    val line = newLines[index]
                    val isAdded = !oldLines.contains(line) // Simple mock diff logic
                    Text(
                        text = line,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (isAdded) Color(0xFFC8E6C9) else Color.Transparent)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        color = Color.Black
                    )
                }
            }
        }
    }
}
