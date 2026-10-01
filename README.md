# Drop

A little less retyping. A private clipboard shelf for the text, links and code you reach for.

**Status:** V0.1.0 development preview. Free works without a service or account. The Creem/Cloudflare integration is implemented; live keys, product configuration, native Chrome smoke tests and Chrome Web Store publication remain release steps. No payment is taken in the unconfigured preview.

## Try Drop

Chrome Web Store availability will be announced at [Drop’s product page](https://antonni-code.dev/drop). There is no public ZIP download. Developers can inspect and build the source locally:

```sh
npm ci
npm run build
```

Load the resulting `dist` folder using the same steps. Never load the source folder itself. Pro stays locked until a real service is configured and a valid license is activated.

## The shelf

| Free | Pro, planned one-time unlock |
| --- | --- |
| Five saved clips | Saves beyond five within device safeguards |
| Text, links and code | Collections, favorites and custom names |
| Search and recent-first sorting | Collection colors and icons |
| One-click copy | Type filters and manual ordering |
| Selection/link context-menu capture | JSON import and export |
| Keyboard shortcuts | Quick Paste in supported focused web fields |
| Raw recovery download | Same local storage and privacy boundaries |

Proposed price: **US$2.99 once**, configurable before sales. Device safeguards: 5,000 clips, 100 collections, 4 MB parsed library and 16 KB per clip. Formatted JSON backups may be up to 8 MB; imported contents still have to meet every library safeguard. Existing clips stay readable, editable and copyable if Pro pauses.

Open Drop with `Alt+Shift+D`; choose a Quick Paste clip with `Alt+Shift+V`. Inside Drop: `/` or `Ctrl/⌘+K` searches, `N` opens a new clip, and `Ctrl/⌘+Enter` saves the editor. Change conflicting browser shortcuts at `chrome://extensions/shortcuts`.

## Development

Node.js 22+ and npm; Python 3 for independent release ZIP verification (standard library only). The extension uses TypeScript, bundled vanilla DOM/CSS, Chrome Manifest V3, Web Crypto and a Cloudflare Worker. No runtime UI framework, account system or clip server.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run package
```

`npm run check` typechecks, tests and builds. Browser verification uses the actual built interface and clipboard with a declared extension API adapter. It is separate from native MV3 testing. See [TESTING](docs/TESTING.md).

`npm run package` also verifies the preview ZIP with Python's standard ZIP reader: exact built assets, CRCs, permission boundaries and SHA-256. Use `npm run verify:package -- path/to/archive.zip` to verify another package against the current `dist` build.

`npm run verify:release` intentionally fails until real production configuration exists. `node scripts/package.mjs --production` runs that gate before creating a production ZIP. A static gate cannot prove a purchase flow or account approval.

## Read next

- [START HERE](docs/START_HERE.md) — the owner’s exact next steps
- [ABOUT](ABOUT.md) and [PRD](PRD.md) — product intent and acceptance criteria
- [CREEM & CLOUDFLARE](docs/CREEM_CLOUDFLARE.md) — test/live configuration and secrets
- [ARCHITECTURE](docs/ARCHITECTURE.md) and [SECURITY](docs/SECURITY.md) — boundaries, data and tradeoffs
- [DESIGN SYSTEM](docs/DESIGN_SYSTEM.md) — typography, color and interaction
- [TESTING](docs/TESTING.md) and [RELEASE](docs/RELEASE.md) — evidence and remaining gates
- [CHROME WEB STORE](docs/CHROME_WEB_STORE.md) — packaging, disclosures and submission
- [Privacy](https://antonni-code.dev/drop/privacy), [Terms](https://antonni-code.dev/drop/terms), [Support](mailto:delosreyesjudeantonni@gmail.com)

Public source is available for inspection. No open-source reuse license is granted merely by publishing the repository. No secrets belong in commits, build config, screenshots, test artifacts or support messages.

## Commits

Use `Build (Completed) : Drop - <accomplishment>` or `Improve (Completed) : Drop - <accomplishment>`, without names or co-author trailers. Work uses phase branches and reviewed pull requests; merge after the relevant checks pass. See the [phase record](docs/plans/2026-09-29-drop-implementation.md).
