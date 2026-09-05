const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const APP_ID = 'com.teacherworkbench.desktop'
const APP_TITLE = '初中数学班主任工作台'
let mainWindow = null

app.setAppUserModelId(APP_ID)

function createMainWindow() {
  const entryFile = path.join(__dirname, '..', 'dist', 'index.html')
  const allowedEntryUrl = pathToFileURL(entryFile).toString()

  mainWindow = new BrowserWindow({
    title: APP_TITLE,
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F5F7FB',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== allowedEntryUrl && !url.startsWith(`${allowedEntryUrl}#`)) event.preventDefault()
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  void mainWindow.loadFile(entryFile)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    createMainWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
