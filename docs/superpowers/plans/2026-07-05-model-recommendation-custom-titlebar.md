# Model Recommendation + Custom Titlebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cited "Choosing a model" section to the README, and replace the native OS window frame with a custom in-app titlebar (icon/name + New button + uniform right-aligned minimize/maximize/close) that works on macOS, Windows, and Linux.

**Architecture:** Feature 1 is a README-only edit driven by focused web research. Feature 2 is a frameless-window feature: the Electron main process drops the native frame and exposes window-control IPC (`win:*`), the preload bridges it onto `window.clipot.window`, and a new `TitleBar` React component renders the drag region and controls, reflecting maximize state via a pushed event.

**Tech Stack:** Electron 33 (`BrowserWindow`, `ipcMain`), React 18, zustand, lucide-react icons, Vite, Vitest, Playwright (e2e). No new dependencies.

## Global Constraints

- Do not add any new runtime or dev dependency (`package.json` unchanged). Icons come from the existing `lucide-react`.
- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.node.json` must exit 0. `npm test` (125 unit tests) must stay green.
- No change to the LLM prompt/rules or provider code. Feature 1 edits only `README.md`.
- Window controls are uniform right-aligned custom controls on ALL OSes (`frame: false` everywhere); macOS native traffic lights are intentionally removed.
- The `TitleBar` must degrade gracefully when `window.clipot?.window` is absent (jsdom/unit tests) — all control calls guarded, component still renders.
- The README "Choosing a model" section must be concise (~8–15 lines), cite 2–4 real sources, and carry an "assessed as of 2026-07" caveat.
- Comments: single-line, only where non-obvious; never longer than 3 lines.

---

### Task 1: "Choosing a model" README section (web research)

**Files:**
- Modify: `README.md` (insert a new `## Choosing a model` section immediately above the existing `## Quick start per provider`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks (independent of Feature 2).

- [ ] **Step 1: Research**

Use the WebSearch tool (and WebFetch for promising sources) to gather recent evidence on which LLMs produce the best SVG / vector output. Run at least these searches and follow the best 2–4 sources:
- `best LLM for SVG generation 2025 2026 comparison`
- `Claude vs GPT vs Gemini SVG vector generation quality`
- `LLM SVG benchmark svgbench OR "generate svg" evaluation`
- `local model SVG generation qwen2.5-coder vs llama`

Record the 2–4 strongest citable sources (title + URL). Favor sources that specifically evaluate SVG/vector/structured-graphic output over generic "best LLM" listicles. Cross-check claims against clipot's supported providers (Anthropic, OpenAI, Gemini, Ollama) and the models in `electron/main.ts` `CURATED_MODELS` (anthropic: claude-sonnet-5 / claude-opus-4-8; openai: gpt-5.2 / gpt-5.1; gemini: gemini-2.5-flash / gemini-2.5-pro).

- [ ] **Step 2: Write the section**

Insert this section into `README.md` directly above the line `## Quick start per provider`. Fill the bracketed slots from your research — every bracket must be replaced with a concrete model name and a real one-sentence rationale; leave NO brackets or placeholders in the committed file. Keep the exact structure below:

```markdown
## Choosing a model

For the best SVG results, **[recommended default model]** is the strongest all-round choice — [one-sentence why]. If you don't have a preference, start there.

- **Best quality:** [model] — [one sentence].
- **Best value / speed:** [model] — [one sentence].
- **Best local / offline (Ollama):** [model] — [one sentence].

Model quality moves quickly; this reflects the landscape as of 2026-07. See the per-provider setup below to add a key.

Sources: [[1]](url) [short label], [[2]](url) [short label][, …up to 4].

```

- [ ] **Step 3: Verify no placeholders remain and section renders**

Run: `grep -n "Choosing a model" README.md && grep -nE "\[recommended default model\]|\[model\]|\[one sentence" README.md`
Expected: the first grep matches the heading; the second grep prints NOTHING (all brackets filled). If the second grep matches anything, finish filling the section.

- [ ] **Step 4: Sanity-check links**

Confirm each source URL you cite actually loads (WebFetch or re-open). Remove/replace any dead link. Confirm there are 2–4 sources.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Add a Choosing a model section with SVG-quality recommendations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Frameless window + window-control IPC (Electron side)

**Files:**
- Modify: `electron/shared/ipc.ts` (add channels to `CH`; add `window` object to `ClipotApi`)
- Modify: `electron/main.ts` (add `frame: false`; register `win:*` handlers in `registerIpc()`; forward maximize/unmaximize events in `createWindow()`)
- Modify: `electron/preload.ts` (implement the `window` object on the api)

**Interfaces:**
- Consumes: existing `CH`, `safeSend` (`electron/main.ts:50`), `registerIpc()` (`electron/main.ts:110`), `createWindow()` (`electron/main.ts:195`).
- Produces: on `window.clipot.window` — `minimize(): void`, `toggleMaximize(): void`, `close(): void`, `isMaximized(): Promise<boolean>`, `onMaximizedChange(cb: (maximized: boolean) => void): () => void`. New `CH` keys: `winMinimize`, `winToggleMaximize`, `winClose`, `winIsMaximized`, `winMaximizedChanged`.

- [ ] **Step 1: Add channels and the API type to `electron/shared/ipc.ts`**

In the `CH` object (after `savePrefs: 'prefs:save',`), add:

```ts
  winMinimize: 'win:minimize',
  winToggleMaximize: 'win:toggleMaximize',
  winClose: 'win:close',
  winIsMaximized: 'win:isMaximized',
  winMaximizedChanged: 'win:maximizedChanged',
```

In the `ClipotApi` interface (after `savePrefs(prefs: Prefs): Promise<void>`), add:

```ts
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
```

- [ ] **Step 2: Register the window-control handlers in `electron/main.ts`**

At the end of `registerIpc()` (just before its closing `}` at line ~193, after the `listModels` handler), add:

```ts
  ipcMain.on(CH.winMinimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(CH.winToggleMaximize, (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on(CH.winClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(CH.winIsMaximized, (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
```

- [ ] **Step 3: Make the window frameless and forward maximize state**

In `createWindow()`, add `frame: false` to the `BrowserWindow` options (right after `height: 800,`):

```ts
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#0e0b08',
    icon: join(app.getAppPath(), 'assets/icon.png'),
```

Then, immediately after the `win.webContents.on('did-finish-load', ...)` line, add:

```ts
  win.on('maximize', () => safeSend(win.webContents, CH.winMaximizedChanged, true))
  win.on('unmaximize', () => safeSend(win.webContents, CH.winMaximizedChanged, false))
```

(`BrowserWindow` and `ipcMain` are already imported at `electron/main.ts:1`; `safeSend` is defined at line 50.)

- [ ] **Step 4: Implement the `window` object in `electron/preload.ts`**

In the `api` object (after `savePrefs: (prefs) => ipcRenderer.invoke(CH.savePrefs, prefs),`), add:

```ts
  window: {
    minimize: () => ipcRenderer.send(CH.winMinimize),
    toggleMaximize: () => ipcRenderer.send(CH.winToggleMaximize),
    close: () => ipcRenderer.send(CH.winClose),
    isMaximized: () => ipcRenderer.invoke(CH.winIsMaximized),
    onMaximizedChange: (cb) => {
      const h = (_e: IpcRendererEvent, maximized: boolean) => cb(maximized)
      ipcRenderer.on(CH.winMaximizedChanged, h)
      return () => ipcRenderer.off(CH.winMaximizedChanged, h)
    },
  },
```

(`IpcRendererEvent` is already imported at `electron/preload.ts:1`.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json`
Expected: exits 0, no output.

- [ ] **Step 6: Build and confirm the app launches frameless**

Run: `npx vite build && DISPLAY=${DISPLAY:-:1} node -e "const {_electron}=require('playwright');(async()=>{const app=await _electron.launch({args:['.','--no-sandbox'],env:{...process.env,NODE_ENV:'production'}});const w=await app.firstWindow();await w.waitForLoadState('domcontentloaded');const framed=await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];return win.isMaximized();});console.log('launched, isMaximized=',framed);await app.close();})().catch(e=>{console.error(e);process.exit(1)})"`
Expected: prints `launched, isMaximized= false` with no error (the frameless window loads and IPC is wired).

- [ ] **Step 7: Commit**

```bash
git add electron/shared/ipc.ts electron/main.ts electron/preload.ts
git commit -m "Make the window frameless and add window-control IPC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: TitleBar component, App integration, styling

**Files:**
- Create: `src/components/TitleBar.tsx`
- Modify: `src/App.tsx` (replace the inline `.titlebar` block with `<TitleBar>`, drop now-unused imports)
- Modify: `src/theme.css` (drag region + `.win-controls` / `.win-btn` styles)

**Interfaces:**
- Consumes: `window.clipot.window` (Task 2). Props: `TitleBar({ onNewFile }: { onNewFile: () => void })`.
- Produces: the `TitleBar` component (consumed only by `App.tsx`).

- [ ] **Step 1: Create `src/components/TitleBar.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Plus, Minus, Square, Copy, X } from 'lucide-react'
import logoUrl from '../../assets/logo.svg'

type Props = { onNewFile: () => void }

// Guarded accessor: window controls are absent under jsdom/unit tests.
const winApi = () => window.clipot?.window

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function TitleBar({ onNewFile }: Props) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const api = winApi()
    if (!api) return
    void api.isMaximized().then(setMaximized)
    return api.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div
      className="titlebar"
      style={drag}
      onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) winApi()?.toggleMaximize() }}
    >
      <img src={logoUrl} width={18} height={18} alt="" />
      <span className="name">clipot</span>
      <div style={{ flex: 1 }} />
      <button onClick={onNewFile} title="New SVG" style={{ ...noDrag, background: 'var(--accent)', color: 'var(--bg)' }}>
        <Plus size={16} />
      </button>
      <div className="win-controls" style={noDrag}>
        <button className="win-btn" onClick={() => winApi()?.minimize()} title="Minimize"><Minus size={15} /></button>
        <button className="win-btn" onClick={() => winApi()?.toggleMaximize()} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button className="win-btn close" onClick={() => winApi()?.close()} title="Close"><X size={16} /></button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Use `TitleBar` in `src/App.tsx`**

Replace the inline titlebar block (currently `src/App.tsx:30-37`):

```tsx
      <div className="titlebar">
        <img src={logoUrl} width={18} height={18} alt="" />
        <span className="name">clipot</span>
        <div style={{ flex: 1 }} />
        <button onClick={startNewFile} title="New SVG" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          <Plus size={16} />
        </button>
      </div>
```

with:

```tsx
      <TitleBar onNewFile={startNewFile} />
```

Add the import near the other component imports (e.g. after `import PromptHost from './components/PromptHost'`):

```tsx
import TitleBar from './components/TitleBar'
```

Then remove the two now-unused imports from `src/App.tsx` (they moved into `TitleBar`): the `import logoUrl from '../assets/logo.svg'` line and `Plus` from the `lucide-react` import. After removal `App.tsx` should no longer import `logoUrl` or `Plus`.

- [ ] **Step 3: Style the drag region and controls in `src/theme.css`**

Replace the existing `.titlebar` rule (`src/theme.css:30`):

```css
.titlebar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--border); }
```

with:

```css
.titlebar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--border); -webkit-app-region: drag; }
.win-controls { display: flex; align-items: center; gap: 2px; -webkit-app-region: no-drag; }
.win-btn { padding: 0; width: 34px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--text-dim); }
.win-btn:hover { background: var(--panel-2); color: var(--text); }
.win-btn.close:hover { background: #b3261e; color: #fff; }
```

- [ ] **Step 4: Typecheck and run the full unit suite**

Run: `npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc exits 0; all 125 unit tests pass (the app renders under jsdom because `winApi()` returns undefined and controls are no-ops).

- [ ] **Step 5: Commit**

```bash
git add src/components/TitleBar.tsx src/App.tsx src/theme.css
git commit -m "Add custom titlebar component with window controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: e2e test for titlebar window controls

**Files:**
- Modify: `tests/e2e/smoke.spec.ts` (append a new test)

**Interfaces:**
- Consumes: the running app (Task 2 + Task 3), the titlebar control buttons by `title` ("Minimize", "Maximize"/"Restore", "Close").
- Produces: nothing.

- [ ] **Step 1: Append the failing test**

Add this test at the end of `tests/e2e/smoke.spec.ts`:

```ts
test('custom titlebar controls maximize and restore the window', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clipot-e2e-titlebar-'))
  let electronApp: ElectronApplication | null = null
  try {
    electronApp = await electron.launch({
      args: ['.', '--no-sandbox', `--user-data-dir=${join(dir, 'userdata')}`],
      env: { ...process.env, CLIPOT_TEST_FOLDER: dir, NODE_ENV: 'production', ANTHROPIC_API_KEY: 'k' },
    })
    const window: Page = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // All three custom controls are present in the frameless titlebar.
    await expect(window.getByTitle('Minimize')).toBeVisible()
    await expect(window.getByTitle('Close')).toBeVisible()
    const maxBtn = window.getByTitle('Maximize')
    await expect(maxBtn).toBeVisible()

    const isMax = () => electronApp!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())

    await maxBtn.click()
    await expect.poll(isMax, { timeout: 5_000 }).toBe(true)
    // The button reflects state: it now offers Restore.
    const restoreBtn = window.getByTitle('Restore')
    await expect(restoreBtn).toBeVisible()

    await restoreBtn.click()
    await expect.poll(isMax, { timeout: 5_000 }).toBe(false)
    // Do NOT click Close — it would terminate the app before cleanup.
  } finally {
    await electronApp?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Build the renderer/electron and run the test to verify it passes**

Run: `npx vite build && npm run e2e`
Expected: all e2e tests pass, including `custom titlebar controls maximize and restore the window`. (If the app were still framed / controls missing, this test would fail on the `getByTitle` visibility or the `isMax` poll.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "Add e2e coverage for custom titlebar window controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the executor

- **Commits:** deliberate, one per task, straight to `main` (repo convention). Pre-approved for this work stream; confirm with the user on any deviation from the plan.
- Task 1 (README) is fully independent of Tasks 2–4. Tasks 2 → 3 → 4 are ordered: 3 consumes Task 2's `window.clipot.window`; 4 verifies both at the app level.
- Manual/live visual confirmation of the frameless window (drag, double-click-to-maximize, red close hover) is the controller's responsibility after Task 4.
- `-webkit-app-region` is not in React's `CSSProperties` type — the `as React.CSSProperties` casts in `TitleBar.tsx` are required and intentional.
