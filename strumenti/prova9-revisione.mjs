// I difetti trovati dalla revisione avversariale della ricerca per tema.
// Ogni prova qui sotto fallisce sulla versione precedente: sono le prove
// dei bug veri, non del comportamento che si sperava di avere.
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
const cerca = async q => { await page.fill('[data-q="qCarte"]', q); await page.waitForTimeout(450); };
const quante = q => page.evaluate(t => cerca(TUTTE, t).length, q);
const righe = () => page.evaluate(() => [...document.querySelectorAll('.serie, .gruppo h3, .spiega, .vuoto')]
  .map(x => x.textContent.replace(/\s+/g, ' ').trim()));

await page.click('[data-v="carte"]'); await page.waitForTimeout(300);

await T('singolare e plurale trovano le stesse carte', async () => {
  for (const [uno, tanti] of [['drago bianco', 'draghi bianchi'], ['drago nero', 'draghi neri'],
      ['ingranaggio antico', 'ingranaggi antichi'], ['macchina antica', 'macchine antiche'],
      ['occhi blu', 'occhio blu'], ['mago', 'maghi']]) {
    const a = await quante(uno), b = await quante(tanti);
    ok(`«${uno}» e «${tanti}»`, a > 0 && a === b, `${a} vs ${b}`);
  }
});

await T('articoli e preposizioni non fanno sparire i risultati', async () => {
  const base = await quante('drago bianco');
  for (const q of ['il drago bianco', 'i draghi bianchi', 'un drago bianco'])
    ok(`«${q}»`, await quante(q) === base, `${await quante(q)} vs ${base}`);
  ok('«carte magia rapida» trova le magie rapide', await quante('carte magia rapida') > 100,
     String(await quante('carte magia rapida')));
  ok('«di» da sola resta una parola cercabile', await quante('di') > 0, String(await quante('di')));
});

await T('una ricerca di sola punteggiatura non spaccia l\'archivio per risultati', async () => {
  await cerca('...');
  const r = await righe();
  ok('non dice 10.026 trovate', !r.some(x => /10\.026/.test(x)), r.join(' | ').slice(0, 80));
  ok('dice che non ha trovato niente', r.some(x => /Nessuna carta/.test(x)), r[0]);
  ok('anche la conta in cima è zero', (await page.textContent('.conta')).trim() === '0 trovate',
     (await page.textContent('.conta')).trim());
});

await T('il numero in cima segue la ricerca anche dopo un cambio di epoca', async () => {
  await cerca('drago bianco');
  const corpo = async () => (await righe())[0];
  await page.click('[data-az="pannello"]'); await page.waitForTimeout(150);
  await page.click('[data-saga="0"]'); await page.waitForTimeout(350);
  const conta = (await page.textContent('.conta')).trim();
  const primo = await corpo();
  ok('intestazione e corpo dicono lo stesso numero',
     conta.startsWith(primo.match(/· (\d+)/) ? primo.match(/· (\d+)/)[1] : 'x') ||
     (/0 nella tua epoca/.test(primo) && conta.startsWith('0')), `${conta} / ${primo}`);
  await page.click('[data-az="tutto"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.click('[data-az="pannello"]'); await page.waitForTimeout(200);   // richiude il pannello epoca
});

await T('con 0 carte nell\'epoca ma carte collegate, la via d\'uscita resta', async () => {
  await page.evaluate(() => { STATO.cursore = SAGHE[0].ultima; STATO.qCarte = 'cyber drago'; azzeraLimiti(); render(); });
  await page.waitForTimeout(300);
  const r = await righe();
  ok('dice che nell\'epoca non ce n\'è nessuna', r.some(x => /0 nella tua epoca/.test(x)), r.join(' | ').slice(0, 120));
  ok('offre «Guardale comunque»', await page.$('[data-az="tutto"]') !== null);
  ok('e non dice «quelle qui sopra» quando sopra non c\'è niente',
     !r.some(x => /si giocano con quelle qui sopra/.test(x)), r.join(' | ').slice(0, 160));
  await page.click('[data-az="tutto"]'); await page.waitForTimeout(350);
  ok('«Guardale comunque» le mostra davvero', (await righe())[0].startsWith('Carte «cyber drago»'), (await righe())[0]);
});

await T('un chip di tipo acceso resta visibile e togliibile', async () => {
  await cerca('');
  await page.click('.f[data-t]'); await page.waitForTimeout(300);   // accende il primo tipo
  const acceso = await page.evaluate(() => [...STATO.tipiAttivi][0]);
  await cerca('monster reborn');
  const chip = await page.evaluate(t => !!document.querySelector(`.f[data-t="${t}"]`), acceso);
  ok('il chip acceso si vede ancora', chip, 'tipo ' + acceso);
  ok('oppure c\'è il pulsante per toglierlo',
     chip || await page.$('[data-az="senza-tipi"]') !== null);
  await page.evaluate(() => { STATO.tipiAttivi = new Set(); azzeraLimiti(); ridisegnaCorpo(); });
  await page.waitForTimeout(300);
  ok('tolto il filtro, Monster Reborn si trova', (await righe())[0].startsWith('Carte «monster reborn»'),
     (await righe())[0]);
});

await T('il salto «↓ altre N che ci vanno insieme» atterra sulla sezione', async () => {
  await cerca('drago');
  await page.click('a[href="#insieme"]');
  for (const attesa of [100, 400, 1000]) {
    await page.waitForTimeout(attesa);
    const d = await page.evaluate(() => document.getElementById('insieme').getBoundingClientRect().top);
    ok(`dopo ${attesa} ms è ancora lì`, Math.abs(d) < 400, String(Math.round(d)));
  }
  const sotto = await page.evaluate(() => {
    const e = document.elementFromPoint(195, 500);
    const c = e && e.closest('.carta');
    return c ? c.parentElement.id : 'niente';
  });
  ok('sotto il dito ci sono le carte della seconda sezione', sotto !== 'ctrovate', sotto);
});

await T('il ritorno «↑ Torna alle N» funziona anche dentro un mazzo', async () => {
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(250);
  await page.click('[data-nuovo]'); await page.waitForTimeout(250);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(400);
  await page.fill('[data-q="qSel"]', 'drago'); await page.waitForTimeout(500);
  ok('c\'è il collegamento in giù', await page.$('a[href="#insieme"]') !== null);
  await page.click('a[href="#insieme"]'); await page.waitForTimeout(400);
  ok('l\'ancora di ritorno esiste', await page.$('#su') !== null);
  await page.click('a[href="#su"]'); await page.waitForTimeout(400);
  ok('si torna in cima ai risultati', await page.evaluate(() => scrollY) < 400,
     String(await page.evaluate(() => scrollY)));
});

await T('nella schermata del mazzo la scheda della carta si aggiorna', async () => {
  await page.evaluate(() => { STATO.qSel = ''; azzeraLimiti(); render(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#corpo [data-piu]').click());
  await page.waitForTimeout(250);
  await page.click('[data-az="apri-mazzo"]'); await page.waitForTimeout(350);
  await page.evaluate(() => document.querySelector('#corpo [data-c]').click());
  await page.waitForSelector('.velo');
  const leggi = () => page.textContent('.velo .copie-testo');
  ok('la scheda parte da 1 copia', (await leggi()).startsWith('1'), await leggi());
  await page.click('.velo [data-piu]'); await page.waitForTimeout(200);
  ok('il «+» aggiorna il conto nella scheda', (await leggi()).startsWith('2'), await leggi());
  await page.click('.velo [data-piu]'); await page.waitForTimeout(200);
  ok('e arriva a 3', (await leggi()).startsWith('3'), await leggi());
  const spento = await page.evaluate(() => document.querySelector('.velo [data-piu]').disabled);
  ok('alla terza copia il «+» si spegne invece di restare acceso a vuoto', spento);
  await page.click('.velo .chiudi'); await page.waitForTimeout(200);
});

await T('saltando di colpo in fondo le carte arrivano lo stesso', async () => {
  await page.click('[data-az="indietro"]').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('[data-v="carte"]'); await page.waitForTimeout(400);
  await page.evaluate(() => { STATO.qCarte = ''; azzeraLimiti(); render(); });
  await page.waitForTimeout(400);
  const prima = await page.evaluate(() => document.querySelectorAll('.carta').length);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  const dopo = await page.evaluate(() => document.querySelectorAll('.carta').length);
  ok('la sentinella scavalcata si accorge e carica', dopo > prima, `${prima} -> ${dopo}`);
});

console.log('\nerrori JS:', errori.length); errori.slice(0, 5).forEach(e => console.log('  !', e));
falliti += errori.length;
console.log(`\nPASSATI ${passati} · FALLITI ${falliti}`);
await browser.close();
process.exit(0);
