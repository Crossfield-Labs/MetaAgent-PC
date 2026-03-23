import { BrowserWindow, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function createMainWindow(__dirname) {
  const distIndex = path.join(__dirname, 'renderer-dist', 'index.html');
  const sourceIndex = path.join(__dirname, 'renderer', 'index.html');
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: '#f3f6fb',
    title: 'MetaAgent',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(fs.existsSync(distIndex) ? distIndex : sourceIndex);
  return window;
}

export function createGhostWindow(__dirname) {
  const window = new BrowserWindow({
    width: 360,
    height: 140,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.loadFile(path.join(__dirname, 'renderer', 'ghost.html'));
  return window;
}

export function createMediaBridgeWindow(__dirname) {
  const window = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  window.loadFile(path.join(__dirname, 'renderer', 'webrtc-host.html'));
  return window;
}
