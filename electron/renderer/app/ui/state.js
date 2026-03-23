import { currentConfig } from '../api.js';

function refreshSummary(el, config) {
  const host = config.host || '0.0.0.0';
  const port = config.port || '3210';
  el.hostPill.textContent = host;
  el.portPill.textContent = port;
  el.summaryEndpoint.textContent = `${host}:${port}`;
  el.summaryAuth.textContent = config.pairPassword ? '已启用配对密码' : '未设置配对密码';
  el.summaryMode.textContent = config.autoApprove ? '自动同意' : '手动确认';
}

export function renderState(el, payload) {
  const config = payload.config ?? currentConfig(el);

  el.serviceStatus.textContent = payload.running ? '运行中' : '已停止';
  el.serviceStatus.className = `status-badge ${payload.running ? 'running' : 'idle'}`;
  el.endpointText.textContent = `端点：${payload.endpoint}`;
  el.lastExitText.textContent = payload.lastExit
    ? `退出码 ${payload.lastExit.code ?? '未知'}，时间 ${payload.lastExit.at}`
    : '暂无退出记录';

  refreshSummary(el, config);

  const controlsDisabled = !payload.running;
  [
    el.stopButton,
    el.healthButton,
    el.savePairingButton,
    el.pairStateButton,
    el.openSessionButton,
    el.heartbeatButton,
    el.closeSessionButton,
    el.screenshotButton,
    el.moveButton,
    el.clickButton,
    el.typeButton,
    el.keyButton,
    el.saveAgentButton,
    el.runAgentButton,
    el.refreshAgentButton,
    el.stopAgentButton,
    el.resetAgentButton,
    el.agentLogsButton,
    el.exportAgentButton,
    el.openVideoButton,
    el.refreshVideoButton,
    el.closeVideoButton,
    el.eventsButton,
  ].forEach((button) => {
    button.disabled = controlsDisabled;
  });

  el.startButton.disabled = payload.running;
}
