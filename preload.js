const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('readDir', (p) => ipcRenderer.invoke('readDir', p));
contextBridge.exposeInMainWorld('findFbxInDirectory', (p) => ipcRenderer.invoke('findFbxInDirectory', p));
contextBridge.exposeInMainWorld('readFile', (p) => ipcRenderer.invoke('readFile', p));
contextBridge.exposeInMainWorld('getHomedir', () => ipcRenderer.invoke('getHomedir'));
contextBridge.exposeInMainWorld('pickFolder', () => ipcRenderer.invoke('pickFolder'));
contextBridge.exposeInMainWorld('statPath', (p) => ipcRenderer.invoke('statPath', p));
contextBridge.exposeInMainWorld('thumbCacheTryRead', (p) => ipcRenderer.invoke('thumbCacheTryRead', p));
contextBridge.exposeInMainWorld('thumbCacheSave', (payload) => ipcRenderer.invoke('thumbCacheSave', payload));
contextBridge.exposeInMainWorld('exportFavoritesToZip', (filePaths) =>
  ipcRenderer.invoke('exportFavoritesToZip', filePaths)
);
