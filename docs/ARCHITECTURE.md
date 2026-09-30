# Architecture

## Owners and boundaries

| Layer | Responsibility |
| --- | --- |
| Popup / expanded library | Native DOM, escaped text rendering, user actions, clipboard write, bounded list rendering and recoverable forms |
| Background service worker | Exact owned-UI sender checks, entitlement decisions, serialized library commands, context capture and deliberate active-tab paste |
| Domain core | Schema/byte/reference validation, Free limits, organization, atomic import merge and signed receipt verification |
| Browser local storage | Versioned library, one previous snapshot and separate license credentials/receipt |
| Cloudflare Worker | Bounded license API, exact extension-origin admission, per-IP/per-license limits, Creem calls and receipt signing |
| Creem | Purchase processing, license status and browser-instance activation allowance |
| Existing Next.js portfolio | Server-rendered landing/legal pages, actual screenshot and idempotent CMS project insertion |

## Local persistence

`drop.library.v1` stores version, revision, clips and collections. `drop.backup.v1` stores the previous successful snapshot. Repository reads and read-modify-writes share one queue in the background. A failed validation or storage write leaves the current state unchanged. Explicit Delete all replaces both current and recovery content with empty data. Unknown/future schema versions fail visibly and are never automatically replaced.

A clip has stable ID, content, optional title, type, optional collection ID, favorite flag, creation/update/use timestamps. Collection IDs must exist. Imports are validated before merging; content duplicates are skipped, identities remapped and deleted collection references detached without dropping clips.

JSON backup limits account for formatting overhead separately from parsed library limits. Every incoming library still passes the same schema, record and 4 MB checks. The UI initially renders at most 60 matches and offers Show more.

## Licensing

Separate `drop.license.v1` holds random browser-installation ID, key, provider instance ID, verified receipt and last check. No clips enter this flow. The Worker calls Creem activate/validate/deactivate with server-only API credentials. Active matching product/mode/instance responses produce an ES256 receipt bound to product, mode, installation and instance. Local signature verification uses only the public P-256 key.

Receipts last <=72 hours, capped at provider expiry. Scheduled checks run every six hours and on use/startup. Offline/transient failure keeps an unexpired valid receipt; confirmed inactive license stops future Pro operations. Clip content remains available after downgrade.

A lost activation response is an unknown remote outcome, not proof of failure. Pending state is persisted before activation. No blind retry consumes another slot. Support reconciles the provider’s instance before a typed RELEASED reset. A Worker crash, lost response or storage failure still needs this operator recovery; V0 does not promise distributed exactly-once activation.

## Worker contract

`GET /health` reports service/version only. `POST /v1/activate`, `/validate`, `/deactivate` use JSON, a license key, installation ID and instance ID where applicable. Exact chrome-extension origins are allowlisted; originless extension requests require an allowlisted X-Drop-Extension header. This header/CORS rule is not user authentication; the valid license key and provider checks authorize entitlement.

Requests <=4 KB, provider responses <=32 KB, extension responses <=16 KB. Deadlines: provider 7s, extension 10s. Rate binding is mandatory, 12 per minute per network IP and hashed key at the edge. It is a local Cloudflare edge limit, not a globally exact quota. No clip database, accounts, queue, webhook receiver or remote content scripts.

## Portfolio insertion

The portfolio already uses a one-time hidden marker and transaction/advisory lock for Later. Drop follows that pattern under its own marker. It creates only a missing Drop entry and marker. It never updates an existing entry or changes the schema; later admin edits/deletion remain authoritative. The portfolio’s default branch is `master`; Drop’s is `main`.
