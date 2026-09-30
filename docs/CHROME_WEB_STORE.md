# Chrome Web Store preparation

1. Complete native and billing smoke tests. Use a stable extension ID and exact Worker allowlist.
2. Create/update the Drop store item. Keep preview and production builds clearly separated. Do not reuse Later’s ID, ZIP or product listing.
3. Configure live values, run `npm run check` and `npm run verify:release`, then `node scripts/package.mjs --production`.
4. Upload the production ZIP with `manifest.json` at its root. The build includes 16/32/48/128 px icons. Increase manifest/build version for each subsequent update.
5. Use screenshots of the actual verified Free/Pro interface; represent licensed features and device limits truthfully. Current development screenshots do not prove live checkout.
6. Set homepage https://antonni-code.dev/drop and privacy https://antonni-code.dev/drop/privacy. Provide a working matching branded support address.
7. Explain the single purpose: deliberately save and reuse short text, links and code from a local clipboard shelf.
8. Explain permissions: storage for local library/license; clipboardWrite for user-requested copy; contextMenus for selected-text/link capture; activeTab/scripting for user-requested Quick Paste; alarms for license checks; exact license-service host for activation/validation/release.
9. Complete current data-use disclosures accurately: saved content remains local; license key and installation/instance metadata go to Cloudflare/Creem; payment information is handled by Creem. No selling data, automatic clipboard monitoring or unrelated browsing collection.
10. Review the listing, then submit for store review. Publication and timing depend on the store. Update product status after confirmed publication, not after uploading a draft.

Official references: https://developer.chrome.com/docs/webstore/publish and https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions.
