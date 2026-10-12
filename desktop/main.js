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
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
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
