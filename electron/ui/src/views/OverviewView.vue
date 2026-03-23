<template>
  <div class="view-grid">
    <PanelCard eyebrow="服务" title="MetaAgent-PC">
      <div class="hero-row">
        <div>
          <p class="lead">启动桌面服务、确认连接参数，并快速查看当前控制状态。</p>
          <div class="summary-pills">
            <span class="summary-pill">{{ endpointText }}</span>
            <span class="summary-pill">{{ summaryAuthText }}</span>
            <span class="summary-pill">{{ summaryModeText }}</span>
          </div>
        </div>
        <div class="button-row">
          <button class="primary-button" :disabled="busy.starting || runtime.running" @click="$emit('start')">启动服务</button>
          <button class="ghost-button" :disabled="busy.stopping || !runtime.running" @click="$emit('stop')">停止服务</button>
        </div>
      </div>
    </PanelCard>

    <div class="overview-columns">
      <PanelCard eyebrow="连接配置" title="桌面接口">
        <div class="form-grid">
          <label>
            <span>Host</span>
            <input :value="config.host" @input="$emit('update:config', 'host', $event.target.value)" />
          </label>
          <label>
            <span>Port</span>
            <input :value="config.port" @input="$emit('update:config', 'port', $event.target.value)" />
          </label>
          <label class="full">
            <span>Token</span>
            <input :value="config.token" @input="$emit('update:config', 'token', $event.target.value)" placeholder="可选 Bearer token" />
          </label>
        </div>
        <div class="button-row">
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('refresh-health')">检查状态</button>
        </div>
        <ResponseBlock :content="outputs.health" />
      </PanelCard>

      <PanelCard eyebrow="会话" title="桌面控制会话">
        <div class="button-row wrap">
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('open-session')">读取会话</button>
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('heartbeat')">发送心跳</button>
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('close-session')">关闭会话</button>
        </div>
        <ResponseBlock :content="outputs.session" />
      </PanelCard>
    </div>
  </div>
</template>

<script setup>
import PanelCard from '../components/PanelCard.vue';
import ResponseBlock from '../components/ResponseBlock.vue';

defineProps({
  config: Object,
  runtime: Object,
  outputs: Object,
  busy: Object,
  endpointText: String,
  summaryAuthText: String,
  summaryModeText: String,
});

defineEmits([
  'update:config',
  'start',
  'stop',
  'refresh-health',
  'open-session',
  'heartbeat',
  'close-session',
]);
</script>
