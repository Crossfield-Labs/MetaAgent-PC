<template>
  <div class="view-grid two-column">
    <PanelCard eyebrow="桌面交互" title="输入调试">
      <div class="form-grid inline-grid">
        <label>
          <span>X</span>
          <input :value="desktop.moveX" @input="$emit('update:desktop', 'moveX', $event.target.value)" />
        </label>
        <label>
          <span>Y</span>
          <input :value="desktop.moveY" @input="$emit('update:desktop', 'moveY', $event.target.value)" />
        </label>
      </div>
      <div class="button-row wrap">
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('move')">移动鼠标</button>
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('click')">左键点击</button>
        <button class="primary-button" :disabled="!runtime.running" @click="$emit('screenshot')">抓取截图</button>
      </div>

      <label class="stacked-field">
        <span>发送文本</span>
        <input :value="desktop.typeText" @input="$emit('update:desktop', 'typeText', $event.target.value)" />
      </label>
      <div class="button-row">
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('type')">发送文本</button>
      </div>

      <label class="stacked-field">
        <span>按键</span>
        <input :value="desktop.keyName" @input="$emit('update:desktop', 'keyName', $event.target.value)" />
      </label>
      <div class="button-row">
        <button class="ghost-button" :disabled="!runtime.running" @click="$emit('key')">发送按键</button>
      </div>

      <ResponseBlock :content="outputs.action" />
    </PanelCard>

    <div class="stack-column">
      <PanelCard eyebrow="截图" title="静态桌面预览">
        <div class="preview-frame clean">
          <img v-if="desktop.screenshot?.base64" :src="`data:${desktop.screenshot.mimeType};base64,${desktop.screenshot.base64}`" alt="桌面截图预览" />
          <div v-else class="empty-state">还没有桌面截图</div>
        </div>
        <p class="muted">{{ desktop.screenshotMeta }}</p>
      </PanelCard>

      <PanelCard eyebrow="视频会话" title="远程桌面">
        <div class="button-row wrap">
          <button class="primary-button" :disabled="!runtime.running" @click="$emit('open-video')">创建视频会话</button>
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('refresh-video')">刷新视频状态</button>
          <button class="ghost-button" :disabled="!runtime.running" @click="$emit('close-video')">关闭视频会话</button>
        </div>
        <ResponseBlock :content="outputs.video" />
      </PanelCard>
    </div>
  </div>
</template>

<script setup>
import PanelCard from '../components/PanelCard.vue';
import ResponseBlock from '../components/ResponseBlock.vue';

defineProps({
  runtime: Object,
  outputs: Object,
  desktop: Object,
});

defineEmits([
  'update:desktop',
  'move',
  'click',
  'screenshot',
  'type',
  'key',
  'open-video',
  'refresh-video',
  'close-video',
]);
</script>
