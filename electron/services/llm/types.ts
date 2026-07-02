import type { ProviderId } from '../vault'
export type { ProviderId } from '../vault'
export type Role = 'system' | 'user' | 'assistant'
export type ImageBlock = { mime: string; dataBase64: string }
export type LlmMessage = { role: Role; content: string; images?: ImageBlock[] }
export type StreamArgs = { model: string; messages: LlmMessage[]; apiKey: string }
export interface Provider {
  id: ProviderId
  supportsVision(model: string): boolean
  stream(args: StreamArgs): AsyncIterable<string>
}
