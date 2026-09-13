import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message + '\n' + (e.stack||'').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
await page.route('**://images.ygoprodeck.com/**', r => r.abort());
await page.route('**://ms.yugipedia.com/**', r => r.abort());
await page.route('**://fonts.g*/**', r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message); } };
const txt = s => page.textContent(s);

await T('dettaglio busta con epoca DM', async () => {
  await page.click('.epoca-barra'); await page.click('[data-saga="0"]'); await page.waitForTimeout(100);
  await page.click('.epoca-barra');                                   // chiudi pannello
  await page.evaluate(() => [...document.querySelectorAll('.duel')]
    .find(x => x.querySelector('.nome').textContent === 'Yugi').click());
  await page.waitForSelector('.testa');
  ok('titolo busta', (await txt('.titolo')).includes('Busta di Yugi'), await txt('.titolo'));
  ok('156 di 314 nella tua epoca', (await txt('.testa p')).includes('156 di 314 nella tua epoca'), await txt('.testa p'));
  ok('61 rare', (await txt('.testa p')).includes('61 rare'), await txt('.testa p'));
  ok('barra di composizione a più colori', (await page.$$('.composizione i')).length >= 5);
  ok('legenda con le saghe', (await txt('.legenda')).includes('ARC-V'));
  const carte = await page.$$('.carta');
  ok('primo blocco da 300 piastrelle', carte.length === 300, 'trovate ' + carte.length);
  const fuori = await page.$$('.carta.fuori');
  ok('carte fuori epoca visibili e in grigio', fuori.length > 0, 'fuori: ' + fuori.length);
  const anni = await page.$$('.carta .anno');
  ok('anno sotto ogni carta', anni.length === carte.length);
  ok('c\'è la coda che carica da sola', !!(await page.$('.sentinella')));
});

await T('nascondi fuori epoca', async () => {
  await page.click('[data-az="nascondi"]'); await page.waitForTimeout(120);
  ok('nessuna carta grigia', (await page.$$('.carta.fuori')).length === 0);
  ok('156 stanno sotto il blocco: disegnate tutte, niente coda',
     (await page.$$('.carta')).length === 156 && !(await page.$('.sentinella')),
     String((await page.$$('.carta')).length));
  await page.click('[data-az="nascondi"]');
});

await T('filtro per cornice dentro la busta', async () => {
  ok('chip cornice presenti', !!(await page.$('[data-t="trap"]')));
  await page.click('[data-t="trap"]'); await page.waitForTimeout(150);
  const tutte = (await page.$$('.carta')).length;
  ok('filtro trappole attivo', tutte > 0 && tutte < 156, String(tutte));
  await page.click('[data-t="trap"]'); await page.waitForTimeout(150);
  ok('filtro tolto', (await page.$$('.carta')).length === 300, String((await page.$$('.carta')).length));
});

await T('scheda di una carta', async () => {
  await page.click('.carta .tocca'); await page.waitForSelector('.velo');
  const s = await txt('.scheda');
  ok('blocco "Quando è uscita"', s.includes('Quando è uscita'), '');
  ok('blocco "Dove si trova"', s.includes('Dove si trova'), '');
  ok('dice se è nella tua epoca', /nella tua epoca|fuori dalla tua epoca/.test(s), '');
  ok('elenca la busta', s.includes('Busta di'), '');
  await page.click('.chiudi');
  ok('modale chiusa', (await page.$$('.velo')).length === 0);
});

await T('vista Carte e ricerca per archetipo', async () => {
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(150);
  ok('Indietro torna alle buste', (await txt('.titolo')).includes('Legacy of the Duelist'));
  await page.click('[data-v="carte"]'); await page.waitForSelector('[data-q="qCarte"]');
  await page.fill('[data-q="qCarte"]', 'Blue-Eyes'); await page.waitForTimeout(400);
  const r = await txt('#corpo .serie');
  ok('trova le Blue-Eyes nell\'epoca DM', /Carte «Blue-Eyes» · \d+/.test(r.replace(/\s+/g,' ')), r.replace(/\s+/g,' ').trim());
  await page.fill('[data-q="qCarte"]', 'Dark Magician'); await page.waitForTimeout(400);
  ok('cerca Dark Magician', (await page.$$('.carta')).length > 0);
  await page.fill('[data-q="qCarte"]', 'Salamangreat'); await page.waitForTimeout(500);
  const v = await txt('#corpo');
  ok('vicolo cieco evitato: 0 nella tua epoca · N fuori', v.includes('0 nella tua epoca') && v.includes('fuori'), v.slice(0,120));
  await page.click('[data-az="tutto"]'); await page.waitForTimeout(300);
  ok('"guardale comunque" toglie il filtro', (await page.$$('.carta')).length > 0);
  await page.fill('[data-q="qCarte"]', ''); await page.waitForTimeout(400);
});

await T('vista Dove: sfide e campagne', async () => {
  await page.click('[data-v="dove"]'); await page.waitForSelector('.nota-testa');
  ok('avviso una volta sola', (await txt('.nota-testa')).includes('si vincono una volta sola'));
  const c = await txt('.conta');
  ok('elenco duelli', /\d+ duelli/.test(c), c);
  const corpo = await txt('#corpo');
  ok('raggruppati per saga del gioco', corpo.includes('Saga Duel Monsters') && corpo.includes('Saga GX'), '');
  ok('ZEXAL ha solo sfide, non "campagna"', !corpo.includes('Campagna ZEXAL'), '');
  const gruppo = await page.$('[data-g]');
  ok('gruppi a livelli espandibili', !!gruppo);
  if (gruppo) { await gruppo.click(); await page.waitForTimeout(120);
    ok('il gruppo si apre', (await page.$$('.sottoluoghi .duel')).length > 1); }
});

await T('apertura di una sfida', async () => {
  await page.click('.sottoluoghi .duel'); await page.waitForSelector('.testa');
  ok('titolo sfida', (await txt('.titolo')).match(/Sfida|Campagna/) !== null, await txt('.titolo'));
  const d = await txt('.testa');
  ok('dice che è garantita', d.includes('garantita'), d.slice(0,120));
  ok('distingue sfida da duello di storia', /sfida della saga|duello di storia della saga/.test(d), d.slice(0,120));
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(120);
  ok('torna a Dove', (await txt('.titolo')).includes('Dove si vincono'));
});

await T('regressioni corrette dalla revisione', async () => {
  // i chip di cornice non devono sparire quando ne attivi uno
  await page.click('[data-v="carte"]'); await page.waitForTimeout(200);
  await page.click('[data-az="tutto"]').catch(() => {});
  await page.fill('[data-q="qCarte"]', 'dragon'); await page.waitForTimeout(400);
  const primaChip = (await page.$$('[data-t]')).length;
  ok('ci sono chip di cornice', primaChip > 1, String(primaChip));
  await page.click('[data-t="spell"]'); await page.waitForTimeout(250);
  ok('i chip restano dopo averne attivato uno', (await page.$$('[data-t]')).length === primaChip,
     String((await page.$$('[data-t]')).length));
  ok('il filtro si può togliere', await page.$eval('[data-t="spell"]', e => e.getAttribute('aria-pressed')) === 'true');
  await page.click('[data-t="spell"]'); await page.waitForTimeout(250);

  // il testo cercato non deve sopravvivere al cambio di schermata
  await page.fill('[data-q="qCarte"]', 'zzzznonesiste');
  await page.click('[data-v="buste"]');                 // subito, senza aspettare il debounce
  await page.waitForTimeout(400);
  ok('la ricerca in volo non atterra sulla schermata dopo',
     (await page.$$('.duel')).length === 33, String((await page.$$('.duel')).length));

  // "Togli tutti i filtri" deve funzionare anche senza filtro epoca
  await page.click('.duel'); await page.waitForSelector('.testa');
  await page.fill('[data-q="q"]', 'zzzznonesiste'); await page.waitForTimeout(400);
  ok('stato vuoto con via d\'uscita', !!(await page.$('[data-az="pulisci"]')));
  await page.click('[data-az="pulisci"]'); await page.waitForTimeout(300);
  ok('togliere i filtri riporta le carte', (await page.$$('.carta')).length === 300,
     String((await page.$$('.carta')).length));

  // nessuna carta duplicata
  await page.click('[data-az="indietro"]'); await page.click('[data-v="carte"]');
  await page.fill('[data-q="qCarte"]', 'Puzzlomino'); await page.waitForTimeout(400);
  const n = await page.$$eval('.carta .n', e => e.filter(x => /Puzzlomino/.test(x.textContent)).length);
  ok('nessun doppione nell\'indice', n === 1, String(n));
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 8).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
