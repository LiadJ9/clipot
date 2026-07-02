import { readdir, readFile as fsReadFile, writeFile, rename as fsRename, mkdir, rm, copyFile, stat } from 'node:fs/promises'
import { join, dirname, basename, extname } from 'node:path'

export type TreeNode = { name: string; path: string; kind: 'dir' | 'file'; children?: TreeNode[] }

export async function readTree(root: string): Promise<TreeNode> {
  const entries = await readdir(root, { withFileTypes: true })
  const children: TreeNode[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const p = join(root, e.name)
    if (e.isDirectory()) children.push(await readTree(p))
    else if (extname(e.name).toLowerCase() === '.svg') children.push({ name: e.name, path: p, kind: 'file' })
  }
  children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  return { name: basename(root), path: root, kind: 'dir', children }
}

export const readFile = (p: string) => fsReadFile(p, 'utf8')

export async function writeFileAtomic(p: string, content: string): Promise<void> {
  const tmp = `${p}.clipot-tmp`
  await writeFile(tmp, content, 'utf8')
  await fsRename(tmp, p)
}

export const createFile = (p: string, content: string) => writeFile(p, content, { flag: 'wx' })
export const createDir = (p: string) => mkdir(p, { recursive: false }).then(() => {})
export const rename = (from: string, to: string) => fsRename(from, to)
export const move = (from: string, toDir: string) => fsRename(from, join(toDir, basename(from)))
export const remove = (p: string) => rm(p, { recursive: true, force: true })

export async function duplicateFile(p: string): Promise<string> {
  const ext = extname(p)
  const stem = basename(p, ext)
  const dir = dirname(p)
  let candidate = join(dir, `${stem} copy${ext}`)
  let n = 2
  while (await exists(candidate)) candidate = join(dir, `${stem} copy ${n++}${ext}`)
  await copyFile(p, candidate)
  return candidate
}

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true } catch { return false }
}
