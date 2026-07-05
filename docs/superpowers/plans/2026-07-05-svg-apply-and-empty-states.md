# Robust SVG Application & Empty-State Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SVG a model returns actually get applied/saved even when it ignores clipot's edit-block protocol, surface a clear error when nothing is applicable, and route the main area to helpful placeholders for the no-folder / empty-folder / no-file states.

**Architecture:** Two pure, unit-tested renderer modules (`svgExtract`, `mainView`) plus small wiring changes: strengthen the injected protocol prompt (`promptBuilder`), add a fallback-extraction branch to the store's `sendPrompt` loop, and drive `App.tsx`'s main area + prompt bar off a `mainView` selector with a reusable `Placeholder` component.

**Tech Stack:** React 18, Zustand, TypeScript, Vite, Vitest, Playwright, Electron.

## Global Constraints

Every task's requirements implicitly include this section.

- **No new dependencies** (runtime allowlist stays: react, react-dom, zustand, lucide-react, chokidar).
- **Renderer code** (`src/`) must not import Node/electron at runtime (type-only imports OK).
- **No `as any` / `as unknown`** casts in production code (test-only structural casts tolerated, matching existing tests).
- **Spec source of truth:** `docs/superpowers/specs/2026-07-05-svg-apply-and-empty-states-design.md`.
- **Verification per task:** `npx tsc -p tsconfig.json --noEmit` AND `npx tsc -p tsconfig.node.json --noEmit` clean; `npm test` green; run the e2e (`DISPLAY=:1 npx playwright test`) for tasks touching the send flow or App routing. The e2e/Electron launches need Bash `dangerouslyDisableSandbox: true` and `DISPLAY=:1`.
- **Git:** one commit per task, straight to `main`, no branching. Commit message body MUST end with exactly: `Co-Authored-By: Claude <noreply@anthropic.com>`.

**Task order:** 1 (svgExtract) → 2 (protocol prompt) → 3 (sendPrompt fallback, consumes Task 1) → 4 (mainView) → 5 (App routing, consumes Task 4).

---

### Task 1: `svgExtract` — recover an SVG from loose model text

**Files:**
- Create: `src/lib/svgExtract.ts`
- Test: `tests/unit/svgExtract.test.ts`

**Interfaces:**
- Produces: `export function extractSvg(text: string): string | null` — returns a complete `<svg…>…</svg>` string recovered from a fenced code block or a bare tag in arbitrary text, else `null`. Text-only; does not validate SVG semantics (callers validate by parsing). Fenced blocks are preferred over a bare match; first match wins.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { extractSvg } from '@/lib/svgExtract'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="a" x="1"/></svg>'

describe('extractSvg', () => {
  it('pulls an svg out of a ```svg fenced block', () => {
    expect(extractSvg('Here is a dog:\n```svg\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls an svg out of a ```xml fenced block', () => {
    expect(extractSvg('```xml\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls an svg out of a plain ``` fence', () => {
    expect(extractSvg('```\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls a bare <svg>…</svg> from prose', () => {
    expect(extractSvg('Sure! ' + SVG + ' Hope that helps.')).toBe(SVG)
  })
  it('returns null when there is no svg', () => {
    expect(extractSvg('I cannot help with that.')).toBeNull()
  })
  it('returns null for an unterminated svg', () => {
    expect(extractSvg('```svg\n<svg><rect/>\n```')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- svgExtract`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/svgExtract.ts`**

```ts
// Recover a complete <svg>…</svg> string from arbitrary model text (fenced or
// bare). Text-only — does not validate SVG semantics; callers should parse it.
export function extractSvg(text: string): string | null {
  const fence = /```(?:svg|xml|html)?\s*\n?([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fence.exec(text)) !== null) {
    const svg = sliceSvg(m[1])
    if (svg) return svg
  }
  return sliceSvg(text)
}

function sliceSvg(s: string): string | null {
  const start = s.search(/<svg[\s>]/i)
  if (start < 0) return null
  const end = s.toLowerCase().lastIndexOf('</svg>')
  if (end < start) return null
  return s.slice(start, end + '</svg>'.length).trim()
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- svgExtract`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/svgExtract.ts tests/unit/svgExtract.test.ts
git commit -m "Add svgExtract to recover SVG from loose model output"$'\n\n'"Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Strengthen the injected edit-protocol prompt

**Files:**
- Modify: `src/lib/promptBuilder.ts` (the `EDIT_PROTOCOL` constant, currently ~lines 10-24)
- Test: `tests/unit/promptBuilder.test.ts` (add one assertion)

**Interfaces:**
- Consumes/Produces: `EDIT_PROTOCOL` stays a `string` export used by `buildMessages` as the system message. Only its content changes; no signature change.

- [ ] **Step 1: Add the failing test** (append to the existing `describe('promptBuilder', …)` block)

```ts
it('protocol forbids fenced/prose SVG and mandates the FILE block for new files', () => {
  expect(EDIT_PROTOCOL).toMatch(/only inside the blocks/i)
  expect(EDIT_PROTOCOL).toMatch(/never in markdown code fences/i)
  expect(EDIT_PROTOCOL).toContain('<<<FILE')
})
```

Ensure `EDIT_PROTOCOL` is imported in the test file (it is already imported in `tests/unit/promptBuilder.test.ts`).

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- promptBuilder`
Expected: FAIL (current EDIT_PROTOCOL lacks the "only inside the blocks" / "never in markdown code fences" wording).

- [ ] **Step 3: Replace the `EDIT_PROTOCOL` constant in `src/lib/promptBuilder.ts`**

```ts
export const EDIT_PROTOCOL = [
  'You edit and create SVG files. A reply may include a short one-line explanation,',
  'but ALL SVG you produce MUST appear ONLY inside the blocks below — never in prose,',
  'never in markdown code fences (no ``` fences), never as a bare tag outside a block.',
  '',
  'To change an existing file, emit one or more blocks of exactly this form:',
  '<<<EDIT',
  'SEARCH:',
  '<exact text copied from the current file>',
  'REPLACE:',
  '<replacement text>',
  '>>>',
  'SEARCH must match the current file byte-for-byte. Prefer minimal edits.',
  '',
  'To create a brand-new file, reply with EXACTLY ONE block (plus at most a one-line',
  'explanation) and put the whole document inside it:',
  '<<<FILE',
  '<the complete <svg>...</svg> document>',
  '>>>',
].join('\n')
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- promptBuilder`
Expected: PASS (existing tests + the new assertion; the existing `toContain(EDIT_PROTOCOL)` test still passes since it references the constant).

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptBuilder.ts tests/unit/promptBuilder.test.ts
git commit -m "Strengthen edit-protocol prompt to forbid fenced/prose SVG"$'\n\n'"Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Fallback-apply extracted SVG in `sendPrompt`

**Files:**
- Modify: `src/store/store.ts` (the `sendPrompt` `attempt()` body and the post-retry message)
- Test: `tests/unit/store.test.ts` (add a `describe('sendPrompt fallback', …)` block)

**Interfaces:**
- Consumes: `extractSvg` from `@/lib/svgExtract` (Task 1); existing `applyEdit` from `@/lib/svgDoc` (validates + returns `{ ok, source }`), `undo`, `debouncedWrite`, `revalidateSelections`.
- Produces: `sendPrompt` now applies a recovered SVG (as a whole-document result) when the model emitted no `<<<EDIT/FILE>>>` blocks, and surfaces a clear error when nothing is applicable.

- [ ] **Step 1: Write the failing tests** (append near the other `sendPrompt` tests)

```ts
describe('sendPrompt fallback (loose SVG)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="dog" r="5"/></svg>'

  const baseClipot = (startStream: unknown) => ({
    keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
    savePrefs: vi.fn().mockResolvedValue(undefined),
    checkpoint: vi.fn().mockResolvedValue('cp'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    saveThread: vi.fn().mockResolvedValue(undefined),
    startStream,
  })

  it('applies an SVG the model returned in a fenced block (no edit/file markers)', async () => {
    const reply = 'Here is a simple illustration of a dog.\n```svg\n' + newSvg + '\n```'
    const startStream = vi.fn((_a, h) => { h.onChunk(reply); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = baseClipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', error: null })

    await useStore.getState().sendPrompt('draw a dog')

    const s = useStore.getState()
    expect(s.source).toBe(newSvg)
    expect(s.editCount).toEqual({ done: 1, total: 1 })
    expect(startStream).toHaveBeenCalledTimes(1) // no retry needed
    expect(s.error).toBeNull()
  })

  it('surfaces an error (not a silent no-op) when the reply has no SVG', async () => {
    const startStream = vi.fn((_a, h) => { h.onChunk('I could not do that.'); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = baseClipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', error: null })

    await useStore.getState().sendPrompt('draw a dog')

    const s = useStore.getState()
    expect(s.source).toBe(svg) // unchanged
    expect(startStream).toHaveBeenCalledTimes(3) // 1 + 2 retries
    expect(s.thread.some((m) => m.error)).toBe(true)
    expect(s.error).toContain('applicable')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- store`
Expected: FAIL — first test: `s.source` still the old svg (fenced SVG ignored); second test: no error surfaced / wrong call count.

- [ ] **Step 3: Edit `src/store/store.ts`**

3a. Add the import near the other lib imports:
```ts
import { extractSvg } from '@/lib/svgExtract'
```

3b. In `attempt()`, add an applied-count tracker. Where `failure`/`streamError` are declared, add:
```ts
let appliedCount = 0
```
In the block-apply success branch (where `applyEdit` returns `r.ok` and `undo.push(r.source)` runs), increment it: add `appliedCount++` alongside the existing `set(...)`/`editCount` update.

3c. Replace the end of `attempt()` (currently the `parser.flush()` try/catch, the assistant-append, and the `return`) with:
```ts
      try {
        parser.flush()
      } catch (e) {
        if (e instanceof IncompleteBlockError) failure = { detail: 'Incomplete edit block' }
      }

      // Fallback: the model produced no applicable blocks and no provider error,
      // but may have returned an SVG in prose/a code fence. Recover and apply it
      // as a whole-document result (validated by applyEdit's FILE path).
      if (appliedCount === 0 && !streamError) {
        const svg = extractSvg(assistantText)
        if (svg) {
          const r = applyEdit(get().source, { kind: 'file', content: svg })
          if (r.ok) {
            undo.push(r.source)
            set((s) => ({
              source: r.source,
              editCount: { done: (s.editCount?.done ?? 0) + 1, total: (s.editCount?.total ?? 0) + 1 },
            }))
            const ap = get().activePath
            if (ap) debouncedWrite(ap, r.source, set)
            get().revalidateSelections()
            appliedCount++
          }
        }
      }

      if (assistantText.trim()) {
        set((s) => ({ thread: [...s.thread, { role: 'assistant', content: assistantText }] }))
      }
      if (streamError) return { kind: 'error', message: streamError }
      return appliedCount > 0 ? { kind: 'ok' } : { kind: 'retry' }
```
(Note: `failure` is no longer read for the return value — a zero-applied attempt is always a retry — but keep the `parser.flush()` catch assigning `failure` harmlessly, or delete the now-unused `failure` variable entirely to satisfy `noUnusedLocals`. Simplest: delete the `let failure` declaration and the `failure = …` assignments in `onChunk`'s malformed-block catch and the flush catch, since the return no longer uses them. The malformed-block catch becomes `catch { return }` and the flush catch becomes an empty `catch {}`.)

3d. Update the retry note in the loop and the post-retry message. Replace the retry loop + retry-exhausted branch:
```ts
    let result = await attempt()
    for (let i = 0; i < 2 && result.kind === 'retry'; i++) {
      result = await attempt(
        'Your previous reply applied no change. Return SVG ONLY inside a <<<FILE>>> block (for a new document) or <<<EDIT>>> blocks (to modify) — never in prose or code fences.',
      )
    }
    if (result.kind === 'error') {
      const msg = result.message
      const isNoKey = /no api key/i.test(msg)
      set((s) => ({
        thread: [
          ...s.thread,
          { role: 'assistant', content: `${PROVIDER_LABELS[st.provider]} request failed:\n${msg}`, error: true },
        ],
        error: isNoKey
          ? `No API key set for ${PROVIDER_LABELS[st.provider]}. Add one in Settings.`
          : `${PROVIDER_LABELS[st.provider]} request failed — see the message log.`,
        threadOpen: true,
      }))
    } else if (result.kind === 'retry') {
      set((s) => ({
        thread: [
          ...s.thread,
          { role: 'assistant', content: "The model didn't return an SVG in an applicable format. Try rephrasing your request.", error: true },
        ],
        error: "The model didn't return an SVG in an applicable format — see the message log.",
        threadOpen: true,
      }))
    }
```
(The `error` branch is unchanged from current code except shown here for context; only the `retry` branch changes — it now writes an error-flagged log entry + strip notice + opens the drawer, matching the provider-error treatment.)

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- store`
Expected: PASS (new fallback tests + all existing store tests). If the existing "surfaces a stream error…" test asserted the retry path text, confirm it still passes (it checks the provider-error path, unaffected).

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (expect all green), then:
```bash
git add src/store/store.ts tests/unit/store.test.ts
git commit -m "Apply SVG recovered from loose model output; surface clear error otherwise"$'\n\n'"Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: `mainView` selector + `hasSvgs`

**Files:**
- Create: `src/lib/mainView.ts`
- Test: `tests/unit/mainView.test.ts`

**Interfaces:**
- Produces:
  - `export function hasSvgs(tree: TreeNode | null): boolean` — true if the tree contains any `.svg` file at any depth.
  - `export type MainView = 'no-folder' | 'new' | 'empty-folder' | 'no-file' | 'canvas'`
  - `export function mainView(args: { folder: string | null; mode: 'edit' | 'new'; activePath: string | null; tree: TreeNode | null }): MainView`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { mainView, hasSvgs } from '@/lib/mainView'
import type { TreeNode } from '../../electron/shared/ipc'

const withSvg: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'a.svg', path: '/f/a.svg', kind: 'file' }] }
const empty: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'notes.txt', path: '/f/notes.txt', kind: 'file' }] }
const nested: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'sub', path: '/f/sub', kind: 'dir', children: [{ name: 'b.svg', path: '/f/sub/b.svg', kind: 'file' }] }] }

describe('hasSvgs', () => {
  it('is false for null / no svgs, true when an svg exists at any depth', () => {
    expect(hasSvgs(null)).toBe(false)
    expect(hasSvgs(empty)).toBe(false)
    expect(hasSvgs(withSvg)).toBe(true)
    expect(hasSvgs(nested)).toBe(true)
  })
})

describe('mainView', () => {
  it('no folder → no-folder (even in new mode)', () => {
    expect(mainView({ folder: null, mode: 'new', activePath: null, tree: null })).toBe('no-folder')
  })
  it('folder + new mode → new', () => {
    expect(mainView({ folder: '/f', mode: 'new', activePath: null, tree: withSvg })).toBe('new')
  })
  it('folder, no active file, no svgs → empty-folder', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: null, tree: empty })).toBe('empty-folder')
  })
  it('folder, no active file, has svgs → no-file', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: null, tree: withSvg })).toBe('no-file')
  })
  it('folder + active file → canvas', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: '/f/a.svg', tree: withSvg })).toBe('canvas')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- mainView`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/mainView.ts`**

```ts
import type { TreeNode } from '../../electron/shared/ipc'

export function hasSvgs(tree: TreeNode | null): boolean {
  if (!tree) return false
  if (tree.kind === 'file') return tree.name.toLowerCase().endsWith('.svg')
  return (tree.children ?? []).some(hasSvgs)
}

export type MainView = 'no-folder' | 'new' | 'empty-folder' | 'no-file' | 'canvas'

export function mainView(args: {
  folder: string | null
  mode: 'edit' | 'new'
  activePath: string | null
  tree: TreeNode | null
}): MainView {
  const { folder, mode, activePath, tree } = args
  if (!folder) return 'no-folder'
  if (mode === 'new') return 'new'
  if (!activePath) return hasSvgs(tree) ? 'no-file' : 'empty-folder'
  return 'canvas'
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- mainView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mainView.ts tests/unit/mainView.test.ts
git commit -m "Add mainView selector and hasSvgs helper for empty-state routing"$'\n\n'"Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Placeholder component + App routing

**Files:**
- Create: `src/components/Placeholder.tsx`
- Modify: `src/App.tsx` (route the main area + gate `PromptBar` via `mainView`), `src/theme.css` (placeholder styles)

**Interfaces:**
- Consumes: `mainView`, `MainView` from `@/lib/mainView` (Task 4); store fields `folder`, `mode`, `activePath`, `tree`, and action `openFolder`.
- Produces: `Placeholder` component (`{ message: string; actionLabel?: string; onAction?: () => void }`).

- [ ] **Step 1: Create `src/components/Placeholder.tsx`**

```tsx
type Props = { message: string; actionLabel?: string; onAction?: () => void }

export default function Placeholder({ message, actionLabel, onAction }: Props) {
  return (
    <div className="canvas-wrap placeholder-view" data-testid="canvas">
      <div className="placeholder-box">
        <p>{message}</p>
        {actionLabel && onAction && <button className="placeholder-action" onClick={onAction}>{actionLabel}</button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `src/theme.css`**

```css
.placeholder-view { display: flex; align-items: center; justify-content: center; }
.placeholder-box { text-align: center; color: var(--text-dim); max-width: 340px; }
.placeholder-box p { margin: 0 0 12px; }
.placeholder-action { background: var(--accent); color: var(--bg); border-radius: 8px; padding: 7px 14px; }
```

- [ ] **Step 3: Wire routing in `src/App.tsx`**

Add imports:
```tsx
import Placeholder from './components/Placeholder'
import { mainView } from '@/lib/mainView'
```
Change the store destructure to include the fields the selector needs (keep `startNewFile`):
```tsx
const { mode, startNewFile, folder, activePath, tree, openFolder } = useStore()
const view = mainView({ folder, mode, activePath, tree })
```
Replace the main-area block:
```tsx
{mode === 'new' ? <NewFileView /> : <CanvasView />}
```
with:
```tsx
{view === 'no-folder' && (
  <Placeholder message="No folder open." actionLabel="Open folder" onAction={openFolder} />
)}
{(view === 'new' || view === 'empty-folder') && <NewFileView />}
{view === 'no-file' && (
  <Placeholder message="Select a file from the sidebar, or press + to create a new one." />
)}
{view === 'canvas' && <CanvasView />}
```
Replace the prompt-bar line:
```tsx
{mode !== 'new' && <PromptBar />}
```
with:
```tsx
{view === 'canvas' && <PromptBar />}
```

- [ ] **Step 4: Verify (headless)**

Run each and confirm success:
- `npx tsc -p tsconfig.json --noEmit` → clean
- `npx tsc -p tsconfig.node.json --noEmit` → clean
- `npx vite build` → succeeds
- `npm test` → all green
- `DISPLAY=:1 npx playwright test` → 1 passed (the e2e opens the folder → `no-file` placeholder, clicks `house.svg` → `canvas` view with `PromptBar`, then edits; confirm it still passes)

(Bash needs `dangerouslyDisableSandbox: true` and `DISPLAY=:1` for the e2e/Electron launch.)

- [ ] **Step 5: Commit**

```bash
git add src/components/Placeholder.tsx src/App.tsx src/theme.css
git commit -m "Route main area to placeholders for no-folder/empty-folder/no-file states"$'\n\n'"Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- §A strengthen protocol prompt → Task 2. ✓
- §B fallback SVG extraction (`extractSvg`) → Task 1. ✓
- §C apply fallback in `sendPrompt` (both modes; appliedCount; reworded no-output message) → Task 3. ✓
- §D new-file flow (no code change; extraction populates `source` so `NewFileView`'s existing filename prompt fires) → covered by Task 3 (verified: new-mode reply with a `<<<FILE>>>` block or fenced SVG both leave `source` set). ✓
- §E empty-state routing (`mainView`/`hasSvgs` + placeholders + PromptBar gating) → Tasks 4 & 5. ✓
- Testing requirements → each task's tests; e2e re-run in Task 5. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/prose-only steps. Every code step shows complete code. Task 3 Step 3 gives the exact edited regions and the `noUnusedLocals` cleanup (delete unused `failure`).

**3. Type consistency:** `extractSvg(text: string): string | null` (Task 1) is consumed with that exact signature in Task 3. `mainView(args)` / `MainView` / `hasSvgs` (Task 4) match their use in Task 5. `applyEdit(source, { kind: 'file', content })` matches the existing `svgDoc` `EditBlock`/`ApplyResult` shape. `Placeholder` props match its usage in App.tsx.

**Note for the implementer:** Task 3 removes the `failure` variable's role in the return decision — make sure `tsc`'s `noUnusedLocals` passes by deleting the now-unused declaration/assignments as described, rather than leaving a dead `let failure`.
