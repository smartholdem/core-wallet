<script setup lang="ts">
/* oxlint-disable no-undef -- defineProps/defineEmits/withDefaults are Vue compiler macros */
import { computed } from "vue";

const props = defineProps<{
  modelValue: string;
  length?: number;
  error?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "complete", v: string): void;
}>();

const len = computed(() => props.length ?? 6);
const dots = computed(() => Array.from({ length: len.value }, (_, i) => i));

function press(digit: string) {
  if (props.disabled) return;
  if (props.modelValue.length >= len.value) return;
  const next = props.modelValue + digit;
  emit("update:modelValue", next);
  if (next.length === len.value) emit("complete", next);
}

function back() {
  if (props.disabled) return;
  emit("update:modelValue", props.modelValue.slice(0, -1));
}

function clear() {
  if (props.disabled) return;
  emit("update:modelValue", "");
}

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
</script>

<template>
  <div class="w-full flex flex-col gap-5" data-testid="pin-pad">
    <!-- Dots row -->
    <div class="flex items-center justify-center gap-3 py-2">
      <span
        v-for="i in dots"
        :key="i"
        class="block w-3 h-3 rounded-full border transition-all duration-200"
        :class="[
          modelValue.length > i
            ? error
              ? 'bg-rust border-rust shadow-glowRust'
              : 'bg-cyan-volt border-cyan-volt shadow-glowCyan'
            : 'border-gunmetal-400 bg-gunmetal-700',
        ]"
        :data-testid="`pin-dot-${i}`"
      />
    </div>

    <!-- Numeric grid -->
    <div class="grid grid-cols-3 gap-2.5">
      <button
        v-for="k in keys"
        :key="k"
        type="button"
        @click="k === '⌫' ? back() : k === 'C' ? clear() : press(k)"
        :disabled="disabled"
        :data-testid="`pin-key-${k}`"
        class="h-14 rounded-md border border-gunmetal-400 bg-gunmetal-600
               text-bone font-mono text-lg font-semibold tracking-wider
               hover:border-cyan-volt/60 hover:text-cyan-voltGlow hover:bg-gunmetal-500
               active:scale-95 active:shadow-glowCyan
               transition-all duration-100
               disabled:opacity-40 disabled:cursor-not-allowed
               relative overflow-hidden"
      >
        <span class="relative z-10">{{ k }}</span>
        <span
          class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none"
        />
      </button>
    </div>
  </div>
</template>
