#!/usr/bin/env python3
"""
YouTube Transcript Fetcher with Tor proxy rotation.
Rotates Tor circuits on failure and retries.

Usage: python3 fetch-transcript-tor.py <video_id> [output_file]
"""

import sys
import os
import time
import socket
import struct
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig

TOR_SOCKS_PORT = 9050
TOR_CONTROL_PORT = 9051
MAX_RETRIES = 5


def new_tor_identity():
    """Request new Tor circuit via control port."""
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect("/run/tor/control")
        s.send(b'AUTHENTICATE ""\r\n')
        resp = s.recv(256)
        s.send(b"SIGNAL NEWNYM\r\n")
        resp = s.recv(256)
        s.close()
        time.sleep(3)  # Wait for new circuit
        return True
    except Exception as e:
        print(f"  Warning: Could not rotate Tor circuit: {e}", file=sys.stderr)
        return False


def fetch_with_tor(video_id):
    """Try fetching transcript through Tor, rotating circuits on failure."""
    proxy = GenericProxyConfig(
        http_url=f'socks5h://127.0.0.1:{TOR_SOCKS_PORT}',
        https_url=f'socks5h://127.0.0.1:{TOR_SOCKS_PORT}'
    )
    
    for attempt in range(MAX_RETRIES):
        try:
            print(f"  Attempt {attempt + 1}/{MAX_RETRIES} via Tor...", file=sys.stderr)
            api = YouTubeTranscriptApi(proxy_config=proxy)
            transcript = api.fetch(video_id)
            text = '\n'.join([s.text for s in transcript.snippets])
            return text
        except Exception as e:
            print(f"  Failed: {e.__class__.__name__}", file=sys.stderr)
            if attempt < MAX_RETRIES - 1:
                print("  Rotating Tor circuit...", file=sys.stderr)
                new_tor_identity()
    
    return None


def fetch_direct(video_id):
    """Try direct fetch (works on non-cloud IPs)."""
    try:
        print("  Trying direct fetch...", file=sys.stderr)
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        text = '\n'.join([s.text for s in transcript.snippets])
        return text
    except Exception as e:
        print(f"  Direct failed: {e.__class__.__name__}", file=sys.stderr)
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: fetch-transcript-tor.py <video_id> [output_file]", file=sys.stderr)
        sys.exit(1)
    
    video_id = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"Fetching transcript for {video_id}...", file=sys.stderr)
    
    # Try direct first (fast path)
    text = fetch_direct(video_id)
    
    # Try Tor with rotation
    if text is None:
        text = fetch_with_tor(video_id)
    
    if text is None:
        print("ERROR: All methods failed", file=sys.stderr)
        sys.exit(1)
    
    if output_file:
        with open(output_file, 'w') as f:
            f.write(text)
        print(f"Saved to {output_file} ({len(text)} chars)", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
