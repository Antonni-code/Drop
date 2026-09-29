import { boundedJson } from "../../src/core/bounded-json";
import { base64url, RECEIPT_TTL, signReceipt } from "../../src/core/receipt";

export interface Env {
  CREEM_API_KEY: string; CREEM_PRODUCT_ID: string; CREEM_MODE: "test" | "prod";
  RECEIPT_PRIVATE_JWK: string; ALLOWED_EXTENSION_IDS: string;
  RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new ServiceError(status, code, message); };
function value(input: unknown, label: string, max = 200): string {
  if (typeof input !== "string" || !input.trim() || input.length > max || /[\u0000-\u001f]/.test(input)) return fail(400, "invalid", `Invalid ${label}.`);
  return input;
}
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(400, "invalid", "Invalid request.");
  return input as Record<string, unknown>;
}
async function throttle(env: Env, key: string): Promise<void> {
  if (!env.RATE_LIMITER) fail(503, "unavailable", "License checks are temporarily unavailable.");
  if (!(await env.RATE_LIMITER.limit({ key })).success) fail(429, "rate", "Too many attempts. Wait a minute and try again.");
}
async function handle(request: Request, env: Env): Promise<Response> {
  let origin = "";
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin",
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Drop-Extension" } : {}),
    ...(status === 429 ? { "Retry-After": "60" } : {})
  } });
  try {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") return reply({ service: "drop-license-api", version: 1 });
    if (!/^\/v1\/(activate|validate|deactivate)$/.test(path)) fail(404, "missing", "Unknown endpoint.");
    const allowed = (env.ALLOWED_EXTENSION_IDS ?? "").split(",").map(x => x.trim()).filter(x => /^[a-p]{32}$/.test(x));
    const incomingOrigin = request.headers.get("Origin");
    const extensionId = incomingOrigin?.startsWith("chrome-extension://") ? incomingOrigin.slice(19) : request.headers.get("X-Drop-Extension");
    if (!extensionId || !allowed.includes(extensionId) || (incomingOrigin && incomingOrigin !== `chrome-extension://${extensionId}`)) fail(403, "origin", "This build is not enabled for licenses.");
    if (incomingOrigin) origin = incomingOrigin;
    if (request.method === "OPTIONS") return reply({ ok: true });
    if (request.method !== "POST") fail(405, "method", "Use POST.");
    if (!env.CREEM_API_KEY || !env.RECEIPT_PRIVATE_JWK || !/^prod_[A-Za-z0-9]+$/.test(env.CREEM_PRODUCT_ID) || !["test", "prod"].includes(env.CREEM_MODE)) fail(503, "setup", "License activation is not configured yet.");
    await throttle(env, `ip:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`);
    if (request.headers.get("Content-Type")?.split(";")[0]?.trim() !== "application/json") fail(415, "invalid", "Send JSON.");
    let body: Record<string, unknown>;
    try { body = record(await boundedJson(request, 4096)); } catch { return reply({ error: { code: "invalid", message: "Request is invalid or too large." } }, 400); }
    const key = value(body.key, "license key");
    const deviceId = value(body.deviceId, "device ID", 80);
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(deviceId)) fail(400, "invalid", "Invalid device ID.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    await throttle(env, `license:${base64url(new Uint8Array(digest))}`);
    const action = path.slice(4);
    const instanceId = action === "activate" ? null : value(body.instanceId, "instance ID", 100);
    let response: Response;
    try {
      response = await fetch(`https://${env.CREEM_MODE === "test" ? "test-api" : "api"}.creem.io/v1/licenses/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": env.CREEM_API_KEY },
        body: JSON.stringify(action === "activate" ? { key, instance_name: `Drop ${deviceId}` } : { key, instance_id: instanceId }),
        signal: AbortSignal.timeout(7000), redirect: "error"
      });
    } catch { return reply({ error: { code: action === "activate" ? "activation_unknown" : "unavailable", message: action === "activate" ? "Activation could not be confirmed. Contact support before trying again to avoid using another device slot." : "Could not reach the license service. Try again later." } }, 503); }
    if (!response.ok) {
      if ([400, 404, 422].includes(response.status)) fail(403, "license", "The license or device is not active. Check your key or contact support.");
      fail(response.status === 429 ? 429 : 503, "unavailable", "The license provider is temporarily unavailable. Try again later.");
    }
    let data: Record<string, unknown>;
    try { data = record(await boundedJson(response, 32768)); } catch { return reply({ error: { code: "provider", message: "The license response could not be verified. Contact support." } }, 502); }
    if (data.product_id !== env.CREEM_PRODUCT_ID || data.mode !== env.CREEM_MODE) fail(403, "license", "This key is not for this Drop build.");
    const instance = record(data.instance);
    if (instance.mode !== env.CREEM_MODE || (instanceId && instance.id !== instanceId)) fail(403, "license", "This license device could not be verified.");
    if (action === "deactivate") {
      if (instance.status !== "inactive") fail(502, "provider", "Device release could not be confirmed. Contact support.");
      return reply({ ok: true });
    }
    if (data.status !== "active" || instance.status !== "active") fail(403, "license", "This license is no longer active.");
    const now = Math.floor(Date.now() / 1000);
    let expires = now + RECEIPT_TTL;
    if (data.expires_at != null) {
      const end = typeof data.expires_at === "string" ? Date.parse(data.expires_at) / 1000 : NaN;
      if (!Number.isFinite(end) || end <= now) fail(403, "license", "This license has expired.");
      expires = Math.min(expires, Math.floor(end));
    }
    const verifiedInstance = value(instance.id, "instance", 100);
    const receipt = await signReceipt({ v: 1, iss: "drop-license-api", aud: "drop", productId: env.CREEM_PRODUCT_ID, mode: env.CREEM_MODE, deviceId, instanceId: verifiedInstance, iat: now, exp: expires }, JSON.parse(env.RECEIPT_PRIVATE_JWK));
    return reply({ receipt, instanceId: verifiedInstance });
  } catch (error) {
    const safe = error instanceof ServiceError ? error : new ServiceError(503, "unavailable", "License checks are temporarily unavailable.");
    return reply({ error: { code: safe.code, message: safe.message } }, safe.status);
  }
}
export default { fetch: handle };
