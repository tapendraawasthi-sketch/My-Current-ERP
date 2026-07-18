import Foundation
import UIKit

/// Manages persistence of processed document images to the app sandbox.
final class DocumentStorageManager {
    
    static let shared = DocumentStorageManager()
    
    private let documentsDir: URL
    private let fileManager = FileManager.default
    
    private init() {
        let base = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        documentsDir = base.appendingPathComponent("ScannedDocuments", isDirectory: true)
        try? fileManager.createDirectory(at: documentsDir, withIntermediateDirectories: true)
    }
    
    struct SavedDocument {
        let documentId: String
        let colorJpegURL: URL
        let grayscaleJpegURL: URL?
        let binaryPngURL: URL?
        let metadata: DocumentMetadata
    }
    
    struct DocumentMetadata: Codable {
        let capturedAt: Date
        let aspectRatio: Float
        let textCoverage: Float
        let processingTotalMs: Int
        let pageCount: Int
    }
    
    enum StorageError: Error {
        case fileSaveFailed
        case documentNotFound
        case corruptMetadata
    }
    
    func save(result: iOSEnhancementResult, documentId: String = UUID().uuidString) async throws -> SavedDocument {
        let docDir = documentsDir.appendingPathComponent(documentId, isDirectory: true)
        try fileManager.createDirectory(at: docDir, withIntermediateDirectories: true)
        
        let colorURL = docDir.appendingPathComponent("color.jpg")
        let grayscaleURL = docDir.appendingPathComponent("grayscale.jpg")
        let binaryURL = docDir.appendingPathComponent("binary.png")
        let metaURL = docDir.appendingPathComponent("metadata.json")
        
        guard let colorData = result.colorEnhanced.jpegData(compressionQuality: 0.8) else {
            throw StorageError.fileSaveFailed
        }
        try colorData.write(to: colorURL)
        
        if let grayData = result.grayscale.jpegData(compressionQuality: 0.8) {
            try grayData.write(to: grayscaleURL)
        }
        
        if let binaryImage = result.binary, let binaryData = binaryImage.pngData() {
            try binaryData.write(to: binaryURL)
        }
        
        let meta = DocumentMetadata(
            capturedAt: Date(),
            aspectRatio: result.aspectRatio,
            textCoverage: result.textCoverage,
            processingTotalMs: result.totalMs,
            pageCount: 1
        )
        
        let metaData = try JSONEncoder().encode(meta)
        try metaData.write(to: metaURL)
        
        return SavedDocument(
            documentId: documentId,
            colorJpegURL: colorURL,
            grayscaleJpegURL: grayscaleURL,
            binaryPngURL: result.binary != nil ? binaryURL : nil,
            metadata: meta
        )
    }
    
    func load(documentId: String) async throws -> SavedDocument {
        let docDir = documentsDir.appendingPathComponent(documentId, isDirectory: true)
        let metaURL = docDir.appendingPathComponent("metadata.json")
        
        guard fileManager.fileExists(atPath: metaURL.path) else {
            throw StorageError.documentNotFound
        }
        
        let metaData = try Data(contentsOf: metaURL)
        let meta = try JSONDecoder().decode(DocumentMetadata.self, from: metaData)
        
        let colorURL = docDir.appendingPathComponent("color.jpg")
        let grayscaleURL = docDir.appendingPathComponent("grayscale.jpg")
        let binaryURL = docDir.appendingPathComponent("binary.png")
        
        return SavedDocument(
            documentId: documentId,
            colorJpegURL: colorURL,
            grayscaleJpegURL: fileManager.fileExists(atPath: grayscaleURL.path) ? grayscaleURL : nil,
            binaryPngURL: fileManager.fileExists(atPath: binaryURL.path) ? binaryURL : nil,
            metadata: meta
        )
    }
    
    func listDocuments() -> [SavedDocument] {
        guard let dirs = try? fileManager.contentsOfDirectory(at: documentsDir, includingPropertiesForKeys: nil, options: .skipsHiddenFiles) else {
            return []
        }
        
        var docs: [SavedDocument] = []
        for dir in dirs {
            if let doc = try? awaitBlockingLoad(documentId: dir.lastPathComponent) {
                docs.append(doc)
            }
        }
        return docs.sorted(by: { $0.metadata.capturedAt > $1.metadata.capturedAt })
    }
    
    private func awaitBlockingLoad(documentId: String) throws -> SavedDocument {
        let docDir = documentsDir.appendingPathComponent(documentId, isDirectory: true)
        let metaURL = docDir.appendingPathComponent("metadata.json")
        let metaData = try Data(contentsOf: metaURL)
        let meta = try JSONDecoder().decode(DocumentMetadata.self, from: metaData)
        
        return SavedDocument(
            documentId: documentId,
            colorJpegURL: docDir.appendingPathComponent("color.jpg"),
            grayscaleJpegURL: docDir.appendingPathComponent("grayscale.jpg"),
            binaryPngURL: docDir.appendingPathComponent("binary.png"),
            metadata: meta
        )
    }
    
    func delete(documentId: String) async throws {
        let docDir = documentsDir.appendingPathComponent(documentId, isDirectory: true)
        try fileManager.removeItem(at: docDir)
    }
    
    func totalStorageUsed() -> Int64 {
        var totalSize: Int64 = 0
        if let enumerator = fileManager.enumerator(at: documentsDir, includingPropertiesForKeys: [.fileSizeKey]) {
            for case let fileURL as URL in enumerator {
                if let resourceValues = try? fileURL.resourceValues(forKeys: [.fileSizeKey]),
                   let fileSize = resourceValues.fileSize {
                    totalSize += Int64(fileSize)
                }
            }
        }
        return totalSize
    }
    
    private func generateDocumentId() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd_HHmmss"
        return "DOC_\(formatter.string(from: Date()))_\(UUID().uuidString.prefix(8))"
    }
}
