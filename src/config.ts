export interface ProductConfig {
  apiBase: string; productId: string; mode: "test" | "prod";
  publicJwk: JsonWebKey | null; checkoutUrl: string; price: string;
}
declare const __DROP_CONFIG__: ProductConfig;
export const config: ProductConfig = typeof __DROP_CONFIG__ === "undefined"
  ? { apiBase: "", productId: "", mode: "test", publicJwk: null, checkoutUrl: "", price: "$5.99" }
  : __DROP_CONFIG__;
export const WEBSITE = "https://antonni-code.dev/drop";
export function paymentsConfigured(): boolean {
  return /^https:\/\//.test(config.apiBase) && /^prod_/.test(config.productId) && !!config.publicJwk;
}
export function checkoutConfigured(): boolean {
  try { const url = new URL(config.checkoutUrl); return paymentsConfigured() && url.protocol === "https:" && ["www.creem.io", "creem.io"].includes(url.hostname) && url.pathname.startsWith(config.mode === "test" ? "/test/payment/" : "/payment/"); }
  catch { return false; }
}
