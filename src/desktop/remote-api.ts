import { createServer, IncomingMessage, Server, ServerResponse } from 'http';

import {
  captureDesktopScreenshot,
  clickMouse,
  clickMouseCurrent,
  dragMouse,
  getClipboardText,
  getDesktopCapabilities,
  getDesktopSystemInfo,
  listDesktopWindows,
  launchApp,
  moveMouse,
  moveMouseRelative,
  pressKey,
  pressHotkey,
  scrollMouse,
  setClipboardText,
  sendText,
} from './control.js';
import {
  DESKTOP_REMOTE_API_HOST,
  DESKTOP_REMOTE_API_PORT,
  DESKTOP_REMOTE_ADMIN_TOKEN,
  DESKTOP_REMOTE_API_TOKEN,
} from '../config.js';
import {
  authenticatePairing,
  decidePairingRequest,
  getPairingRequest,
  getPairingSettings,
  listPendingPairingRequests,
  requestPairing,
  updatePairingSettings,
} from './pairing-manager.js';
import {
  getActiveSession,
  startRemoteControl,
  stopRemoteControl,
} from './remote-control.js';
import {
  closeDesktopSession,
  getActiveDesktopSession,
  heartbeatDesktopSession,
  listDesktopEvents,
  openDesktopSession,
  publishDesktopEvent,
  subscribeDesktopEvents,
  validateDesktopSessionToken,
} from './session-manager.js';
import { logger } from '../logger.js';

interface StartRequest {
  sender?: string;
  chatJid?: string;
  cwd?: string;
}

interface MouseMoveRequest {
  x: number;
  y: number;
}

interface MouseMoveRelativeRequest {
  deltaX: number;
  deltaY: number;
}

interface MouseClickRequest extends MouseMoveRequest {
  button?: 'left' | 'right' | 'middle';
}

interface TextRequest {
  text: string;
}

interface KeyRequest {
  key: string;
}

interface LaunchRequest {
  command: string;
  args?: string[];
}

interface MouseDragRequest {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  button?: 'left' | 'right' | 'middle';
  steps?: number;
}

interface ScrollRequest {
  delta: number;
}

interface HotkeyRequest {
  keys: string[];
}

interface ClipboardTextRequest {
  text: string;
}

interface OpenDesktopSessionRequest {
  clientName?: string;
}

interface HeartbeatRequest {
  sessionId?: string;
}

interface CloseSessionRequest {
  sessionId?: string;
}

interface PairingRequestBody {
  deviceName?: string;
}

interface PairingAuthRequest {
  pairingId: string;
  password: string;
  clientName?: string;
}

interface PairingDecisionRequest {
  pairingId: string;
  approve: boolean;
}

interface PairingSettingsRequest {
  autoApprove?: boolean;
  password?: string;
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

function bearerToken(req: IncomingMessage): string {
  const authHeader = req.headers.authorization?.trim() || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

function isAdminAuthorized(req: IncomingMessage): boolean {
  if (!DESKTOP_REMOTE_ADMIN_TOKEN) {
    return false;
  }
  const adminHeader = req.headers['x-desktop-admin-token'];
  const token = Array.isArray(adminHeader) ? adminHeader[0] : adminHeader;
  return (token || '').trim() === DESKTOP_REMOTE_ADMIN_TOKEN;
}

function isApiAuthorized(req: IncomingMessage): boolean {
  const token = bearerToken(req);
  if (DESKTOP_REMOTE_API_TOKEN && token === DESKTOP_REMOTE_API_TOKEN) {
    return true;
  }
  if (token && validateDesktopSessionToken(token)) {
    return true;
  }
  return false;
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

function serializeDesktopControlSession() {
  const session = getActiveDesktopSession();
  return session
    ? {
        id: session.id,
        clientName: session.clientName,
        openedAt: session.openedAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      }
    : null;
}

function serializePairingRequest(pairingId: string) {
  const request = getPairingRequest(pairingId);
  return request
    ? {
        pairingId: request.id,
        deviceName: request.deviceName,
        status: request.status,
        requestedAt: request.requestedAt,
        approvedAt: request.approvedAt ?? null,
        rejectedAt: request.rejectedAt ?? null,
        expiresAt: request.expiresAt,
      }
    : null;
}

function sendSseEvent(res: ServerResponse, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

        if (method === 'GET' && url.pathname === '/api/desktop/health') {
          sendJson(res, 200, {
            ok: true,
            data: {
              service: 'nanoclaw-desktop-remote',
              hasActiveSession: getActiveSession() !== null,
              hasDesktopSession: getActiveDesktopSession() !== null,
              apiVersion: 1,
              pairing: getPairingSettings(),
            },
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/pair/request') {
          const body = (await readJsonBody<PairingRequestBody>(req)) || {};
          const request = requestPairing({ deviceName: body.deviceName });
          sendJson(res, 200, {
            ok: true,
            data: {
              request: serializePairingRequest(request.id),
              pairing: getPairingSettings(),
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/pair/status') {
          const pairingId = url.searchParams.get('pairingId') || '';
          if (!pairingId) {
            sendJson(res, 400, { ok: false, error: 'Missing pairingId' });
            return;
          }
          const request = serializePairingRequest(pairingId);
          if (!request) {
            sendJson(res, 404, { ok: false, error: 'Pairing request not found' });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              request,
              pairing: getPairingSettings(),
            },
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/pair/authenticate') {
          const body = (await readJsonBody<PairingAuthRequest>(req)) || ({} as PairingAuthRequest);
          if (!body.pairingId) {
            sendJson(res, 400, { ok: false, error: 'Missing pairingId' });
            return;
          }
          try {
            const result = authenticatePairing(body);
            sendJson(res, 200, {
              ok: true,
              data: {
                session: serializeDesktopControlSession(),
                sessionToken: result.sessionToken,
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Authentication failed';
            sendJson(res, 401, { ok: false, error: message });
          }
          return;
        }

        if (url.pathname.startsWith('/api/desktop/pair/admin/')) {
          if (!isAdminAuthorized(req)) {
            unauthorized(res);
            return;
          }

          if (method === 'GET' && url.pathname === '/api/desktop/pair/admin/state') {
            sendJson(res, 200, {
              ok: true,
              data: {
                pairing: getPairingSettings(),
                pendingRequests: listPendingPairingRequests().map((request) => ({
                  pairingId: request.id,
                  deviceName: request.deviceName,
                  status: request.status,
                  requestedAt: request.requestedAt,
                  expiresAt: request.expiresAt,
                })),
              },
            });
            return;
          }

          if (method === 'POST' && url.pathname === '/api/desktop/pair/admin/decision') {
            const body = (await readJsonBody<PairingDecisionRequest>(req)) || ({} as PairingDecisionRequest);
            if (!body.pairingId) {
              sendJson(res, 400, { ok: false, error: 'Missing pairingId' });
              return;
            }
            const request = decidePairingRequest(body.pairingId, body.approve);
            if (!request) {
              sendJson(res, 404, { ok: false, error: 'Pending pairing request not found' });
              return;
            }
            sendJson(res, 200, {
              ok: true,
              data: {
                request: serializePairingRequest(request.id),
              },
            });
            return;
          }

          if (method === 'POST' && url.pathname === '/api/desktop/pair/admin/settings') {
            const body = (await readJsonBody<PairingSettingsRequest>(req)) || {};
            sendJson(res, 200, {
              ok: true,
              data: {
                pairing: updatePairingSettings(body),
              },
            });
            return;
          }

          methodNotAllowed(res);
          return;
        }

        if (
          !(
            method === 'GET' && url.pathname === '/api/desktop/health'
          ) &&
          !url.pathname.startsWith('/api/desktop/pair/')
        ) {
          if (!isApiAuthorized(req)) {
            unauthorized(res);
            return;
          }
        }

        if (method === 'GET' && url.pathname === '/api/desktop/capabilities') {
          sendJson(res, 200, {
            ok: true,
            data: getDesktopCapabilities(),
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/system/info') {
          const info = await getDesktopSystemInfo();
          sendJson(res, 200, {
            ok: true,
            data: info,
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/windows') {
          const windows = await listDesktopWindows();
          sendJson(res, 200, {
            ok: true,
            data: {
              windows,
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/clipboard') {
          const clipboard = await getClipboardText();
          sendJson(res, 200, {
            ok: true,
            data: clipboard,
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/session/open') {
          const body = (await readJsonBody<OpenDesktopSessionRequest>(req)) || {};
          const session = openDesktopSession({ clientName: body.clientName });
          sendJson(res, 200, {
            ok: true,
            data: {
              session: serializeDesktopControlSession(),
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/session') {
          sendJson(res, 200, {
            ok: true,
            data: {
              session: serializeDesktopControlSession(),
            },
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/session/heartbeat') {
          const body = (await readJsonBody<HeartbeatRequest>(req)) || {};
          const session = heartbeatDesktopSession({ sessionId: body.sessionId });
          if (!session) {
            sendJson(res, 404, { ok: false, error: 'No active desktop session' });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              session: serializeDesktopControlSession(),
            },
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/session/close') {
          const body = (await readJsonBody<CloseSessionRequest>(req)) || {};
          const closed = closeDesktopSession(body.sessionId);
          if (!closed) {
            sendJson(res, 404, { ok: false, error: 'No active desktop session' });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              closed: true,
              session: null,
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/events') {
          const limit = Number.parseInt(url.searchParams.get('limit') || '20', 10);
          sendJson(res, 200, {
            ok: true,
            data: {
              events: listDesktopEvents(Number.isFinite(limit) ? limit : 20),
            },
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/events/stream') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          });
          sendSseEvent(res, 'ready', {
            ok: true,
            session: serializeDesktopControlSession(),
          });
          for (const event of listDesktopEvents(10)) {
            sendSseEvent(res, 'desktop-event', event);
          }

          const unsubscribe = subscribeDesktopEvents((event) => {
            sendSseEvent(res, 'desktop-event', event);
          });
          const keepAlive = setInterval(() => {
            res.write(': keep-alive\n\n');
          }, 15000);

          req.on('close', () => {
            clearInterval(keepAlive);
            unsubscribe();
            res.end();
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
            publishDesktopEvent('remote-control.started', {
              startedBy: body.sender || 'phone-ui',
              startedInChat: body.chatJid || 'phone-ui',
              url: result.url,
            });
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
            publishDesktopEvent('remote-control.stopped', {});
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

        if (method === 'GET' && url.pathname === '/api/desktop/stream') {
          res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          });

          let closed = false;
          let busy = false;
          const sendFrame = async () => {
            if (closed || busy) {
              return;
            }
            busy = true;
            try {
              const screenshot = await captureDesktopScreenshot();
              const bytes = Buffer.from(screenshot.base64, 'base64');
              res.write(`--frame\r\n`);
              res.write(`Content-Type: ${screenshot.mimeType}\r\n`);
              res.write(`Content-Length: ${bytes.length}\r\n`);
              res.write(`X-Width: ${screenshot.width}\r\n`);
              res.write(`X-Height: ${screenshot.height}\r\n\r\n`);
              res.write(bytes);
              res.write(`\r\n`);
            } catch (err) {
              logger.warn({ err }, 'Desktop stream frame capture failed');
            } finally {
              busy = false;
            }
          };

          void sendFrame();
          const timer = setInterval(() => {
            void sendFrame();
          }, 160);

          req.on('close', () => {
            closed = true;
            clearInterval(timer);
            res.end();
          });
          return;
        }

        if (method === 'GET' && url.pathname === '/api/desktop/screenshot') {
          const screenshot = await captureDesktopScreenshot();
          publishDesktopEvent('desktop.screenshot', {
            width: screenshot.width,
            height: screenshot.height,
            mimeType: screenshot.mimeType,
          });
          sendJson(res, 200, {
            ok: true,
            data: screenshot,
          });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/move') {
          const body = await readJsonBody<MouseMoveRequest>(req);
          if (!body || typeof body.x !== 'number' || typeof body.y !== 'number') {
            sendJson(res, 400, { ok: false, error: 'Missing x/y' });
            return;
          }
          const result = await moveMouse(body.x, body.y);
          publishDesktopEvent('desktop.input.move', {
            x: body.x,
            y: body.y,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/move-relative') {
          const body = await readJsonBody<MouseMoveRelativeRequest>(req);
          if (!body || typeof body.deltaX !== 'number' || typeof body.deltaY !== 'number') {
            sendJson(res, 400, { ok: false, error: 'Missing deltaX/deltaY' });
            return;
          }
          const result = await moveMouseRelative(body.deltaX, body.deltaY);
          publishDesktopEvent('desktop.input.move_relative', {
            deltaX: body.deltaX,
            deltaY: body.deltaY,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/click') {
          const body = await readJsonBody<MouseClickRequest>(req);
          if (!body) {
            sendJson(res, 400, { ok: false, error: 'Missing request body' });
            return;
          }
          const result =
            typeof body.x === 'number' && typeof body.y === 'number'
              ? await clickMouse(body.x, body.y, body.button || 'left')
              : await clickMouseCurrent(body.button || 'left');
          publishDesktopEvent('desktop.input.click', {
            x: body.x ?? null,
            y: body.y ?? null,
            button: body.button || 'left',
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/drag') {
          const body = await readJsonBody<MouseDragRequest>(req);
          if (
            !body ||
            typeof body.fromX !== 'number' ||
            typeof body.fromY !== 'number' ||
            typeof body.toX !== 'number' ||
            typeof body.toY !== 'number'
          ) {
            sendJson(res, 400, { ok: false, error: 'Missing from/to coordinates' });
            return;
          }
          const result = await dragMouse(
            body.fromX,
            body.fromY,
            body.toX,
            body.toY,
            body.button || 'left',
            body.steps,
          );
          publishDesktopEvent('desktop.input.drag', {
            fromX: body.fromX,
            fromY: body.fromY,
            toX: body.toX,
            toY: body.toY,
            button: body.button || 'left',
            steps: body.steps ?? 12,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/scroll') {
          const body = await readJsonBody<ScrollRequest>(req);
          if (!body || typeof body.delta !== 'number') {
            sendJson(res, 400, { ok: false, error: 'Missing delta' });
            return;
          }
          const result = await scrollMouse(body.delta);
          publishDesktopEvent('desktop.input.scroll', {
            delta: body.delta,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/type') {
          const body = await readJsonBody<TextRequest>(req);
          if (!body?.text) {
            sendJson(res, 400, { ok: false, error: 'Missing text' });
            return;
          }
          const result = await sendText(body.text);
          publishDesktopEvent('desktop.input.type', {
            length: body.text.length,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/key') {
          const body = await readJsonBody<KeyRequest>(req);
          if (!body?.key) {
            sendJson(res, 400, { ok: false, error: 'Missing key' });
            return;
          }
          const result = await pressKey(body.key);
          publishDesktopEvent('desktop.input.key', {
            key: body.key,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/input/hotkey') {
          const body = await readJsonBody<HotkeyRequest>(req);
          if (!body || !Array.isArray(body.keys) || body.keys.length === 0) {
            sendJson(res, 400, { ok: false, error: 'Missing keys' });
            return;
          }
          const result = await pressHotkey(body.keys);
          publishDesktopEvent('desktop.input.hotkey', {
            keys: body.keys,
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/app/launch') {
          const body = await readJsonBody<LaunchRequest>(req);
          if (!body?.command) {
            sendJson(res, 400, { ok: false, error: 'Missing command' });
            return;
          }
          const result = await launchApp(body.command, body.args || []);
          publishDesktopEvent('desktop.app.launch', {
            command: body.command,
            args: body.args || [],
          });
          sendJson(res, 200, { ok: true, data: result });
          return;
        }

        if (method === 'POST' && url.pathname === '/api/desktop/clipboard') {
          const body = await readJsonBody<ClipboardTextRequest>(req);
          if (!body || typeof body.text !== 'string') {
            sendJson(res, 400, { ok: false, error: 'Missing text' });
            return;
          }
          const result = await setClipboardText(body.text);
          publishDesktopEvent('desktop.clipboard.set', {
            length: body.text.length,
          });
          sendJson(res, 200, { ok: true, data: result });
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
          pairingEnabled: true,
        },
        'Desktop remote API started',
      );
      resolve(server);
    });

    server.on('error', reject);
  });
}

