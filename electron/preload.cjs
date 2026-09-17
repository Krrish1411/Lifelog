const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  saveVault: (data) => ipcRenderer.invoke('lifelog:save-vault', data),
  loadVault: () => ipcRenderer.invoke('lifelog:load-vault'),
  saveAttachment: (id, data) => ipcRenderer.invoke('lifelog:save-attachment', { id, data }),
  loadAttachment: (id) => ipcRenderer.invoke('lifelog:load-attachment', id),
  deleteAttachment: (id) => ipcRenderer.invoke('lifelog:delete-attachment', id),
  getStorageInfo: () => ipcRenderer.invoke('lifelog:get-storage-info'),
  openStorageFolder: () => ipcRenderer.invoke('lifelog:open-storage-folder'),
  openTimerPopout: () => ipcRenderer.invoke('lifelog:open-timer-popout'),

  // Native SQLite operations
  dbInit: () => ipcRenderer.invoke('lifelog:db-init'),
  dbLoadAll: () => ipcRenderer.invoke('lifelog:db-load-all'),
  dbSaveRow: (table, row) => ipcRenderer.invoke('lifelog:db-save-row', { table, row }),
  dbDeleteRow: (table, id) => ipcRenderer.invoke('lifelog:db-delete-row', { table, id }),
  dbBatchSave: (table, rows) => ipcRenderer.invoke('lifelog:db-batch-save', { table, rows }),
  dbReconcile: (table, activeIds, idCol) => ipcRenderer.invoke('lifelog:db-reconcile', { table, activeIds, idCol }),
  dbWipeAll: () => ipcRenderer.invoke('lifelog:db-wipe-all'),
  dbExec: (sql) => ipcRenderer.invoke('lifelog:db-exec', sql),
  dbQuery: (sql, params) => ipcRenderer.invoke('lifelog:db-query', { sql, params }),
  dbExportBackup: (customPath) => ipcRenderer.invoke('lifelog:db-export-backup', customPath),
  dbImportBackup: (customPath) => ipcRenderer.invoke('lifelog:db-import-backup', customPath),
});
