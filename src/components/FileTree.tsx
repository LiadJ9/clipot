import { useEffect, useState, type MouseEvent } from 'react'
import { ChevronRight, ChevronDown, FileCode, FolderPlus, FilePlus, FolderOpen } from 'lucide-react'
import type { TreeNode } from '../../electron/shared/ipc'
import { useStore } from '@/store/store'
import { joinPath } from '@/lib/path'
import { promptText } from '@/lib/promptDialog'

const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>'

function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx === -1 ? '' : path.slice(0, idx)
}

type MenuAction = 'rename' | 'duplicate' | 'delete' | 'newFile' | 'newFolder'
type MenuState = { x: number; y: number; node: TreeNode } | null

const FILE_ACTIONS: [MenuAction, string][] = [['rename', 'Rename'], ['duplicate', 'Duplicate'], ['delete', 'Delete']]
const DIR_ACTIONS: [MenuAction, string][] = [['newFile', 'New File'], ['newFolder', 'New Folder'], ['rename', 'Rename'], ['delete', 'Delete']]

async function runAction(action: MenuAction, node: TreeNode, refreshTree: () => Promise<void>) {
  if (action === 'rename') {
    const name = await promptText('Rename to', node.name)
    if (!name || name === node.name) return
    await window.clipot.rename(node.path, joinPath(dirOf(node.path), name))
  } else if (action === 'duplicate') {
    await window.clipot.duplicate(node.path)
  } else if (action === 'delete') {
    if (!confirm(`Delete "${node.name}"?`)) return
    await window.clipot.remove(node.path)
  } else if (action === 'newFile') {
    const name = await promptText('New file name', 'untitled.svg')
    if (!name) return
    const fileName = name.toLowerCase().endsWith('.svg') ? name : `${name}.svg`
    await window.clipot.createFile(joinPath(node.path, fileName), EMPTY_SVG)
  } else if (action === 'newFolder') {
    const name = await promptText('New folder name')
    if (!name) return
    await window.clipot.createDir(joinPath(node.path, name))
  }
  await refreshTree()
}

function Node({ node, depth, onMenu }: { node: TreeNode; depth: number; onMenu: (e: MouseEvent<HTMLDivElement>, node: TreeNode) => void }) {
  const [open, setOpen] = useState(true)
  const { activePath, openFile, refreshTree } = useStore()
  const pad = { paddingLeft: 8 + depth * 12 }

  if (node.kind === 'dir') {
    return (
      <div>
        <div
          className="row"
          style={pad}
          onClick={() => setOpen(!open)}
          onContextMenu={(e) => onMenu(e, node)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault()
            const path = e.dataTransfer.getData('text/path')
            if (path && path !== node.path) { await window.clipot.move(path, node.path); await refreshTree() }
          }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<span>{node.name}</span>
        </div>
        {open && node.children?.map((c) => <Node key={c.path} node={c} depth={depth + 1} onMenu={onMenu} />)}
      </div>
    )
  }
  return (
    <div className={`row${activePath === node.path ? ' active' : ''}`} style={pad}
      draggable onDragStart={(e) => e.dataTransfer.setData('text/path', node.path)}
      onClick={() => openFile(node.path)}
      onContextMenu={(e) => onMenu(e, node)}>
      <FileCode size={12} /><span>{node.name}</span>
    </div>
  )
}

export default function FileTree() {
  const { folder, tree, openFolder, refreshTree } = useStore()
  const [menu, setMenu] = useState<MenuState>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  if (!folder) return <button style={{ margin: 10 }} onClick={openFolder}><FolderOpen size={14} /> Open folder</button>

  const newAtRoot = (action: 'newFile' | 'newFolder') => { if (tree) runAction(action, tree, refreshTree) }

  return (
    <div>
      <div className="hd" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 11px', color: 'var(--text-ghost)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
        <span>Files</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <FilePlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFile')} />
          <FolderPlus size={12} style={{ cursor: 'pointer' }} onClick={() => newAtRoot('newFolder')} />
        </span>
      </div>
      {tree && <Node node={tree} depth={0} onMenu={(e, node) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, node }) }} />}
      {menu && (
        <div className="menu" style={{ top: menu.y, left: menu.x }}>
          {(menu.node.kind === 'dir' ? DIR_ACTIONS : FILE_ACTIONS).map(([action, label]) => (
            <div key={action} className="menu-item" onClick={() => { runAction(action, menu.node, refreshTree); setMenu(null) }}>{label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
