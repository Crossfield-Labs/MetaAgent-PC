import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetDesktopSessionManagerForTests,
} from './session-manager.js';

const mockConfig = {
  DESKTOP_REMOTE_API_HOST: '127.0.0.1',
  DESKTOP_REMOTE_API_PORT: 0,
  DESKTOP_REMOTE_API_TOKEN: '',
  DESKTOP_REMOTE_SESSION_TIMEOUT_MS: 120000,
};

const captureDesktopScreenshotMock = vi.fn();
const clickMouseMock = vi.fn();
const dragMouseMock = vi.fn();
const getClipboardTextMock = vi.fn();
const getDesktopCapabilitiesMock = vi.fn();
const getDesktopSystemInfoMock = vi.fn();
const launchAppMock = vi.fn();
const listDesktopWindowsMock = vi.fn();
const moveMouseMock = vi.fn();
const pressKeyMock = vi.fn();
const pressHotkeyMock = vi.fn();
const scrollMouseMock = vi.fn();
const getActiveSessionMock = vi.fn();
const setClipboardTextMock = vi.fn();
const sendTextMock = vi.fn();
const startRemoteControlMock = vi.fn();
const stopRemoteControlMock = vi.fn();

vi.mock('../config.js', () => ({
  get DESKTOP_REMOTE_API_HOST() {
    return mockConfig.DESKTOP_REMOTE_API_HOST;
  },
  get DESKTOP_REMOTE_API_PORT() {
    return mockConfig.DESKTOP_REMOTE_API_PORT;
  },
  get DESKTOP_REMOTE_API_TOKEN() {
    return mockConfig.DESKTOP_REMOTE_API_TOKEN;
  },
  get DESKTOP_REMOTE_SESSION_TIMEOUT_MS() {
    return mockConfig.DESKTOP_REMOTE_SESSION_TIMEOUT_MS;
  },
}));

vi.mock('./remote-control.js', () => ({
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  startRemoteControl: (...args: unknown[]) => startRemoteControlMock(...args),
  stopRemoteControl: (...args: unknown[]) => stopRemoteControlMock(...args),
}));

vi.mock('./control.js', () => ({
  captureDesktopScreenshot: (...args: unknown[]) =>
    captureDesktopScreenshotMock(...args),
  clickMouse: (...args: unknown[]) => clickMouseMock(...args),
  dragMouse: (...args: unknown[]) => dragMouseMock(...args),
  getClipboardText: (...args: unknown[]) => getClipboardTextMock(...args),
  getDesktopCapabilities: (...args: unknown[]) =>
    getDesktopCapabilitiesMock(...args),
  getDesktopSystemInfo: (...args: unknown[]) => getDesktopSystemInfoMock(...args),
  listDesktopWindows: (...args: unknown[]) => listDesktopWindowsMock(...args),
  launchApp: (...args: unknown[]) => launchAppMock(...args),
  moveMouse: (...args: unknown[]) => moveMouseMock(...args),
  pressKey: (...args: unknown[]) => pressKeyMock(...args),
  pressHotkey: (...args: unknown[]) => pressHotkeyMock(...args),
  scrollMouse: (...args: unknown[]) => scrollMouseMock(...args),
  setClipboardText: (...args: unknown[]) => setClipboardTextMock(...args),
  sendText: (...args: unknown[]) => sendTextMock(...args),
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { startDesktopRemoteApi } from './remote-api.js';

async function makeRequest(
  port: number,
  options: http.RequestOptions,
  body = '',
): Promise<{
  statusCode: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        ...options,
        hostname: '127.0.0.1',
        port,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf-8'),
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

describe('desktop-remote-api', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    mockConfig.DESKTOP_REMOTE_API_HOST = '127.0.0.1';
    mockConfig.DESKTOP_REMOTE_API_PORT = 0;
    mockConfig.DESKTOP_REMOTE_API_TOKEN = '';
    getActiveSessionMock.mockReset();
    captureDesktopScreenshotMock.mockReset();
    clickMouseMock.mockReset();
    dragMouseMock.mockReset();
    getClipboardTextMock.mockReset();
    getDesktopCapabilitiesMock.mockReset();
    getDesktopSystemInfoMock.mockReset();
    launchAppMock.mockReset();
    listDesktopWindowsMock.mockReset();
    moveMouseMock.mockReset();
    pressKeyMock.mockReset();
    pressHotkeyMock.mockReset();
    scrollMouseMock.mockReset();
    startRemoteControlMock.mockReset();
    stopRemoteControlMock.mockReset();
    setClipboardTextMock.mockReset();
    sendTextMock.mockReset();
    resetDesktopSessionManagerForTests();
    getActiveSessionMock.mockReturnValue(null);
    getDesktopCapabilitiesMock.mockReturnValue({
      platform: 'win32',
      supported: true,
      supportsScreenshot: true,
      supportsMouse: true,
      supportsKeyboard: true,
      supportsAppLaunch: true,
      supportsClipboard: true,
      supportsWindowListing: true,
      supportsSystemInfo: true,
    });
    getDesktopSystemInfoMock.mockResolvedValue({
      hostname: 'metaagent-pc',
      username: 'tester',
      platform: 'win32',
      release: '10.0.26100.0',
      arch: 'AMD64',
      cpuModel: 'Test CPU',
      displayCount: 1,
      displays: [
        {
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          primary: true,
          deviceName: '\\\\.\\DISPLAY1',
        },
      ],
    });
    listDesktopWindowsMock.mockResolvedValue([
      { processName: 'Code', title: 'MetaAgent-PC', pid: 1001 },
    ]);
    getClipboardTextMock.mockResolvedValue({ text: 'clipboard value' });

    server = await startDesktopRemoteApi();
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns health state', async () => {
    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        service: 'nanoclaw-desktop-remote',
        hasActiveSession: false,
        hasDesktopSession: false,
        apiVersion: 1,
      },
    });
  });

  it('opens and returns desktop control session', async () => {
    const openResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/session/open',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ clientName: 'android-debug' }),
    );

    const openPayload = JSON.parse(openResponse.body);
    expect(openResponse.statusCode).toBe(200);
    expect(openPayload.ok).toBe(true);
    expect(openPayload.data.session.clientName).toBe('android-debug');
    expect(openPayload.data.session.id).toBeTruthy();

    const getResponse = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/session',
    });
    const getPayload = JSON.parse(getResponse.body);
    expect(getResponse.statusCode).toBe(200);
    expect(getPayload.data.session.id).toBe(openPayload.data.session.id);
  });

  it('heartbeats and closes desktop control session', async () => {
    const openResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/session/open',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ clientName: 'android-debug' }),
    );
    const sessionId = JSON.parse(openResponse.body).data.session.id;

    const heartbeatResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/session/heartbeat',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ sessionId }),
    );
    expect(heartbeatResponse.statusCode).toBe(200);
    expect(JSON.parse(heartbeatResponse.body).data.session.id).toBe(sessionId);

    const closeResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/session/close',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ sessionId }),
    );
    expect(closeResponse.statusCode).toBe(200);
    expect(JSON.parse(closeResponse.body)).toEqual({
      ok: true,
      data: {
        closed: true,
        session: null,
      },
    });
  });

  it('returns recent desktop events after operations', async () => {
    moveMouseMock.mockResolvedValue({ ok: true, message: 'Mouse moved' });

    await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/session/open',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ clientName: 'android-debug' }),
    );
    await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/move',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ x: 123, y: 456 }),
    );

    const eventsResponse = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/events?limit=5',
    });
    const payload = JSON.parse(eventsResponse.body);
    expect(eventsResponse.statusCode).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.events.some((event: { type: string }) => event.type === 'session.opened')).toBe(true);
    expect(payload.data.events.some((event: { type: string }) => event.type === 'desktop.input.move')).toBe(true);
  });

  it('returns active session snapshot', async () => {
    getActiveSessionMock.mockReturnValue({
      pid: 123,
      url: 'https://claude.ai/code?bridge=env_abc',
      startedBy: 'phone-ui',
      startedInChat: 'phone-ui',
      startedAt: '2026-03-21T09:00:00.000Z',
    });

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/remote-control/session',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        session: {
          pid: 123,
          url: 'https://claude.ai/code?bridge=env_abc',
          startedBy: 'phone-ui',
          startedInChat: 'phone-ui',
          startedAt: '2026-03-21T09:00:00.000Z',
        },
      },
    });
  });

  it('returns desktop capabilities', async () => {
    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/capabilities',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        platform: 'win32',
        supported: true,
        supportsScreenshot: true,
        supportsMouse: true,
        supportsKeyboard: true,
        supportsAppLaunch: true,
        supportsClipboard: true,
        supportsWindowListing: true,
        supportsSystemInfo: true,
      },
    });
  });

  it('returns system info', async () => {
    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/system/info',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.hostname).toBe('metaagent-pc');
  });

  it('returns windows list', async () => {
    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/windows',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.windows).toEqual([
      { processName: 'Code', title: 'MetaAgent-PC', pid: 1001 },
    ]);
  });

  it('gets clipboard text', async () => {
    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/clipboard',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).toEqual({ text: 'clipboard value' });
  });

  it('returns desktop screenshot payload', async () => {
    captureDesktopScreenshotMock.mockResolvedValue({
      mimeType: 'image/png',
      base64: 'ZmFrZQ==',
      width: 1920,
      height: 1080,
    });

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/screenshot',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        mimeType: 'image/png',
        base64: 'ZmFrZQ==',
        width: 1920,
        height: 1080,
      },
    });
  });

  it('starts remote control with request body values', async () => {
    startRemoteControlMock.mockResolvedValue({
      ok: true,
      url: 'https://claude.ai/code?bridge=env_started',
    });
    getActiveSessionMock.mockReturnValue({
      pid: 234,
      url: 'https://claude.ai/code?bridge=env_started',
      startedBy: 'alice',
      startedInChat: 'tg:123',
      startedAt: '2026-03-21T09:01:00.000Z',
    });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/remote-control/start',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({
        sender: 'alice',
        chatJid: 'tg:123',
        cwd: '/workspace/project',
      }),
    );

    expect(startRemoteControlMock).toHaveBeenCalledWith(
      'alice',
      'tg:123',
      '/workspace/project',
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        url: 'https://claude.ai/code?bridge=env_started',
        session: {
          pid: 234,
          url: 'https://claude.ai/code?bridge=env_started',
          startedBy: 'alice',
          startedInChat: 'tg:123',
          startedAt: '2026-03-21T09:01:00.000Z',
        },
      },
    });
  });

  it('stops remote control session', async () => {
    stopRemoteControlMock.mockReturnValue({ ok: true });

    const response = await makeRequest(port, {
      method: 'POST',
      path: '/api/desktop/remote-control/stop',
    });

    expect(stopRemoteControlMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        stopped: true,
        session: null,
      },
    });
  });

  it('moves mouse through desktop control endpoint', async () => {
    moveMouseMock.mockResolvedValue({ ok: true, message: 'Mouse moved' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/move',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ x: 500, y: 400 }),
    );

    expect(moveMouseMock).toHaveBeenCalledWith(500, 400);
    expect(response.statusCode).toBe(200);
  });

  it('clicks mouse through desktop control endpoint', async () => {
    clickMouseMock.mockResolvedValue({ ok: true, message: 'Mouse left clicked' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/click',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ x: 500, y: 400, button: 'left' }),
    );

    expect(clickMouseMock).toHaveBeenCalledWith(500, 400, 'left');
    expect(response.statusCode).toBe(200);
  });

  it('types text through desktop control endpoint', async () => {
    sendTextMock.mockResolvedValue({ ok: true, message: 'Text sent' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/type',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ text: 'hello desktop' }),
    );

    expect(sendTextMock).toHaveBeenCalledWith('hello desktop');
    expect(response.statusCode).toBe(200);
  });

  it('drags mouse through desktop control endpoint', async () => {
    dragMouseMock.mockResolvedValue({ ok: true, message: 'Mouse dragged' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/drag',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ fromX: 1, fromY: 2, toX: 300, toY: 400, button: 'left', steps: 8 }),
    );

    expect(dragMouseMock).toHaveBeenCalledWith(1, 2, 300, 400, 'left', 8);
    expect(response.statusCode).toBe(200);
  });

  it('scrolls mouse through desktop control endpoint', async () => {
    scrollMouseMock.mockResolvedValue({ ok: true, message: 'Mouse scrolled' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/scroll',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ delta: -120 }),
    );

    expect(scrollMouseMock).toHaveBeenCalledWith(-120);
    expect(response.statusCode).toBe(200);
  });

  it('presses key through desktop control endpoint', async () => {
    pressKeyMock.mockResolvedValue({ ok: true, message: 'Key pressed' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/key',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ key: 'ENTER' }),
    );

    expect(pressKeyMock).toHaveBeenCalledWith('ENTER');
    expect(response.statusCode).toBe(200);
  });

  it('presses hotkey through desktop control endpoint', async () => {
    pressHotkeyMock.mockResolvedValue({ ok: true, message: 'Hotkey pressed' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/hotkey',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ keys: ['CTRL', 'SHIFT', 'P'] }),
    );

    expect(pressHotkeyMock).toHaveBeenCalledWith(['CTRL', 'SHIFT', 'P']);
    expect(response.statusCode).toBe(200);
  });

  it('launches app through desktop control endpoint', async () => {
    launchAppMock.mockResolvedValue({ ok: true, message: 'App launched' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/app/launch',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ command: 'notepad.exe', args: ['test.txt'] }),
    );

    expect(launchAppMock).toHaveBeenCalledWith('notepad.exe', ['test.txt']);
    expect(response.statusCode).toBe(200);
  });

  it('sets clipboard text through desktop control endpoint', async () => {
    setClipboardTextMock.mockResolvedValue({ ok: true, message: 'Clipboard updated' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/clipboard',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ text: 'new clipboard text' }),
    );

    expect(setClipboardTextMock).toHaveBeenCalledWith('new clipboard text');
    expect(response.statusCode).toBe(200);
  });

  it('enforces bearer auth when token configured', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    mockConfig.DESKTOP_REMOTE_API_TOKEN = 'secret-token';
    server = await startDesktopRemoteApi();
    port = (server.address() as AddressInfo).port;

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/health',
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      error: 'Unauthorized',
    });
  });
});
