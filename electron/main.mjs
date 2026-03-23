import { app, desktopCapturer, ipcMain, session, BrowserWindow } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultDesktopConfig,
  displayEndpointFor,
  getDesktopServerPath,
  readDesktopConfig,
  requestEndpointFor,
  resolveNodeExecutable,
  writeDesktopConfig,
} from './main/desktop-config.mjs';
import {
  createGhostWindow,
  createMainWindow,
  createMediaBridgeWindow,
} from './main/windows.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const adminToken = randomUUID().replace(/-/g, '');

let runtimeRoot = projectRoot;
let mainWindow = null;
let desktopProcess = null;
let ghostWindow = null;
let mediaBridgeWindow = null;
let agentPollTimer = null;
let mediaBridgeTimer = null;
let lastStdout = '';
let lastStderr = '';
let lastExit = null;
let currentConfig = defaultDesktopConfig(projectRoot);
let isShuttingDown = false;

function emit(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function statePayload() {
  return {
    running: Boolean(desktopProcess),
    endpoint: displayEndpointFor(currentConfig),
    config: currentConfig,
    lastExit,
    runtimeRoot,
    packaged: app.isPackaged,
  };
}

function logLine(kind, line) {
  if (!line) return;
  if (kind === 'stderr') {
    lastStderr = line;
  } else {
    lastStdout = line;
  }
  emit('desktop-log', { kind, line, at: new Date().toISOString() });
}

async function ensureDesktopBuild() {
  const desktopServerPath = getDesktopServerPath(app.getAppPath());
  if (fs.existsSync(desktopServerPath)) return;
  if (app.isPackaged) {
    throw new Error(`Packaged desktop server entrypoint is missing: ${desktopServerPath}`);
  }
  throw new Error(`Desktop server entrypoint is missing: ${desktopServerPath}. Please run npm run build first.`);
}

async function isDesktopServiceReachable() {
  try {
    const response = await fetch(`${requestEndpointFor(currentConfig)}/api/desktop/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function destroyAuxWindows() {
  if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.destroy();
  if (mediaBridgeWindow && !mediaBridgeWindow.isDestroyed()) mediaBridgeWindow.destroy();
  ghostWindow = null;
  mediaBridgeWindow = null;
}

async function shutdownApplication(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    await stopDesktopServer();
  } finally {
    destroyAuxWindows();
    app.exit(exitCode);
  }
}

async function waitForDesktopServerReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (desktopProcess && desktopProcess.exitCode != null) {
      throw new Error(`Desktop service exited before ready with code ${desktopProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${requestEndpointFor(currentConfig)}/api/desktop/health`);
      if (response.ok) return;
    } catch {
      // service is still starting
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const failureDetail = lastExit?.detail || lastStderr || lastStdout;
  if (failureDetail) {
    throw new Error(`Desktop service did not become ready in time: ${failureDetail}`);
  }
  throw new Error('Desktop service did not become ready in time');
}

async function requestDesktopApi({ method, path: requestPath, body, token }) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Desktop-Admin-Token': adminToken,
  };
  const authToken = (token ?? currentConfig.token).trim();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  try {
    const response = await fetch(`${requestEndpointFor(currentConfig)}${requestPath}`, {
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

    return { ok: response.ok, status: response.status, data: parsed, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'desktop service unavailable',
    };
  }
}

async function requestAdminApi({ method, path: requestPath, body }) {
  try {
    const response = await fetch(`${requestEndpointFor(currentConfig)}${requestPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Desktop-Admin-Token': adminToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return { ok: response.ok, status: response.status, data: parsed, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'desktop admin service unavailable',
    };
  }
}

function emitGhostState(payload) {
  if (!ghostWindow || ghostWindow.isDestroyed()) return;
  ghostWindow.webContents.send('ghost-state', payload);
}

function emitMediaBridgeState(payload) {
  if (!mediaBridgeWindow || mediaBridgeWindow.isDestroyed()) return;
  mediaBridgeWindow.webContents.send('video-session', payload);
}

async function syncGhostWindow() {
  if (!desktopProcess) {
    if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.hide();
    return;
  }

  try {
    const response = await requestDesktopApi({ method: 'GET', path: '/api/desktop/agent/state', token: currentConfig.token });
    const state = response.data?.data?.state;
    if (!response.ok || !state || state.status !== 'running') {
      if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.hide();
      return;
    }

    emitGhostState(state);
    if (ghostWindow && !ghostWindow.isVisible()) ghostWindow.showInactive();
  } catch {
    if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.hide();
  }
}

async function syncMediaBridgeWindow() {
  if (!mediaBridgeWindow || mediaBridgeWindow.isDestroyed()) return;
  try {
    const response = await requestDesktopApi({ method: 'GET', path: '/api/desktop/video/session', token: currentConfig.token });
    emitMediaBridgeState({
      endpoint: requestEndpointFor(currentConfig),
      token: currentConfig.token,
      payload: response.data?.data ?? null,
    });
  } catch (error) {
    emitMediaBridgeState({
      endpoint: requestEndpointFor(currentConfig),
      token: currentConfig.token,
      payload: null,
      error: error instanceof Error ? error.message : 'video session sync failed',
    });
  }
}

function stopAgentPolling() {
  if (agentPollTimer) {
    clearInterval(agentPollTimer);
    agentPollTimer = null;
  }
}

function stopMediaBridgePolling() {
  if (mediaBridgeTimer) {
    clearInterval(mediaBridgeTimer);
    mediaBridgeTimer = null;
  }
}

function startAgentPolling() {
  stopAgentPolling();
  agentPollTimer = setInterval(() => void syncGhostWindow(), 1200);
  void syncGhostWindow();
}

function startMediaBridgePolling() {
  stopMediaBridgePolling();
  mediaBridgeTimer = setInterval(() => void syncMediaBridgeWindow(), 1200);
  void syncMediaBridgeWindow();
}

async function startDesktopServer(config) {
  if (desktopProcess && !desktopProcess.killed) return statePayload();

  currentConfig = {
    host: (config.host || '0.0.0.0').trim(),
    port: (config.port || '3210').trim(),
    token: (config.token || '').trim(),
    pairPassword: (config.pairPassword || '').trim(),
    autoApprove: Boolean(config.autoApprove),
    agentProvider: (config.agentProvider || 'codex').trim() || 'codex',
    agentExecutable: (config.agentExecutable || '').trim(),
    agentArgs: (config.agentArgs || '').trim(),
    agentCwd: (config.agentCwd || projectRoot).trim() || projectRoot,
  };
  writeDesktopConfig(runtimeRoot, currentConfig);

  lastStdout = '';
  lastStderr = '';
  lastExit = null;

  await ensureDesktopBuild();

  if (await isDesktopServiceReachable()) {
    throw new Error(`Desktop service is already listening on ${requestEndpointFor(currentConfig)}. Close the existing MetaAgent-PC desktop service or free the port before starting a new one.`);
  }

  const desktopServerPath = getDesktopServerPath(app.getAppPath());
  const nodeExecutable = resolveNodeExecutable();
  desktopProcess = spawn(nodeExecutable, [desktopServerPath], {
    cwd: runtimeRoot,
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
      DESKTOP_AGENT_PROVIDER: currentConfig.agentProvider,
      DESKTOP_AGENT_EXECUTABLE: currentConfig.agentExecutable,
      DESKTOP_AGENT_ARGS: currentConfig.agentArgs,
      DESKTOP_AGENT_CWD: currentConfig.agentCwd,
    },
  });

  desktopProcess.stdout.on('data', (chunk) => {
    chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => logLine('stdout', line));
  });
  desktopProcess.stderr.on('data', (chunk) => {
    chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => logLine('stderr', line));
  });
  desktopProcess.on('exit', (code, signal) => {
    lastExit = {
      code,
      signal,
      detail: lastStderr || lastStdout || 'No process output captured',
      at: new Date().toISOString(),
    };
    desktopProcess = null;
    stopAgentPolling();
    stopMediaBridgePolling();
    if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.hide();
    emit('desktop-state', statePayload());
  });
  desktopProcess.on('error', (error) => {
    lastExit = { code: -1, signal: null, detail: error.message, at: new Date().toISOString() };
    stopAgentPolling();
    stopMediaBridgePolling();
    emit('desktop-state', statePayload());
  });

  await waitForDesktopServerReady();
  startAgentPolling();
  startMediaBridgePolling();
  emit('desktop-state', statePayload());
  return statePayload();
}

async function stopDesktopServer() {
  if (!desktopProcess) return statePayload();

  await new Promise((resolve) => {
    const proc = desktopProcess;
    proc.once('exit', () => resolve());
    proc.kill();
    setTimeout(() => {
      if (desktopProcess) desktopProcess.kill('SIGKILL');
      resolve();
    }, 2500);
  });

  desktopProcess = null;
  stopAgentPolling();
  stopMediaBridgePolling();
  if (ghostWindow && !ghostWindow.isDestroyed()) ghostWindow.hide();
  emit('desktop-state', statePayload());
  return statePayload();
}

ipcMain.handle('desktop:get-state', async () => statePayload());
ipcMain.handle('desktop:get-defaults', async () => ({
  config: currentConfig,
  endpoint: displayEndpointFor(currentConfig),
  adminToken,
}));
ipcMain.handle('desktop:start', async (_event, config) => startDesktopServer(config));
ipcMain.handle('desktop:stop', async () => stopDesktopServer());
ipcMain.handle('desktop:api', async (_event, payload) => requestDesktopApi(payload));
ipcMain.handle('desktop:open-project', async () => {
  const { shell } = await import('electron');
  await shell.openPath(app.isPackaged ? runtimeRoot : projectRoot);
});
ipcMain.handle('desktop:admin-api', async (_event, payload) => requestAdminApi(payload));
ipcMain.handle('ghost:hide', async () => {
  if (ghostWindow && !ghostWindow.isDestroyed()) {
    ghostWindow.hide();
  }
  return { ok: true };
});

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      callback({ video: sources[0], audio: undefined });
    },
    { useSystemPicker: false },
  );

  runtimeRoot = app.isPackaged ? path.join(app.getPath('userData'), 'desktop-runtime') : projectRoot;
  fs.mkdirSync(runtimeRoot, { recursive: true });
  currentConfig = readDesktopConfig(runtimeRoot, projectRoot);

  mainWindow = createMainWindow(__dirname);
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!isShuttingDown) {
      void shutdownApplication(0);
    }
  });

  ghostWindow = createGhostWindow(__dirname);
  mediaBridgeWindow = createMediaBridgeWindow(__dirname);
});

app.on('before-quit', () => {
  isShuttingDown = true;
});

app.on('window-all-closed', async () => {
  if (isShuttingDown) return;
  await shutdownApplication(0);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow(__dirname);
  }
});


