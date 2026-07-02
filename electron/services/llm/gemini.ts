import type { Provider, StreamArgs } from './types'
import { readSse } from './sse'

export function parseGeminiEvents(dataLines: string[]): string[] {
  const out: string[] = []
  for (const d of dataLines) {
    try { const ev = JSON.parse(d); const t = ev.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ; if (t) out.push(t) } catch {}
  }
  return out
}

export const gemini: Provider = {
  id: 'gemini',
  supportsVision: () => true,
  async *stream({ model, messages, apiKey }: StreamArgs) {
    const contents = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }, ...(m.images ?? []).map((i) => ({ inline_data: { mime_type: i.mime, data: i.dataBase64 } }))],
    }))
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents }),
    })
    if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
    for await (const d of readSse(res.body)) for (const t of parseGeminiEvents([d])) yield t
  },
}
