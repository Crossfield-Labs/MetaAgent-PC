import { currentConfig } from './api.js';
import { viewMeta } from './dom.js';

const COLLAPSE_LINE_LIMIT = 12;
const COLLAPSE_CHAR_LIMIT = 900;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMessageBody(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

function shouldCollapseMessage(text) {
  const normalized = String(text ?? '');
  const lineCount = normalized.split(/\r?\n/).length;
  return normalized.length > COLLAPSE_CHAR_LIMIT || lineCount > COLLAPSE_LINE_LIMIT;
}

export function setResponse(target, payload) {
  target.textContent =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

export function setView(el, nextView) {
  el.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === nextView);
  });
  el.views.forEach((view) => {
    view.classList.toggle('active', view.dataset.view === nextView);
  });

  const meta = viewMeta[nextView];
  if (meta) {
    el.pageTitle.textContent = meta.title;
    el.pageDescription.textContent = meta.description;
  }
}

export function appendListItem(container, title, meta, body, limit = 10) {
  if (container.classList.contains('empty')) {
    container.classList.remove('empty');
    container.innerHTML = '';
  }

  const item = document.createElement('div');
  item.className = 'list-item';
  item.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(meta)}</small>
    <div>${formatMessageBody(body)}</div>
  `;
  container.prepend(item);

  while (container.children.length > limit) {
    container.removeChild(container.lastChild);
  }
}

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

export function renderEvents(el, events) {
  if (!events?.length) {
    el.eventsList.className = 'list-panel empty';
    el.eventsList.textContent = '当前还没有事件。';
    return;
  }

  el.eventsList.className = 'list-panel';
  el.eventsList.innerHTML = '';
  events
    .slice()
    .reverse()
    .forEach((event) => {
      appendListItem(
        el.eventsList,
        event.type,
        event.createdAt,
        JSON.stringify(event.data ?? {}, null, 2),
        events.length,
      );
    });
}

export function renderScreenshot(el, response) {
  const screenshot = response?.data?.data;
  if (!response?.ok || !screenshot?.base64) {
    el.screenshotImage.classList.remove('visible');
    el.screenshotImage.removeAttribute('src');
    el.screenshotMeta.textContent = '还没有抓取到桌面截图';
    return;
  }

  el.screenshotImage.src = `data:${screenshot.mimeType};base64,${screenshot.base64}`;
  el.screenshotImage.classList.add('visible');
  el.screenshotMeta.textContent = `${screenshot.width} x ${screenshot.height} · ${screenshot.mimeType}`;
}

export function renderLogEntry(el, entry) {
  appendListItem(el.logsList, entry.kind.toUpperCase(), entry.at, entry.line);
}

export function renderPendingRequests(el, pendingRequests, onApprove, onReject) {
  if (!pendingRequests.length) {
    el.pairRequestsList.className = 'list-panel empty';
    el.pairRequestsList.textContent = '当前没有待处理的连接请求。';
    return;
  }

  el.pairRequestsList.className = 'list-panel';
  el.pairRequestsList.innerHTML = '';

  pendingRequests.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'list-item pairing-request';
    item.innerHTML = `
      <strong>${escapeHtml(request.deviceName)}</strong>
      <small>${escapeHtml(request.requestedAt)}</small>
      <div>配对 ID：${escapeHtml(request.pairingId)}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'button-row';
    actions.style.marginTop = '10px';

    const approve = document.createElement('button');
    approve.className = 'primary-button subtle';
    approve.textContent = '允许';
    approve.addEventListener('click', () => onApprove(request.pairingId));

    const reject = document.createElement('button');
    reject.className = 'ghost-button';
    reject.textContent = '拒绝';
    reject.addEventListener('click', () => onReject(request.pairingId));

    actions.append(approve, reject);
    item.append(actions);
    el.pairRequestsList.append(item);
  });
}

export function renderAgentSession(el, payload) {
  const session = payload?.data?.data?.session ?? payload?.session ?? null;
  const state = payload?.data?.data?.state ?? payload?.state ?? null;
  const messages = payload?.data?.data?.messages ?? payload?.messages ?? [];
  const pendingCount = state?.pendingMessageCount ?? session?.pendingMessageCount ?? 0;
  const sessionActive = Boolean(session?.id);

  el.agentStatusText.textContent = state?.status ?? 'idle';
  el.agentSessionIdText.textContent = session?.id ?? '-';
  el.agentPendingText.textContent = String(pendingCount);
  el.agentSessionHint.textContent = sessionActive
    ? pendingCount > 0
      ? `当前会话正在处理 ${pendingCount} 条待办消息。`
      : '当前会话可继续追问，新的消息会顺序加入队列。'
    : '还没有活动会话。发送第一条消息后会自动创建会话。';

  if (!messages.length) {
    el.agentMessagesList.className = 'conversation-panel empty';
    el.agentMessagesList.textContent = '当前还没有会话消息。';
    return;
  }

  const shouldStickToBottom =
    el.agentMessagesList.classList.contains('empty') ||
    el.agentMessagesList.scrollHeight - el.agentMessagesList.scrollTop - el.agentMessagesList.clientHeight < 48;

  el.agentMessagesList.className = 'conversation-panel';
  el.agentMessagesList.innerHTML = '';

  messages.forEach((message, index) => {
    const role = message.role ?? 'assistant';
    const text = String(message.text ?? '');
    const isCollapsed = shouldCollapseMessage(text);
    const item = document.createElement('article');
    item.className = `conversation-message role-${role} state-${message.state ?? 'completed'}${isCollapsed ? ' is-collapsed' : ''}`;
    item.dataset.messageIndex = String(index);
    item.dataset.messageText = text;

    const actions = isCollapsed
      ? '<button class="ghost-button small conversation-action" data-action="toggle">展开</button>'
      : '';

    item.innerHTML = `
      <div class="conversation-meta">
        <span class="conversation-role">${escapeHtml(role)}</span>
        <span class="conversation-state">${escapeHtml(message.state ?? 'completed')}</span>
        <time class="conversation-time">${escapeHtml(message.at ?? '-')}</time>
      </div>
      <div class="conversation-body">${formatMessageBody(text)}</div>
      <div class="conversation-actions">
        ${actions}
        <button class="ghost-button small conversation-action" data-action="copy">复制</button>
      </div>
    `;
    el.agentMessagesList.append(item);
  });

  if (shouldStickToBottom) {
    el.agentMessagesList.scrollTop = el.agentMessagesList.scrollHeight;
  }
}

export function showPairingModal(el, request) {
  el.pairingModal.classList.remove('hidden');
  el.pairingModalBody.textContent =
    `${request.deviceName} 请求连接这台电脑。请求时间：${request.requestedAt}`;
}

export function hidePairingModal(el) {
  el.pairingModal.classList.add('hidden');
  el.pairingModalBody.textContent = '当前没有待处理的连接请求。';
}
