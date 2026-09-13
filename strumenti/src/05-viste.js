
/* =====================================================================
   Carte: la piastrella
   ===================================================================== */
/* Il puntino oro marca le carte NATE nella saga a cui punta il cursore.
   Nella prima saga non avrebbe senso (sarebbero tutte), e non va mai messo
   su una carta che l'epoca esclude. */
const nuovaQui = k => epocaAttiva() && dentro(k) &&
  SAGHE[sagaDelCursore()].prima > 0 && CARTE[k][T] >= SAGHE[sagaDelCursore()].prima;

function cartaHTML(k) {
  const c = CARTE[k], m = mazzoAperto();
  const fuori = !dentro(k);
  const col = CORNICE[cornice(c)] ? CORNICE[cornice(c)][1] : "transparent";
  const nuova = nuovaQui(k);
  return `<div class="carta${fuori ? " fuori" : ""}">
    <button class="tocca" data-c="${k}" aria-label="${esc(c[N])}">
      ${c[ID] ? `<img src="${img(c[ID])}" alt="${esc(c[N])}" loading="lazy" decoding="async">`
              : `<div class="vuota">${esc(c[N])}</div>`}
      ${c[R] ? `<i class="rara" title="rara"></i>` : ""}
      <span class="n" style="border-left-color:${col}">${esc(c[N])}</span></button>
    <span class="anno${nuova ? " nuovo" : ""}">${c[A] || "?"}</span>
    ${m ? controlloCopie(k, "tile") : ""}</div>`;
}

function controlloCopie(k, forma) {
  const m = mazzoAperto();
  if (!m) return "";
  const q = copie(m, CARTE[k][N]), no = perchéNo(m, k);
  return `<div class="piu ${forma === "largo" ? "largo " : ""}ct${k}">${q
      ? `<button data-meno="${k}" aria-label="Togli una copia">−</button><b>${q}</b>` : ""
    }<button data-piu="${k}" ${no ? `disabled title="${esc(no)}"` : ""} aria-label="Aggiungi una copia">+</button></div>`;
}
/* Aggiornamento chirurgico: con più di mille risultati a schermo, rigenerare
   tutto a ogni "+" riporterebbe in cima e farebbe perdere il segno. */
function aggiornaControllo(k) {
  for (const el of document.querySelectorAll(".ct" + k))
    el.outerHTML = controlloCopie(k, el.classList.contains("largo") ? "largo" : "tile");
  const m = mazzoAperto();
  for (const el of document.querySelectorAll(".copie-testo"))
    if (m) el.textContent = copie(m, CARTE[k][N]) + " copie";
  aggiornaPiede();
}

function grigliaCarte(chiavi, vuoto) {
  const mostrate = chiavi.slice(0, STATO.limite);
  if (!chiavi.length) return vuoto || `<p class="vuoto">Nessuna carta.</p>`;
  return `<div class="carte">${mostrate.map(cartaHTML).join("")}</div>
    ${chiavi.length > STATO.limite
      ? `<button class="azione second" data-az="altre">Mostra altre carte (${num(chiavi.length - STATO.limite)} rimaste)</button>`
      : ""}`;
}

/* Carte che corrispondono al testo cercato: nome o archetipo.
   Cercando "Dark Magician" escono anche le carte dell'archetipo, ma prima
   vengono quelle che hanno quel nome: chi cerca un nome esatto lo trova in cima. */
function cerca(chiavi, testo) {
  const f = testo.trim().toLowerCase();
  if (!f) return chiavi;
  const trovate = [];
  for (const k of chiavi) {
    const c = CARTE[k], nome = c[N].toLowerCase();
    const i = nome.indexOf(f);
    if (i === 0) trovate.push([0, k]);
    else if (i > 0) trovate.push([1, k]);
    else if (c[AR] >= 0 && ARCHETIPI[c[AR]].toLowerCase().includes(f)) trovate.push([2, k]);
  }
  return trovate.sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
const ordinaCarte = (chiavi) => STATO.ordine === "epoca"
  ? chiavi.slice().sort((a, b) => CARTE[a][T] - CARTE[b][T] || CARTE[a][N].localeCompare(CARTE[b][N]))
  : chiavi;

/* chip delle cornici presenti in una lista */
function chipCornici(chiavi) {
  const presenti = [...new Set(chiavi.map(k => cornice(CARTE[k])))].filter(Boolean)
    .sort((a, b) => (CORNICE[a] ? CORNICE[a][0] : a).localeCompare(CORNICE[b] ? CORNICE[b][0] : b));
  if (presenti.length < 2) return "";
  return `<div class="filtri">${presenti.map(t =>
    `<button class="f" data-t="${esc(t)}" aria-pressed="${STATO.tipiAttivi.has(t)}">
      <i class="pallino" style="background:${CORNICE[t] ? CORNICE[t][1] : "#777"}"></i>${esc(CORNICE[t] ? CORNICE[t][0] : t)}</button>`).join("")}</div>`;
}
const filtraCornici = chiavi => STATO.tipiAttivi.size
  ? chiavi.filter(k => STATO.tipiAttivi.has(cornice(CARTE[k]))) : chiavi;

/* =====================================================================
   Vista BUSTE — cosa si trova in ogni busta
   ===================================================================== */
function vistaBuste() {
  const corpo = () => {
    const f = STATO.q.trim().toLowerCase();
    let out = "";
    for (const [serie, nomi] of SERIE) {
      const righe = nomi.filter(n => !f || n.toLowerCase().includes(f))
        .map(n => BUSTA_DI.get(n))
        .sort((a, b) => copertura(b) - copertura(a));
      if (!righe.length) continue;
      out += `<p class="serie">${esc(serie)}</p><div class="duellanti">` +
        righe.map(rigaLuogo).join("") + `</div>`;
    }
    return out || `<p class="vuoto">Nessun duellante con questo nome.</p>`;
  };
  return {
    titolo: "Legacy of the Duelist: Link Evolution",
    conta: num(CUM[ULTIMA]) + " carte",
    testa: campoRicerca("Cerca un duellante", STATO.q, "q"),
    corpo
  };
}

function rigaLuogo(l) {
  const L = LUOGHI[l], dispo = copertura(l), tot = L.taglia;
  const vuota = dispo === 0;
  const testa = L.tipo === "busta" ? ritrattoHTML(L.chi)
    : `<div class="saga-t" style="background:${L.saga >= 0 ? SAGHE[L.saga].colore : "#555"}">${esc(ICONA[L.tipo])}</div>`;
  return `<button class="duel${vuota ? " spenta" : ""}" data-l="${l}">${testa}
    <span style="min-width:0"><span class="nome">${esc(L.tipo === "busta" ? L.chi : nomeLuogo(l))}</span>
    <small>${epocaAttiva() ? `${num(dispo)} di ${num(tot)}` : `${num(tot)} carte`}${
      vuota ? " · tocca per vederle comunque" : ""}</small>
    ${epocaAttiva() ? `<span class="barretta"><i style="width:${tot ? (dispo / tot * 100).toFixed(0) : 0}%"></i></span>` : ""}</span></button>`;
}

/* =====================================================================
   Dettaglio di un luogo (busta, sfida o duello di campagna)
   ===================================================================== */
function vistaLuogo() {
  const l = STATO.luogo, L = LUOGHI[l];
  const tutte = PER_LUOGO[l];
  const dispo = copertura(l);

  const corpo = () => {
    let ch = cerca(tutte, STATO.q);
    ch = filtraCornici(ch);
    if (STATO.nascondiFuori) ch = ch.filter(dentro);
    ch = ordinaCarte(ch);
    const vuoto = `<p class="vuoto">Nessuna carta ${esc(etichettaFino() || "con questi filtri")} in questo posto.
      ${num(L.taglia)} in totale.<br>
      <button class="azione second" data-az="tutto">Togli il filtro</button></p>`;
    return chipCornici(tutte) + `
      <div class="riga-opzioni">
        <button class="f" data-az="ordine" aria-pressed="${STATO.ordine === "epoca"}">Ordina per epoca</button>
        <button class="f" data-az="nascondi" aria-pressed="${STATO.nascondiFuori}">Nascondi fuori epoca</button>
      </div>` + grigliaCarte(ch, vuoto);
  };

  const comp = SAGHE.map((s, i) => tutte.filter(k => TACCHE[CARTE[k][T]] && TACCHE[CARTE[k][T]].s === i).length);
  const testa = L.tipo === "busta" ? ritrattoHTML(L.chi, "ritratto")
    : `<div class="saga-t" style="background:${L.saga >= 0 ? SAGHE[L.saga].colore : "#555"}">${esc(ICONA[L.tipo])}</div>`;
  const rare = L.tipo === "busta" && !L.rarNota ? "rarità non registrata"
    : num(RARE_LUOGO[l]) + " rare";

  return {
    titolo: nomeLuogo(l), indietro: true,
    testa: `<div class="testa">${testa}<div>
        <h2>${esc(nomeLuogo(l))}</h2>
        <p>${epocaAttiva() ? `${num(dispo)} di ${num(L.taglia)} nella tua epoca`
          : `${num(L.taglia)} carte`} · ${esc(rare)}</p>
        <p>${esc(dettaglioLuogoTesto(l))}</p></div></div>
      <div class="composizione" title="da quali epoche vengono le carte di questo posto">
        ${comp.map((n, i) => n ? `<i style="flex:${n};background:${SAGHE[i].colore}"
          title="${num(n)} da ${esc(SAGHE[i].nome)}"></i>` : "").join("")}</div>
      <p class="legenda">${comp.map((n, i) => n
        ? `<span><i style="background:${SAGHE[i].colore}"></i>${esc(SAGHE[i].nome)} ${num(n)}</span>` : "").join("")}</p>
      ${campoRicerca("Filtra queste carte", STATO.q, "q")}`,
    corpo
  };
}
const etichettaFino = () => STATO.cursore >= ULTIMA ? "" : "fino a " + descriviTacca(STATO.cursore);

/* =====================================================================
   Vista CARTE — tutte le carte sotto l'epoca attiva
   ===================================================================== */
function vistaCarte() {
  const corpo = () => {
    let ch = cerca(TUTTE, STATO.qCarte);
    ch = filtraCornici(ch);
    const dentroCh = ch.filter(dentro);
    const fuori = ch.length - dentroCh.length;
    const s = sagaDelCursore();
    const riepilogo = `<p class="serie">${num(dentroCh.length)} carte${epocaAttiva() && !STATO.soloNuove
      ? ` · ${num(dentroCh.filter(nuovaQui).length)} nuove con ${esc(SAGHE[s].nome)}` : ""}</p>`;
    /* mai un vicolo cieco: se la ricerca trova solo carte fuori epoca lo dice */
    if (!dentroCh.length && fuori)
      return `<p class="vuoto">0 nella tua epoca · ${num(fuori)} fuori<br>
        <button class="azione second" data-az="tutto">Guardale comunque</button></p>`;
    return chipCornici(ch) + riepilogo + grigliaCarte(ordinaCarte(dentroCh));
  };
  return {
    titolo: "Tutte le carte", conta: num(disponibili()) + " nell'epoca",
    testa: campoRicerca("Cerca una carta o un archetipo", STATO.qCarte, "qCarte"),
    corpo
  };
}

/* =====================================================================
   Vista DOVE — i duelli che regalano carte garantite
   ===================================================================== */
const GRUPPI = (() => {
  const g = new Map();
  LUOGHI.forEach((L, i) => {
    if (L.tipo === "busta") return;
    const k = L.tipo + "|" + L.saga + "|" + L.chi + "|" + (L.episodio || "");
    if (!g.has(k)) g.set(k, { tipo: L.tipo, saga: L.saga, chi: L.chi, episodio: L.episodio, luoghi: [] });
    g.get(k).luoghi.push(i);
  });
  return [...g.values()];
})();

function vistaDove() {
  const corpo = () => {
    const f = STATO.qDove.trim().toLowerCase();
    const visti = GRUPPI.filter(g => !f || g.chi.toLowerCase().includes(f) ||
      (g.episodio || "").toLowerCase().includes(f) ||
      (g.saga >= 0 && SAGHE[g.saga].nome.toLowerCase().includes(f)));
    if (!visti.length) return `<p class="vuoto">Nessun duello con questo nome.</p>`;
    let out = `<p class="nota-testa">Queste carte si vincono una volta sola. Le buste si ricomprano.</p>`;
    for (let s = 0; s < SAGHE.length; s++) {
      const gr = visti.filter(g => g.saga === s)
        .sort((a, b) => somma(b.luoghi, copertura) - somma(a.luoghi, copertura));
      if (!gr.length) continue;
      out += `<p class="serie">Campagna ${esc(SAGHE[s].nome)} · ${gr.length} duelli</p>
        <div class="duellanti">${gr.map(rigaGruppo).join("")}</div>`;
    }
    const senza = visti.filter(g => g.saga < 0);
    if (senza.length) out += `<p class="serie">Altri</p><div class="duellanti">${senza.map(rigaGruppo).join("")}</div>`;
    return out;
  };
  return {
    titolo: "Dove si vincono le carte", conta: GRUPPI.length + " duelli",
    testa: campoRicerca("Cerca un avversario o una campagna", STATO.qDove, "qDove"),
    corpo
  };
}
const somma = (arr, fn) => arr.reduce((a, b) => a + fn(b), 0);

function rigaGruppo(g) {
  const id = g.tipo + "|" + g.saga + "|" + g.chi + "|" + (g.episodio || "");
  if (g.luoghi.length === 1) return rigaLuogo(g.luoghi[0]);
  const tot = somma(g.luoghi, l => LUOGHI[l].taglia), dispo = somma(g.luoghi, copertura);
  const aperto = STATO.gruppo === id;
  const liv = g.luoghi.map(l => LUOGHI[l].livello).filter(Boolean).sort();
  return `<button class="duel${dispo ? "" : " spenta"}" data-g="${esc(id)}">
      <div class="saga-t" style="background:${g.saga >= 0 ? SAGHE[g.saga].colore : "#555"}">${esc(ICONA[g.tipo])}</div>
      <span style="min-width:0"><span class="nome">${esc(g.chi)}${liv.length ? ` · livelli ${liv[0]}-${liv[liv.length - 1]}` : ""}</span>
      <small>${epocaAttiva() ? `${num(dispo)} di ${num(tot)}` : `${num(tot)} carte`}</small></span>
      <span class="freccia">${aperto ? "▴" : "▾"}</span></button>
    ${aperto ? `<div class="sottoluoghi">${g.luoghi.map(rigaLuogo).join("")}</div>` : ""}`;
}

const campoRicerca = (segnaposto, valore, chiave) =>
  `<input class="cerca" data-q="${chiave}" placeholder="${esc(segnaposto)}" value="${esc(valore)}">`;
