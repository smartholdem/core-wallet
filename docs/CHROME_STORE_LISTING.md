# Chrome Web Store — Listing Copy (EN)

Paste-ready texts for the Developer Dashboard. Sections map 1:1 to the
dashboard tabs: **Store listing → Privacy practices → Distribution**.

---

## Store listing

**Category:** Productivity › Tools
**Language:** English (add Russian, Chinese (Simplified), Spanish — the UI is localised)

**Extension name (from manifest):** SmartHoldem Wallet (STH)

**Summary (≤132 chars, from manifest `description`):**
```
Self-custodial wallet for the SmartHoldem (STH) blockchain: send, receive, swap and sign for dApps. Your keys, your coins.
```
> Update `manifest.json → description` to this string so the dashboard picks it up.

**Detailed description:**
```
SmartHoldem Wallet is the official self-custodial browser wallet for the SmartHoldem (STH) blockchain. Manage STH, connect to SmartHoldem dApps and sign transactions — without ever handing your private keys to anyone.

WHY SMARTHOLDEM WALLET
• Self-custody by design — keys are generated and encrypted on your device only. No accounts, no KYC, no cloud, no tracking.
• Side Panel UI — the wallet docks next to any page, so you can keep playing or trading while you sign.
• Built for the SmartHoldem ecosystem — native STH transfers, memo (vendor field) support, fixed network fee shown upfront.

CORE FEATURES
• HD multi-account: unlimited deterministic sub-accounts from one BIP-39 seed; switch accounts in one tap.
• Send & Receive: address validation, QR code receive dock, live balance and transaction history.
• Swap Hub: STH ↔ USDT (BEP-20) through the official SmartHoldem exchange gateway, directly inside the wallet.
• Web3 provider: injects window.smartholdem so dApps can request a connection, ask you to sign a message or approve a transaction — every request is shown to you first and can be rejected.
• Connected Sites manager: see and revoke every dApp you have authorised.
• Address book, 3 visual themes (Rust Classic, Cyan Steel, Industrial Light), 4 languages (EN / RU / ZH / ES).

SECURITY
• AES-256-GCM encrypted vault, PIN unlock, configurable auto-lock timer.
• Encrypted backup export/import (.sth) — restore on any device.
• 100 % of code ships inside the extension; no remote scripts, no analytics, no telemetry.
• Manifest V3, strict Content-Security-Policy, open source: https://github.com/smartholdem/core-wallet

FOR DAPP DEVELOPERS
Integrate in minutes: await window.smartholdem.connect(); window.smartholdem.signMessage(msg); window.smartholdem.sendTransaction(tx). Documentation in the repository README.

SmartHoldem Wallet is free and open source. Support & docs: https://smartholdem.io
```

**Official URL:** smartholdem.io (verified via Google Search Console — shown under the item title as the verified publisher site)
**Homepage URL:** https://github.com/smartholdem/core-wallet
**Support URL:** https://t.me/smartholdem

**Screenshots (1280×800 or 640×400, 1–5):** Dashboard · Transfer Hub · dApp connection prompt · Swap Hub · Settings/Themes
**Small promo tile (440×280):** wallet mark on dark steel background, tagline "Your keys. Your STH."

---

## Privacy practices

**Single purpose description:**
```
SmartHoldem Wallet is a self-custodial cryptocurrency wallet for the SmartHoldem (STH) blockchain. Its single purpose is to let the user create and manage STH accounts, send/receive/swap STH and approve signature requests from SmartHoldem dApps. All key material is generated and stored locally in encrypted form.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Stores the user's AES-256-encrypted key vault, account list, address book, connected-site authorisations and UI settings locally in chrome.storage.local. Nothing is synced or sent to a server. |
| `sidePanel` | The wallet UI is rendered in the Chrome Side Panel so users can keep the dApp page visible while reviewing and approving a transaction or message. |
| `activeTab` | Used only when the user clicks the toolbar icon to identify the origin of the current page for the "Connect this site" flow and the Connected Sites list. |
| `tabs` | Required to read the URL/origin of the tab that issued a dApp request (so the approval prompt can show which site is asking) and to open the Side Panel for that tab via chrome.sidePanel.open({tabId}). No browsing history is read or stored. |
| Content scripts on `<all_urls>` (`inject.js`, `bridge.js`) | Injects the read-only `window.smartholdem` provider so any SmartHoldem dApp can request a connection or signature, exactly like other Web3 wallets. The scripts are passive: they do nothing until a page explicitly calls the provider, and every request is shown to the user for approval. No page content is read or modified. |
| Remote code | **No.** All JavaScript, CSS and fonts are bundled in the package. The extension only performs HTTPS fetches to SmartHoldem API nodes (`*.smartholdem.io`) for balances, transaction history, fees and broadcasting signed transactions. |

**Data usage disclosures — tick:**
- ☐ Personally identifiable information — **No**
- ☐ Health, Financial and payment information — **No** (the wallet handles crypto keys locally; nothing is transmitted to the developer)
- ☐ Authentication information — **No**
- ☐ Personal communications / Location / Web history / User activity / Website content — **No**

**Certifications (all three must be checked):**
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/smartholdem/core-wallet/blob/main/docs/PRIVACY.md` (mirror it at `https://smartholdem.io/privacy` when possible) — required because the extension handles user data (keys) even though nothing leaves the device.

---

## Distribution

- **Visibility:** Public
- **Payment:** Free
- **Regions:** All regions
- **Test instructions for reviewer** (Dashboard → Access → Test instructions):
```
No account or login required.
1. Click the toolbar icon → the Side Panel opens → "Create a new wallet" → set a PIN → write down the 12-word seed → Dashboard.
2. Receive: copy address / QR. Send: any valid STH address (starts with "S"); the network fee is shown before signing.
3. dApp flow: open https://poker.smartholdem.io (or any page), run in DevTools console:
   await window.smartholdem.connect()
   → the wallet shows an approval prompt; approve; the site appears under Settings → Connected Sites.
   await window.smartholdem.signMessage("hello") → signature prompt.
4. Settings → Backup exports an encrypted .sth file; Import restores it.
Source code: https://github.com/smartholdem/core-wallet (reproducible build: yarn install --frozen-lockfile && yarn build:extension).
```

---

## Verified publisher

Already done: `smartholdem.io` is verified in Google Search Console and selected as **Official URL** in the store listing, so the listing shows the verified publisher site under the title. The separate **Established Publisher** badge cannot be requested — Google grants it automatically after identity verification and a period of clean policy history.
