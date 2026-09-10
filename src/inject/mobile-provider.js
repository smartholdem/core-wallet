/**
 * SmartHoldem dApp provider for the Android/iOS in-app browser.
 *
 * Same public API as inject.js (window.smartholdem.*), different transport:
 * the Capgo InAppBrowser bridge instead of content-script postMessage.
 *   page → app : window.mobileApp.postMessage({ source, id, method, params })
 *   app → page : window.dispatchEvent(new CustomEvent("messageFromNative", { detail }))
 *
 * Injected at documentStart via `preShowScript`. Plain ES5 — never transpiled.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.smartholdem) return;

  var _id = Date.now() % 100000;
  var pending = {};

  function bridge() {
    return window.mobileApp && typeof window.mobileApp.postMessage === "function"
      ? window.mobileApp
      : null;
  }

  function request(method, params) {
    var id = "m" + (++_id);
    return new Promise(function (resolve, reject) {
      var b = bridge();
      if (!b) {
        reject(new Error("smartholdem: wallet bridge unavailable"));
        return;
      }
      pending[id] = { resolve: resolve, reject: reject };
      b.postMessage({
        source: "smartholdem-dapp",
        id: id,
        method: method,
        params: params || {},
        href: window.location.href,
      });
      setTimeout(function () {
        if (pending[id]) {
          delete pending[id];
          reject(new Error("smartholdem: request timeout"));
        }
      }, 120000);
    });
  }

  window.addEventListener("messageFromNative", function (event) {
    var data = event && event.detail;
    if (!data || data.source !== "smartholdem-wallet") return;
    var entry = pending[data.id];
    if (!entry) return;
    delete pending[data.id];
    if (data.error) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  });

  window.smartholdem = {
    isSmartHoldem: true,
    isMobile: true,
    version: "1.4.8",
    network: "mainnet",
    getAccount: function () { return request("getAccount", {}); },
    signMessage: function (message) { return request("signMessage", { message: message }); },
    signTransaction: function (payload) { return request("signTransaction", payload || {}); },
    sendTransaction: function (payload) { return request("sendTransaction", payload || {}); },
    requestSwap: function (args) { return request("requestSwap", args || {}); },
  };

  window.dispatchEvent(new CustomEvent("smartholdem#initialized"));
})();
