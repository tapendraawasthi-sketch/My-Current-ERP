package com.docvision.shared.processing

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Processing job submitted to the queue.
 */
data class ProcessingJob(
    val jobId: String,
    val jpegBytes: ByteArray,
    val detectionResult: com.docvision.shared.detection.DetectionResult,
    val config: EnhancementConfig,
    val priority: ProcessingPriority = ProcessingPriority.NORMAL
)

enum class ProcessingPriority { HIGH, NORMAL, LOW }

sealed class ProcessingJobStatus {
    object Queued : ProcessingJobStatus()
    data class Processing(val progress: Float) : ProcessingJobStatus()
    data class Completed(val result: EnhancementResult) : ProcessingJobStatus()
    data class Failed(val error: Throwable) : ProcessingJobStatus()
}

/**
 * Async processing queue that executes document enhancement jobs serially
 * (to respect RAM budget: ≤350MB above baseline).
 * HIGH priority jobs are moved to front of queue.
 */
class ProcessingQueue(
    private val processor: DocumentProcessor,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
) {
    private val channel = Channel<ProcessingJob>(capacity = 10, onBufferOverflow = kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST)
    private val _statuses = MutableStateFlow<Map<String, ProcessingJobStatus>>(emptyMap())
    val statuses: StateFlow<Map<String, ProcessingJobStatus>> = _statuses
    
    private val priorityQueue = mutableListOf<ProcessingJob>()
    private val queueMutex = Mutex()
    private val signalChannel = Channel<Unit>(Channel.CONFLATED)

    init {
        // Start the single consumer coroutine
        scope.launch { processJobs() }
    }
    
    suspend fun enqueue(job: ProcessingJob) {
        queueMutex.withLock {
            priorityQueue.add(job)
            priorityQueue.sortBy { it.priority } 
        }
        _statuses.update { it + (job.jobId to ProcessingJobStatus.Queued) }
        signalChannel.send(Unit)
    }
    
    fun cancel(jobId: String) {
        scope.launch {
            queueMutex.withLock {
                priorityQueue.removeAll { it.jobId == jobId }
            }
            _statuses.update { it - jobId }
        }
    }
    
    fun getStatus(jobId: String): ProcessingJobStatus? {
        return _statuses.value[jobId]
    }
    
    private suspend fun processJobs() {
        while (isActive) {
            val job = queueMutex.withLock {
                if (priorityQueue.isNotEmpty()) priorityQueue.removeAt(0) else null
            }

            if (job != null) {
                _statuses.update { it + (job.jobId to ProcessingJobStatus.Processing(0f)) }
                try {
                    val result = processor.process(job.jpegBytes, job.detectionResult, job.config)
                    _statuses.update { it + (job.jobId to ProcessingJobStatus.Completed(result)) }
                } catch (e: Exception) {
                    _statuses.update { it + (job.jobId to ProcessingJobStatus.Failed(e)) }
                }
            } else {
                signalChannel.receive()
            }
        }
    }
    
    fun shutdown() {
        scope.cancel()
    }
}
