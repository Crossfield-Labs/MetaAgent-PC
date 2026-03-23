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

export function hidePairingModal(el) {
  el.pairingModal.classList.add('hidden');
  el.pairingModalBody.textContent = '当前没有待处理的连接请求。';
}

export function showPairingModal(el, request) {
  el.pairingModal.classList.remove('hidden');
  el.pairingModalBody.textContent =
    `${request.deviceName} 请求连接这台电脑。请求时间：${request.requestedAt}`;
}
