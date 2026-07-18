package com.docvision.shared.security

/**
 * Interface defining cryptographic operations for secure file storage.
 * Implementations should utilize AES-256-GCM for robust symmetric encryption and authentication.
 * 
 * IMPORTANT: In addition to file-level encryption provided by this manager, 
 * all structured data persisted in the SQLite database MUST use SQLCipher 
 * to ensure data-at-rest encryption for metadata and application state.
 */
interface CryptoManager {
    /**
     * Encrypts the provided raw byte array using AES-256-GCM.
     * 
     * @param data The plaintext data to encrypt.
     * @return The encrypted data (ciphertext + authentication tag + IV).
     */
    fun encryptData(data: ByteArray): ByteArray

    /**
     * Decrypts the provided byte array using AES-256-GCM.
     * 
     * @param encryptedData The encrypted data (including IV and auth tag).
     * @return The decrypted plaintext data.
     * @throws Exception if decryption fails or data is tampered with.
     */
    fun decryptData(encryptedData: ByteArray): ByteArray
}
