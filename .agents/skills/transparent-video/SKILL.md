---
name: transparent-video
description: >
  Prepare transparent (alpha) looping videos for the web: VP9 WebM for Chrome/Firefox
  and HEVC MOV (hvc1 + alpha) for Safari. Use when the user mentions transparent video,
  alpha WebM from Figma, PNG frame sequence, Safari HEVC alpha, dual <source>,
  loading.webm / *.hevc.mov, or "подготовить прозрачное видео". Not for opaque H.264
  compress — that is video-optimizer.
---

# Transparent video for web

Safari does not play transparent WebM. Ship **two files** + dual `<source>` (HEVC first).

## Workflow

1. Identify input: PNG sequence **or** Figma/export WebM.
2. Check alpha:
   ```bash
   ffprobe -v error -show_entries stream=pix_fmt,codec_name -show_entries stream_tags=alpha_mode -of default=noprint_wrappers=1 INPUT
   ```
   - Alpha ok if `pix_fmt` contains `a` **or** `alpha_mode=1` (Figma/Mediabunny VP9 often reports `yuv420p` + `alpha_mode=1`).
   - Neither → warn, ask re-export with transparency.
3. Run [`scripts/prepare-alpha-video.sh`](scripts/prepare-alpha-video.sh) (Mac required for HEVC via VideoToolbox).
   - `--webm`: always **libvpx-vp9 → PNG → encode**. Native VP9 decoder drops alpha → HEVC with solid background.
4. Put outputs in `frontend/public/static/animations/`.
5. Wire HTML with dual `<source>` (see below). Never use lone `src=` on `<video>` for alpha clips.

## Script

```bash
# PNG sequence (%0Nd = digit count, no spaces in name)
.agents/skills/transparent-video/scripts/prepare-alpha-video.sh \
  --png 'Starline%03d.png' --fps 30 --out loading --outdir frontend/public/static/animations

# Figma / existing WebM
.agents/skills/transparent-video/scripts/prepare-alpha-video.sh \
  --webm path/to/figma.webm --out loading --outdir frontend/public/static/animations
```

Outputs: `<out>.webm`, `<out>.hevc.mov`. Temp ProRes deleted.

Defaults: fps `30`, webm CRF `32`, HEVC bitrate auto by max(width,height) (≤256 → 1M, ≤512 → 2M, else 4M).

### Manual ffmpeg (if script unavailable)

**WebM (VP9)** from PNG:

```bash
ffmpeg -r 30 -i 'NAME%03d.png' -movflags +faststart -an -vcodec libvpx-vp9 -pix_fmt yuva420p -crf 32 out.webm
```

**Figma WebM → PNG** (required; use libvpx, not native):

```bash
ffmpeg -c:v libvpx-vp9 -i figma.webm -pix_fmt rgba frame%03d.png
```

**ProRes intermediate** from PNG:

```bash
ffmpeg -framerate 30 -i 'frame%03d.png' -movflags +faststart -an -c:v prores_ks -profile:v 5 -bits_per_mb 8000 -pix_fmt yuva422p10le tmp.mov
```

**HEVC for Safari** (Mac):

```bash
ffmpeg -i tmp.mov -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 1 -tag:v hvc1 -b:v 2M -vf "premultiply=inplace=1" out.hevc.mov
```

Use `-allow_sw 1` (HW session often fails with `-12908`). Never feed Figma WebM straight into ProRes/HEVC with the native decoder.

Without Mac: Finder → Services → Encode Selected Video Files → HEVC + **Save transparency** (on the ProRes `.mov`).

PNG pattern: `FILE-NAME%0Xd.png` where `X` = digit count.

## HTML

HEVC **first** — Safari takes first compatible source; Chrome/Firefox skip `hvc1` → WebM.

```html
<video
    class="…"
    width="96"
    height="96"
    autoplay
    muted
    loop
    playsinline
    aria-hidden="true"
    data-…
>
    <source src="/static/animations/name.hevc.mov" type='video/mp4; codecs="hvc1"' />
    <source src="/static/animations/name.webm" type="video/webm" />
</video>
```

## Verify

- Safari: alpha + play (no black box).
- Chrome/Firefox: WebM alpha.
- `ffprobe` on `.hevc.mov`: codec `hevc`, tag `hvc1`; prefer pix_fmt / side data showing alpha.
