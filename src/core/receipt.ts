import type { ProductConfig } from "../config";

export const RECEIPT_TTL = 72 * 60 * 60;
export interface Claims {
  v: 1; iss: "drop-license-api"; aud: "drop"; productId: string; mode: "test" | "prod";
  deviceId: string; instanceId: string; iat: number; exp: number;
}
export function base64url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unbase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid receipt encoding");
  const decoded = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0));
  if (base64url(decoded) !== value) throw new Error("Non-canonical encoding");
  return decoded;
}
export async function signReceipt(claims: Claims, privateJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const body = `${encode({ alg: "ES256", typ: "JWT" })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyReceipt(token: string, config: ProductConfig, deviceId: string, instanceId: string, now = Math.floor(Date.now() / 1000)): Promise<Claims | null> {
  try {
    if (!config.publicJwk || token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts as [string, string, string];
    const head = JSON.parse(new TextDecoder().decode(unbase64url(header)));
    if (head.alg !== "ES256" || head.typ !== "JWT") return null;
    const key = await crypto.subtle.importKey("jwk", config.publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unbase64url(signature), new TextEncoder().encode(`${header}.${payload}`))) return null;
    const data = JSON.parse(new TextDecoder().decode(unbase64url(payload))) as Claims;
    if (data.v !== 1 || data.iss !== "drop-license-api" || data.aud !== "drop" || data.productId !== config.productId || data.mode !== config.mode || data.deviceId !== deviceId || data.instanceId !== instanceId) return null;
    if (!Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp) || data.iat > now + 60 || data.exp <= now || data.exp <= data.iat || data.exp - data.iat > RECEIPT_TTL) return null;
    return data;
  } catch { return null; }
}
