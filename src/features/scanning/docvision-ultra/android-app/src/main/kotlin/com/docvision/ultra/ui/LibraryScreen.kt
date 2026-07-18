package com.docvision.ultra.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docvision.shared.storage.ScanEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    scansFlow: Flow<List<ScanEntity>> = emptyFlow(),
    onSearch: (String) -> Unit = {},
    onDeleteScans: (List<String>) -> Unit = {}
) {
    val context = LocalContext.current
    var searchQuery by remember { mutableStateOf("") }
    val scans by scansFlow.collectAsState(initial = emptyList())
    var selectedScans by remember { mutableStateOf<Set<String>>(emptySet()) }
    val isMultiSelectMode = selectedScans.isNotEmpty()

    Scaffold(
        topBar = {
            if (isMultiSelectMode) {
                TopAppBar(
                    title = { Text("${selectedScans.size} selected") },
                    actions = {
                        IconButton(onClick = { shareScans(context, selectedScans, scans) }) {
                            Icon(Icons.Default.Share, contentDescription = "Share")
                        }
                        IconButton(onClick = { 
                            onDeleteScans(selectedScans.toList())
                            selectedScans = emptySet()
                        }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                )
            } else {
                SearchBar(
                    query = searchQuery,
                    onQueryChange = { 
                        searchQuery = it
                        onSearch(it)
                    },
                    onSearch = { onSearch(it) },
                    active = false,
                    onActiveChange = {},
                    placeholder = { Text("Search documents...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {}
            }
        }
    ) { paddingValues ->
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            items(scans, key = { it.scanId }) { scan ->
                val isSelected = selectedScans.contains(scan.scanId)
                ScanThumbnailItem(
                    scan = scan,
                    isSelected = isSelected,
                    onClick = {
                        if (isMultiSelectMode) {
                            selectedScans = if (isSelected) {
                                selectedScans - scan.scanId
                            } else {
                                selectedScans + scan.scanId
                            }
                        }
                    },
                    onLongClick = {
                        if (!isMultiSelectMode) {
                            selectedScans = setOf(scan.scanId)
                        }
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ScanThumbnailItem(
    scan: ScanEntity,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.75f)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Placeholder background for document thumbnail image
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.LightGray)
            )

            // Info overlay
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(8.dp)
            ) {
                Text(
                    text = scan.title,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = scan.documentType,
                    color = Color.LightGray,
                    fontSize = 12.sp
                )
            }

            // Selection state overlay
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Blue.copy(alpha = 0.3f))
                )
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Selected",
                    tint = Color.White,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(24.dp)
                )
            }
        }
    }
}

/**
 * Triggers standard Android Share Sheet using Intent.createChooser.
 */
private fun shareScans(context: Context, selectedIds: Set<String>, scans: List<ScanEntity>) {
    val uris = scans.filter { selectedIds.contains(it.scanId) }
        .flatMap { it.filePaths }
        .map { Uri.parse(it) }

    if (uris.isEmpty()) return

    val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "application/pdf"
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    
    val chooser = Intent.createChooser(intent, "Share Documents")
    context.startActivity(chooser)
}
