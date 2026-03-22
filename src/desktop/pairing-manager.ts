import { randomUUID } from 'crypto';

import {
  DESKTOP_REMOTE_AUTO_APPROVE,
  DESKTOP_REMOTE_PAIR_PASSWORD,
  DESKTOP_REMOTE_SESSION_TIMEOUT_MS,
} from '../config.js';
import { openDesktopSession, publishDesktopEvent } from './session-manager.js';

export interface PairingRequest {
  id: string;
  deviceName: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiresAt: string;
}

interface RequestPairingOptions {
  deviceName?: string;
}

interface AuthenticatePairingOptions {
  pairingId: string;
  password: string;
  clientName?: string;
}

let autoApprove = DESKTOP_REMOTE_AUTO_APPROVE;
let pairPassword = DESKTOP_REMOTE_PAIR_PASSWORD;
const requests: PairingRequest[] = [];
const MAX_REQUESTS = 30;

function now(): Date {
  return new Date();
}

function withExpiry(base: Date): string {
  return new Date(
    base.getTime() + DESKTOP_REMOTE_SESSION_TIMEOUT_MS,
  ).toISOString();
}

function pruneRequests(): void {
  const currentTime = now().getTime();
  for (const request of requests) {
    if (
      request.status !== 'expired' &&
      currentTime >= new Date(request.expiresAt).getTime()
    ) {
      request.status = 'expired';
    }
  }
  if (requests.length > MAX_REQUESTS) {
    requests.splice(0, requests.length - MAX_REQUESTS);
  }
}

export function getPairingSettings() {
  return {
    autoApprove,
    passwordConfigured: pairPassword.length > 0,
  };
}

export function updatePairingSettings(options: {
  autoApprove?: boolean;
  password?: string;
}) {
  if (typeof options.autoApprove === 'boolean') {
    autoApprove = options.autoApprove;
  }
  if (typeof options.password === 'string') {
    pairPassword = options.password;
  }
  publishDesktopEvent('pairing.settings.updated', {
    autoApprove,
    passwordConfigured: pairPassword.length > 0,
  });
  return getPairingSettings();
}

export function requestPairing(
  options: RequestPairingOptions = {},
): PairingRequest {
  pruneRequests();
  const createdAt = now();
  const request: PairingRequest = {
    id: randomUUID(),
    deviceName: options.deviceName?.trim() || 'MetaAgent Android',
    status: autoApprove ? 'approved' : 'pending',
    requestedAt: createdAt.toISOString(),
    approvedAt: autoApprove ? createdAt.toISOString() : undefined,
    expiresAt: withExpiry(createdAt),
  };
  requests.push(request);
  publishDesktopEvent('pairing.requested', {
    pairingId: request.id,
    deviceName: request.deviceName,
    status: request.status,
  });
  return request;
}

export function getPairingRequest(pairingId: string): PairingRequest | null {
  pruneRequests();
  return requests.find((request) => request.id === pairingId) ?? null;
}

export function listPendingPairingRequests(): PairingRequest[] {
  pruneRequests();
  return requests
    .filter((request) => request.status === 'pending')
    .slice()
    .reverse();
}

export function decidePairingRequest(
  pairingId: string,
  approve: boolean,
): PairingRequest | null {
  pruneRequests();
  const request = requests.find((item) => item.id === pairingId);
  if (!request || request.status !== 'pending') {
    return null;
  }
  if (approve) {
    request.status = 'approved';
    request.approvedAt = now().toISOString();
  } else {
    request.status = 'rejected';
    request.rejectedAt = now().toISOString();
  }
  publishDesktopEvent('pairing.decision', {
    pairingId: request.id,
    deviceName: request.deviceName,
    status: request.status,
  });
  return request;
}

export function authenticatePairing(options: AuthenticatePairingOptions) {
  pruneRequests();
  const request = requests.find((item) => item.id === options.pairingId);
  if (!request) {
    throw new Error('Pairing request not found');
  }
  if (request.status !== 'approved') {
    throw new Error('Pairing request has not been approved');
  }
  if (pairPassword && options.password !== pairPassword) {
    throw new Error('Invalid pairing password');
  }

  const session = openDesktopSession({
    clientName: options.clientName?.trim() || request.deviceName,
  });
  publishDesktopEvent('pairing.authenticated', {
    pairingId: request.id,
    deviceName: request.deviceName,
    sessionId: session.id,
  });
  return {
    request,
    session,
    sessionToken: session.authToken,
  };
}
