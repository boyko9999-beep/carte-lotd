
/* =====================================================================
   INCOLLA UNA LISTA — il mazzo si costruisce da solo

   Le liste che girano non hanno un formato solo: quella sotto un video ha i
   puntini, quella di un sito ha «3x», un file .ydk ha solo numeri, e la
   nostra esportazione ha «3 Nome». Invece di pretenderne uno, si legge
   quello che c'è: si toglie la punteggiatura da elenco, si riconosce la
   quantità in tutte le forme in cui la gente la scrive, e si cerca il nome
   prima in modo esatto e poi sempre più largo — fermandosi a CHIEDERE
   quando due carte diverse sono ugualmente plausibili, invece di tirare a
   indovinare su un mazzo che poi l'utente si porta dietro.
   ===================================================================== */

/* ---- nomi: gli indici per riconoscerli ---- */
const senzaSegni = s => senzaAccenti(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, "");
let IT_ESATTO = null, NORM_EN = null, NORM_IT = null, PER_ID = null;
function indiciNomi() {
  if (IT_ESATTO) return;
  IT_ESATTO = new Map(); NORM_EN = new Map(); NORM_IT = new Map(); PER_ID = new Map();
  const metti = (mappa, chiave, k) => {
    if (!chiave) return;
    const gia = mappa.get(chiave);
    if (gia) gia.push(k); else mappa.set(chiave, [k]);
  };
  for (let k = 0; k < CARTE.length; k++) {
    const c = CARTE[k];
    if (c[ID]) PER_ID.set(String(c[ID]), k);
    if (c[NI] && !IT_ESATTO.has(c[NI].toLowerCase())) IT_ESATTO.set(c[NI].toLowerCase(), k);
    metti(NORM_EN, senzaSegni(c[N]), k);
    if (c[NI]) metti(NORM_IT, senzaSegni(c[NI]), k);
  }
}

/* Suggerimenti per una carta che non si trova: si riusa il motore di ricerca,
   una parola per volta, e vince chi risponde a più parole. Serve a distinguere
   «l'hai scritta diversa» da «in questo gioco non c'è»: chi scrive «Vaso
   dell'Avidità» deve vedersi proporre l'«Anfora dell'Avidità», che è il nome
   italiano vero. */
/* quanto due nomi si somigliano davvero: bigrammi in comune (Dice).
   Serve a scegliere fra carte che rispondono alle stesse parole. */
function somiglianza(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); A.set(g, (A.get(g) || 0) + 1); }
  let comuni = 0, nb = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2); nb++;
    const q = A.get(g);
    if (q) { comuni++; A.set(g, q - 1); }
  }
  return 2 * comuni / (a.length - 1 + nb);
}
function suggerimenti(t) {
  const parole = [...new Set(spezza(t))].filter(p => p.length >= 3);
  const punteggio = new Map();
  for (const p of parole.slice(0, 8)) {
    let r = [];
    try { r = cerca(TUTTE, p); } catch (e) { r = []; }
    if (!r.length || r.length > 3000) continue;
    /* una parola rara pesa più di una comune: «avidità» dice molto, «del» quasi niente */
    const peso = 1 / r.length;
    for (const k of r) punteggio.set(k, (punteggio.get(k) || 0) + peso);
  }
  /* fra le più pertinenti vince poi quella che SI SCRIVE più simile: chi ha
     scritto «Vaso dell'Avidità» deve trovare l'«Anfora dell'Avidità». */
  const n = senzaSegni(t);
  return [...punteggio.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 15)
    .map(x => [x[0], Math.max(somiglianza(n, senzaSegni(CARTE[x[0]][N])),
      CARTE[x[0]][NI] ? somiglianza(n, senzaSegni(CARTE[x[0]][NI])) : 0)])
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}

/* La scala del riconoscimento, dal più esatto al più largo. Si allarga solo
   se il passo prima non ha trovato niente. */
function riconosci(testo) {
  const t = String(testo).trim();
  if (!t) return { stato: "ignota", scelte: [] };
  indiciNomi();
  const basso = t.toLowerCase();
  const k1 = PER_NOME.get(basso);                       // nome inglese esatto
  if (k1 !== undefined) return { stato: "ok", k: k1 };
  const k2 = IT_ESATTO.get(basso);                      // nome italiano ufficiale
  if (k2 !== undefined) return { stato: "ok", k: k2 };
  const n = senzaSegni(t);                              // senza trattini, accenti, apostrofi
  if (!n) return { stato: "ignota", scelte: [] };
  for (const mappa of [NORM_EN, NORM_IT]) {
    const v = mappa.get(n);
    if (!v) continue;
    if (v.length === 1) return { stato: "ok", k: v[0] };
    return { stato: "scelta", scelte: v.slice(0, 4) };  // due carte plausibili: si chiede
  }
  return { stato: "ignota", scelte: suggerimenti(t) };
}

/* «1x Left Arm / 1x Right Leg of the Forbidden One»: le prime sono abbreviate e
   la coda sta solo sull'ultima. Si prova ad attaccarla, dalla più lunga in giù. */
function completaConCoda(t, ultimo) {
  const parole = String(ultimo).split(/\s+/).filter(Boolean);
  for (let i = 1; i < parole.length; i++) {
    const r = riconosci(t + " " + parole.slice(i).join(" "));
    if (r.stato === "ok") return r;
  }
  return null;
}

/* ---- il testo: quantità e righe da buttare ---- */
/* i segni da elenco che si portano dietro le liste incollate. Niente virgolette:
   «A» Cell Breeding Device e i suoi parenti cominciano davvero con una virgoletta. */
const SEGNI_ELENCO = /^[\s\u00a0>*\-–—•·▪◦‣∙+]+/;
const NUMERATA = /^\d+[.)]\s+/;
const CODICE_SET = /\s*[([][A-Z0-9]{2,6}-[A-Z]{0,3}\d{2,4}[)\]]\s*$/i;
/* Una riga è un'intestazione solo se è TUTTA lì: così «Magie (32)» sparisce
   ma «Deck Devastation Virus», che comincia per Deck, resta una carta. */
const SEZIONE = /^[#!]?\s*(?:main|extra|side|principale|mostri?|magie?|trappole?|monsters?|spells?|traps?|deck ?list|sideboard|totale|total|fusioni?|sincro|synchro|xyz|link|pendulum|pendolo|rituali?)\s*(?:deck)?\s*[:\-–]?\s*(?:[([]?\s*\d+\s*[)\]]?)?\s*$/i;
const NUMERI_IT = { una: 1, uno: 1, un: 1, due: 2, tre: 3 };

/* Le forme in cui si scrive una quantità. L'ordine conta: prima quelle con un
   segno esplicito, per ultima «3 Nome», che è anche l'inizio di «3-Hump Lacooda». */
function staccaQuantita(t) {
  let m;
  if ((m = t.match(/^(\d{1,2})\s*[x×*]\s*(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^[x×]\s*(\d{1,2})[\s.:-]+(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^(una|uno|un|due|tre)\s+(?:copie|copia)\s+di\s+(.+)$/i))) return [NUMERI_IT[m[1].toLowerCase()], m[2]];
  if ((m = t.match(/^(.+?)\s*[x×*]\s*(\d{1,2})$/i))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)\s*[([]\s*(\d{1,2})\s*[)\]]$/))) return [+m[2], m[1]];
  if ((m = t.match(/^(\d{1,2})[\s.:-]+(.+)$/))) return [+m[1], m[2]];
  return [1, t];
}

/* Una riga può contenere più carte, ma solo se ogni pezzo dopo il primo comincia
   con una quantità: «A/D Changer» e «D/D Berfomet» sono nomi veri e non vanno
   spezzati (nell'archivio ce ne sono 56 così). */
function spezzaRiga(r) {
  if (!r.includes("/")) return [r];
  const pezzi = r.split(/\s*\/\s*/).map(x => x.trim()).filter(Boolean);
  if (pezzi.length > 1 && pezzi.slice(1).every(p => /^(?:\d{1,2}\s*[x×*]?|[x×]\s*\d{1,2})\s+\S/i.test(p)))
    return pezzi;
  return [r];
}

/* ---- leggere tutta la lista ---- */
function leggiLista(testo) {
  const righe = String(testo || "").replace(/\r/g, "").split("\n");
  const voci = [], indice = new Map();
  let nome = null, saltate = 0;

  const aggiungiVoce = (qta, grezzo, ris) => {
    const chiave = ris.stato === "ok" ? "k" + ris.k : "t" + grezzo.toLowerCase();
    const gia = indice.get(chiave);
    if (gia !== undefined) { voci[gia].qta += qta; return voci[gia]; }
    const v = { qta, testo: grezzo, stato: ris.stato, k: ris.k, scelte: ris.scelte || [] };
    indice.set(chiave, voci.length); voci.push(v);
    return v;
  };

  for (const grezza of righe) {
    let r = String(grezza).replace(/\u00a0/g, " ").trim();
    if (!r) continue;
    /* i commenti: «# Mazzo di prova» dà il nome, «#main» e «!side» dei .ydk no */
    if (r[0] === "#" || r[0] === "!") {
      const c = r.slice(1).trim();
      if (!nome && c && !/^(main|extra|side|created|epoca|dove trovare)/i.test(c)) nome = c;
      continue;
    }
    r = r.replace(SEGNI_ELENCO, "").replace(NUMERATA, "").replace(/[\s.,;]+$/, "").trim();
    if (!r) continue;
    if (SEZIONE.test(r)) { saltate++; continue; }
    /* righe senza nemmeno una lettera: righelli, conteggi, numeri sparsi.
       I codici dei .ydk passano di qui dentro perché sono 6-9 cifre. */
    if (!/[a-z]/i.test(r) && !/^\d{6,9}$/.test(r)) { saltate++; continue; }

    const pezzi = spezzaRiga(r);
    const ultimo = pezzi[pezzi.length - 1];
    for (const pezzo of pezzi) {
      const pulito = pezzo.replace(CODICE_SET, "").trim();
      /* prima il nome così com'è: «7 Colored Fish» e «7» sono carte vere */
      let ris = riconosci(pulito), qta = 1, grezzo = pulito;
      if (ris.stato !== "ok" && /^\d{6,9}$/.test(pulito)) {     // un .ydk: solo codici
        indiciNomi();
        const k = PER_ID.get(pulito);
        if (k !== undefined) ris = { stato: "ok", k };
      }
      if (ris.stato !== "ok") {
        const [q, resto] = staccaQuantita(pulito);
        if (q < 1 || q > 99 || !resto.trim()) { saltate++; continue; }
        const r2 = riconosci(resto.replace(CODICE_SET, "").trim());
        /* la coda condivisa si prova solo su una riga davvero spezzata */
        const r3 = r2.stato === "ignota" && pezzi.length > 1 && pezzo !== ultimo
          ? completaConCoda(resto.trim(), staccaQuantita(ultimo.replace(CODICE_SET, "").trim())[1].trim())
          : null;
        ris = r3 || r2; qta = q; grezzo = resto.trim();
      }
      aggiungiVoce(qta, grezzo, ris);
    }
  }
  return { nome, voci, saltate };
}

/* ---- che mazzo ne viene fuori ---- */
/* L'epoca proposta è la più stretta in cui il mazzo si gioca davvero: la tacca
   della carta più recente. È il senso di questa app — una ricetta vive dentro
   una saga — e risparmia all'utente di andarla a cercare. */
function riassuntoLettura(l, scelte) {
  const carte = [], tagliate = [], ignote = [], daScegliere = [];
  for (let i = 0; i < l.voci.length; i++) {
    const v = l.voci[i];
    const k = v.stato === "ok" ? v.k : (scelte && scelte[i] !== undefined ? scelte[i] : undefined);
    if (k === undefined) {
      (v.stato === "scelta" ? daScegliere : ignote).push({ i, v });
      continue;
    }
    const qta = Math.min(3, v.qta);
    if (v.qta > 3) tagliate.push({ nome: CARTE[k][N], chieste: v.qta });
    carte.push({ k, qta });
  }
  const chiavi = carte.map(x => x.k);
  const main = carte.filter(x => !eExtra(CARTE[x.k])).reduce((a, x) => a + x.qta, 0);
  const extra = carte.filter(x => eExtra(CARTE[x.k])).reduce((a, x) => a + x.qta, 0);
  /* una carta senza data di uscita nota non può stringere l'epoca: conta come «tutto» */
  const epoca = chiavi.length
    ? chiavi.reduce((a, k) => Math.max(a, CARTE[k][T] < 0 ? ULTIMA : CARTE[k][T]), 0) : ULTIMA;
  return { carte, tagliate, ignote, daScegliere, main, extra, epoca };
}

function creaDaLettura(nome, cursore, r) {
  const m = nuovoMazzo(nome, cursore);
  for (const x of r.carte) m.carte[CARTE[x.k][N]] = (m.carte[CARTE[x.k][N]] || 0) + x.qta;
  m.modificato = Date.now();
  versioneMazzi++;
  salvaMazzi(true);
  return m;
}

/* =====================================================================
   Le due schermate: si incolla, si guarda cosa è venuto fuori, si crea
   ===================================================================== */
function vistaIncolla() {
  const corpo = () => `
    <p class="nota">Incolla una lista di carte: quella sotto un video, quella di un sito,
      un file <b>.ydk</b>, o un mazzo esportato da qui. Puoi lasciarla com'è — puntini,
      intestazioni e numeri di sezione li salto io.</p>
    <textarea class="campo" id="lista" rows="14" spellcheck="false"
      placeholder="3x Royal Magical Library&#10;1x Exodia the Forbidden One&#10;&#10;Magie (32)&#10;3x Pot of Greed&#10;…">${esc(STATO.testoLista || "")}</textarea>
    <button class="azione" data-az="leggi">Leggi la lista</button>
    <p class="nota">Riconosco i nomi in inglese (quelli stampati sulle carte) e quelli
      italiani ufficiali. Prima di creare il mazzo ti mostro cosa ho capito.</p>`;
  return { titolo: "Incolla un mazzo", indietro: true, corpo };
}

/* una riga del resoconto: la carta, quante copie, e come toglierla */
function rigaLetta(k, qta, i) {
  const c = CARTE[k];
  return `<div class="ris">
    <button class="tocca-ris" data-c="${k}">
      ${c[ID] ? `<img src="${img(c[ID])}" alt="" loading="lazy">` : `<div class="vuota"></div>`}</button>
    <span style="min-width:0;flex:1">
      <button class="tocca-ris" data-c="${k}"><span class="nome">${esc(c[N])}</span></button>
      ${c[NI] && c[NI] !== c[N] ? `<small class="it">${esc(c[NI])}</small>` : ""}
      <small>${esc(CORNICE[cornice(c)] ? CORNICE[cornice(c)][0] : "")} · ${c[A] || "?"}</small></span>
    <span class="quante">${qta}×</span>
    <button class="via-voce" data-togli-voce="${i}" aria-label="Togli ${esc(c[N])}">✕</button></div>`;
}

function vistaLetto() {
  if (!STATO.lettura) return vistaIncolla();
  const corpo = () => {
    const l = STATO.lettura;
    const r = riassuntoLettura(l, STATO.scelteLettura);
    /* l'epoca del mazzo che sta per nascere è il cursore, come in «Nuovo mazzo»:
       così la barra fissa, il pannello e questi due tasti dicono sempre la stessa
       cosa, e si può anche scegliere un anno preciso da lassù */
    const ep = STATO.cursore;
    /* quale carta tiene alta l'epoca: toglierla può far scendere il mazzo di una saga */
    const piuRecente = r.carte.filter(x => CARTE[x.k][T] === r.epoca).map(x => CARTE[x.k]);
    const main = r.carte.filter(x => !eExtra(CARTE[x.k]));
    const extra = r.carte.filter(x => eExtra(CARTE[x.k]));
    const totale = r.main + r.extra;

    const scelte = r.daScegliere.map(({ i, v }) => `<div class="avviso">
      Due carte si chiamano «${esc(v.testo)}». Quale intendevi?
      <div>${v.scelte.map(k => `<button class="chip" data-scelta="${i}:${k}">${esc(CARTE[k][N])}${
        CARTE[k][A] ? ` · ${CARTE[k][A]}` : ""}</button>`).join("")}
        <button class="chip spenta" data-togli-voce="${i}">Lasciala fuori</button></div></div>`).join("");

    const ignote = r.ignote.length ? `<div class="avviso">
      ${r.ignote.length === 1 ? "Una carta non l'ho riconosciuta" : `${r.ignote.length} carte non le ho riconosciute`}.
      O sono scritte diversamente, o in questo gioco non ci sono.
      ${r.ignote.map(({ i, v }) => `<div class="ignota"><b>${esc(v.testo)}</b>
        ${v.scelte.length ? `<div>${v.scelte.map(k => `<button class="chip" data-scelta="${i}:${k}">
          ${esc(CARTE[k][N])}</button>`).join("")}
          <button class="chip spenta" data-togli-voce="${i}">Nessuna</button></div>`
        : `<div><button class="chip spenta" data-togli-voce="${i}">Va bene, lasciala fuori</button></div>`}
        </div>`).join("")}</div>` : "";

    const tagliate = r.tagliate.length ? `<div class="avviso ok">Portate a 3 copie, che è il massimo:
      ${r.tagliate.map(t => `${esc(t.nome)} (ne chiedeva ${t.chieste})`).join(" · ")}</div>` : "";

    if (!totale && !r.ignote.length && !r.daScegliere.length)
      return `<p class="vuoto">In quel testo non ho trovato nessuna carta.<br>
        Controlla di aver incollato la lista giusta.</p>
        <button class="azione second" data-az="indietro">Torna a incollare</button>`;

    return `${scelte}${ignote}${tagliate}
      ${l.saltate ? `<p class="nota">Ho saltato ${l.saltate}
        ${plurale(l.saltate, "riga che non era una carta", "righe che non erano carte")}
        (intestazioni, conteggi, righe vuote).</p>` : ""}

      <label class="etichetta" for="nomeLista">Nome del mazzo</label>
      <input class="campo" id="nomeLista" value="${esc(STATO.nomeLettura || l.nome || "Mazzo incollato")}">

      <label class="etichetta">Epoca del mazzo</label>
      <div class="filtri">
        <button class="f" data-tacca="${r.epoca}" aria-pressed="${ep === r.epoca}">
          ${r.epoca >= ULTIMA ? "Tutto il gioco" : esc("Fino a " + etichettaBreve(r.epoca))}</button>
        ${r.epoca < ULTIMA ? `<button class="f" data-tacca="${ULTIMA}" aria-pressed="${ep >= ULTIMA}">Tutto il gioco</button>` : ""}
      </div>
      <p class="nota">${r.epoca >= ULTIMA
        ? "Qualche carta non ha una data di uscita nota: il mazzo nasce senza limiti di epoca."
        : `È l'epoca più stretta in cui il mazzo ci sta tutto: la carta più recente è
            <b>${esc(piuRecente.length ? piuRecente[0][N] : "")}</b>${
            piuRecente.length > 1 ? ` (e altre ${piuRecente.length - 1})` : ""}, del
            ${piuRecente.length ? piuRecente[0][A] : ""}.${
            ep < r.epoca ? ` <b class="male">Con l'epoca che hai scelto ora, ${
              num(r.carte.filter(x => !dentroA(x.k, ep)).length)} carte restano fuori.</b>` : ""}`}</p>

      <p class="anteprima">${num(totale)} ${plurale(totale, "carta", "carte")} ·
        Main <b class="${r.main >= 40 && r.main <= 60 ? "bene" : "male"}">${r.main}</b>/40 ·
        Extra <b class="${r.extra <= 15 ? "" : "male"}">${r.extra}</b>/15</p>
      <button class="azione" data-az="crea-lista" ${totale ? "" : "disabled"}>Crea il mazzo</button>

      <div class="sezione"><h3>Main Deck</h3><small>${r.main} carte</small></div>
      ${main.length ? main.map(x => rigaLetta(x.k, Math.min(3, x.qta), indiceVoce(l, x.k))).join("")
        : `<p class="vuoto">Niente nel Main.</p>`}
      ${extra.length ? `<div class="sezione"><h3>Extra Deck</h3><small>${r.extra} carte</small></div>`
        + extra.map(x => rigaLetta(x.k, Math.min(3, x.qta), indiceVoce(l, x.k))).join("") : ""}`;
  };
  return { titolo: "Cosa ho letto", indietro: true, corpo };
}
/* dalla carta alla voce che l'ha prodotta, per poterla togliere */
const indiceVoce = (l, k) => l.voci.findIndex((v, i) =>
  v.k === k || (STATO.scelteLettura && STATO.scelteLettura[i] === k));
