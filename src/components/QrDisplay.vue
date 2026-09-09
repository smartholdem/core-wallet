<script setup lang="ts">
/* oxlint-disable no-undef -- defineProps/defineEmits/withDefaults are Vue compiler macros */
import { ref, watch, onMounted } from "vue";
import QRCode from "qrcode";

const props = defineProps<{ value: string; size?: number }>();
const dataUrl = ref<string>("");

async function render() {
  if (!props.value) return;
  dataUrl.value = await QRCode.toDataURL(props.value, {
    width: props.size ?? 224,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#E6E7EA", light: "#0B0C0E" },
  });
}

onMounted(render);
watch(() => props.value, render);
</script>

<template>
  <div
    class="relative p-3 rounded-lg border border-gunmetal-400 bg-gunmetal-700"
    data-testid="qr-display"
  >
    <!-- corner markers -->
    <span class="absolute top-1.5 left-1.5 w-3 h-3 border-l-2 border-t-2 border-cyan-volt" />
    <span class="absolute top-1.5 right-1.5 w-3 h-3 border-r-2 border-t-2 border-cyan-volt" />
    <span class="absolute bottom-1.5 left-1.5 w-3 h-3 border-l-2 border-b-2 border-cyan-volt" />
    <span class="absolute bottom-1.5 right-1.5 w-3 h-3 border-r-2 border-b-2 border-cyan-volt" />
    <img v-if="dataUrl" :src="dataUrl" alt="QR" class="block mx-auto rounded-sm" />
    <div v-else class="aspect-square w-full grid place-items-center text-gunmetal-300 text-xs">
      Generating…
    </div>
  </div>
</template>
