<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
const props = defineProps<{ open: boolean; title: string; testid?: string }>();
const emit = defineEmits<{ (e: "close"): void }>();
import { onBeforeUnmount, watch } from "vue";
const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") emit("close"); };
watch(() => props.open, (o) => (o ? window.addEventListener("keydown", onKey) : window.removeEventListener("keydown", onKey)), { immediate: true });
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="props.open" class="fixed inset-0 z-40 flex flex-col justify-end" :data-testid="testid ?? 'action-sheet'" @click.self="emit('close')">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
        <div class="sheet-panel relative bg-gunmetal-800 border-t border-gunmetal-400 rounded-t-2xl px-4 pt-2 pb-4 max-h-[88vh] flex flex-col">
          <div class="w-10 h-1 rounded-full bg-gunmetal-400 mx-auto mb-3" />
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">{{ title }}</span>
            <button @click="emit('close')" class="text-[10px] uppercase tracking-[0.18em] text-fiatDim hover:text-bone" data-testid="sheet-close-btn">✕</button>
          </div>
          <div class="overflow-y-auto flex flex-col gap-3 pb-1">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
