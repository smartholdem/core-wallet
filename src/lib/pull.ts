import { ref } from "vue";
import { haptic } from "@/lib/ui";

/** Touch pull-to-refresh for a scroll container: bind the handlers + render `pull` px indicator. */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const pull = ref(0);
  const pulling = ref(false);
  let y0 = 0;
  let armed = false;
  function onStart(e: TouchEvent) {
    armed = (e.currentTarget as HTMLElement).scrollTop <= 0;
    y0 = e.touches[0].clientY;
  }
  function onMove(e: TouchEvent) {
    if (!armed || pulling.value) return;
    pull.value = Math.min(96, Math.max(0, (e.touches[0].clientY - y0) * 0.6));
  }
  async function onEnd() {
    if (!armed) return;
    armed = false;
    if (pull.value >= 56 && !pulling.value) {
      pulling.value = true;
      pull.value = 48;
      haptic();
      await refresh();
      pulling.value = false;
    }
    pull.value = 0;
  }
  return { pull, pulling, onStart, onMove, onEnd };
}
