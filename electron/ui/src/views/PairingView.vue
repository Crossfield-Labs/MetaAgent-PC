<template>
  <div class="view-grid two-column">
    <PanelCard eyebrow="连接策略" title="授权设置">
      <div class="form-grid">
        <label>
          <span>配对密码</span>
          <input :value="config.pairPassword" @input="$emit('update:config', 'pairPassword', $event.target.value)" />
        </label>
        <label class="checkbox-row">
          <span>自动同意连接</span>
          <input type="checkbox" :checked="config.autoApprove" @change="$emit('update:config', 'autoApprove', $event.target.checked)" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" :disabled="!runtime.running" @click="$emit('save')">保存授权设置</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('refresh')">刷新请求</button>
      </div>
      <ResponseBlock :content="outputs.pairing" />
    </PanelCard>

    <PanelCard eyebrow="待处理请求" title="手机连接申请">
      <div v-if="!pendingRequests.length" class="empty-state">当前没有待处理的连接请求。</div>
      <div v-else class="request-list">
        <article v-for="request in pendingRequests" :key="request.pairingId" class="request-item">
          <div>
            <strong>{{ request.deviceName }}</strong>
            <small>{{ request.requestedAt }}</small>
          </div>
          <div class="button-row">
            <button class="ghost-button small" @click="$emit('reject', request.pairingId)">拒绝</button>
            <button class="primary-button small" @click="$emit('approve', request.pairingId)">允许</button>
          </div>
        </article>
      </div>
    </PanelCard>
  </div>
</template>

<script setup>
import PanelCard from '../components/PanelCard.vue';
import ResponseBlock from '../components/ResponseBlock.vue';

defineProps({
  config: Object,
  runtime: Object,
  outputs: Object,
  pendingRequests: Array,
});

defineEmits(['update:config', 'save', 'refresh', 'approve', 'reject']);
</script>
