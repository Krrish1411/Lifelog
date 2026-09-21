const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const dbManager = require('./db.cjs');

let mainWindow = null;
let popoutWindow = null;
let tray = null;
let isQuitting = false;

// Single Instance Lock: Prevent multiple processes and restore existing window on second launch
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    restoreAndFocusApp();
  });
}

function restoreAndFocusApp() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    return;
  }
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    if (popoutWindow.isMinimized()) popoutWindow.restore();
    if (!popoutWindow.isVisible()) popoutWindow.show();
    popoutWindow.focus();
    return;
  }
  createMainWindow();
}

function trimMemory() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearCache().catch(() => {});
      mainWindow.webContents.session.clearStorageData({ storages: ['cachestorage'] }).catch(() => {});
    }
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.webContents.session.clearCache().catch(() => {});
    }
  } catch {}
}

function getTrayIconPath() {
  try {
    const userData = app.getPath('userData');
    const diskIconPath = path.join(userData, 'tray-icon.png');
    const bundledIconPath = path.join(__dirname, 'icons/icon.png');

    if (fs.existsSync(bundledIconPath)) {
      try {
        const iconBuffer = fs.readFileSync(bundledIconPath);
        fs.writeFileSync(diskIconPath, iconBuffer);
        return diskIconPath;
      } catch (e) {
        console.warn('Could not cache tray icon to disk:', e);
      }
    }
    if (fs.existsSync(diskIconPath)) {
      return diskIconPath;
    }
  } catch (e) {
    console.warn('Error resolving tray icon path:', e);
  }
  return path.join(__dirname, 'icons/icon.png');
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;

  try {
    const iconPath = getTrayIconPath();
    if (!fs.existsSync(iconPath)) {
      console.warn('System tray icon not found at:', iconPath);
      return;
    }

    // On Linux with libappindicator / GNOME AppIndicator, a physical filesystem path is required over D-Bus
    let trayIcon;
    try {
      if (process.platform === 'linux') {
        trayIcon = iconPath;
      } else {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
      }
      tray = new Tray(trayIcon);
    } catch (createErr) {
      console.warn('Primary tray icon failed, falling back to nativeImage:', createErr);
      const img = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
      tray = new Tray(img);
    }

    tray.setToolTip('LifeLog — Sovereign Personal OS');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open LifeLog',
        click: () => restoreAndFocusApp(),
      },
      {
        label: 'Open Floating Timer',
        click: () => createTimerPopoutWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit LifeLog',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      restoreAndFocusApp();
    });

    tray.on('double-click', () => {
      restoreAndFocusApp();
    });
  } catch (err) {
    console.error('Could not create system tray indicator:', err);
  }
}

// Optimize Chromium memory and V8 garbage collection footprint without degrading display quality
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('renderer-process-limit', '1');

// Anti-theft: Disable remote debugging ports in production builds
if (app.isPackaged || process.env.NODE_ENV === 'production') {
  app.commandLine.removeSwitch('remote-debugging-port');
  app.commandLine.removeSwitch('inspect');
  app.commandLine.removeSwitch('inspect-brk');
}

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
  const sqliteFile = path.join(userData, 'lifelog.sqlite3');
  return { dir: userData, file: vaultFile, sqliteFile, attachmentsDir };
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    return;
  }

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
      devTools: isDev,
    },
  });

  // Anti-theft: Lock out DevTools, View Source, and Inspect Element in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key === 'F12' ||
        ((input.control || input.meta) && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
        ((input.control || input.meta) && input.key.toLowerCase() === 'u')
      ) {
        event.preventDefault();
      }
    });

    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Safety fallback: Ensure main window is shown even if ready-to-show event is missed or delayed on Linux
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);

  // Open external web links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('#timer-popout')) {
      createTimerPopoutWindow();
      return { action: 'deny' };
    }
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
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

  mainWindow.on('blur', trimMemory);
  mainWindow.on('minimize', trimMemory);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      trimMemory();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.close();
    }
  });
}

function createTimerPopoutWindow() {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    if (popoutWindow.isMinimized()) popoutWindow.restore();
    if (!popoutWindow.isVisible()) popoutWindow.show();
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
      devTools: isDev,
    },
  });

  if (!isDev) {
    popoutWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key === 'F12' ||
        ((input.control || input.meta) && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
        ((input.control || input.meta) && input.key.toLowerCase() === 'u')
      ) {
        event.preventDefault();
      }
    });

    popoutWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    popoutWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#timer-popout`);
  } else {
    popoutWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'timer-popout' });
  }

  // Hide main window completely from Alt+Tab and taskbar while floating timer is active
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    trimMemory();
  }

  popoutWindow.on('closed', () => {
    popoutWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
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
    sqliteFile: paths.sqliteFile,
    attachmentsDir: paths.attachmentsDir,
    platform: process.platform,
    isPortable: !!process.env.PORTABLE_EXECUTABLE_DIR,
    isAppImage: !!process.env.APPIMAGE,
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

// 9. Focus / restore main window from popout or tray
ipcMain.handle('lifelog:focus-main-window', async () => {
  restoreAndFocusApp();
  return true;
});

// 10. Hide / minimize main window to conserve RAM and CPU
ipcMain.handle('lifelog:hide-main-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    trimMemory();
    return true;
  }
  return false;
});

// ---------------- SQLite Native IPC Handlers ----------------

ipcMain.handle('lifelog:db-init', async () => {
  try {
    const { sqliteFile } = getStoragePaths();
    dbManager.initDatabase(sqliteFile);
    return { success: true, path: sqliteFile };
  } catch (err) {
    console.error('Database init error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-load-all', async () => {
  try {
    return dbManager.loadAllData();
  } catch (err) {
    console.error('Database loadAll error:', err);
    return null;
  }
});

ipcMain.handle('lifelog:db-save-row', async (_event, { table, row }) => {
  try {
    dbManager.saveRow(table, row);
    return { success: true };
  } catch (err) {
    console.error(`Database saveRow error for ${table}:`, err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-delete-row', async (_event, { table, id }) => {
  try {
    dbManager.deleteRow(table, id);
    return { success: true };
  } catch (err) {
    console.error(`Database deleteRow error for ${table}:`, err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-batch-save', async (_event, { table, rows }) => {
  try {
    dbManager.batchSave(table, rows);
    return { success: true };
  } catch (err) {
    console.error(`Database batchSave error for ${table}:`, err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-exec', async (_event, sql) => {
  try {
    dbManager.execSql(sql);
    return { success: true };
  } catch (err) {
    console.error('Database exec error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-query', async (_event, { sql, params }) => {
  try {
    return dbManager.queryAll(sql, params);
  } catch (err) {
    console.error('Database query error:', err);
    return [];
  }
});

ipcMain.handle('lifelog:db-reconcile', async (_event, { table, activeIds, idCol }) => {
  try {
    dbManager.reconcileTable(table, activeIds, idCol);
    return { success: true };
  } catch (err) {
    console.error(`Database reconcile error for ${table}:`, err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('lifelog:db-wipe-all', async () => {
  try {
    dbManager.wipeDatabase();
    const { file } = getStoragePaths();
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
    return { success: true };
  } catch (err) {
    console.error('Database wipe error:', err);
    return { success: false, error: String(err) };
  }
});


// 9. Export portable encrypted backup (.lifelog or .sqlite3)
ipcMain.handle('lifelog:db-export-backup', async (_event, customPath) => {
  try {
    let targetPath = customPath;
    if (!targetPath) {
      const now = new Date().toISOString().slice(0, 10);
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Export LifeLog Vault Backup',
        defaultPath: `lifelog_backup_${now}.lifelog`,
        filters: [
          { name: 'LifeLog Backup (*.lifelog)', extensions: ['lifelog'] },
          { name: 'SQLite Database (*.sqlite3, *.db)', extensions: ['sqlite3', 'db'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (res.canceled || !res.filePath) {
        return { canceled: true };
      }
      targetPath = res.filePath;
    }
    return dbManager.exportBackup(targetPath);
  } catch (err) {
    console.error('Database exportBackup error:', err);
    return { success: false, error: String(err) };
  }
});

// 10. Import portable encrypted backup (.lifelog or .sqlite3)
ipcMain.handle('lifelog:db-import-backup', async (_event, customPath) => {
  try {
    let sourcePath = customPath;
    if (!sourcePath) {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Import LifeLog Vault Backup',
        filters: [
          { name: 'LifeLog Backup (*.lifelog, *.sqlite3, *.db)', extensions: ['lifelog', 'sqlite3', 'db'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return { canceled: true };
      }
      sourcePath = res.filePaths[0];
    }
    return dbManager.importBackup(sourcePath);
  } catch (err) {
    console.error('Database importBackup error:', err);
    return { success: false, error: String(err) };
  }
});

// ---------------- App Lifecycle ----------------

app.whenReady().then(() => {
  try {
    const { sqliteFile } = getStoragePaths();
    dbManager.initDatabase(sqliteFile);
  } catch (err) {
    console.error('Failed to pre-init SQLite database:', err);
  }

  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform === 'darwin') {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});
