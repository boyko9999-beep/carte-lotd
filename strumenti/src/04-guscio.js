
/* =====================================================================
   Guscio: intestazione, barra epoca, pannello epoca, tab.
   La barra epoca è emessa da intestazione(): tutte le viste la chiamano,
   così non può capitare che una schermata resti senza filtro visibile.
   ===================================================================== */

const intestazione = (titolo, conta, indietro) => `<header class="top"><div class="top-in">
  ${indietro ? `<button class="indietro" data-az="indietro" aria-label="Indietro">‹</button>` : ""}
  <h1 class="titolo">${esc(titolo)}</h1>
  ${conta ? `<span class="conta">${esc(conta)}</span>` : ""}</div></header>`;

function barraEpoca() {
  const m = mazzoAperto();
  const attiva = epocaAttiva();
  /* con un mazzo aperto la barra dice il mazzo E la sua epoca: una riga sola,
     mai due barre sovrapposte */
  /* Dentro il mazzo il titolo dice già il nome: qui basta l'epoca.
     Nelle altre schermate del mazzo il nome serve a ricordare cosa stai riempiendo. */
  const epocaMazzo = m ? (m.cursore >= ULTIMA ? "tutto il gioco" : "fino a " + etichettaBreve(m.cursore)) : "";
  const testo = !m ? etichettaEpoca()
    : STATO.schermata === "mazzo" ? `Epoca del mazzo: ${epocaMazzo}`
    : `${m.nome} · ${epocaMazzo}`;
  return `<button class="epoca-barra${attiva || m ? " attiva" : ""}" data-az="pannello">
    <span class="et">${m ? "📕" : "⌛"}</span>
    <span class="val">${esc(testo)}</span>
    <span class="freccia">${STATO.pannello ? "▴" : "▾"}</span></button>
    ${STATO.pannello ? pannelloEpoca() : ""}`;
}

function pannelloEpoca() {
  const cur = STATO.cursore, t = TACCHE[cur], sagaCur = t.s;
  const nota = dentroSaga(cur);
  const annoCur = ANNI.findIndex(x => x.i >= cur);
  const prima = annoCur > 0 ? ANNI[annoCur - 1] : null;
  const dopo = annoCur >= 0 && annoCur < ANNI.length - 1 ? ANNI[annoCur + 1] : null;
  const qui = annoCur >= 0 ? ANNI[annoCur] : ANNI[ANNI.length - 1];
  const nuove = novitaSaga(sagaCur);

  /* il righello è solo disegno: non è tappabile. Le 21 tacche anno starebbero
     a 16px l'una dall'altra, contro i 44px dello stepper qui sotto. */
  const righello = `<div class="righello${cur >= ULTIMA && !STATO.soloNuove ? " spento" : ""}" aria-hidden="true">
    <i style="width:${(cur / ULTIMA * 100).toFixed(1)}%;background:${
      cur >= ULTIMA && !STATO.soloNuove ? "var(--line)" : coloreTacca(cur)}"></i>
    <div class="tacche">${ANNI.map(x =>
      `<b class="${x.i <= cur ? "on" : ""}"></b>`).join("")}</div></div>`;

  return `<div class="epoca-pannello">
    <h3>${STATO.cursore >= ULTIMA && !STATO.soloNuove ? "Tutto il gioco"
        : "Fino a " + esc(descriviTacca(cur))} — ${num(disponibili())} carte</h3>
    ${nota ? `<p class="nota">${esc(nota)}</p>` : ""}
    <div class="filtri">${SAGHE.map((s, i) =>
      `<button class="f" data-saga="${i}" aria-pressed="${cur === s.ultima}">
        <i class="pallino" style="background:${s.colore}"></i>${esc(s.nome)}</button>`).join("")}</div>
    ${righello}
    <div class="stepper">
      <button data-tacca="${prima ? prima.i : ""}" ${prima ? "" : "disabled"}>◀ ${prima ? prima.anno : ""}</button>
      <b>${qui.anno}</b>
      <button data-tacca="${dopo ? dopo.i : ""}" ${dopo ? "" : "disabled"}>${dopo ? dopo.anno : ""} ▶</button>
    </div>
    <div class="interruttore">
      <button data-tacca="${ULTIMA}" aria-pressed="${cur >= ULTIMA && !STATO.soloNuove}">Tutto (togli il filtro)</button>
      <button data-az="solo-nuove" aria-pressed="${STATO.soloNuove}">Solo le ${num(nuove)} nuove di ${esc(SAGHE[sagaCur].nome)}</button>
    </div>
  </div>`;
}

const barraTab = () => `<div class="tabs">
  ${[["buste", "Buste"], ["carte", "Carte"], ["dove", "Dove"], ["mazzi", "Mazzi"]].map(([v, t]) =>
    `<button class="tab" aria-selected="${STATO.vista === v && !STATO.schermata}" data-v="${v}">${t}</button>`).join("")}
  </div>`;

/* ---- rendering ----------------------------------------------------
   Ogni vista restituisce { testa, corpo }. Il corpo vive in #corpo e si
   può ridisegnare da solo: così il campo di ricerca non viene mai
   rigenerato mentre si scrive e non perde i tasti. */
let CORPO = () => "";

function render() {
  const y = scrollY;
  const v = schermataCorrente();
  CORPO = v.corpo;
  app.innerHTML = intestazione(v.titolo, v.conta, v.indietro) +
    `<div class="wrap">${v.schermataPiena ? "" : barraEpoca()}${v.testa || ""}
      <div id="corpo">${CORPO()}</div></div>`;
  aggiornaPiede();
  scrollTo(0, y);
}
function ridisegnaCorpo() {
  const el = document.getElementById("corpo");
  if (el) el.innerHTML = CORPO();
  aggiornaPiede();
}
function vaiA(cambi) { Object.assign(STATO, cambi); STATO.limite = 100; render(); }

function impostaCursore(i) {
  STATO.cursore = Math.max(0, Math.min(ULTIMA, i));
  STATO.soloNuove = false;
  STATO.limite = 100;
  /* con un mazzo aperto l'epoca È quella del mazzo: spostarla lo sposta.
     Le carte non si toccano mai: l'epoca è una lente, non una ghigliottina. */
  const m = mazzoAperto();
  if (m && m.cursore !== STATO.cursore) { m.cursore = STATO.cursore; m.modificato = Date.now(); salvaMazzi(); }
  render();
  salvaEpoca();
}

/* ---- piede: sta FUORI da #app, altrimenti ogni render lo distrugge ---- */
const piede = document.createElement("div");
document.body.appendChild(piede);
function aggiornaPiede() {
  const m = mazzoAperto();
  document.body.classList.toggle("con-piede", !!m && STATO.schermata !== "esporta");
  if (!m || STATO.schermata === "esporta") { piede.className = ""; piede.innerHTML = ""; return; }
  const [cl, testo] = semaforo(m);
  piede.className = "piede";
  piede.innerHTML = `<div class="piede-in">
    <span class="conta-piede">Main <b class="${cl}">${conta(m, false)}</b>/40 · Extra ${conta(m, true)}/15
      <span class="stato ${cl}">${esc(testo)}</span></span>
    ${STATO.schermata === "mazzo"
      ? `<button class="azione" data-az="scegli">＋ Carte</button>`
      : `<button class="azione second" data-az="apri-mazzo">Il mazzo</button>`}</div>`;
}
