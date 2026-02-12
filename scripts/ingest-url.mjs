#!/usr/bin/env node
/**
 * One-off URL Ingestion Script
 * Ingests a single URL into the knowledge base
 *
 * Usage:
 *   node ingest-url.mjs <url> [--source=misc] [--title="Custom Title"]
 *
 * Supported URL types:
 *   - YouTube videos: Extracts transcript and summarizes
 *   - Web pages: Fetches content and creates knowledge entry (basic support)
 *
 * Environment:
 *   OPENAI_API_KEY - Required for summarization
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Load .env
function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env');
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

function parseArgs(args) {
  const options = {
    url: null,
    source: 'misc',
    title: null
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--title=')) {
      options.title = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('http')) {
      options.url = arg;
    }
  }

  return options;
}

function detectUrlType(url) {
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    return 'youtube';
  }
  return 'webpage';
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function ingestYouTube(url, options) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error('Could not extract video ID from URL');
    process.exit(1);
  }

  console.log(`Ingesting YouTube video: ${videoId}`);

  const scriptPath = join(__dirname, 'ingest-episode.mjs');
  const sourceBase = join(PROJECT_ROOT, 'source');

  const titleArg = options.title ? `--title="${options.title.replace(/"/g, '\\"')}"` : '';

  try {
    execSync(
      `node "${scriptPath}" "${videoId}" "${options.source}" ${titleArg} --workspace="${sourceBase}"`,
      {
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
        timeout: 300000
      }
    );
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
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
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function ingestWebpage(url, options) {
  console.log(`Ingesting webpage: ${url}`);

  // Fetch page content
  let html;
  try {
    html = execSync(
      `curl -sL "${url}" -H "User-Agent: Mozilla/5.0" --max-time 30`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );
  } catch (e) {
    console.error('Could not fetch URL:', e.message);
    process.exit(1);
  }

  // Extract title if not provided
  let title = options.title;
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : 'Untitled';
  }

  // Strip HTML to get text content (basic extraction)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000);  // Limit content

  if (textContent.length < 100) {
    console.error('Could not extract meaningful content from page');
    process.exit(1);
  }

  console.log(`Extracted ${textContent.length} chars, summarizing...`);

  // Summarize with LLM
  const summary = await callLLM('gpt-4o',
    'You are a knowledge extraction assistant. Create structured knowledge entries from web content.',
    `Summarize this webpage for a knowledge base.

URL: ${url}
TITLE: ${title}

CONTENT:
${textContent}

OUTPUT FORMAT:
---
source: ${options.source}
url: ${url}
title: "${title}"
date: ${new Date().toISOString().slice(0, 10)}
type: webpage
---

# ${title}

## Summary
[2-3 sentence overview]

## Key Points
- Point 1
- Point 2
...

## Actionable Takeaways
1. Takeaway 1
2. Takeaway 2
...`
  );

  // Save to source directory
  const slug = slugify(title);
  const date = new Date().toISOString().slice(0, 10);
  const sourceDir = join(PROJECT_ROOT, 'source', options.source);
  const summaryDir = join(sourceDir, 'summaries', 'webpages');

  mkdirSync(summaryDir, { recursive: true });

  const filename = `${date}-${slug}.md`;
  const filepath = join(summaryDir, filename);

  writeFileSync(filepath, summary);
  console.log(`Saved: ${filepath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.url) {
    console.error('Usage: node ingest-url.mjs <url> [--source=misc] [--title="..."]');
    console.error('\nExamples:');
    console.error('  node ingest-url.mjs https://youtube.com/watch?v=xxx');
    console.error('  node ingest-url.mjs https://example.com/article --source=research');
    process.exit(1);
  }

  const urlType = detectUrlType(options.url);

  // Ensure source directory exists
  const sourceDir = join(PROJECT_ROOT, 'source', options.source);
  if (!existsSync(sourceDir)) {
    mkdirSync(sourceDir, { recursive: true });
    console.log(`Created source directory: ${options.source}`);
  }

  if (urlType === 'youtube') {
    await ingestYouTube(options.url, options);
  } else {
    await ingestWebpage(options.url, options);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
