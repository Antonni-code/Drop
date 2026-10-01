# Testing and evidence

## Automated checks completed

`npm run check`: typecheck, production extension build, **24** unit/integration cases. Covers serialized concurrent Free saves, failed writes, future/corrupt state, Unicode/size/duplicate handling, sender admission including owned library tabs, clear/recovery behavior, protected actions, import/collection relationships, near-capacity backup round-trip, downgrade retention, receipt forgery/bindings/expiry, Worker product/instance/environment validation, bounded requests and safe upstream failure/rate limiting.

`npm run test:browser`: **25** real Chromium checks on the built DOM/CSS and real clipboard. Covers empty/saved/reloaded/search/inert-text states, duplicate and Free-limit errors with draft retention, delete/undo, Pro sheet, collections, favorites, custom titles, ordering, JSON export, downgrade and supported/refused paste fields. Automated axe checks found no violations in the Free shelf and Pro sheet. This is not a certification of accessibility.

The browser harness explicitly adapts `chrome.runtime`/storage messaging to tested domain functions. It does **not** test installed MV3 APIs, the actual context menu, toolbar permissions, service-worker suspension or real Creem purchases. Full Playwright Chromium download returned an empty/incomplete archive in this environment; available headless Chromium was used for UI checks. Native installation remains a release requirement.

The preview ZIP’s structure and CRC were verified independently with Python `zipfile`; it contains built assets and manifest only. The production gate correctly rejects missing production configuration.

## Cloudflare bundle and live portfolio

On September 30, 2026, `wrangler deploy --dry-run --config worker/wrangler.jsonc` successfully bundled the Worker with its rate-limit binding (8.52 KiB before gzip). This is a local bundle check; it does not deploy a service or validate real Cloudflare/Creem credentials. In a restricted workspace, `WRANGLER_LOG_PATH=.test-build/wrangler.log` keeps CLI logs in the project.

Portfolio PRs [#39](https://github.com/Antonni-code/nxtjs_portfolio/pull/39) and [#40](https://github.com/Antonni-code/nxtjs_portfolio/pull/40) merged into the existing `master` branch. Vercel preview builds and both production deployments passed. The deployed `/drop` page passed real-browser checks at 375, 768, 1440 and 1920 px, with no horizontal overflow, broken images or automated axe violations. FAQ expansion, mobile policy pages, support links, exact download bytes and absence of uncaught client errors also passed. The actual portfolio project card, screenshot, details and `/drop` link were verified in the live browser, confirming the one-time project insertion rendered.

Live checking found that the portfolio's global link reset removed default policy-link underlines. PR #40 added explicit scoped underlines; both deployed policy routes were rechecked and passed axe. The Vercel preview URL requires sign-in, so this fix was validated against live styles with a scoped CSS override before merge and against the actual production deployment afterward. No sign-in protection was bypassed.

Public HTTPS checks returned 200 for the homepage, product, both policy routes and the preview ZIP. The deployed 27,371-byte ZIP matches the independently verified local package: SHA-256 `1ac60f79244fc97e40ef51ef7cee38dba6f61435ef3dd96a48bc65f135f8b57b`. These website checks do not exercise unrelated admin/CMS flows, native MV3 APIs or purchases.

## Reproduce

### October 1 continuation

Rechecked the current `main` implementation: 24 unit/integration tests, typecheck, build and all 25 browser checks passed. The independently verified preview remains 27,371 bytes with the same SHA-256 recorded above; no extension or payment logic changed.

Release ZIP verification now runs automatically during `npm run package` and in CI after packaging. Six negative archive checks passed: extra private-key filename, missing file, duplicate filename, modified build bytes, wrong checksum and truncated ZIP were all rejected. Python's standard ZIP reader also checks each extracted entry's CRC.

Native MV3 remains unchecked: the full Playwright Chrome download returned an incomplete/non-ZIP response, and the available headless-shell binary did not load an extension service worker. The existing browser checks therefore still use their explicit adapter. The production gate still rejects the absent real local configuration. This continuation did not configure billing, publish to the store, change GitHub account billing, or set the GitHub About sidebar.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run package
npm run verify:package
```

Optional `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE`, `AXE_MODULE` select an existing supported local browser/package installation. The harness uses a temporary localhost server and a simulated license flag only in test code; these are not part of `dist`.

## Native Chrome smoke checklist

1. Load `dist`, pin Drop and confirm no service-worker errors at `chrome://extensions`.
2. Save from editor and the page selection/link context menu. Close/reopen popup, restart browser, and verify exact content is retained.
3. Fill five Free spaces. Try simultaneous saves from popup/library/context menu; sixth fails without changing the existing five.
4. Copy exact Unicode, multiline text and literal HTML. Check clipboard behavior with actual toolbar gestures and browser permission settings.
5. Open the expanded library; edit, delete, undo, recovery download and typed Delete all work there. Recovery snapshot is empty after Delete all.
6. Test assigned/default shortcuts and conflicts; right-click capture badges/notices; keyboard-only use, focus, popup dialog scrolling and reduced motion.
7. Configure test billing with the correct stable extension ID. Verify a real Creem test purchase, delivered key, activation and all Pro tools. Test wrong product, wrong mode, inactive/expired/refunded key, device allowance and release/reactivate.
8. With Pro, focus a supported field before toolbar/shortcut Quick Paste. Verify page permission gesture, selection replacement and fallback. Test protected pages, password/payment/OTP, read-only, simple contenteditable and unsupported rich editors.
9. Export/import a representative large shelf and malformed backup; preserve current data on rejection. Delete a collection without deleting clips.
10. Suspend/restart the service worker and go offline. Verify six-hour alarms recreate/check and valid receipt behavior; expiry/downgrade preserves every existing clip.
11. Simulate activation lost response and local storage failure. Confirm support can release the instance and reset pending state without duplicate slots or clip deletion.

Do not mark unchecked items as passed. Record the browser version, extension version, mode, Worker deployment and stable ID used; keep keys and private text out of the record.

## Remote CI status

The workflow is committed with read-only repository permission and pinned actions. The first GitHub Actions run did not start a runner or execute any step: GitHub annotated it with “The job was not started because your account is locked due to a billing issue.” Local typecheck, unit/integration, build and browser verification passed separately. Resolve the GitHub billing lock and rerun CI; this account restriction has not been changed by the implementation.
