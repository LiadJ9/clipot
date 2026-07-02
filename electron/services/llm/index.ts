import type { Provider, ProviderId } from './types'
import { anthropic } from './anthropic'
// openai, gemini, ollama added in Task 13
export const PROVIDERS: Partial<Record<ProviderId, Provider>> = { anthropic }
export function capabilityFor(id: ProviderId, model: string): { vision: boolean } {
  return { vision: PROVIDERS[id]?.supportsVision(model) ?? false }
}
