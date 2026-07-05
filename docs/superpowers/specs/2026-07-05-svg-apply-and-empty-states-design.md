# clipot — Robust SVG application & empty-state routing

**Date:** 2026-07-05
**Status:** Approved (pending user spec review)
**Depends on:** the shipped clipot app (spec `2026-07-02-clipot-design.md`).

## Problem

1. **Model output isn't applied.** clipot only applies SVG the model wraps in its edit-protocol blocks (`<<<FILE>>>` for a new file, `<<<EDIT>>>` for changes). When a model replies conversationally — prose plus SVG in a markdown code fence, or a bare `<svg>…</svg>` — the streaming parser (`src/lib/editStream.ts`) finds zero blocks and applies nothing. `sendPrompt` (`src/store/store.ts`) treats "zero blocks, no provider error" as success: no retry, no error surfaced. In new-file mode, `NewFileView` then reads an empty `source` and silently creates no file. Net effect: the model returns an SVG, but nothing is drawn or saved and no error is shown.

2. **Missing empty states.** `App.tsx` renders `mode === 'new' ? NewFileView : CanvasView`. With a folder open but no SVGs (mode `edit`, nothing open) the user sees a blank white canvas; with no folder selected, also a blank canvas (only the sidebar shows an "Open folder" button). There is no guidance.

## Goals

- The SVG a model returns gets applied/saved even when it ignores the block protocol, in both edit and new-file modes.
- A response that yields no applicable SVG surfaces a clear error instead of a silent no-op.
- Reduce protocol non-compliance at the source by strengthening the injected instructions.
- Route the main area to helpful placeholders for the no-folder, empty-folder, and no-file-open states.

## Non-goals

- Rich SVG validation/repair beyond "does it parse as an `<svg>` document."
- Changing the edit-block protocol itself (still the primary, preferred path).

## Design

### A. Strengthen the injected protocol prompt

Rewrite `EDIT_PROTOCOL` in `src/lib/promptBuilder.ts` to be emphatic and unambiguous:

- SVG must appear **only** inside `<<<EDIT>>>` / `<<<FILE>>>` blocks — never in prose, markdown, or code fences.
- To create a new file, reply with **exactly one** `<<<FILE>>>` block containing a complete `<svg>…</svg>` document, and nothing else outside a short one-line explanation.
- Keep the existing `<<<EDIT>>>` search/replace description.

This is a wording change only; the message is already injected as the `system` message by `buildMessages`.

### B. Fallback SVG extraction

New pure module `src/lib/svgExtract.ts`:

```ts
// Returns a complete <svg>…</svg> string if one can be recovered from arbitrary
// model text (fenced or bare), else null. Does not validate SVG semantics.
export function extractSvg(text: string): string | null
```

- Matches a fenced block (```` ```svg ````, ```` ```xml ````, or a plain ```` ``` ```` fence) whose contents contain `<svg`, OR a bare `<svg…>…</svg>` substring.
- Returns the `<svg…>…</svg>` slice (trimmed). First match wins.
- Callers validate by parsing with `parseSvg` (`svgDoc.ts`); extraction itself is text-only and side-effect-free.

### C. Apply the fallback in `sendPrompt` (both modes)

In `src/store/store.ts` `sendPrompt`'s `attempt()`:

- Track how many edit/file blocks were **applied** this attempt (a local `appliedCount`, incremented where `applyEdit` succeeds).
- After the stream finishes and `parser.flush()` runs, decide:
  - `appliedCount > 0` → `{ kind: 'ok' }` (unchanged).
  - `streamError` set → `{ kind: 'error', message }` (unchanged).
  - otherwise (no blocks applied, no provider error) → **fallback**: `const svg = extractSvg(assistantText)`. If `svg` parses as valid SVG, apply it as a whole-document result exactly like a `<<<FILE>>>` block:
    - `undo.push(svg)`, `set({ source: svg })`, increment `editCount`, debounced autosave when `activePath` is set, `revalidateSelections()`. Return `{ kind: 'ok' }`.
  - if no extractable/valid SVG → `{ kind: 'retry' }` (a firm re-instruction is added on retry, as today).
- The final "still failing after retries" branch appends an accurate assistant log message: *"The model didn't return an SVG in an applicable format. Try rephrasing your request."* (replacing the current generic "Could not apply the requested change…" for this path; the wording covers both no-output and apply-failure cases).

Because a checkpoint is taken before every prompt (existing behavior), an edit-mode whole-document replace from a fallback is undoable.

### D. New-file flow

No structural change to `NewFileView`. With extraction in place, after `sendPrompt` the store `source` is populated (from the `<<<FILE>>>` block or the fallback), so the existing filename prompt fires and `createFile` runs. When the send produced no SVG, `source` stays empty and `NewFileView` returns without prompting (existing guard), and the error message is in the log.

### E. Empty-state routing

Add a pure selector `mainView(args) → 'no-folder' | 'new' | 'empty-folder' | 'no-file' | 'canvas'` (new `src/lib/mainView.ts`, unit-tested), computed from `{ folder, mode, activePath, tree }`, plus a `hasSvgs(tree: TreeNode | null): boolean` helper (recursively true if any `.svg` file exists).

Routing (conditions evaluated top-to-bottom; first match wins — so "no folder" takes precedence even when `mode === 'new'`, i.e. pressing + with no folder open shows the select-folder placeholder):

| Condition | View |
|---|---|
| no folder | `no-folder` |
| folder, `mode === 'new'` | `new` |
| folder, no `activePath`, `!hasSvgs(tree)` | `empty-folder` |
| folder, no `activePath`, `hasSvgs(tree)` | `no-file` |
| folder, `activePath` set | `canvas` |

`App.tsx` renders by view:

- `no-folder` → `SelectFolderPlaceholder`: centered logo + text + an **Open folder** button calling `openFolder`.
- `empty-folder` and `new` → `NewFileView` (the + new-SVG screen).
- `no-file` → `NoFilePlaceholder`: centered *"Select a file from the sidebar, or press + to create a new one."*
- `canvas` → `CanvasView`.

`PromptBar` renders **only** in the `canvas` view (there must be an open file to edit). The placeholders and new-file screen show no prompt bar.

Implement the two placeholders as one small `Placeholder` component (`src/components/Placeholder.tsx`) taking a message and an optional action button, reused for `no-folder` (with the Open-folder action) and `no-file` (no action). Styling uses existing theme tokens.

## Error handling

- Fallback extraction never throws (text scan + guarded `parseSvg`); invalid or absent SVG is treated as "no SVG."
- A response with no applicable output now surfaces a clear message in the message log (via the existing `error`-flagged thread entry + activity-strip notice), never a silent success.
- Empty-state selectors are pure and total (every state maps to exactly one view).

## Testing

- `svgExtract`: fenced ```` ```svg ````, fenced ```` ```xml ````, plain fence, bare `<svg>`, SVG with attributes/namespaces, prose with no SVG (→ null), malformed fragment (→ null or caught by caller's `parseSvg`).
- `mainView` / `hasSvgs`: each routing row above; nested folders with/without `.svg`.
- Store: `sendPrompt` with a non-block SVG reply applies the extracted SVG to `source` (edit mode) and leaves `source` populated for `NewFileView` (new mode); a reply with no SVG at all surfaces an error/retry rather than a silent `ok`.
- Existing unit + e2e suites stay green.

## Files

- Modify: `src/lib/promptBuilder.ts` (protocol wording), `src/store/store.ts` (fallback in `sendPrompt`, `appliedCount`, message wording), `src/App.tsx` (view routing + PromptBar gating).
- Create: `src/lib/svgExtract.ts`, `src/lib/mainView.ts` (+ `hasSvgs`), `src/components/Placeholder.tsx`, and tests `tests/unit/svgExtract.test.ts`, `tests/unit/mainView.test.ts`, plus additions to `tests/unit/store.test.ts`.

## Out of scope / follow-ups

- Auto-opening a file in the `no-file` state (deliberately a placeholder instead).
- Deeper model-output coercion (e.g., extracting partial edits from prose) beyond whole-SVG recovery.
