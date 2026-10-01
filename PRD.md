# Drop product requirements

Version: 0.1.0 preview · Updated: September 30, 2026

## Problem and outcome

Useful replies, links and code get lost across notes and tabs. Drop provides a small, deliberate shelf in the browser. A person should save, find and reuse a clip without opening another workspace or creating an account.

## Audience and scope

People who reuse short pieces of text while working on the web: developers, support workers, creators and anyone who frequently retypes the same lines. Chrome/Chromium 128+ is the V0 platform. Native apps and arbitrary protected/rich browser editors are outside Quick Paste scope.

Free: five clips, copy, search, recent-first order, manual entry/paste, deliberate context capture and shortcuts. Pro: saves beyond five, collections, favorites, custom titles, colors/icons, type filtering, manual order, JSON import/export and supported Quick Paste. One-time monetization; proposed US$2.99 price, final price and activation allowance configured before sale.

Non-goals: accounts, collaboration, AI, cloud clip storage, automatic clipboard history, a password vault, arbitrary editor support or universal/native desktop pasting.

## Journeys and acceptance

| Journey | Observable acceptance |
| --- | --- |
| Save and return | Save persists in this profile; opening again shows it. Exact duplicate content is rejected. |
| Concurrent Free saves | Simultaneous valid requests can save at most five; no lost updates. |
| Find and copy | Search filters by clip content/title; a user action writes exact text to the clipboard. |
| Edit/delete/undo | Edits keep identity. Delete affects one clip. Undo restores when entitlements and limits permit. |
| Organize | Valid Pro is required in the background for every protected action; collection removal keeps clips. |
| Backup | Import validates the full schema and limits before one write, skips duplicate content and remaps references. Near-capacity exports can round-trip. |
| Downgrade | Existing clips remain visible, editable and copyable. Further saves above five and Pro tools pause. |
| Quick Paste | User-triggered active-tab injection writes plain text into supported fields; excludes passwords, payment/verification, read-only and rich editors. Manual copy fallback explains refusal. |
| Paid unlock | Only an active matching Creem product, mode and instance can receive a signed, device-bound receipt; receipt expiry is at most 72 hours. |
| Corruption/failure | Failed operations do not reset clips. Unsupported versions are preserved. A raw recovery download remains accessible. |
| Clear | Requires typed DELETE and removes both current content and the previous recovery snapshot. |
| Missing configuration | Checkout and activation are disabled with a truthful preview state. |

## Constraints

Parsed library <=4 MB; 5,000 clips; 100 collections; 16 KB per clip. Formatted imports <=8 MB with parsed library bounds unchanged. TypeScript domain rules and one background writer own persistent state. No remote executable code or broad host access. Private keys and Creem API keys only on Cloudflare. License keys locally stored for verification are sensitive and not encrypted.

## Distribution and evidence

The portfolio includes an actual UI preview, proposed pricing, downloadable Free preview, policies and support. Chrome Web Store and live billing setup are separate release work. Current automated evidence: 24 unit/integration cases, 25 browser UI checks and production build/typecheck. Live provider, native MV3, store listing and merchant review must be completed before describing the paid product as launched.

No fake customer metrics, testimonials, approval claims or guaranteed performance claims.
