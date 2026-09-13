// I mazzi ufficiali (Structure e Starter Deck) e la pagina del database di Konami.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const FILE = 'file:///home/user/carte-lotd/lotd-duellanti.html';
let falliti = 0, passati = 0;
const ok = (n, c, e='') => { if (c) { passati++; console.log('  ✓', n, e ? '· ' + e : ''); } else { falliti++; console.log('  ✗', n, e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on('pageerror', e => errori.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load|ERR_/.test(m.text())) errori.push('CONSOLE: ' + m.text()); });
for (const p of ['**://images.ygoprodeck.com/**','**://ms.yugipedia.com/**','**://fonts.g*/**']) await page.route(p, r => r.abort());
await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.duel');
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n')[0]); } };
const corpo = () => page.evaluate(() => document.querySelector('#corpo').innerText);
const vaiAMazzi = async () => {
  while (!(await page.$('[data-v="mazzi"]'))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(200); }
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(250);
};

/* La pagina di Konami, copiata: numero di riga, nome, targhetta, quantità,
   ognuno sulla sua riga. La struttura è quella vera, le carte sono mie. */
const COPIATO = `Accedi\nHome\nRicercare Carte\nRicercare Deck\nMio Deck\n✕Chiudere
Mazzo di prova\n\nPreferiti\n1\nTipo di Deck\nDeck\nCategoria Registrata\nMago Nero
Commento\nqualche parola qui\nTotale in Main Deck\n8\nTotale in Extra Deck\n2\nTotale in Side Deck\n4
Visualizza come Elenco Dettagliato
Carte Mostro\t4
1\t\t
Mago Nero
3
2\t\t
Ragazza Maga Nera
1
Carte Magia\t3
1\t\t
Anfora dell'Avidità
Carte Limitate

Carte Limitate
1
2\t\t
Polimerizzazione
2
Carte Trappola\t1
1\t\t
Forza Riflessa
1
Extra Deck\t2
1\t\t
Paladino Oscuro
2
Side Deck\t4
1\t\t
Mostro Resuscitato
1
2\t\t
Raigeki
3`;

const HTML = `<html><body><header id="broad_title"><h1>Mazzo di prova</h1></header>
<table id="monster_list" class="deck_list">
 <tr><th colspan="3">Carte Mostro</th><th class="num"><span>4</span></th></tr>
 <tr class=' row' title="Mago Nero"><td class="row_num">1</td>
  <td class="card_name"><div class="icon"><span>Mago Nero</span></div></td>
  <td class="num"><span>3</span></td></tr>
 <tr class=' row' title="Ragazza Maga Nera"><td class="row_num">2</td>
  <td class="card_name"><div class="icon"><span>Ragazza Maga Nera</span></div></td>
  <td class="num"><span>1</span></td></tr></table>
<table id="spell_list" class="deck_list">
 <tr><th colspan="3">Carte Magia</th><th class="num"><span>1</span></th></tr>
 <tr class='limited row' title="【Carte Limitate】 Anfora dell'Avidità"><td class="row_num">1</td>
  <td class="card_name"><div class="icon"><span>Anfora dell'Avidità</span></div></td>
  <td class="num"><span>1</span></td></tr></table>
<table id="side_list" class="deck_list">
 <tr><th colspan="3">Side Deck</th><th class="num"><span>2</span></th></tr>
 <tr class=' row' title="Raigeki"><td class="row_num">1</td>
  <td class="card_name"><div class="icon"><span>Raigeki</span></div></td>
  <td class="num"><span>2</span></td></tr></table></body></html>`;

await vaiAMazzi();

/* le sigle vere dei prodotti, come stanno sui codici delle carte */
const SIGLE_TCG = ('SD1 SD2 SD3 SD4 SD5 SD6 SD7 SD8 SD09 SD10 SDRL SDDE SDZW SDSC SDWS SDMM SDMA '
  + 'SDDL SDLS SDGU SDDC SDWA SDRE SDOK SDBE SDCR SDLI SDGR SDHS SDSE SDMP SR01 SR02 SDMY SDKS '
  + 'SDPD SR03 SR04 SDCL SR05 SR06 SDPL SR07 SDSB SR08 SDRR').split(' ');
const SIGLE_OCG = ('YU KA JY PE SY2 SK2 SDM SD11 SD12 SD13 SD14 SD15 SD16 SD17 SD18 SD19 SD20 SD21 '
  + 'SD22 SD23 SD24 SD25 SD26 SD27 SD28 SD29 SD30 SD34 SD36 SD37').split(' ');

await T('i mazzi ufficiali sono tutti in elenco', async () => {
  ok('c\'è il modo di arrivarci', await page.$('[data-az="ufficiali"]') !== null);
  await page.click('[data-az="ufficiali"]'); await page.waitForTimeout(400);
  const n = await page.evaluate(() => document.querySelectorAll('[data-uff]').length);
  ok('centoventi mazzi', n >= 115, String(n));
  const sigle = await page.evaluate(() => UFFICIALI.map(u => u.s.toUpperCase()));
  const manca = l => l.filter(x => !sigle.includes(x));
  ok('ci sono tutti gli Structure e Starter Deck usciti da noi',
     manca(SIGLE_TCG).length === 0, manca(SIGLE_TCG).join(' '));
  ok('e anche quelli usciti solo in Giappone',
     manca(SIGLE_OCG).length === 0, manca(SIGLE_OCG).join(' '));
  ok('nessun mazzo senza sigla', await page.evaluate(() => UFFICIALI.every(u => u.s)));
  ok('sono raggruppati per saga', (await corpo()).includes('Duel Monsters'), (await corpo()).slice(0, 40));
  ok('la conta in cima li dichiara', (await page.textContent('.conta')).includes('mazzi'),
     await page.textContent('.conta'));
});

await T('ogni mazzo ha la sua scatola', async () => {
  const dati = await page.evaluate(() => ({
    totale: UFFICIALI.length,
    senza: UFFICIALI.filter(u => !u.i).map(u => u.s),
    esterni: UFFICIALI.filter(u => !/^https:\/\/ms\.yugipedia\.com\//.test(u.i)).length
  }));
  ok('nessuno resta senza immagine', dati.senza.length === 0, dati.senza.join(' '));
  ok('e vengono tutte dalla stessa fonte', dati.esterni === 0, String(dati.esterni));
  const rese = await page.evaluate(() => ({
    img: document.querySelectorAll('#corpo img.scatola').length,
    piccole: [...document.querySelectorAll('#corpo img.scatola')].filter(i => /120px-/.test(i.src)).length,
    ripieghi: document.querySelectorAll('#corpo div.scatola').length
  }));
  /* qui le immagini sono bloccate apposta: deve reggere il ripiego */
  ok('a schermo c\'è una scatola per riga',
     rese.img + rese.ripieghi >= 100, JSON.stringify(rese));
  ok('e se non arrivano resta il quadretto con la sigla', rese.ripieghi > 0 || rese.img > 0,
     JSON.stringify(rese));
  ok('nell\'elenco si chiedono piccole', rese.piccole > 0 || rese.img === 0,
     `${rese.piccole} di ${rese.img}`);
});

await T('i filtri dividono structure, starter e giapponesi', async () => {
  const conta = async f => { await page.click(`[data-fuff="${f}"]`); await page.waitForTimeout(350);
    return page.evaluate(() => document.querySelectorAll('[data-uff]').length); };
  const structure = await conta('structure'), starter = await conta('starter'),
        ocg = await conta('ocg'), tutti = await conta('tutti');
  ok('structure + starter fanno il totale', structure + starter === tutti,
     `${structure} + ${starter} = ${tutti}`);
  ok('i giapponesi sono una parte', ocg > 0 && ocg < tutti, `${ocg} di ${tutti}`);
});

await T('si cercano per nome, sigla e anno', async () => {
  await page.fill('[data-q="qUff"]', 'zombie'); await page.waitForTimeout(450);
  const zombi = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('«zombie» mette davanti i mazzi zombie',
     zombi.length >= 3 && zombi.slice(0, 3).every(n => /zombie/i.test(n)), zombi.slice(0, 4).join(' · '));
  await page.fill('[data-q="qUff"]', 'SDY'); await page.waitForTimeout(450);
  const sdy = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('la sigla trova il suo mazzo', sdy.length === 1 && /Yugi/.test(sdy[0]), sdy.join(' · '));
  await page.fill('[data-q="qUff"]', 'revolver'); await page.waitForTimeout(450);
  const rev = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('e trova anche i giapponesi', rev.length === 1 && /Revolver/.test(rev[0]), rev.join(' · '));
  await page.fill('[data-q="qUff"]', 'SDWA'); await page.waitForTimeout(450);
  const sdwa = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('la sigla esatta viene per prima', /Samurai/.test(sdwa[0]), sdwa.join(' · '));
  await page.fill('[data-q="qUff"]', ''); await page.waitForTimeout(450);
});

/* Un mazzo lo si cerca per quello che contiene, non per come si chiama la
   scatola: «sei samurai» deve trovare «I Samurai Signori della Guerra». */
await T('i mazzi si cercano per le carte che hanno dentro', async () => {
  const prova = async (q, atteso, minimo) => {
    await page.fill('[data-q="qUff"]', q); await page.waitForTimeout(500);
    const primi = await page.evaluate(() => [...document.querySelectorAll('[data-uff]')].slice(0, 3)
      .map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(`«${q}» → ${atteso}`, primi.length && new RegExp(atteso, 'i').test(primi[0]),
       (primi[0] || '(niente)').slice(0, 80));
    if (minimo) ok(`   e dice quante carte c'entrano (≥${minimo})`,
      new RegExp(`(\\d+) cart[ae] per`).test(primi[0]) &&
      +primi[0].match(/(\d+) cart[ae] per/)[1] >= minimo, primi[0].slice(0, 90));
  };
  await prova('sei samurai', 'Samurai Signori della Guerra', 15);
  await prova('zombie', 'Orda Zombie', 20);
  await prova('eroi elementari', "HERO", 15);
  await prova('drago bianco occhi blu', 'Drago Bianco Occhi Blu');
  await page.fill('[data-q="qUff"]', ''); await page.waitForTimeout(400);
});

await T('aprire uno Starter Deck del 2002', async () => {
  await page.evaluate(() => [...document.querySelectorAll('[data-uff]')]
    .find(b => /Yugi/.test(b.textContent) && /SDY/.test(b.textContent)).click());
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => {
    const r = riassuntoLettura(STATO.lettura, {});
    return { carte: r.carte.length, main: r.main, epoca: r.epoca, cursore: STATO.cursore,
      mancanti: STATO.lettura.mancanti, titolo: document.querySelector('.titolo').textContent.trim() };
  });
  ok('cinquanta carte', st.carte === 50, String(st.carte));
  ok('il titolo è il nome italiano del prodotto', /Yugi/.test(st.titolo), st.titolo);
  ok('l\'epoca si stringe da sola sul 2000', st.cursore === st.epoca && st.epoca < 5,
     `epoca ${st.epoca} · cursore ${st.cursore}`);
  ok('dice che ci sono tutte', (await corpo()).includes('Tutte le carte del prodotto'),
     (await corpo()).slice(0, 70));
  ok('in cima c\'è la scatola del prodotto',
     await page.$('.scatola.grande') !== null);
  ok('con sigla, anno e tipo', /SDY · 2002 · Starter Deck/.test(await page.textContent('.testa-prodotto')),
     (await page.textContent('.testa-prodotto')).replace(/\s+/g, ' ').trim().slice(0, 60));
  ok('e spiega che le copie non sono dichiarate', (await corpo()).includes('un esemplare per carta'));
});

await T('da un mazzo ufficiale nasce una ricetta vera', async () => {
  const prima = await page.evaluate(() => MAZZI.length);
  await page.click('[data-az="crea-lista"]'); await page.waitForTimeout(600);
  const m = await page.evaluate(() => { const m = mazzoAperto();
    return m && { nome: m.nome, main: conta(m, false), cursore: m.cursore, fuori: fuoriEpoca(m).length }; });
  ok('il mazzo esiste ed è aperto', !!m && m.main === 50, JSON.stringify(m));
  ok('col nome del prodotto', /Yugi/.test(m.nome), m.nome);
  ok('nessuna carta fuori dalla sua epoca', m.fuori === 0, String(m.fuori));
  ok('ed è uno in più di prima', await page.evaluate(() => MAZZI.length) === prima + 1);
});

await T('uscendo si torna all\'elenco e l\'epoca è quella di prima', async () => {
  const prima = await page.evaluate(() => STATO.cursorePrima);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  await vaiAMazzi();
  await page.click('[data-az="ufficiali"]'); await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('[data-uff]')]
    .find(b => /Joey/.test(b.textContent)).click());
  await page.waitForTimeout(500);
  ok('un mazzo con una carta che manca lo dice',
     (await corpo()).includes('non esiste in questo gioco'), (await corpo()).slice(0, 80));
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  ok('si torna all\'elenco dei mazzi ufficiali',
     await page.evaluate(() => STATO.schermata) === 'ufficiali',
     String(await page.evaluate(() => STATO.schermata)));
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  ok('e poi ai mazzi', await page.evaluate(() => STATO.vista) === 'mazzi');
  ok('l\'epoca di prima è tornata', await page.evaluate(() => STATO.cursorePrima) === null,
     String(await page.evaluate(() => STATO.cursorePrima)));
});

await T('la pagina di Konami, copiata e incollata', async () => {
  await page.click('[data-az="incolla"]'); await page.waitForTimeout(300);
  await page.fill('#lista', COPIATO);
  await page.click('[data-az="leggi"]'); await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const r = riassuntoLettura(STATO.lettura, {});
    return { nome: STATO.lettura.nome, dichiarati: STATO.lettura.dichiarati, side: STATO.lettura.side,
      main: r.main, extra: r.extra, carte: r.carte.map(x => CARTE[x.k][0] + '×' + x.qta),
      ignote: r.ignote.map(x => x.v.testo) };
  });
  ok('legge le quantità che stanno sulla riga dopo', st.main === 8 && st.extra === 2,
     `main ${st.main} · extra ${st.extra}`);
  ok('con le carte giuste', st.carte.join(' · ') ===
     'Dark Magician×3 · Dark Magician Girl×1 · Pot of Greed×1 · Polymerization×2 · Mirror Force×1 · Dark Paladin×2',
     st.carte.join(' · '));
  ok('il Side Deck resta fuori', st.side === 4, String(st.side));
  ok('prende il nome del mazzo', st.nome === 'Mazzo di prova', String(st.nome));
  ok('legge i totali dichiarati dalla pagina',
     st.dichiarati && st.dichiarati.main === 8 && st.dichiarati.side === 4, JSON.stringify(st.dichiarati));
  ok('e dice che tornano', (await corpo()).includes('Torna.'), (await corpo()).slice(0, 110));
  ok('non prende il menu e i commenti per carte', st.ignote.length === 0, st.ignote.join(' · '));
});

await T('la stessa pagina letta come HTML, se il download riesce', async () => {
  const st = await page.evaluate(h => {
    const l = leggiHtmlKonami(h);
    if (!l) return null;
    const r = riassuntoLettura(l, {});
    return { nome: l.nome, side: l.side, main: r.main, dichiarati: l.dichiarati,
      carte: r.carte.map(x => CARTE[x.k][0] + '×' + x.qta), ignote: r.ignote.length };
  }, HTML);
  ok('riconosce la pagina', !!st);
  ok('legge nome, carte e quantità', st && st.nome === 'Mazzo di prova' && st.main === 5,
     JSON.stringify(st && { nome: st.nome, main: st.main }));
  ok('la targhetta 【Carte Limitate】 non entra nel nome',
     st && st.carte.includes('Pot of Greed×1') && st.ignote === 0, st && st.carte.join(' · '));
  ok('il Side Deck resta fuori anche qui', st && st.side === 2, st && String(st.side));
});

await T('un indirizzo che non si può leggere lo dice e apre la pagina', async () => {
  await page.click('[data-az="indietro"]').catch(() => {});
  await page.waitForTimeout(250);
  if (!(await page.$('#lista'))) { await vaiAMazzi(); await page.click('[data-az="incolla"]'); await page.waitForTimeout(300); }
  await page.fill('#lista', 'https://www.db.yugioh-card.com/yugiohdb/member_deck.action?cgid=test&dno=1');
  await page.click('[data-az="leggi"]');
  await page.waitForTimeout(1500);
  ok('mentre prova lo dice', true);
  await page.waitForSelector('[data-az="leggi"]', { timeout: 45000 });
  await page.waitForTimeout(500);
  const testo = await corpo();
  ok('spiega che non dipende dall\'utente', /non lascia che sia un'altra pagina/.test(testo),
     testo.slice(0, 120));
  const link = await page.evaluate(() => { const a = document.querySelector('#corpo a[target="_blank"]');
    return a && { href: a.getAttribute('href'), testo: a.textContent.trim() }; });
  ok('e offre di aprirla', link && /db\.yugioh-card\.com/.test(link.href), JSON.stringify(link));
  ok('il testo incollato resta lì', (await page.inputValue('#lista')).includes('db.yugioh-card.com'));
});

console.log('\nerrori JS:', errori.length); errori.slice(0, 5).forEach(e => console.log('  !', e));
falliti += errori.length;
console.log(`\nPASSATI ${passati} · FALLITI ${falliti}`);
await browser.close();
process.exit(0);
