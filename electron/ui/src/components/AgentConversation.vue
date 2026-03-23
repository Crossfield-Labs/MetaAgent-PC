<template>
  <div class="conversation-shell">
    <div v-if="!messages.length" class="conversation-empty">当前还没有会话消息。</div>
    <article
      v-for="message in messages"
      :key="message.id"
      :class="[
        'conversation-item',
        `role-${message.role ?? 'assistant'}`,
        `state-${message.state ?? 'completed'}`,
      ]"
    >
      <div class="conversation-item__meta">
        <span class="pill">{{ message.role ?? 'assistant' }}</span>
        <span class="pill subtle">{{ message.state ?? 'completed' }}</span>
        <span class="conversation-item__time">{{ message.at }}</span>
      </div>
      <div class="conversation-item__body">{{ message.text }}</div>
    </article>
    <article
      v-if="liveActivity"
      class="conversation-item role-assistant state-processing"
    >
      <div class="conversation-item__meta">
        <span class="pill">assistant</span>
        <span class="pill subtle">streaming</span>
        <span class="conversation-item__time">进行中</span>
      </div>
      <div class="conversation-item__body">
        <pre>{{ liveActivity }}</pre>
      </div>
    </article>
  </div>
</template>

<script setup>
defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  liveActivity: {
    type: String,
    default: '',
  },
});
</script>
