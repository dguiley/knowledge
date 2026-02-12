#!/usr/bin/env node
/**
 * YouTube Video List Fetcher
 * Fetches video list from a YouTube channel page OR playlist
 *
 * Usage:
 *   node fetch-channel-videos.mjs <url> [--min-duration=30] [--limit=20] [--json]
 *
 *   # Channel example:
 *   node fetch-channel-videos.mjs "https://youtube.com/@TheDiaryOfACEO/videos"
 *
 *   # Playlist example:
 *   node fetch-channel-videos.mjs "https://youtube.com/playlist?list=PLtQ-jBytlXCYhs6Af0AxrMOeK8QqzBk5x"
 */

import { execSync } from 'child_process';

function parseArgs(args) {
  const options = {
    url: null,
    minDuration: 30,  // minutes
    limit: 20,
    json: false
  };

  for (const arg of args) {
    if (arg.startsWith('--min-duration=')) {
      options.minDuration = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('http')) {
      options.url = arg;
    }
  }

  return options;
}

function parseDuration(lengthText) {
  if (!lengthText) return 0;
  const parts = lengthText.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]);
  }
  return 0;
}

function isPlaylistUrl(url) {
  return url.includes('/playlist?list=') || url.includes('&list=');
}

function extractYtInitialData(html) {
  const startMarker = 'var ytInitialData = ';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('Could not find ytInitialData in page');
  }

  let braceCount = 0;
  let jsonStart = startIdx + startMarker.length;
  let jsonEnd = jsonStart;

  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') braceCount++;
    if (html[i] === '}') braceCount--;
    if (braceCount === 0 && i > jsonStart) {
      jsonEnd = i + 1;
      break;
    }
  }

  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function parseChannelVideos(data, minDuration) {
  const episodes = [];
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

  for (const tab of tabs) {
    const contents = tab?.tabRenderer?.content?.richGridRenderer?.contents || [];

    for (const item of contents) {
      const video = item?.richItemRenderer?.content?.videoRenderer;
      if (video) {
        const vid = video.videoId || '';
        const title = video.title?.runs?.[0]?.text || '';
        const lengthText = video.lengthText?.simpleText || '';
        const totalMins = parseDuration(lengthText);

        if (vid && title && totalMins >= minDuration) {
          episodes.push({
            id: vid,
            url: `https://youtube.com/watch?v=${vid}`,
            title,
            duration: lengthText,
            durationMins: totalMins
          });
        }
      }
    }
  }

  return episodes;
}

function parsePlaylistVideos(data, minDuration) {
  const episodes = [];
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

  for (const tab of tabs) {
    const sectionContents = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    for (const section of sectionContents) {
      const itemContents = section?.itemSectionRenderer?.contents || [];

      for (const item of itemContents) {
        const playlistVideos = item?.playlistVideoListRenderer?.contents || [];

        for (const pv of playlistVideos) {
          const video = pv?.playlistVideoRenderer;
          if (video) {
            const vid = video.videoId || '';
            const title = video.title?.runs?.[0]?.text || '';
            const lengthText = video.lengthText?.simpleText || '';
            const totalMins = parseDuration(lengthText);

            if (vid && title && totalMins >= minDuration) {
              episodes.push({
                id: vid,
                url: `https://youtube.com/watch?v=${vid}`,
                title,
                duration: lengthText,
                durationMins: totalMins
              });
            }
          }
        }
      }
    }
  }

  return episodes;
}

async function fetchVideos(options) {
  if (!options.url) {
    console.error('Usage: node fetch-channel-videos.mjs <url> [--min-duration=30] [--limit=20] [--json]');
    console.error('  Supports both channel URLs and playlist URLs');
    process.exit(1);
  }

  let url = options.url;
  const isPlaylist = isPlaylistUrl(url);

  // For channel URLs, ensure /videos suffix
  if (!isPlaylist && !url.endsWith('/videos')) {
    url = url.replace(/\/$/, '') + '/videos';
  }

  // Ensure www prefix for YouTube (only if not already present)
  if (!url.includes('www.youtube.com')) {
    url = url.replace('youtube.com/', 'www.youtube.com/');
  }

  const urlType = isPlaylist ? 'playlist' : 'channel';
  console.error(`Fetching ${urlType}: ${url}`);

  // Fetch the page
  const curlCmd = `curl -s "${url}" -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -H "Accept-Language: en-US,en;q=0.9"`;
  const html = execSync(curlCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  let data;
  try {
    data = extractYtInitialData(html);
  } catch (e) {
    console.error('Failed to parse page:', e.message);
    process.exit(1);
  }

  // Parse based on URL type
  const episodes = isPlaylist
    ? parsePlaylistVideos(data, options.minDuration)
    : parseChannelVideos(data, options.minDuration);

  // Apply limit
  const limited = episodes.slice(0, options.limit);

  console.error(`Found ${episodes.length} episodes >= ${options.minDuration} min, returning ${limited.length}`);

  if (options.json) {
    console.log(JSON.stringify(limited, null, 2));
  } else {
    for (const ep of limited) {
      console.log(`${ep.id} | ${ep.duration} | ${ep.title}`);
    }
  }

  return limited;
}

// CLI
const args = process.argv.slice(2);
const options = parseArgs(args);
fetchVideos(options);
