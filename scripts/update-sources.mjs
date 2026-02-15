#!/usr/bin/env node
/**
 * Update Sources Script
 * Scans all registered sources for new content and auto-ingests new episodes
 *
 * Usage:
 *   node update-sources.mjs [--dry-run] [--source=doac] [--limit=5]
 *
 * Environment:
 *   OPENAI_API_KEY - Required for summarization
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync, spawn } from 'child_process';
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
    dryRun: false,
    source: null,
    limit: 5  // Max new episodes to ingest per source
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    }
  }

  return options;
}

function parseYaml(content) {
  // Simple YAML parser for our registry format
  const result = { defaults: {}, sources: {} };
  let currentSection = null;
  let currentSource = null;
  let currentKey = null;
  let multilineValue = '';
  let inMultiline = false;

  for (const line of content.split('\n')) {
    // Check for multiline end BEFORE skipping comments
    if (inMultiline) {
      // End multiline if we hit a non-indented line (comment, section, or new key)
      const isDeepIndent = line.startsWith('      ') || line.startsWith('\t\t\t');
      const isBlankOrComment = line.trim() === '' || line.trim().startsWith('#');
      const isNewSource = line.match(/^  [a-z0-9-]+:$/i);
      const isNewKey = line.match(/^    [a-z_]+:/i);
      
      if (isNewSource || isNewKey || (isBlankOrComment && !isDeepIndent && line.trim().startsWith('#'))) {
        // End of multiline
        if (currentSection === 'defaults') {
          result.defaults[currentKey] = multilineValue.trim();
        } else if (currentSource) {
          result.sources[currentSource][currentKey] = multilineValue.trim();
        }
        inMultiline = false;
        multilineValue = '';
        // Fall through to process this line
      } else {
        if (!isBlankOrComment) multilineValue += line.replace(/^\s+/, '') + '\n';
        continue;
      }
    }

    // Skip comments and blank lines
    if (line.trim().startsWith('#') || line.trim() === '') {
      continue;
    }

    // Top-level sections
    if (line === 'defaults:') {
      currentSection = 'defaults';
      currentSource = null;
      continue;
    }
    if (line === 'sources:') {
      currentSection = 'sources';
      continue;
    }

    // Source name (2-space indent in sources)
    if (currentSection === 'sources' && line.match(/^  [a-z0-9-]+:$/i)) {
      currentSource = line.trim().replace(':', '');
      result.sources[currentSource] = {};
      continue;
    }

    // Key-value pairs
    const kvMatch = line.match(/^(\s*)([a-z_]+):\s*(.*)$/i);
    if (kvMatch) {
      const [, indent, key, value] = kvMatch;
      currentKey = key;

      // Check for multiline indicator
      if (value === '|') {
        inMultiline = true;
        multilineValue = '';
        continue;
      }

      // Parse value
      let parsedValue = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (value === 'null') parsedValue = null;
      else if (value.match(/^\d+$/)) parsedValue = parseInt(value);
      else if (value.startsWith('[') && value.endsWith(']')) {
        // Simple array
        parsedValue = value.slice(1, -1).split(',').map(s => s.trim());
      }

      if (currentSection === 'defaults') {
        result.defaults[key] = parsedValue;
      } else if (currentSource) {
        result.sources[currentSource][key] = parsedValue;
      }
    }
  }

  return result;
}

function getCompletedVideoIds(queuePath) {
  if (!existsSync(queuePath)) return new Set();

  const content = readFileSync(queuePath, 'utf8');
  const ids = new Set();

  // Parse completed section - look for video IDs in file paths or standalone
  const completedMatch = content.match(/## Completed\n([\s\S]*?)(?=##|$)/);
  if (completedMatch) {
    const lines = completedMatch[1].split('\n');
    for (const line of lines) {
      // Match video IDs in various formats
      // Pattern: 11-char alphanumeric YouTube ID
      const idMatches = line.match(/[a-zA-Z0-9_-]{11}/g);
      if (idMatches) {
        for (const id of idMatches) {
          ids.add(id);
        }
      }
    }
  }

  return ids;
}

function appendToQueue(queuePath, videoId, title, section = 'Completed') {
  let content = '';
  if (existsSync(queuePath)) {
    content = readFileSync(queuePath, 'utf8');
  } else {
    content = `# Queue\n\n## Pending\n\n## Processing\n\n## Completed\n\n`;
  }

  const entry = `- ${videoId} | ${title}\n`;
  const sectionMarker = `## ${section}\n`;
  const sectionIndex = content.indexOf(sectionMarker);

  if (sectionIndex !== -1) {
    const insertPoint = sectionIndex + sectionMarker.length;
    content = content.slice(0, insertPoint) + '\n' + entry + content.slice(insertPoint);
  } else {
    content += `\n${sectionMarker}\n${entry}`;
  }

  writeFileSync(queuePath, content);
}

async function fetchChannelVideos(url, options = {}) {
  const { minDuration = 30, limit = 20 } = options;

  try {
    const scriptPath = join(__dirname, 'fetch-channel-videos.mjs');
    const result = execSync(
      `node "${scriptPath}" "${url}" --min-duration=${minDuration} --limit=${limit} --json`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse JSON from stdout (skip stderr lines)
    const lines = result.split('\n');
    const jsonStart = lines.findIndex(l => l.startsWith('['));
    if (jsonStart === -1) return [];

    const jsonStr = lines.slice(jsonStart).join('\n');
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`  Error fetching videos: ${e.message}`);
    return [];
  }
}

async function ingestEpisode(videoId, sourceName, title, dryRun) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would ingest: ${videoId} - ${title}`);
    return true;
  }

  console.log(`  Ingesting: ${videoId} - ${title}`);

  const scriptPath = join(__dirname, 'ingest-episode.mjs');
  const sourceBase = join(PROJECT_ROOT, 'source');

  try {
    execSync(
      `node "${scriptPath}" "${videoId}" "${sourceName}" --title="${title.replace(/"/g, '\\"')}" --workspace="${sourceBase}"`,
      {
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
        timeout: 1800000  // 30 min timeout per episode (Whisper chunking for long episodes)
      }
    );
    return true;
  } catch (e) {
    console.error(`  Error ingesting ${videoId}: ${e.message}`);
    return false;
  }
}

async function updateSource(sourceName, sourceConfig, options) {
  const { dryRun, limit } = options;

  console.log(`\n=== ${sourceConfig.name || sourceName} ===`);

  const sourceDir = join(PROJECT_ROOT, 'source', sourceName);
  const queuePath = join(sourceDir, 'queue.md');

  // Get completed video IDs
  const completedIds = getCompletedVideoIds(queuePath);
  console.log(`  ${completedIds.size} previously completed episodes`);

  // Fetch latest videos
  const lookback = sourceConfig.lookback || 30;
  const videos = await fetchChannelVideos(sourceConfig.url, {
    minDuration: 30,
    limit: lookback
  });

  if (videos.length === 0) {
    console.log(`  No videos found`);
    return { ingested: 0, skipped: 0 };
  }

  console.log(`  Found ${videos.length} episodes (>30 min)`);

  // Find new videos
  const newVideos = videos.filter(v => !completedIds.has(v.id));
  console.log(`  ${newVideos.length} new episodes to process`);

  if (newVideos.length === 0) {
    return { ingested: 0, skipped: 0 };
  }

  // Limit and process
  const toProcess = newVideos.slice(0, limit);
  let ingested = 0;
  let skipped = 0;

  for (const video of toProcess) {
    const success = await ingestEpisode(video.id, sourceName, video.title, dryRun);
    if (success) {
      ingested++;
      if (!dryRun) {
        appendToQueue(queuePath, video.id, video.title);
      }
    } else {
      skipped++;
    }
  }

  return { ingested, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('Knowledge Source Update');
  console.log('=======================');
  if (options.dryRun) console.log('[DRY RUN MODE]');

  // Load registry
  const registryPath = join(PROJECT_ROOT, 'source', 'registry.yaml');
  if (!existsSync(registryPath)) {
    console.error('No source/registry.yaml found');
    process.exit(1);
  }

  const registryContent = readFileSync(registryPath, 'utf8');
  const registry = parseYaml(registryContent);

  // Filter sources if specified
  let sourcesToProcess = Object.entries(registry.sources);
  if (options.source) {
    sourcesToProcess = sourcesToProcess.filter(([name]) => name === options.source);
    if (sourcesToProcess.length === 0) {
      console.error(`Source "${options.source}" not found in registry`);
      process.exit(1);
    }
  }

  // Filter to YouTube sources only (for now)
  sourcesToProcess = sourcesToProcess.filter(([, config]) => {
    const type = config.type || registry.defaults.type || 'youtube';
    return type === 'youtube' || type === 'youtube-playlist';
  });

  console.log(`\nProcessing ${sourcesToProcess.length} YouTube sources...`);

  let totalIngested = 0;
  let totalSkipped = 0;

  for (const [name, config] of sourcesToProcess) {
    try {
      const result = await updateSource(name, config, options);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;
    } catch (e) {
      console.error(`  Error processing ${name}: ${e.message}`);
    }
  }

  console.log('\n=======================');
  console.log(`Complete: ${totalIngested} ingested, ${totalSkipped} skipped`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
