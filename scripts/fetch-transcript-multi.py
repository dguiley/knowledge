#!/usr/bin/env python3
"""
Multi-strategy YouTube/Podcast transcript fetcher.
Tries in order:
  1. YouTube transcript API (direct) — free, fast
  2. YouTube transcript API (via Tor) — free, slower  
  3. Podcast RSS audio + Whisper API — costs ~$0.006/min

Usage: 
  python3 fetch-transcript-multi.py <video_id_or_url> <output_file> [--rss <rss_url>] [--title <title>]
"""

import sys
import os
import subprocess
import tempfile
import math
import argparse
import re
import xml.etree.ElementTree as ET
from urllib.request import urlopen

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MAX_CHUNK_SIZE = 24 * 1024 * 1024


def extract_video_id(input_str):
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for p in patterns:
        m = re.search(p, input_str)
        if m:
            return m.group(1)
    return input_str


def try_youtube_direct(video_id):
    """Strategy 1: Direct YouTube transcript API."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        print("  [1] Trying YouTube transcript API (direct)...", file=sys.stderr)
        api = YouTubeTranscriptApi()
        t = api.fetch(video_id)
        text = '\n'.join([s.text for s in t.snippets])
        print(f"  [1] Success! {len(text)} chars", file=sys.stderr)
        return text
    except Exception as e:
        print(f"  [1] Failed: {e.__class__.__name__}", file=sys.stderr)
        return None


def try_youtube_tor(video_id):
    """Strategy 2: YouTube transcript via Tor."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api.proxies import GenericProxyConfig
        
        print("  [2] Trying YouTube transcript API (Tor)...", file=sys.stderr)
        proxy = GenericProxyConfig(
            http_url='socks5h://127.0.0.1:9050',
            https_url='socks5h://127.0.0.1:9050'
        )
        api = YouTubeTranscriptApi(proxy_config=proxy)
        t = api.fetch(video_id)
        text = '\n'.join([s.text for s in t.snippets])
        print(f"  [2] Success! {len(text)} chars", file=sys.stderr)
        return text
    except Exception as e:
        print(f"  [2] Failed: {e.__class__.__name__}", file=sys.stderr)
        return None


def find_podcast_audio(rss_url, title):
    """Find matching episode audio URL in podcast RSS feed."""
    try:
        print(f"  [3] Searching RSS feed for: {title[:60]}...", file=sys.stderr)
        response = urlopen(rss_url, timeout=15)
        tree = ET.parse(response)
        root = tree.getroot()
        
        # Normalize title for fuzzy matching
        title_words = set(re.sub(r'[^\w\s]', '', title.lower()).split())
        
        best_match = None
        best_score = 0
        
        for item in root.findall('.//item'):
            ep_title_el = item.find('title')
            if ep_title_el is None or ep_title_el.text is None:
                continue
            ep_title = ep_title_el.text
            ep_words = set(re.sub(r'[^\w\s]', '', ep_title.lower()).split())
            
            # Jaccard similarity
            if len(title_words | ep_words) > 0:
                score = len(title_words & ep_words) / len(title_words | ep_words)
            else:
                score = 0
            
            if score > best_score:
                best_score = score
                enc = item.find('enclosure')
                if enc is not None:
                    best_match = (ep_title, enc.get('url'), score)
        
        if best_match and best_match[2] > 0.3:
            print(f"  [3] Found match ({best_match[2]:.0%}): {best_match[0][:60]}", file=sys.stderr)
            return best_match[1]
        else:
            print(f"  [3] No good match found (best: {best_score:.0%})", file=sys.stderr)
            return None
    except Exception as e:
        print(f"  [3] RSS search failed: {e}", file=sys.stderr)
        return None


def transcribe_with_whisper(audio_url):
    """Download audio and transcribe via OpenAI Whisper API."""
    if not OPENAI_API_KEY:
        print("  [3] ERROR: OPENAI_API_KEY not set", file=sys.stderr)
        return None
    
    with tempfile.TemporaryDirectory() as tmpdir:
        raw_path = os.path.join(tmpdir, "audio.mp3")
        compressed_path = os.path.join(tmpdir, "compressed.mp3")
        
        # Download
        print(f"  [3] Downloading audio...", file=sys.stderr)
        result = subprocess.run(
            ["curl", "-sL", "-o", raw_path, audio_url],
            capture_output=True, timeout=120
        )
        size = os.path.getsize(raw_path)
        print(f"  [3] Downloaded: {size/1024/1024:.1f}MB", file=sys.stderr)
        
        # Compress
        print(f"  [3] Compressing...", file=sys.stderr)
        subprocess.run(
            ["ffmpeg", "-y", "-i", raw_path, "-acodec", "libmp3lame",
             "-ab", "64k", "-ar", "16000", "-ac", "1", compressed_path],
            capture_output=True, timeout=120
        )
        comp_size = os.path.getsize(compressed_path)
        print(f"  [3] Compressed: {comp_size/1024/1024:.1f}MB", file=sys.stderr)
        
        if comp_size <= MAX_CHUNK_SIZE:
            chunks = [compressed_path]
        else:
            # Split into 10-min chunks
            duration = float(subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", raw_path],
                capture_output=True, text=True, timeout=30
            ).stdout.strip())
            
            chunk_dur = 600
            num_chunks = math.ceil(duration / chunk_dur)
            chunks = []
            for i in range(num_chunks):
                cp = os.path.join(tmpdir, f"chunk_{i:03d}.mp3")
                subprocess.run(
                    ["ffmpeg", "-y", "-i", raw_path, "-ss", str(i * chunk_dur),
                     "-t", str(chunk_dur), "-acodec", "libmp3lame",
                     "-ab", "64k", "-ar", "16000", "-ac", "1", cp],
                    capture_output=True, timeout=120
                )
                if os.path.exists(cp) and os.path.getsize(cp) > 0:
                    chunks.append(cp)
        
        # Transcribe each chunk
        texts = []
        for i, chunk in enumerate(chunks):
            print(f"  [3] Transcribing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
            result = subprocess.run(
                ["curl", "-s", "https://api.openai.com/v1/audio/transcriptions",
                 "-H", f"Authorization: Bearer {OPENAI_API_KEY}",
                 "-F", f"file=@{chunk}",
                 "-F", "model=whisper-1",
                 "-F", "response_format=text"],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0 and result.stdout.strip():
                texts.append(result.stdout.strip())
            else:
                print(f"  [3] Whisper failed on chunk {i}: {result.stderr[:200]}", file=sys.stderr)
        
        if texts:
            text = "\n\n".join(texts)
            print(f"  [3] Success! {len(text)} chars via Whisper", file=sys.stderr)
            return text
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_id", help="YouTube video ID or URL")
    parser.add_argument("output", nargs="?", help="Output file path")
    parser.add_argument("--rss", help="Podcast RSS URL for audio fallback")
    parser.add_argument("--title", help="Episode title for RSS matching")
    parser.add_argument("--audio-url", help="Direct audio URL (skip RSS search)")
    args = parser.parse_args()
    
    video_id = extract_video_id(args.video_id)
    print(f"Fetching transcript for {video_id}...", file=sys.stderr)
    
    # Strategy 1: Direct YouTube
    text = try_youtube_direct(video_id)
    
    # Strategy 2: YouTube via Tor
    if text is None:
        text = try_youtube_tor(video_id)
    
    # Strategy 3: Podcast RSS + Whisper
    if text is None and (args.rss or args.audio_url):
        audio_url = args.audio_url
        if not audio_url and args.rss and args.title:
            audio_url = find_podcast_audio(args.rss, args.title)
        
        if audio_url:
            text = transcribe_with_whisper(audio_url)
    
    if text is None:
        print("ERROR: All transcript strategies failed", file=sys.stderr)
        sys.exit(1)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(text)
        print(f"Saved to {args.output} ({len(text)} chars)", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
