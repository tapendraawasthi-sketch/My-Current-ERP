# Phase 6 — Latency & UX Optimization Guide

Complete guide to making Orbix/Falcon feel fast on NVIDIA L4 GPU.

## TL;DR Performance Numbers

| Model | First Token | Tokens/sec | Perceived Latency |
|-------|-------------|------------|-------------------|
| qwen3:32b Q4 | 2-3s | 8-15 t/s | ~2s (with streaming) |
| qwen3:14b Q4 | 1-2s | 15-25 t/s | ~1s (with streaming) |
| qwen3:8b Q4 | <1s | 25-40 t/s | ~0.5s (with streaming) |
| qwen3:4b | <0.5s | 40-60 t/s | instant |
| Cache hit | - | - | <100ms |

## Why Slow Generation Feels Fast

The key insight: **perceived latency ≠ actual latency**.

With streaming:
- User sees first word in 2s, feels immediate
- Words appear continuously — engaging, not boring
- Total 200-token response takes 15-20s, but feels like 5s

Without streaming:
- User stares at spinner for 15-20s
- Then full response dumps at once
- Feels much slower even though same total time

## Architecture for Low Latency

```
User Input
    │
    ▼
┌───────────────────┐
│   Response Cache  │ ──▶ HIT: <100ms response
│   (LRU + semantic)│
└───────────────────┘
    │ MISS
    ▼
┌───────────────────┐
│   Fast Router     │ ◀── qwen3:4b (<0.5s)
│   (Intent Class)  │
└───────────────────┘
    │
    ▼
┌───────────────────┐
│   RAG Retrieval   │ ◀── nomic-embed (<100ms)
│   (if needed)     │
└───────────────────┘
    │
    ▼
┌───────────────────┐
│  Main LLM Stream  │ ◀── qwen3:32b (2s first token)
│  (token by token) │     Tokens stream to frontend
└───────────────────┘
```

## Ollama Serving Flags

### Essential Flags (set in environment)

```bash
# Keep model in VRAM between requests (avoid 12s reload)
export OLLAMA_KEEP_ALIVE="10m"

# Allow 2 concurrent requests (fast model + main model)
export OLLAMA_NUM_PARALLEL=2

# Keep both models loaded
export OLLAMA_MAX_LOADED_MODELS=2

# Use all GPU layers
export OLLAMA_NUM_GPU=99
```

### Modelfile Optimization

```dockerfile
# Modelfile for qwen3:32b on L4
FROM qwen3:32b

# Reduce context if hitting VRAM limits
PARAMETER num_ctx 8192

# Faster generation at slight quality cost
PARAMETER num_predict 1024
PARAMETER repeat_penalty 1.1

# Keep loaded
PARAMETER num_keep 4
```

### vLLM Alternative (Higher Throughput)

For production with multiple concurrent users:

```bash
# Install vLLM
pip install vllm

# Serve with optimal settings for L4
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-32B-Instruct-AWQ \
    --quantization awq \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.9 \
    --tensor-parallel-size 1
```

vLLM advantages:
- 2-3x higher throughput than Ollama
- Better batching for concurrent users
- PagedAttention for efficient VRAM usage

## Response Caching

### How It Works

```python
# 1. Exact match (hash)
"VAT rate in Nepal?" → cached response (instant)

# 2. Semantic similarity (embedding)
"What is the VAT rate?" → same cached response (cosine > 0.92)
```

### Cache Configuration

```bash
# In .env
CACHE_ENABLED=true
CACHE_TTL_SECONDS=3600   # 1 hour
CACHE_MAX_SIZE=500       # Max entries
```

### Cache Endpoints

```bash
# Check cache performance
curl http://localhost:8765/cache/stats

# Clear cache
curl -X POST http://localhost:8765/cache/clear
```

## Frontend UX Patterns

### 1. Thinking Indicator

```typescript
// Show immediately when user sends message
set({ isTyping: true, showThinking: true });

// SSE events from backend
"thinking_start" → Show "Thinking..." with dots animation
"tool_calling"   → Show "Looking up [tool]..."
"token"          → Start showing response text
"thinking_done"  → Hide thinking indicator
"complete"       → Final cleanup
```

### 2. Progressive Text Display

```typescript
// Don't dump all text at once — animate it
async function animateText(text: string, element: HTMLElement) {
  for (const char of text) {
    element.textContent += char;
    await sleep(10); // 10ms per character
  }
}
```

### 3. Skeleton Loading

While waiting for first token:

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### 4. Cancel Button

Always let users abort slow responses:

```typescript
const controller = new AbortController();

// Cancel button
<button onClick={() => controller.abort()}>
  Stop
</button>
```

## Latency Breakdown

Typical response flow (32B model, cache miss):

| Step | Time | Cumulative |
|------|------|------------|
| Network round-trip | 50ms | 50ms |
| Intent routing (4B) | 400ms | 450ms |
| RAG retrieval | 100ms | 550ms |
| First token (32B) | 2500ms | 3050ms |
| Token 10 | +700ms | 3750ms |
| Token 50 | +3500ms | 7250ms |
| Token 100 | +7000ms | 10250ms |

With streaming, user sees:
- "Thinking..." at 50ms
- First word at 3s
- Continuous text from 3s onward

Without streaming, user sees:
- Spinner for 10s
- Full response dumps at 10s

## Troubleshooting

### "First token is too slow" (>5s)

1. Check if model is loaded: `curl http://localhost:11434/api/tags`
2. Increase `OLLAMA_KEEP_ALIVE` to prevent unloading
3. Consider smaller model (14B instead of 32B)

### "OOM errors"

1. Reduce `CONTEXT_SIZE` from 8192 to 4096
2. Use Q4_K_M quantization instead of Q5
3. Reduce `OLLAMA_NUM_PARALLEL` to 1

### "Cache not helping"

1. Check cache stats: `GET /cache/stats`
2. Increase `CACHE_TTL_SECONDS` if queries repeat over longer periods
3. Lower `SIMILARITY_THRESHOLD` (0.92 → 0.90) for more hits

### "Streaming not working"

1. Check endpoint: POST `/chat/stream` not `/chat`
2. Verify `Accept: text/event-stream` header
3. Check for proxy buffering (nginx: `proxy_buffering off`)

## Quick Reference

```bash
# Start with optimized settings
OLLAMA_KEEP_ALIVE=10m \
OLLAMA_NUM_PARALLEL=2 \
CACHE_ENABLED=true \
python scripts/start.py

# Monitor performance
curl http://localhost:8765/performance

# Check cache
curl http://localhost:8765/cache/stats

# Warm up model
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "qwen3:32b", "prompt": "Hello", "stream": false}'
```

## Summary

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Streaming | Huge (2x perceived speed) | Low |
| Response cache | High (instant for repeats) | Low |
| Keep model loaded | High (skip 12s reload) | Low |
| Fast router (4B) | Medium (route in 0.5s) | Medium |
| Smaller model | Trade-off (faster but dumber) | Low |
| vLLM | High (2-3x throughput) | Medium |

**Priority order**: Streaming → Caching → Keep-alive → Fast router
