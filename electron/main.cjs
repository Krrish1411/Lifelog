const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let popoutWindow = null;

// Optimize Chromium memory & V8 garbage collection footprint
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Ensure persistent local storage directory and encrypted attachments folder
function getStoragePaths() {
  const userData = app.getPath('userData');
  const attachmentsDir = path.join(userData, 'attachments');
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true });
  }
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }
  const vaultFile = path.join(userData, 'lifelog-vault.json');
  return { dir: userData, file: vaultFile, attachmentsDir };
}

function createMainWindow() {
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  mainWindow = new BrowserWindow({
    title: 'LifeLog',
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#07090e',
    show: false,
    icon: path.join(__dirname, 'icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external web links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('#timer-popout')) {
      createTimerPopoutWindow();
      return { action: 'deny' };
    }
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (popoutWindow) {
      popoutWindow.close();
    }
  });
}

function createTimerPopoutWindow() {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.show();
    popoutWindow.focus();
    return;
  }

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  popoutWindow = new BrowserWindow({
    title: 'LifeLog Timer',
    width: 360,
    height: 480,
    minWidth: 300,
    minHeight: 380,
    backgroundColor: '#07090e',
    alwaysOnTop: true,
    resizable: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    popoutWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#timer-popout`);
  } else {
    popoutWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'timer-popout' });
  }

  popoutWindow.on('closed', () => {
    popoutWindow = null;
  });
}

// ---------------- IPC Storage Handlers ----------------

// 1. Atomically save encrypted vault payload to local filesystem
ipcMain.handle('lifelog:save-vault', async (_event, payload) => {
  try {
    const { dir, file } = getStoragePaths();
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, file);
    return { success: true, path: file };
  } catch (err) {
    console.error('Failed to write vault to local disk:', err);
    return { success: false, error: String(err) };
  }
});

// 2. Read encrypted vault payload from local filesystem
ipcMain.handle('lifelog:load-vault', async () => {
  try {
    const { file } = getStoragePaths();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return data;
    }
    return null;
  } catch (err) {
    console.error('Failed to read vault from local disk:', err);
    return null;
  }
});

// 3. Save individual encrypted attachment to dedicated attachments directory
ipcMain.handle('lifelog:save-attachment', async (_event, { id, data }) => {
  try {
    const { attachmentsDir } = getStoragePaths();
    const safeId = path.basename(id);
    const targetFile = path.join(attachmentsDir, `${safeId}.enc`);
    const tempFile = `${targetFile}.tmp`;
    fs.writeFileSync(tempFile, data, 'utf8');
    fs.renameSync(tempFile, targetFile);
    return { success: true, path: targetFile };
  } catch (err) {
    console.error('Failed to write encrypted attachment to disk:', err);
    return { success: false, error: String(err) };
  }
});

// 4. Load individual encrypted attachment from dedicated attachments directory
ipcMain.handle('lifelog:load-attachment', async (_event, id) => {
  try {
    const { attachmentsDir } = getStoragePaths();
    const safeId = path.basename(id);
    const targetFile = path.join(attachmentsDir, `${safeId}.enc`);
    if (fs.existsSync(targetFile)) {
      return fs.readFileSync(targetFile, 'utf8');
    }
    return null;
  } catch (err) {
    console.error('Failed to read encrypted attachment from disk:', err);
    return null;
  }
});

// 5. Delete individual encrypted attachment from disk
ipcMain.handle('lifelog:delete-attachment', async (_event, id) => {
  try {
    const { attachmentsDir } = getStoragePaths();
    const safeId = path.basename(id);
    const targetFile = path.join(attachmentsDir, `${safeId}.enc`);
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to delete encrypted attachment from disk:', err);
    return { success: false, error: String(err) };
  }
});

// 6. Return native storage directory info
ipcMain.handle('lifelog:get-storage-info', async () => {
  const paths = getStoragePaths();
  return {
    dir: paths.dir,
    file: paths.file,
    attachmentsDir: paths.attachmentsDir,
    platform: process.platform,
  };
});

// 7. Open native storage directory in OS File Explorer / Finder / File Manager
ipcMain.handle('lifelog:open-storage-folder', async () => {
  const { dir } = getStoragePaths();
  await shell.openPath(dir);
  return true;
});

// 8. Open Timer Popout
ipcMain.handle('lifelog:open-timer-popout', async () => {
  createTimerPopoutWindow();
  return true;
});

// ---------------- App Lifecycle ----------------

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
