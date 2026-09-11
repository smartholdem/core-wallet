/**
 * SmartHoldem dApp provider — injected as `window.smartholdem` into every page.
 *
 * This file is loaded by Chrome as a content_script in the MAIN world
 * (see manifest.json). It is NOT transpiled by Vite, so it MUST be 100%
 * vanilla, browser-parseable JavaScript — no TypeScript syntax (no type
 * annotations, generics, `as any`, etc.) or the page will hard-crash with
 * `Uncaught SyntaxError: Unexpected identifier 'as'`.
 *
 * Exposed API:
 *   window.smartholdem.isSmartHoldem               // true
 *   window.smartholdem.version                     // "1.4.8"
 *   window.smartholdem.network                     // "mainnet"
 *   window.smartholdem.getAccount()                // → { address }
 *   window.smartholdem.signMessage(message)        // → { signature, ... }
 *   window.smartholdem.signTransaction(payload)    // → { id, signature, ... }
 *   window.smartholdem.requestSwap({ amount, direction, destination })
 *
 * Communication: postMessage → bridge.js (ISOLATED) → background SW → side panel.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.smartholdem) return;

  var _id = 0;
  var pending = new Map();

  function request(method, params) {
    var id = ++_id;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      window.postMessage(
        {
          source: "smartholdem-dapp",
          id: id,
          method: method,
          params: params,
        },
        "*"
      );
      setTimeout(function () {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("smartholdem: request timeout"));
        }
      }, 60000);
    });
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "smartholdem-wallet") return;
    var entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  });

  window.smartholdem = {
    isSmartHoldem: true,
    version: "1.4.8",
    network: "mainnet",

    /** Request the user's active STH address. */
    getAccount: function () {
      return request("getAccount", {});
    },

    /** Request a Schnorr signature over `message`. */
    signMessage: function (message) {
      return request("signMessage", { message: message });
    },

    /**
     * Request the user to authorize and sign a raw v2 transaction payload.
     * Payload accepts: { recipientId, amount, vendorField?, fee? }
     *   - `recipientId` (preferred; standard STH/ARK convention).
     *     Legacy alias `recipient` is also accepted.
     *   - `amount` and `fee` are STH (whole units), e.g. `1` or `"0.25"`.
     * Resolves with:
     *   { id, signature, senderPublicKey, tx, serialized, data }
     *     - `tx`         — JSON tx as `toJson()` produces (signed).
     *     - `serialized` — hex string of the canonical wire bytes. Broadcast
     *                      this verbatim to any STH node's `/api/transactions`
     *                      to avoid any re-encoding risk on the dApp side.
     *     - `data`       — full transaction data INCLUDING `network`,
     *                      `typeGroup`, `timestamp` (self-describing).
     */
    signTransaction: function (payload) {
      return request("signTransaction", payload || {});
    },

    /**
     * One-shot **sign + broadcast** convenience. Accepts the exact same
     * payload shape as `signTransaction`. After PIN approval the wallet:
     *   1. Builds and Schnorr-signs the v2 transfer (network=63, typeGroup=1).
     *   2. Immediately POSTs the canonical wire bytes to
     *      `https://node.smartholdem.io/api/transactions`.
     * Resolves with the node's broadcast response augmented with the local
     * `id` / `serialized` / `data` so the dApp can fully reconcile state.
     * The user only enters their PIN once.
     */
    sendTransaction: function (payload) {
      return request("sendTransaction", payload || {});
    },

    /**
     * Deep-link into the Swap Hub with pre-filled inputs.
     *
     * @param {{ amount?: number|string,
     *           direction?: "STH_TO_USDT"|"USDT_TO_STH",
     *           destination?: string }} args
     */
    requestSwap: function (args) {
      return request("requestSwap", args || {});
    },
  };

  window.dispatchEvent(new CustomEvent("smartholdem#initialized"));
})();
