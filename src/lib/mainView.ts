import type { TreeNode } from '../../electron/shared/ipc'

export function hasSvgs(tree: TreeNode | null): boolean {
  if (!tree) return false
  if (tree.kind === 'file') return tree.name.toLowerCase().endsWith('.svg')
  return (tree.children ?? []).some(hasSvgs)
}

export type MainView = 'no-folder' | 'new' | 'empty-folder' | 'no-file' | 'canvas'

export function mainView(args: {
  folder: string | null
  mode: 'edit' | 'new'
  activePath: string | null
  tree: TreeNode | null
}): MainView {
  const { folder, mode, activePath, tree } = args
  if (!folder) return 'no-folder'
  if (mode === 'new') return 'new'
  if (!activePath) return hasSvgs(tree) ? 'no-file' : 'empty-folder'
  return 'canvas'
}
