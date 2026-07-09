const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API to the renderer if needed in the future
// (e.g. for close button, notifications, etc.)
contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('hide-window'),
  updateTooltip: (text) => ipcRenderer.send('update-tooltip', text),
  togglePin: () => ipcRenderer.invoke('toggle-pin'),
  confirmResetDay: () => ipcRenderer.invoke('confirm-reset-day')
});
