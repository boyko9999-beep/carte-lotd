// Ricerca per tema in italiano, espansione alle carte che ci vanno insieme,
// e caricamento della griglia senza pulsanti.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n, e ? '· ' + e : ''); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
for (const p of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await page.route(p, r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n')[0]); } };
const txt = s => page.textContent(s);
const cerca = async q => { await page.fill('[data-q="qCarte"]', q); await page.waitForTimeout(450); };
const stato = () => page.evaluate(() => ({
  conta: document.querySelector('.conta').textContent.trim(),
  righe: [...document.querySelectorAll('.serie, .gruppo h3, .spiega, .vuoto')]
    .map(x => x.textContent.replace(/\s+/g, ' ').trim()),
  nomi: [...document.querySelectorAll('.carta')].map(x => ({
    en: ((x.querySelector('.n') || {}).textContent || '').trim(),
    it: ((x.querySelector('.nomeit') || {}).textContent || '').trim() })),
  code: document.querySelectorAll('.sentinella').length
}));

await page.click('[data-v="carte"]'); await page.waitForTimeout(300);

await T('«drago bianco occhi blu» — il nome italiano vero', async () => {
  await cerca('drago bianco occhi blu');
  const s = await stato();
  ok('trova le carte giuste', s.righe[0].startsWith('Carte «drago bianco occhi blu» · 4'), s.righe[0]);
  ok('la prima è un Drago Bianco Occhi Blu', /Occhi Blu/.test(s.nomi[0].it), s.nomi[0].it);
  ok('mostra il nome inglese, che è quello del gioco', /Blue-Eyes/.test(s.nomi[0].en), s.nomi[0].en);
  ok('propone le carte che ci vanno insieme', s.righe.some(r => /che ci vanno insieme/.test(r)),
     s.righe.join(' | ').slice(0, 90));
});

await T('«eroi elementari» — trova anche Polimerizzazione', async () => {
  await cerca('eroi elementari');
  const s = await stato();
  ok('trova gli EROE Elementale nonostante il plurale diverso',
     /Carte «eroi elementari» · 89/.test(s.righe[0]), s.righe[0]);
  ok('sotto-gruppo «Servono per queste carte»', s.righe.some(r => /^Servono per queste carte/.test(r)),
     s.righe.filter(r => /Servono|Stesso|Usano/.test(r)).join(' | '));
  const poli = s.nomi.findIndex(n => n.en === 'Polymerization');
  ok('Polimerizzazione c\'è', poli >= 0, 'posizione ' + poli);
  ok('col nome italiano accanto', poli >= 0 && s.nomi[poli].it === 'Polimerizzazione', s.nomi[poli] && s.nomi[poli].it);
  ok('e non è sepolta: c\'è il salto alla sezione', s.righe[0].includes('altre'), s.righe[0]);
});

await T('«zombie» — cerca per razza, non solo per nome', async () => {
  await cerca('zombie');
  const s = await stato();
  ok('oltre duecento carte Zombie', /Carte «zombie» · 21\d/.test(s.righe[0]), s.righe[0]);
  const noZombieNelNome = s.nomi.slice(0, 60).filter(n => !/zombie/i.test(n.en) && !/zombie/i.test(n.it));
  ok('comprende carte che nel nome non dicono Zombie', noZombieNelNome.length > 0,
     noZombieNelNome.slice(0, 2).map(x => x.en).join(', '));
});

await T('altre ricerche per tema', async () => {
  for (const [q, minimo] of [['occhi rossi', 20], ['mago nero', 15], ['macchina', 500], ['fusione', 20]]) {
    await cerca(q);
    const s = await stato();
    const m = s.righe[0].match(/· ([\d.]+)/);
    const n = m ? +m[1].replace('.', '') : 0;
    ok(`«${q}» trova almeno ${minimo} carte`, n >= minimo, n + ' trovate');
  }
});

await T('il conteggio in cima segue la ricerca', async () => {
  await cerca('zombie');
  ok('dice quante ne ha trovate', /trovate/.test((await stato()).conta), (await stato()).conta);
  await cerca('');
  ok('senza ricerca torna al totale dell\'epoca', /nell'epoca/.test((await stato()).conta), (await stato()).conta);
});

await T('niente più pulsante: la griglia si riempie da sola', async () => {
  await cerca('');
  let s = await stato();
  ok('primo blocco da 300', s.nomi.length === 300, String(s.nomi.length));
  ok('non c\'è nessun pulsante «Mostra altre carte»',
     !(await page.$('text=Mostra altre carte')), '');
  ok('c\'è la coda che si carica scorrendo', s.code === 1);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
  }
  s = await stato();
  ok('scorrendo ne compaiono altre senza toccare niente', s.nomi.length > 300, String(s.nomi.length));
});

await T('una busta si disegna tutta in un colpo', async () => {
  await page.click('[data-v="buste"]'); await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('.duel')]
    .find(x => x.querySelector('.nome').textContent === 'Yugi').click());
  await page.waitForSelector('.testa'); await page.waitForTimeout(300);
  const n = (await page.$$('.carta')).length;
  ok('314 carte, ma disegnate a blocchi di 300', n === 300, String(n));
  ok('le ultime arrivano da sole', !!(await page.$('.sentinella')));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  ok('e infatti arrivano', (await page.$$('.carta')).length === 314,
     String((await page.$$('.carta')).length));
});

console.log('\nerrori JS: ' + errori.length);
errori.slice(0, 5).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
