#!/usr/bin/env node
/**
 * Multi-strategy transcript fetcher (TypeScript/Node)
 * Tries in order:
 *   1. YouTube transcript API (via Python, direct)
 *   2. Podcast RSS → download audio → Cartesia Ink STT (batch)
 * 
 * Usage:
 *   node fetch-transcript-cartesia.mjs <video_id> [--rss <url>] [--title <title>] [--output <file>]
 * 
 * Environment:
 *   CARTESIA_API_KEY - Required for Cartesia STT fallback
 */

import { execFileSync, execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for Cartesia (generous)

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { videoId: null, rss: null, title: null, output: null };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rss' && args[i + 1]) result.rss = args[++i];
    else if (args[i] === '--title' && args[i + 1]) result.title = args[++i];
    else if (args[i] === '--output' && args[i + 1]) result.output = args[++i];
    else if (!args[i].startsWith('--')) result.videoId = args[i];
  }
  return result;
}

function tryYouTubeDirect(videoId) {
  try {
    console.error('  [1] Trying YouTube transcript API (direct)...');
    const result = execFileSync('python3', ['-c', `
from youtube_transcript_api import YouTubeTranscriptApi
api = YouTubeTranscriptApi()
t = api.fetch('${videoId}')
text = '\\n'.join([s.text for s in t.snippets])
print(text)
`], { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
    
    if (result.trim().length > 50) {
      console.error(`  [1] Success! ${result.trim().length} chars`);
      return result.trim();
    }
  } catch (e) {
    console.error(`  [1] Failed: ${e.message?.split('\n')[0] || 'unknown'}`);
  }
  return null;
}

async function findPodcastAudio(rssUrl, title) {
  try {
    console.error(`  [2] Searching RSS for: ${title?.substring(0, 60)}...`);
    const response = await fetch(rssUrl, { signal: AbortSignal.timeout(15000) });
    const xml = await response.text();
    
    // Simple XML parsing for RSS items
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
      const encMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"/);
      if (titleMatch && encMatch) {
        items.push({ title: titleMatch[1], url: encMatch[1] });
      }
    }
    
    if (!title || items.length === 0) {
      // Return latest episode if no title to match
      if (items.length > 0) {
        console.error(`  [2] No title to match, using latest: ${items[0].title.substring(0, 60)}`);
        return items[0].url;
      }
      return null;
    }
    
    // Fuzzy match
    const titleWords = new Set(title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
    let bestMatch = null;
    let bestScore = 0;
    
    for (const item of items) {
      const itemWords = new Set(item.title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
      const intersection = new Set([...titleWords].filter(w => itemWords.has(w)));
      const union = new Set([...titleWords, ...itemWords]);
      const score = intersection.size / union.size;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
    
    if (bestMatch && bestScore > 0.25) {
      console.error(`  [2] Found match (${Math.round(bestScore * 100)}%): ${bestMatch.title.substring(0, 60)}`);
      return bestMatch.url;
    }
    
    console.error(`  [2] No good match (best: ${Math.round(bestScore * 100)}%)`);
    return null;
  } catch (e) {
    console.error(`  [2] RSS search failed: ${e.message}`);
    return null;
  }
}

async function transcribeWithCartesia(audioUrl) {
  if (!CARTESIA_API_KEY) {
    console.error('  [2] ERROR: CARTESIA_API_KEY not set');
    return null;
  }
  
  const tmpDir = join(tmpdir(), `knowledge-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const rawPath = join(tmpDir, 'audio.mp3');
  const compressedPath = join(tmpDir, 'compressed.mp3');
  
  try {
    // Download
    console.error('  [2] Downloading audio...');
    execFileSync('curl', ['-sL', '-o', rawPath, audioUrl], { timeout: 180000 });
    const { size } = await import('fs').then(fs => fs.statSync(rawPath));
    console.error(`  [2] Downloaded: ${(size / 1024 / 1024).toFixed(1)}MB`);
    
    // Compress to mono 64kbps for smaller uploads
    console.error('  [2] Compressing...');
    execFileSync('ffmpeg', ['-y', '-i', rawPath, '-acodec', 'libmp3lame',
      '-ab', '64k', '-ar', '16000', '-ac', '1', compressedPath], 
      { timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] });
    
    const compSize = (await import('fs')).statSync(compressedPath).size;
    console.error(`  [2] Compressed: ${(compSize / 1024 / 1024).toFixed(1)}MB`);
    
    // Cartesia batch STT supports arbitrarily long files
    console.error('  [2] Transcribing with Cartesia Ink...');
    const result = execFileSync('curl', [
      '-s', '-X', 'POST', 'https://api.cartesia.ai/stt',
      '-H', 'Cartesia-Version: 2025-04-16',
      '-H', `X-API-Key: ${CARTESIA_API_KEY}`,
      '-F', `file=@${compressedPath}`,
      '-F', 'model=ink-whisper',
      '-F', 'language=en'
    ], { encoding: 'utf8', timeout: 600000 }); // 10 min for long episodes
    
    const data = JSON.parse(result);
    if (data.text) {
      console.error(`  [2] Success! ${data.text.length} chars, ${data.duration}s duration`);
      return data.text;
    } else {
      console.error(`  [2] Cartesia error: ${JSON.stringify(data).substring(0, 200)}`);
      return null;
    }
  } catch (e) {
    console.error(`  [2] Transcription failed: ${e.message?.substring(0, 200)}`);
    return null;
  } finally {
    // Cleanup
    try { unlinkSync(rawPath); } catch {}
    try { unlinkSync(compressedPath); } catch {}
    try { (await import('fs')).rmdirSync(tmpDir); } catch {}
  }
}

async function main() {
  const { videoId, rss, title, output } = parseArgs();
  
  if (!videoId) {
    console.error('Usage: fetch-transcript-cartesia.mjs <video_id> [--rss <url>] [--title <title>] [--output <file>]');
    process.exit(1);
  }
  
  console.error(`Fetching transcript for ${videoId}...`);
  
  // Strategy 1: YouTube transcript (direct)
  let text = tryYouTubeDirect(videoId);
  
  // Strategy 2: RSS + Cartesia STT
  if (!text && rss) {
    const audioUrl = await findPodcastAudio(rss, title);
    if (audioUrl) {
      text = await transcribeWithCartesia(audioUrl);
    }
  }
  
  if (!text) {
    console.error('ERROR: All transcript strategies failed');
    process.exit(1);
  }
  
  if (output) {
    writeFileSync(output, text);
    console.error(`Saved to ${output} (${text.length} chars)`);
  } else {
    process.stdout.write(text);
  }
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
