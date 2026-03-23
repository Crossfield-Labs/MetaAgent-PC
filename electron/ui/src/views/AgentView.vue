<template>
  <div class="view-grid agent-layout">
    <PanelCard eyebrow="Agent 会话" title="实时交互">
      <div class="summary-pills">
        <span class="summary-pill">状态：{{ sessionSummary.status }}</span>
        <span class="summary-pill">待处理：{{ sessionSummary.pending }}</span>
        <span class="summary-pill">会话：{{ sessionSummary.sessionId }}</span>
      </div>
      <p class="muted">{{ hintText }}</p>
      <AgentConversation :messages="agent.messages" :live-activity="liveActivity" />
      <label class="stacked-field">
        <span>发送给 Agent</span>
        <textarea :value="agent.prompt" rows="4" @input="$emit('update:prompt', $event.target.value)" />
      </label>
      <div class="button-row wrap">
        <button class="primary-button" :disabled="busy.sendingAgent || !runtime.running" @click="$emit('send')">发送并运行</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('refresh-session')">刷新会话</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('stop-agent')">停止当前回合</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('reset-agent')">重置会话</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('export-agent')">导出会话</button>
      </div>
      <ResponseBlock :content="outputs.agent" />
    </PanelCard>

    <div class="stack-column">
      <PanelCard eyebrow="Agent 配置" title="Provider 与执行参数">
        <div class="form-grid">
          <label>
            <span>AI Provider</span>
            <select :value="config.agentProvider" @change="$emit('update:config', 'agentProvider', $event.target.value)">
              <option value="codex">Codex</option>
              <option value="claude">Claude Code</option>
            </select>
          </label>
          <label class="full">
            <span>AI Executable</span>
            <input :value="config.agentExecutable" @input="$emit('update:config', 'agentExecutable', $event.target.value)" placeholder="默认留空" />
          </label>
          <label class="full">
            <span>AI Args</span>
            <input :value="config.agentArgs" @input="$emit('update:config', 'agentArgs', $event.target.value)" placeholder="留空使用内置默认参数" />
          </label>
          <label class="full">
            <span>AI CWD</span>
            <input :value="config.agentCwd" @input="$emit('update:config', 'agentCwd', $event.target.value)" placeholder="D:\\workspaces\\project" />
          </label>
        </div>
        <div class="button-row">
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('save-settings')">保存 Agent 配置</button>
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('show-logs')">查看日志</button>
        </div>
      </PanelCard>

      <PanelCard eyebrow="说明" title="使用建议" variant="subtle">
        <ul class="tip-list">
          <li>任务描述尽量具体，避免只有一句模糊短语。</li>
          <li>工作目录建议指向目标项目根目录。</li>
          <li>需要追问时直接继续发新消息，不用重开会话。</li>
        </ul>
      </PanelCard>

      <PanelCard eyebrow="实时活动" title="当前执行过程" variant="subtle">
        <div v-if="!agent.logs?.length" class="empty-state compact-empty">当前还没有活动日志。</div>
        <div v-else class="diagnostic-list compact-list">
          <article
            v-for="(entry, index) in agent.logs.slice(-10).reverse()"
            :key="`${entry.at}-${index}`"
            class="diagnostic-item"
          >
            <strong>{{ entry.stream }}</strong>
            <small>{{ entry.at }}</small>
            <pre>{{ entry.line }}</pre>
          </article>
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AgentConversation from '../components/AgentConversation.vue';
import PanelCard from '../components/PanelCard.vue';
import ResponseBlock from '../components/ResponseBlock.vue';

const props = defineProps({
  config: Object,
  runtime: Object,
  outputs: Object,
  agent: Object,
  busy: Object,
  sessionSummary: Object,
  hintText: String,
});

const liveActivity = computed(() => {
  if (props.agent?.state?.status !== 'running') {
    return '';
  }

  const recentLogs = Array.isArray(props.agent?.logs)
    ? props.agent.logs.slice(-6)
    : [];
  const lines = recentLogs
    .map((entry) => {
      const stream = entry?.stream ? `[${entry.stream}] ` : '';
      return `${stream}${entry?.line ?? ''}`.trim();
    })
    .filter(Boolean);

  if (!lines.length) {
    const fallback = props.agent?.state?.lastOutput?.trim();
    if (fallback) {
      lines.push(fallback);
    }
  }

  return lines.join('\n');
});

defineEmits([
  'update:config',
  'update:prompt',
  'send',
  'refresh-session',
  'stop-agent',
  'reset-agent',
  'export-agent',
  'save-settings',
  'show-logs',
]);
</script>
