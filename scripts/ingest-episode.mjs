#!/usr/bin/env node
/**
 * Episode Ingestion Script
 * Fetches transcript, chunks, summarizes with OpenAI API, saves files
 *
 * Usage:
 *   node ingest-episode.mjs <video-id> <source-name> [--title="Episode Title"] [--workspace=/path/to/source]
 *   node ingest-episode.mjs P7Y-fynYsgE doac --title="Stuart Russell AI Warning"
 *
 * Environment:
 *   OPENAI_API_KEY - Required for summarization (loaded from .env if present)
 *
 * Output:
 *   - raw/{YYYY-MM-DD}-{video-id}-{slug}.md - Full transcript (date = publish date)
 *   - summaries/episodes/{YYYY-MM-DD}-{video-id}-{slug}.md - Episode summary
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
// Playwright import removed — using multi-strategy Python transcript fetcher

// Load .env from cwd if it exists
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    }
  }
}
loadEnv();

// Configuration
const CHUNK_SIZE = 5000; // ~5k tokens per chunk
const MODEL_CHUNK = 'gpt-4o-mini';  // Fast/cheap for chunk summaries
const MODEL_FINAL = 'gpt-4o'; // Quality for final summary

// Default workspace - can be overridden with --workspace flag
function getWorkspaceBase() {
  // Try to get from environment or use sensible default
  return process.env.KNOWLEDGE_SOURCE_BASE || join(process.cwd(), 'source');
}

function parseArgs(args) {
  const options = {
    videoId: null,
    source: null,
    title: null,
    workspace: null
  };

  for (const arg of args) {
    if (arg.startsWith('--title=')) {
      options.title = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--workspace=')) {
      options.workspace = arg.split('=').slice(1).join('=');
    } else if (!options.videoId) {
      options.videoId = arg;
    } else if (!options.source) {
      options.source = arg;
    }
  }

  return options;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function fetchPublishDate(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = execSync(
      `curl -s "${url}" -H "User-Agent: Mozilla/5.0"`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );
    const match = html.match(/"publishDate":"([^"]+)"/);
    if (match) {
      return match[1].slice(0, 10); // YYYY-MM-DD
    }
  } catch (e) {
    console.error('Could not fetch publish date:', e.message);
  }
  // Fallback to today
  return new Date().toISOString().slice(0, 10);
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function fetchTranscriptFromYouTube(videoId, { rss, title } = {}) {
  // Use multi-strategy TypeScript fetcher: YouTube API → RSS+Cartesia STT
  const { execFileSync } = await import('child_process');
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const fetchScript = join(scriptDir, 'fetch-transcript-cartesia.mjs');
  
  const args = [fetchScript, videoId];
  if (rss) args.push('--rss', rss);
  if (title) args.push('--title', title);
  
  const result = execFileSync('node', args, { 
    encoding: 'utf8',
    timeout: 1800000, // 30 min for long episodes
    stdio: ['pipe', 'pipe', 'inherit']
  });
  
  const fullText = result.trim();
  if (!fullText || fullText.length < 50) {
    throw new Error('Failed to extract transcript - content too short');
  }
  return fullText;
}

function chunkText(text, chunkSize = CHUNK_SIZE) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentSize += word.length + 1;

    if (currentSize >= chunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentSize = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

async function callLLM(model, systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable required');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function summarizeChunk(chunk, chunkNum, totalChunks) {
  const systemPrompt = `You are a knowledge extraction assistant. Extract key insights from podcast/video transcript chunks.`;

  const userPrompt = `Summarize this transcript chunk (${chunkNum}/${totalChunks}). Extract:
- Key insights and arguments
- Actionable takeaways
- Notable quotes (exact words in quotes)
- Any frameworks or models mentioned

Keep it concise (~300 words).

TRANSCRIPT CHUNK:
${chunk}`;

  return await callLLM(MODEL_CHUNK, systemPrompt, userPrompt);
}

async function createFinalSummary(chunkSummaries, metadata) {
  const systemPrompt = `You are creating episode summaries for a knowledge base. Output clean markdown.`;

  const combinedSummaries = chunkSummaries
    .map((s, i) => `### Chunk ${i + 1}\n${s}`)
    .join('\n\n');

  const userPrompt = `Create a final episode summary from these chunk summaries.

METADATA:
- Video ID: ${metadata.videoId}
- Title: ${metadata.title || 'Unknown'}
- Source: ${metadata.source}
- Published: ${metadata.publishDate}

CHUNK SUMMARIES:
${combinedSummaries}

OUTPUT FORMAT:
---
source: ${metadata.source}
episode: ${metadata.videoId}
title: "${metadata.title || 'Unknown'}"
guest: [Extract from content]
date: ${metadata.publishDate}
themes: [list, relevant, themes]
generated: ${new Date().toISOString()}
sources:
  - raw/${metadata.filePrefix}.md
---

# [Title]

[1 sentence about guest/speaker]

## Core Thesis
[Main argument in 2-3 sentences]

## Key Insights
- Insight 1
- Insight 2
...

## Actionable Takeaways
1. Action 1
2. Action 2
...

## Notable Quotes
> "Quote 1"
> "Quote 2"

## Relevance to Wilde Agency
- [Business application]`;

  return await callLLM(MODEL_FINAL, systemPrompt, userPrompt);
}

async function ingestEpisode(options) {
  const { videoId, source, title, workspace } = options;

  if (!videoId || !source) {
    console.error('Usage: node ingest-episode.mjs <video-id> <source-name> [--title="..."] [--workspace=/path]');
    process.exit(1);
  }

  // Determine workspace base
  const workspaceBase = workspace || getWorkspaceBase();

  // Fetch publish date first
  console.error(`[0/4] Fetching publish date for ${videoId}...`);
  const publishDate = fetchPublishDate(videoId);
  console.error(`  → Published: ${publishDate}`);

  const slug = title ? slugify(title) : videoId;
  const filePrefix = `${publishDate}-${videoId}-${slug}`;
  const sourceDir = join(workspaceBase, source);
  const rawDir = join(sourceDir, 'raw');
  const summaryDir = join(sourceDir, 'summaries', 'episodes');

  // Ensure directories exist
  [rawDir, summaryDir].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  // 1. Fetch transcript (multi-strategy: YouTube API → Tor → RSS+Whisper)
  console.error(`[1/4] Fetching transcript for ${videoId}...`);
  // Load RSS from source config if available
  const configPath = join(sourceDir, 'config.yaml');
  let rssUrl = null;
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf8');
    const rssMatch = configContent.match(/rss:\s*(.+)/);
    if (rssMatch) rssUrl = rssMatch[1].trim();
  }
  const fullText = await fetchTranscriptFromYouTube(videoId, { rss: rssUrl, title });

  console.error(`  → ${fullText.length} chars, ~${Math.round(fullText.length / 4)} tokens`);

  // 2. Save raw transcript
  const rawPath = join(rawDir, `${filePrefix}.md`);
  writeFileSync(rawPath, `# ${title || videoId}\n\nPublished: ${publishDate}\n\n${fullText}`);
  console.error(`[2/4] Saved raw transcript: ${rawPath}`);

  // 3. Chunk and summarize
  const chunks = chunkText(fullText);
  console.error(`[3/4] Summarizing ${chunks.length} chunks with ${MODEL_CHUNK}...`);

  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    console.error(`  → Chunk ${i + 1}/${chunks.length}...`);
    const summary = await summarizeChunk(chunks[i], i + 1, chunks.length);
    chunkSummaries.push(summary);
  }

  // 4. Create final summary
  console.error(`[4/4] Creating final summary with ${MODEL_FINAL}...`);
  const finalSummary = await createFinalSummary(chunkSummaries, {
    videoId,
    source,
    title,
    slug,
    publishDate,
    filePrefix
  });

  const summaryPath = join(summaryDir, `${filePrefix}.md`);
  writeFileSync(summaryPath, finalSummary);
  console.error(`  → Saved: ${summaryPath}`);

  console.log(summaryPath); // Output path to stdout for scripting
}

// CLI
const args = process.argv.slice(2);
const options = parseArgs(args);
ingestEpisode(options).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
