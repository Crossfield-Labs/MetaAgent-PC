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
