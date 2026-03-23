import { currentConfig, invokeAdmin, invokeApi } from './api.js';
import { renderAgentSession, renderEvents, renderLogEntry, renderScreenshot, renderState, setResponse, setView } from './render.js';

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createDesktopActions(el, pairingController, pollingController) {
  function serviceUnavailablePayload(payload) {
    return payload && payload.status === 0;
  }

  function markServiceUnavailable(message, target = el.healthOutput) {
    pollingController.stopAll();
    pairingController.reset();
    renderState(el, {
      running: false,
      endpoint: `http://${currentConfig(el).host || '127.0.0.1'}:${currentConfig(el).port || '3210'}`,
      config: currentConfig(el),
      lastExit: null,
    });
    setResponse(target, message || '桌面服务未启动或连接失败');
  }

  async function requestApi(method, path, body, target) {
    const payload = await invokeApi(el, method, path, body);
    if (serviceUnavailablePayload(payload)) {
      markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', target);
      return payload;
    }
    if (target) {
      setResponse(target, payload);
    }
    return payload;
  }

  async function requestAdmin(method, path, body, target) {
    const payload = await invokeAdmin(method, path, body);
    if (serviceUnavailablePayload(payload)) {
      markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', target);
      return payload;
    }
    if (target) {
      setResponse(target, payload);
    }
    return payload;
  }

  async function refreshAgentState(includeLogs = false) {
    const statePayload = await requestApi('GET', '/api/desktop/agent/session?limit=80', undefined, el.agentOutput);
    if (serviceUnavailablePayload(statePayload)) return statePayload;
    renderAgentSession(el, statePayload);
    if (includeLogs) {
      await requestApi('GET', '/api/desktop/agent/logs?limit=80', undefined, el.agentOutput);
    }
    return statePayload;
  }

  async function refreshVideoState() {
    return requestApi('GET', '/api/desktop/video/session', undefined, el.videoOutput);
  }

  function startPollingLoops() {
    pollingController.startPairing(async () => {
      const payload = await pairingController.refreshPairingState();
      if (serviceUnavailablePayload(payload)) {
        markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', el.pairingOutput);
      }
    });

    pollingController.startAgent(async () => {
      const payload = await refreshAgentState(true);
      if (serviceUnavailablePayload(payload)) {
        markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', el.agentOutput);
      }
    });

    pollingController.startVideo(async () => {
      const payload = await refreshVideoState();
      if (serviceUnavailablePayload(payload)) {
        markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', el.videoOutput);
      }
    });
  }

  async function startService() {
    setResponse(el.healthOutput, '正在启动桌面服务...');
    el.startButton.disabled = true;
    try {
      const payload = await window.metaAgentDesktop.start(currentConfig(el));
      renderState(el, payload);
      setResponse(el.healthOutput, payload);
      await pairingController.refreshPairingState();
      await refreshAgentState(false);
      startPollingLoops();
    } catch (error) {
      setResponse(el.healthOutput, `Start failed: ${error?.message ?? String(error)}`);
      renderState(el, {
        running: false,
        endpoint: `http://${currentConfig(el).host || '127.0.0.1'}:${currentConfig(el).port || '3210'}`,
        config: currentConfig(el),
        lastExit: null,
      });
      el.startButton.disabled = false;
    }
  }

  async function stopService() {
    const payload = await window.metaAgentDesktop.stop();
    pollingController.stopAll();
    pairingController.reset();
    renderState(el, payload);
    renderAgentSession(el, null);
    setResponse(el.healthOutput, payload);
  }

  async function sendAgentMessage() {
    const message = el.agentPromptInput.value.trim();
    if (!message) {
      setResponse(el.agentOutput, '请输入要发送给 Agent 的消息。');
      el.agentPromptInput.focus();
      return;
    }

    el.runAgentButton.disabled = true;
    setResponse(el.agentOutput, '正在发送消息给 Agent...');

    try {
      const payload = await requestApi('POST', '/api/desktop/agent/message', {
        message,
        provider: el.agentProviderInput.value,
        cwd: el.agentCwdInput.value,
      }, el.agentOutput);
      if (!serviceUnavailablePayload(payload) && payload.ok) {
        el.agentPromptInput.value = '';
        renderAgentSession(el, payload);
        pollingController.startAgent(async () => {
          const nextPayload = await refreshAgentState(true);
          if (serviceUnavailablePayload(nextPayload)) {
            markServiceUnavailable(nextPayload.error || '桌面服务未启动或连接失败', el.agentOutput);
          }
        });
        return;
      }

      const errorMessage = payload?.data?.error || payload?.error || '发送失败';
      setResponse(el.agentOutput, `发送失败：${errorMessage}`);
    } catch (error) {
      setResponse(el.agentOutput, `发送失败：${error?.message ?? String(error)}`);
    } finally {
      el.runAgentButton.disabled = false;
    }
  }

  async function exportAgentSession() {
    const payload = await requestApi('GET', '/api/desktop/agent/session?limit=120', undefined, el.agentOutput);
    if (serviceUnavailablePayload(payload) || !payload?.ok) return;
    const data = payload.data?.data ?? {};
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(`metaagent-agent-session-${stamp}.json`, data);
    setResponse(el.agentOutput, '已导出当前 Agent 会话。');
    renderAgentSession(el, payload);
  }

  async function handleConversationAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = button.closest('.conversation-message');
    if (!item) return;

    const action = button.dataset.action;
    const text = item.dataset.messageText ?? '';
    if (action === 'copy') {
      const copied = await copyText(text);
      setResponse(el.agentOutput, copied ? '已复制这条消息。' : '复制失败。');
      return;
    }

    if (action === 'toggle') {
      const collapsed = item.classList.toggle('is-collapsed');
      button.textContent = collapsed ? '展开' : '收起';
    }
  }

  function bind() {
    el.startButton.addEventListener('click', startService);
    el.stopButton.addEventListener('click', stopService);
    el.healthButton.addEventListener('click', async () => {
      await requestApi('GET', '/api/desktop/health', undefined, el.healthOutput);
    });
    el.savePairingButton.addEventListener('click', async () => {
      await requestAdmin('POST', '/api/desktop/pair/admin/settings', {
        autoApprove: el.autoApproveInput.checked,
        password: el.pairPasswordInput.value,
      }, el.pairingOutput);
    });
    el.pairStateButton.addEventListener('click', async () => {
      const payload = await pairingController.refreshPairingState();
      if (serviceUnavailablePayload(payload)) {
        markServiceUnavailable(payload.error || '桌面服务未启动或连接失败', el.pairingOutput);
      }
    });
    el.pairingModalDismiss.addEventListener('click', pairingController.dismissModal);
    el.pairingModalApprove.addEventListener('click', async () => {
      await pairingController.handlePairingDecision(true);
    });
    el.pairingModalReject.addEventListener('click', async () => {
      await pairingController.handlePairingDecision(false);
    });
    el.openSessionButton.addEventListener('click', async () => {
      await requestApi('GET', '/api/desktop/session', undefined, el.sessionOutput);
    });
    el.heartbeatButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/session/heartbeat', {}, el.sessionOutput);
    });
    el.closeSessionButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/session/close', {}, el.sessionOutput);
    });
    el.eventsButton.addEventListener('click', async () => {
      const payload = await requestApi('GET', '/api/desktop/events?limit=12', undefined, el.sessionOutput);
      if (!serviceUnavailablePayload(payload)) {
        renderEvents(el, payload.data?.data?.events ?? []);
      }
    });
    el.screenshotButton.addEventListener('click', async () => {
      const query = new URLSearchParams({
        format: el.streamFormatInput.value,
        quality: el.streamQualityInput.value,
        scalePercent: el.streamScaleInput.value,
      });
      const payload = await requestApi('GET', `/api/desktop/screenshot?${query.toString()}`, undefined, el.actionOutput);
      if (!serviceUnavailablePayload(payload)) {
        renderScreenshot(el, payload);
      }
    });
    el.moveButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/input/move', {
        x: Number(el.moveXInput.value),
        y: Number(el.moveYInput.value),
      }, el.actionOutput);
    });
    el.clickButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/input/click', {
        x: Number(el.moveXInput.value),
        y: Number(el.moveYInput.value),
        button: 'left',
      }, el.actionOutput);
    });
    el.typeButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/input/type', {
        text: el.typeInput.value,
      }, el.actionOutput);
    });
    el.keyButton.addEventListener('click', async () => {
      await requestApi('POST', '/api/desktop/input/key', {
        key: el.keyInput.value,
      }, el.actionOutput);
    });
    el.saveAgentButton.addEventListener('click', async () => {
      await requestAdmin('POST', '/api/desktop/pair/admin/agent-settings', {
        provider: el.agentProviderInput.value,
        executable: el.agentExecutableInput.value,
        args: el.agentArgsInput.value,
        cwd: el.agentCwdInput.value,
      }, el.agentOutput);
      await refreshAgentState(false);
    });
    el.runAgentButton.addEventListener('click', sendAgentMessage);
    el.agentPromptInput.addEventListener('keydown', async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        await sendAgentMessage();
      }
    });
    el.refreshAgentButton.addEventListener('click', async () => {
      await refreshAgentState(true);
    });
    el.stopAgentButton.addEventListener('click', async () => {
      const payload = await requestApi('POST', '/api/desktop/agent/stop', {}, el.agentOutput);
      if (!serviceUnavailablePayload(payload)) {
        await refreshAgentState(true);
      }
    });
    el.resetAgentButton.addEventListener('click', async () => {
      const payload = await requestApi('POST', '/api/desktop/agent/reset', {}, el.agentOutput);
      if (!serviceUnavailablePayload(payload)) {
        renderAgentSession(el, payload);
      }
    });
    el.agentLogsButton.addEventListener('click', async () => {
      await requestApi('GET', '/api/desktop/agent/logs?limit=80', undefined, el.agentOutput);
    });
    el.exportAgentButton.addEventListener('click', exportAgentSession);
    el.agentMessagesList.addEventListener('click', handleConversationAction);
    el.openVideoButton.addEventListener('click', async () => {
      const payload = await requestApi('POST', '/api/desktop/video/session/open', {
        viewerName: 'MetaAgent desktop viewer',
        codec: 'h264',
        preferredWidth: 1280,
        preferredHeight: 720,
        preferredFps: 30,
      }, el.videoOutput);
      if (!serviceUnavailablePayload(payload)) {
        pollingController.startVideo(async () => {
          const nextPayload = await refreshVideoState();
          if (serviceUnavailablePayload(nextPayload)) {
            markServiceUnavailable(nextPayload.error || '桌面服务未启动或连接失败', el.videoOutput);
          }
        });
      }
    });
    el.refreshVideoButton.addEventListener('click', async () => {
      await refreshVideoState();
    });
    el.closeVideoButton.addEventListener('click', async () => {
      const payload = await requestApi('POST', '/api/desktop/video/session/close', {}, el.videoOutput);
      if (!serviceUnavailablePayload(payload)) {
        await refreshVideoState();
      }
    });
    el.openProjectButton.addEventListener('click', async () => {
      await window.metaAgentDesktop.openProject();
    });
    window.metaAgentDesktop.onState((payload) => {
      renderState(el, payload);
      if (!payload.running) {
        pollingController.stopAll();
        pairingController.reset();
      }
    });
    window.metaAgentDesktop.onLog((entry) => {
      renderLogEntry(el, entry);
    });
    el.navItems.forEach((item) => {
      item.addEventListener('click', () => setView(el, item.dataset.view));
    });
  }

  return {
    bind,
    startPollingLoops,
    refreshAgentState,
  };
}
