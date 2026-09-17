const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbManager = require('./db.cjs');

let mainWindow = null;
let popoutWindow = null;

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
  });

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

  // Purge unused display and memory caches when window loses focus or minimizes
  const trimMemory = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.session.clearCache().catch(() => {});
      }
    } catch {}
  };

  mainWindow.on('blur', trimMemory);
  mainWindow.on('minimize', trimMemory);

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
