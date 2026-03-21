import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import { DESKTOP_REMOTE_SESSION_TIMEOUT_MS } from '../config.js';

export interface DesktopControlSession {
  id: string;
  clientName: string;
  openedAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface DesktopEvent {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

interface OpenSessionOptions {
  clientName?: string;
}

interface HeartbeatOptions {
  sessionId?: string;
}

const events = new EventEmitter();
const recentEvents: DesktopEvent[] = [];
const MAX_EVENTS = 100;

let activeSession: DesktopControlSession | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function emitEvent(type: string, data: Record<string, unknown>): DesktopEvent {
  const event: DesktopEvent = {
    id: randomUUID(),
    type,
    createdAt: nowIso(),
    data,
  };
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_EVENTS);
  }
  events.emit('event', event);
  return event;
}

function withExpiry(base: Date): string {
  return new Date(
    base.getTime() + DESKTOP_REMOTE_SESSION_TIMEOUT_MS,
  ).toISOString();
}

function normalizeSession(session: DesktopControlSession): DesktopControlSession {
  const now = new Date();
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    activeSession = null;
    emitEvent('session.expired', {
      sessionId: session.id,
      clientName: session.clientName,
    });
    return null as never;
  }
  return session;
}

export function getActiveDesktopSession(): DesktopControlSession | null {
  if (!activeSession) {
    return null;
  }
  return normalizeSession(activeSession);
}

export function openDesktopSession(
  options: OpenSessionOptions = {},
): DesktopControlSession {
  const currentTime = new Date();
  const clientName = options.clientName?.trim() || 'phone-ui';

  activeSession = {
    id: randomUUID(),
    clientName,
    openedAt: currentTime.toISOString(),
    lastSeenAt: currentTime.toISOString(),
    expiresAt: withExpiry(currentTime),
  };

  emitEvent('session.opened', {
    sessionId: activeSession.id,
    clientName: activeSession.clientName,
    expiresAt: activeSession.expiresAt,
  });

  return activeSession;
}

export function heartbeatDesktopSession(
  options: HeartbeatOptions = {},
): DesktopControlSession | null {
  const session = getActiveDesktopSession();
  if (!session) {
    return null;
  }
  if (options.sessionId && options.sessionId !== session.id) {
    return null;
  }

  const currentTime = new Date();
  activeSession = {
    ...session,
    lastSeenAt: currentTime.toISOString(),
    expiresAt: withExpiry(currentTime),
  };

  emitEvent('session.heartbeat', {
    sessionId: activeSession.id,
    clientName: activeSession.clientName,
    expiresAt: activeSession.expiresAt,
  });

  return activeSession;
}

export function closeDesktopSession(sessionId?: string): boolean {
  const session = getActiveDesktopSession();
  if (!session) {
    return false;
  }
  if (sessionId && session.id !== sessionId) {
    return false;
  }
  activeSession = null;
  emitEvent('session.closed', {
    sessionId: session.id,
    clientName: session.clientName,
  });
  return true;
}

export function publishDesktopEvent(
  type: string,
  data: Record<string, unknown>,
): DesktopEvent {
  return emitEvent(type, data);
}

export function listDesktopEvents(limit = 20): DesktopEvent[] {
  return recentEvents.slice(-Math.max(1, Math.min(limit, MAX_EVENTS)));
}

export function subscribeDesktopEvents(
  listener: (event: DesktopEvent) => void,
): () => void {
  events.on('event', listener);
  return () => {
    events.off('event', listener);
  };
}

export function resetDesktopSessionManagerForTests(): void {
  activeSession = null;
  recentEvents.splice(0, recentEvents.length);
  events.removeAllListeners('event');
}
