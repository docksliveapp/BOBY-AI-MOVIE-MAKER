/**
 * Electron Desktop Shell for Microsoft Store (Windows MSIX) & macOS Packaging
 * Hardened with strict contextIsolation, sandbox, and navigation allowlisting.
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#09090b',
    title: 'BOBY AI MOVIE MAKER',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  const serverUrl = process.env.ELECTRON_START_URL;
  if (serverUrl && isSafeExternalUrl(serverUrl)) {
    win.loadURL(serverUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Block unauthorized top-level navigations away from the packaged studio app
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl.startsWith('file://')) return;
    if (serverUrl && navigationUrl.startsWith(serverUrl)) return;
    event.preventDefault();
    if (isSafeExternalUrl(navigationUrl)) {
      shell.openExternal(navigationUrl);
    }
  });

  // Allow only verified HTTPS external links to open in the OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

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
