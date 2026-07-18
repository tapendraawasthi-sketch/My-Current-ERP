package com.docvision.shared.session

data class Point(val x: Float, val y: Float)

data class EditRecipe(
    val rotationDegrees: Float = 0f,
    val brightness: Float = 0f,
    val contrast: Float = 1f,
    val filterMode: String = "original",
    val corners: List<Point> = emptyList()
)

data class ScannedPage(
    val id: String,
    val originalUri: String,
    val processedUri: String,
    val pageNumber: Int,
    val editRecipe: EditRecipe
)

data class ScanSession(
    val id: String,
    val pages: MutableList<ScannedPage> = mutableListOf(),
    val createdAt: Long = System.currentTimeMillis()
)

class ScanSessionManager {
    var currentSession: ScanSession? = null
        private set

    fun startNewSession(id: String): ScanSession {
        val session = ScanSession(id = id)
        currentSession = session
        return session
    }

    fun addPage(session: ScanSession, originalUri: String, processedUri: String, editRecipe: EditRecipe = EditRecipe()): ScannedPage {
        val pageNumber = session.pages.size + 1
        val page = ScannedPage(
            id = "${session.id}_$pageNumber",
            originalUri = originalUri,
            processedUri = processedUri,
            pageNumber = pageNumber,
            editRecipe = editRecipe
        )
        session.pages.add(page)
        return page
    }

    fun reorderPages(session: ScanSession, fromIndex: Int, toIndex: Int) {
        if (fromIndex in 0 until session.pages.size && toIndex in 0 until session.pages.size) {
            val page = session.pages.removeAt(fromIndex)
            session.pages.add(toIndex, page)
            updatePageNumbers(session)
        }
    }

    fun deletePage(session: ScanSession, pageId: String) {
        session.pages.removeAll { it.id == pageId }
        updatePageNumbers(session)
    }

    fun updatePageRecipe(session: ScanSession, pageId: String, newRecipe: EditRecipe) {
        val index = session.pages.indexOfFirst { it.id == pageId }
        if (index != -1) {
            session.pages[index] = session.pages[index].copy(editRecipe = newRecipe)
        }
    }

    private fun updatePageNumbers(session: ScanSession) {
        for (i in session.pages.indices) {
            session.pages[i] = session.pages[i].copy(pageNumber = i + 1)
        }
    }
}
