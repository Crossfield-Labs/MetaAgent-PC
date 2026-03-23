export function createPollingController() {
  let pairingPollTimer = null;
  let agentPollTimer = null;
  let videoPollTimer = null;

  return {
    startPairing(task, intervalMs = 2000) {
      this.stopPairing();
      pairingPollTimer = window.setInterval(task, intervalMs);
    },
    stopPairing() {
      if (pairingPollTimer) {
        window.clearInterval(pairingPollTimer);
        pairingPollTimer = null;
      }
    },
    startAgent(task, intervalMs = 2500) {
      this.stopAgent();
      agentPollTimer = window.setInterval(task, intervalMs);
    },
    stopAgent() {
      if (agentPollTimer) {
        window.clearInterval(agentPollTimer);
        agentPollTimer = null;
      }
    },
    startVideo(task, intervalMs = 2500) {
      this.stopVideo();
      videoPollTimer = window.setInterval(task, intervalMs);
    },
    stopVideo() {
      if (videoPollTimer) {
        window.clearInterval(videoPollTimer);
        videoPollTimer = null;
      }
    },
    stopAll() {
      this.stopPairing();
      this.stopAgent();
      this.stopVideo();
    },
  };
}
