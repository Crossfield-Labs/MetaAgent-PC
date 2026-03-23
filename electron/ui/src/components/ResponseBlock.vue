<template>
  <pre class="response-block">{{ content }}</pre>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    default: '暂无输出',
  },
});
</script>
