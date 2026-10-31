# Feature map

Patterns this skill owns. Open the example before coding that feature. Canon paths are under `frontend/`.

| Feature | When | Example | Canon |
| --- | --- | --- | --- |
| [Header theme](../examples/header-theme.md) | Fixed header chrome changes over a section (transparent / solid / blend); FOUC-free first paint | `examples/header-theme.md` | `widgets/Header/model/header-theme.ts`, `shared/config/header-theme.ts` |
| [Scale stretch](../examples/scale-stretch.md) | Grow / stretch / fullscreen without animating `height`/`width` | `examples/scale-stretch.md` | `widgets/Footer` talk, `_pages/Index/.../Hero` showreel |
| [Fade opacity](../examples/fade-opacity.md) | Appear / scrub fade without per-frame `color-mix` | `examples/fade-opacity.md` | Footer talk `--appear` |
| [Cursor RAF](../examples/cursor-raf.md) | Custom cursor / pointer follow; RAF only while active | `examples/cursor-raf.md` | `features/cursor` |
| [Scroll scrub](../examples/scroll-scrub.md) | Progress tied to scroll; CSS timeline first | `examples/scroll-scrub.md` | skill `scroll-linked-animation` |

Proof: motion / theme change → `verify-ui` Motion probe or recipe on the route that shows it. Jank → Chrome Performance (Paint / Layout).
