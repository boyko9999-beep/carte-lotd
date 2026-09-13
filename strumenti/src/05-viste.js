
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
  /* Con un mazzo aperto la lente è la SUA epoca, la stessa che sceglie le carte
     dell'elenco e che colora le righe dentro il mazzo: altrimenti il selettore
     sbiadisce carte che il mazzo considera perfettamente dentro. */
  const fuori = m ? !dentroA(k, m.cursore) : !dentro(k);
  const col = CORNICE[cornice(c)] ? CORNICE[cornice(c)][1] : "transparent";
  const nuova = nuovaQui(k);
  return `<div class="carta${fuori ? " fuori" : ""}">
    <button class="tocca" data-c="${k}" aria-label="${esc(c[N])}">
      ${c[ID] ? `<img src="${img(c[ID])}" alt="${esc(c[N])}" loading="lazy" decoding="async">`
              : `<div class="vuota">${esc(c[N])}</div>`}
      ${c[R] ? `<i class="rara" title="rara"></i>` : ""}
      <span class="n" style="border-left-color:${col}">${esc(c[N])}</span></button>
    ${MOSTRA_IT && c[NI] && c[NI] !== c[N] ? `<span class="nomeit">${esc(c[NI])}</span>` : ""}
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

/* =====================================================================
   Ricerca per tema

   I nomi delle carte nel gioco sono in inglese, ma l'archivio porta anche i
   nomi ufficiali italiani: "Drago Bianco Occhi Blu" è il nome vero. Si cerca
   quindi in italiano, riducendo le parole alla radice, così che "eroi
   elementari" trovi gli "EROE Elementale" e "zombie" trovi la razza Zombie.

   Poi si allarga alle carte che ci vanno insieme: stesso archetipo, carte
   citate nel testo e carte che citano quelle trovate. È così che cercando gli
   Eroi Elementali salta fuori anche Polimerizzazione, che nel loro testo è
   nominata diciassette volte.
   ===================================================================== */
const senzaAccenti = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const spezza = s => senzaAccenti(String(s)).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/* suffissi italiani, dal più lungo al più corto */
const SUFFISSI = ["issimi", "issime", "issimo", "issima", "mente", "zioni", "zione",
  "ando", "endo", "anti", "ante", "arie", "ario", "ari", "ale", "ali", "are",
  "ato", "ata", "ati", "ate", "ore", "ori", "ice", "ici", "oso", "osa", "osi", "ose"];
function radice(p) {
  for (const s of SUFFISSI)
    if (p.length - s.length >= 4 && p.endsWith(s)) { p = p.slice(0, p.length - s.length); break; }
  /* poi le vocali finali, una dopo l'altra: lega "eroi" a "eroe", "nera" a "nero"
     e "occhio" a "occhi", che altrimenti si fermerebbero a radici diverse */
  while (p.length >= 4 && "aeio".includes(p[p.length - 1])) p = p.slice(0, -1);
  /* l'h dei plurali duri: "draghi"→"dragh" deve tornare al "drag" di "drago",
     come "bianche"→"bianch"→"bianc". Senza questo, «draghi bianchi» non
     trovava niente mentre «drago bianco» trovava quattordici carte. */
  if (p.length >= 4 && p.endsWith("h") && "cg".includes(p[p.length - 2])) p = p.slice(0, -1);
  /* il femminile in -trice contro il maschile in -tore: "incantatr"→"incantat" */
  if (p.length >= 4 && p.endsWith("tr")) p = p.slice(0, -1);
  return p;
}
const radici = testo => spezza(testo).map(radice);

/* Articoli e preposizioni non devono valere come vincoli: il campo invita a
   scrivere liberamente, e «il drago bianco» deve trovare quello che trova
   «drago bianco». Restano però utilizzabili da sole, se uno cerca proprio
   quella parola: si scartano solo quando resta qualcos'altro. */
const VUOTE = new Set(["il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "l",
  "di", "del", "dello", "della", "dei", "degli", "delle", "da", "dal", "dallo",
  "dalla", "dai", "dagli", "dalle", "in", "nel", "nello", "nella", "nei", "negli",
  "nelle", "con", "col", "su", "sul", "sulla", "per", "tra", "fra", "e", "ed",
  "a", "ad", "al", "allo", "alla", "ai", "agli", "alle", "che", "chi", "non",
  "carta", "carte", "tipo"].map(radice));
const utili = rad => {
  const r = rad.filter(x => x.length > 2 && !VUOTE.has(x));
  return r.length ? r : rad;
};

/* Due impronte per carta: una col solo nome (decide l'ordine) e una completa.
   Si costruiscono alla prima ricerca, non all'avvio: aprire l'app resta immediato. */
let IMPRONTA = null, IMPRONTA_NOME = null;
function costruisciImpronte() {
  if (IMPRONTA) return;
  IMPRONTA = new Array(CARTE.length);
  IMPRONTA_NOME = new Array(CARTE.length);
  for (let k = 0; k < CARTE.length; k++) {
    const c = CARTE[k];
    const nome = spezza(c[N]).concat(c[NI] ? spezza(c[NI]) : []);
    const altro = nome.slice();
    if (c[AR] >= 0) altro.push(...spezza(ARCHETIPI[c[AR]]));
    if (c[RA] >= 0) altro.push(...spezza(razzaDi(c)), ...spezza(razzaIt(c)));
    if (c[AT] >= 0) altro.push(...spezza(attributoDi(c)), ...spezza(attributoIt(c)));
    const cor = CORNICE[cornice(c)];
    if (cor) altro.push(...spezza(cor[0]));
    IMPRONTA_NOME[k] = " " + [...new Set(nome.map(radice))].join(" ") + " ";
    IMPRONTA[k] = " " + [...new Set(altro.map(radice))].join(" ") + " ";
  }
}
/* tutte le radici cercate devono comparire come inizio di una parola */
const corrisponde = (impronta, rad) => rad.every(r => impronta.includes(" " + r));

function cerca(chiavi, testo) {
  const tutte = radici(testo);
  /* campo vuoto è un conto, «...» è un altro: una ricerca fatta di sola
     punteggiatura non deve spacciare l'archivio intero per risultati */
  if (!tutte.length) return testo.trim() ? [] : chiavi;
  const rad = utili(tutte);
  costruisciImpronte();
  const perNome = [], perAltro = [];
  for (const k of chiavi) {
    if (!corrisponde(IMPRONTA[k], rad)) continue;
    (corrisponde(IMPRONTA_NOME[k], rad) ? perNome : perAltro).push(k);
  }
  return perNome.concat(perAltro);
}

/* Il nome inglese resta quello grande: nel gioco le carte si chiamano così e
   serve a ritrovarle. Quello italiano compare sotto mentre si cerca, perché è
   con quello che si è cercato. */
let MOSTRA_IT = false;

/* Le carte che vanno insieme a quelle trovate, in tre gruppi distinti.
   Una carta sta in un gruppo solo, quello più stretto: appartenere allo stesso
   archetipo dice più che essere nominata di sfuggita. La deduplica avviene
   contro TUTTE le trovate, anche quelle che epoca e chip nascondono, altrimenti
   togliendo un filtro una carta salterebbe da una sezione all'altra. */
const TETTI = { archetipo: 150, servono: 100, usano: 50 };
function espandi(trovate) {
  if (!trovate.length) return { archetipo: [], servono: [], usano: [] };
  const gia = new Set(trovate);
  const arch = new Map(), servono = new Map(), usano = new Map();
  for (const k of trovate) {
    const c = CARTE[k];
    /* si conta da quante carte trovate arriva ciascun compagno: davanti finisce
       l'archetipo più presente nella ricerca, non la lettera A */
    if (c[AR] >= 0) for (const j of (PER_ARCHETIPO.get(c[AR]) || [])) if (!gia.has(j)) arch.set(j, (arch.get(j) || 0) + 1);
    for (const j of c[CITA]) if (!gia.has(j)) servono.set(j, (servono.get(j) || 0) + 1);
    for (const j of (CITATO_DA.get(k) || [])) if (!gia.has(j)) usano.set(j, (usano.get(j) || 0) + 1);
  }
  /* il gruppo più stretto vince: chi è già nell'archetipo non ricompare sotto */
  for (const j of arch.keys()) { servono.delete(j); usano.delete(j); }
  for (const j of servono.keys()) usano.delete(j);
  const perNome = (a, b) => nomeIt(CARTE[a]).localeCompare(nomeIt(CARTE[b]));
  /* le più nominate per prime: è così che Polimerizzazione emerge fra gli Eroi */
  const perQuante = m => [...m.entries()]
    .sort((a, b) => b[1] - a[1] || perNome(a[0], b[0])).map(x => x[0]);
  return { archetipo: perQuante(arch), servono: perQuante(servono), usano: perQuante(usano) };
}

/* Quante piastrelle si disegnano.
   Una regola sola, uguale ovunque: 300 subito, poi 300 per volta man mano che
   si scorre. Nessun pulsante da premere, mai. 300 piastrelle costano ~18 ms su
   questo banco (quindi ~60 ms su un telefono di fascia media); 1.200 ne
   costerebbero ~220, e il prezzo si paga a OGNI tasto digitato, perché il corpo
   si ridisegna tutto. Un blocco da 300 è alto circa ventisei schermate e la
   sentinella lo accoda con 1.200 px di anticipo: le carte ci sono già prima che
   il fondo si veda. */
const PRIMO = 300, BLOCCO = 300;
const CHIAVI = {}, LIMITI = {};
/* chi azzera i limiti sta rifacendo l'elenco da capo: chi ridisegna lo deve
   sapere, per non lasciare l'utente appiccicato alla fine del vecchio blocco */
let LIMITI_AZZERATI = false;
const azzeraLimiti = () => { for (const k in LIMITI) delete LIMITI[k]; LIMITI_AZZERATI = true; };
const consumaAzzeramento = () => { const a = LIMITI_AZZERATI; LIMITI_AZZERATI = false; return a; };
const limiteDi = (id, n) => Math.min(LIMITI[id] > 0 ? LIMITI[id] : PRIMO, n);

/* Raggiunto un limite cambia solo la disponibilità dei "+": si aggiornano i
   nodi già a schermo, senza ricostruire una griglia da mille piastrelle. */
function aggiornaDisponibilita() {
  const m = mazzoAperto();
  if (!m) return;
  for (const b of document.querySelectorAll("[data-piu]")) {
    const no = perchéNo(m, +b.dataset.piu);
    b.disabled = !!no;
    if (no) b.title = no; else b.removeAttribute("title");
  }
}
/* Cosa rende diverso un elenco da un altro. Confrontare lunghezza e prima
   chiave non basta: un riordino non si vedrebbe e resterebbero a schermo
   piastrelle in ordine nuovo e numero arbitrario. */
const FIRME = {};
const firma = id => [id, STATO.schermata, STATO.vista, STATO.luogo, STATO.mazzo,
  STATO.q, STATO.qCarte, STATO.qSel, STATO.cursore, STATO.soloNuove, STATO.ordine,
  STATO.nascondiFuori, STATO.mostraFuori, [...STATO.tipiAttivi].sort().join(",")].join("|");

function grigliaCarte(chiavi, vuoto, id) {
  id = id || "griglia";
  const f = firma(id);
  if (FIRME[id] !== f) { FIRME[id] = f; LIMITI[id] = 0; }
  CHIAVI[id] = chiavi;
  if (!chiavi.length) return vuoto || `<p class="vuoto">Nessuna carta.</p>`;
  const limite = limiteDi(id, chiavi.length);
  return `<div class="carte" id="${id}">${chiavi.slice(0, limite).map(cartaHTML).join("")}</div>
    ${coda(id)}`;
}
function coda(id) {
  const chiavi = CHIAVI[id] || [];
  const limite = limiteDi(id, chiavi.length);
  if (chiavi.length <= limite) return "";
  return `<div class="sentinella" data-altre="${id}">
    <span>altre ${num(chiavi.length - limite)} carte…</span></div>`;
}
/* accoda senza ricostruire quelle già a schermo.
   Se il punto di innesto sta SOPRA la finestra (si è saltati in fondo, o si è
   seguito un collegamento), le piastrelle nuove sposterebbero in giù tutto
   quello che si sta guardando: si recupera la stessa quantità di scorrimento,
   così sotto gli occhi resta la stessa carta. */
let accodaInCorso = false;
function accodaCarte(id) {
  const griglia = document.getElementById(id), chiavi = CHIAVI[id] || [];
  if (!griglia || accodaInCorso) return !!griglia;
  accodaInCorso = true;
  requestAnimationFrame(() => { accodaInCorso = false; });
  const prima = limiteDi(id, chiavi.length);
  if (prima >= chiavi.length) return true;
  const dopo = Math.min(chiavi.length, prima + BLOCCO);
  LIMITI[id] = dopo;
  const sopra = griglia.getBoundingClientRect().bottom < 0;
  const altezzaPrima = document.documentElement.scrollHeight;
  griglia.insertAdjacentHTML("beforeend", chiavi.slice(prima, dopo).map(cartaHTML).join(""));
  const s = document.querySelector(`.sentinella[data-altre="${id}"]`);
  if (s) { s.outerHTML = coda(id); osserva(); }
  if (sopra) {
    const cresciuta = document.documentElement.scrollHeight - altezzaPrima;
    if (cresciuta > 0) scrollTo(0, scrollY + cresciuta);
  }
  riancora();
  return true;
}

/* Seguire un collegamento interno e restare dove si è atterrati.
   Il salto «↓ altre N che ci vanno insieme» atterra appena sotto una griglia
   che può ancora crescere: senza queste due precauzioni la griglia di sopra si
   allungava di trecento piastrelle e spingeva la sezione trenta schermate più
   giù, lasciando l'utente in mezzo alle carte di prima.
   1) le griglie che stanno sopra il punto d'arrivo smettono di accodare da sole;
   2) se qualcosa cresce lo stesso, si torna sul bersaglio.
   Al primo gesto dell'utente tutto ricomincia a funzionare come sempre. */
const SOSPESE = new Set();
let BERSAGLIO = null, scadenzaBersaglio = 0;
function riancora() {
  if (!BERSAGLIO) return;
  if (Date.now() > scadenzaBersaglio) { BERSAGLIO = null; return; }
  const el = document.getElementById(BERSAGLIO);
  if (el) el.scrollIntoView();
}
function vaiAncora(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const y = el.getBoundingClientRect().top;
  SOSPESE.clear();
  for (const s of document.querySelectorAll(".sentinella"))
    if (s.getBoundingClientRect().top < y) SOSPESE.add(s.dataset.altre);
  BERSAGLIO = id;
  scadenzaBersaglio = Date.now() + 3000;
  el.scrollIntoView();
  return true;
}
function liberaSentinelle() {
  BERSAGLIO = null;
  if (!SOSPESE.size) return;
  SOSPESE.clear();
  valutaSentinelle();
}

/* Le carte compaiono da sole arrivando in fondo. Se il browser non sa farlo,
   la sentinella resta toccabile e funziona come un pulsante. */
let OSSERVATORE = null;
function osserva() {
  if (typeof IntersectionObserver !== "function") return;
  if (!OSSERVATORE) OSSERVATORE = new IntersectionObserver(voci => {
    for (const v of voci)
      if (v.isIntersecting && !SOSPESE.has(v.target.dataset.altre)) accodaCarte(v.target.dataset.altre);
  }, { rootMargin: "1200px" });
  OSSERVATORE.disconnect();
  document.querySelectorAll(".sentinella").forEach(s => OSSERVATORE.observe(s));
}
/* L'osservatore da solo non basta: saltando di colpo in fondo (barra di
   scorrimento, tasto Fine, flick sul telefono) la sentinella passa da "sotto la
   finestra" a "sopra la finestra" senza mai attraversarla, e non scatta niente.
   Questo controllo, legato allo scorrimento, la ripesca. */
let attesaValuta = false;
function valutaSentinelle() {
  if (attesaValuta) return;
  attesaValuta = true;
  requestAnimationFrame(() => {
    attesaValuta = false;
    for (const s of document.querySelectorAll(".sentinella")) {
      if (SOSPESE.has(s.dataset.altre)) continue;
      if (s.getBoundingClientRect().top < innerHeight + 1200) { accodaCarte(s.dataset.altre); break; }
    }
  });
}
addEventListener("scroll", valutaSentinelle, { passive: true });
for (const gesto of ["wheel", "touchstart", "keydown", "mousedown"])
  addEventListener(gesto, liberaSentinelle, { passive: true });

const ordinaCarte = (chiavi) => STATO.ordine === "epoca"
  ? chiavi.slice().sort((a, b) => CARTE[a][T] - CARTE[b][T] || CARTE[a][N].localeCompare(CARTE[b][N]))
  : chiavi;

/* chip delle cornici presenti in una lista.
   Un chip acceso si disegna sempre, anche se nessuna carta di questo elenco ha
   quella cornice: è lui a tenere l'elenco vuoto, e deve restare visibile per
   poter essere spento. Nasconderlo lasciava un filtro invisibile e inamovibile. */
function chipCornici(chiavi) {
  const presenti = [...new Set([...chiavi.map(k => cornice(CARTE[k])), ...STATO.tipiAttivi])]
    .filter(Boolean)
    .sort((a, b) => (CORNICE[a] ? CORNICE[a][0] : a).localeCompare(CORNICE[b] ? CORNICE[b][0] : b));
  if (presenti.length < 2 && !STATO.tipiAttivi.size) return "";
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
    MOSTRA_IT = !!STATO.q.trim();
    let ch = cerca(tutte, STATO.q);
    ch = filtraCornici(ch);
    if (STATO.nascondiFuori) ch = ch.filter(dentro);
    ch = ordinaCarte(ch);
    const vuoto = `<p class="vuoto">Nessuna carta ${esc(etichettaFino() || "con questi filtri")} in questo posto.
      ${num(L.taglia)} in totale.<br>
      <button class="azione second" data-az="pulisci">Togli tutti i filtri</button></p>`;
    return chipCornici(tutte) + `
      <div class="riga-opzioni">
        <button class="f" data-az="ordine" aria-pressed="${STATO.ordine === "epoca"}">Ordina per epoca</button>
        <button class="f" data-az="nascondi" aria-pressed="${STATO.nascondiFuori}">Nascondi fuori epoca</button>
      </div>` + grigliaCarte(ch, vuoto);
  };

  const comp = SAGHE.map((s, i) => tutte.filter(k => TACCHE[CARTE[k][T]] && TACCHE[CARTE[k][T]].s === i).length);
  const testa = L.tipo === "busta" ? ritrattoHTML(L.chi, "ritratto")
    : `<div class="saga-t" style="background:${L.saga >= 0 ? SAGHE[L.saga].colore : "#555"}">${esc(ICONA[L.tipo])}</div>`;
  /* le quattro buste scaricabili non hanno la rarità segnata nei dati:
     si dice quello che c'è, senza inventare uno zero */
  const rare = RARE_LUOGO[l] ? num(RARE_LUOGO[l]) + plurale(RARE_LUOGO[l], " rara", " rare")
    : "nessuna rara registrata";

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
/* Le due sezioni dei risultati: prima quelle cercate, poi quelle che ci vanno
   insieme. Ogni griglia ha il suo id e quindi il suo riempimento: nessuna
   quantità di carte trovate può spingere le altre fuori dalla parte disegnata,
   che era il difetto per cui cercando un archetipo le carte non comparivano. */
const SALTO_DA = 30;
function sezioniRicerca(base, testo, dentroFn, idPre) {
  const q = esc(testo.trim());
  const ch = filtraCornici(base);
  const trovate = ch.filter(dentroFn);
  const fuori = ch.length - trovate.length;
  const g = espandi(base);
  const gruppi = [
    ["archetipo", "Stesso archetipo", "portano il nome dell'archetipo", g.archetipo],
    ["servono", "Servono per queste carte", "sono nominate nel testo di quelle qui sopra", g.servono],
    ["usano", "Usano queste carte", "le nominano nel loro testo", g.usano]
  ].map(([k, et, spiega, tutte]) => {
    const filtrate = filtraCornici(tutte).filter(dentroFn);
    /* si dice sempre quante se ne disegnano e quante ce ne sarebbero */
    return { k, et, spiega, disponibili: filtrate.length, carte: filtrate.slice(0, TETTI[k]) };
  }).filter(x => x.carte.length);
  const insieme = gruppi.reduce((a, x) => a + x.carte.length, 0);

  /* Lo stato vuoto della PRIMA sezione si scrive sempre, anche quando sotto ci
     sono carte collegate: altrimenti sparivano insieme il titolo, il conto
     «0 nella tua epoca · N fuori» e l'unica via d'uscita, e restavano a schermo
     solo dei compagni senza più nessuna riga che dicesse da dove venivano. */
  const vuotoTrovate = () => {
    /* dentro un mazzo l'epoca è sua e non si sposta per sbaglio: lì si accendono
       le carte fuori epoca, non si allarga il mazzo */
    const uscita = mazzoAperto()
      ? `<button class="azione second" data-az="fuori">Mostra anche le carte fuori dalla tua epoca</button>`
      : `<button class="azione second" data-az="tutto">Guardale comunque</button>`;
    const togli = STATO.tipiAttivi.size
      ? `<br><button class="azione second" data-az="senza-tipi">Togli il filtro per tipo</button>` : "";
    return fuori
      ? `<p class="vuoto">Carte «${q}» · 0 nella tua epoca · ${num(fuori)} fuori<br>${uscita}${togli}</p>`
      : `<p class="vuoto">Nessuna carta per «${q}».${togli}<br>
          Prova con il nome italiano, un tipo o un archetipo:
          drago bianco, zombie, eroi elementari, macchina.</p>`;
  };

  if (!trovate.length && !insieme)
    return { conta: 0, html: `<span id="su"></span>` + chipCornici(base) + vuotoTrovate() };

  const salta = trovate.length >= SALTO_DA && insieme > 0;
  let html = `<span id="su"></span>` + chipCornici(base);
  if (trovate.length) {
    html += `<p class="serie riga-serie"><span>Carte «${q}» · ${num(trovate.length)}</span>
      ${salta ? `<a class="chip" href="#insieme">↓ altre ${num(insieme)} che ci vanno insieme</a>` : ""}</p>`
      + grigliaCarte(ordinaCarte(trovate), "", idPre + "trovate");
  } else {
    html += vuotoTrovate();
  }
  if (insieme) {
    html += `<div class="gruppo" id="insieme"><h3>Altre ${num(insieme)} che ci vanno insieme</h3></div>
      <p class="spiega">Non si chiamano così, ma si giocano con ${trovate.length
        ? "quelle qui sopra" : `le carte «${q}»`}${
        gruppi.length === 1 ? ": " + esc(gruppi[0].spiega) : ""}.</p>
      ${salta ? `<p class="serie"><a class="chip" href="#su">↑ Torna alle ${num(trovate.length)} «${q}»</a></p>` : ""}`;
    for (const x of gruppi) {
      if (gruppi.length > 1) html += `<p class="serie">${esc(x.et)} · ${num(x.carte.length)}</p>`;
      if (x.carte.length < x.disponibili)
        html += `<p class="spiega">${x.k === "archetipo"
          ? `${num(x.carte.length)} di ${num(x.disponibili)}, dagli archetipi più presenti fra le trovate.`
          : `Le più usate: ${num(x.carte.length)} di ${num(x.disponibili)}.`}</p>`;
      html += grigliaCarte(x.carte, "", idPre + x.k);
    }
  }
  /* il numero in cima conta le carte cercate: le compagne sono un di più,
     e annunciarle come «trovate» sarebbe una bugia quando trovate è zero */
  return { conta: trovate.length, html };
}

function vistaCarte() {
  const corpo = () => {
    const testo = STATO.qCarte.trim();
    MOSTRA_IT = !!testo;
    const base = cerca(TUTTE, testo);

    if (!testo) {
      const ch = filtraCornici(base).filter(dentro);
      const s = sagaDelCursore();
      ULTIMA_CONTA = ch.length;
      return chipCornici(base)
        + `<p class="serie">${num(ch.length)} carte${epocaAttiva() && !STATO.soloNuove
            ? ` · ${num(ch.filter(nuovaQui).length)} nuove con ${esc(SAGHE[s].nome)}` : ""}</p>`
        + grigliaCarte(ordinaCarte(ch), "", "griglia");
    }
    const r = sezioniRicerca(base, testo, dentro, "c");
    ULTIMA_CONTA = r.conta;
    return r.html;
  };
  return {
    titolo: "Tutte le carte",
    conta: testoConta(),
    testa: campoRicerca("Cerca: drago bianco, zombie, eroi elementari…", STATO.qCarte, "qCarte"),
    corpo
  };
}
/* il numero in cima deve dire quello che si sta guardando, non un totale fisso */
let ULTIMA_CONTA = null;
const testoConta = () => STATO.qCarte.trim()
  ? (ULTIMA_CONTA === null ? "" : num(ULTIMA_CONTA) + " trovate")
  : num(disponibili()) + " nell'epoca";

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
      out += `<p class="serie">Saga ${esc(SAGHE[s].nome)} · ${gr.length} duelli</p>
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
