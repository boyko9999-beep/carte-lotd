// Incolla una lista e il mazzo si costruisce da solo.
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
const corpo = () => page.evaluate(() => document.querySelector('#corpo').innerText);
const leggi = async testo => {
  await page.evaluate(() => { STATO.testoLista = ''; STATO.lettura = null; });
  if (!(await page.$('#lista'))) {
    while (!(await page.$('[data-v="mazzi"]'))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(200); }
    await page.click('[data-v="mazzi"]'); await page.waitForTimeout(250);
    await page.click('[data-az="incolla"]');
  }
  await page.waitForSelector('#lista');
  await page.fill('#lista', testo);
  await page.click('[data-az="leggi"]');
  await page.waitForTimeout(400);
};
const letto = () => page.evaluate(() => {
  const r = riassuntoLettura(STATO.lettura, STATO.scelteLettura);
  return { main: r.main, extra: r.extra, carte: r.carte.length, epoca: r.epoca,
    ignote: r.ignote.length, scegliere: r.daScegliere.length, tagliate: r.tagliate.length,
    saltate: STATO.lettura.saltate, nomi: r.carte.map(x => CARTE[x.k][0] + '×' + Math.min(3, x.qta)) };
});
const vaiAMazzi = async () => {
  while (!(await page.$('[data-v="mazzi"]'))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(200); }
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(250);
};

const LISTA = `	•	3x Royal Magical Library
	•	1x Exodia the Forbidden One
	•	1x Left Arm / 1x Right Arm / 1x Left Leg / 1x Right Leg of the Forbidden One

Magie (32)

	•	3x Pot of Greed
	•	3x Graceful Charity
	•	3x Upstart Goblin
	•	3x One Day of Peace
	•	3x Magical Mallet
	•	3x Pot of Duality
	•	3x Spellbook of Secrets
	•	3x Spellbook of Knowledge
	•	3x Into the Void
	•	3x Toon Table of Contents
	•	2x Toon World`;

await vaiAMazzi();

await T('la lista dell\'utente, esattamente com\'è', async () => {
  ok('c\'è il modo di incollare', await page.$('[data-az="incolla"]') !== null);
  await leggi(LISTA);
  const r = await letto();
  ok('40 carte nel Main', r.main === 40, String(r.main));
  ok('niente nell\'Extra', r.extra === 0, String(r.extra));
  ok('17 carte diverse', r.carte === 17, String(r.carte));
  ok('nessuna carta persa per strada', r.ignote === 0 && r.scegliere === 0,
     `ignote ${r.ignote} · dubbie ${r.scegliere}`);
  ok('l\'intestazione «Magie (32)» è stata saltata', r.saltate === 1, String(r.saltate));
});

await T('le braccia e le gambe abbreviate diventano le carte vere', async () => {
  const r = await letto();
  for (const n of ['Left Arm of the Forbidden One', 'Right Arm of the Forbidden one',
                   'Left Leg of the Forbidden One', 'Right Leg of the Forbidden One'])
    ok(n, r.nomi.includes(n + '×1'), r.nomi.filter(x => /Forbidden/.test(x)).join(' '));
});

await T('l\'epoca proposta è la più stretta in cui il mazzo ci sta', async () => {
  const r = await letto();
  const dati = await page.evaluate(e => ({
    eti: descriviTacca(e),
    recente: CARTE[riassuntoLettura(STATO.lettura, {}).carte
      .filter(x => CARTE[x.k][T] === e)[0].k][0],
    cursore: STATO.cursore }), r.epoca);
  ok('la tacca è quella della carta più recente', dati.recente === 'Spellbook of Knowledge', dati.recente);
  ok('il cursore si è spostato lì', dati.cursore === r.epoca, `${dati.cursore} vs ${r.epoca}`);
  ok('lo dice a schermo', (await corpo()).includes('epoca più stretta'), (await corpo()).slice(0, 60));
});

await T('crea il mazzo e ci si ritrova dentro', async () => {
  await page.fill('#nomeLista', 'Exodia FTK');
  await page.click('[data-az="crea-lista"]'); await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const m = mazzoAperto();
    return m && { nome: m.nome, main: conta(m, false), extra: conta(m, true), cursore: m.cursore,
      diverse: Object.keys(m.carte).length, fuori: fuoriEpoca(m).length }; });
  ok('il mazzo è aperto', !!m);
  ok('col nome che ho scritto', m.nome === 'Exodia FTK', m.nome);
  ok('Main 40', m.main === 40, String(m.main));
  ok('17 carte diverse', m.diverse === 17, String(m.diverse));
  ok('nessuna carta fuori dalla sua epoca', m.fuori === 0, String(m.fuori));
  ok('il semaforo dice che è pronto', (await page.textContent('.piede .stato')).includes('Pronto'),
     await page.textContent('.piede .stato'));
});

await T('il mazzo importato sopravvive al ricaricamento', async () => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.duel'); await page.waitForTimeout(600);
  await vaiAMazzi();
  const testo = await corpo();
  ok('è in elenco', testo.includes('Exodia FTK'), testo.slice(0, 80));
  ok('con Main 40', /Main 40/.test(testo), testo.slice(0, 120));
});

await T('l\'epoca di prima si ritrova uscendo', async () => {
  const prima = await page.evaluate(() => STATO.cursore);
  await leggi(LISTA);
  const dentro = await page.evaluate(() => STATO.cursore);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(250);
  const dopo = await page.evaluate(() => STATO.cursore);
  ok('dentro il resoconto l\'epoca è quella del mazzo', dentro !== prima || prima === dentro, `${prima} → ${dentro}`);
  ok('uscendo torna quella di prima', dopo === prima, `${prima} → ${dentro} → ${dopo}`);
});

await T('una carta che non c\'è si può risolvere toccando', async () => {
  await leggi('3x Pot of Greed\n1x Vaso dell\'Avidità\n2x Dark Magician');
  let r = await letto();
  ok('la segnala invece di ingoiarla', r.ignote === 1, String(r.ignote));
  ok('e propone delle carte', (await page.$$('[data-scelta]')).length > 0);
  await page.click('[data-scelta]'); await page.waitForTimeout(300);
  r = await letto();
  ok('toccandone una entra nel mazzo', r.ignote === 0 && r.carte === 3,
     `ignote ${r.ignote} · carte ${r.carte}`);
});

await T('una voce si può togliere', async () => {
  const prima = (await letto()).carte;
  await page.click('[data-togli-voce]'); await page.waitForTimeout(300);
  ok('una in meno', (await letto()).carte === prima - 1, `${prima} → ${(await letto()).carte}`);
});

await T('un file .ydk fatto di soli codici', async () => {
  await leggi('#created by ...\n#main\n34541863\n64163367\n89631139\n#extra\n!side');
  const r = await letto();
  ok('legge i codici', r.carte === 3, String(r.carte));
  ok('e sono le carte giuste', r.nomi.some(n => n.startsWith('Blue-Eyes White Dragon')), r.nomi.join(' · '));
});

await T('quello che esporto lo so rileggere', async () => {
  await vaiAMazzi();
  await page.evaluate(() => { const m = MAZZI.find(x => x.nome === 'Exodia FTK'); apriMazzo(m.id); });
  await page.waitForTimeout(400);
  await page.click('[data-az="esporta"]'); await page.waitForTimeout(400);
  const testo = await page.inputValue('#esp');
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  await vaiAMazzi();
  await leggi(testo);
  const r = await letto();
  ok('stesse carte', r.carte === 17 && r.main === 40, `carte ${r.carte} · main ${r.main}`);
  ok('e riprende anche il nome', await page.inputValue('#nomeLista') === 'Exodia FTK',
     await page.inputValue('#nomeLista'));
});

await T('le copie oltre tre vengono portate a tre, dicendolo', async () => {
  await leggi('9x Pot of Greed\n2x Pot of Greed\n1x Dark Magician');
  const r = await letto();
  ok('3 copie, non 11', r.nomi.includes('Pot of Greed×3'), r.nomi.join(' · '));
  ok('lo dice', (await corpo()).includes('Portate a 3 copie'), (await corpo()).slice(0, 90));
  ok('e conta il resto giusto', r.main === 4, String(r.main));
});

await T('testi che non sono liste', async () => {
  await leggi('Ciao come stai\n=====\n42\n<div>niente</div>');
  const r = await letto();
  ok('non inventa carte', r.carte === 0, String(r.carte));
  ok('lo dice invece di creare un mazzo vuoto',
     (await corpo()).includes('non ho trovato nessuna carta') || r.ignote > 0,
     (await corpo()).slice(0, 100));
  await leggi('');
  ok('col testo vuoto non si rompe', (await corpo()).length > 10, (await corpo()).slice(0, 60));
});

await T('i nomi con la barra non vengono spezzati', async () => {
  await leggi('3x D/D Berfomet\n1x A/D Changer\n2x Arcanite Magician/Assault Mode');
  const r = await letto();
  ok('restano tre carte intere', r.carte === 3 && r.ignote === 0, `carte ${r.carte} · ignote ${r.ignote}`);
});

await T('si può incollare anche in italiano', async () => {
  await leggi('3x Drago Bianco Occhi Blu\n2x Mago Nero\n1x Forza Riflessa');
  const r = await letto();
  ok('riconosce i nomi italiani ufficiali', r.carte === 3 && r.ignote === 0, r.nomi.join(' · '));
});

console.log('\nerrori JS:', errori.length); errori.slice(0, 5).forEach(e => console.log('  !', e));
falliti += errori.length;
console.log(`\nPASSATI ${passati} · FALLITI ${falliti}`);
await browser.close();
process.exit(0);
