# Design: Model Recommendation + Custom Frameless Titlebar

Date: 2026-07-05

## Overview

Two independent improvements to clipot, delivered in one spec with two sections:

1. **Model recommendation** — a cited "Choosing a model" section in the README, based on focused live web research into which models produce the best SVGs.
2. **Custom frameless titlebar** — replace the native OS window frame with an in-app titlebar carrying the clipot icon/name, the New (+) button, and uniform right-aligned minimize / maximize / close controls, working across macOS, Windows, and Linux.

The two are unrelated in code and can be implemented and reviewed independently.

## Feature 1: "Choosing a model" README section

### Method
Run focused web searches (WebSearch) for recent (2025–2026) comparisons and benchmarks of LLM SVG-generation quality across the providers clipot supports: Anthropic, OpenAI, Google Gemini, and locally-runnable Ollama models. Prefer sources that specifically evaluate SVG/vector or structured-graphic output. Capture 2–4 citable sources.

### Placement & format
Insert a new `## Choosing a model` section in `README.md` immediately **above** the existing `## Quick start per provider`. Format:

- One-line **default recommendation** (best overall SVG quality) at the top.
- A short bulleted breakdown:
  - **Best quality** — model + one-sentence rationale.
  - **Best value / speed** — model + rationale.
  - **Best local / offline** — Ollama model + rationale.
- A dated caveat line: "Model quality moves fast; assessed as of 2026-07."
- 2–4 source links as Markdown footnote-style references at the end of the section.

### Constraints
- Recommendations should name models the app can actually use (align with `CURATED_MODELS` in `electron/main.ts` where sensible, but web findings may justify others).
- Keep the section concise (roughly 8–15 lines of prose + links).
- Do not alter the existing per-provider "Recommended model" lines unless research contradicts them; if so, update them to match and note it.

## Feature 2: Custom frameless titlebar

### Main process — `electron/main.ts`
- Add `frame: false` to the `BrowserWindow` options (all platforms). Keep `width`, `height`, `backgroundColor`, `icon`, and `webPreferences` unchanged. Leave the window `title` as "clipot" (OS taskbar/dock).
- Register window-control IPC handlers on `ipcMain`:
  - `win:minimize` → `win.minimize()`
  - `win:toggleMaximize` → `win.isMaximized() ? win.unmaximize() : win.maximize()`
  - `win:close` → `win.close()`
  - `win:isMaximized` (invoke) → returns `win.isMaximized()`
- After creating the window, forward its `'maximize'` and `'unmaximize'` events to the renderer as `win:maximizedChanged` with a boolean payload, so the maximize button can reflect state.
- All handlers resolve the target window via the existing `currentWindow()` helper (or `BrowserWindow.fromWebContents(event.sender)`), guarding against a null window.

### IPC contract — `electron/shared/ipc.ts`
- Add channels to `CH`: `winMinimize: 'win:minimize'`, `winToggleMaximize: 'win:toggleMaximize'`, `winClose: 'win:close'`, `winIsMaximized: 'win:isMaximized'`, `winMaximizedChanged: 'win:maximizedChanged'`.
- Add to `ClipotApi` a nested `window` object to keep the surface tidy:
  ```ts
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
  ```

### Preload — `electron/preload.ts`
- Implement the `window` object: `minimize`/`toggleMaximize`/`close` via `ipcRenderer.send`; `isMaximized` via `ipcRenderer.invoke`; `onMaximizedChange` subscribes to `CH.winMaximizedChanged` and returns an unsubscribe function (same pattern as `onTreeChanged`).

### Renderer — `src/components/TitleBar.tsx` (new) + `src/App.tsx`
- Extract the current inline `.titlebar` markup from `App.tsx` into a new `TitleBar` component. `App.tsx` renders `<TitleBar onNewFile={startNewFile} />` in place of the inline block.
- Layout (left → right): clipot logo + `clipot` name · flex spacer · `+ New` button (unchanged behavior) · window controls `–` `☐` `✕`.
- Drag behavior: the bar root sets `-webkit-app-region: drag`; the `+ New` button and all three window-control buttons set `-webkit-app-region: no-drag`. A double-click handler on the bar background calls `toggleMaximize` (covers Linux WMs that don't auto-maximize on drag-region double-click).
- Window controls: lucide `Minus` (minimize), `Square` (maximize) that swaps to a restore glyph (`Copy` or a stacked-squares icon) when maximized, and `X` (close). The maximized state comes from `isMaximized()` on mount plus `onMaximizedChange` updates. Close button has a red hover; the others use the standard warm hover.
- Graceful degradation: guard all calls behind `window.clipot?.window?.…` so the component renders (controls become no-ops) under jsdom/tests where the window API may be absent.

### Styling — `src/theme.css`
- Extend/rework `.titlebar`: keep the panel background + bottom border; add `-webkit-app-region: drag`. Add a `.win-controls` container (`no-drag`) and `.win-btn` rules (fixed-size hit areas, warm hover) plus a `.win-btn.close:hover` red variant. Ensure control hit targets are comfortable (~30–40px wide).

### Cross-OS considerations
- `frame:false` windows remain edge-resizable on Windows (Electron keeps `WS_THICKFRAME`) and draggable via `-webkit-app-region` on all three OSes.
- macOS: native traffic lights are removed by design (uniform right-aligned controls chosen). Fullscreen and standard window behavior still function.
- Linux: explicit double-click-to-maximize handler compensates for WMs that don't do it automatically.

### Testing
- Extend the Playwright e2e (`tests/e2e/smoke.spec.ts` or a new spec) to:
  - Assert the three window-control buttons render in the titlebar.
  - Click maximize and assert `electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())` becomes `true`, then click again → `false`, and that the button's icon/state reflects the change.
- `TitleBar` degrades under jsdom, so existing 125 unit tests + `tsc --noEmit` (both configs) stay green; no new unit-test logic is required beyond what the component naturally needs.
- Controller performs a live visual check of the frameless window and control behavior.

## Out of scope
- No change to the LLM prompt/rules or provider code (Feature 1 only edits the README).
- No per-OS control placement (uniform right-aligned everywhere, per decision).
- No custom window-snapping or multi-window support.
- No new runtime dependency (lucide-react already provides the icons).
