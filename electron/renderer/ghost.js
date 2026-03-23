const providerEl = document.querySelector('#ghostProvider');
const titleEl = document.querySelector('#ghostTitle');
const promptEl = document.querySelector('#ghostPrompt');
const metaEl = document.querySelector('#ghostMeta');
const closeEl = document.querySelector('#ghostClose');

window.metaAgentDesktop.onGhostState((state) => {
  providerEl.textContent = (state.provider || 'codex').toUpperCase();
  titleEl.textContent = 'AI 正在工作';
  promptEl.textContent = state.prompt || '正在处理任务';

  const startedAt = state.startedAt
    ? new Date(state.startedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '刚刚';
  metaEl.textContent = `${state.status} · ${startedAt}`;
});

closeEl?.addEventListener('click', () => {
  window.metaAgentDesktop.hideGhost();
});
