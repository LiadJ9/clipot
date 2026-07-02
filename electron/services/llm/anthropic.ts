import type { Provider, StreamArgs } from './types'
import { readSse } from './sse'

export function parseAnthropicEvents(dataLines: string[]): string[] {
  const out: string[] = []
  for (const d of dataLines) {
    if (d === '[DONE]') continue
    try {
      const ev = JSON.parse(d)
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') out.push(ev.delta.text)
    } catch { /* ignore keep-alives */ }
  }
  return out
}

export const anthropic: Provider = {
  id: 'anthropic',
  supportsVision: () => true,
  async *stream({ model, messages, apiKey }: StreamArgs) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const rest = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role,
      content: [
        ...(m.images ?? []).map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.dataBase64 } })),
        { type: 'text', text: m.content },
      ],
    }))
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8192, stream: true, system, messages: rest }),
    })
    if (!res.ok || !res.body) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    for await (const data of readSse(res.body)) {
      for (const t of parseAnthropicEvents([data])) yield t
    }
  },
}
