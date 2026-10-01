# Creem and Cloudflare setup

The code is implemented; these are account configuration steps. Keep test and production products, keys, Worker configuration and extension build mode aligned. Never use Later/Peek credentials as Drop product configuration.

## 1. Create the test product

In Creem test mode create **Drop Pro** as a one-time software purchase. Proposed price: **US$2.99**. Description: “A private clipboard shelf with more room for clips, collections, favorites, custom names, JSON backups and Quick Paste in supported web fields.” Enable license-key delivery, choose and disclose the activation allowance (one browser installation is a simple initial choice), and verify receipt/key delivery. No recurring billing is required.

Copy the exact Drop product ID, test API key and hosted test payment link from your dashboard. Do not paste the API key into the extension config or public repository. Product URL: https://antonni-code.dev/drop. Privacy: https://antonni-code.dev/drop/privacy. Terms: https://antonni-code.dev/drop/terms.

The current supported hosted payment links are HTTPS `creem.io` / `www.creem.io` paths under `/test/payment/` in test mode or `/payment/` in production. If your dashboard uses a different current Creem link format, update and verify the narrow allowlist before enabling checkout; do not substitute a guessed URL.

## 2. Signing keys and Worker

```sh
npm ci
npm run keys:generate
npx wrangler login
```

The generator writes `keys/receipt.private.json` and `keys/receipt.public.json` without overwriting existing keys. `keys/` is ignored by Git. Back up the private key in your secret store. Upload only the private key to Cloudflare, never to a public repo, extension or portfolio.

Edit `worker/wrangler.jsonc`:

| Field | Set to |
| --- | --- |
| name | Unique test Worker name, e.g. drop-license-api-test |
| CREEM_MODE | test |
| CREEM_PRODUCT_ID | Actual test Drop product ID |
| ALLOWED_EXTENSION_IDS | Exact 32-character extension ID(s), comma-separated, no wildcards |
| RATE_LIMITER | Keep the binding; choose a unique namespace in your Cloudflare account |

Load the preview in Chrome and copy the ID shown at `chrome://extensions`. An unpacked ID can change with installation/build path. A store release needs the stable store ID; update the allowlist and test the installed build with it before launch.

```sh
npx wrangler secret put CREEM_API_KEY --config worker/wrangler.jsonc
npx wrangler secret put RECEIPT_PRIVATE_JWK --config worker/wrangler.jsonc < keys/receipt.private.json
npm run worker:deploy
```

Enter the test key at the first prompt. Use the actual HTTPS Worker origin printed after deploy. The Worker `/health` response only proves that the service responds; it does not prove licensing is configured or purchases work.

## 3. Configure the extension

Copy `extension.config.example.json` to the ignored `extension.config.local.json`. Fill all six fields:

```json
{
  "apiBase": "https://YOUR-ACTUAL-WORKER-ORIGIN",
  "productId": "YOUR-ACTUAL-DROP-PRODUCT-ID",
  "mode": "test",
  "publicJwk": { "kty": "EC", "crv": "P-256", "x": "COPY_PUBLIC_X", "y": "COPY_PUBLIC_Y", "ext": true, "key_ops": ["verify"] },
  "checkoutUrl": "YOUR-ACTUAL-CREEM-TEST-PAYMENT-LINK",
  "price": "$2.99"
}
```

Paste the **complete public** object from `keys/receipt.public.json` in `publicJwk`. It must never contain `d` (the private part). Use actual values in the other fields; the example placeholders intentionally cannot pass release validation.

```sh
npm run check
```

Reload the unpacked extension. Open Get Pro, complete a Creem **test** checkout, confirm key delivery, then activate the key inside Drop. A checkout success page alone does not unlock anything. Test sixth-save, all Pro tools, release/reactivate, offline expiry, wrong-product key and disabled/refunded license. Keep real keys out of screenshots and logs.

## 4. Live launch

Use a separate production Worker configuration/secrets and live Drop product/key. Set both Worker `CREEM_MODE` and extension `mode` to `prod`; use the live product ID, live checkout URL and matching public verification key. Run `npm run check`, `npm run verify:release`, and `node scripts/package.mjs --production`.

Before claiming a launch, verify actual native extension, live delivery/activation, invalid license, device allowance, support and refunds. Update the portfolio preview/pending labels and final price only when they are true. Creem account approval and Chrome publication are external decisions.

Creem expects a functioning live product, visible pricing/legal pages and reachable matching support. Set up and verify a branded support address, replace the interim Gmail address in the extension/website, and align Creem receipts/business details. A landing page alone does not make the paid product ready or guarantee account approval.

## Refunds and activation recovery

When refunding, also disable the matching Creem license and verify that validate stops issuing receipts. Offline receipts may last up to 72 hours. There is no automatic refund webhook in V0.

An activation timeout can have succeeded remotely. Locate and release the unconfirmed Drop browser instance in Creem, confirm that with the customer, then use **Reset after support** in the extension and type RELEASED. Do not tell a customer to retry blindly or delete their clips/profile to fix a license.

## Official references

- https://docs.creem.io/api-reference/endpoint/activate-license
- https://docs.creem.io/api-reference/endpoint/validate-license
- https://docs.creem.io/api-reference/endpoint/deactivate-license
- https://docs.creem.io/merchant-of-record/account-reviews/account-reviews
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/workers/configuration/secrets/

Provider APIs and review requirements can change. Confirm actual test responses and dashboard fields during setup.
