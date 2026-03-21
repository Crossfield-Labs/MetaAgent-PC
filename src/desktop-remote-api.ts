import { createServer, IncomingMessage, Server, ServerResponse } from 'http';

import {
  DESKTOP_REMOTE_API_HOST,
  DESKTOP_REMOTE_API_PORT,
  DESKTOP_REMOTE_API_TOKEN,
} from './config.js';
import {
  getActiveSession,
  startRemoteControl,
  stopRemoteControl,
} from './remote-control.js';
import { logger } from './logger.js';

interface StartRequest {
  sender?: string;
  chatJid?: string;
  cwd?: string;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function unauthorized(res: ServerResponse): void {
  sendJson(res, 401, { ok: false, error: 'Unauthorized' });
}

function notFound(res: ServerResponse): void {
  sendJson(res, 404, { ok: false, error: 'Not found' });
}

function methodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!DESKTOP_REMOTE_API_TOKEN) {
    return true;
  }
  const authHeader = req.headers.authorization?.trim() || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  return token === DESKTOP_REMOTE_API_TOKEN;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf-8').trim();
  if (!body) {
    return null;
  }
  return JSON.parse(body) as T;
}

function serializeSession() {
  const session = getActiveSession();
  return session
    ? {
        pid: session.pid,
        url: session.url,
        startedBy: session.startedBy,
        startedInChat: session.startedInChat,
        startedAt: session.startedAt,
      }
    : null;
}

export function startDesktopRemoteApi(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const method = req.method || 'GET';
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (method === 'OPTIONS') {
          sendJson(res, 200, { ok: true });
          return;
        }

        if (!isAuthorized(req)) {
          unauthorized(res);
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/health') {
          sendJson(res, 200, {
            ok: true,
            data: {
              service: 'nanoclaw-desktop-remote',
              hasActiveSession: getActiveSession() !== null,
              apiVersion: 1,
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/remote-control/session') {
          sendJson(res, 200, {
            ok: true,
            data: {
              session: serializeSession(),
            },
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/remote-control/start') {
          const body = (await readJsonBody<StartRequest>(req)) || {};
          const result = await startRemoteControl(
            body.sender || 'phone-ui',
            body.chatJid || 'phone-ui',
            body.cwd || process.cwd(),
          );
          if (result.ok) {
            sendJson(res, 200, {
              ok: true,
              data: {
                url: result.url,
                session: serializeSession(),
              },
            });
          } else {
            sendJson(res, 400, { ok: false, error: result.error });
          }
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/remote-control/stop') {
          const result = stopRemoteControl();
          if (result.ok) {
            sendJson(res, 200, {
              ok: true,
              data: {
                stopped: true,
                session: null,
              },
            });
          } else {
            sendJson(res, 400, { ok: false, error: result.error });
          }
          return;
        }

        if (url.pathname.startsWith('/api/desktop/remote-control/')) {
          methodNotAllowed(res);
          return;
        }

        notFound(res);
      } catch (err) {
        logger.error({ err }, 'Desktop remote API request failed');
        sendJson(res, 500, { ok: false, error: 'Internal server error' });
      }
    });

    server.listen(DESKTOP_REMOTE_API_PORT, DESKTOP_REMOTE_API_HOST, () => {
      logger.info(
        {
          host: DESKTOP_REMOTE_API_HOST,
          port: DESKTOP_REMOTE_API_PORT,
          authEnabled: Boolean(DESKTOP_REMOTE_API_TOKEN),
        },
        'Desktop remote API started',
      );
      resolve(server);
    });

    server.on('error', reject);
  });
}
