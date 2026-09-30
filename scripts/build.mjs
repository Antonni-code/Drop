import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { build } from "esbuild";
import sharp from "sharp";
import { createHash } from "node:crypto";

let config = JSON.parse(await readFile("extension.config.example.json", "utf8"));
try { config = { ...config, ...JSON.parse(await readFile("extension.config.local.json", "utf8")) }; } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!["test", "prod"].includes(config.mode) || typeof config.price !== "string") throw new Error("Invalid build configuration");
if (config.publicJwk?.d || config.privateJwk || config.apiKey) throw new Error("Secrets must never enter the extension config");
if (config.apiBase) { const url = new URL(config.apiBase); if (url.protocol !== "https:" || url.origin !== config.apiBase) throw new Error("apiBase must be an HTTPS origin with no path or trailing slash"); }
const allowed = ["apiBase", "productId", "mode", "publicJwk", "checkoutUrl", "price"];
if (Object.keys(config).some(key => !allowed.includes(key))) throw new Error("Unexpected extension config key");
await rm("dist", { recursive: true, force: true }); await mkdir("dist/icons", { recursive: true });
await build({ entryPoints: { background: "src/background.ts", popup: "src/ui/main.ts" }, outdir: "dist", bundle: true, minify: true, format: "esm", target: "chrome128", define: { __DROP_CONFIG__: JSON.stringify(config) }, legalComments: "none" });
await Promise.all([cp("src/ui/shell.html", "dist/popup.html"), cp("src/ui/shell.html", "dist/library.html"), cp("src/ui/style.css", "dist/style.css"), cp("public/mark.svg", "dist/mark.svg")]);
for (const size of [16, 32, 48, 128]) await sharp("public/mark.svg").resize(size, size).png().toFile(`dist/icons/${size}.png`);
const manifest = { manifest_version: 3, name: "Drop — Your clipboard shelf", version: "0.1.0", minimum_chrome_version: "128", description: "Save the text, links and code you reach for. A small, private clipboard shelf.", homepage_url: "https://antonni-code.dev/drop", action: { default_popup: "popup.html", default_title: "Open Drop", default_icon: { "16": "icons/16.png", "32": "icons/32.png" } }, icons: { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }, background: { service_worker: "background.js", type: "module" }, options_ui: { page: "library.html", open_in_tab: true }, permissions: ["storage", "clipboardWrite", "contextMenus", "activeTab", "scripting", "alarms"], ...(config.apiBase ? { host_permissions: [`${config.apiBase}/*`] } : {}), commands: { _execute_action: { suggested_key: { default: "Alt+Shift+D" }, description: "Open Drop" }, "quick-paste": { suggested_key: { default: "Alt+Shift+V" }, description: "Choose a clip to paste" } }, incognito: "not_allowed", content_security_policy: { extension_pages: `script-src 'self'; object-src 'none'; connect-src 'self'${config.apiBase ? ` ${config.apiBase}` : ""}; base-uri 'none'; frame-src 'none'` } };
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
await writeFile("dist/build-info.json", JSON.stringify({ version: manifest.version, mode: config.mode, configHash: createHash("sha256").update(JSON.stringify(config)).digest("hex"), configured: !!config.apiBase && !!config.productId && !!config.publicJwk, checkoutConfigured: !!config.checkoutUrl }, null, 2));
console.log(`Built Drop ${manifest.version} (${config.apiBase ? config.mode : "free preview"}).`);
