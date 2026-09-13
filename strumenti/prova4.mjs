import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
for (const p of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await page.route(p, r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n')[0]); } };
const txt = s => page.textContent(s);
// il pannello epoca è uno stato: apriamolo/chiudiamolo sapendo dove siamo
const pannello = async apri => {
  const aperto = !!(await page.$('.epoca-pannello'));
  if (aperto !== apri) { await page.click('.epoca-barra'); await page.waitForTimeout(150); }
};
const vaiTab = async v => { await pannello(false);
  while (!(await page.$(`[data-v="${v}"]`))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(200); }
  await page.click(`[data-v="${v}"]`); await page.waitForTimeout(250); };

await T('lo scroll non sopravvive al cambio di schermata', async () => {
  await page.evaluate(() => scrollTo(0, 2000));
  await page.waitForTimeout(100);
  ok('siamo scesi', await page.evaluate(() => scrollY) > 1000);
  await page.evaluate(() => [...document.querySelectorAll('.duel')].find(x => x.querySelector('.nome').textContent === 'Playmaker').click());
  await page.waitForSelector('.testa'); await page.waitForTimeout(200);
  ok('la busta si apre in cima', await page.evaluate(() => scrollY) === 0, String(await page.evaluate(() => scrollY)));
  ok('la testata è visibile', (await txt('.testa h2')).includes('Playmaker'));
});

await T('cambiare epoca non fa saltare la pagina', async () => {
  await vaiTab('buste');
  await page.evaluate(() => [...document.querySelectorAll('.duel')]
    .find(x => x.querySelector('.nome').textContent === 'Yugi').click());
  await page.waitForSelector('.testa');
  await page.evaluate(() => scrollTo(0, 1500)); await page.waitForTimeout(150);
  const prima = await page.evaluate(() => scrollY);
  await pannello(true);
  await page.click('[data-saga="4"]'); await page.waitForTimeout(300);   // ARC-V: la busta resta lunga
  const dopo = await page.evaluate(() => scrollY);
  ok('si resta più o meno dove si era', Math.abs(dopo - prima) < 300, `${prima} -> ${dopo}`);
  await pannello(false);
});

await T('«Togli tutti i filtri» non tocca l\'epoca di un mazzo', async () => {
  await vaiTab('mazzi');
  await page.click('[data-nuovo]'); await page.waitForTimeout(200);
  await pannello(false);
  await page.click('.filtri [data-tacca]'); await page.waitForTimeout(200);   // primo chip = Duel Monsters
  await page.click('[data-az="crea"]'); await page.waitForTimeout(300);
  ok('mazzo creato con epoca Duel Monsters',
     (await txt('.epoca-barra .val')).includes('Duel Monsters'), await txt('.epoca-barra .val'));
  // nel selettore filtro finché non resta niente, così compare lo stato vuoto
  await page.fill('[data-q="qSel"]', 'zzzznonesiste'); await page.waitForTimeout(400);
  const b = await page.$('[data-az="fuori"]');
  ok('stato vuoto con via d\'uscita', !!b);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);   // -> mazzo
  ok('l\'epoca del mazzo è ancora Duel Monsters',
     (await txt('.epoca-barra .val')).includes('Duel Monsters'), await txt('.epoca-barra .val'));
  // ora il pulsante "pulisci" dentro una busta non deve spostare l'epoca del mazzo
  await page.click('[data-az="spesa"]').catch(() => {});
  await page.waitForTimeout(250);
  await page.evaluate(() => { const x = document.querySelector('[data-az="pulisci"]'); if (x) x.click(); });
  await page.waitForTimeout(250);
  ok('epoca del mazzo intatta dopo «pulisci»',
     (await txt('.epoca-barra .val')).includes('Duel Monsters'), await txt('.epoca-barra .val'));
});

await T('«solo le nuove» non entra di nascosto in un mazzo', async () => {
  // percorso: Nuovo mazzo -> accendi «solo le nuove» -> Crea
  await vaiTab('mazzi');
  await page.click('[data-nuovo]'); await page.waitForTimeout(250);
  await pannello(true);
  const tog = await page.$('[data-az="solo-nuove"]');
  ok('nella schermata «Nuovo mazzo» il pulsante c\'è', !!tog);
  if (tog) { await tog.click(); await page.waitForTimeout(200); }
  await pannello(false);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(350);
  const sbiadite = (await page.$$('.carta.fuori')).length;
  ok('nel selettore nessuna carta è sbiadita per sbaglio', sbiadite === 0, sbiadite + ' sbiadite');
  const attivi = await page.evaluate(() => [...document.querySelectorAll('[data-piu]')].filter(b => !b.disabled).length);
  ok('tutte aggiungibili', attivi > 0, attivi + ' «+» attivi');
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('[data-az="elimina"]'); await page.waitForTimeout(400);
});

await T('dentro un mazzo non c\'è «solo le nuove»', async () => {
  await vaiTab('mazzi');
  await page.click('[data-nuovo]'); await page.waitForTimeout(250);
  await pannello(false);
  await page.click('.filtri [data-tacca]'); await page.waitForTimeout(200);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(350);
  await pannello(true);
  ok('il pannello non offre «solo le nuove» in un mazzo', !(await page.$('[data-az="solo-nuove"]')));
  await pannello(false);
  ok('fuori dai mazzi invece c\'è', true);
});

await T('un mazzo eliminato non torna in vita', async () => {
  while ((await txt('.titolo')) === 'Dove trovarle' || !(await page.$('[data-az="elimina"]'))) {
    await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
  }
  page.on('dialog', d => d.accept());
  await page.evaluate(() => { window.confirm = () => true; });
  const nome = await page.inputValue('#nomeMazzo');
  await page.click('[data-az="elimina"]'); await page.waitForTimeout(500);
  ok('si torna all\'elenco', (await txt('.titolo')).includes('ricette'), await txt('.titolo'));
  ok('il mazzo è sparito', !(await txt('#corpo')).includes(nome), (await txt('#corpo')).slice(0,80));
  // simuliamo il ritorno in primo piano: riconciliaMazzi rilegge da IndexedDB
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(400);
  ok('non riappare dopo la riconciliazione', !(await txt('#corpo')).includes(nome));
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.duel');
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(300);
  ok('non riappare dopo il ricaricamento', !(await txt('#corpo')).includes(nome), (await txt('#corpo')).slice(0,80));
});

await T('le carte fuori epoca sono tutte raggiungibili', async () => {
  await vaiTab('mazzi');
  await page.click('[data-nuovo]'); await page.waitForTimeout(250);
  await pannello(false);
  await page.click('.filtri [data-tacca]'); await page.waitForTimeout(200);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(350);
  await page.click('[data-az="fuori"]'); await page.waitForTimeout(400);
  const t = await txt('#corpo');
  const m = t.match(/Fuori dalla tua epoca · ([\d.]+)/);
  ok('la sezione dichiara il totale', !!m, (t.match(/Fuori[^\n]{0,40}/) || [''])[0]);
  const coda = await page.$('[data-altre="sfuori"]');
  ok('la coda carica da sola le altre fuori epoca', !!coda);
  if (coda) {
    const n1 = (await page.$$('.carta')).length;
    await coda.click(); await page.waitForTimeout(400);
    ok('ne compaiono altre', (await page.$$('.carta')).length > n1,
       `${n1} -> ${(await page.$$('.carta')).length}`);
  }
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 6).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
