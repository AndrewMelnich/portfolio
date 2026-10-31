---
name: video-optimizer
description: Video file optimization using ffmpeg. Use this skill when the user asks to "optimize", "compress", "prepare for web", "reduce size" of a video, or change its parameters (resolution, quality).
---

# Video Optimizer Skill

This skill is designed for efficient video file optimization using `ffmpeg`. The main goal is to obtain a high-quality file with a small size, suitable for web playback.

## Base Command

Use the following command as a base:

```bash
ffmpeg -i [input_file] -c:v libx264 -pix_fmt yuv420p -crf 20 -vf scale=1920:-2 -movflags +faststart [filename]-opt.mp4
```

## How to Interpret User Prompts

Analyze the user's prompt carefully to adjust the parameters:

1.  **Input File (`-i`)**: Identify the source video name from context or the request.
2.  **Quality (`-crf`)**:
    *   Default: `20` (excellent balance).
    *   "Maximum quality" / "Lossless": `17-18`.
    *   "Compress heavily" / "Smallest size": `24-28`.
3.  **Resolution (`-vf scale`)**:
    *   Default: `1920:-2` (Full HD).
    *   "For mobile" / "720p": `1280:-2`.
    *   "Small preview" / "480p": `854:-2`.
    *   If a specific width is provided, use it in the format `width:-2`.
4.  **Output File**:
    *   Default: Use `[source_name]-opt.mp4`.
    *   If the user specifies a name, use it.

## Examples

*   **Prompt**: "Optimize video hero.mov"
    **Action**: `ffmpeg -i hero.mov -c:v libx264 -pix_fmt yuv420p -crf 20 -vf scale=1920:-2 -movflags +faststart hero-opt.mp4`

*   **Prompt**: "Compress intro.mp4 for mobile, medium quality is fine"
    **Action**: `ffmpeg -i intro.mp4 -c:v libx264 -pix_fmt yuv420p -crf 24 -vf scale=1280:-2 -movflags +faststart intro-opt.mp4`

*   **Prompt**: "Make a 4k video with max quality from presentation.mp4"
    **Action**: `ffmpeg -i presentation.mp4 -c:v libx264 -pix_fmt yuv420p -crf 18 -vf scale=3840:-2 -movflags +faststart presentation-opt.mp4`
