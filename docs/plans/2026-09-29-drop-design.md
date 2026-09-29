# Drop design

## Product

Drop is a small, deliberate clipboard shelf for Chrome and Chromium browsers. Save text, links and code, then copy them wherever needed. Data stays in this browser profile. No account, analytics, cloud sync or background clipboard monitoring.

Free includes five saved clips, recent-first sorting, search, selection capture, one-click copy and a keyboard shortcut. Pro is a one-time unlock for unlimited saves within documented device-storage safeguards, collections, favorites, custom titles, collection colors/icons, type filters, manual ordering, JSON import/export and Quick Paste in supported web fields. Existing clips remain readable and copyable if a license expires or the service is offline. Proposed launch price: USD 5.99, configurable before sales begin.

## Direction and alternatives

Use a compact, local-first extension with a small licensing Worker. A hosted clipboard would require accounts, synchronization and server storage of private content. A native desktop clipboard manager would need a separate platform build and distribution flow. Neither fits this V0.

The interface is a precise, quiet shelf: warm white canvas, charcoal typography, blue accent, hairline separators, rounded-square type marks, subtle inset composer and an open-circle Drop mark. System fonts, no remote imagery or font calls. The popup is 404 px wide with a bounded scroll area; the expanded library shares the same implementation. Collection chips, clear focus rings, labeled controls, keyboard navigation and reduced-motion support are required.

## Data and boundaries

The service worker is the only writer of versioned chrome.storage.local state. A serialized queue prevents concurrent lost updates and free-limit races. Validate all stored and imported data, clip length, total bytes, collection references and IDs. Store a previous snapshot before replacement. Do not silently reset corrupt or newer-version data. Render saved material as text.

The popup performs clipboard writes only after a click or key action. A selection context menu captures deliberately selected text. Quick Paste injects only after explicit user action using activeTab; it must refuse passwords, readonly fields and unsupported editors and explain the copy fallback. No persistent content scripts or broad host permissions.

Cloudflare proxies Creem license activation, validation and deactivation. API keys and receipt signing keys stay on the server. Use standard Web Crypto ECDSA P-256 signatures, product/mode/instance/device binding, a 72-hour maximum receipt, strict request and provider-response sizes, request deadlines, per-IP and per-license rate limits, and exact extension-origin allowlisting. License decisions live in the background, never in a UI-only boolean. Open-source/local code cannot be made tamper-proof; document that boundary honestly.

No checkout links or live service endpoints are invented. Unconfigured payments stay unavailable with a clear status. No charge occurs during development. Validate against current Creem API contracts. The receipt lifetime bounds revocation propagation; refund handling must explicitly disable the Creem license and be verified before launch.

## Portfolio

Add /drop, /drop/privacy and /drop/terms to the existing Next.js portfolio. Use the current Later project-card/CMS pattern and preserve unrelated content. Present the actual extension UI, the proposed price, feature limits, contact and launch status. Do not imply Chrome Web Store publication or Creem approval. This task explicitly authorizes the new routes and narrowly scoped project insertion; do not change CMS schemas, authentication or unrelated logic.

## Acceptance

Save, persist, search, copy, edit, delete and undo work. Concurrent free saves cannot exceed five. Pro data is preserved after downgrade. Import rejects malformed, oversized and invalid references atomically. Receipts reject forgery, expiry, wrong device/product/mode and mismatched instances. Worker failures return bounded safe errors. Browser checks cover real extension storage, popup interactions, supported paste fields, rejected fields, UI states and responsive landing-page layout.

## Delivery constraints

The GitHub connector can write commits but currently exposes no repository-creation action. Prepare the full local repository and history; remote creation is a separate final step. Deployment, live Creem product details, extension ID and production signing keys require account configuration and cannot be claimed complete without evidence.
