# clipot — Design Spec

**Date:** 2026-07-02
**Status:** Approved pending final user review
**License:** MIT

## 1. What clipot is

An open-source Electron desktop app for managing and editing local SVG files through LLM prompts. Point it at a folder; browse and manage SVGs in a sidebar; render one on the canvas; select individual elements visually; reference those selections in a prompt the way coding agents reference files with `@`; watch the LLM's edits apply to the SVG live.

Prior-art search (2026-07-02) found no existing open-source project combining these features. Closest neighbors: SVG-Pro (PySide6/Ollama, no visual selection), SVG ORA Studio (browser, no file management or local LLM), Chat2SVG (research).

**Goals:** lightweight, slick/clean, local-first, provider-agnostic (including local LLMs).

## 2. Architecture

Electron, three layers ("slim main, smart renderer"):

- **Main process (Node, TypeScript)**
  - `files` service: open folder, full CRUD (create/rename/move/delete files and folders), chokidar watching, atomic writes (temp file + rename).
  - `vault` service: API keys encrypted with Electron `safeStorage` in `userData`; loaded into `process.env` at boot; pre-set env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_HOST`) are honored and take precedence.
  - `llm` service: one thin fetch+SSE client per provider (Anthropic, OpenAI, Google Gemini, Ollama) behind a single streaming interface; no provider SDKs. Streams chunks to the renderer over IPC. Runs in main to avoid CORS.
  - `history` service: snapshot/rollback and thread persistence (see §6).
- **Preload:** typed `contextBridge` API. Renderer never touches Node. `nodeIntegration` off, `contextIsolation` on.
- **Renderer:** React 18 + Vite + TypeScript. State: Zustand. Styling: hand-rolled CSS with design tokens (no UI framework). Icons: `lucide-react`. Fonts bundled locally.

**Runtime dependencies (complete list):** `react`, `react-dom`, `zustand`, `lucide-react`, `chokidar`. Dev: `electron`, `electron-builder`, `vite`, `typescript`, `vitest`, `playwright`.

## 3. Visual design

**Layout — "Studio" (approved mockup v2):** left sidebar (file tree) · main canvas · activity strip · prompt bar. The conversation streams into the slim activity strip above the prompt (Claude Code style); full thread history opens from a toggle as a drawer.

**Palette (design tokens):**

| Token | Value | Use |
|---|---|---|
| `bg` | `#0e0b08` | app background |
| `panel` | `#120e0a` | sidebar, titlebar, prompt bar |
| `panel-2` | `#1a1410` | inputs, pills |
| `canvas-bg` | `#171209` | canvas backdrop (brown undertone) |
| `border` | `#1e1811` | hairline separators |
| `text` | `#ece5dc` | primary text (off-white) |
| `text-dim` | `#b9ac9d` / `#7d7266` | secondary / ghost |
| `accent` | `#e8833a` | orange — used sparingly |
| `accent-soft` | `#f0b98a` | accent text |
| `rind` | `#b85c1f` | logo peel, chip borders (`#a05e24`) |
| `pith` | `#f2d4ad` | logo pith, chip fills' pale counterpart |

**Rules:** buttons are borderless (flat, subtle warm fill on hover). Elements with a visible border use a **≥2px border in a brighter variant of their fill** (selection chips: `#31200e` fill / `#a05e24` border; edit tags: `#152112` fill / `#4f7a45` border). The white SVG canvas surface is the only large light area; in new-file mode it turns dark.

**Fonts:** Space Grotesk (UI) + JetBrains Mono (chips, IDs, code, edit tags). Bundled in the app — no network fetches.

**Logo (approved, v7):** flat peeled orange — segmented fruit (pale `#f2d4ad` segment lines + navel dot) resting on 7 two-tone peel petals (rind `#b85c1f` outside, pith `#f2d4ad` inside) fanned across 240°. Lives at `assets/logo.svg`, shown at ~18px in the titlebar left of the wordmark, and at the top of the README.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g>
    <g transform="translate(32 33) rotate(-30)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(10)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(50)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(90)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(130)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(170)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
    <g transform="translate(32 33) rotate(210)"><path d="M2 0 C 9 -9, 21 -9, 28 0 C 21 9, 9 9, 2 0 Z" fill="#b85c1f"/><path d="M5.5 0 C 11 -5.6, 19.5 -5.6, 25 0 C 19.5 5.6, 11 5.6, 5.5 0 Z" fill="#f2d4ad"/></g>
  </g>
  <circle cx="32" cy="22" r="14.5" fill="#e8833a"/>
  <g stroke="#f2d4ad" stroke-width="1.8" stroke-linecap="round"><path d="M32 22 L32 8.5"/><path d="M32 22 L43.7 15.25"/><path d="M32 22 L43.7 28.75"/><path d="M32 22 L32 35.5"/><path d="M32 22 L20.3 28.75"/><path d="M32 22 L20.3 15.25"/></g>
  <circle cx="32" cy="22" r="14.5" fill="none" stroke="#e8833a" stroke-width="2.4"/>
  <circle cx="32" cy="22" r="2.2" fill="#f2d4ad"/>
</svg>
```

## 4. Renderer components

| Component | Responsibility |
|---|---|
| `FileTree` | folder tree, open/create/rename (inline)/move (drag)/delete (confirm), context menu, active-file highlight |
| `CanvasView` | sanitized inline-DOM SVG rendering, pan/zoom, click-to-select, selection overlay, region-select mode |
| `PromptBar` | selection chips (`@1 roof`), prompt input, model picker pill, send/stop |
| `ActivityStrip` | streaming status line, edit tags (`✓ edit 2/3`), history toggle |
| `ThreadDrawer` | full persisted conversation for the active file |
| `Toolbar` | undo, redo, duplicate, region tool, rules editor button |
| `SettingsModal` | API keys per provider, default model, vision toggle for Ollama |
| `RulesEditor` | edit the rules text (see §5) |
| `NewFileView` | dark canvas surface, orange placeholder art (the logo mark), prompt placeholder "Describe the SVG you want to create…" |

Core renderer modules (pure logic, unit-testable): `svgDoc`, `editStream`, `promptBuilder`, `selection`, `undoStack`.

## 5. Selection & prompting

- **Element selection:** any element in the SVG DOM is clickable. Selected element is re-rendered topmost (cloned overlay) with a white 2px stroke + glow, plus an orange numbered bubble. Selections map to chips `@1 <name>`, `@2 …` in the prompt (name = existing id, else tag name).
- **Stable IDs:** on first selection of an element without an id, clipot writes `id="clipot-N"` into the file (N = max existing clipot-id + 1). All LLM references use ids. After every applied edit, selections are re-validated; a selection whose id disappeared flips its bubble to a warning state.
- **Region select:** drag a rectangle over the canvas. Resolves to all elements whose rendered bounds intersect the region (always), plus a rasterized PNG crop of the region attached to the message when the active model supports vision (capability map; Anthropic/OpenAI/Gemini models yes, Ollama per settings toggle). Text-only models silently skip the image.
- **Rules:** an editable text (default shipped with the app, per-folder override in `.clipot/rules.md`) appended to the system prompt on every request. Default rules: produce distinct, well-separated elements with meaningful `id`s; keep structure human-readable; never remove or rename existing `id`s; prefer minimal edits over rewrites.
- **Message assembly (`promptBuilder`):** system = edit-protocol spec + rules; user = prompt text with each `@n` expanded to the element's id + source, region element list, optional image block, current full SVG source when ≤32 KB; above that, only the mentioned elements' source plus the document skeleton (root attributes + top-level structure).

## 6. Edit protocol, live apply, history

**Edit protocol.** The model replies with prose plus edit blocks:

```
<<<EDIT
SEARCH:
<exact text from the current file>
REPLACE:
<replacement text>
>>>
```

`editStream` parses blocks out of the token stream (robust to chunk boundaries) and applies each the moment its `>>>` arrives. Whole-file creation (new-file mode) uses a `<<<FILE … >>>` block containing the complete SVG.

**Apply pipeline per block:** exact-match SEARCH against current source → replace → re-parse (DOMParser); invalid result rolls the block back. Canvas re-renders on every applied block; the file auto-saves (debounced ~300 ms, atomic write).

**Failure handling:** a non-matching SEARCH or invalid-SVG result halts that block, and the error (with the failed block) is fed back to the model in the same conversation; two automatic retries, then the run stops and the assistant message states what it couldn't apply.

**History & safety:**
- Undo/redo: in-memory source snapshots, one per applied edit block; toolbar + Ctrl+Z/Ctrl+Shift+Z.
- Prompt checkpoints: before each run, the current file is snapshotted to `.clipot/history/<file>/NNN-<prompt-slug>.svg`; restorable from the thread drawer, survives restarts.
- Duplicate: copies the file next to the original.
- Threads: per-file conversation persisted at `.clipot/threads/<file>.json`; most recent turns sent as context, oldest dropped first past a ~8k-token budget.
- `.clipot/` is created inside the opened folder; the README recommends gitignoring it.

## 7. Providers

One interface: `stream(messages, {model, images?}) → AsyncIterable<chunk>`.

| Provider | API | Notes |
|---|---|---|
| Anthropic | Messages API, SSE | vision ✓ |
| OpenAI | Chat Completions, SSE | vision ✓ |
| Google Gemini | generateContent streaming | vision ✓ |
| Ollama | `/api/chat` streaming | local; vision per model (settings toggle); model list fetched from `/api/tags` |

Keys via `SettingsModal` → `vault` (safeStorage) → `process.env`; manual env vars work without the UI. Model picker lists a curated set per provider plus Ollama's installed models.

## 8. Error handling

- Provider errors (bad key, rate limit, unreachable Ollama): toast + note in the thread; never a crash.
- Edit failures: retry protocol (§6); the UI never silently drops an edit.
- FS errors (permissions, watched-file deleted underneath): toast; tree refreshes from watcher events.
- Malformed SVG opened from disk: rendered best-effort; a warning badge shows parse issues.
- Crash safety: atomic writes + prompt checkpoints mean the disk is always a consistent, recoverable state.
- No secrets in logs, ever.

## 9. Testing

- **Vitest** units: `svgDoc` (ID assignment, edit application, validation/rollback), `editStream` (block parsing across chunk boundaries, malformed blocks), `promptBuilder` (mention expansion, trimming), `selection` staleness.
- **Provider clients** against recorded SSE fixtures — no live APIs in CI.
- **Playwright-Electron smoke test:** open fixture folder → select element → mocked stream → edit applied live → file on disk updated + checkpoint written.

## 10. Packaging & distribution

`electron-builder`: Linux `.deb` + AppImage, Windows NSIS, macOS dmg. GitHub Releases via CI later; v1 builds locally. MIT license.

## 11. README requirements

Logo at top → what/why → screenshots (Studio layout) → features → installation (per-platform packages + build-from-source) → dependency list → usage guide (selection, mentions, region, rules, history) → **quick start per provider**: Anthropic, OpenAI, Gemini (key setup + recommended model each), Ollama (install, `ollama pull` recommended text + vision models) → config reference (env vars, `.clipot/` layout) → license.

## 12. Process

- **Team mode implementation:** Fable 5 orchestrator; cheaper worker models (Sonnet/Haiku) chosen per task complexity.
- **Git:** one commit per completed feature, straight to `main`; no branching until after v1. Descriptive imperative commit messages.
- **Repo:** `~/Documents/Repos/Github/clipot`, published to GitHub under the user's account as `clipot`.

## 13. Out of scope for v1

Manual (non-LLM) shape editing; multi-file prompts; plugin system; collaborative features; auto-update; CI release pipeline; i18n.
