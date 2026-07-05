import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CH, type ClipotApi } from './shared/ipc'

const api: ClipotApi = {
  pickFolder: () => ipcRenderer.invoke(CH.pickFolder),
  readTree: (root) => ipcRenderer.invoke(CH.readTree, root),
  readFile: (p) => ipcRenderer.invoke(CH.readFile, p),
  writeFile: (p, c) => ipcRenderer.invoke(CH.writeFile, p, c),
  createFile: (p, c) => ipcRenderer.invoke(CH.createFile, p, c),
  createDir: (p) => ipcRenderer.invoke(CH.createDir, p),
  rename: (from, to) => ipcRenderer.invoke(CH.rename, from, to),
  move: (from, dir) => ipcRenderer.invoke(CH.move, from, dir),
  remove: (p) => ipcRenderer.invoke(CH.remove, p),
  duplicate: (p) => ipcRenderer.invoke(CH.duplicate, p),
  onTreeChanged: (cb) => {
    const h = () => cb()
    ipcRenderer.on(CH.treeChanged, h)
    return () => ipcRenderer.off(CH.treeChanged, h)
  },
  keyStatus: () => ipcRenderer.invoke(CH.keyStatus),
  setKey: (provider, value) => ipcRenderer.invoke(CH.setKey, provider, value),
  checkpoint: (folder, filePath, source, promptSlug) => ipcRenderer.invoke(CH.checkpoint, folder, filePath, source, promptSlug),
  listCheckpoints: (folder, filePath) => ipcRenderer.invoke(CH.listCheckpoints, folder, filePath),
  loadThread: (folder, filePath) => ipcRenderer.invoke(CH.loadThread, folder, filePath),
  saveThread: (folder, filePath, messages) => ipcRenderer.invoke(CH.saveThread, folder, filePath, messages),
  loadRules: (folder) => ipcRenderer.invoke(CH.loadRules, folder),
  saveRules: (folder, content) => ipcRenderer.invoke(CH.saveRules, folder, content),
  startStream: (args, handlers) => {
    let runId: number | null = null
    let stopped = false
    const onChunk = (_e: IpcRendererEvent, id: number, text: string) => { if (id === runId) handlers.onChunk(text) }
    const onDone = (_e: IpcRendererEvent, id: number) => { if (id === runId) { handlers.onDone(); cleanup() } }
    const onError = (_e: IpcRendererEvent, id: number, message: string) => { if (id === runId) { handlers.onError(message); cleanup() } }
    const cleanup = () => {
      ipcRenderer.off(CH.llmChunk, onChunk)
      ipcRenderer.off(CH.llmDone, onDone)
      ipcRenderer.off(CH.llmError, onError)
    }
    ipcRenderer.on(CH.llmChunk, onChunk)
    ipcRenderer.on(CH.llmDone, onDone)
    ipcRenderer.on(CH.llmError, onError)
    ipcRenderer.invoke(CH.llmStart, args).then((id: number) => {
      if (stopped) { ipcRenderer.send(CH.llmStop, id); return }
      runId = id
    })
    return () => {
      stopped = true
      cleanup()
      if (runId !== null) ipcRenderer.send(CH.llmStop, runId)
    }
  },
  listModels: (provider) => ipcRenderer.invoke(CH.listModels, provider),
  watchFolder: (path) => ipcRenderer.invoke(CH.watchFolder, path),
  loadPrefs: () => ipcRenderer.invoke(CH.loadPrefs),
  savePrefs: (prefs) => ipcRenderer.invoke(CH.savePrefs, prefs),
}
contextBridge.exposeInMainWorld('clipot', api)
