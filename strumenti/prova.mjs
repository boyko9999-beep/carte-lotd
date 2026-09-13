import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (nome, cond, extra='') => {
  if (cond) { passati++; console.log('  ✓', nome); }
  else { falliti++; console.log('  ✗', nome, extra); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
// blocca le immagini remote: qui non c'è rete verso la CDN
await page.route('**://images.ygoprodeck.com/**', r => r.abort());
await page.route('**://ms.yugipedia.com/**', r => r.abort());
await page.route('**://fonts.g*/**', r => r.abort());

await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel', { timeout: 15000 });

const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message); } };

await T('avvio', async () => {
  ok('titolo', (await page.textContent('.titolo')).includes('Legacy of the Duelist'));
  ok('conteggio totale 10.027', (await page.textContent('.conta')) === '10.027 carte',
     await page.textContent('.conta'));
  ok('barra epoca senza filtro', (await page.textContent('.epoca-barra .val')).includes('Tutto il gioco'));
  const buste = await page.$$('.duel');
  ok('33 duellanti in elenco', buste.length === 33, 'trovati ' + buste.length);
  ok('serie GX presente con Bastion',
     (await page.textContent('#corpo')).includes('Bastion Misawa'));
  const bastion = await page.$eval('#corpo', el => {
    const b = [...el.querySelectorAll('.duel')].find(x => x.textContent.includes('Bastion Misawa'));
    return b ? b.querySelector('small').textContent.trim() : null;
  });
  ok('busta di Bastion piena (bug risolto)', /^314 carte/.test(bastion || ''), bastion);
});

await T('filtro epoca: saga Duel Monsters (cumulativo)', async () => {
  await page.click('.epoca-barra');
  await page.waitForSelector('.epoca-pannello');
  await page.click('[data-saga="0"]');
  await page.waitForTimeout(120);
  const barra = await page.textContent('.epoca-barra .val');
  ok('etichetta "Fino a Duel Monsters"', barra.includes('Fino a Duel Monsters'), barra);
  ok('2.020 carte cumulate', barra.includes('2.020'), barra);
  const yugi = await page.$eval('#corpo', el => {
    const b = [...el.querySelectorAll('.duel')].find(x => x.querySelector('.nome').textContent === 'Yugi');
    return b.querySelector('small').textContent.trim();
  });
  ok('numero doppio "156 di 314" per Yugi', yugi.startsWith('156 di 314'), yugi);
  const primo = await page.$eval('#corpo .duel .nome', e => e.textContent);
  ok('serie DM ordinata per carte disponibili (Grandpa Muto primo)', primo === 'Grandpa Muto', primo);
  const playmaker = await page.$eval('#corpo', el => {
    const b = [...el.querySelectorAll('.duel')].find(x => x.querySelector('.nome').textContent === 'Playmaker');
    return b ? b.querySelector('small').textContent.trim() : null;
  });
  ok('Playmaker resta in elenco a 0', /^0 di 317/.test(playmaker || ''), playmaker);
  ok('invito a guardarle comunque', (playmaker||'').includes('tocca per vederle comunque'), playmaker);
});

await T('filtro epoca: saga GX include Duel Monsters', async () => {
  await page.click('[data-saga="1"]');
  await page.waitForTimeout(120);
  const barra = await page.textContent('.epoca-barra .val');
  ok('barra compatta "Fino a GX"', barra.includes('Fino a GX'), barra);
  const titolo = await page.textContent('.epoca-pannello h3');
  ok('il pannello dà la data esatta: marzo 2008', titolo.includes('marzo 2008'), titolo);
  ok('3.154 carte (DM + GX)', barra.includes('3.154'), barra);
});

await T('filtro per anno con lo stepper', async () => {
  await page.click('.epoca-barra');                    // richiudi
  await page.click('.epoca-barra');                    // riapri
  await page.waitForSelector('.stepper');
  const anno = await page.textContent('.stepper b');
  ok('stepper mostra 2008', anno === '2008', anno);
  await page.click('.stepper button:first-child');     // indietro di un anno
  await page.waitForTimeout(120);
  let barra = await page.textContent('.epoca-barra .val');
  ok('2007: 3.046 cumulate', barra.includes('fine 2007') && barra.includes('3.046'), barra);
  await page.click('.stepper button:last-child');
  await page.waitForTimeout(120);
  barra = await page.textContent('.epoca-barra .val');
  ok('2008: 3.594 cumulate (più di fine GX)', barra.includes('fine 2008') && barra.includes('3.594'), barra);
  const nota = await page.textContent('.epoca-pannello .nota').catch(() => '');
  ok('avvisa che fine 2008 è già dentro 5D\'s', nota.includes("5D's"), nota);
});

await T('anno 2005 e 2006 sono cumulativi', async () => {
  for (let i = 0; i < 3; i++) await page.click('.stepper button:first-child');
  await page.waitForTimeout(150);
  let barra = await page.textContent('.epoca-barra .val');
  ok('2005 → 2.308 (comprende le 2.020 di prima)', barra.includes('fine 2005') && barra.includes('2.308'), barra);
  await page.click('.stepper button:last-child');
  await page.waitForTimeout(150);
  barra = await page.textContent('.epoca-barra .val');
  ok('2006 → 2.622 (comprende il 2005)', barra.includes('fine 2006') && barra.includes('2.622'), barra);
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 10).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
