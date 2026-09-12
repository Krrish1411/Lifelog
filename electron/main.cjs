const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let popoutWindow = null;

// Ensure persistent local storage directory
function getStoragePaths() {
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) {
    fs.mkdirSync(userData, { recursive: true });
  }
  const vaultFile = path.join(userData, 'lifelog-vault.json');
  return { dir: userData, file: vaultFile };
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
    icon: path.join(__dirname, '../public/icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
    icon: path.join(__dirname, '../public/icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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

// 3. Return native storage directory info
ipcMain.handle('lifelog:get-storage-info', async () => {
  const paths = getStoragePaths();
  return {
    dir: paths.dir,
    file: paths.file,
    platform: process.platform,
  };
});

// 4. Open native storage directory in OS File Explorer / Finder / File Manager
ipcMain.handle('lifelog:open-storage-folder', async () => {
  const { dir } = getStoragePaths();
  await shell.openPath(dir);
  return true;
});

// 5. Open Timer Popout
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
