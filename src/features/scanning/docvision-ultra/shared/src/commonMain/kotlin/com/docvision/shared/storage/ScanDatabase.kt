package com.docvision.shared.storage

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * Represents a scanned document entity stored in the database.
 */
data class ScanEntity(
    val scanId: String,
    val title: String,
    val pageCount: Int,
    val documentType: String,
    val createdAt: Long,
    val ocrFullText: String,
    val filePaths: List<String>
)

/**
 * Database interface for managing document scans.
 * Leverages SQLite FTS5 for full-text search operations.
 */
interface ScanDatabase {
    fun insertScan(scan: ScanEntity)
    fun getScanById(scanId: String): ScanEntity?
    fun deleteScan(scanId: String)
    fun getAllScans(): Flow<List<ScanEntity>>
    fun searchScans(query: String): Flow<List<ScanEntity>>
}

/**
 * Implementation of ScanDatabase. 
 * Note: Uses in-memory structures to mock standard SQLDelight/Room syntax and behavior.
 */
class ScanDatabaseImpl : ScanDatabase {
    
    private val memoryDb = mutableMapOf<String, ScanEntity>()

    override fun insertScan(scan: ScanEntity) {
        // Mocking SQLite: INSERT INTO scans (...) VALUES (...)
        memoryDb[scan.scanId] = scan
    }

    override fun getScanById(scanId: String): ScanEntity? {
        // Mocking SQLite: SELECT * FROM scans WHERE scan_id = ?
        return memoryDb[scanId]
    }

    override fun deleteScan(scanId: String) {
        // Mocking SQLite: DELETE FROM scans WHERE scan_id = ?
        memoryDb.remove(scanId)
    }

    override fun getAllScans(): Flow<List<ScanEntity>> {
        // Mocking SQLite: SELECT * FROM scans ORDER BY created_at DESC
        return flowOf(memoryDb.values.toList().sortedByDescending { it.createdAt })
    }

    override fun searchScans(query: String): Flow<List<ScanEntity>> {
        // Mocking SQLite FTS5: SELECT * FROM scans_fts WHERE scans_fts MATCH ?
        val lowerQuery = query.lowercase()
        
        val results = memoryDb.values.filter {
            it.title.lowercase().contains(lowerQuery) || 
            it.ocrFullText.lowercase().contains(lowerQuery) ||
            it.documentType.lowercase().contains(lowerQuery)
        }
        
        return flowOf(results)
    }
}
