# Security and privacy boundaries

## Controls implemented

- Only the background writes persistent clip data. Messages require this extension’s ID and owned popup/library URL. Web pages, unknown extension pages and foreign extensions are refused.
- Enforce Free/Pro rules in the background/domain, not a UI toggle. Import cannot add invalid references or exceed storage/record limits.
- Local serialized writes prevent lost updates and Free-limit races. Corrupt/future state is not silently reset; raw recovery is available.
- Treat saved/imported text as text. Escape UI strings; Quick Paste inserts a text node or native input value, never HTML.
- No clipboard-read permission, broad host permission, persistent content script or remotely executed code. Active-tab paste requires a user action and excludes protected inputs/editors.
- Storage access is restricted to trusted extension contexts. The only optional host permission is the exact configured license service origin.
- Worker validates JSON/media type/size, identifiers, product, environment, instance status and expiry; bounds upstream calls and safe error responses; requires rate limiting.
- P-256/ES256 receipts are verified locally against all bindings and expiry. Keys/API secrets stay on the Worker. Do not trust checkout redirects as proof of payment.
- Pending activation prevents automatic duplicate retries after an unknown outcome. Device release is confirmed remotely before local credentials are removed.

## Tradeoffs to understand

Local clips and license credentials are not encrypted. Access to a browser profile or exported JSON can expose them. Drop is not a vault. The recovery snapshot may retain a deleted clip until the next successful change; Delete all clears both snapshots.

Open client code and local storage cannot be tamper-proof DRM. Installation IDs bind ordinary activation flows; they are not hardware attestation. A profile copy, modified extension or clock manipulation is outside strong anti-piracy guarantees.

Allowlisted extension IDs and CORS do not authenticate a buyer. Non-browser callers can imitate a header; valid licenses, instance/product checks and rate limits provide the actual entitlement boundary. Edge rate limits are approximate/local, so use Cloudflare abuse controls appropriate to traffic before launch.

Offline receipt validity limits revocation propagation to 72 hours. Refunds must also disable the Creem license; V0 has no automated refund webhook. Lost activation responses or storage failures can leave a remote instance requiring support reconciliation. Test both cases before charging buyers.

## Operations

Never commit keys, receipts, API secrets, real license keys, provider response bodies or private exports. Keep Worker observability payload logging disabled. Protect Cloudflare and Creem access, retain signing keys in a proper secret store, and review releases before widening permissions.

Generate new keys deliberately. Rotating the Worker signer alone breaks verification in older installed extensions; coordinate key rotation with a compatible extension rollout and test old clients. This V0 embeds one verification key and has no automatic key-discovery service.

For a private security report, contact delosreyesjudeantonni@gmail.com without including passwords, payment cards or clip contents. Replace the interim address with the verified branded support mailbox before paid launch.
