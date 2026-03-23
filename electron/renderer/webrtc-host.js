let currentSessionId = null;
let peerConnection = null;
let screenStream = null;
let viewerCandidateTimer = null;
const appliedViewerCandidates = new Set();

async function postJson(endpoint, token, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function getJson(endpoint, token, path) {
  const response = await fetch(`${endpoint}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return response.json();
}

async function ensureScreenStream() {
  if (screenStream) {
    return screenStream;
  }
  screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
  return screenStream;
}

function stopViewerCandidatePolling() {
  if (viewerCandidateTimer) {
    clearInterval(viewerCandidateTimer);
    viewerCandidateTimer = null;
  }
}

function startViewerCandidatePolling(endpoint, token, sessionId, pc) {
  stopViewerCandidatePolling();
  const syncCandidates = async () => {
    try {
      const payload = await getJson(endpoint, token, '/api/desktop/video/session');
      const session = payload?.data?.session;
      if (!session || session.id !== sessionId) {
        return;
      }
      const candidates = Array.isArray(session.viewerCandidates) ? session.viewerCandidates : [];
      for (const rawCandidate of candidates) {
        if (!rawCandidate || appliedViewerCandidates.has(rawCandidate)) {
          continue;
        }
        await pc.addIceCandidate(JSON.parse(rawCandidate));
        appliedViewerCandidates.add(rawCandidate);
      }
    } catch (error) {
      console.error('viewer candidate sync failed', error);
    }
  };

  viewerCandidateTimer = setInterval(() => {
    void syncCandidates();
  }, 500);
  void syncCandidates();
}

async function createAnswer(endpoint, token, session) {
  if (!session?.viewerOfferSdp || !session.id) return;
  if (currentSessionId === session.id && session.hostAnswerSdp) return;

  stopViewerCandidatePolling();
  appliedViewerCandidates.clear();

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  const stream = await ensureScreenStream();
  const pc = new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: 'max-bundle',
  });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  pc.onicecandidate = async (event) => {
    if (!event.candidate) return;
    await postJson(endpoint, token, '/api/desktop/video/session/candidate', {
      sessionId: session.id,
      source: 'host',
      candidate: JSON.stringify(event.candidate.toJSON()),
    });
  };
  pc.onconnectionstatechange = () => {
    console.log('host connection state', pc.connectionState);
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      stopViewerCandidatePolling();
    }
  };

  await pc.setRemoteDescription({ type: 'offer', sdp: session.viewerOfferSdp });
  startViewerCandidatePolling(endpoint, token, session.id, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    setTimeout(resolve, 1500);
  });

  await postJson(endpoint, token, '/api/desktop/video/session/answer', {
    sessionId: session.id,
    sdp: pc.localDescription?.sdp || '',
  });

  peerConnection = pc;
  currentSessionId = session.id;
}

window.metaAgentDesktop.onVideoSession(async (payload) => {
  const session = payload?.payload?.session;
  const endpoint = payload?.endpoint;
  const token = payload?.token || '';
  if (!session || !endpoint) {
    stopViewerCandidatePolling();
    return;
  }
  if (session.viewerOfferSdp) {
    try {
      await createAnswer(endpoint, token, session);
    } catch (error) {
      console.error('webrtc host failed', error);
    }
  }
});
