const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Note operations
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('save-notes', notes),
  
  // Export/Import operations
  exportNotes: () => ipcRenderer.invoke('export-notes'),
  importNotes: (data) => ipcRenderer.invoke('import-notes', data),
  
  // IPC Event listeners
  onCreateNewNote: (callback) => ipcRenderer.on('create-new-note', callback),
  onShowExportImport: (callback) => ipcRenderer.on('show-export-import', callback),
});