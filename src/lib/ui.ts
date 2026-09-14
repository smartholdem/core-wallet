import { ref } from "vue";
import type { Router } from "vue-router";

/** Shared UI state that gestures / hardware buttons need to reach. */
export const menuOpen = ref(false);

const ROOT_ROUTES = new Set(["/dashboard", "/lock", "/welcome"]);

export function isRootRoute(path: string) {
  return ROOT_ROUTES.has(path);
}

/** Light haptic tick: Capacitor WebView honours navigator.vibrate (VIBRATE permission). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

/**
 * Android edge-swipe back: start within 24 px of the left edge, drag ≥ 90 px
 * right with little vertical drift → router.back() (never from root routes).
 */
export function installEdgeSwipeBack(router: Router) {
  let x0 = 0;
  let y0 = 0;
  let armed = false;
  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      armed = t.clientX <= 24;
      x0 = t.clientX;
      y0 = t.clientY;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchend",
    (e) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = Math.abs(t.clientY - y0);
      if (dx >= 90 && dy < 60) {
        if (menuOpen.value) {
          menuOpen.value = false;
          return;
        }
        if (!isRootRoute(router.currentRoute.value.path)) {
          haptic(8);
          router.back();
        }
      }
    },
    { passive: true },
  );
}

/** Android hardware/gesture back button (Capacitor App plugin). */
export function handleHardwareBack(router: Router, minimize: () => void) {
  if (menuOpen.value) {
    menuOpen.value = false;
    return;
  }
  if (isRootRoute(router.currentRoute.value.path)) minimize();
  else router.back();
}
