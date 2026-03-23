<template>
  <aside class="app-sidebar">
    <div class="brand-block">
      <img :src="logoUrl" alt="MetaAgent logo" class="brand-block__logo" />
      <div>
        <h1>MetaAgent</h1>
        <p>PC 控制台</p>
      </div>
    </div>

    <section class="status-block">
      <span class="label">服务状态</span>
      <strong :class="['status-dot', running ? 'is-running' : 'is-idle']">
        {{ statusText }}
      </strong>
      <small>{{ endpointText }}</small>
    </section>

    <nav class="nav-group">
      <button
        v-for="item in items"
        :key="item.key"
        :class="['nav-button', { active: item.key === activeView, secondary: item.secondary }]"
        @click="$emit('select', item.key)"
      >
        <span class="nav-button__label">{{ item.label }}</span>
        <small class="nav-button__hint">{{ item.hint }}</small>
      </button>
    </nav>

    <button class="ghost-button wide" @click="$emit('open-project')">打开项目目录</button>
  </aside>
</template>

<script setup>
import logoUrl from '../../../renderer/assets/logo.png';

defineProps({
  activeView: String,
  running: Boolean,
  statusText: String,
  endpointText: String,
});

defineEmits(['select', 'open-project']);

const items = [
  { key: 'overview', label: '概览', hint: '启动、连接与状态' },
  { key: 'pairing', label: '授权', hint: '连接策略与待处理请求' },
  { key: 'agent', label: 'Agent', hint: '实时会话与配置' },
  { key: 'desktop', label: '桌面', hint: '输入调试与截图' },
  { key: 'diagnostics', label: '诊断', hint: '日志、事件与异常', secondary: true },
];
</script>
