/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
import { isExtension, isNativeApp } from "@/lib/runtime";

/**
 * Single exit point for the Authorize* modals. Routes the user's decision to
 * whichever transport carried the dApp request:
 *   - extension → background.ts (`UI_AUTHORIZE_COMPLETE`) → bridge.js → page
 *   - Android   → in-app dApp browser (`postMessage` into the WebView)
 */
export async function completeAuthorize(
  requestId: string | number | undefined,
  approved: boolean,
  payload: any,
  error?: string,
) {
  if (requestId === undefined) return;
  if (isNativeApp()) {
    const { dappBrowser } = await import("@/lib/dappBrowser");
    dappBrowser.complete(requestId, approved, payload, error);
    return;
  }
  if (isExtension() && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: "UI_AUTHORIZE_COMPLETE",
      requestId,
      approved,
      payload,
      error,
    });
  }
}
