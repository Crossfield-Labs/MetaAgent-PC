<template>
  <div class="view-grid diagnostics-layout">
    <PanelCard eyebrow="最近事件" title="事件流" variant="subtle">
      <div v-if="!events.length" class="empty-state">当前还没有事件。</div>
      <div v-else class="diagnostic-list">
        <article v-for="(event, index) in events" :key="`${event.createdAt}-${index}`" class="diagnostic-item">
          <strong>{{ event.type }}</strong>
          <small>{{ event.createdAt }}</small>
          <pre>{{ jsonText(event.data ?? {}) }}</pre>
        </article>
      </div>
    </PanelCard>

    <PanelCard eyebrow="服务输出" title="日志" variant="subtle">
      <div v-if="!logs.length" class="empty-state">当前还没有日志输出。</div>
      <div v-else class="diagnostic-list">
        <article v-for="(entry, index) in logs" :key="`${entry.at}-${index}`" class="diagnostic-item">
          <strong>{{ entry.kind || entry.stream || 'log' }}</strong>
          <small>{{ entry.at }}</small>
          <pre>{{ entry.line || jsonText(entry) }}</pre>
        </article>
      </div>
    </PanelCard>
  </div>
</template>

<script setup>
import PanelCard from '../components/PanelCard.vue';

defineProps({
  events: {
    type: Array,
    default: () => [],
  },
  logs: {
    type: Array,
    default: () => [],
  },
  jsonText: Function,
});
</script>
