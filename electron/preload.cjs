const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  saveVault: (data) => ipcRenderer.invoke('lifelog:save-vault', data),
  loadVault: () => ipcRenderer.invoke('lifelog:load-vault'),
  getStorageInfo: () => ipcRenderer.invoke('lifelog:get-storage-info'),
  openStorageFolder: () => ipcRenderer.invoke('lifelog:open-storage-folder'),
  openTimerPopout: () => ipcRenderer.invoke('lifelog:open-timer-popout'),
});
