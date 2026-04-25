const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const archiver = require('archiver');

/** @param {string} filePath @param {Set<string>} used */
function nextUniqueZipEntryName(filePath, used) {
  const base = path.basename(filePath);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let n = 2;
  let name;
  do {
    name = `${stem} (${n})${ext}`;
    n += 1;
  } while (used.has(name));
  used.add(name);
  return name;
}

let thumbCacheDirPrimed = null;
function getThumbCacheDir() {
  if (!thumbCacheDirPrimed) {
    thumbCacheDirPrimed = path.join(app.getPath('userData'), 'fbx-viewer-thumb-cache');
  }
  return thumbCacheDirPrimed;
}

async function ensureThumbCacheDir() {
  await fs.promises.mkdir(getThumbCacheDir(), { recursive: true });
}

/** Stable path for hashing so cache survives restarts (Windows casing, symlinks). */
async function canonicalFilePathForCache(filePath) {
  const resolved = path.resolve(String(filePath));
  let real;
  try {
    real = await fs.promises.realpath(resolved);
  } catch {
    return null;
  }
  if (process.platform === 'win32') {
    return real.replace(/\//g, '\\').toLowerCase();
  }
  return real;
}

function makeThumbCacheKey(canonicalPath, mtimeMs, size) {
  return crypto
    .createHash('sha256')
    .update(`${canonicalPath}\0${mtimeMs}\0${size}`, 'utf8')
    .digest('hex')
    .slice(0, 48);
}

const APP_ICON = path.join(__dirname, 'images', 'logo.png');

function setAppIconOnDock() {
  if (process.platform === 'darwin' && app.dock) {
    try {
      if (fs.existsSync(APP_ICON)) {
        app.dock.setIcon(nativeImage.createFromPath(APP_ICON));
      }
    } catch {
      /* ignore */
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1a1b22',
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow unpkg if local three is missing; not needed for file:// from node_modules.
      webSecurity: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('readDir', async (event, dirPath) => {
  const abs = path.resolve(String(dirPath));
  const stat = await fs.promises.stat(abs).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    return [];
  }
  const entries = await fs.promises.readdir(abs, { withFileTypes: true });
  return entries.map((d) => ({
    name: d.name,
    isDirectory: d.isDirectory(),
    path: path.join(abs, d.name)
  }));
});

/** Recursively find .fbx files under dirPath. Each entry includes label (path relative to dirPath) for display. */
ipcMain.handle('findFbxInDirectory', async (event, dirPath) => {
  const absRoot = path.resolve(String(dirPath));
  const st = await fs.promises.stat(absRoot).catch(() => null);
  if (!st || !st.isDirectory()) {
    return [];
  }
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of entries) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        await walk(full);
      } else if (/\.fbx$/i.test(d.name)) {
        out.push({
          name: d.name,
          path: full,
          label: path.relative(absRoot, full).split(path.sep).join('/')
        });
      }
    }
  }
  await walk(absRoot);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
});

ipcMain.handle('readFile', async (event, filePath) => {
  const abs = path.resolve(String(filePath));
  const data = await fs.promises.readFile(abs);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle('statPath', async (event, filePath) => {
  const abs = path.resolve(String(filePath));
  const st = await fs.promises.stat(abs).catch(() => null);
  if (!st) return null;
  return {
    isDirectory: st.isDirectory(),
    mtimeMs: st.mtimeMs,
    size: st.size
  };
});

ipcMain.handle('thumbCacheTryRead', async (event, filePath) => {
  await ensureThumbCacheDir();
  const canonical = await canonicalFilePathForCache(filePath);
  if (!canonical) return { hit: false };
  const st = await fs.promises.stat(canonical).catch(() => null);
  if (!st || !st.isFile()) return { hit: false };
  const key = makeThumbCacheKey(canonical, st.mtimeMs, st.size);
  const file = path.join(getThumbCacheDir(), key + '.jpg');
  try {
    const buf = await fs.promises.readFile(file);
    const b64 = buf.toString('base64');
    return { hit: true, dataUrl: 'data:image/jpeg;base64,' + b64 };
  } catch {
    return { hit: false };
  }
});

ipcMain.handle('thumbCacheSave', async (event, payload) => {
  const filePath = payload && payload.filePath != null ? String(payload.filePath) : '';
  const dataUrl = payload && payload.dataUrl != null ? String(payload.dataUrl) : '';
  const m = /^data:image\/jpeg[^,]*base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!filePath || !m) return false;
  const b64 = m[1].replace(/\s+/g, '');
  await ensureThumbCacheDir();
  const canonical = await canonicalFilePathForCache(filePath);
  if (!canonical) return false;
  const st = await fs.promises.stat(canonical).catch(() => null);
  if (!st || !st.isFile()) return false;
  const key = makeThumbCacheKey(canonical, st.mtimeMs, st.size);
  const out = path.join(getThumbCacheDir(), key + '.jpg');
  try {
    await fs.promises.writeFile(out, Buffer.from(b64, 'base64'));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('getHomedir', () => {
  return os.homedir();
});

ipcMain.handle('pickFolder', async (event) => {
  const win =
    BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || undefined, {
    title: 'Select folder to analyze',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return null;
  }
  return result.filePaths[0];
});

/**
 * Packs existing files at the given absolute paths into a user-chosen .zip.
 * Resolves duplicate basenames in the archive (e.g. a.fbx, a (2).fbx).
 */
ipcMain.handle('exportFavoritesToZip', async (event, filePaths) => {
  const list = Array.isArray(filePaths) ? filePaths.map((p) => String(p)) : [];
  if (list.length === 0) {
    return { ok: false, error: 'empty' };
  }
  const present = [];
  for (const fp of list) {
    const abs = path.resolve(fp);
    const st = await fs.promises.stat(abs).catch(() => null);
    if (st && st.isFile()) {
      present.push(abs);
    }
  }
  if (present.length === 0) {
    return { ok: false, error: 'no_files' };
  }
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const { canceled, filePath: savePath } = await dialog.showSaveDialog(win || undefined, {
    title: 'Save pinned models as ZIP',
    defaultPath: 'fbx-viewer-favorites.zip',
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
  });
  if (canceled || !savePath) {
    return { ok: false, canceled: true };
  }
  const used = new Set();
  const entries = present.map((abs) => ({
    abs,
    name: nextUniqueZipEntryName(abs, used)
  }));
  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(savePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      const onErr = (err) => reject(err);
      output.on('error', onErr);
      archive.on('error', onErr);
      output.on('close', () => resolve());
      archive.pipe(output);
      for (const e of entries) {
        archive.file(e.abs, { name: e.name });
      }
      archive.finalize();
    });
  } catch (err) {
    return { ok: false, error: 'write_failed', message: err && err.message ? String(err.message) : 'unknown' };
  }
  return {
    ok: true,
    path: savePath,
    count: present.length,
    skipped: list.length - present.length
  };
});

app.whenReady().then(() => {
  thumbCacheDirPrimed = path.join(app.getPath('userData'), 'fbx-viewer-thumb-cache');
  setAppIconOnDock();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
