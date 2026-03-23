<template>
  <section class="panel-card" :class="variant ? `panel-card--${variant}` : ''">
    <header v-if="$slots.header || title || eyebrow" class="panel-card__header">
      <div>
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <h3 v-if="title">{{ title }}</h3>
      </div>
      <div v-if="$slots.actions" class="panel-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="panel-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  eyebrow: String,
  title: String,
  variant: String,
});
</script>
