#!/usr/bin/env python3
"""
Transcript fetcher using OpenAI Whisper API.
Downloads audio from URL, chunks if >25MB, transcribes via Whisper.

Usage: python3 fetch-transcript-whisper.py <audio_url> [output_file]
"""

import sys
import os
import subprocess
import tempfile
import math

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MAX_CHUNK_SIZE = 24 * 1024 * 1024  # 24MB to be safe


def download_audio(url, output_path):
    """Download audio file."""
    print(f"  Downloading audio...", file=sys.stderr)
    result = subprocess.run(
        ["curl", "-sL", "-o", output_path, url],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise Exception(f"Download failed: {result.stderr}")
    size = os.path.getsize(output_path)
    print(f"  Downloaded: {size / 1024 / 1024:.1f}MB", file=sys.stderr)
    return size


def get_duration(audio_path):
    """Get audio duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True, timeout=30
    )
    return float(result.stdout.strip())


def split_audio(audio_path, chunk_dir, chunk_duration=600):
    """Split audio into chunks of chunk_duration seconds."""
    duration = get_duration(audio_path)
    num_chunks = math.ceil(duration / chunk_duration)
    print(f"  Duration: {duration:.0f}s, splitting into {num_chunks} chunks of {chunk_duration}s", file=sys.stderr)
    
    chunks = []
    for i in range(num_chunks):
        start = i * chunk_duration
        chunk_path = os.path.join(chunk_dir, f"chunk_{i:03d}.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ss", str(start),
             "-t", str(chunk_duration), "-acodec", "libmp3lame",
             "-ab", "64k", "-ar", "16000", "-ac", "1",
             chunk_path],
            capture_output=True, text=True, timeout=120
        )
        if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 0:
            chunks.append(chunk_path)
            size_mb = os.path.getsize(chunk_path) / 1024 / 1024
            print(f"  Chunk {i}: {size_mb:.1f}MB", file=sys.stderr)
    
    return chunks


def compress_audio(audio_path, output_path):
    """Compress audio to fit under 25MB."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", audio_path, "-acodec", "libmp3lame",
         "-ab", "64k", "-ar", "16000", "-ac", "1", output_path],
        capture_output=True, text=True, timeout=120
    )
    return os.path.getsize(output_path)


def transcribe_chunk(chunk_path):
    """Transcribe a single audio chunk via OpenAI Whisper API."""
    import json
    
    result = subprocess.run(
        ["curl", "-s", "https://api.openai.com/v1/audio/transcriptions",
         "-H", f"Authorization: Bearer {OPENAI_API_KEY}",
         "-F", f"file=@{chunk_path}",
         "-F", "model=whisper-1",
         "-F", "response_format=text"],
        capture_output=True, text=True, timeout=300
    )
    
    if result.returncode != 0:
        raise Exception(f"Whisper API failed: {result.stderr}")
    
    return result.stdout.strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: fetch-transcript-whisper.py <audio_url> [output_file]", file=sys.stderr)
        sys.exit(1)
    
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    
    audio_url = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    with tempfile.TemporaryDirectory() as tmpdir:
        raw_path = os.path.join(tmpdir, "raw_audio.mp3")
        compressed_path = os.path.join(tmpdir, "compressed.mp3")
        
        # Download
        size = download_audio(audio_url, raw_path)
        
        # Compress first
        print("  Compressing audio...", file=sys.stderr)
        compressed_size = compress_audio(raw_path, compressed_path)
        print(f"  Compressed: {compressed_size / 1024 / 1024:.1f}MB", file=sys.stderr)
        
        if compressed_size <= MAX_CHUNK_SIZE:
            # Single file transcription
            print("  Transcribing (single chunk)...", file=sys.stderr)
            text = transcribe_chunk(compressed_path)
        else:
            # Split and transcribe chunks
            chunks = split_audio(raw_path, tmpdir)
            texts = []
            for i, chunk in enumerate(chunks):
                print(f"  Transcribing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
                texts.append(transcribe_chunk(chunk))
            text = "\n\n".join(texts)
        
        print(f"  Total transcript: {len(text)} chars", file=sys.stderr)
        
        if output_file:
            with open(output_file, 'w') as f:
                f.write(text)
            print(f"  Saved to {output_file}", file=sys.stderr)
        else:
            print(text)


if __name__ == "__main__":
    main()
