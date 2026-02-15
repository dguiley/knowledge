#!/usr/bin/env node
/**
 * YouTube Transcript Fetcher
 * Uses youtube-transcript.io via Playwright to bypass YouTube bot detection
 *
 * Usage:
 *   node fetch-transcript.mjs <url-or-video-id> [output-file]
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

function extractVideoId(input) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input;
}

async function fetchTranscript(input, outputFile) {
  const videoId = extractVideoId(input);
  console.error(`Fetching transcript for video: ${videoId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const url = `https://www.youtube-transcript.io/?v=${videoId}`;
    console.error(`Loading ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for transcript to load (look for timestamp pattern in main content)
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      return main && /\d{2}:\d{2}/.test(main.innerText);
    }, { timeout: 30000 });

    // Extract transcript text
    const fullText = await page.evaluate(() => {
      const main = document.querySelector('main');
      const text = main.innerText;
      const lines = text.split('\n');
      const transcriptLines = [];
      let inTranscript = false;

      for (const line of lines) {
        if (/^\d{2}:\d{2}/.test(line)) {
          inTranscript = true;
          continue; // Skip timestamp lines
        }
        if (inTranscript && line.trim()) {
          // Stop if we hit non-transcript content
          if (line.startsWith('Word Count:') || line.startsWith('Autoscroll')) break;
          transcriptLines.push(line.trim());
        }
      }

      return transcriptLines.join(' ').replace(/\s+/g, ' ').trim();
    });

    if (!fullText || fullText.length < 50) {
      throw new Error('Failed to extract transcript - content too short');
    }

    if (outputFile) {
      writeFileSync(outputFile, fullText);
      console.error(`Transcript saved to: ${outputFile}`);
    } else {
      console.log(fullText);
    }

    console.error(`\nStats: ${fullText.length} characters, ~${Math.round(fullText.split(' ').length)} words`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node fetch-transcript.mjs <youtube-url-or-id> [output-file]');
  process.exit(1);
}

fetchTranscript(args[0], args[1]);
