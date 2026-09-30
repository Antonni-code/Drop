import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const errors = [];
const requireCondition = (value, message) => { if (!value) errors.push(message); };
let config;
try { config = JSON.parse(await readFile('extension.config.local.json', 'utf8')); }
catch { console.error('Production release blocked: create extension.config.local.json using docs/CREEM_CLOUDFLARE.md.'); process.exit(1); }
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const info = JSON.parse(await readFile('dist/build-info.json', 'utf8'));
requireCondition(config.mode === 'prod' && info.mode === 'prod' && info.configured, 'Use matching, configured production builds.');
requireCondition(/^prod_[A-Za-z0-9]+$/.test(config.productId), 'Set the real Drop Creem product ID.');
try { const u = new URL(config.apiBase); requireCondition(u.protocol === 'https:' && u.origin === config.apiBase && !/example|placeholder|replace/i.test(u.hostname), 'Set the real Worker HTTPS origin.'); } catch { errors.push('Set the real Worker HTTPS origin.'); }
try { const u = new URL(config.checkoutUrl); requireCondition(u.protocol === 'https:' && ['creem.io', 'www.creem.io'].includes(u.hostname) && u.pathname.startsWith('/payment/') && u.pathname.length > 9, 'Set the real production Creem checkout link.'); } catch { errors.push('Set the real production Creem checkout link.'); }
const publicJwk = config.publicJwk;
requireCondition(publicJwk && publicJwk.kty === 'EC' && publicJwk.crv === 'P-256' && publicJwk.x && publicJwk.y && !publicJwk.d, 'Only a valid public P-256 verification key belongs in the extension.');
try { await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); } catch { errors.push('Public verification key is invalid.'); }
const merged = { ...JSON.parse(await readFile('extension.config.example.json', 'utf8')), ...config };
const configHash = createHash('sha256').update(JSON.stringify(merged)).digest('hex');
requireCondition(info.configHash === configHash, 'The build is stale. Run npm run build after changing configuration.');
requireCondition(JSON.stringify(manifest.host_permissions) === JSON.stringify([`${config.apiBase}/*`]), 'Only the exact license service origin may receive host permission.');
requireCondition(!manifest.content_scripts && !manifest.web_accessible_resources && !manifest.permissions.includes('clipboardRead'), 'Unexpected broad extension access.');
requireCondition(manifest.permissions.every(p => ['storage', 'clipboardWrite', 'contextMenus', 'activeTab', 'scripting', 'alarms'].includes(p)), 'Unexpected extension permission.');
for (const name of await readdir('dist')) {
  if (!/\.(js|json|html)$/.test(name)) continue;
  const text = await readFile(`dist/${name}`, 'utf8');
  requireCondition(!/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----|creem_(?:test|live)_[A-Za-z0-9]{12,}|"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/.test(text), `Possible secret in ${name}.`);
}
if (errors.length) { console.error('Production release blocked:\n' + errors.map(x => `- ${x}`).join('\n')); process.exit(1); }
console.log('Static production gate passed. Finish native Chrome and Creem smoke tests in docs/RELEASE.md before publishing.');
