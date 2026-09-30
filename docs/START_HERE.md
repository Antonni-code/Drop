# Start here

You can try Free immediately. Paid launch needs your account settings; no real keys or account values have been guessed.

1. Download/build the preview and load its folder with **Load unpacked** in `chrome://extensions`. Test save, close/reopen, copy and the expanded library on your machine.
2. Read [CREEM_CLOUDFLARE](CREEM_CLOUDFLARE.md). Create a separate Drop Pro product in Creem **test mode** with licensing enabled. Do not reuse Later or Peek product IDs or keys.
3. Generate signing keys once, set the Worker’s private secrets, product ID and exact extension ID, deploy the test Worker, then add only the public verification key and test URLs to the ignored local extension config.
4. Build and test a test purchase: receipt/key delivery, activation, sixth clip, device release, inactive/refunded license and offline behavior. Reconcile unknown activations through support before resetting or retrying.
5. Set up a reachable branded support mailbox on a domain you control. Replace the interim Gmail address in Drop and its website, and use the same address in Creem business details and receipts. Do not advertise a mailbox until delivery works.
6. Confirm the public landing page and policies load. They identify a preview honestly. Merchant review expects a live, functioning product; a page alone does not establish eligibility or guarantee approval.
7. Prepare a Chrome Web Store item and stable extension ID. Complete native smoke tests with that build. Configure the allowlist for the stable ID, then follow [CHROME_WEB_STORE](CHROME_WEB_STORE.md).
8. When ready and permitted by your merchant account, create/copy the live Drop product, use the live API key and a separately configured production Worker, align the final price/device allowance everywhere, rebuild, and run the production gate.
9. Verify the full live purchase flow and refund/license-revocation procedure. Submit the correct production ZIP to the store. Change public preview/pending labels only after the corresponding service is working and publication is confirmed.

The repository and preview are useful now. `npm run verify:release` refusing the unconfigured preview is expected and prevents accidentally submitting an unpaid/test build as a live paid product.
