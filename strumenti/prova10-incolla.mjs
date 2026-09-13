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

await T('una carta si toglie e si rimette, senza che le righe scivolino', async () => {
  const prima = (await letto()).carte;
  await page.evaluate(() => document.querySelector('#corpo .ris .via-voce').click());
  await page.waitForTimeout(350);
  ok('una in meno', (await letto()).carte === prima - 1, `${prima} → ${(await letto()).carte}`);
  ok('ma la riga resta lì, barrata', await page.$('#corpo .ris.tolta') !== null);
  await page.evaluate(() => document.querySelector('#corpo [data-rimetti]').click());
  await page.waitForTimeout(350);
  ok('e si rimette', (await letto()).carte === prima, String((await letto()).carte));
  await page.evaluate(() => document.querySelector('#corpo .ris .via-voce').click());
  await page.waitForTimeout(300);
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

await T('il Side Deck non entra nel mazzo', async () => {
  await leggi('Main Deck\n3x Pot of Greed\n2x Dark Magician\nSide Deck (15)\n3x Maxx "C"\n3x Solemn Judgment');
  const r = await letto();
  ok('prende solo il Main', r.carte === 2 && r.main === 5, `carte ${r.carte} · main ${r.main}`);
  ok('e conta quelle lasciate fuori',
     await page.evaluate(() => STATO.lettura.side) === 6,
     String(await page.evaluate(() => STATO.lettura.side)));
  ok('dicendolo a schermo', (await corpo()).includes('Side Deck non c'), (await corpo()).slice(0, 120));
});

await T('un refuso si corregge da solo, dicendolo', async () => {
  await leggi('3x Pot of Gred\n2x Dark Magiciann\n1x Mirrorr Force');
  const r = await letto();
  ok('le tre carte ci sono lo stesso', r.carte === 3, String(r.carte));
  ok('sono quelle giuste', r.nomi.join(' ').includes('Pot of Greed') && r.nomi.join(' ').includes('Dark Magician'),
     r.nomi.join(' · '));
  ok('e lo dichiara invece di farlo di nascosto',
     (await corpo()).includes('interpretate') || (await corpo()).includes('interpretata'),
     (await corpo()).slice(0, 80));
  ok('con le alternative da toccare', (await page.$$('[data-scelta]')).length > 0);
});

await T('quando due carte si somigliano non indovina: chiede', async () => {
  await leggi('3x Red-Eyes Black Dragon');
  const r = await letto();
  ok('non la mette dentro a caso', r.carte === 0 && r.ignote === 1, `carte ${r.carte} · ignote ${r.ignote}`);
  const scelte = await page.evaluate(() => STATO.lettura.voci[0].scelte.map(k => CARTE[k][0]));
  ok('ma propone anche quella giusta del gioco', scelte.includes('Red-Eyes B. Dragon'), scelte.join(' · '));
});

await T('intestazioni e titoli in italiano', async () => {
  await leggi('Mazzo Exodia — lista di Marti\nMostri (8)\n3x Royal Magical Library\nCarte Magia (12)\n3x Pot of Greed\nTotale: 40 carte\nhttps://ygoprodeck.com/deck/exodia-1');
  const r = await letto();
  ok('legge solo le due carte', r.carte === 2, String(r.carte) + ' · ' + r.nomi.join(' · '));
  ok('e prende il titolo come nome',
     await page.inputValue('#nomeLista') === 'Mazzo Exodia — lista di Marti',
     await page.inputValue('#nomeLista'));
});

await T('più carte sulla stessa riga, anche senza quantità', async () => {
  await leggi('Mostro Resuscitato, Buco Nero, Raigeki\nMago Nero e Ragazza Maga Nera\n2x Adreus, Keeper of Armageddon');
  const r = await letto();
  ok('le separa quando sono carte vere', r.carte === 6, String(r.carte) + ' · ' + r.nomi.join(' · '));
  ok('ma non spezza un nome che contiene una virgola',
     r.nomi.includes('Adreus, Keeper of Armageddon×2'), r.nomi.join(' · '));
});

await T('quantità scritte in tutti i modi', async () => {
  await leggi('Pot of Greed: 3\nDark Magician .... 2\ntre Anfora dell\'Avidità\n3 copie di Strega della Foresta Nera\nn. 2 Mago della Fede\nMirror Force (x3)');
  const r = await letto();
  const attesi = { 'Pot of Greed': 3, 'Dark Magician': 2, 'Witch of the Black Forest': 3,
    'Magician of Faith': 2, 'Mirror Force': 3 };
  for (const [n, q] of Object.entries(attesi))
    ok(`${n} ×${q}`, r.nomi.includes(`${n}×${q}`), r.nomi.join(' · '));
});

await T('i casi limite misurati sull\'archivio', async () => {
  await leggi('7\n3 7\n2 XX-Saber Faultroll\n3x Mask Change 2\n1x Lord of D.\n3 "A" Cell Breeding Device');
  const r = await letto();
  const atteso = ['7×3', 'XX-Saber Faultroll×2', 'Mask Change II×3', 'Lord of D.×1',
    '"A" Cell Breeding Device×3'];
  for (const a of atteso) ok(a.replace('×', ' ×'), r.nomi.includes(a), r.nomi.join(' · '));
});

await T('l\'unico nome che è inglese di una carta e italiano di un\'altra', async () => {
  await leggi('1 Doppelganger');
  const r = await letto();
  ok('non sceglie da solo: chiede', r.scegliere === 1, `carte ${r.carte} · dubbie ${r.scegliere}`);
  const scelte = await page.evaluate(() => STATO.lettura.voci[0].scelte.map(k => CARTE[k][0]));
  ok('propone tutte e due', scelte.length === 2 && scelte.includes('Doppelganger') && scelte.includes('Mimicat'),
     scelte.join(' · '));
});

/* I tre difetti trovati dalla revisione: ognuna di queste prove fallisce sulla
   versione di prima, e ognuna produceva un mazzo illegale senza dirlo. */
await T('la stessa carta scritta in due modi non raddoppia le copie', async () => {
  await leggi('3x Pot of Greed\n2x Pot of Gred');
  const r = await letto();
  ok('tre copie, non cinque', r.nomi.join(' ') === 'Pot of Greed×3', r.nomi.join(' · '));
  ok('e lo dichiara', (await corpo()).includes('ne chiedeva 5'), (await corpo()).slice(0, 100));
  ok('il Main conta tre', r.main === 3, String(r.main));
});

await T('una sotto-intestazione dentro il Side Deck non riapre il Main', async () => {
  await leggi('Main Deck\n3x Pot of Greed\nSide Deck (15)\nMagie\n3x Maxx "C"\n3x Solemn Judgment');
  const r = await letto();
  ok('il Side resta fuori tutto', r.main === 3 && r.carte === 1, `main ${r.main} · carte ${r.carte}`);
  ok('e viene contato', await page.evaluate(() => STATO.lettura.side) === 6,
     String(await page.evaluate(() => STATO.lettura.side)));
});

await T('un mazzo con più di 3 copie non si dice pronto', async () => {
  const s = await page.evaluate(() => {
    const m = nuovoMazzo('prova copie', ULTIMA);
    m.carte['Pot of Greed'] = 6;
    for (let i = 0; i < 40; i++) m.carte[CARTE[i][0]] = 1;
    const s = semaforo(m);
    MAZZI = MAZZI.filter(x => x.id !== m.id); salvaMazzi(true);
    return s;
  });
  ok('il semaforo lo dice', s[0] === 'male' && /6 copie di Pot of Greed/.test(s[1]), s.join(' · '));
});

await T('la ✕ toglie tutte le righe di quella carta', async () => {
  await leggi('3x Pot of Greed\n2x Pot of Gred\n1x Dark Magician');
  ok('due carte', (await letto()).carte === 2, String((await letto()).carte));
  await page.evaluate(() => [...document.querySelectorAll('[data-togli-voce]')]
    .find(b => b.getAttribute('aria-label') === 'Togli Pot of Greed').click());
  await page.waitForTimeout(300);
  const r = await letto();
  ok('sparisce del tutto, non una riga sola', r.carte === 1 && r.nomi[0].startsWith('Dark Magician'),
     r.nomi.join(' · '));
});

/* I difetti trovati dalla revisione avversariale sulla lettura. */
await T('l\'app sa rileggere il mazzo che ha appena esportato', async () => {
  const male = await page.evaluate(() => {
    const male = [];
    for (let k = 0; k < CARTE.length; k++) {
      const v = leggiLista(`2 ${CARTE[k][N]}`).voci[0];
      if (!v || v.qta !== 2 || (v.stato !== "ok" && v.stato !== "vicina") || v.k !== k)
        male.push(CARTE[k][N] + ' → ' + (v ? v.stato + ' ' + (v.k !== undefined ? CARTE[v.k][N] : v.testo) : 'niente'));
    }
    return male;
  });
  ok('tutte e 10.026 le carte tornano identiche',
     male.length === 0 || (male.length === 1 && /Doppelganger/.test(male[0])),
     male.slice(0, 4).join(' · ') || 'nessun errore');
});

await T('l\'epoca segue quello che c\'è davvero nel mazzo', async () => {
  await leggi('3x Pot of Greed\n1x Accesscode Talker');
  const prima = await page.evaluate(() => ({ cursore: STATO.cursore,
    epoca: riassuntoLettura(STATO.lettura, STATO.scelteLettura).epoca }));
  ok('parte dall\'epoca delle carte lette', prima.cursore === prima.epoca, JSON.stringify(prima));
  await page.evaluate(() => document.querySelector('#corpo [data-scelta]').click());
  await page.waitForTimeout(400);
  const dopo = await page.evaluate(() => ({ cursore: STATO.cursore,
    epoca: riassuntoLettura(STATO.lettura, STATO.scelteLettura).epoca }));
  ok('risolvendo una carta più recente, l\'epoca si allarga da sola',
     dopo.cursore === dopo.epoca && dopo.epoca > prima.epoca, JSON.stringify({ prima, dopo }));
  await page.click('[data-az="crea-lista"]'); await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const m = mazzoAperto();
    return m && { cursore: m.cursore, fuori: fuoriEpoca(m).length }; });
  ok('e il mazzo nasce con quell\'epoca, senza carte fuori', m.fuori === 0 && m.cursore === dopo.epoca,
     JSON.stringify(m));
  await page.click('[data-az="indietro"]').catch(() => {});
  await page.waitForTimeout(300);
});

await T('l\'epoca scelta a mano non viene più spostata', async () => {
  await leggi('3x Pot of Greed\n1x Dark Magician');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tacca]')]
    .find(x => x.textContent.includes('Tutto il gioco')); if (b) b.click(); });
  await page.waitForTimeout(400);
  ok('resta dove l\'ho messa', await page.evaluate(() => STATO.cursore === ULTIMA && !STATO.epocaAuto),
     String(await page.evaluate(() => STATO.cursore)));
});

await T('nel resoconto la scheda della carta non porta via da lì', async () => {
  await page.evaluate(() => document.querySelector('#corpo .ris [data-c]').click());
  await page.waitForSelector('.velo');
  ok('niente menù «aggiungi a un mazzo»', await page.$('.velo #selMazzo') === null);
  await page.click('.velo .chiudi'); await page.waitForTimeout(200);
  ok('e il resoconto è ancora lì', await page.evaluate(() => STATO.schermata) === 'letto');
});

await T('le pieghe che buttano via parole si dichiarano', async () => {
  await leggi('1 Elemental HERO Neos - Dominanc\n2 Pot of Greed (LOB-005)');
  const r = await letto();
  ok('la carta col codice del set entra in silenzio', r.nomi.includes('Pot of Greed×2'), r.nomi.join(' · '));
  ok('quella a cui ho tolto la coda viene dichiarata',
     (await corpo()).includes('interpretat'), (await corpo()).slice(0, 90));
});

await T('cifre a larghezza piena e altre stranezze', async () => {
  await leggi('３ｘ Dark Magician\n2 Copia di Xing Zhen Hu\n3 Fusione Pendulum\n0x Pot of Greed');
  const r = await letto();
  ok('«３ｘ» vale come «3x»', r.nomi.includes('Dark Magician×3'), r.nomi.join(' · '));
  ok('«Copia di Xing Zhen Hu» non diventa «Xing Zhen Hu»',
     r.nomi.includes('Xing Zhen Hu Replica×2'), r.nomi.join(' · '));
  ok('«Fusione Pendulum» non è un\'intestazione', r.nomi.some(n => /Pendulum Fusion|Fusione/.test(n)),
     r.nomi.join(' · '));
  ok('«0x» vuol dire nessuna copia', !r.nomi.some(n => /Pot of Greed/.test(n)), r.nomi.join(' · '));
});

console.log('\nerrori JS:', errori.length); errori.slice(0, 5).forEach(e => console.log('  !', e));
falliti += errori.length;
console.log(`\nPASSATI ${passati} · FALLITI ${falliti}`);
await browser.close();
process.exit(0);
