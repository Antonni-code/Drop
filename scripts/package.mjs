import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
const production = process.argv.includes('--production');
if (production) await import('./verify-release.mjs');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const info = JSON.parse(await readFile('dist/build-info.json', 'utf8'));
// Portable ZIP writer: includes only the already-built dist tree, never source or keys.
let crcTable;
function crc32(buf) {
  crcTable ??= Array.from({ length: 256 }, (_, i) => { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}
async function files(dir, prefix = '') { const output = []; for (const e of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) { if (e.isDirectory()) output.push(...await files(`${dir}/${e.name}`, `${prefix}${e.name}/`)); else if (e.isFile()) output.push({ path: `${prefix}${e.name}`, bytes: await readFile(`${dir}/${e.name}`) }); else throw Error('Unexpected build symlink'); } return output; }
const entries = await files('dist'), locals = [], centrals = []; let offset = 0;
for (const { path, bytes } of entries) {
  const name = Buffer.from(path), compressed = deflateRawSync(bytes, { level: 9 }), crc = crc32(bytes);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  locals.push(local, name, compressed); centrals.push(central, name); offset += local.length + name.length + compressed.length;
}
const centralBytes = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...locals, centralBytes, end]);
await mkdir('release', { recursive: true }); const filename = `release/drop-v${manifest.version}-${production ? 'production' : 'preview'}.zip`;
await writeFile(filename, archive); await writeFile(`${filename}.sha256`, `${createHash('sha256').update(archive).digest('hex')}  ${filename.split('/').at(-1)}\n`);
console.log(`${filename}: ${entries.length} files, ${archive.length} bytes, ${info.configured ? info.mode : 'Free preview with checkout disabled'}.`);
