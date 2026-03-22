import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env');
const desktopServerPath = path.join(projectRoot, 'dist', 'desktop', 'server.js');

let mainWindow = null;
let desktopProcess = null;
let lastStdout = '';
let lastStderr = '';
let lastExit = null;
let currentConfig = readDesktopConfig();
const adminToken = randomUUID().replace(/-/g, '');

function readDesktopConfig() {
  const defaults = {
    host: '0.0.0.0',
    port: '3210',
    token: '',
    pairPassword: '',
    autoApprove: false,
  };

  if (!fs.existsSync(envFilePath)) {
    return defaults;
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitIndex = trimmed.indexOf('=');
    if (splitIndex === -1) continue;
    const key = trimmed.slice(0, splitIndex).trim();
    const value = trimmed.slice(splitIndex + 1).trim();
    env[key] = value;
  }

  return {
    host: env.DESKTOP_REMOTE_API_HOST || defaults.host,
    port: env.DESKTOP_REMOTE_API_PORT || defaults.port,
    token: env.DESKTOP_REMOTE_API_TOKEN || defaults.token,
    pairPassword: env.DESKTOP_REMOTE_PAIR_PASSWORD || defaults.pairPassword,
    autoApprove: (env.DESKTOP_REMOTE_AUTO_APPROVE || 'false') === 'true',
  };
}

function writeDesktopConfig(config) {
  const existing = fs.existsSync(envFilePath)
    ? fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/)
    : [];

  const values = {
    DESKTOP_REMOTE_API_HOST: config.host,
    DESKTOP_REMOTE_API_PORT: config.port,
    DESKTOP_REMOTE_API_TOKEN: config.token,
    DESKTOP_REMOTE_PAIR_PASSWORD: config.pairPassword,
    DESKTOP_REMOTE_AUTO_APPROVE: String(config.autoApprove),
  };

  const seen = new Set();
  const rewritten = existing.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return line;
    }
    const [key] = trimmed.split('=', 1);
    if (Object.hasOwn(values, key)) {
      seen.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      rewritten.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envFilePath, rewritten.filter(Boolean).join('\n') + '\n', 'utf8');
}

function endpointFor(config = currentConfig) {
  return `http://${config.host || '127.0.0.1'}:${config.port || '3210'}`;
}

function emit(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function logLine(kind, line) {
  if (!line) return;
  if (kind === 'stderr') {
    lastStderr = line;
  } else {
    lastStdout = line;
  }
  emit('desktop-log', {
    kind,
    line,
    at: new Date().toISOString(),
  });
}

async function ensureDesktopBuild() {
  if (fs.existsSync(desktopServerPath)) {
    return;
  }

  await new Promise((resolve, reject) => {
    const builder = spawn('npm.cmd', ['run', 'build'], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    builder.stdout.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) logLine('stdout', `[build] ${text}`);
    });
    builder.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) logLine('stderr', `[build] ${text}`);
    });
    builder.on('error', reject);
    builder.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm run build exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

async function startDesktopServer(config) {
  if (desktopProcess && !desktopProcess.killed) {
    return statePayload();
  }

  currentConfig = {
    host: (config.host || '0.0.0.0').trim(),
    port: (config.port || '3210').trim(),
    token: (config.token || '').trim(),
    pairPassword: (config.pairPassword || '').trim(),
    autoApprove: Boolean(config.autoApprove),
  };
  writeDesktopConfig(currentConfig);

  lastStdout = '';
  lastStderr = '';
  lastExit = null;

  await ensureDesktopBuild();

  desktopProcess = spawn('node', ['dist/desktop/server.js'], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DESKTOP_REMOTE_API_HOST: currentConfig.host,
      DESKTOP_REMOTE_API_PORT: currentConfig.port,
      DESKTOP_REMOTE_API_TOKEN: currentConfig.token,
      DESKTOP_REMOTE_PAIR_PASSWORD: currentConfig.pairPassword,
      DESKTOP_REMOTE_AUTO_APPROVE: String(currentConfig.autoApprove),
      DESKTOP_REMOTE_ADMIN_TOKEN: adminToken,
    },
  });

  desktopProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => logLine('stdout', line));
  });

  desktopProcess.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => logLine('stderr', line));
  });

  desktopProcess.on('exit', (code, signal) => {
    lastExit = {
      code,
      signal,
      detail: lastStderr || lastStdout || 'No process output captured',
      at: new Date().toISOString(),
    };
    desktopProcess = null;
    emit('desktop-state', statePayload());
  });

  desktopProcess.on('error', (error) => {
    lastExit = {
      code: -1,
      signal: null,
      detail: error.message,
      at: new Date().toISOString(),
    };
    emit('desktop-state', statePayload());
  });

  emit('desktop-state', statePayload());
  return statePayload();
}

async function stopDesktopServer() {
  if (!desktopProcess) {
    return statePayload();
  }

  await new Promise((resolve) => {
    const proc = desktopProcess;
    proc.once('exit', () => resolve());
    proc.kill();
    setTimeout(() => {
      if (desktopProcess) {
        desktopProcess.kill('SIGKILL');
      }
      resolve();
    }, 2500);
  });

  desktopProcess = null;
  emit('desktop-state', statePayload());
  return statePayload();
}

function statePayload() {
  return {
    running: Boolean(desktopProcess),
    endpoint: endpointFor(),
    config: currentConfig,
    lastExit,
  };
}

async function requestDesktopApi({ method, path: requestPath, body, token }) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const authToken = (token ?? currentConfig.token).trim();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${endpointFor()}${requestPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

async function requestAdminApi({ method, path: requestPath, body }) {
  const response = await fetch(`${endpointFor()}${requestPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Desktop-Admin-Token': adminToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: text ? JSON.parse(text) : null,
  };
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('desktop:get-state', async () => statePayload());
ipcMain.handle('desktop:get-defaults', async () => ({
  config: currentConfig,
  endpoint: endpointFor(),
}));
ipcMain.handle('desktop:start', async (_event, config) => startDesktopServer(config));
ipcMain.handle('desktop:stop', async () => stopDesktopServer());
ipcMain.handle('desktop:api', async (_event, payload) => requestDesktopApi(payload));
ipcMain.handle('desktop:open-project', async () => {
  const { shell } = await import('electron');
  await shell.openPath(projectRoot);
});
ipcMain.handle('desktop:admin-api', async (_event, payload) => requestAdminApi(payload));

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  await stopDesktopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
