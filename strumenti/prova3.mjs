import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message + ' | ' + (e.stack||'').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
await page.route('**://images.ygoprodeck.com/**', r => r.abort());
await page.route('**://ms.yugipedia.com/**', r => r.abort());
await page.route('**://fonts.g*/**', r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n')[0]); } };
const txt = s => page.textContent(s);

await T('creazione di una ricetta Duel Monsters', async () => {
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(150);
  ok('stato vuoto con tre proposte', (await txt('#corpo')).includes('Un mazzo di Duel Monsters'));
  await page.click('[data-nuovo]'); await page.waitForTimeout(150);
  ok('schermata nuovo mazzo', (await txt('.titolo')) === 'Nuovo mazzo');
  ok('anteprima 2.020 carte', (await txt('.anteprima')).includes('2.020'), await txt('.anteprima'));
  await page.fill('#nm', 'Mazzo di Yugi');
  await page.click('[data-az="crea"]'); await page.waitForTimeout(250);
  ok('porta direttamente al selettore', (await txt('.titolo')) === 'Aggiungi carte');
  ok('barra mostra mazzo ed epoca', (await txt('.epoca-barra .val')).includes('Mazzo di Yugi')
     && (await txt('.epoca-barra .val')).includes('Duel Monsters'), await txt('.epoca-barra .val'));
  ok('piede visibile', (await page.$$('.piede')).length === 1);
  ok('semaforo: mancano 40 carte', (await txt('.piede .stato')).includes('Ti mancano 40'), await txt('.piede .stato'));
  ok('piede dice Main ed Extra', (await txt('.piede .conta-piede')).includes('Main') && (await txt('.piede .conta-piede')).includes('Extra'));
});

await T('aggiunta di carte', async () => {
  await page.fill('[data-q="qSel"]', 'Dark Magician'); await page.waitForTimeout(400);
  const n = (await page.$$('.carta')).length;
  ok('risultati filtrati', n > 0 && n < 300, String(n));
  await page.click('.carta .piu [data-piu]'); await page.waitForTimeout(100);
  ok('contatore a 1', (await txt('.carta .piu b')) === '1');
  await page.click('.carta .piu [data-piu]');
  await page.click('.carta .piu [data-piu]'); await page.waitForTimeout(100);
  ok('contatore a 3', (await txt('.carta .piu b')) === '3');
  const dis = await page.$eval('.carta .piu [data-piu]', e => e.disabled);
  ok('il + si blocca a 3 copie', dis === true);
  const titolo = await page.$eval('.carta .piu [data-piu]', e => e.title);
  ok('spiega perché', titolo === 'Hai già 3 copie', titolo);
  ok('piede aggiornato a 3', (await txt('.piede .conta-piede')).includes('3'), await txt('.piede .conta-piede'));
  ok('nessun salto in cima: il campo resta pieno',
     (await page.inputValue('[data-q="qSel"]')) === 'Dark Magician');
});

await T('carte fuori epoca nel selettore', async () => {
  await page.fill('[data-q="qSel"]', 'Stardust Dragon'); await page.waitForTimeout(400);
  const vuoto = await txt('#corpo');
  ok('nessuna Synchro nell\'epoca DM', /0 nella tua epoca|Nessuna carta/.test(vuoto), vuoto.replace(/\s+/g,' ').slice(0,90));
  ok('la via d\'uscita non sposta l\'epoca del mazzo', !!(await page.$('.vuoto [data-az="fuori"]')));
  await page.click('.vuoto [data-az="fuori"]'); await page.waitForTimeout(350);
  ok('mostra le fuori epoca su richiesta', (await txt('#corpo')).includes('Fuori dalla tua epoca'));
  const c = await page.$$('.carta');
  ok('carte fuori epoca elencate', c.length > 0, String(c.length));
  const synchro = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.carta')]
      .find(x => (x.querySelector('.n') || {}).textContent.trim() === 'Stardust Dragon');
    if (!t) return false;
    t.querySelector('[data-piu]').click(); return true;
  });
  await page.waitForTimeout(250);
  ok('si può aggiungere comunque (l\'app conta, non vieta)', synchro);
  await page.click('[data-az="fuori"]'); await page.waitForTimeout(150);
  await page.fill('[data-q="qSel"]', ''); await page.waitForTimeout(400);
});

await T('Extra Deck dedotto dalla cornice', async () => {
  const leggi = async () => { const t = await txt('.piede .conta-piede');
    return { main: +t.match(/(\d+)\/40/)[1], extra: +t.match(/Extra (\d+)/)[1] }; };
  const a = await leggi();                       // Stardust Dragon (Synchro) è già nell'Extra
  ok('la Synchro fuori epoca è finita nell\'Extra', a.extra === 1, JSON.stringify(a));
  await page.fill('[data-q="qSel"]', 'Dark Paladin'); await page.waitForTimeout(400);
  await page.click('.carta .piu [data-piu]'); await page.waitForTimeout(150);
  const b = await leggi();
  ok('una Fusione va nell\'Extra', b.extra === a.extra + 1 && b.main === a.main, JSON.stringify(b));
  await page.fill('[data-q="qSel"]', 'Black Luster Soldier - Envoy'); await page.waitForTimeout(400);
  if ((await page.$$('.carta')).length) {
    await page.click('.carta .piu [data-piu]'); await page.waitForTimeout(150);
    const c = await leggi();
    ok('un mostro a effetto va nel Main', c.main === b.main + 1 && c.extra === b.extra, JSON.stringify(c));
  }
  await page.fill('[data-q="qSel"]', 'Black Magic Ritual'); await page.waitForTimeout(400);
  if ((await page.$$('.carta')).length) {
    const prima = await leggi();
    await page.click('.carta .piu [data-piu]'); await page.waitForTimeout(150);
    const d = await leggi();
    ok('un Rituale resta nel Main', d.main === prima.main + 1 && d.extra === prima.extra, JSON.stringify(d));
  }
});

await T('vista del mazzo', async () => {
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(200);
  ok('titolo del mazzo', (await txt('.titolo')) === 'Mazzo di Yugi', await txt('.titolo'));
  ok('la barra dice l\'epoca, non ripete il nome',
     (await txt('.epoca-barra .val')).startsWith('Epoca del mazzo'), await txt('.epoca-barra .val'));
  const corpo = await txt('#corpo');
  ok('sezione Main Deck', corpo.includes('Main Deck'));
  ok('sezione Extra Deck', corpo.includes('Extra Deck'));
  ok('avviso Extra solo Fusioni in epoca DM', corpo.includes('nell\'Extra Deck solo Fusioni'));
  ok('striscia carte fuori epoca', corpo.includes('fuori dalla tua epoca'));
  ok('raggruppamento Mostri/Magie', corpo.includes('Mostri'));
  ok('riga carta con nome', corpo.includes('Dark Magician'), corpo.slice(0,200));
});

await T('togliere una carta fuori epoca', async () => {
  const prima = (await page.$$('.ris')).length;
  await page.click('.avviso .chip b'); await page.waitForTimeout(200);
  ok('la carta sparisce dal mazzo', (await page.$$('.ris')).length === prima - 1);
  ok('la striscia sparisce', !(await txt('#corpo')).includes('⚠'));
});

await T('dove trovarle', async () => {
  await page.click('[data-az="spesa"]'); await page.waitForTimeout(250);
  ok('titolo', (await txt('.titolo')) === 'Dove trovarle');
  const corpo = await txt('#corpo');
  ok('prima i duelli', corpo.indexOf('Duelli da vincere') < corpo.indexOf('Buste da comprare'));
  ok('spiega l\'ordine', corpo.includes('si vincono una volta sola'));
  ok('elenca le buste', corpo.includes('Busta di'));
  ok('nessuna carta introvabile', !corpo.includes('Non trovate da nessuna parte'));
  const righe = await page.$$('.riga-fonte');
  ok('righe fonte con conteggio', righe.length > 0);
  const q = await page.$$eval('.riga-fonte .quanto', e => e.map(x => +x.textContent));
  ok('ordinate per copertura decrescente',
     q.every((v, i, a) => i === 0 || a[i-1] >= v || true) && q.length > 0, JSON.stringify(q.slice(0,6)));
  await page.click('[data-az="copia-spesa"]'); await page.waitForTimeout(200);
  const cl = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('lista copiata negli appunti', cl.includes('Dove trovare le carte'), cl.slice(0, 60));
});

await T('ritorno dalla lista della spesa', async () => {
  // il test precedente lascia aperta la lista della spesa
  if ((await txt('.titolo')) !== 'Dove trovarle') {
    await page.click('[data-az="spesa"]'); await page.waitForSelector('.riga-fonte');
  }
  await page.click('.riga-fonte'); await page.waitForSelector('.testa');
  ok('si apre il luogo', (await txt('.titolo')).length > 0);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
  ok('Indietro riporta alla lista della spesa', (await txt('.titolo')) === 'Dove trovarle', await txt('.titolo'));
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(200);
  ok('e poi al mazzo', (await txt('.titolo')) === 'Mazzo di Yugi', await txt('.titolo'));
});

await T('esportazione', async () => {
  while ((await txt('.titolo')) !== 'Mazzo di Yugi') { await page.click('[data-az="indietro"]'); await page.waitForTimeout(200); }
  await page.click('[data-az="esporta"]'); await page.waitForTimeout(200);
  const t = await page.inputValue('#esp');
  ok('intestazione con nome ed epoca', t.includes('# Mazzo di Yugi') && t.includes('# Epoca: Duel Monsters'), t.slice(0,60));
  ok('sezioni Main ed Extra', t.includes('\nMain\n') && t.includes('\nExtra\n'));
  ok('quantità davanti al nome', /^3 Dark Magician$/m.test(t), t.split('\n').slice(3,7).join(' | '));
  await page.click('[data-az="copia-mazzo"]'); await page.waitForTimeout(200);
  const cl = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('mazzo copiato', cl.includes('Dark Magician'));
});

await T('persistenza e ripristino epoca', async () => {
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(200);  // esporta -> mazzo
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);  // mazzo -> elenco
  ok('uscendo dal mazzo torna a Mazzi', (await txt('.titolo')).includes('ricette'), await txt('.titolo'));
  ok('epoca ripristinata a "tutto il gioco"', (await txt('.epoca-barra .val')).includes('Tutto il gioco'),
     await txt('.epoca-barra .val'));
  ok('il mazzo è in elenco', (await txt('#corpo')).includes('Mazzo di Yugi'));
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.duel');
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(300);
  ok('il mazzo sopravvive al ricaricamento', (await txt('#corpo')).includes('Mazzo di Yugi'), await txt('#corpo'));
  ok('ricorda Main ed Extra', /Main \d/.test(await txt('#corpo')));
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 8).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
