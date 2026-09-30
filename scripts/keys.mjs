import { mkdir, writeFile } from 'node:fs/promises';
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
await mkdir('keys', { recursive: true, mode: 0o700 });
await writeFile('keys/receipt.private.json', JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey), null, 2), { mode: 0o600, flag: 'wx' });
await writeFile('keys/receipt.public.json', JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey), null, 2), { mode: 0o644, flag: 'wx' });
console.log('Created keys/receipt.private.json and keys/receipt.public.json. Existing keys are never overwritten. Keep the private file only in your secret store and Cloudflare.');
