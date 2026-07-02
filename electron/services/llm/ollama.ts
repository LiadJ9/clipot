import type { Provider, StreamArgs } from './types'

const VISION_HINTS = ['llava', 'llama3.2-vision', 'qwen2.5vl', 'moondream', 'bakllava']

export function parseOllamaLines(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    try { const ev = JSON.parse(l); const t = ev.message?.content; if (t) out.push(t) } catch {}
  }
  return out
}

export async function listOllamaModels(host: string): Promise<string[]> {
  const res = await fetch(`${host.replace(/\/$/, '')}/api/tags`)
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const j = (await res.json()) as { models?: { name: string }[] }
  return (j.models ?? []).map((m) => m.name)
}

export const ollama: Provider = {
  id: 'ollama',
  supportsVision: (model) => VISION_HINTS.some((h) => model.toLowerCase().includes(h)),
  async *stream({ model, messages, apiKey }: StreamArgs) {
    const host = (apiKey || 'http://localhost:11434').replace(/\/$/, '')
    const msgs = messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.images?.length ? { images: m.images.map((i) => i.dataBase64) } : {}),
    }))
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: true, messages: msgs }),
    })
    if (!res.ok || !res.body) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (line) for (const t of parseOllamaLines([line])) yield t
      }
    }
  },
}
