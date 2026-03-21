import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = {
  DESKTOP_REMOTE_API_HOST: '127.0.0.1',
  DESKTOP_REMOTE_API_PORT: 0,
  DESKTOP_REMOTE_API_TOKEN: '',
};

const getActiveSessionMock = vi.fn();
const startRemoteControlMock = vi.fn();
const stopRemoteControlMock = vi.fn();

vi.mock('./config.js', () => ({
  get DESKTOP_REMOTE_API_HOST() {
    return mockConfig.DESKTOP_REMOTE_API_HOST;
  },
  get DESKTOP_REMOTE_API_PORT() {
    return mockConfig.DESKTOP_REMOTE_API_PORT;
  },
  get DESKTOP_REMOTE_API_TOKEN() {
    return mockConfig.DESKTOP_REMOTE_API_TOKEN;
  },
}));

vi.mock('./remote-control.js', () => ({
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  startRemoteControl: (...args: unknown[]) => startRemoteControlMock(...args),
  stopRemoteControl: (...args: unknown[]) => stopRemoteControlMock(...args),
}));

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { startDesktopRemoteApi } from './desktop-remote-api.js';

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
    startRemoteControlMock.mockReset();
    stopRemoteControlMock.mockReset();
    getActiveSessionMock.mockReturnValue(null);

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
        apiVersion: 1,
      },
    });
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
