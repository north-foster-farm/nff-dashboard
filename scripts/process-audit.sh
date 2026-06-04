#!/usr/bin/env bash
#
# process-audit.sh — turn recorded walkthrough clips into transcripts +
# frames for Claude to read (Batch 40). Everything runs locally: ffmpeg
# pulls the audio, whisper.cpp transcribes it with timestamps, ffmpeg
# grabs one frame at the midpoint of each spoken segment, and we stitch
# a per-clip transcript.md that interleaves "[mm:ss] text → frame.jpg".
#
# Nothing leaves the machine.
#
# Usage:
#   scripts/process-audit.sh                  # process every clip in audits/raw/
#   scripts/process-audit.sh path/to/clip.mov # process one clip
#
# Env overrides:
#   WHISPER_BIN    (default: whisper-cli)
#   WHISPER_MODEL  (default: ~/.cache/whisper.cpp/ggml-base.en.bin)
#   RAW_DIR        (default: audits/raw)
#   OUT_ROOT       (default: audits/<today>/processed)
#   FRAME_WIDTH    (default: 1280)

set -euo pipefail

# ── resolve repo root (script lives in scripts/) ──────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

WHISPER_BIN="${WHISPER_BIN:-whisper-cli}"
WHISPER_MODEL="${WHISPER_MODEL:-$HOME/.cache/whisper.cpp/ggml-base.en.bin}"
RAW_DIR="${RAW_DIR:-audits/raw}"
OUT_ROOT="${OUT_ROOT:-audits/$(date +%F)/processed}"
FRAME_WIDTH="${FRAME_WIDTH:-1280}"

# ── preflight ─────────────────────────────────────────────────────────
fail() { echo "error: $*" >&2; exit 1; }

command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg not found (brew install ffmpeg)"
command -v "$WHISPER_BIN" >/dev/null 2>&1 \
  || fail "$WHISPER_BIN not found (brew install whisper-cpp)"
command -v python3 >/dev/null 2>&1 || fail "python3 not found"
[ -f "$WHISPER_MODEL" ] \
  || fail "model not found at $WHISPER_MODEL
  download one with:
    mkdir -p \"$(dirname "$WHISPER_MODEL")\"
    curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \\
      -o \"$WHISPER_MODEL\""

# ── collect clips ─────────────────────────────────────────────────────
clips=()
if [ "$#" -gt 0 ]; then
  clips=("$@")
else
  [ -d "$RAW_DIR" ] || fail "no $RAW_DIR/ — drop recordings there first"
  while IFS= read -r -d '' f; do clips+=("$f"); done < <(
    find "$RAW_DIR" -maxdepth 1 -type f \
      \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) -print0 | sort -z
  )
fi
[ "${#clips[@]}" -gt 0 ] || fail "no clips found in $RAW_DIR/"

mkdir -p "$OUT_ROOT"
echo "Processing ${#clips[@]} clip(s) → $OUT_ROOT/"
echo "Model: $WHISPER_MODEL"
echo

# ── per-clip pipeline ─────────────────────────────────────────────────
for clip in "${clips[@]}"; do
  [ -f "$clip" ] || { echo "skip (missing): $clip"; continue; }
  name="$(basename "$clip")"; name="${name%.*}"
  out="$OUT_ROOT/$name"
  frames="$out/frames"
  mkdir -p "$frames"
  echo "▶ $name"

  # 1. audio → 16kHz mono wav (what whisper.cpp wants)
  wav="$out/audio.wav"
  ffmpeg -y -loglevel error -i "$clip" -ar 16000 -ac 1 -c:a pcm_s16le "$wav"

  # 2. transcribe → json (timestamps in ms) + srt (human-readable).
  #    -ml/-sow force ~sentence-length segments so each narrated issue
  #    gets its own timestamp + frame instead of one block per minute.
  "$WHISPER_BIN" -m "$WHISPER_MODEL" -f "$wav" \
    -oj -osrt -of "$out/transcript" -nt \
    -ml "${SEGMENT_MAX_CHARS:-90}" -sow >/dev/null 2>&1 \
    || fail "whisper failed on $name"

  # 3. one frame per segment (midpoint) + interleaved transcript.md
  python3 - "$clip" "$out" "$frames" "$FRAME_WIDTH" <<'PY'
import json, os, subprocess, sys

clip, out, frames, width = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
data = json.load(open(os.path.join(out, "transcript.json")))
segs = data.get("transcription", [])

# Clip duration, so a segment midpoint near the end never seeks past EOF.
try:
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nk=1:nw=1", clip],
        capture_output=True, text=True).stdout.strip())
except Exception:
    dur = 1e9

def mmss(ms, sep=":"):
    s = ms // 1000
    return f"{s//60:02d}{sep}{s%60:02d}"

lines = [f"# {os.path.basename(clip)} — walkthrough transcript\n",
         f"_{len(segs)} segments. Each line: timestamp · narration · frame._\n"]
for i, seg in enumerate(segs, 1):
    off = seg.get("offsets", {})
    t0 = int(off.get("from", 0)); t1 = int(off.get("to", t0))
    mid = (t0 + t1) / 2000.0  # seconds
    if dur:
        mid = min(mid, max(0.0, dur - 0.15))
    text = (seg.get("text") or "").strip()
    if not text:
        continue
    fname = f"{i:04d}_{mmss(t0, sep='-')}.jpg"
    fpath = os.path.join(frames, fname)
    # format=yuvj420p makes jpeg encoding tolerate full-range sources;
    # -ss before -i is a fast keyframe seek.
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{mid:.2f}",
         "-i", clip, "-frames:v", "1",
         "-vf", f"scale={width}:-1,format=yuvj420p",
         "-q:v", "4", fpath],
        check=False)
    lines.append(f"**[{mmss(t0)}]** {text}  \n`frames/{fname}`\n")

open(os.path.join(out, "transcript.md"), "w").write("\n".join(lines))
print(f"  {len([s for s in segs if (s.get('text') or '').strip()])} segments, "
      f"frames in {frames}")
PY

  # tidy: the wav is large and disposable
  rm -f "$wav"
  echo "  → $out/transcript.md"
  echo
done

echo "Done. Read each <clip>/transcript.md (with its frames/) to write"
echo "audits/$(date +%F)/findings.md."
