# maccing-pictura

Provider-agnostic multi-ratio image generation plugin for Claude Code.

## Features

- Generate images in multiple aspect ratios with consistency
- Automatic prompt enhancement
- Two-turn premium upscaling (Gemini + Topaz Labs)
- Full editing suite: refine, inpaint, outpaint, restyle
- Unified API with provider fallback chains

## Installation

```bash
claude plugin install maccing-pictura@maccing
```

## Commands

- `/pictura:generate`: Create images
- `/pictura:edit`: Modify existing batch
- `/pictura:upscale`: Premium two-turn upscale
- `/pictura:list`: Show recent generations
- `/pictura:gallery`: Visual browser

## Configuration

Config file: `.claude/plugins/maccing/pictura/config.json`

See [design document](../../docs/plans/2026-01-17-pictura-design.md) for full details.
