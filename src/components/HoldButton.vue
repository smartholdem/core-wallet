<script setup lang="ts">
/* oxlint-disable no-undef -- defineProps/defineEmits/withDefaults are Vue compiler macros */
import { ref, computed } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    holdMs?: number;
    disabled?: boolean;
    variant?: "indigo" | "rust";
    testid?: string;
  }>(),
  { holdMs: 900, variant: "indigo" }
);

const emit = defineEmits<{
  (e: "fired"): void;
}>();

const progress = ref(0);
let raf = 0;
let startAt = 0;
const holding = ref(false);

function start() {
  if (props.disabled) return;
  holding.value = true;
  startAt = performance.now();
  const tick = (t: number) => {
    progress.value = Math.min(1, (t - startAt) / props.holdMs);
    if (progress.value >= 1) {
      stop(true);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function stop(fire = false) {
  cancelAnimationFrame(raf);
  holding.value = false;
  if (fire) {
    emit("fired");
  }
  progress.value = 0;
}

const fillColor = computed(() =>
  props.variant === "rust" ? "#E25822" : "#4F46E5"
);
const glowClass = computed(() =>
  props.variant === "rust" ? "shadow-glowRust" : "shadow-glowIndigo"
);
const borderClass = computed(() =>
  props.variant === "rust"
    ? "border-rust/60 text-rust"
    : "border-indigo-forge/60 text-indigo-forgeBright"
);
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :data-testid="testid ?? 'hold-button'"
    @mousedown="start"
    @mouseup="stop()"
    @mouseleave="stop()"
    @touchstart.prevent="start"
    @touchend="stop()"
    :class="[
      'relative w-full h-14 rounded-md border-2 select-none overflow-hidden',
      'font-semibold tracking-wider text-sm uppercase',
      'transition-all duration-200',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      borderClass,
      holding ? glowClass : '',
    ]"
    class="bg-gunmetal-700"
  >
    <span
      class="absolute inset-y-0 left-0 transition-[width] duration-75 ease-linear"
      :style="{
        width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${fillColor}33, ${fillColor}99)`,
      }"
    />
    <span class="relative z-10 flex items-center justify-center gap-2">
      <span
        v-if="!holding"
        class="inline-block w-2 h-2 rounded-full"
        :style="{ background: fillColor }"
      />
      <span
        v-else
        class="inline-block w-2 h-2 rounded-full animate-pulse-glow"
        :style="{ background: fillColor }"
      />
      {{ holding ? "Hold to confirm…" : label }}
    </span>
  </button>
</template>
