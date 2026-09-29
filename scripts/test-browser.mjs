// Real browser DOM and clipboard; extension APIs are an explicit test adapter.
// This does not replace the native MV3 smoke checklist in docs/TESTING.md.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '@axe-core/playwright');
await mkdir('.test-build', { recursive: true });
await build({ stdin: { contents: 'export * from "./src/core/model.ts"; export * from "./src/core/library.ts"; export * from "./src/core/organization.ts"; export * from "./src/platform/paste.ts";', resolveDir: process.cwd() }, outfile: '.test-build/domain.mjs', bundle: true, platform: 'node', format: 'esm' });
const { emptyState, applyBasic, applyOrganization, exportLibrary, pasteIntoFocusedField } = await import(pathToFileURL(resolve('.test-build/domain.mjs')));
let state = emptyState(), pro = false, count = 0;
const snapshot = () => ({ state, pro, licenseStatus: pro ? 'Pro active' : 'Free plan', canActivate: false, canCheckout: false });
const adapter = async ({ action, data = {} }) => {
  try {
    if (action === 'snapshot') return { ok: true, data: snapshot() };
    if (action === 'notice') return { ok: true, data: {} };
    if (action === 'export') { if (!pro) throw Error('Pro required'); return { ok: true, data: exportLibrary(state) }; }
    if (action === 'recovery') return { ok: true, data: JSON.stringify(state) };
    if (action.startsWith('license.') || action === 'checkout') throw Error('Not configured');
    if (['pin', 'move', 'collection.save', 'collection.delete', 'import'].includes(action)) state = applyOrganization(state, action, data, pro);
    else state = applyBasic(state, action, data, pro);
    return { ok: true, data: snapshot() };
  } catch (e) { return { ok: false, error: { code: e.code || 'error', message: e.message } }; }
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const names = new Set(['popup.html', 'library.html', 'popup.js', 'style.css', 'mark.svg']);
  const name = pathname.slice(1);
  if (!names.has(name)) { res.writeHead(404).end(); return; }
  try { const content = await readFile(`dist/${name}`); res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript'); res.end(content); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const address = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox'] });
const context = await browser.newContext({ viewport: { width: 404, height: 594 }, deviceScaleFactor: 2, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.exposeFunction('__fixtureCommand', adapter);
await page.addInitScript(() => { window.chrome = { runtime: { sendMessage: input => window.__fixtureCommand(input) }, storage: { onChanged: { addListener() {} } } }; });
const check = (label, condition = true) => { assert.ok(condition, label); count++; console.log(`✓ ${label}`); };
const open = async () => { await page.goto(`${address}/popup.html`); await page.locator('#list[aria-busy="false"]').waitFor(); };
const save = async (text, title) => { await page.locator('#new-clip').click(); await page.locator('#clip-content').fill(text); if (title) await page.locator('#clip-title').fill(title); if (text === 'npm run build') await page.locator('#clip-kind').selectOption('code'); await page.getByRole('button', { name: 'Save clip', exact: true }).click(); };
const close = async () => { if (await page.locator('dialog[open]').count()) await page.getByRole('button', { name: 'Close dialog' }).click(); };
const axe = async label => { const result = await new AxeBuilder({ page }).analyze(); assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], label); check(label); };
try {
  await open(); check('empty shelf explains first save', await page.getByText('Good things, within reach.').isVisible());
  await page.screenshot({ path: '.test-build/empty.png' });
  await save('Thanks for reaching out. I’ll get back to you shortly.'); await page.locator('dialog').waitFor({ state: 'hidden' }); check('save creates a real domain record', state.clips.length === 1);
  await open(); check('saved clip survives interface reload', await page.locator('.clip-row').count() === 1);
  await page.locator('.clip-main').click(); check('copy writes the real clipboard', await page.evaluate(() => navigator.clipboard.readText()) === state.clips[0].content);
  await save('https://antonni-code.dev'); await save('npm run build');
  await page.locator('#search').fill('antonni'); check('search narrows saved clips', await page.locator('.clip-row').count() === 1); await page.locator('#search').fill('');
  await open(); await page.screenshot({ path: '.test-build/shelf.png' });
  await save('<img src=x onerror="window.dropInjected=true">'); await page.locator('dialog').waitFor({ state: 'hidden' }); check('untrusted markup stays inert text', await page.locator('.clip-list img').count() === 0 && !await page.evaluate(() => window.dropInjected));
  await save('A fifth useful thing'); await page.locator('dialog').waitFor({ state: 'hidden' });
  await save('This would be six'); await page.getByRole('alert').filter({ hasText: 'five free spaces' }).waitFor(); check('free limit enforced without losing the draft', state.clips.length === 5 && await page.locator('#clip-content').inputValue() === 'This would be six'); await close();
  await save('A fifth useful thing'); await page.getByRole('alert').filter({ hasText: 'already' }).waitFor(); check('duplicate clips rejected'); await close();
  await page.locator('[data-edit]').first().click(); await page.getByRole('button', { name: 'Delete', exact: true }).click(); check('delete removes only the chosen clip', state.clips.length === 4); await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.clip-row').length === 5); check('undo restores the deleted clip', state.clips.length === 5);
  await axe('free shelf has no automated accessibility violations');
  await page.locator('#pro').click(); check('unconfigured checkout cannot charge', await page.locator('#checkout').isDisabled()); await axe('Pro sheet has no automated accessibility violations'); await page.screenshot({ path: '.test-build/paywall.png' }); await close();
  pro = true; await open(); await save('A sixth useful thing', 'My intro'); await page.locator('dialog').waitFor({ state: 'hidden' }); check('Pro saves beyond five with a custom title', state.clips.length === 6 && state.clips[0].title === 'My intro');
  await page.getByRole('button', { name: 'New collection', exact: true }).click(); await page.locator('#collection-name').fill('Work'); await page.getByRole('button', { name: 'green', exact: true }).click(); await page.getByRole('button', { name: 'work', exact: true }).click(); await page.getByRole('button', { name: 'Create collection', exact: true }).click(); await page.locator('dialog').waitFor({ state: 'hidden' }); check('collection appearance is saved', state.collections[0].color === 'green' && state.collections[0].icon === 'work');
  await page.locator('[data-edit]').first().click(); await page.locator('#clip-collection').selectOption(state.collections[0].id); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.locator('dialog').waitFor({ state: 'hidden' });
  await page.locator('[data-pin]').first().click(); await page.getByRole('button', { name: 'Favorites', exact: true }).click(); check('favorites filter the shelf', await page.locator('.clip-row').count() === 1); await page.getByRole('button', { name: 'All clips', exact: true }).click();
  await page.getByRole('button', { name: 'Work', exact: true }).click(); check('collection filter shows assigned clips', await page.locator('.clip-row').count() === 1); await page.getByRole('button', { name: 'All clips', exact: true }).click();
  await page.locator('#filters-button').click(); await page.locator('#sort').selectOption('manual'); const moved = state.clips[1].id; await page.locator('[data-edit]').nth(1).click(); await page.getByRole('button', { name: 'Move up', exact: true }).click(); await page.locator('dialog').waitFor({ state: 'hidden' }); check('manual ordering changes stable item order', state.clips[0].id === moved);
  await page.locator('#filters-button').click(); await page.screenshot({ path: '.test-build/pro.png' });
  await page.locator('#settings').click(); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); const downloaded = await downloadPromise; const backup = JSON.parse(await readFile(await downloaded.path(), 'utf8')); check('JSON export contains the saved library', backup.app === 'drop' && backup.library.clips.length === 6); await close();
  pro = false; await open(); check('downgrade preserves every existing clip', state.clips.length === 6 && await page.locator('.clip-row').count() === 6); await page.locator('.clip-main').first().click(); check('downgrade still allows clipboard copy', (await page.evaluate(() => navigator.clipboard.readText())).length > 0);
  await page.setContent('<input id="plain" value="Hello world"><input id="password" type="password"><input id="readonly" readonly><input id="payment" autocomplete="cc-number"><div id="editor" contenteditable="true">Hello </div>');
  await page.locator('#plain').focus(); await page.locator('#plain').evaluate(el => el.setSelectionRange(6, 11)); const result = await page.evaluate(pasteIntoFocusedField, 'Drop'); check('Quick Paste replaces the selected text', result.ok && await page.locator('#plain').inputValue() === 'Hello Drop');
  for (const field of ['password', 'readonly', 'payment']) { await page.locator(`#${field}`).focus(); assert.equal((await page.evaluate(pasteIntoFocusedField, 'secret')).ok, false); } check('Quick Paste refuses password, readonly and payment fields');
  await page.locator('#editor').focus(); await page.locator('#editor').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }); const pasted = await page.evaluate(pasteIntoFocusedField, '<b>Plain text</b>'); check('contenteditable insertion stays plain text', pasted.ok && await page.locator('#editor b').count() === 0);
  check('no uncaught interface errors', errors.length === 0);
  console.log(`\n${count} browser checks passed. Extension APIs were simulated; native MV3 and live billing still need smoke tests.`);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
