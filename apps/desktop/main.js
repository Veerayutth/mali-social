'use strict';
/* แอปคอมของมะลิ (Mac/Windows): เปิดเว็บแอปในหน้าต่างของตัวเอง
   ความปลอดภัย: ไม่เปิดให้หน้าเว็บใช้ Node.js, ใช้ sandbox + contextIsolation, เปิดได้เฉพาะโดเมนของมะลิ
   ลิงก์ภายนอกเปิดในเบราว์เซอร์ปกติ, อนุญาตกล้อง/ไมค์/การแจ้งเตือนเฉพาะโดเมนของมะลิ */
const { app, BrowserWindow, shell, session, Menu } = require('electron');
const APP_URL = 'https://mali-social-6be0.netlify.app/';
const ORIGIN = new URL(APP_URL).origin;
const ALLOWED_PERMS = new Set(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen']);

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600, title: 'มะลิ', backgroundColor: '#f7f4ee', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: true }
  });
  // ห้ามออกนอกโดเมนของมะลิในหน้าต่างแอป
  win.webContents.on('will-navigate', (e, url) => { if (new URL(url).origin !== ORIGIN) { e.preventDefault(); openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.loadURL(APP_URL);
  return win;
}
function openExternal(url) { try { const u = new URL(url); if (u.protocol === 'https:' || u.protocol === 'mailto:') shell.openExternal(u.toString()); } catch {} }

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    cb(ALLOWED_PERMS.has(perm) && new URL(details.requestingUrl || wc.getURL()).origin === ORIGIN);
  });
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ALLOWED_PERMS.has(perm) && origin === ORIGIN);
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  else Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// ห้ามแนบ webview หรือเปิดหน้าต่างใหม่จากหน้าเว็บ
app.on('web-contents-created', (e, wc) => { wc.on('will-attach-webview', ev => ev.preventDefault()); });
