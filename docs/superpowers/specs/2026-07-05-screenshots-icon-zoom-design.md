# Design: Screenshots, App Icon, Canvas Zoom, and Toolbar Tooltips

Date: 2026-07-05

## Overview

Four independent, small improvements to clipot, plus one investigation answered:

1. Add the two existing screenshots to the README and commit them so GitHub renders them.
2. Give the app a real icon: the clipot logo on the brand-brown background.
3. Add canvas zoom (Ctrl/Cmd `+` / `-` / `0` plus toolbar buttons), keeping the existing Region-select tool.
4. Add clear tooltips to every toolbar (and sidebar-header) icon for discoverability.
5. Investigation: confirm the model's automatic black outlines are not caused by any baked-in prompt. No code change.

Each item is isolated and can be implemented and verified independently.

## 1. Screenshots → README

**Files:** rename/move the two screenshots from `~/Documents/` into the repo:

- `Screenshot_20260705_201655.png` → `assets/screenshots/new-file.png` — the "create a new SVG" empty state (logo art + prompt).
- `Screenshot_20260705_201736.png` → `assets/screenshots/editing.png` — a lemon on the canvas with the thread drawer and checkpoints open.

**README:** replace the placeholder line under `## Screenshots`:

```
> _Screenshots coming soon._
```

with the two images referenced by relative path, each with alt text and a one-line caption. Relative paths render on GitHub once the PNGs are committed.

**Commit:** the two PNGs are committed to the repo. `assets/**` is already bundled by electron-builder, so no build config change is needed.

## 2. App icon (brown background)

- Add `build/icon.svg`: the existing `assets/logo.svg` artwork centered on a solid brand-brown (`#b85c1f`, `--rind`) rounded square.
- Rasterize to `build/icon.png` at 1024×1024 using an installed CLI — prefer `rsvg-convert`; fall back to ImageMagick (`convert`/`magick`) which is confirmed present. electron-builder derives per-platform `.icns` / `.ico` from this single high-res PNG.
- `electron-builder.yml`: add `icon: build/icon` (electron-builder resolves the platform-appropriate file from `build/`).
- `electron/main.ts`: set `icon:` on the `BrowserWindow` options so Linux/Windows taskbar and window chrome use it. Point it at the packaged `build/icon.png` path (dev + prod safe).

**Approach:** commit the generated PNG statically rather than rasterizing during `npm run build`. Reproducible, and adds no build-tooling dependency.

## 3. Canvas zoom

The corner-bracket toolbar icon is the existing **Region-select** tool (`ScanLine`, toggles `regionMode` for drag-to-select). It works; it was just unlabeled. It stays. Zoom is added as separate controls.

**Store (`src/store/store.ts`):**

- Add `zoom: number` (default `1`).
- Add actions `zoomIn()`, `zoomOut()`, `zoomReset()`.
- Multiplicative step (`×1.2`), clamped to `[0.25, 4]`. `zoomReset` sets `1`.

**CanvasView (`src/components/CanvasView.tsx`):**

- Apply `zoom` as `transform: scale(zoom)` on the `.surface` element (with `transform-origin: center`).
- Re-pin selection bubbles when `zoom` changes: the bubble positions are derived from `getScreenCTM`, which already reflects the CSS transform, so the fix is to re-run the bubble recompute whenever `zoom` changes (add `zoom` as a trigger for `recomputeBubbles`).

**Keybindings:** active only when a file is open (canvas view mounted). A `keydown` handler intercepts:

- `Ctrl/Cmd` + `=` (i.e. `+`) → `zoomIn`
- `Ctrl/Cmd` + `-` → `zoomOut`
- `Ctrl/Cmd` + `0` → `zoomReset`

Each calls `preventDefault()` so it doesn't collide with Electron's window `setZoomFactor`.

**Toolbar (`src/components/Toolbar.tsx`):** after the Region-select button, add three buttons: zoom out (`Minus`), reset (shows current zoom %, e.g. `100%`), zoom in (`Plus`). Disabled at the clamp bounds.

## 4. Toolbar & sidebar tooltips

Every icon-only control gets a clear `title` tooltip, including the shortcut where relevant:

- Toolbar: Undo, Redo, Duplicate file, "Region select — drag a box to select multiple", Zoom out (Ctrl/Cmd −), Reset zoom, Zoom in (Ctrl/Cmd +), Edit rules, Settings.
- Sidebar header (`src/components/FileTree.tsx`): the two bare icons (new file, new folder) get tooltips too, since they are the other unlabeled controls. (Confirmed in scope with the user.)

## 5. Black outlines — investigation result

Reviewed the full prompt path: `EDIT_PROTOCOL` and `DEFAULT_RULES` in `src/lib/promptBuilder.ts`, plus the provider services in `electron/services/llm/`. Nothing mentions strokes, borders, or outlines. The automatic black outlines are the model's own stylistic default, not a baked-in instruction. **No code change.** (The user's own checkpoint labels — "make-all-line-borders-unified", "no-borders-needed" — corroborate this was steered per-prompt.)

## Testing

- **Screenshots/README:** visual — confirm images resolve and render (relative paths).
- **App icon:** confirm `build/icon.png` generates at 1024×1024 and the app launches with the brown icon in the taskbar/window; `npm run build` packaging picks up the icon.
- **Zoom:** unit-test the store actions (`zoomIn`/`zoomOut`/`zoomReset` clamping and step). Manually verify the canvas scales, bubbles stay pinned, and Ctrl/Cmd `+`/`-`/`0` work without triggering window zoom.
- **Tooltips:** visual — hover each control.
- Existing `npm test` (121 tests) and `tsc --noEmit` must stay green.

## Out of scope

- No change to the LLM prompt/rules.
- No change to Region-select behavior beyond its tooltip.
- No new runtime dependencies.
