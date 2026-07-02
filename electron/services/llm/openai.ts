import type { Provider, StreamArgs } from './types'
import { readSse } from './sse'

export function parseOpenAiEvents(dataLines: string[]): string[] {
  const out: string[] = []
  for (const d of dataLines) {
    if (d === '[DONE]') continue
    try { const ev = JSON.parse(d); const t = ev.choices?.[0]?.delta?.content; if (t) out.push(t) } catch {}
  }
  return out
}

export const openai: Provider = {
  id: 'openai',
  supportsVision: () => true,
  async *stream({ model, messages, apiKey }: StreamArgs) {
    const msgs = messages.map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [{ type: 'text', text: m.content }, ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.dataBase64}` } }))]
        : m.content,
    }))
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, stream: true, messages: msgs }),
    })
    if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    for await (const d of readSse(res.body)) for (const t of parseOpenAiEvents([d])) yield t
  },
}
