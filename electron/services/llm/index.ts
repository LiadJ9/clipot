import type { Provider, ProviderId } from './types'
import { anthropic } from './anthropic'
import { openai } from './openai'
import { gemini } from './gemini'
import { ollama } from './ollama'
export const PROVIDERS: Partial<Record<ProviderId, Provider>> = { anthropic, openai, gemini, ollama }
export function capabilityFor(id: ProviderId, model: string): { vision: boolean } {
  return { vision: PROVIDERS[id]?.supportsVision(model) ?? false }
}
