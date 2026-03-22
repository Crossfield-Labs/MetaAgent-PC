import { currentConfig, invokeAdmin, invokeApi } from './api.js';
import { createDom } from './dom.js';
import {
  hidePairingModal,
  renderEvents,
  renderLogEntry,
  renderPendingRequests,
  renderScreenshot,
  renderState,
  setResponse,
  setView,
  showPairingModal,
} from './render.js';

let pairingPollTimer = null;
let activePairingRequest = null;
let dismissedPairingIds = new Set();

async function refreshPairingState(el) {
  const payload = await invokeAdmin('GET', '/api/desktop/pair/admin/state');
  setResponse(el.pairingOutput, payload);

  const pending = payload.data?.data?.pendingRequests ?? [];
  const pairing = payload.data?.data?.pairing ?? {};
  renderPendingRequests(
    el,
    pending,
    async (pairingId) => {
      const result = await invokeAdmin(
        'POST',
        '/api/desktop/pair/admin/decision',
        { pairingId, approve: true },
      );
      setResponse(el.sessionOutput, result);
      await refreshPairingState(el);
    },
    async (pairingId) => {
      const result = await invokeAdmin(
        'POST',
        '/api/desktop/pair/admin/decision',
        { pairingId, approve: false },
      );
      setResponse(el.sessionOutput, result);
      await refreshPairingState(el);
    },
  );

  if (pairing.autoApprove) {
    activePairingRequest = null;
    hidePairingModal(el);
    return payload;
  }

  const nextPending = pending[0] ?? null;
  if (!nextPending) {
    activePairingRequest = null;
    dismissedPairingIds.clear();
    hidePairingModal(el);
    return payload;
  }

  activePairingRequest = nextPending;
  if (!dismissedPairingIds.has(nextPending.pairingId)) {
    showPairingModal(el, nextPending);
  }
  return payload;
}

function stopPairingPolling() {
  if (pairingPollTimer) {
    window.clearInterval(pairingPollTimer);
    pairingPollTimer = null;
  }
}

function startPairingPolling(el) {
  stopPairingPolling();
  pairingPollTimer = window.setInterval(async () => {
    try {
      await refreshPairingState(el);
    } catch (error) {
      setResponse(el.pairingOutput, `Pairing poll failed: ${error.message}`);
    }
  }, 2000);
}

async function handlePairingDecision(el, approve) {
  if (!activePairingRequest) {
    hidePairingModal(el);
    return;
  }

  const result = await invokeAdmin(
    'POST',
    '/api/desktop/pair/admin/decision',
    { pairingId: activePairingRequest.pairingId, approve },
  );
  setResponse(el.sessionOutput, result);
  activePairingRequest = null;
  hidePairingModal(el);
  dismissedPairingIds.clear();
  await refreshPairingState(el);
}

function wireEvents(el) {
  el.startButton.addEventListener('click', async () => {
    const payload = await window.metaAgentDesktop.start(currentConfig(el));
    renderState(el, payload);
    setResponse(el.healthOutput, payload);
    await refreshPairingState(el);
    startPairingPolling(el);
  });

  el.stopButton.addEventListener('click', async () => {
    const payload = await window.metaAgentDesktop.stop();
    stopPairingPolling();
    activePairingRequest = null;
    dismissedPairingIds.clear();
    hidePairingModal(el);
    renderState(el, payload);
    setResponse(el.healthOutput, payload);
  });

  el.healthButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'GET', '/api/desktop/health');
    setResponse(el.healthOutput, payload);
  });

  el.savePairingButton.addEventListener('click', async () => {
    const payload = await invokeAdmin(
      'POST',
      '/api/desktop/pair/admin/settings',
      {
        autoApprove: el.autoApproveInput.checked,
        password: el.pairPasswordInput.value,
      },
    );
    setResponse(el.pairingOutput, payload);
  });

  el.pairStateButton.addEventListener('click', async () => {
    await refreshPairingState(el);
  });

  el.pairingModalDismiss.addEventListener('click', () => {
    if (activePairingRequest) {
      dismissedPairingIds.add(activePairingRequest.pairingId);
    }
    hidePairingModal(el);
  });

  el.pairingModalApprove.addEventListener('click', async () => {
    await handlePairingDecision(el, true);
  });

  el.pairingModalReject.addEventListener('click', async () => {
    await handlePairingDecision(el, false);
  });

  el.openSessionButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'GET', '/api/desktop/session');
    setResponse(el.sessionOutput, payload);
  });

  el.heartbeatButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/session/heartbeat', {});
    setResponse(el.sessionOutput, payload);
  });

  el.closeSessionButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/session/close', {});
    setResponse(el.sessionOutput, payload);
  });

  el.eventsButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'GET', '/api/desktop/events?limit=12');
    setResponse(el.sessionOutput, payload);
    renderEvents(el, payload.data?.data?.events ?? []);
  });

  el.screenshotButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'GET', '/api/desktop/screenshot');
    setResponse(el.actionOutput, payload);
    renderScreenshot(el, payload);
  });

  el.moveButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/input/move', {
      x: Number(el.moveXInput.value),
      y: Number(el.moveYInput.value),
    });
    setResponse(el.actionOutput, payload);
  });

  el.clickButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/input/click', {
      x: Number(el.moveXInput.value),
      y: Number(el.moveYInput.value),
      button: 'left',
    });
    setResponse(el.actionOutput, payload);
  });

  el.typeButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/input/type', {
      text: el.typeInput.value,
    });
    setResponse(el.actionOutput, payload);
  });

  el.keyButton.addEventListener('click', async () => {
    const payload = await invokeApi(el, 'POST', '/api/desktop/input/key', {
      key: el.keyInput.value,
    });
    setResponse(el.actionOutput, payload);
  });

  el.openProjectButton.addEventListener('click', async () => {
    await window.metaAgentDesktop.openProject();
  });

  window.metaAgentDesktop.onState((payload) => {
    renderState(el, payload);
    if (!payload.running) {
      stopPairingPolling();
      activePairingRequest = null;
      dismissedPairingIds.clear();
      hidePairingModal(el);
    }
  });

  window.metaAgentDesktop.onLog((entry) => {
    renderLogEntry(el, entry);
  });

  el.navItems.forEach((item) => {
    item.addEventListener('click', () => setView(el, item.dataset.view));
  });
}

export async function bootstrap() {
  const el = createDom();
  wireEvents(el);

  const defaults = await window.metaAgentDesktop.getDefaults();
  el.hostInput.value = defaults.config.host;
  el.portInput.value = defaults.config.port;
  el.tokenInput.value = defaults.config.token ?? '';
  el.pairPasswordInput.value = defaults.config.pairPassword ?? '';
  el.autoApproveInput.checked = Boolean(defaults.config.autoApprove);

  const initialState = await window.metaAgentDesktop.getState();
  renderState(el, initialState);
  setView(el, 'overview');
  hidePairingModal(el);
  if (initialState.running) {
    await refreshPairingState(el);
    startPairingPolling(el);
  }
}
