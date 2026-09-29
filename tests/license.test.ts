import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../worker/src/index";
import { signReceipt, verifyReceipt, RECEIPT_TTL, type Claims } from "../src/core/receipt";
import type { ProductConfig } from "../src/config";

let privateJwk: JsonWebKey, config: ProductConfig, env: Env;
const ext = "a".repeat(32), deviceId = "device-12345678", instanceId = "instance-12345678";
const now = () => Math.floor(Date.now() / 1000);
const claims = (): Claims => ({ v: 1, iss: "drop-license-api", aud: "drop", productId: "prod_drop", mode: "test", deviceId, instanceId, iat: now(), exp: now() + RECEIPT_TTL });
const provider = (changes: Record<string, unknown> = {}) => ({ product_id: "prod_drop", mode: "test", status: "active", expires_at: null, instance: { id: instanceId, mode: "test", status: "active" }, ...changes });
const request = (action = "validate", body: unknown = { key: "TEST-KEY", deviceId, instanceId }, origin = `chrome-extension://${ext}`) => new Request(`https://drop.example/v1/${action}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  privateJwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
  config = { apiBase: "https://drop.example", productId: "prod_drop", mode: "test", publicJwk: await crypto.subtle.exportKey("jwk", keys.publicKey), checkoutUrl: "", price: "$5.99" };
  env = { CREEM_API_KEY: "secret-test-only", CREEM_PRODUCT_ID: "prod_drop", CREEM_MODE: "test", RECEIPT_PRIVATE_JWK: JSON.stringify(privateJwk), ALLOWED_EXTENSION_IDS: ext, RATE_LIMITER: { limit: async () => ({ success: true }) } };
});
afterEach(() => vi.unstubAllGlobals());
describe("license boundary", () => {
  it("verifies signatures and rejects forgery, expiry and wrong bindings", async () => {
    const token = await signReceipt(claims(), privateJwk);
    expect(await verifyReceipt(token, config, deviceId, instanceId)).not.toBeNull();
    const pieces = token.split("."); pieces[1] = btoa(JSON.stringify({ ...claims(), productId: "other" })).replace(/=/g, "");
    expect(await verifyReceipt(pieces.join("."), config, deviceId, instanceId)).toBeNull();
    expect(await verifyReceipt(token, config, "another-device", instanceId)).toBeNull();
    expect(await verifyReceipt(token, config, deviceId, "another-instance")).toBeNull();
    expect(await verifyReceipt(token, { ...config, productId: "prod_other" }, deviceId, instanceId)).toBeNull();
    expect(await verifyReceipt(token, { ...config, mode: "prod" }, deviceId, instanceId)).toBeNull();
    expect(await verifyReceipt(token, config, deviceId, instanceId, now() + RECEIPT_TTL + 1)).toBeNull();
  });
  it("rejects receipts beyond the offline window and future issuance", async () => {
    const long = await signReceipt({ ...claims(), exp: now() + RECEIPT_TTL + 60 }, privateJwk);
    expect(await verifyReceipt(long, config, deviceId, instanceId)).toBeNull();
    const future = await signReceipt({ ...claims(), iat: now() + 500 }, privateJwk);
    expect(await verifyReceipt(future, config, deviceId, instanceId)).toBeNull();
  });
  it("uses the test provider and signs only a verified matching instance", async () => {
    const fetcher = vi.fn(async (_url: string) => Response.json(provider())); vi.stubGlobal("fetch", fetcher);
    const response = await worker.fetch(request(), env);
    const result = await response.json() as { receipt: string };
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://test-api.creem.io/v1/licenses/validate");
    expect(await verifyReceipt(result.receipt, config, deviceId, instanceId)).not.toBeNull();
  });
  it("rejects wrong product, mode, inactive and expired licenses", async () => {
    for (const patch of [{ product_id: "prod_other" }, { mode: "prod" }, { status: "disabled" }, { expires_at: "2000-01-01" }]) {
      vi.stubGlobal("fetch", async () => Response.json(provider(patch)));
      expect((await worker.fetch(request(), env)).status).toBe(403);
    }
  });
  it("rejects instance mismatch and malformed expiry", async () => {
    for (const patch of [{ instance: { id: "another-instance", mode: "test", status: "active" } }, { expires_at: "invalid" }]) {
      vi.stubGlobal("fetch", async () => Response.json(provider(patch)));
      expect((await worker.fetch(request(), env)).status).toBe(403);
    }
  });
  it("rejects untrusted origins and oversized bodies before calling Creem", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await worker.fetch(request("activate", undefined, "https://evil.example"), env)).status).toBe(403);
    expect((await worker.fetch(request("activate", { key: "x".repeat(5000) }), env)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed without rate limiting and never exposes provider secrets", async () => {
    const fetcher = vi.fn(async () => new Response("secret-test-only", { status: 500 })); vi.stubGlobal("fetch", fetcher);
    const blocked = await worker.fetch(request(), { ...env, RATE_LIMITER: undefined } as unknown as Env);
    expect(blocked.status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret-test-only");
    const limited = await worker.fetch(request(), { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } });
    expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("60");
  });
  it("caps the receipt at the provider expiry", async () => {
    const expiration = now() + 1000;
    vi.stubGlobal("fetch", async () => Response.json(provider({ expires_at: new Date(expiration * 1000).toISOString() })));
    const result = await (await worker.fetch(request(), env)).json() as { receipt: string };
    expect((await verifyReceipt(result.receipt, config, deviceId, instanceId))?.exp).toBe(expiration);
  });
});
