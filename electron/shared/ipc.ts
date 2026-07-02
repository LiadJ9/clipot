import type { TreeNode } from '../services/files'

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
}

declare global {
  interface Window { clipot: ClipotApi }
}

export type { TreeNode }
