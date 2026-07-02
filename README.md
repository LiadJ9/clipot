<img src="assets/logo.svg" width="96" alt="clipot logo">

# clipot

Edit local SVGs by pointing, clicking, and asking.

## What is clipot?

clipot is a desktop app for managing a folder of SVG files and editing them through natural-language prompts to an LLM. Open a folder, click elements on the rendered SVG to select them, and they appear as numbered `@n` mentions you can reference in your prompt — the same way coding agents reference files. The model replies with targeted edit blocks that apply to the file live, on the canvas, as they stream in.

Everything is local-first: your SVGs live on disk in a folder you choose, edits are written straight to those files, and history/chat state is stored alongside them in a plain `.clipot/` directory. clipot is provider-agnostic — it talks to Anthropic, OpenAI, and Google Gemini over their HTTP APIs, and to a local Ollama install for fully offline use, with no other backend or account required.

## Features

- **Folder sidebar** — open any folder of SVGs; create, rename, move (drag-and-drop), duplicate, and delete files and folders from a context menu.
- **Inline SVG canvas** — the active file renders as sanitized, live DOM, not a flat image.
- **Click-to-select elements** — click any element to select it; selections get a numbered orange bubble on the canvas and a matching `@n` chip in the prompt bar. Elements without an `id` get one assigned automatically so the model can address them reliably.
- **Region select** — drag a rectangle on the canvas to select every element it touches; if the current model supports vision, a rasterized PNG crop of the region is sent along with the prompt. Text-only models simply skip the image.
- **Prompt bar** — write what you want changed, with your selections attached as context; send, or stop an in-flight generation.
- **Streamed edit-block apply** — the model's edits apply to the file the moment each one arrives, with up to two automatic retries if a block fails to match or produces invalid SVG.
- **Undo / redo / duplicate** — one undo step per applied edit block, plus one-click duplication of the current file.
- **Per-file chat threads & prompt checkpoints** — every file keeps its own persisted conversation, and every prompt run snapshots the file first so you can roll back from the thread drawer.
- **Editable rules** — a rules text (with sensible defaults) is appended to every request; override it per project.
- **Orange-on-near-black UI** — a dedicated dark theme with Space Grotesk and JetBrains Mono, bundled locally.

## Screenshots

> _Screenshots coming soon._

## Installation

### Download a prebuilt package

Once releases are published, grab the package for your platform from the project's Releases page:

- Linux — `.deb` or AppImage
- macOS — `.dmg`
- Windows — `.exe`

### Build from source

Requires Node.js 18 or later.

```bash
npm install

# run in development
npm run dev

# build a distributable package (electron-builder → release/)
npm run build
```

## Dependencies

Runtime dependencies are kept deliberately small: `react`, `react-dom`, `zustand` (state), `lucide-react` (icons), and `chokidar` (file watching). There are no LLM provider SDKs — each provider is called directly over plain HTTP/SSE from the main process. The UI fonts (Space Grotesk and JetBrains Mono) are bundled locally; nothing is fetched from a network at runtime.

## Usage

1. **Open a folder** from the sidebar to browse its SVGs. Create, rename, move, duplicate, or delete files and folders from there.
2. **Click an element** on the canvas to select it. Each selection gets a numbered bubble on the canvas and an `@1`, `@2`, … chip in the prompt bar; click a chip's `×` to remove it.
3. **Region-select** with the toolbar's region tool: drag a box on the canvas to select everything inside it, optionally with an image crop for vision-capable models.
4. **Write a prompt** describing the change and press Send. Edits apply live as they stream in; press Stop to cancel a run in progress.
5. **Undo / redo / duplicate** the active file from the toolbar.
6. **Edit the rules** (toolbar → rules icon) to change the standing instructions sent with every prompt for the open folder.
7. **Roll back to a checkpoint** by opening the thread drawer (chevron in the activity strip) and picking an earlier snapshot for the active file.
8. **Create a new SVG from a prompt** with the `+` button in the titlebar — describe what you want, and clipot generates and saves a new file.

## Quick start per provider

API keys can be entered in the Settings modal (gear icon in the toolbar) or supplied via environment variables. Environment variables always take precedence over a saved key.

### Anthropic
- Get an API key from the [Anthropic Console](https://console.anthropic.com/).
- Set it in Settings, or export `ANTHROPIC_API_KEY`.
- Recommended model: `claude-sonnet-5`.

### OpenAI
- Get an API key from the [OpenAI dashboard](https://platform.openai.com/api-keys).
- Set it in Settings, or export `OPENAI_API_KEY`.
- Recommended model: `gpt-5.2`.

### Google Gemini
- Get an API key from [Google AI Studio](https://aistudio.google.com/).
- Set it in Settings, or export `GEMINI_API_KEY`.
- Recommended model: `gemini-3.0-pro`.

### Ollama (local, offline)
- [Install Ollama](https://ollama.com/) and make sure it's running.
- Pull an editing model: `ollama pull qwen2.5-coder`.
- For region-select image support, also pull a vision model: `ollama pull llama3.2-vision`.
- clipot talks to `http://localhost:11434` by default; set `OLLAMA_HOST` to point at a different host.

## Configuration reference

**Environment variables:**

| Variable | Provider |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENAI_API_KEY` | OpenAI |
| `GEMINI_API_KEY` | Google Gemini |
| `OLLAMA_HOST` | Ollama (defaults to `http://localhost:11434`) |

Keys entered via the Settings modal are encrypted at rest using Electron's `safeStorage`. An environment variable for a given provider always takes precedence over a saved key.

**`.clipot/` folder:** clipot creates a `.clipot/` directory inside any folder you open, to hold per-project state:

```
.clipot/
  history/<file>/NNN-<slug>.svg   # prompt checkpoints, one per run
  threads/<file>.json             # persisted chat thread per file
  rules.md                        # project-level rules override
```

This folder is plain data local to your machine — it's recommended to add `.clipot/` to your project's `.gitignore`.

## License

MIT — see [LICENSE](LICENSE).
