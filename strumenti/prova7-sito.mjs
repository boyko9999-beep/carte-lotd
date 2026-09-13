import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n, e ? '· ' + e : ''); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
for (const p of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await page.route(p, r => r.abort());

console.log('— la radice del sito apre l\'app');
const t0 = Date.now();
await page.goto('http://127.0.0.1:8899/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel', { timeout: 15000 });
ok('dalla radice si arriva all\'app', true, (Date.now() - t0) + ' ms');
ok('è davvero la versione nuova', (await page.textContent('.conta')) === '10.026 carte', await page.textContent('.conta'));
ok('c\'è la barra dell\'epoca', !!(await page.$('.epoca-barra')));
ok('l\'indirizzo è quello dell\'app', page.url().endsWith('/lotd-duellanti.html'), page.url());

console.log('\n— senza JavaScript funziona lo stesso');
const ctx2 = await browser.newContext({ javaScriptEnabled: false });
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:8899/', { waitUntil: 'load' });
await p2.waitForTimeout(1500);
ok('il meta refresh porta comunque all\'app', p2.url().endsWith('/lotd-duellanti.html'), p2.url());

console.log('\n— il vecchio indirizzo continua a funzionare');
const p3 = await (await browser.newContext()).newPage();
for (const r of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await p3.route(r, x => x.abort());
await p3.goto('http://127.0.0.1:8899/lotd-duellanti.html', { waitUntil: 'domcontentloaded' });
await p3.waitForSelector('.duel');
ok('link diretto al file: nessun rimbalzo', p3.url().endsWith('/lotd-duellanti.html'));

console.log('\nerrori JS: ' + errori.length);
errori.slice(0,4).forEach(e => console.log('   ' + e));
console.log(`PASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
