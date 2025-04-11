const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const dataFilePath = path.join(app.getPath('userData'), 'notetron-data.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 650,
    minHeight: 500,
    backgroundColor: '#0c141f',
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Create custom menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('create-new-note');
          }
        },
        { type: 'separator' },
        {
          label: 'Export/Import',
          click: () => {
            mainWindow.webContents.send('show-export-import');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About NoteTRON',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About NoteTRON',
              message: 'NoteTRON v1.2.0',
              detail: 'A simple note-taking app.\n\nCreate. Label. Use.',
              buttons: ['OK'],
              icon: path.join(__dirname, 'assets/icon.png')
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-notes', async () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(data);
    }
    return { notes: [], categories: [{ id: 'all', name: 'All Notes' }] };
  } catch (error) {
    console.error('Error reading notes:', error);
    return { notes: [], categories: [{ id: 'all', name: 'All Notes' }] };
  }
});

ipcMain.handle('save-notes', async (event, notesData) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(notesData), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving notes:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-notes', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Notes',
      defaultPath: 'notetron-backup.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (filePath) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      fs.writeFileSync(filePath, data, 'utf8');
      return { success: true, filePath };
    }
    return { success: false, error: 'Export cancelled' };
  } catch (error) {
    console.error('Error exporting notes:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-notes', async (event, importData) => {
  try {
    // Validate importData is properly formatted
    if (!importData.notes || !Array.isArray(importData.notes)) {
      return { success: false, error: 'Invalid import data format' };
    }
    
    // If current data exists, merge it with import data
    let currentData = { notes: [], categories: [{ id: 'all', name: 'All Notes' }] };
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      currentData = JSON.parse(data);
    }
    
    // Merge notes arrays, avoiding duplicates based on ID
    const existingIds = new Set(currentData.notes.map(note => note.id));
    const newNotes = importData.notes.filter(note => !existingIds.has(note.id));
    currentData.notes = [...currentData.notes, ...newNotes];
    
    // Merge categories, avoiding duplicates based on ID
    if (importData.categories && Array.isArray(importData.categories)) {
      const existingCategoryIds = new Set(currentData.categories.map(cat => cat.id));
      const newCategories = importData.categories.filter(cat => !existingCategoryIds.has(cat.id) && cat.id !== 'all');
      currentData.categories = [...currentData.categories, ...newCategories];
    }
    
    // Save merged data
    fs.writeFileSync(dataFilePath, JSON.stringify(currentData), 'utf8');
    
    return { 
      success: true, 
      data: currentData,
      stats: { 
        importedNotes: newNotes.length,
        importedCategories: importData.categories ? 
          importData.categories.filter(cat => !existingCategoryIds.has(cat.id) && cat.id !== 'all').length : 0
      }
    };
  } catch (error) {
    console.error('Error importing notes:', error);
    return { success: false, error: error.message };
  }
});