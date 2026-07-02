import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
const stem = (f: string) => basename(f, extname(f))
const histDir = (folder: string, f: string) => join(folder, '.clipot', 'history', stem(f))
const threadFile = (folder: string, f: string) => join(folder, '.clipot', 'threads', `${stem(f)}.json`)

export async function checkpoint(folder: string, filePath: string, source: string, promptSlug: string): Promise<string> {
  const dir = histDir(folder, filePath)
  await mkdir(dir, { recursive: true })
  const existing = await readdir(dir).catch(() => [])
  const n = String(existing.length + 1).padStart(3, '0')
  const slug = promptSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'edit'
  const path = join(dir, `${n}-${slug}.svg`)
  await writeFile(path, source, 'utf8')
  return path
}

export async function listCheckpoints(folder: string, filePath: string) {
  const dir = histDir(folder, filePath)
  const files = await readdir(dir).catch(() => [])
  return files.filter((f) => f.endsWith('.svg')).sort().map((f) => ({ path: join(dir, f), label: f.replace(/\.svg$/, '') }))
}

export async function saveThread(folder: string, filePath: string, messages: ChatMessage[]): Promise<void> {
  const f = threadFile(folder, filePath)
  await mkdir(join(folder, '.clipot', 'threads'), { recursive: true })
  await writeFile(f, JSON.stringify(messages, null, 2), 'utf8')
}

export async function loadThread(folder: string, filePath: string): Promise<ChatMessage[]> {
  try { return JSON.parse(await readFile(threadFile(folder, filePath), 'utf8')) } catch { return [] }
}

export async function loadRules(folder: string): Promise<string | null> {
  try { return await readFile(join(folder, '.clipot', 'rules.md'), 'utf8') } catch { return null }
}
