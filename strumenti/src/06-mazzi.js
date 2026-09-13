
/* =====================================================================
   RICETTE (mazzi)
   L'epoca è un campo del mazzo: aprirlo allinea tutta l'app a quell'epoca,
   chiuderlo ripristina quella di prima. Un'epoca che viene da un mazzo non
   si salva, altrimenti domani riapriresti l'app filtrato da un mazzo di ieri.
   ===================================================================== */

function nuovoMazzo(nome, cursore) {
  const m = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nome: nome, cursore: cursore, carte: {}, creato: Date.now(), modificato: Date.now() };
  MAZZI.push(m); salvaMazzi(true);
  return m;
}
/* L'epoca di un mazzo è sua: entrando ci si allinea, uscendo si torna alla
   propria. Va ricordata PRIMA di toccare il cursore, altrimenti scegliendo
   l'epoca del nuovo mazzo si perde quella di partenza. */
function entraInContesto() {
  if (STATO.cursorePrima === null) STATO.cursorePrima = STATO.cursore;
}
function esciDalContesto() {
  if (STATO.cursorePrima !== null) STATO.cursore = STATO.cursorePrima;
  STATO.cursorePrima = null;
}
function apriMazzo(id) {
  const m = mazzoDi(id); if (!m) return;
  entraInContesto();
  STATO.mazzo = id; STATO.cursore = m.cursore; STATO.soloNuove = false;
  vaiA({ schermata: "mazzo" });
}
function chiudiMazzo() {
  esciDalContesto();
  STATO.mazzo = null; STATO.pannello = false;
  vaiA({ schermata: null, vista: "mazzi" });
}

/* ---- elenco ---- */
function vistaMazzi() {
  const corpo = () => {
    if (!MAZZI.length) return `<p class="vuoto">Non hai ancora nessuna ricetta.</p>
      <p class="nota">Una ricetta è un mazzo legato a un'epoca: dentro trovi solo le carte
      che esistevano fino a lì, e l'app ti dice dove andarle a prendere.</p>
      <div class="duellanti">${[[SAGHE[0].ultima, "Un mazzo di Duel Monsters"],
        [SAGHE[1].ultima, "Un mazzo di GX"], [ULTIMA, "Un mazzo senza limiti"]].map(([c, t]) =>
        `<button class="duel" data-nuovo="${c}">
          <div class="saga-t" style="background:${coloreTacca(c)}">＋</div>
          <span><span class="nome">${esc(t)}</span>
          <small>${num(CUM[c])} carte fra cui scegliere</small></span></button>`).join("")}</div>`;
    return `<div class="duellanti">${MAZZI.slice().sort((a, b) => b.modificato - a.modificato)
      .map(m => {
        const [cl, testo] = semaforo(m), fuori = fuoriEpoca(m).length;
        return `<button class="duel" data-mazzo="${esc(m.id)}">
          <div class="saga-t" style="background:${coloreTacca(m.cursore)}">${esc(TACCHE[m.cursore].fs
            ? sigla(SAGHE[TACCHE[m.cursore].s].nome) : String(TACCHE[m.cursore].a))}</div>
          <span style="min-width:0"><span class="nome">${esc(m.nome)}</span>
          <small>${esc(etichettaCursore(m.cursore))} · Main ${conta(m, false)} · Extra ${conta(m, true)}</small>
          <small class="${cl}">${esc(testo)}${fuori ? ` · ${fuori} fuori epoca` : ""}</small></span></button>`;
      }).join("")}</div>
      <button class="azione" data-nuovo="${STATO.cursore}">＋ Nuovo mazzo</button>
      <p class="nota">I mazzi restano dentro questo browser: se pulisci i dati spariscono.
        Copiali per tenerli al sicuro.</p>`;
  };
  return { titolo: "Le tue ricette", conta: MAZZI.length + " mazzi", corpo };
}

/* ---- nuovo mazzo ---- */
function vistaNuovo() {
  const corpo = () => `
    <label class="etichetta" for="nm">Nome del mazzo</label>
    <input class="campo" id="nm" value="${esc(STATO.nomeNuovo || "Mazzo " + (MAZZI.length + 1))}">
    <label class="etichetta">Epoca del mazzo</label>
    <div class="filtri">${SAGHE.map((s, i) =>
      `<button class="f" data-tacca="${s.ultima}" aria-pressed="${STATO.cursore === s.ultima}">
        <i class="pallino" style="background:${s.colore}"></i>${esc(s.nome)}</button>`).join("")}
      <button class="f" data-tacca="${ULTIMA}" aria-pressed="${STATO.cursore >= ULTIMA}">Tutto il gioco</button></div>
    <p class="nota">Puoi anche scegliere un anno preciso dalla barra qui sopra.</p>
    <p class="anteprima">Con questa epoca hai <b>${num(CUM[STATO.cursore])}</b> carte fra cui scegliere</p>
    <button class="azione" data-az="crea">Crea e aggiungi carte</button>`;
  return { titolo: "Nuovo mazzo", indietro: true, corpo };
}

/* ---- il mazzo ---- */
function vistaMazzo() {
  const m = mazzoAperto();
  if (!m) return vistaMazzi();
  const corpo = () => {
    const fuori = fuoriEpoca(m);
    const extra = elencoZona(m, true), main = elencoZona(m, false);
    const gruppi = [["Mostri", main.filter(n => MOSTRI.has(cornice(CARTE[trovaCarta(n)])))],
      ["Magie", main.filter(n => cornice(CARTE[trovaCarta(n)]) === "spell")],
      ["Trappole", main.filter(n => cornice(CARTE[trovaCarta(n)]) === "trap")]];
    const soloDM = m.cursore < SAGHE[2].prima;
    return `
      ${STATO.avvisoSalvataggio ? `<p class="avviso">Non riesco a salvare su questo dispositivo —
        copia il mazzo prima di chiudere.</p>` : ""}
      ${fuori.length ? `<div class="avviso">⚠ ${fuori.length}
        ${fuori.length === 1 ? "carta è fuori" : "carte sono fuori"} dalla tua epoca
        <div>${fuori.map(n => `<span class="chip">${esc(n)}
          <b data-via="${esc(n)}">✕</b></span>`).join("")}</div>
        ${m.cursore < ULTIMA ? `<button class="azione second" data-az="allarga">Sposta il mazzo a tutto il gioco
          (+${num(CUM[ULTIMA] - CUM[m.cursore])} carte)</button>` : ""}</div>` : ""}

      <div class="sezione"><h3>Main Deck</h3>
        <small class="${conta(m, false) >= 40 && conta(m, false) <= 60 ? "bene" : "male"}">${conta(m, false)} carte (40–60)</small></div>
      ${main.length ? gruppi.map(([t, ns]) => ns.length
        ? `<p class="serie">${t} · ${ns.reduce((a, n) => a + m.carte[n], 0)}</p>` + ns.map(rigaMazzo).join("")
        : "").join("") : `<p class="vuoto">Nessuna carta nel Main.</p>`}

      <div class="sezione"><h3>Extra Deck</h3>
        <small class="${conta(m, true) <= 15 ? "" : "male"}">${conta(m, true)} carte (max 15)</small></div>
      ${soloDM ? `<p class="nota">Epoca ${esc(m.cursore >= ULTIMA ? "senza limiti"
        : etichettaBreve(m.cursore))}: nell'Extra Deck solo Fusioni.</p>` : ""}
      ${extra.length ? extra.map(rigaMazzo).join("") : `<p class="vuoto">Extra Deck vuoto.</p>`}

      <div class="duo">
        <button class="azione second" data-az="spesa">Dove trovarle</button>
        <button class="azione second" data-az="esporta">Esporta</button>
      </div>
      <button class="azione pericolo" data-az="elimina">Elimina questo mazzo</button>`;
  };
  return {
    titolo: m.nome, indietro: true,
    testa: `<div class="testa-mazzo">
      <input class="campo nome-mazzo" id="nomeMazzo" value="${esc(m.nome)}" aria-label="Nome del mazzo">
      <span class="suggerimento">tocca per rinominare</span></div>`,
    corpo
  };
}

function rigaMazzo(nome) {
  const k = trovaCarta(nome), c = CARTE[k], m = mazzoAperto();
  const fuori = !dentroA(k, m.cursore);
  return `<div class="ris${fuori ? " fuori" : ""}">
    <button class="tocca-ris" data-c="${k}">
      ${c[ID] ? `<img src="${img(c[ID])}" alt="" loading="lazy">` : `<div class="vuota"></div>`}</button>
    <span style="min-width:0;flex:1">
      <button class="tocca-ris" data-c="${k}"><span class="nome">${esc(c[N])}</span></button>
      <small>${esc(CORNICE[cornice(c)] ? CORNICE[cornice(c)][0] : "")} · ${c[A] || "?"}${
        fuori ? " · fuori dalla tua epoca" : ""}</small></span>
    ${controlloCopie(k, "largo")}</div>`;
}

/* ---- selettore carte ---- */
function vistaSelettore() {
  const m = mazzoAperto();
  const corpo = () => {
    let ch = cerca(TUTTE, STATO.qSel);
    ch = filtraCornici(ch);
    const dentroCh = ch.filter(k => dentroA(k, m.cursore));
    const fuoriCh = STATO.mostraFuori ? ch.filter(k => !dentroA(k, m.cursore)) : [];
    const vuoto = !dentroCh.length
      ? `<p class="vuoto">Nessuna carta ${esc(etichettaCursore(m.cursore))}${
          STATO.tipiAttivi.size ? " di questo tipo" : ""}.
        ${STATO.mostraFuori ? "" : `<br><button class="azione second" data-az="fuori">Mostra anche le carte fuori epoca</button>`}</p>`
      : "";
    return chipCornici(ch) + `
      <button class="f blocco" data-az="fuori" aria-pressed="${STATO.mostraFuori}">Mostra anche le carte fuori dalla tua epoca</button>
      <p class="serie">${num(dentroCh.length)} carte nella tua epoca</p>
      ${vuoto || grigliaCarte(dentroCh)}
      ${fuoriCh.length ? `<p class="serie">Fuori dalla tua epoca · ${num(fuoriCh.length)}</p>
        <div class="carte">${fuoriCh.slice(0, 60).map(cartaHTML).join("")}</div>` : ""}`;
  };
  return {
    titolo: "Aggiungi carte", indietro: true,
    testa: campoRicerca("Cerca una carta o un archetipo", STATO.qSel, "qSel"),
    corpo
  };
}

/* ---- dove trovarle: la lista della spesa ---- */
function vistaSpesa() {
  const m = mazzoAperto();
  const corpo = () => {
    const nomi = Object.keys(m.carte);
    const chiavi = nomi.map(trovaCarta).filter(k => k !== undefined);
    const perLuogo = new Map();
    const trovate = new Set();
    for (const k of chiavi) {
      for (const l of new Set([CARTE[k][BU], ...CARTE[k][FO]])) {
        if (!perLuogo.has(l)) perLuogo.set(l, []);
        perLuogo.get(l).push(k);
        trovate.add(k);
      }
    }
    const righe = tipo => [...perLuogo.entries()]
      .filter(([l]) => (LUOGHI[l].tipo === "busta") === (tipo === "busta"))
      .sort((a, b) => b[1].length - a[1].length)
      .map(([l, ks]) => {
        const L = LUOGHI[l], rare = ks.filter(k => CARTE[k][R]).length;
        return `<button class="riga-fonte" data-l="${l}">
          <span class="tipo">${esc(ICONA[L.tipo])}</span>
          <span style="min-width:0"><b>${esc(nomeLuogo(l))}</b>
          <small>${ks.length} ${plurale(ks.length, "carta", "carte")} del tuo mazzo${
            L.tipo === "busta" ? ` su ${num(L.taglia)}${L.rarNota && rare ? ` · ${rare} rare` : ""}`
            : ` · ${esc(dettaglioLuogoTesto(l))}`}</small></span>
          <span class="quanto">${ks.length}</span></button>`;
      }).join("");
    const mancanti = chiavi.filter(k => !trovate.has(k));
    const tot = chiavi.reduce((a, k) => a + m.carte[CARTE[k][N]], 0);
    return `<p class="nota-testa">Ti servono ${num(tot)} carte in tutto, ${num(chiavi.length)} diverse.
        Prima i duelli: si vincono una volta sola. Poi le buste, dalla più ricca.</p>
      <div class="sezione"><h3>Duelli da vincere</h3></div>
      ${righe("duello") || `<p class="vuoto">Nessuna carta del mazzo si vince in duello.</p>`}
      <div class="sezione"><h3>Buste da comprare</h3></div>
      ${righe("busta") || `<p class="vuoto">Il mazzo è vuoto.</p>`}
      ${mancanti.length ? `<div class="sezione"><h3>Non trovate da nessuna parte</h3></div>
        ${mancanti.map(k => `<p class="avviso">${esc(CARTE[k][N])}</p>`).join("")}` : ""}
      <button class="azione second" data-az="copia-spesa">Copia la lista</button>`;
  };
  return { titolo: "Dove trovarle", indietro: true, corpo };
}

/* ---- esportazione ---- */
function testoMazzo(m) {
  const r = [`# ${m.nome}`, `# Epoca: ${etichettaCursore(m.cursore)}`, "", "Main"];
  for (const n of elencoZona(m, false)) r.push(`${m.carte[n]} ${n}`);
  r.push("", "Extra");
  for (const n of elencoZona(m, true)) r.push(`${m.carte[n]} ${n}`);
  return r.join("\n");
}
function testoSpesa(m) {
  const chiavi = Object.keys(m.carte).map(trovaCarta).filter(k => k !== undefined);
  const perLuogo = new Map();
  for (const k of chiavi) for (const l of new Set([CARTE[k][BU], ...CARTE[k][FO]])) {
    if (!perLuogo.has(l)) perLuogo.set(l, []);
    perLuogo.get(l).push(CARTE[k][N]);
  }
  const ordinati = [...perLuogo.entries()].sort((a, b) =>
    (LUOGHI[a[0]].tipo === "busta") - (LUOGHI[b[0]].tipo === "busta") || b[1].length - a[1].length);
  return [`# Dove trovare le carte di ${m.nome}`, ""].concat(
    ordinati.map(([l, ns]) => `${nomeLuogo(l)} (${ns.length})\n  ` + ns.sort().join("\n  "))).join("\n");
}
function vistaEsporta() {
  const m = mazzoAperto();
  const corpo = () => `<p class="nota">Copia questo testo e tienilo al sicuro: i mazzi vivono
      solo dentro questo browser.</p>
    <textarea class="campo" id="esp" readonly>${esc(testoMazzo(m))}</textarea>
    <button class="azione" data-az="copia-mazzo">Copia negli appunti</button>`;
  return { titolo: "Esporta " + m.nome, indietro: true, corpo };
}

async function copia(testo, bottone) {
  try { await navigator.clipboard.writeText(testo); }
  catch (e) {
    const t = document.createElement("textarea");
    t.value = testo; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e2) {}
    t.remove();
  }
  if (bottone) { const p = bottone.textContent; bottone.textContent = "Copiato ✓";
    setTimeout(() => { bottone.textContent = p; }, 1500); }
}
