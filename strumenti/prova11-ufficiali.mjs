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

await T('i mazzi ufficiali sono tutti in elenco', async () => {
  ok('c\'è il modo di arrivarci', await page.$('[data-az="ufficiali"]') !== null);
  await page.click('[data-az="ufficiali"]'); await page.waitForTimeout(400);
  const n = await page.evaluate(() => document.querySelectorAll('[data-uff]').length);
  ok('settanta e passa mazzi', n >= 70, String(n));
  ok('sono raggruppati per saga', (await corpo()).includes('Duel Monsters'), (await corpo()).slice(0, 40));
  ok('la conta in cima li dichiara', (await page.textContent('.conta')).includes('mazzi'),
     await page.textContent('.conta'));
});

await T('si cercano per nome, sigla e anno', async () => {
  await page.fill('[data-q="qUff"]', 'zombie'); await page.waitForTimeout(450);
  const zombi = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('«zombie» trova i mazzi zombie', zombi.length >= 2 && zombi.every(n => /zombie/i.test(n)), zombi.join(' · '));
  await page.fill('[data-q="qUff"]', 'SDY'); await page.waitForTimeout(450);
  const sdy = await page.evaluate(() => [...document.querySelectorAll('[data-uff] .nome')].map(x => x.textContent.trim()));
  ok('la sigla trova il suo mazzo', sdy.length === 1 && /Yugi/.test(sdy[0]), sdy.join(' · '));
  await page.fill('[data-q="qUff"]', ''); await page.waitForTimeout(450);
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
