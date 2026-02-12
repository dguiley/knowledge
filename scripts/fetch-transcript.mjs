#!/usr/bin/env node
/**
 * YouTube Transcript Fetcher
 * Extracts transcripts from YouTube videos using yt-dlp
 *
 * Usage:
 *   node fetch-transcript.mjs <url-or-video-id> [output-file]
 *   node fetch-transcript.mjs https://www.youtube.com/watch?v=tVLnzcoM5LE
 *   node fetch-transcript.mjs tVLnzcoM5LE my-transcript.txt
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function extractVideoId(input) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input;
}

function parseVTT(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  let lastText = '';

  for (const line of lines) {
    // Skip headers, timestamps, and empty lines
    if (line.startsWith('WEBVTT') ||
        line.startsWith('Kind:') ||
        line.startsWith('Language:') ||
        line.includes('-->') ||
        line.includes('align:') ||
        line.trim() === '') {
      continue;
    }

    // Remove VTT timing tags like <00:00:00.560><c>
    let cleanLine = line
      .replace(/<[^>]+>/g, '')
      .trim();

    // Skip duplicate lines (VTT often repeats)
    if (cleanLine && cleanLine !== lastText) {
      textLines.push(cleanLine);
      lastText = cleanLine;
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

async function fetchTranscript(input, outputFile) {
  const videoId = extractVideoId(input);
  console.error(`Fetching transcript for video: ${videoId}`);

  const tempDir = tmpdir();
  const tempBase = join(tempDir, `yt-transcript-${videoId}`);
  const vttFile = `${tempBase}.en.vtt`;

  try {
    // Use yt-dlp to fetch subtitles
    execSync(
      `yt-dlp --write-auto-sub --skip-download --sub-lang en -o "${tempBase}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`,
      { encoding: 'utf8', timeout: 60000 }
    );

    // Check if VTT file was created
    if (!existsSync(vttFile)) {
      // Try without language specification
      const files = execSync(`ls ${tempBase}*.vtt 2>/dev/null || true`, { encoding: 'utf8' });
      if (!files.trim()) {
        throw new Error('No subtitles available for this video');
      }
      // Use first available subtitle file
      const availableVtt = files.trim().split('\n')[0];
      if (availableVtt) {
        const vttContent = readFileSync(availableVtt, 'utf8');
        const fullText = parseVTT(vttContent);
        unlinkSync(availableVtt);

        if (outputFile) {
          writeFileSync(outputFile, fullText);
          console.error(`Transcript saved to: ${outputFile}`);
        } else {
          console.log(fullText);
        }
        console.error(`\nStats: ${fullText.length} characters, ~${Math.round(fullText.split(' ').length)} words`);
        return;
      }
      throw new Error('No subtitles available for this video');
    }

    const vttContent = readFileSync(vttFile, 'utf8');
    const fullText = parseVTT(vttContent);

    // Clean up temp file
    unlinkSync(vttFile);

    if (outputFile) {
      writeFileSync(outputFile, fullText);
      console.error(`Transcript saved to: ${outputFile}`);
    } else {
      console.log(fullText);
    }

    console.error(`\nStats: ${fullText.length} characters, ~${Math.round(fullText.split(' ').length)} words`);

  } catch (error) {
    // Clean up any temp files
    try { unlinkSync(vttFile); } catch {}
    console.error('Error:', error.message);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node fetch-transcript.mjs <youtube-url-or-id> [output-file]');
  process.exit(1);
}

fetchTranscript(args[0], args[1]);
