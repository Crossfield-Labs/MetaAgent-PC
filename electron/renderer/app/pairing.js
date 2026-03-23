import { invokeAdmin } from './api.js';
import { hidePairingModal, renderPendingRequests, setResponse, showPairingModal } from './render.js';

export function createPairingController(el) {
  let activePairingRequest = null;
  let dismissedPairingIds = new Set();

  async function refreshPairingState() {
    const payload = await invokeAdmin('GET', '/api/desktop/pair/admin/state');
    setResponse(el.pairingOutput, payload);

    if (payload?.status === 0) {
      activePairingRequest = null;
      dismissedPairingIds.clear();
      hidePairingModal(el);
      return payload;
    }

    const pending = payload.data?.data?.pendingRequests ?? [];
    const pairing = payload.data?.data?.pairing ?? {};
    renderPendingRequests(
      el,
      pending,
      async (pairingId) => {
        const result = await invokeAdmin('POST', '/api/desktop/pair/admin/decision', { pairingId, approve: true });
        setResponse(el.sessionOutput, result);
        await refreshPairingState();
      },
      async (pairingId) => {
        const result = await invokeAdmin('POST', '/api/desktop/pair/admin/decision', { pairingId, approve: false });
        setResponse(el.sessionOutput, result);
        await refreshPairingState();
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

  async function handlePairingDecision(approve) {
    if (!activePairingRequest) {
      hidePairingModal(el);
      return;
    }

    const result = await invokeAdmin('POST', '/api/desktop/pair/admin/decision', {
      pairingId: activePairingRequest.pairingId,
      approve,
    });
    setResponse(el.sessionOutput, result);
    activePairingRequest = null;
    hidePairingModal(el);
    dismissedPairingIds.clear();
    await refreshPairingState();
  }

  function dismissModal() {
    if (activePairingRequest) {
      dismissedPairingIds.add(activePairingRequest.pairingId);
    }
    hidePairingModal(el);
  }

  function reset() {
    activePairingRequest = null;
    dismissedPairingIds.clear();
    hidePairingModal(el);
  }

  return {
    refreshPairingState,
    handlePairingDecision,
    dismissModal,
    reset,
  };
}
