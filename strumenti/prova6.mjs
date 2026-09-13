import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n, e ? '· ' + e : ''); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
page.on('dialog', async d => { errori.push('DIALOG INATTESO: ' + d.message); await d.dismiss(); });
for (const p of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await page.route(p, r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n')[0]); } };
const txt = s => page.textContent(s);

await T('nomi di carta con virgolette', async () => {
  await page.click('[data-v="carte"]'); await page.waitForTimeout(250);
  await page.fill('[data-q="qCarte"]', '"A" Cell'); await page.waitForTimeout(400);
  const n = (await page.$$('.carta')).length;
  ok('trova le carte con le virgolette nel nome', n > 0, n + ' carte');
  const nome = await page.textContent('.carta .n');
  ok('il nome è reso per intero', nome.includes('"A"'), nome);
  await page.click('.carta .tocca'); await page.waitForSelector('.velo');
  ok('la scheda si apre e mostra il nome', (await txt('.scheda h3')).includes('"A"'), await txt('.scheda h3'));
  ok('la scheda elenca la busta', (await txt('.scheda')).includes('Busta di'));
  await page.click('.chiudi');
});

await T('luoghi con barra e trattini nel nome', async () => {
  await page.click('[data-v="buste"]'); await page.waitForTimeout(250);
  await page.fill('[data-q="q"]', 'Leo'); await page.waitForTimeout(400);
  ok('la busta Leo/Luna è in elenco', (await txt('#corpo')).includes('Leo/Luna'));
  await page.click('.duel'); await page.waitForSelector('.testa');
  ok('si apre con il nome giusto', (await txt('.titolo')).includes('Leo/Luna'), await txt('.titolo'));
  ok('ha le sue carte', (await page.$$('.carta')).length > 0);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
});

await T('nome di mazzo ostile', async () => {
  const CATTIVO = '<img src=x onerror="window.__bucato=1"> "virgolette" & <b>grassetto</b>';
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(250);
  await page.click('[data-nuovo]'); await page.waitForTimeout(250);
  await page.fill('#nm', CATTIVO);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(350);
  ok('nessuno script eseguito', await page.evaluate(() => window.__bucato) === undefined);
  const barra = await txt('.epoca-barra .val');
  ok('il nome compare come testo nella barra', barra.includes('<img src=x'), barra.slice(0, 60));
  ok('nessun tag iniettato nel DOM', await page.evaluate(() =>
    !document.querySelector('.epoca-barra img, .epoca-barra b, .titolo img, .titolo b')));
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  ok('il nome si vede intero nel campo', (await page.inputValue('#nomeMazzo')) === CATTIVO);
  await page.click('[data-az="esporta"]'); await page.waitForTimeout(250);
  ok('l\'esportazione lo riporta come testo', (await page.inputValue('#esp')).includes(CATTIVO));
});

await T('testo cercato con caratteri speciali', async () => {
  while (!(await page.$('[data-v="carte"]'))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(250); }
  await page.click('[data-v="carte"]'); await page.waitForTimeout(250);
  for (const q of ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "O'Brien & sons", '</script>']) {
    await page.fill('[data-q="qCarte"]', q); await page.waitForTimeout(300);
    ok('regge: ' + q.slice(0, 26), await page.evaluate(() => !window.__bucato) &&
       !!(await page.$('#corpo')));
  }
  await page.fill('[data-q="qCarte"]', ''); await page.waitForTimeout(300);
});

await T('il blocco dati non chiude il tag script', async () => {
  const pulito = await page.evaluate(() => {
    const t = document.getElementById('indice').textContent;
    return !/<\/script/i.test(t) && !/<script/i.test(t) && JSON.parse(t).carte.length > 10000;
  });
  ok('indice incorporato integro e senza sequenze pericolose', pulito);
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 6).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
