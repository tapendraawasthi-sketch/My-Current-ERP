package com.docvision.ultra.storage

import android.content.Context
import com.docvision.shared.processing.EnhancementResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * Manages saving and loading processed document files.
 * Writes to app-private storage: context.filesDir/documents/
 */
class DocumentStorageManager(private val context: Context) {
    private val documentsDir = File(context.filesDir, "documents").apply { mkdirs() }
    
    data class SavedDocument(
        val documentId: String,
        val colorJpegPath: String,
        val grayscaleJpegPath: String?,
        val binaryPngPath: String?,
        val metadata: DocumentMetadata
    )
    
    data class DocumentMetadata(
        val capturedAt: String,  // ISO-8601
        val aspectRatio: Float,
        val textCoverage: Float,
        val processingTotalMs: Long,
        val fileSize: Long
    )
    
    suspend fun saveDocument(
        result: EnhancementResult,
        documentId: String = generateDocumentId()
    ): SavedDocument = withContext(Dispatchers.IO) {
        val docDir = File(documentsDir, documentId).apply { mkdirs() }
        
        val colorFile = File(docDir, "color.jpg")
        colorFile.writeBytes(result.colorEnhancedJpeg)
        
        val grayFile = File(docDir, "gray.jpg")
        grayFile.writeBytes(result.grayscaleJpeg)
        
        val binaryFile = if (result.binaryPng != null) {
            val f = File(docDir, "binary.png")
            f.writeBytes(result.binaryPng)
            f
        } else null
        
        val totalSize = colorFile.length() + grayFile.length() + (binaryFile?.length() ?: 0L)
        
        val meta = DocumentMetadata(
            capturedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            aspectRatio = result.aspectRatio,
            textCoverage = result.textCoverage,
            processingTotalMs = result.timings.totalMs,
            fileSize = totalSize
        )
        
        writeMetadata(docDir, meta)
        
        SavedDocument(
            documentId = documentId,
            colorJpegPath = colorFile.absolutePath,
            grayscaleJpegPath = grayFile.absolutePath,
            binaryPngPath = binaryFile?.absolutePath,
            metadata = meta
        )
    }
    
    suspend fun loadDocument(documentId: String): SavedDocument? = withContext(Dispatchers.IO) {
        val docDir = File(documentsDir, documentId)
        if (!docDir.exists()) return@withContext null
        
        val meta = readMetadata(docDir) ?: return@withContext null
        
        val colorFile = File(docDir, "color.jpg")
        val grayFile = File(docDir, "gray.jpg")
        val binaryFile = File(docDir, "binary.png")
        
        SavedDocument(
            documentId = documentId,
            colorJpegPath = colorFile.absolutePath,
            grayscaleJpegPath = if (grayFile.exists()) grayFile.absolutePath else null,
            binaryPngPath = if (binaryFile.exists()) binaryFile.absolutePath else null,
            metadata = meta
        )
    }
    
    fun listDocuments(): List<SavedDocument> {
        val dirs = documentsDir.listFiles { file -> file.isDirectory } ?: return emptyList()
        return dirs.mapNotNull { dir ->
            val meta = readMetadata(dir)
            if (meta != null) {
                val colorFile = File(dir, "color.jpg")
                val grayFile = File(dir, "gray.jpg")
                val binaryFile = File(dir, "binary.png")
                SavedDocument(
                    documentId = dir.name,
                    colorJpegPath = colorFile.absolutePath,
                    grayscaleJpegPath = if (grayFile.exists()) grayFile.absolutePath else null,
                    binaryPngPath = if (binaryFile.exists()) binaryFile.absolutePath else null,
                    metadata = meta
                )
            } else null
        }
    }
    
    suspend fun deleteDocument(documentId: String): Boolean = withContext(Dispatchers.IO) {
        val docDir = File(documentsDir, documentId)
        docDir.deleteRecursively()
    }
    
    private fun generateDocumentId(): String = UUID.randomUUID().toString()
    
    private fun writeMetadata(dir: File, metadata: DocumentMetadata) {
        val metaFile = File(dir, "meta.json")
        val json = """
            {
                "capturedAt": "${metadata.capturedAt}",
                "aspectRatio": ${metadata.aspectRatio},
                "textCoverage": ${metadata.textCoverage},
                "processingTotalMs": ${metadata.processingTotalMs},
                "fileSize": ${metadata.fileSize}
            }
        """.trimIndent()
        metaFile.writeText(json)
    }
    
    private fun readMetadata(dir: File): DocumentMetadata? {
        val metaFile = File(dir, "meta.json")
        if (!metaFile.exists()) return null
        
        return try {
            val text = metaFile.readText()
            val capturedAt = Regex(""""capturedAt":\s*"([^"]+)"""").find(text)?.groupValues?.get(1) ?: ""
            val aspectRatio = Regex(""""aspectRatio":\s*([0-9.]+)""").find(text)?.groupValues?.get(1)?.toFloat() ?: 1f
            val textCoverage = Regex(""""textCoverage":\s*([0-9.]+)""").find(text)?.groupValues?.get(1)?.toFloat() ?: 0f
            val processingTotalMs = Regex(""""processingTotalMs":\s*([0-9]+)""").find(text)?.groupValues?.get(1)?.toLong() ?: 0L
            val fileSize = Regex(""""fileSize":\s*([0-9]+)""").find(text)?.groupValues?.get(1)?.toLong() ?: 0L
            
            DocumentMetadata(capturedAt, aspectRatio, textCoverage, processingTotalMs, fileSize)
        } catch (e: Exception) {
            null
        }
    }
}
