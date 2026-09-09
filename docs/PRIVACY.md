# Privacy Policy - SmartHoldem Wallet

**Effective date:** 9 June 2026
**Applies to:** SmartHoldem Wallet browser extension (Chrome / Firefox) and the SmartHoldem Wallet PWA ("the Wallet"), published by SmartHoldem Foundation ("we").

## 1. Summary

SmartHoldem Wallet is a **self-custodial** cryptocurrency wallet. We do not operate accounts, servers that store user data, analytics, or advertising. **We do not collect, receive, store, sell or share any personal data.** Everything the Wallet needs lives on your device.

## 2. Data stored on your device

The Wallet stores the following **only locally** (in `chrome.storage.local` / `browser.storage.local`, or `localStorage` for the PWA):

| Data | Purpose | Protection |
|---|---|---|
| Encrypted vault (BIP-39 seed / private keys) | Signing transactions and messages | AES-256-GCM, key derived from your PIN; never leaves the device in plaintext |
| Account list, labels, address book | Wallet UI | Local only |
| Connected sites (origins you authorised) | Let dApps you approved talk to the Wallet | Local only, revocable in Settings → Connected Sites |
| UI settings (theme, language, auto-lock timer) | Preferences | Local only |

Uninstalling the extension or clearing browser storage deletes all of it. **We cannot recover your keys** - only your written seed phrase or an encrypted `.sth` backup can.

## 3. Network requests

To display balances and broadcast transactions the Wallet makes HTTPS requests **only** to SmartHoldem infrastructure:

- `https://*.smartholdem.io` - public blockchain API nodes (balances, transaction history, fees, transaction broadcast)
- `https://exchange.smartholdem.io` - the SmartHoldem swap gateway (STH ↔ USDT rates and deposit addresses), used only when you open the Swap Hub

These requests contain public blockchain data (your STH address, signed transactions) and are inherently visible on the public SmartHoldem ledger, like with any blockchain. They do not include your PIN, seed phrase, private keys, IP-based profiling, or any identifier other than the blockchain address. Standard server logs (IP address, timestamp) may be retained by node operators for a limited time for abuse prevention; they are not linked to any identity.

The Wallet never loads remote code, fonts, or scripts. No third-party SDKs, trackers, cookies or analytics are included.

## 4. Web3 provider and dApps

The Wallet injects a read-only `window.smartholdem` object into web pages so that SmartHoldem dApps can **request** a connection, a message signature or a transaction. The provider:

- does nothing until a page explicitly calls it;
- shows you every request (origin, amount, memo, message) and requires your explicit approval;
- reveals your **address** only to sites you have approved, and never reveals keys.

Any data you share with a dApp after approving it is governed by that dApp's own privacy policy.

## 5. Permissions

| Permission | Why |
|---|---|
| `storage` | Store the encrypted vault and settings locally |
| `sidePanel` | Render the wallet UI in the browser side panel |
| `activeTab`, `tabs` | Identify the origin of the tab making a dApp request and open the side panel for it; no browsing history is read or stored |
| Content scripts on all sites | Inject the passive `window.smartholdem` provider (see §4) |

## 6. Children

The Wallet is not directed to children under 16 and we do not knowingly process data about them.

## 7. Open source

The full source code is public: <https://github.com/smartholdem/core-wallet>. Builds are reproducible so you can verify that the published extension matches the source.

## 8. Changes

We may update this policy when the Wallet changes. The current version is always at <https://github.com/smartholdem/core-wallet/blob/main/docs/PRIVACY.md>; material changes will be noted in the release notes.

## 9. Contact

SmartHoldem Foundation - <https://smartholdem.io> - GitHub issues: <https://github.com/smartholdem/core-wallet/issues>
