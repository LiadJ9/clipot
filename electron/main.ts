import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import chokidar from 'chokidar'
import { CH } from './shared/ipc'
import * as files from './services/files'

const isDev = !!process.env.VITE_DEV_SERVER_URL

let watcher: import('chokidar').FSWatcher | null = null

const currentWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null

function registerIpc() {
  ipcMain.handle(CH.pickFolder, async () => {
    const win = currentWindow()
    if (!win) return null
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return null
    watcher?.close()
    watcher = chokidar.watch(r.filePaths[0], { ignoreInitial: true, ignored: /(^|[/\\])\.clipot/ })
    watcher.on('all', () => currentWindow()?.webContents.send(CH.treeChanged))
    return r.filePaths[0]
  })
  ipcMain.handle(CH.readTree, (_e, root: string) => files.readTree(root))
  ipcMain.handle(CH.readFile, (_e, p: string) => files.readFile(p))
  ipcMain.handle(CH.writeFile, (_e, p: string, c: string) => files.writeFileAtomic(p, c))
  ipcMain.handle(CH.createFile, (_e, p: string, c: string) => files.createFile(p, c))
  ipcMain.handle(CH.createDir, (_e, p: string) => files.createDir(p))
  ipcMain.handle(CH.rename, (_e, from: string, to: string) => files.rename(from, to))
  ipcMain.handle(CH.move, (_e, from: string, dir: string) => files.move(from, dir))
  ipcMain.handle(CH.remove, (_e, p: string) => files.remove(p))
  ipcMain.handle(CH.duplicate, (_e, p: string) => files.duplicateFile(p))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0e0b08',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  else win.loadFile(join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
