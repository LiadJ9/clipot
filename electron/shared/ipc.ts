import type { TreeNode } from '../services/files'
import type { ProviderId } from '../services/vault'
import type { LlmMessage } from '../services/llm/types'
import type { Prefs } from '../services/prefs'

export type { Prefs } from '../services/prefs'
export type ThreadMessage = { role: 'system' | 'user' | 'assistant'; content: string; error?: boolean }

export const CH = {
  pickFolder: 'files:pickFolder',
  readTree: 'files:readTree',
  readFile: 'files:readFile',
  writeFile: 'files:writeFile',
  createFile: 'files:createFile',
  createDir: 'files:createDir',
  rename: 'files:rename',
  move: 'files:move',
  remove: 'files:remove',
  duplicate: 'files:duplicate',
  treeChanged: 'files:treeChanged',
  keyStatus: 'vault:keyStatus',
  setKey: 'vault:setKey',
  checkpoint: 'history:checkpoint',
  listCheckpoints: 'history:listCheckpoints',
  loadThread: 'history:loadThread',
  saveThread: 'history:saveThread',
  loadRules: 'history:loadRules',
  saveRules: 'history:saveRules',
  llmStart: 'llm:start',
  llmStop: 'llm:stop',
  llmChunk: 'llm:chunk',
  llmDone: 'llm:done',
  llmError: 'llm:error',
  listModels: 'llm:listModels',
  watchFolder: 'files:watchFolder',
  loadPrefs: 'prefs:load',
  savePrefs: 'prefs:save',
} as const

export interface ClipotApi {
  pickFolder(): Promise<string | null>
  readTree(root: string): Promise<TreeNode>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string, content: string): Promise<void>
  createDir(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  move(from: string, toDir: string): Promise<void>
  remove(path: string): Promise<void>
  duplicate(path: string): Promise<string>
  onTreeChanged(cb: () => void): () => void
  keyStatus(): Promise<Record<ProviderId, boolean>>
  setKey(provider: ProviderId, value: string): Promise<void>
  checkpoint(folder: string, filePath: string, source: string, promptSlug: string): Promise<string>
  listCheckpoints(folder: string, filePath: string): Promise<{ path: string; label: string }[]>
  loadThread(folder: string, filePath: string): Promise<ThreadMessage[]>
  saveThread(folder: string, filePath: string, messages: ThreadMessage[]): Promise<void>
  loadRules(folder: string): Promise<string | null>
  saveRules(folder: string, content: string): Promise<void>
  startStream(
    args: { provider: ProviderId; model: string; messages: LlmMessage[] },
    handlers: { onChunk: (text: string) => void; onDone: () => void; onError: (message: string) => void }
  ): () => void
  listModels(provider: ProviderId): Promise<string[]>
  watchFolder(path: string): Promise<void>
  loadPrefs(): Promise<Prefs>
  savePrefs(prefs: Prefs): Promise<void>
}

declare global {
  interface Window { clipot: ClipotApi }
}

export type { TreeNode, ProviderId }
