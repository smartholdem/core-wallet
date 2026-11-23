<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";

const props = withDefaults(defineProps<{ src?: string | null; symbol: string; size?: number }>(), { size: 40 });
const broken = ref(false);
watch(() => props.src, () => (broken.value = false));
const initials = computed(() => (props.symbol || "?").slice(0, 2).toUpperCase());
</script>

<template>
  <div
    class="shrink-0 rounded-lg grid place-items-center overflow-hidden border border-gunmetal-400 bg-gunmetal-700 text-cyan-voltGlow font-bold mono"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.34) + 'px' }"
    data-testid="token-logo"
  >
    <img v-if="src && !broken" :src="src" :alt="symbol" class="w-full h-full object-contain" @error="broken = true" />
    <span v-else>{{ initials }}</span>
  </div>
</template>
