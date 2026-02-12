# Session: Knowledge Base

## Session
- Created: 2026-01-01
- Moved to: /Users/dathan/dev/knowledge (2026-02-01)
- Protocol: devloop

## Goal
Personal knowledge base with two core workflows:

1. **Batch update**: Scan sources → ingest new episodes → summarize → extract knowledge → publish to Protocol Supply
2. **One-off ingest**: URL → extract knowledge → create entry → publish to Protocol Supply

**Exit condition**: Both workflows operational end-to-end with single command each.

## Status: working

## Current State
- **Sources**: 8 channels registered, 125+ episodes ingested
- **Artifacts**: 18 (5 frameworks, 6 protocols, 7 facts)
- **Infrastructure**: Scripts working (update-sources, ingest-url, fetch-transcript)

## Workflows

### 1. Batch Update (registered sources)
```
update sources → summarize new → extract knowledge → publish
     ✓                ✓              manual          manual
```
- **Handled by openclaw** (cron-scheduled)
- `node scripts/update-sources.mjs` - scans registry, fetches new episodes, saves transcript + summary
- Output: `source/{name}/raw/*.md` + `source/{name}/summaries/episodes/*.md`

### 2. One-Off Ingest (ad-hoc URL)
```
ingest-url → summarize → extract knowledge → publish
    ✓           ✓           manual          manual
```
- `node scripts/ingest-url.mjs <url>` - YouTube or webpage, creates summary
- Output: Summary in `source/{name}/summaries/`

### Gaps
1. **Knowledge extraction** - summaries exist but `knowledge/` artifacts are manual
2. **Publish** - sync to Protocol Supply is a separate command (see CLAUDE.md)

## Ideas
- [!] Add more AI engineering sources (Latent Space, Practical AI)
- [ ] RSS/podcast support (needs Whisper integration)
- [ ] Auto-extraction of knowledge artifacts from summaries
- [?] Newsletter/Substack ingestion
- [ ] Tag-based retrieval across sources

## Architecture

```
Sources (YouTube, web)
    ↓
Ingestion (transcripts)
    ↓
Summarization (per-episode)
    ↓
Knowledge extraction (manual → automated)
    ↓
Publish to protocol API
```

## Key Commands
- `node scripts/update-sources.mjs` - Scan for new episodes
- `node scripts/ingest-url.mjs <url>` - One-off ingestion
- Check CLAUDE.md for publish workflow
