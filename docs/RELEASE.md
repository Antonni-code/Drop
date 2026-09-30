# Release checklist

## Preview

`npm run package` produces `release/drop-v0.1.0-preview.zip` and SHA-256. The default config has no license origin, checkout or keys. This is an honest Free preview and must not be uploaded as the configured paid production build.

## Before paid distribution

- Native smoke tests in [TESTING](TESTING.md) completed with stable extension ID.
- Real test purchase, delivered license, activation, Pro tools, allowance and release tested.
- Production product/API key/mode/public key/Worker/checkout all match.
- Refund process disables the license; revocation and bounded offline behavior verified.
- Branded support mailbox receives mail and matches website/extension/Creem receipts.
- Public `/drop`, `/drop/privacy` and `/drop/terms` return working pages; download and contact links work.
- Proposed price/pending labels replaced only with confirmed final facts.
- Store listing, permission justifications and privacy disclosures match actual behavior.
- Account review requirements confirmed; no claim of guaranteed approval.

```sh
npm run check
npm run test:browser
npm run verify:release
node scripts/package.mjs --production
```

The gate checks public-only configuration, production mode/URL, exact host permissions and a hash tying the build to the current config. It scans built text for obvious secret patterns. Passing it is a static configuration check; it does not prove payment, product access or merchant approval.

## Branches and commits

One phase branch; a concise `Build (Completed) : Drop - <accomplishment>` or `Improve (Completed) : Drop - <accomplishment>` commit for each accomplishment; PR targeting Drop `main`. Include concrete behavior and checks. Merge only after applicable checks pass and no unresolved blocker invalidates the change. Preserve commits with a merge commit, without co-author trailers/names in message text.

Portfolio changes target its existing `master` branch to preserve deployment configuration. They add routes, static assets and one idempotent project insertion using existing schema. Do not rename that branch or run database schema migrations for this change.

## Recovery

Keep the last working source/build and signing secrets in their proper stores. For an extension defect, publish a fixed higher version; Chrome requires increasing package versions and does not support downgrading users through an upload. Preserve library version 1 compatibility. Never reset user storage as a recovery shortcut.

For license outage, restore the verified Worker configuration/secrets. Existing valid receipts have a bounded offline window. Do not rotate the signer alone; older extensions cannot verify a new key. For portfolio presentation issues, revert the relevant commit; the one-time marker preserves subsequent CMS edits and should not be removed casually.
