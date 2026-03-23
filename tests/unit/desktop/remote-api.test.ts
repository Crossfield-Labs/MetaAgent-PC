import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetDesktopSessionManagerForTests,
} from '../../../src/desktop/session-manager.js';

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    DESKTOP_REMOTE_API_HOST: '127.0.0.1',
    DESKTOP_REMOTE_API_PORT: 0,
    DESKTOP_REMOTE_API_TOKEN: '',
    DESKTOP_REMOTE_PAIR_PASSWORD: '',
    DESKTOP_REMOTE_AUTO_APPROVE: false,
    DESKTOP_REMOTE_ADMIN_TOKEN: '',
    DESKTOP_REMOTE_SESSION_TIMEOUT_MS: 120000,
    DESKTOP_AGENT_PROVIDER: 'codex',
    DESKTOP_AGENT_EXECUTABLE: 'codex',
    DESKTOP_AGENT_ARGS: '',
    DESKTOP_AGENT_CWD: 'D:/works/nanoclaw',
  },
}));

const baseMockConfig = {
  DESKTOP_REMOTE_API_HOST: '127.0.0.1',
  DESKTOP_REMOTE_API_PORT: 0,
  DESKTOP_REMOTE_API_TOKEN: '',
  DESKTOP_REMOTE_PAIR_PASSWORD: '',
  DESKTOP_REMOTE_AUTO_APPROVE: false,
  DESKTOP_REMOTE_ADMIN_TOKEN: '',
  DESKTOP_REMOTE_SESSION_TIMEOUT_MS: 120000,
  DESKTOP_AGENT_PROVIDER: 'codex',
  DESKTOP_AGENT_EXECUTABLE: 'codex',
  DESKTOP_AGENT_ARGS: '',
  DESKTOP_AGENT_CWD: 'D:/works/nanoclaw',
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
const moveMouseRelativeMock = vi.fn();
const pressKeyMock = vi.fn();
const pressHotkeyMock = vi.fn();
const scrollMouseMock = vi.fn();
const clickMouseCurrentMock = vi.fn();
const getActiveSessionMock = vi.fn();
const getDesktopAgentSettingsMock = vi.fn();
const getDesktopAgentStateMock = vi.fn();
const getDesktopAgentSessionMock = vi.fn();
const listDesktopAgentMessagesMock = vi.fn();
const listDesktopAgentLogsMock = vi.fn();
const runDesktopAgentMock = vi.fn();
const sendDesktopAgentMessageMock = vi.fn();
const resetDesktopAgentSessionMock = vi.fn();
const setClipboardTextMock = vi.fn();
const sendTextMock = vi.fn();
const startRemoteControlMock = vi.fn();
const stopRemoteControlMock = vi.fn();
const stopDesktopAgentMock = vi.fn();
const updateDesktopAgentSettingsMock = vi.fn();
const addDesktopVideoCandidateMock = vi.fn();
const closeDesktopVideoSessionMock = vi.fn();
const getDesktopVideoSessionMock = vi.fn();
const openDesktopVideoSessionMock = vi.fn();
const submitDesktopVideoAnswerMock = vi.fn();
const submitDesktopVideoOfferMock = vi.fn();

vi.mock('../../../src/config.js', () => ({
  get DESKTOP_REMOTE_API_HOST() {
    return mockConfig.DESKTOP_REMOTE_API_HOST;
  },
  get DESKTOP_REMOTE_API_PORT() {
    return mockConfig.DESKTOP_REMOTE_API_PORT;
  },
  get DESKTOP_REMOTE_API_TOKEN() {
    return mockConfig.DESKTOP_REMOTE_API_TOKEN;
  },
  get DESKTOP_REMOTE_PAIR_PASSWORD() {
    return mockConfig.DESKTOP_REMOTE_PAIR_PASSWORD;
  },
  get DESKTOP_REMOTE_AUTO_APPROVE() {
    return mockConfig.DESKTOP_REMOTE_AUTO_APPROVE;
  },
  get DESKTOP_REMOTE_ADMIN_TOKEN() {
    return mockConfig.DESKTOP_REMOTE_ADMIN_TOKEN;
  },
  get DESKTOP_REMOTE_SESSION_TIMEOUT_MS() {
    return mockConfig.DESKTOP_REMOTE_SESSION_TIMEOUT_MS;
  },
  get DESKTOP_AGENT_PROVIDER() {
    return mockConfig.DESKTOP_AGENT_PROVIDER;
  },
  get DESKTOP_AGENT_EXECUTABLE() {
    return mockConfig.DESKTOP_AGENT_EXECUTABLE;
  },
  get DESKTOP_AGENT_ARGS() {
    return mockConfig.DESKTOP_AGENT_ARGS;
  },
  get DESKTOP_AGENT_CWD() {
    return mockConfig.DESKTOP_AGENT_CWD;
  },
}));

vi.mock('../../../src/desktop/remote-control.js', () => ({
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  startRemoteControl: (...args: unknown[]) => startRemoteControlMock(...args),
  stopRemoteControl: (...args: unknown[]) => stopRemoteControlMock(...args),
}));

vi.mock('../../../src/desktop/control.js', () => ({
  captureDesktopScreenshot: (...args: unknown[]) =>
    captureDesktopScreenshotMock(...args),
  clickMouse: (...args: unknown[]) => clickMouseMock(...args),
  clickMouseCurrent: (...args: unknown[]) => clickMouseCurrentMock(...args),
  dragMouse: (...args: unknown[]) => dragMouseMock(...args),
  getClipboardText: (...args: unknown[]) => getClipboardTextMock(...args),
  getDesktopCapabilities: (...args: unknown[]) =>
    getDesktopCapabilitiesMock(...args),
  getDesktopSystemInfo: (...args: unknown[]) => getDesktopSystemInfoMock(...args),
  listDesktopWindows: (...args: unknown[]) => listDesktopWindowsMock(...args),
  launchApp: (...args: unknown[]) => launchAppMock(...args),
  moveMouse: (...args: unknown[]) => moveMouseMock(...args),
  moveMouseRelative: (...args: unknown[]) => moveMouseRelativeMock(...args),
  pressKey: (...args: unknown[]) => pressKeyMock(...args),
  pressHotkey: (...args: unknown[]) => pressHotkeyMock(...args),
  scrollMouse: (...args: unknown[]) => scrollMouseMock(...args),
  setClipboardText: (...args: unknown[]) => setClipboardTextMock(...args),
  sendText: (...args: unknown[]) => sendTextMock(...args),
}));

vi.mock('../../../src/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/desktop/agent-manager.js', () => ({
  getDesktopAgentSettings: (...args: unknown[]) =>
    getDesktopAgentSettingsMock(...args),
  getDesktopAgentState: (...args: unknown[]) =>
    getDesktopAgentStateMock(...args),
  getDesktopAgentSession: (...args: unknown[]) =>
    getDesktopAgentSessionMock(...args),
  listDesktopAgentMessages: (...args: unknown[]) =>
    listDesktopAgentMessagesMock(...args),
  listDesktopAgentLogs: (...args: unknown[]) =>
    listDesktopAgentLogsMock(...args),
  runDesktopAgent: (...args: unknown[]) => runDesktopAgentMock(...args),
  sendDesktopAgentMessage: (...args: unknown[]) => sendDesktopAgentMessageMock(...args),
  resetDesktopAgentSession: (...args: unknown[]) => resetDesktopAgentSessionMock(...args),
  stopDesktopAgent: (...args: unknown[]) => stopDesktopAgentMock(...args),
  updateDesktopAgentSettings: (...args: unknown[]) =>
    updateDesktopAgentSettingsMock(...args),
}));

vi.mock('../../../src/desktop/video-manager.js', () => ({
  addDesktopVideoCandidate: (...args: unknown[]) =>
    addDesktopVideoCandidateMock(...args),
  closeDesktopVideoSession: (...args: unknown[]) =>
    closeDesktopVideoSessionMock(...args),
  getDesktopVideoSession: (...args: unknown[]) =>
    getDesktopVideoSessionMock(...args),
  openDesktopVideoSession: (...args: unknown[]) =>
    openDesktopVideoSessionMock(...args),
  submitDesktopVideoAnswer: (...args: unknown[]) =>
    submitDesktopVideoAnswerMock(...args),
  submitDesktopVideoOffer: (...args: unknown[]) =>
    submitDesktopVideoOfferMock(...args),
}));

import { startDesktopRemoteApi } from '../../../src/desktop/remote-api.js';

async function makeRequest(
  port: number,
  options: http.RequestOptions,
  body = '',
  useAuth = true,
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
        headers: {
          ...(options.headers || {}),
          ...(
            useAuth && mockConfig.DESKTOP_REMOTE_API_TOKEN
              ? { authorization: `Bearer ${mockConfig.DESKTOP_REMOTE_API_TOKEN}` }
              : {}
          ),
        },
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
    Object.assign(mockConfig, baseMockConfig);
    mockConfig.DESKTOP_REMOTE_API_TOKEN = 'test-token';
    getActiveSessionMock.mockReset();
    captureDesktopScreenshotMock.mockReset();
    clickMouseMock.mockReset();
    clickMouseCurrentMock.mockReset();
    dragMouseMock.mockReset();
    getClipboardTextMock.mockReset();
    getDesktopCapabilitiesMock.mockReset();
    getDesktopSystemInfoMock.mockReset();
    launchAppMock.mockReset();
    listDesktopWindowsMock.mockReset();
    moveMouseMock.mockReset();
    moveMouseRelativeMock.mockReset();
    getDesktopAgentSettingsMock.mockReset();
    getDesktopAgentStateMock.mockReset();
    listDesktopAgentLogsMock.mockReset();
    pressKeyMock.mockReset();
    pressHotkeyMock.mockReset();
    runDesktopAgentMock.mockReset();
    sendDesktopAgentMessageMock.mockReset();
    resetDesktopAgentSessionMock.mockReset();
    addDesktopVideoCandidateMock.mockReset();
    closeDesktopVideoSessionMock.mockReset();
    getDesktopVideoSessionMock.mockReset();
    openDesktopVideoSessionMock.mockReset();
    scrollMouseMock.mockReset();
    startRemoteControlMock.mockReset();
    stopDesktopAgentMock.mockReset();
    stopRemoteControlMock.mockReset();
    submitDesktopVideoAnswerMock.mockReset();
    submitDesktopVideoOfferMock.mockReset();
    setClipboardTextMock.mockReset();
    sendTextMock.mockReset();
    updateDesktopAgentSettingsMock.mockReset();
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
      { processName: 'Code', title: 'MetaAgent', pid: 1001 },
    ]);
    getClipboardTextMock.mockResolvedValue({ text: 'clipboard value' });
    getDesktopAgentSettingsMock.mockReturnValue({
      provider: 'codex',
      executable: 'codex',
      args: '',
      cwd: 'D:\\works\\nanoclaw',
    });
    getDesktopAgentStateMock.mockReturnValue({
      status: 'idle',
      provider: 'codex',
      prompt: null,
      pid: null,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      cwd: 'D:\\works\\nanoclaw',
      executable: 'codex',
      args: '',
      lastError: null,
      lastOutput: null,
    });
    listDesktopAgentLogsMock.mockReturnValue([]);
    updateDesktopAgentSettingsMock.mockImplementation((payload) => ({
      provider: payload.provider ?? 'codex',
      executable: payload.executable ?? 'codex',
      args: payload.args ?? '',
      cwd: payload.cwd ?? 'D:\\works\\nanoclaw',
    }));
    getDesktopVideoSessionMock.mockReturnValue(null);
    openDesktopVideoSessionMock.mockImplementation((payload) => ({
      id: 'video-session-1',
      viewerName: payload.viewerName ?? 'MetaAgent viewer',
      transport: 'webrtc',
      codec: payload.codec ?? 'h264',
      preferredWidth: payload.preferredWidth ?? 1280,
      preferredHeight: payload.preferredHeight ?? 720,
      preferredFps: payload.preferredFps ?? 30,
      status: 'preparing',
      createdAt: '2026-03-22T07:00:00.000Z',
      updatedAt: '2026-03-22T07:00:00.000Z',
      lastError: null,
      viewerOfferSdp: null,
      hostAnswerSdp: null,
      candidateCount: 0,
      notes: ['2026-03-22T07:00:00.000Z desktop video session created'],
    }));
    submitDesktopVideoOfferMock.mockImplementation(({ sessionId, sdp }) => ({
      id: sessionId,
      viewerName: 'MetaAgent viewer',
      transport: 'webrtc',
      codec: 'h264',
      preferredWidth: 1280,
      preferredHeight: 720,
      preferredFps: 30,
      status: 'negotiating',
      createdAt: '2026-03-22T07:00:00.000Z',
      updatedAt: '2026-03-22T07:00:01.000Z',
      lastError: null,
      viewerOfferSdp: sdp,
      hostAnswerSdp: null,
      candidateCount: 0,
      notes: [],
    }));
    submitDesktopVideoAnswerMock.mockImplementation(({ sessionId, sdp }) => ({
      id: sessionId,
      viewerName: 'MetaAgent viewer',
      transport: 'webrtc',
      codec: 'h264',
      preferredWidth: 1280,
      preferredHeight: 720,
      preferredFps: 30,
      status: 'streaming',
      createdAt: '2026-03-22T07:00:00.000Z',
      updatedAt: '2026-03-22T07:00:02.000Z',
      lastError: null,
      viewerOfferSdp: 'viewer-sdp',
      hostAnswerSdp: sdp,
      candidateCount: 0,
      notes: [],
    }));
    addDesktopVideoCandidateMock.mockImplementation(({ sessionId }) => ({
      id: sessionId,
      viewerName: 'MetaAgent viewer',
      transport: 'webrtc',
      codec: 'h264',
      preferredWidth: 1280,
      preferredHeight: 720,
      preferredFps: 30,
      status: 'streaming',
      createdAt: '2026-03-22T07:00:00.000Z',
      updatedAt: '2026-03-22T07:00:03.000Z',
      lastError: null,
      viewerOfferSdp: 'viewer-sdp',
      hostAnswerSdp: 'host-sdp',
      candidateCount: 1,
      notes: [],
    }));
    closeDesktopVideoSessionMock.mockReturnValue({
      closed: true,
      session: {
        id: 'video-session-1',
        viewerName: 'MetaAgent viewer',
        transport: 'webrtc',
        codec: 'h264',
        preferredWidth: 1280,
        preferredHeight: 720,
        preferredFps: 30,
        status: 'closed',
        createdAt: '2026-03-22T07:00:00.000Z',
        updatedAt: '2026-03-22T07:00:04.000Z',
        lastError: null,
        viewerOfferSdp: 'viewer-sdp',
        hostAnswerSdp: 'host-sdp',
        candidateCount: 1,
        notes: [],
      },
    });

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
        pairing: {
          autoApprove: false,
          passwordConfigured: false,
        },
        agent: {
          settings: {
            provider: 'codex',
            executable: 'codex',
            args: '',
            cwd: 'D:\\works\\nanoclaw',
          },
          state: {
            status: 'idle',
            provider: 'codex',
            prompt: null,
            pid: null,
            startedAt: null,
            finishedAt: null,
            exitCode: null,
            cwd: 'D:\\works\\nanoclaw',
            executable: 'codex',
            args: '',
            lastError: null,
            lastOutput: null,
          },
        },
        video: {
          session: null,
          transport: 'webrtc',
          capturePipeline: 'desktop-duplication-planned',
        },
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
      { processName: 'Code', title: 'MetaAgent', pid: 1001 },
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

    it('reads desktop agent state', async () => {
    getDesktopAgentStateMock.mockReturnValue({
      status: 'running',
      provider: 'codex',
      prompt: 'scan repo',
      pid: 4242,
      startedAt: '2026-03-22T06:00:00.000Z',
      finishedAt: null,
      exitCode: null,
      cwd: 'D:\\works\\nanoclaw',
      executable: 'codex',
      args: 'exec scan repo',
      lastError: null,
      lastOutput: 'Analyzing repository',
      sessionId: 'session-1',
      pendingMessageCount: 1,
      messageCount: 2,
    });
    getDesktopAgentSessionMock.mockReturnValue({
      id: 'session-1',
      provider: 'codex',
      cwd: 'D:\\works\\nanoclaw',
      executable: 'codex',
      args: '',
      startedAt: '2026-03-22T06:00:00.000Z',
      updatedAt: '2026-03-22T06:01:00.000Z',
      lastTurnAt: '2026-03-22T06:01:00.000Z',
      pendingMessageCount: 1,
      messageCount: 2,
    });

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/agent/state',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        settings: {
          provider: 'codex',
          executable: 'codex',
          args: '',
          cwd: 'D:\\works\\nanoclaw',
        },
        state: {
          status: 'running',
          provider: 'codex',
          prompt: 'scan repo',
          pid: 4242,
          startedAt: '2026-03-22T06:00:00.000Z',
          finishedAt: null,
          exitCode: null,
          cwd: 'D:\\works\\nanoclaw',
          executable: 'codex',
          args: 'exec scan repo',
          lastError: null,
          lastOutput: 'Analyzing repository',
          sessionId: 'session-1',
          pendingMessageCount: 1,
          messageCount: 2,
        },
        session: {
          id: 'session-1',
          provider: 'codex',
          cwd: 'D:\\works\\nanoclaw',
          executable: 'codex',
          args: '',
          startedAt: '2026-03-22T06:00:00.000Z',
          updatedAt: '2026-03-22T06:01:00.000Z',
          lastTurnAt: '2026-03-22T06:01:00.000Z',
          pendingMessageCount: 1,
          messageCount: 2,
        },
      },
    });
  });

  it('reads desktop agent logs', async () => {
    listDesktopAgentLogsMock.mockReturnValue([
      { at: '2026-03-22T06:00:00.000Z', stream: 'stdout', line: 'line one' },
      { at: '2026-03-22T06:00:01.000Z', stream: 'system', line: 'line two' },
    ]);

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/agent/logs?limit=2',
    });

    expect(listDesktopAgentLogsMock).toHaveBeenCalledWith(2);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        logs: [
          { at: '2026-03-22T06:00:00.000Z', stream: 'stdout', line: 'line one' },
          { at: '2026-03-22T06:00:01.000Z', stream: 'system', line: 'line two' },
        ],
      },
    });
  });

    it('runs desktop agent', async () => {
    runDesktopAgentMock.mockReturnValue({
      ok: true,
      state: {
        status: 'running',
        provider: 'codex',
        prompt: 'review repo',
        pid: 7788,
        startedAt: '2026-03-22T06:10:00.000Z',
        finishedAt: null,
        exitCode: null,
        cwd: 'D:\\works\\nanoclaw',
        executable: 'codex',
        args: 'exec review repo',
        lastError: null,
        lastOutput: null,
        sessionId: 'session-2',
        pendingMessageCount: 0,
        messageCount: 1,
      },
    });
    getDesktopAgentSessionMock.mockReturnValue({
      id: 'session-2',
      provider: 'codex',
      cwd: 'D:\\works\\nanoclaw',
      executable: 'codex',
      args: '',
      startedAt: '2026-03-22T06:10:00.000Z',
      updatedAt: '2026-03-22T06:10:00.000Z',
      lastTurnAt: null,
      pendingMessageCount: 0,
      messageCount: 1,
    });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/agent/run',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ prompt: 'review repo', provider: 'codex', cwd: 'D:/works/nanoclaw' }),
    );

    expect(runDesktopAgentMock).toHaveBeenCalledWith({
      prompt: 'review repo',
      provider: 'codex',
      cwd: 'D:/works/nanoclaw',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        state: {
          status: 'running',
          provider: 'codex',
          prompt: 'review repo',
          pid: 7788,
          startedAt: '2026-03-22T06:10:00.000Z',
          finishedAt: null,
          exitCode: null,
          cwd: 'D:\\works\\nanoclaw',
          executable: 'codex',
          args: 'exec review repo',
          lastError: null,
          lastOutput: null,
          sessionId: 'session-2',
          pendingMessageCount: 0,
          messageCount: 1,
        },
        session: {
          id: 'session-2',
          provider: 'codex',
          cwd: 'D:\\works\\nanoclaw',
          executable: 'codex',
          args: '',
          startedAt: '2026-03-22T06:10:00.000Z',
          updatedAt: '2026-03-22T06:10:00.000Z',
          lastTurnAt: null,
          pendingMessageCount: 0,
          messageCount: 1,
        },
      },
    });
  });

  it('queues interactive desktop agent message', async () => {
    sendDesktopAgentMessageMock.mockReturnValue({
      ok: true,
      state: {
        status: 'running',
        provider: 'codex',
        prompt: 'follow up',
        pid: 9001,
        startedAt: '2026-03-22T06:12:00.000Z',
        finishedAt: null,
        exitCode: null,
        cwd: 'D:\\works\\nanoclaw',
        executable: 'codex',
        args: 'exec follow up',
        lastError: null,
        lastOutput: null,
        sessionId: 'session-3',
        pendingMessageCount: 1,
        messageCount: 3,
      },
      session: {
        id: 'session-3',
        provider: 'codex',
        cwd: 'D:\\works\\nanoclaw',
        executable: 'codex',
        args: '',
        startedAt: '2026-03-22T06:10:00.000Z',
        updatedAt: '2026-03-22T06:12:00.000Z',
        lastTurnAt: '2026-03-22T06:11:00.000Z',
        pendingMessageCount: 1,
        messageCount: 3,
      },
      message: {
        id: 'message-1',
        role: 'user',
        text: 'follow up',
        at: '2026-03-22T06:12:00.000Z',
        turn: 3,
        state: 'queued',
      },
    });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/agent/message',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ message: 'follow up', provider: 'codex', cwd: 'D:/works/nanoclaw' }),
    );

    expect(sendDesktopAgentMessageMock).toHaveBeenCalledWith({
      message: 'follow up',
      provider: 'codex',
      cwd: 'D:/works/nanoclaw',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);
  });

  it('stops desktop agent', async () => {
    stopDesktopAgentMock.mockReturnValue({
      ok: true,
      message: 'Stop signal sent',
    });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/agent/stop',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({}),
    );

    expect(stopDesktopAgentMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        ok: true,
        message: 'Stop signal sent',
      },
    });
  });

  it('updates desktop agent settings through admin endpoint', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    mockConfig.DESKTOP_REMOTE_ADMIN_TOKEN = 'admin-secret';
    server = await startDesktopRemoteApi();
    port = (server.address() as AddressInfo).port;

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/pair/admin/agent-settings',
        headers: {
          'content-type': 'application/json',
          'x-desktop-admin-token': 'admin-secret',
        },
      },
      JSON.stringify({
        provider: 'claude',
        executable: 'claude',
        args: '-p {prompt}',
        cwd: 'D:/workspace',
      }),
      false,
    );

    expect(updateDesktopAgentSettingsMock).toHaveBeenCalledWith({
      provider: 'claude',
      executable: 'claude',
      args: '-p {prompt}',
      cwd: 'D:/workspace',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      data: {
        settings: {
          provider: 'claude',
          executable: 'claude',
          args: '-p {prompt}',
          cwd: 'D:/workspace',
        },
      },
    });
  });

  it('opens desktop video session', async () => {
    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/video/session/open',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({
        viewerName: 'Android phone',
        codec: 'h264',
        preferredWidth: 1920,
        preferredHeight: 1080,
        preferredFps: 30,
      }),
    );

    expect(openDesktopVideoSessionMock).toHaveBeenCalledWith({
      viewerName: 'Android phone',
      codec: 'h264',
      preferredWidth: 1920,
      preferredHeight: 1080,
      preferredFps: 30,
    });
    expect(response.statusCode).toBe(200);
  });

  it('reads desktop video session state', async () => {
    getDesktopVideoSessionMock.mockReturnValue({
      id: 'video-session-1',
      viewerName: 'Android phone',
      transport: 'webrtc',
      codec: 'h264',
      preferredWidth: 1280,
      preferredHeight: 720,
      preferredFps: 30,
      status: 'negotiating',
      createdAt: '2026-03-22T07:00:00.000Z',
      updatedAt: '2026-03-22T07:00:01.000Z',
      lastError: null,
      viewerOfferSdp: 'viewer-sdp',
      hostAnswerSdp: null,
      candidateCount: 0,
      notes: [],
    });

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/video/session',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.transport).toBe('webrtc');
  });

  it('accepts desktop video offer, answer and candidate', async () => {
    const offerResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/video/session/offer',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ sessionId: 'video-session-1', sdp: 'viewer-sdp' }),
    );
    expect(submitDesktopVideoOfferMock).toHaveBeenCalledWith({
      sessionId: 'video-session-1',
      sdp: 'viewer-sdp',
    });
    expect(offerResponse.statusCode).toBe(200);

    const answerResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/video/session/answer',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ sessionId: 'video-session-1', sdp: 'host-sdp' }),
    );
    expect(submitDesktopVideoAnswerMock).toHaveBeenCalledWith({
      sessionId: 'video-session-1',
      sdp: 'host-sdp',
    });
    expect(answerResponse.statusCode).toBe(200);

    const candidateResponse = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/video/session/candidate',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ sessionId: 'video-session-1', candidate: 'candidate-1' }),
    );
    expect(addDesktopVideoCandidateMock).toHaveBeenCalledWith({
      sessionId: 'video-session-1',
      candidate: 'candidate-1',
    });
    expect(candidateResponse.statusCode).toBe(200);
  });

  it('closes desktop video session', async () => {
    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/video/session/close',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({}),
    );

    expect(closeDesktopVideoSessionMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
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

  it('moves mouse relatively through desktop control endpoint', async () => {
    moveMouseRelativeMock.mockResolvedValue({ ok: true, message: 'Mouse moved relatively' });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/move-relative',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ deltaX: 18, deltaY: -9 }),
    );

    expect(moveMouseRelativeMock).toHaveBeenCalledWith(18, -9);
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

  it('clicks at current cursor position when coordinates omitted', async () => {
    clickMouseCurrentMock.mockResolvedValue({
      ok: true,
      message: 'Mouse left clicked at current position',
    });

    const response = await makeRequest(
      port,
      {
        method: 'POST',
        path: '/api/desktop/input/click',
        headers: {
          'content-type': 'application/json',
        },
      },
      JSON.stringify({ button: 'left' }),
    );

    expect(clickMouseCurrentMock).toHaveBeenCalledWith('left');
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

  it('keeps health public but protects desktop capabilities when token configured', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    mockConfig.DESKTOP_REMOTE_API_TOKEN = 'secret-token';
    server = await startDesktopRemoteApi();
    port = (server.address() as AddressInfo).port;

    const healthResponse = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/health',
    });
    expect(healthResponse.statusCode).toBe(200);

    const response = await makeRequest(port, {
      method: 'GET',
      path: '/api/desktop/capabilities',
    }, '', false);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      error: 'Unauthorized',
    });
  });
});
