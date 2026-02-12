# Ingestion Protocol Optimization Notes

## Current Process (Sub-agent Pattern)

Each episode ingestion:
1. Fetch transcript via `fetch-transcript.mjs` (~5-10s)
2. Save raw to disk
3. Split into ~5k token chunks
4. Summarize each chunk
5. Combine into episode summary
6. Save summary

**Time per episode**: ~2-5 minutes (depending on length)
**Parallelism**: 4 agents working simultaneously

## Optimization Opportunities

### 1. Script-Based Pipeline (Recommended)

Create `ingest-episode.mjs` that does:
```javascript
// Single script flow
1. fetch transcript
2. chunk transcript
3. call lightweight model (haiku) for each chunk summary
4. combine summaries
5. call lightweight model for final polish
6. save files
```

**Benefits**:
- No sub-agent overhead
- Direct API calls to Claude haiku (faster, cheaper)
- Can batch multiple episodes
- Better error handling and retry logic

### 2. Model Selection

| Task | Current | Recommended |
|------|---------|-------------|
| Chunk summarization | Opus (sub-agent) | Haiku |
| Final episode summary | Opus (sub-agent) | Sonnet |
| Theme extraction | Opus (sub-agent) | Haiku |

Haiku is ~20x cheaper and ~3x faster for straightforward summarization.

### 3. Batch Processing

Instead of 4 separate agents:
```bash
node batch-ingest.mjs doac --limit=10 --parallel=5
```

Single orchestrator spawns lightweight workers.

### 4. Caching

- Cache transcripts (YouTube transcripts don't change)
- Cache partial summaries if interrupted
- Resume from last checkpoint

### 5. Queue Management

Move from markdown queue to SQLite/JSON for:
- Atomic state updates
- Parallel-safe processing
- Progress tracking

## Implementation Priority

1. **High**: Script-based single-episode ingestion with haiku
2. **Medium**: Batch orchestrator with progress tracking
3. **Low**: SQLite queue, caching

## Metrics to Track

- Time per episode (by duration)
- API cost per episode
- Success rate
- Tokens used (input/output)
