#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  prepare-alpha-video.sh --png 'NAME%03d.png' [--fps 30] --out NAME [--outdir DIR]
  prepare-alpha-video.sh --webm INPUT.webm [--fps 30] --out NAME [--outdir DIR]

Options:
  --png PATTERN   PNG sequence pattern (ffmpeg -i), e.g. Starline%03d.png
  --webm FILE     Input WebM (e.g. Figma export) — extracted via libvpx → PNG first
  --fps N         Frame rate (default: 30)
  --out NAME      Output basename without extension (required)
  --outdir DIR    Output directory (default: cwd)
  --crf N         VP9 CRF (default: 32)
  --bitrate RATE  HEVC -b:v (default: auto by resolution)
  -h, --help      Show help
EOF
}

PNG_PATTERN=""
WEBM_IN=""
FPS="30"
OUT_NAME=""
OUTDIR="."
CRF="32"
BITRATE=""

while [[ $
  case "$1" in
    --png) PNG_PATTERN="${2:-}"; shift 2 ;;
    --webm) WEBM_IN="${2:-}"; shift 2 ;;
    --fps) FPS="${2:-}"; shift 2 ;;
    --out) OUT_NAME="${2:-}"; shift 2 ;;
    --outdir) OUTDIR="${2:-}"; shift 2 ;;
    --crf) CRF="${2:-}"; shift 2 ;;
    --bitrate) BITRATE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$OUT_NAME" ]]; then
  echo "error: --out NAME required" >&2
  usage >&2
  exit 1
fi

if [[ -n "$PNG_PATTERN" && -n "$WEBM_IN" ]]; then
  echo "error: use either --png or --webm, not both" >&2
  exit 1
fi

if [[ -z "$PNG_PATTERN" && -z "$WEBM_IN" ]]; then
  echo "error: --png or --webm required" >&2
  usage >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found" >&2
  exit 1
fi

if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'hevc_videotoolbox'; then
  echo "error: hevc_videotoolbox missing (need Mac ffmpeg build). Make ProRes then encode via Finder Services → HEVC + Save transparency." >&2
  exit 1
fi

if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'prores_ks'; then
  echo "error: prores_ks encoder missing" >&2
  exit 1
fi

mkdir -p "$OUTDIR"
OUT_WEBM="${OUTDIR%/}/${OUT_NAME}.webm"
OUT_HEVC="${OUTDIR%/}/${OUT_NAME}.hevc.mov"
TMP_MOV="$(mktemp "${TMPDIR:-/tmp}/${OUT_NAME}.prores.XXXXXX.mov")"
TMP_PNG_DIR=""
cleanup() {
  rm -f "$TMP_MOV"
  if [[ -n "$TMP_PNG_DIR" && -d "$TMP_PNG_DIR" ]]; then
    rm -rf "$TMP_PNG_DIR"
  fi
}
trap cleanup EXIT

probe_pix_fmt() {
  ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 "$1" 2>/dev/null || true
}

probe_has_alpha_tag() {
  local mode
  mode="$(ffprobe -v error -select_streams v:0 -show_entries stream_tags=alpha_mode -of default=nw=1:nk=1 "$1" 2>/dev/null || true)"
  [[ "$mode" == "1" ]]
}

auto_bitrate() {
  local w h maxd
  w="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$1")"
  h="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$1")"
  maxd="$w"
  [[ "$h" -gt "$maxd" ]] && maxd="$h"
  if [[ "$maxd" -le 256 ]]; then
    echo "1M"
  elif [[ "$maxd" -le 512 ]]; then
    echo "2M"
  else
    echo "4M"
  fi
}

if [[ -n "$WEBM_IN" ]]; then
  if ! probe_has_alpha_tag "$WEBM_IN"; then
    fmt="$(probe_pix_fmt "$WEBM_IN")"
    case "$fmt" in
      *a*) ;;
      *)
        echo "warning: input webm has no alpha_mode/yuva — transparency may be missing. Re-export with alpha." >&2
        ;;
    esac
  fi
  TMP_PNG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/${OUT_NAME}.png.XXXXXX")"
  echo "→ PNG sequence via libvpx-vp9 (preserves Figma alpha)"
  ffmpeg -y -c:v libvpx-vp9 -i "$WEBM_IN" -pix_fmt rgba "${TMP_PNG_DIR}/frame%03d.png"
  PNG_PATTERN="${TMP_PNG_DIR}/frame%03d.png"
  WEBM_IN=""
fi

echo "→ WebM (VP9) from PNG @ ${FPS}fps, crf=${CRF}"
ffmpeg -y -framerate "$FPS" -i "$PNG_PATTERN" \
  -movflags +faststart -an \
  -vcodec libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -crf "$CRF" \
  "$OUT_WEBM"

echo "→ ProRes intermediate from PNG"
ffmpeg -y -framerate "$FPS" -i "$PNG_PATTERN" \
  -movflags +faststart -an \
  -c:v prores_ks -profile:v 5 -bits_per_mb 8000 -pix_fmt yuva422p10le \
  "$TMP_MOV"

if [[ -z "$BITRATE" ]]; then
  BITRATE="$(auto_bitrate "$TMP_MOV")"
fi

echo "→ HEVC MOV (hvc1), -b:v ${BITRATE}"
ffmpeg -y -i "$TMP_MOV" \
  -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 1 -tag:v hvc1 \
  -b:v "$BITRATE" -vf "premultiply=inplace=1" \
  -an "$OUT_HEVC"

echo "done:"
echo "  $OUT_WEBM"
echo "  $OUT_HEVC"
ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height -show_entries stream_tags=alpha_mode -of default=noprint_wrappers=1 "$OUT_WEBM"
ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,codec_tag_string -of default=noprint_wrappers=1 "$OUT_HEVC"
