# Screenshots, App Icon, Canvas Zoom & Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two screenshots to the README, give the app a brown-background icon, add canvas zoom (Ctrl/Cmd `+`/`-`/`0` + toolbar buttons), and add clear tooltips to every icon-only control.

**Architecture:** Screenshots and icon are static asset + config changes. Zoom is a small piece of shared state in the zustand store (`zoom` + `zoomIn`/`zoomOut`/`zoomReset`), consumed by `CanvasView` (a CSS `transform: scale()` on the canvas surface + a keydown handler) and by `Toolbar` (three buttons). Tooltips are `title` attributes.

**Tech Stack:** React 18, zustand 5, lucide-react icons, Electron 33, electron-builder, Vite, Vitest, TypeScript. ImageMagick (`magick`) for SVG→PNG rasterization.

## Global Constraints

- Do not add any new runtime or dev dependency (`package.json` stays unchanged).
- `tsc --noEmit -p tsconfig.json` must exit 0; `npm test` (121 tests) must stay green.
- Never edit compiled output; source only.
- Comments: single-line, only where they add non-obvious context. No comment longer than 3 lines.
- No change to the LLM prompt/rules (`src/lib/promptBuilder.ts` untouched).
- Region-select behavior is unchanged (only its tooltip text changes).
- Brand brown is `#b85c1f` (`--rind`). Accent orange `#e8833a`, cream `#f2d4ad`.
- Zoom is clamped to `[0.25, 4]` with a multiplicative step of `1.2`; reset is `1`.

---

### Task 1: Screenshots into the repo + README

**Files:**
- Create: `assets/screenshots/new-file.png` (moved from `/home/liadj/Documents/Screenshot_20260705_201655.png`)
- Create: `assets/screenshots/editing.png` (moved from `/home/liadj/Documents/Screenshot_20260705_201736.png`)
- Modify: `README.md` (the `## Screenshots` section, currently the single line `> _Screenshots coming soon._`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Move and rename both screenshots into the repo**

```bash
mkdir -p assets/screenshots
mv /home/liadj/Documents/Screenshot_20260705_201655.png assets/screenshots/new-file.png
mv /home/liadj/Documents/Screenshot_20260705_201736.png assets/screenshots/editing.png
```

- [ ] **Step 2: Verify both files landed and are valid PNGs**

Run: `identify assets/screenshots/new-file.png assets/screenshots/editing.png`
Expected: two lines, each reporting `PNG 1920x976`.

- [ ] **Step 3: Replace the README placeholder with the two images**

In `README.md`, replace this block:

```markdown
## Screenshots

> _Screenshots coming soon._
```

with:

```markdown
## Screenshots

Create a new SVG from a prompt:

![clipot new-file view — logo art and a prompt box for describing an SVG to create](assets/screenshots/new-file.png)

Edit an existing SVG: click elements to select them, watch edits stream in live, and roll back from the per-file thread and checkpoints:

![clipot editing view — a lemon SVG on the canvas with the thread drawer and checkpoints open](assets/screenshots/editing.png)
```

- [ ] **Step 4: Confirm the README references resolve**

Run: `ls -1 assets/screenshots/ && grep -n "assets/screenshots" README.md`
Expected: both PNG filenames listed, and two matching `grep` hits for the image paths.

- [ ] **Step 5: Commit**

```bash
git add assets/screenshots/new-file.png assets/screenshots/editing.png README.md
git commit -m "Add app screenshots to the README

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Brown-background app icon

**Files:**
- Create: `assets/icon.svg` (brown background + the existing logo, scaled/centered)
- Create: `assets/icon.png` (1024×1024 raster, committed)
- Modify: `electron-builder.yml` (add `icon:` per platform)
- Modify: `electron/main.ts:196-206` (add `icon` to the `BrowserWindow` options)

**Interfaces:**
- Consumes: `assets/logo.svg` artwork (copied verbatim into `assets/icon.svg`).
- Produces: `assets/icon.png` at the app root, referenced at runtime via `join(app.getAppPath(), 'assets/icon.png')`.

- [ ] **Step 1: Create `assets/icon.svg`**

The logo's outer petals are also `#b85c1f`, so on a brown field they recede and the cream inner-petal pinwheel + orange citrus center become the motif — high contrast, legible. The logo is scaled to 82% and centered so it isn't edge-to-edge.

Create `assets/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="13" fill="#b85c1f"/>
  <g transform="translate(32 32) scale(0.82) translate(-32 -32)">
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
  </g>
</svg>
```

- [ ] **Step 2: Rasterize to a 1024×1024 PNG**

Run:

```bash
magick -density 1152 -background none assets/icon.svg -resize 1024x1024 assets/icon.png
identify assets/icon.png
```

Expected: `identify` reports `PNG 1024x1024`.

- [ ] **Step 3: Visually verify the icon (and apply the fallback only if needed)**

Read `assets/icon.png` and confirm: a brown rounded square with a cream pinwheel/flower and an orange citrus-slice center, clearly legible.

If (and only if) the shapes render blurry or the center rays look broken (ImageMagick's SVG renderer can be weak), re-run Step 2 with a higher density and no resize downscale:

```bash
magick -density 2304 -background none assets/icon.svg -resize 1024x1024 assets/icon.png
```

Then Read it again to confirm. Do not proceed until the icon reads clearly.

- [ ] **Step 4: Point electron-builder at the icon**

In `electron-builder.yml`, add an `icon:` line to each platform block so packaging derives `.icns`/`.ico`/png from the single PNG. Result:

```yaml
appId: health.dive.clipot
productName: clipot
directories:
  output: release
files:
  - dist/**
  - dist-electron/**
  - assets/**
linux:
  target: [deb, AppImage]
  category: Graphics
  icon: assets/icon.png
win:
  target: [nsis]
  icon: assets/icon.png
mac:
  target: [dmg]
  category: public.app-category.graphics-design
  icon: assets/icon.png
```

- [ ] **Step 5: Set the runtime BrowserWindow icon**

`electron/main.ts` already imports `app` and `join`. In the `new BrowserWindow({ ... })` options (currently `electron/main.ts:196-206`), add an `icon` field. `assets/**` is bundled, so `app.getAppPath()` resolves it in both dev and the packaged app:

```ts
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0e0b08',
    icon: join(app.getAppPath(), 'assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json`
Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
git add assets/icon.svg assets/icon.png electron-builder.yml electron/main.ts
git commit -m "Add brown-background app icon and wire it into the window and builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Zoom state in the store

**Files:**
- Modify: `src/store/store.ts` (the `State` type around line 96-128, the initial state around line 137-141, and the actions block)
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: on the store — `zoom: number` (default `1`), and actions `zoomIn(): void`, `zoomOut(): void`, `zoomReset(): void`. Step is `×1.2`, clamped to `[0.25, 4]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/store.test.ts`:

```ts
describe('zoom', () => {
  beforeEach(() => useStore.setState({ zoom: 1 }))

  it('zooms in by a 1.2x step', () => {
    useStore.getState().zoomIn()
    expect(useStore.getState().zoom).toBeCloseTo(1.2)
  })

  it('clamps zoom-in at 4', () => {
    for (let i = 0; i < 30; i++) useStore.getState().zoomIn()
    expect(useStore.getState().zoom).toBe(4)
  })

  it('clamps zoom-out at 0.25', () => {
    for (let i = 0; i < 30; i++) useStore.getState().zoomOut()
    expect(useStore.getState().zoom).toBe(0.25)
  })

  it('reset returns to 1', () => {
    useStore.getState().zoomIn()
    useStore.getState().zoomReset()
    expect(useStore.getState().zoom).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- store`
Expected: FAIL — the `zoom` tests error (`zoomIn is not a function` / `zoom` is `undefined`).

- [ ] **Step 3: Add `zoom` and the actions to the `State` type**

In `src/store/store.ts`, in the `type State = { ... }` block, add the field near the other UI-state fields (e.g. right after `regionMode: boolean; threadOpen: boolean`):

```ts
  regionMode: boolean; threadOpen: boolean
  zoom: number
```

and add the action signatures alongside the other action declarations (e.g. after `toggleThread(): void`):

```ts
  toggleThread(): void
  zoomIn(): void
  zoomOut(): void
  zoomReset(): void
```

- [ ] **Step 4: Add the initial value and implementations**

In the `create<State>((set, get) => ({ ... }))` object, add `zoom: 1` to the initial-state literal (e.g. on the line with `regionMode: false, threadOpen: false, ...`):

```ts
  regionImage: null, regionIds: [], regionMode: false, threadOpen: false, zoom: 1, error: null, _stop: null,
```

and add the actions next to `toggleThread`:

```ts
  toggleThread() { set((s) => ({ threadOpen: !s.threadOpen })) },
  zoomIn() { set((s) => ({ zoom: Math.min(4, +(s.zoom * 1.2).toFixed(3)) })) },
  zoomOut() { set((s) => ({ zoom: Math.max(0.25, +(s.zoom / 1.2).toFixed(3)) })) },
  zoomReset() { set({ zoom: 1 }) },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- store`
Expected: PASS — all `zoom` tests green, plus the existing store tests still pass.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/store/store.ts tests/unit/store.test.ts
git commit -m "Add clamped canvas zoom state to the store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Apply zoom on the canvas + keybindings

**Files:**
- Modify: `src/components/CanvasView.tsx`

**Interfaces:**
- Consumes: store `zoom`, `zoomIn`, `zoomOut`, `zoomReset` (Task 3).
- Produces: a `computeBubbles(root, wrap, selections)` module helper (extracted so the main effect and the zoom effect share bubble positioning); no other task depends on it.

- [ ] **Step 1: Import the `Selection` type**

At the top of `src/components/CanvasView.tsx`, add to the existing imports:

```ts
import type { Selection } from '@/lib/selection'
```

- [ ] **Step 2: Extract a shared `computeBubbles` helper**

Add this module-level function next to the other helpers (e.g. just above `function Bubble(...)`):

```ts
// Screen positions of the selection bubbles, relative to the wrap's top-left.
// Reads getScreenCTM, which reflects the current CSS transform (zoom), so callers
// only need to re-run this whenever zoom or selections change.
function computeBubbles(root: SVGSVGElement, wrap: HTMLDivElement, selections: Selection[]): Bubble[] {
  const wrapRect = wrap.getBoundingClientRect()
  const next: Bubble[] = []
  for (const s of selections) {
    const el = root.querySelector(`#${CSS.escape(s.id)}`)
    const p = el && bboxScreenPoint(root, el)
    if (p) next.push({ n: s.n, x: p.x - wrapRect.left, y: p.y - wrapRect.top })
  }
  return next
}
```

- [ ] **Step 3: Use `zoom` from the store and apply the transform**

Change the destructure line (currently `const { source, selections, addSelection, removeSelection, setSource, regionMode } = useStore()`) to include `zoom`:

```ts
  const { source, selections, addSelection, removeSelection, setSource, regionMode, zoom } = useStore()
```

Then change the `.surface` element's inline style to apply the scale:

```tsx
      <div className="surface" ref={hostRef} style={{ padding: 12, maxWidth: '90%', maxHeight: '90%', transform: `scale(${zoom})`, transformOrigin: 'center' }} />
```

- [ ] **Step 4: Replace the inline bubble recompute with the shared helper**

Inside the main `useEffect`, replace the `recomputeBubbles` definition and its call:

```ts
    const recomputeBubbles = () => {
      if (!wrap) { setBubbles([]); return }
      const wrapRect = wrap.getBoundingClientRect()
      const next: Bubble[] = []
      for (const s of selections) {
        const el = root.querySelector(`#${CSS.escape(s.id)}`)
        const p = el && bboxScreenPoint(root, el)
        if (p) next.push({ n: s.n, x: p.x - wrapRect.left, y: p.y - wrapRect.top })
      }
      setBubbles(next)
    }
    recomputeBubbles()
    window.addEventListener('resize', recomputeBubbles)
```

with:

```ts
    const recomputeBubbles = () => { setBubbles(wrap ? computeBubbles(root, wrap, selections) : []) }
    recomputeBubbles()
    window.addEventListener('resize', recomputeBubbles)
```

- [ ] **Step 5: Re-pin bubbles when zoom changes**

Add a new effect after the main effect (getScreenCTM/getBoundingClientRect force synchronous layout, so the new transform is already applied when this runs):

```ts
  // Zoom rescales the surface, moving every element on screen — re-pin bubbles.
  useEffect(() => {
    const root = rootRef.current
    const wrap = wrapRef.current
    if (root && wrap) setBubbles(computeBubbles(root, wrap, selections))
  }, [zoom, selections])
```

- [ ] **Step 6: Add the zoom keybindings**

Add another effect (mounted only while the canvas view is shown). It intercepts Ctrl/Cmd `+`/`-`/`0` before Electron's own window zoom:

```ts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const { zoomIn, zoomOut, zoomReset } = useStore.getState()
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn() }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut() }
      else if (e.key === '0') { e.preventDefault(); zoomReset() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
```

- [ ] **Step 7: Typecheck and run the full test suite**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc exits 0; all tests pass (121+ from Task 3).

- [ ] **Step 8: Manually verify**

Run `npm run dev`, open a folder, open an SVG. Confirm:
- Ctrl/Cmd `+` enlarges the SVG, `-` shrinks it, `0` resets — with no Electron window-level zoom happening.
- A selected element's numbered bubble stays pinned to the element while zooming.

- [ ] **Step 9: Commit**

```bash
git add src/components/CanvasView.tsx
git commit -m "Zoom the canvas via Ctrl/Cmd +/-/0 and keep bubbles pinned

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Toolbar zoom buttons + tooltips everywhere

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/FileTree.tsx:99-102` (sidebar header icons)

**Interfaces:**
- Consumes: store `zoom`, `zoomIn`, `zoomOut`, `zoomReset` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite `Toolbar.tsx` with zoom controls and clear tooltips**

Replace the whole file with:

```tsx
import { Undo2, Redo2, Copy, ScanLine, Minus, Plus, ListChecks, Settings } from 'lucide-react'
import { useStore } from '@/store/store'

type Props = { onOpenRules: () => void; onOpenSettings: () => void }

export default function Toolbar({ onOpenRules, onOpenSettings }: Props) {
  const { undo, redo, duplicate, canUndo, canRedo, regionMode, toggleRegionMode, zoom, zoomIn, zoomOut, zoomReset } = useStore()

  return (
    <div data-testid="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
      <button onClick={undo} disabled={!canUndo()} title="Undo"><Undo2 size={15} /></button>
      <button onClick={redo} disabled={!canRedo()} title="Redo"><Redo2 size={15} /></button>
      <button onClick={() => void duplicate()} title="Duplicate file"><Copy size={15} /></button>
      <button className={regionMode ? 'active' : ''} onClick={toggleRegionMode} title="Region select — drag a box to select multiple elements">
        <ScanLine size={15} />
      </button>
      <button onClick={zoomOut} disabled={zoom <= 0.25} title="Zoom out (Ctrl/Cmd −)"><Minus size={15} /></button>
      <button onClick={zoomReset} title="Reset zoom (Ctrl/Cmd 0)" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 46, justifyContent: 'center' }}>
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={zoomIn} disabled={zoom >= 4} title="Zoom in (Ctrl/Cmd +)"><Plus size={15} /></button>
      <div style={{ flex: 1 }} />
      <button onClick={onOpenRules} title="Edit rules"><ListChecks size={15} /></button>
      <button onClick={onOpenSettings} title="Settings"><Settings size={15} /></button>
    </div>
  )
}
```

- [ ] **Step 2: Add tooltips to the sidebar-header icons**

In `src/components/FileTree.tsx`, wrap each header icon in a `<span title=...>` (a `title` attribute on a bare `<svg>` is not a reliable tooltip; an HTML wrapper is). Replace lines 99-102:

```tsx
        <span style={{ display: 'flex', gap: 8 }}>
          <FilePlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFile')} />
          <FolderPlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFolder')} />
        </span>
```

with:

```tsx
        <span style={{ display: 'flex', gap: 8 }}>
          <span title="New file" style={{ display: 'inline-flex' }}>
            <FilePlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFile')} />
          </span>
          <span title="New folder" style={{ display: 'inline-flex' }}>
            <FolderPlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFolder')} />
          </span>
        </span>
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Manually verify**

Run `npm run dev` with an SVG open. Confirm:
- The toolbar shows `−  100%  +` after the region-select icon; clicking `−`/`+` scales the canvas and updates the percentage; `−` disables at 25%, `+` at 400%; clicking the percentage resets to 100%.
- Hovering every toolbar button and the two sidebar-header icons shows a descriptive tooltip.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/components/FileTree.tsx
git commit -m "Add toolbar zoom controls and tooltips to icon-only controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the executor

- **Commits:** The user's standing rule is that commits are deliberate. This work stream is pre-approved for commits, but confirm with the user if anything deviates from the plan.
- **Black outlines:** Intentionally no task — investigation confirmed it's the model's stylistic default, not a baked-in prompt. No change.
- Task 1 and Task 2 are independent of Tasks 3-5 and each other; Tasks 4 and 5 both depend on Task 3.
