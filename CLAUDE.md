# Knowledge

Personal knowledge base with Claude-driven source management.

## Commands

### update sources
Scan all registered sources for new episodes and auto-ingest.

```bash
node scripts/update-sources.mjs [--dry-run] [--source=doac] [--limit=5]
```

### source \<url\>
Ingest a one-off URL into knowledge.

```bash
node scripts/ingest-url.mjs <url> [--source=misc] [--title="..."]
```

Examples:
- YouTube: `node scripts/ingest-url.mjs https://youtube.com/watch?v=xxx`
- Webpage: `node scripts/ingest-url.mjs https://example.com/article --source=research`

### ingest pending
Process all pending items in source queues. Check each source's `queue.md` for pending items and ingest them.

### publish
Sync knowledge/ entries to protocol API.

```bash
# Fetch sync protocol and follow instructions
type protocolapi &>/dev/null || eval 'protocolapi() { source .env 2>/dev/null; curl -sH "Authorization: Bearer $PROTOCOL_TOKEN" "${PROTOCOL_API:-https://api.protocol.supply}$*"; }'
protocolapi "/@protocol/sync.md"
```

Or inline:
```bash
source .env
API="${PROTOCOL_API:-https://api.protocol.supply}"
REPO="knowledge"

# Build files array from knowledge/**/*.md
files=$(find knowledge -name "*.md" -type f | while read f; do
  content=$(cat "$f" | jq -Rs .)
  path=$(echo "$f" | sed 's|^knowledge/||' | sed 's|\.md$||')
  echo "{\"path\": \"$path\", \"content\": $content}"
done | jq -s '.')

# Sync to API
curl -X POST "$API/repo/$REPO/import" \
  -H "Authorization: Bearer $PROTOCOL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"files\": $files}"
```

## Project Structure

```
knowledge/
├── CLAUDE.md              # This file
├── .env                   # OPENAI_API_KEY, PROTOCOL_TOKEN
├── .protocol.json         # {"repo": "knowledge"}
├── package.json           # Node dependencies
│
├── knowledge/             # Publishable artifacts (→ protocol API)
│   ├── facts/             # Verified facts and data points
│   ├── frameworks/        # Mental models and decision frameworks
│   ├── protocols/         # Action protocols and checklists
│   └── index.md           # Master index
│
├── source/                # Source material
│   ├── registry.yaml      # All sources with configs
│   └── {source-slug}/     # Per-source directory
│       ├── config.yaml    # Source-specific config
│       ├── queue.md       # Pending | Processing | Completed
│       ├── raw/           # Full transcripts
│       └── summaries/     # Episode summaries
│           └── episodes/
│
├── time/                  # Temporal stream (daily notes, todos)
├── topic/                 # Semantic research by subject
│
└── scripts/               # Automation
    ├── update-sources.mjs # Scan sources, ingest new episodes
    ├── ingest-url.mjs     # One-off URL ingestion
    ├── ingest-episode.mjs # YouTube episode ingestion
    ├── fetch-channel-videos.mjs
    └── fetch-transcript.mjs
```

## Source Types

Currently supported:
- **YouTube channels** - Auto-discovers new episodes, fetches transcripts
- **YouTube playlists** - Same as channels
- **Web pages** - Manual ingestion via `source <url>`

Future:
- Podcast RSS (would need Whisper or transcript service)
- Substack/newsletters

## Workflow

1. **Add a source**: Edit `source/registry.yaml`, add entry with URL and config
2. **Update sources**: Run `update sources` to fetch new episodes
3. **Review summaries**: Check `source/{name}/summaries/episodes/`
4. **Extract knowledge**: Manually create entries in `knowledge/` from insights
5. **Publish**: Sync `knowledge/` to protocol API

## Dependencies

Run `npm install` to install:
- `@danielxceron/youtube-transcript` - YouTube transcript extraction

Uses OpenAI API for summarization (requires OPENAI_API_KEY in .env).
