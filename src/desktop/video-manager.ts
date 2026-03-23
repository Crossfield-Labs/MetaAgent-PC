import { randomUUID } from 'node:crypto';

export type DesktopVideoTransport = 'webrtc';
export type DesktopVideoCodec = 'h264' | 'vp9' | 'av1';
export type DesktopVideoStatus =
  | 'idle'
  | 'preparing'
  | 'negotiating'
  | 'streaming'
  | 'closed'
  | 'error';

export interface DesktopVideoSession {
  id: string;
  viewerName: string;
  transport: DesktopVideoTransport;
  codec: DesktopVideoCodec;
  preferredWidth: number;
  preferredHeight: number;
  preferredFps: number;
  status: DesktopVideoStatus;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  viewerOfferSdp: string | null;
  hostAnswerSdp: string | null;
  candidateCount: number;
  viewerCandidates: string[];
  hostCandidates: string[];
  notes: string[];
}

interface OpenVideoSessionRequest {
  viewerName?: string;
  codec?: DesktopVideoCodec;
  preferredWidth?: number;
  preferredHeight?: number;
  preferredFps?: number;
}

interface SubmitOfferRequest {
  sessionId: string;
  sdp: string;
}

interface SubmitAnswerRequest {
  sessionId: string;
  sdp: string;
}

interface SubmitCandidateRequest {
  sessionId: string;
  candidate: string;
  source?: 'viewer' | 'host';
}

let activeSession: DesktopVideoSession | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function appendNote(
  session: DesktopVideoSession,
  note: string,
): DesktopVideoSession {
  return {
    ...session,
    updatedAt: nowIso(),
    notes: [...session.notes.slice(-19), `${nowIso()} ${note}`],
  };
}

export function getDesktopVideoSession(): DesktopVideoSession | null {
  return activeSession
    ? {
        ...activeSession,
        viewerCandidates: [...activeSession.viewerCandidates],
        hostCandidates: [...activeSession.hostCandidates],
        notes: [...activeSession.notes],
      }
    : null;
}

export function openDesktopVideoSession(
  request: OpenVideoSessionRequest = {},
): DesktopVideoSession {
  const createdAt = nowIso();
  activeSession = {
    id: randomUUID(),
    viewerName:
      (request.viewerName || 'MetaAgent viewer').trim() || 'MetaAgent viewer',
    transport: 'webrtc',
    codec: request.codec || 'h264',
    preferredWidth: Math.max(640, request.preferredWidth || 1280),
    preferredHeight: Math.max(360, request.preferredHeight || 720),
    preferredFps: Math.min(60, Math.max(10, request.preferredFps || 30)),
    status: 'preparing',
    createdAt,
    updatedAt: createdAt,
    lastError: null,
    viewerOfferSdp: null,
    hostAnswerSdp: null,
    candidateCount: 0,
    viewerCandidates: [],
    hostCandidates: [],
    notes: [`${createdAt} desktop video session created`],
  };
  return getDesktopVideoSession() as DesktopVideoSession;
}

export function closeDesktopVideoSession(): {
  closed: boolean;
  session: DesktopVideoSession | null;
} {
  if (!activeSession) {
    return { closed: false, session: null };
  }
  activeSession = appendNote(activeSession, 'desktop video session closed');
  activeSession.status = 'closed';
  const snapshot = getDesktopVideoSession();
  activeSession = null;
  return { closed: true, session: snapshot };
}

export function submitDesktopVideoOffer(
  request: SubmitOfferRequest,
): DesktopVideoSession | null {
  if (!activeSession || activeSession.id !== request.sessionId) {
    return null;
  }
  activeSession = appendNote(activeSession, 'viewer offer received');
  activeSession.viewerOfferSdp = request.sdp.trim();
  activeSession.status = 'negotiating';
  activeSession.viewerCandidates = [];
  activeSession.hostCandidates = [];
  activeSession.candidateCount = 0;
  return getDesktopVideoSession();
}

export function submitDesktopVideoAnswer(
  request: SubmitAnswerRequest,
): DesktopVideoSession | null {
  if (!activeSession || activeSession.id !== request.sessionId) {
    return null;
  }
  activeSession = appendNote(activeSession, 'host answer received');
  activeSession.hostAnswerSdp = request.sdp.trim();
  activeSession.status = 'streaming';
  return getDesktopVideoSession();
}

export function addDesktopVideoCandidate(
  request: SubmitCandidateRequest,
): DesktopVideoSession | null {
  if (!activeSession || activeSession.id !== request.sessionId) {
    return null;
  }

  const source = request.source === 'viewer' ? 'viewer' : 'host';
  const target =
    source === 'viewer'
      ? activeSession.viewerCandidates
      : activeSession.hostCandidates;
  if (!target.includes(request.candidate)) {
    target.push(request.candidate);
    activeSession.candidateCount += 1;
    activeSession = appendNote(
      activeSession,
      `${source} ice candidate received`,
    );
  }
  return getDesktopVideoSession();
}

export function markDesktopVideoError(
  message: string,
): DesktopVideoSession | null {
  if (!activeSession) {
    return null;
  }
  activeSession = appendNote(activeSession, `video error: ${message}`);
  activeSession.status = 'error';
  activeSession.lastError = message;
  return getDesktopVideoSession();
}
