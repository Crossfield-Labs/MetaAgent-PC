import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const DEFAULT_CONFIG = {
  host: '0.0.0.0',
  port: '3210',
  token: '',
  agentProvider: 'codex',
  agentExecutable: '',
  agentArgs: '',
  agentCwd: '',
  pairPassword: '',
  autoApprove: false,
};

function nowStamp() {
  return new Date().toLocaleString('zh-CN');
}

function jsonText(value, fallback = '暂无数据') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useDesktopConsole() {
  const activeView = ref('overview');
  const initialized = ref(false);
  const busy = reactive({
    starting: false,
    stopping: false,
    sendingAgent: false,
  });

  const config = reactive({ ...DEFAULT_CONFIG });
  const runtime = reactive({
    running: false,
    endpoint: 'http://0.0.0.0:3210',
    lastExit: null,
    packaged: false,
  });

  const outputs = reactive({
    health: '状态检查结果会显示在这里。',
    pairing: '授权设置结果会显示在这里。',
    session: '会话信息会显示在这里。',
    agent: 'Agent 状态会显示在这里。',
    video: '视频会话状态会显示在这里。',
    action: '动作结果会显示在这里。',
  });

  const agent = reactive({
    state: null,
    session: null,
    messages: [],
    logs: [],
    prompt: '',
  });

  const pairing = reactive({
    pendingRequests: [],
  });

  const desktop = reactive({
    moveX: '960',
    moveY: '540',
    typeText: 'MetaAgent',
    keyName: 'ENTER',
    screenshot: null,
    screenshotMeta: '还没有抓取到桌面截图',
    streamFormat: 'jpeg',
    streamQuality: '68',
    streamScale: '60',
    streamFps: '8',
  });

  const diagnostics = reactive({
    events: [],
    logs: [],
  });

  const video = reactive({
    session: null,
  });

  const stopFns = [];
  let pairingTimer = null;
  let videoTimer = null;
  let agentSource = null;
  let adminToken = '';

  const serviceStatusText = computed(() => (runtime.running ? '运行中' : '已停止'));
  const endpointText = computed(
    () => `${config.host || '0.0.0.0'}:${config.port || '3210'}`,
  );
  const summaryAuthText = computed(() =>
    config.pairPassword ? '已启用配对密码' : '未设置配对密码',
  );
  const summaryModeText = computed(() =>
    config.autoApprove ? '自动同意' : '手动确认',
  );
  const currentSessionSummary = computed(() => ({
    status: agent.state?.status ?? 'idle',
    sessionId: agent.session?.id ?? '-',
    pending: agent.state?.pendingMessageCount ?? 0,
  }));

  function setOutput(key, payload, fallback) {
    outputs[key] = jsonText(payload, fallback);
  }

  function currentConfig() {
    return {
      host: config.host.trim(),
      port: config.port.trim(),
      token: config.token.trim(),
      agentProvider: config.agentProvider,
      agentExecutable: config.agentExecutable.trim(),
      agentArgs: config.agentArgs.trim(),
      agentCwd: config.agentCwd.trim(),
      pairPassword: config.pairPassword,
      autoApprove: config.autoApprove,
    };
  }

  async function invokeApi(method, path, body) {
    return window.metaAgentDesktop.request({
      method,
      path,
      body,
      token: currentConfig().token,
    });
  }

  async function invokeAdmin(method, path, body) {
    return window.metaAgentDesktop.adminRequest({ method, path, body });
  }

  function stopPolling() {
    if (pairingTimer) {
      window.clearInterval(pairingTimer);
      pairingTimer = null;
    }
    if (videoTimer) {
      window.clearInterval(videoTimer);
      videoTimer = null;
    }
    if (agentSource) {
      agentSource.close();
      agentSource = null;
    }
  }

  function startPolling() {
    stopPolling();
    pairingTimer = window.setInterval(() => void refreshPairingState(), 2500);
    videoTimer = window.setInterval(() => void refreshVideoSession(), 2000);
    startAgentEventStream();
  }

  function applyRuntime(payload) {
    runtime.running = Boolean(payload?.running);
    runtime.endpoint = payload?.endpoint ?? `http://${endpointText.value}`;
    runtime.lastExit = payload?.lastExit ?? null;
    runtime.packaged = Boolean(payload?.packaged);
  }

  function applyDefaults(payload) {
    const next = payload?.config ?? {};
    adminToken = payload?.adminToken ?? '';
    Object.assign(config, {
      ...DEFAULT_CONFIG,
      ...next,
      autoApprove: Boolean(next.autoApprove),
    });
  }

  function applyAgentPayload(payload) {
    const data = payload?.data?.data ?? payload?.data ?? {};
    agent.state = data.state ?? payload?.state ?? null;
    agent.session = data.session ?? payload?.session ?? null;
    agent.messages = data.messages ?? payload?.messages ?? [];
    if (Array.isArray(data.logs)) {
      agent.logs = data.logs;
    }
  }

  function startAgentEventStream() {
    if (!runtime.running || !adminToken) return;
    if (agentSource) {
      agentSource.close();
    }

    const url = new URL(
      `http://127.0.0.1:${config.port || '3210'}/api/desktop/agent/events/stream`,
    );
    url.searchParams.set('adminToken', adminToken);
    agentSource = new EventSource(url.toString());

    const handleSnapshot = (event) => {
      try {
        const payload = JSON.parse(event.data);
        applyAgentPayload(payload);
        if (payload?.data?.logs) {
          agent.logs = payload.data.logs;
        }
      } catch {
        // ignore malformed events
      }
    };

    agentSource.addEventListener('agent-ready', handleSnapshot);
    agentSource.addEventListener('agent-snapshot', handleSnapshot);
    agentSource.onerror = () => {
      if (agentSource) {
        agentSource.close();
        agentSource = null;
      }
      if (runtime.running) {
        window.setTimeout(() => {
          if (!agentSource && runtime.running) {
            startAgentEventStream();
          }
        }, 1500);
      }
    };
  }

  async function refreshHealth() {
    const payload = await invokeApi('GET', '/api/desktop/health');
    setOutput('health', payload);
    if (payload?.ok) {
      const healthData = payload.data?.data ?? {};
      if (healthData.agent?.state) {
        agent.state = healthData.agent.state;
      }
    }
    return payload;
  }

  async function startService() {
    busy.starting = true;
    setOutput('health', `正在启动桌面服务... (${nowStamp()})`);
    try {
      const payload = await window.metaAgentDesktop.start(currentConfig());
      applyRuntime(payload);
      setOutput('health', payload);
      if (payload?.running) {
        await Promise.all([
          refreshPairingState(),
          refreshAgentSession(false),
          refreshVideoSession(),
          refreshEvents(),
        ]);
        startPolling();
      }
    } finally {
      busy.starting = false;
    }
  }

  async function stopService() {
    busy.stopping = true;
    try {
      const payload = await window.metaAgentDesktop.stop();
      applyRuntime(payload);
      stopPolling();
      pairing.pendingRequests = [];
      agent.messages = [];
      setOutput('health', payload);
    } finally {
      busy.stopping = false;
    }
  }

  async function savePairingSettings() {
    const payload = await invokeAdmin('POST', '/api/desktop/pair/admin/settings', {
      autoApprove: config.autoApprove,
      password: config.pairPassword,
    });
    setOutput('pairing', payload);
    return refreshPairingState();
  }

  async function refreshPairingState() {
    const payload = await invokeAdmin('GET', '/api/desktop/pair/admin/state');
    setOutput('pairing', payload);
    const data = payload?.data?.data ?? {};
    pairing.pendingRequests = data.pendingRequests ?? [];
    return payload;
  }

  async function decidePairing(pairingId, approve) {
    const payload = await invokeAdmin('POST', '/api/desktop/pair/admin/decision', {
      pairingId,
      approve,
    });
    setOutput('session', payload);
    await refreshPairingState();
  }

  async function openDesktopSession() {
    const payload = await invokeApi('GET', '/api/desktop/session');
    setOutput('session', payload);
    return payload;
  }

  async function heartbeatDesktopSession() {
    const payload = await invokeApi('POST', '/api/desktop/session/heartbeat', {});
    setOutput('session', payload);
    return payload;
  }

  async function closeDesktopSession() {
    const payload = await invokeApi('POST', '/api/desktop/session/close', {});
    setOutput('session', payload);
    return payload;
  }

  async function saveAgentSettings() {
    const payload = await invokeAdmin('POST', '/api/desktop/pair/admin/agent-settings', {
      provider: config.agentProvider,
      executable: config.agentExecutable,
      args: config.agentArgs,
      cwd: config.agentCwd,
    });
    setOutput('agent', payload);
    await refreshAgentSession(false);
  }

  async function refreshAgentSession(includeLogs = false) {
    const payload = await invokeApi('GET', '/api/desktop/agent/session?limit=80');
    setOutput('agent', payload);
    applyAgentPayload(payload);
    if (includeLogs) {
      const logsPayload = await invokeApi('GET', '/api/desktop/agent/logs?limit=80');
      if (logsPayload?.ok) {
        agent.logs = logsPayload.data?.data?.logs ?? [];
      }
    }
    return payload;
  }

  async function sendAgentMessage() {
    const message = agent.prompt.trim();
    if (!message) {
      setOutput('agent', '请输入要发送给 Agent 的消息。');
      return;
    }

    busy.sendingAgent = true;
    setOutput('agent', `正在发送消息给 Agent... (${nowStamp()})`);
    try {
      const payload = await invokeApi('POST', '/api/desktop/agent/message', {
        message,
        provider: config.agentProvider,
        cwd: config.agentCwd,
      });
      setOutput('agent', payload);
      if (payload?.ok) {
        agent.prompt = '';
        applyAgentPayload(payload);
        startPolling();
      }
      return payload;
    } finally {
      busy.sendingAgent = false;
    }
  }

  async function stopAgent() {
    const payload = await invokeApi('POST', '/api/desktop/agent/stop', {});
    setOutput('agent', payload);
    await refreshAgentSession(true);
  }

  async function resetAgent() {
    const payload = await invokeApi('POST', '/api/desktop/agent/reset', {});
    setOutput('agent', payload);
    applyAgentPayload(payload);
  }

  async function exportAgentSession() {
    const payload = await invokeApi('GET', '/api/desktop/agent/session?limit=120');
    if (payload?.ok) {
      downloadJson(
        `metaagent-agent-session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        payload.data?.data ?? {},
      );
      setOutput('agent', '已导出当前 Agent 会话。');
    } else {
      setOutput('agent', payload);
    }
  }

  async function openVideoSession() {
    const payload = await invokeApi('POST', '/api/desktop/video/session/open', {
      viewerName: 'MetaAgent desktop viewer',
      codec: 'h264',
      preferredWidth: 1280,
      preferredHeight: 720,
      preferredFps: 30,
    });
    setOutput('video', payload);
    if (payload?.ok) {
      await refreshVideoSession();
    }
  }

  async function refreshVideoSession() {
    const payload = await invokeApi('GET', '/api/desktop/video/session');
    setOutput('video', payload);
    video.session = payload?.data?.data ?? null;
    return payload;
  }

  async function closeVideoSession() {
    const payload = await invokeApi('POST', '/api/desktop/video/session/close', {});
    setOutput('video', payload);
    await refreshVideoSession();
  }

  async function takeScreenshot() {
    const query = new URLSearchParams({
      format: desktop.streamFormat,
      quality: desktop.streamQuality,
      scalePercent: desktop.streamScale,
    });
    const payload = await invokeApi('GET', `/api/desktop/screenshot?${query.toString()}`);
    setOutput('action', payload);
    const screenshot = payload?.data?.data ?? null;
    desktop.screenshot = screenshot;
    desktop.screenshotMeta = screenshot?.base64
      ? `${screenshot.width} × ${screenshot.height} · ${screenshot.mimeType}`
      : '还没有抓取到桌面截图';
  }

  async function moveMouse() {
    const payload = await invokeApi('POST', '/api/desktop/input/move', {
      x: Number(desktop.moveX),
      y: Number(desktop.moveY),
    });
    setOutput('action', payload);
  }

  async function clickMouse() {
    const payload = await invokeApi('POST', '/api/desktop/input/click', {
      x: Number(desktop.moveX),
      y: Number(desktop.moveY),
      button: 'left',
    });
    setOutput('action', payload);
  }

  async function typeText() {
    const payload = await invokeApi('POST', '/api/desktop/input/type', {
      text: desktop.typeText,
    });
    setOutput('action', payload);
  }

  async function pressKey() {
    const payload = await invokeApi('POST', '/api/desktop/input/key', {
      key: desktop.keyName,
    });
    setOutput('action', payload);
  }

  async function refreshEvents() {
    const payload = await invokeApi('GET', '/api/desktop/events?limit=24');
    const events = payload?.data?.data?.events ?? [];
    diagnostics.events = events.slice().reverse();
    return payload;
  }

  async function openProject() {
    await window.metaAgentDesktop.openProject();
  }

  onMounted(async () => {
    const defaults = await window.metaAgentDesktop.getDefaults();
    applyDefaults(defaults);

    const initialState = await window.metaAgentDesktop.getState();
    applyRuntime(initialState);
    initialized.value = true;

    stopFns.push(
      window.metaAgentDesktop.onState((payload) => {
        applyRuntime(payload);
        if (!payload.running) {
          stopPolling();
        }
      }),
    );
    stopFns.push(
      window.metaAgentDesktop.onLog((entry) => {
        diagnostics.logs.unshift(entry);
        if (diagnostics.logs.length > 120) diagnostics.logs.length = 120;
      }),
    );

    if (initialState.running) {
      await Promise.all([
        refreshHealth(),
        refreshPairingState(),
        refreshAgentSession(true),
        refreshVideoSession(),
        refreshEvents(),
      ]);
      startPolling();
    }
  });

  onBeforeUnmount(() => {
    stopPolling();
    stopFns.splice(0).forEach((stop) => stop?.());
  });

  return {
    activeView,
    initialized,
    busy,
    config,
    runtime,
    outputs,
    agent,
    pairing,
    desktop,
    diagnostics,
    video,
    serviceStatusText,
    endpointText,
    summaryAuthText,
    summaryModeText,
    currentSessionSummary,
    jsonText,
    startService,
    stopService,
    refreshHealth,
    savePairingSettings,
    refreshPairingState,
    decidePairing,
    openDesktopSession,
    heartbeatDesktopSession,
    closeDesktopSession,
    saveAgentSettings,
    refreshAgentSession,
    sendAgentMessage,
    stopAgent,
    resetAgent,
    exportAgentSession,
    openVideoSession,
    refreshVideoSession,
    closeVideoSession,
    takeScreenshot,
    moveMouse,
    clickMouse,
    typeText,
    pressKey,
    refreshEvents,
    openProject,
  };
}
