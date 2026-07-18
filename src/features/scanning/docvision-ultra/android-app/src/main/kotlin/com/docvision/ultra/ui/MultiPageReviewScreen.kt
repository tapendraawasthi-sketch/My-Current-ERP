package com.docvision.ultra.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.docvision.shared.session.ScannedPage

@Composable
fun MultiPageReviewScreen(
    pages: List<ScannedPage>,
    onAddPage: () -> Unit,
    onDone: () -> Unit,
    onDeletePage: (String) -> Unit,
    onReorder: (Int, Int) -> Unit
) {
    var selectedPageId by remember { mutableStateOf(pages.firstOrNull()?.id) }
    val selectedPage = pages.find { it.id == selectedPageId } ?: pages.firstOrNull()

    Column(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // Main Area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Color.DarkGray),
            contentAlignment = Alignment.Center
        ) {
            if (selectedPage != null) {
                Image(
                    painter = rememberAsyncImagePainter(model = selectedPage.processedUri),
                    contentDescription = "Selected Page",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Text("No pages scanned", color = Color.White)
            }
        }

        // Bottom Bar Area
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Black)
                .padding(16.dp)
        ) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(pages, key = { it.id }) { page ->
                    ThumbnailItem(
                        page = page,
                        isSelected = page.id == selectedPageId,
                        onClick = { selectedPageId = page.id },
                        onSwipeUp = { onDeletePage(page.id) }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(onClick = onAddPage) {
                    Text("Add Page")
                }
                Button(onClick = onDone) {
                    Text("Done")
                }
            }
        }
    }
}

@Composable
fun ThumbnailItem(
    page: ScannedPage,
    isSelected: Boolean,
    onClick: () -> Unit,
    onSwipeUp: () -> Unit
) {
    var offsetY by remember { mutableStateOf(0f) }

    Box(
        modifier = Modifier
            .width(70.dp)
            .height(100.dp)
            .offset(y = offsetY.dp)
            .border(
                width = if (isSelected) 2.dp else 0.dp,
                color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragEnd = {
                        if (offsetY < -50) {
                            onSwipeUp()
                        }
                        offsetY = 0f
                    }
                ) { change, dragAmount ->
                    change.consume()
                    offsetY += dragAmount.y
                }
            }
            .clickable { onClick() }
            .background(Color.LightGray, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = rememberAsyncImagePainter(model = page.processedUri),
            contentDescription = "Page ${page.pageNumber}",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        
        Text(
            text = "${page.pageNumber}",
            color = Color.White,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .background(Color.Black.copy(alpha = 0.5f))
                .padding(2.dp)
        )
    }
}
