<template>
  <div class="app-shell" v-if="initialized">
    <AppSidebar
      :active-view="activeView"
      :running="runtime.running"
      :status-text="serviceStatusText"
      :endpoint-text="endpointText"
      @select="activeView = $event"
      @open-project="openProject"
    />

    <main class="app-content">
      <header class="page-header">
        <div>
          <span class="eyebrow">控制台</span>
          <h2>{{ currentMeta.title }}</h2>
          <p class="muted">{{ currentMeta.description }}</p>
        </div>
      </header>

      <OverviewView
        v-if="activeView === 'overview'"
        :config="config"
        :runtime="runtime"
        :outputs="outputs"
        :busy="busy"
        :endpoint-text="endpointText"
        :summary-auth-text="summaryAuthText"
        :summary-mode-text="summaryModeText"
        @update:config="updateConfig"
        @start="startService"
        @stop="stopService"
        @refresh-health="refreshHealth"
        @open-session="openDesktopSession"
        @heartbeat="heartbeatDesktopSession"
        @close-session="closeDesktopSession"
      />

      <PairingView
        v-else-if="activeView === 'pairing'"
        :config="config"
        :runtime="runtime"
        :outputs="outputs"
        :pending-requests="pairing.pendingRequests"
        @update:config="updateConfig"
        @save="savePairingSettings"
        @refresh="refreshPairingState"
        @approve="decidePairing($event, true)"
        @reject="decidePairing($event, false)"
      />

      <AgentView
        v-else-if="activeView === 'agent'"
        :config="config"
        :runtime="runtime"
        :outputs="outputs"
        :agent="agent"
        :busy="busy"
        :session-summary="currentSessionSummary"
        :hint-text="agentHintText"
        @update:config="updateConfig"
        @update:prompt="agent.prompt = $event"
        @send="sendAgentMessage"
        @refresh-session="refreshAgentSession(true)"
        @stop-agent="stopAgent"
        @reset-agent="resetAgent"
        @export-agent="exportAgentSession"
        @save-settings="saveAgentSettings"
        @show-logs="refreshAgentSession(true)"
      />

      <DesktopView
        v-else-if="activeView === 'desktop'"
        :runtime="runtime"
        :outputs="outputs"
        :desktop="desktop"
        @update:desktop="updateDesktop"
        @move="moveMouse"
        @click="clickMouse"
        @screenshot="takeScreenshot"
        @type="typeText"
        @key="pressKey"
        @open-video="openVideoSession"
        @refresh-video="refreshVideoSession"
        @close-video="closeVideoSession"
      />

      <DiagnosticsView
        v-else
        :events="diagnostics.events"
        :logs="diagnostics.logs"
        :json-text="jsonText"
      />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import AgentView from './views/AgentView.vue';
import DesktopView from './views/DesktopView.vue';
import DiagnosticsView from './views/DiagnosticsView.vue';
import OverviewView from './views/OverviewView.vue';
import PairingView from './views/PairingView.vue';
import { useDesktopConsole } from './composables/useDesktopConsole.js';

const views = {
  overview: {
    title: '概览',
    description: '服务启动、连接配置和当前控制状态。',
  },
  pairing: {
    title: '授权',
    description: '管理手机接入策略和待处理连接申请。',
  },
  agent: {
    title: 'Agent',
    description: '实时交互、追问和 AI 执行配置。',
  },
  desktop: {
    title: '桌面',
    description: '桌面截图、输入调试和远程桌面会话。',
  },
  diagnostics: {
    title: '诊断',
    description: '只在需要排障时查看事件和日志。',
  },
};

const {
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
  openProject,
} = useDesktopConsole();

const currentMeta = computed(() => views[activeView.value] ?? views.overview);
const agentHintText = computed(() => {
  const pending = currentSessionSummary.value.pending;
  if (!currentSessionSummary.value.sessionId || currentSessionSummary.value.sessionId === '-') {
    return '还没有活动会话。发送第一条消息后会自动创建会话。';
  }
  if (pending > 0) {
    return `当前会话正在处理 ${pending} 条待办消息。`;
  }
  return '当前会话可继续追问，新的消息会顺序加入队列。';
});

function updateConfig(key, value) {
  config[key] = value;
}

function updateDesktop(key, value) {
  desktop[key] = value;
}
</script>
