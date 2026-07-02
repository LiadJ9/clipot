import { contextBridge, ipcRenderer } from 'electron'
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
}
contextBridge.exposeInMainWorld('clipot', api)
