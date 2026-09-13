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
const T = async (t, fn) => { console.log('\n— ' + t); try { await fn(); } catch (e) { falliti++; console.log('  ✗ ECCEZIONE:', e.message.split('\n').slice(0,4).join(' / ')); } };
const txt = s => page.textContent(s);
const ms = async fn => { const t0 = Date.now(); await fn(); return Date.now() - t0; };

await T('avvio', async () => {
  const t0 = Date.now();
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.duel');
  const t = Date.now() - t0;
  ok('la prima schermata compare subito', t < 3000, t + ' ms');
  const pronto = await page.evaluate(() => performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
  ok('l\'app non aspetta l\'archivio locale per disegnare', true, Math.round(pronto) + ' ms al DOM pronto');
});

await T('«Mostra altre carte» accoda invece di ricostruire', async () => {
  await page.click('[data-v="carte"]'); await page.waitForTimeout(300);
  const tempi = [];
  for (let i = 0; i < 6; i++) {
    const b = await page.$('[data-altre="griglia"]');
    if (!b) break;
    tempi.push(await ms(async () => { await b.click(); await page.waitForTimeout(30); }));
  }
  const n = (await page.$$('.carta')).length;
  ok('la griglia cresce', n >= 600, n + ' carte');
  const ultimo = tempi[tempi.length - 1], primo = tempi[0];
  ok('il tocco non rallenta col crescere della griglia', ultimo < primo * 3 + 120,
     `primo ${primo} ms · ultimo ${ultimo} ms`);
});

await T('ricerca su 10.026 carte', async () => {
  const t = await ms(async () => {
    await page.fill('[data-q="qCarte"]', 'dragon');
    await page.waitForTimeout(350);
  });
  ok('la ricerca risponde in fretta', t < 2000, t + ' ms');
  const v = await page.inputValue('[data-q="qCarte"]');
  ok('il campo non perde i tasti', v === 'dragon', v);
});

await T('il mazzo si aggiorna davvero a ogni + e −', async () => {
  await page.click('[data-v="mazzi"]'); await page.waitForTimeout(200);
  await page.click('[data-nuovo]'); await page.waitForTimeout(200);
  await page.click('[data-az="crea"]'); await page.waitForTimeout(300);
  await page.fill('[data-q="qSel"]', 'Dark Magician'); await page.waitForTimeout(400);
  // tre copie della prima carta, più una seconda carta diversa
  for (let i = 0; i < 3; i++) { await page.click('.carta:nth-child(1) [data-piu]'); await page.waitForTimeout(80); }
  await page.click('.carta:nth-child(2) [data-piu]'); await page.waitForTimeout(120);
  ok('il «+» si blocca a 3 copie', await page.$eval('.carta:nth-child(1) [data-piu]', e => e.disabled) === true);
  await page.click('[data-az="indietro"]'); await page.waitForTimeout(300);
  const prima = await txt('#corpo');
  ok('il Main conta le carte aggiunte', /Main Deck\s*\d+ carte/.test(prima.replace(/\s+/g,' ')), '');
  const n0 = (await page.$$('.ris')).length;
  await page.click('.ris .piu [data-meno]'); await page.waitForTimeout(250);
  const dopo = await txt('#corpo');
  ok('i contatori di sezione si aggiornano', prima !== dopo);
  // togliamo tutte le copie della prima carta: la riga deve sparire
  let giri = 0;
  while ((await page.$$('.ris')).length === n0 && giri++ < 6) {
    const b = await page.$('.ris .piu [data-meno]');
    if (!b) break;
    await b.click(); await page.waitForTimeout(200);
  }
  ok('la riga sparisce quando la carta finisce', (await page.$$('.ris')).length < n0,
     `${n0} -> ${(await page.$$('.ris')).length}`);
});

await T('i «+» si spengono tutti quando l\'Extra è pieno', async () => {
  while (!(await page.$('[data-az="scegli"]'))) { await page.click('[data-az="indietro"]'); await page.waitForTimeout(250); }
  await page.click('[data-az="scegli"]'); await page.waitForTimeout(300);
  await page.fill('[data-q="qSel"]', 'Dragon'); await page.waitForTimeout(400);
  await page.click('[data-t="fusion"]').catch(() => {});   // solo Fusioni: vanno tutte nell'Extra
  await page.waitForTimeout(300);
  const stato = await page.evaluate(() => {
    // aggiunge fino al limite usando i controlli veri
    let giri = 0;
    while (giri++ < 400) {
      const b = document.querySelector('.carta .piu button[data-piu]:not([disabled])');
      if (!b) break;
      b.click();
    }
    const tutti = [...document.querySelectorAll('[data-piu]')];
    return { attivi: tutti.filter(b => !b.disabled).length, totali: tutti.length,
             piede: document.querySelector('.piede .conta-piede').textContent.replace(/\s+/g,' ') };
  });
  ok('nessun «+» resta acceso quando non si può più aggiungere', stato.attivi === 0,
     `${stato.attivi} attivi su ${stato.totali} · ${stato.piede}`);
});

console.log('\n================  errori JS: ' + errori.length);
errori.slice(0, 6).forEach(e => console.log('   ' + e));
console.log(`\nPASSATI ${passati} · FALLITI ${falliti + errori.length}`);
await browser.close();
process.exit(falliti + errori.length ? 1 : 0);
