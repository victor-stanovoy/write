const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
const call = js => win && win.webContents.executeJavaScript(js).catch(() => {});

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 780, minWidth: 520, minHeight: 400,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#fafaf8',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Spotify's player opens its login in a popup; allow only that, send other links to the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(accounts|open)\.spotify\.com\//.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 480, height: 720, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.session.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'fullscreen'));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // leave room for the macOS traffic lights
  win.webContents.on('did-finish-load', () => { if (process.platform === 'darwin') win.webContents.insertCSS('#topbar{padding-left:84px!important;-webkit-app-region:drag}#topbar button,#topbar .seg{-webkit-app-region:no-drag}body.nosb #topbar{padding-left:84px!important}'); });
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const tpl = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => call('wren.newDoc()') },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => call('wren.openFromDisk()') },
      { label: 'Save…', accelerator: 'CmdOrCtrl+S', click: () => call('wren.saveFile()') },
      { label: 'New from Template…', click: () => call('wren.openTemplates()') },
      { label: 'Studio (Visual Editor)', accelerator: 'CmdOrCtrl+Shift+E', click: () => call('wren.openStudio()') },
      { label: 'Rearrange Sections…', accelerator: 'CmdOrCtrl+Shift+O', click: () => call('wren.openCards()') },
      { label: 'Today’s Daily Note', accelerator: 'CmdOrCtrl+Shift+D', click: () => call('wren.openDaily()') },
      { label: 'Present as Slides', click: () => call('wren.openPresent()') },
      { label: 'Reading Mode', click: () => call('wren.toggleReading()') },
      { label: 'Quick Open…', accelerator: 'CmdOrCtrl+P', click: () => call("wren.openPalette('doc')") },
      { label: 'Back Up All Documents…', click: () => call('wren.backupAll()') },
      { label: 'Export All as ZIP…', click: () => call('wren.exportZip()') },
      { type: 'separator' },
      { label: 'Export', submenu: [
        { label: 'Markdown', click: () => call("wren.exports.md()") },
        { label: 'HTML', click: () => call("wren.exports.html()") },
        { label: 'PDF…', click: () => call("wren.exports.pdf()") },
        { label: 'Word (.doc)', click: () => call("wren.exports.doc()") },
        { label: 'Plain text', click: () => call("wren.exports.txt()") }
      ] },
      { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' }
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [
      { label: 'Toggle Preview', accelerator: 'CmdOrCtrl+Shift+P', click: () => call('wren.togglePreview()') },
      { label: 'Cycle Focus Mode', accelerator: 'CmdOrCtrl+Shift+F', click: () => call('wren.cycleFocus()') },
      { label: 'Zen Mode', accelerator: 'CmdOrCtrl+Shift+J', click: () => call('wren.toggleZen()') },
      { label: 'Read Aloud', click: () => call('wren.readAloud()') },
      { label: 'Command Palette', accelerator: 'CmdOrCtrl+K', click: () => call('wren.openPalette()') },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => call('wren.openSettings()') },
      { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }
    ] },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => { buildMenu(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
