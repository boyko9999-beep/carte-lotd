
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
/* le lettere greche compaiono in una manciata di nomi («Damage Vaccine Ω MAX»)
   e nessuno le scrive: si trasformano in come si leggono */
const GRECHE = { "\u03b1": "alpha", "\u0391": "alpha", "\u03b2": "beta", "\u0392": "beta",
  "\u03b3": "gamma", "\u0393": "gamma", "\u03b4": "delta", "\u0394": "delta",
  "\u03c9": "omega", "\u03a9": "omega", "\u03a3": "sigma", "\u03c3": "sigma" };
/* i numeri romani si piegano in cifre da tutte e due le parti: l'archivio
   scrive «Mask Change II» e «XX-Saber», la gente scrive 2 e 20. Misurato:
   non nasce nessuna collisione nuova. */
const ROMANI = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8",
  ix: "9", x: "10", xi: "11", xii: "12", xx: "20" };
const senzaSegni = s => senzaAccenti(String(s)).toLowerCase()
  .replace(/[\u0391-\u03c9]/g, c => GRECHE[c] || c)
  .replace(/&/g, " and ")
  .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xx)\b/g, r => ROMANI[r])
  .replace(/[^a-z0-9]+/g, "");
let IT_ESATTO = null, NORM_EN = null, NORM_IT = null, PER_ID = null;
let NOMI_PIATTI = null;
function indiciNomi() {
  if (IT_ESATTO) return;
  IT_ESATTO = new Map(); NORM_EN = new Map(); NORM_IT = new Map(); PER_ID = new Map();
  NOMI_PIATTI = new Array(CARTE.length);
  const metti = (mappa, chiave, k) => {
    if (!chiave) return;
    const gia = mappa.get(chiave);
    if (gia) gia.push(k); else mappa.set(chiave, [k]);
  };
  for (let k = 0; k < CARTE.length; k++) {
    const c = CARTE[k];
    if (c[ID]) PER_ID.set(String(c[ID]), k);
    if (c[NI] && !IT_ESATTO.has(c[NI].toLowerCase())) IT_ESATTO.set(c[NI].toLowerCase(), k);
    const ne = senzaSegni(c[N]), ni = c[NI] ? senzaSegni(c[NI]) : "";
    NOMI_PIATTI[k] = ni && ni !== ne ? [ne, ni] : [ne];
    metti(NORM_EN, ne, k);
    if (ni) metti(NORM_IT, ni, k);
  }
}

/* Suggerimenti per una carta che non si trova: si riusa il motore di ricerca,
   una parola per volta, e vince chi risponde a più parole. Serve a distinguere
   «l'hai scritta diversa» da «in questo gioco non c'è»: chi scrive «Vaso
   dell'Avidità» deve vedersi proporre l'«Anfora dell'Avidità», che è il nome
   italiano vero. */
/* quanto due nomi si somigliano davvero: bigrammi in comune (Dice).
   La mappa della parola cercata si costruisce una volta sola: qui dentro si
   passano diecimila nomi, e rifarla ogni volta costava un quarto di secondo. */
const bigrammi = a => {
  const m = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
  return m;
};
function somiglianzaCon(A, lenA, b) {
  if (lenA < 2 || b.length < 2) return 0;
  let comuni = 0;
  const usati = [];
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2), q = A.get(g);
    if (q) { comuni++; A.set(g, q - 1); usati.push(g); }
  }
  for (const g of usati) A.set(g, A.get(g) + 1);      // la mappa si riusa: si rimette a posto
  return 2 * comuni / (lenA - 1 + b.length - 1);
}
const somiglianza = (a, b) => a.length < 2 || b.length < 2 ? (a === b ? 1 : 0)
  : somiglianzaCon(bigrammi(a), a.length, b);
/* una lista fatta tutta di carte che non esistono non deve tenere fermo il
   telefono: dopo venticinque ricerche larghe si smette di suggerire */
let scansioni = 0;
const azzeraScansioni = () => { scansioni = 0; };
function suggerimenti(t) {
  const n = senzaSegni(t);
  if (n.length < 3 || ++scansioni > 25) return [];
  indiciNomi();
  /* si confronta con tutti i nomi, inglesi e italiani: è l'unico modo di
     ripescare un refuso («Pot of Gred») o un nome che il gioco scrive in un
     altro modo («Red-Eyes Black Dragon» qui si chiama «Red-Eyes B. Dragon»).
     Diecimila confronti fra stringhe corte: si fa solo quando una carta non si
     trova, e costa una manciata di millisecondi. */
  const min = n.length * 0.55, max = n.length * 1.9;
  const A = bigrammi(n), migliori = [];
  for (let k = 0; k < CARTE.length; k++) {
    let s = 0;
    for (const nome of NOMI_PIATTI[k]) {
      if (nome.length < min || nome.length > max) continue;
      const x = somiglianzaCon(A, n.length, nome);
      if (x > s) s = x;
    }
    if (s < 0.5) continue;
    if (migliori.length < 5 || s > migliori[migliori.length - 1][1]) {
      migliori.push([k, s]);
      migliori.sort((a, b) => b[1] - a[1]);
      if (migliori.length > 5) migliori.pop();
    }
  }
  return migliori;
}
const soloChiavi = m => m.map(x => x[0]);

/* La scala del riconoscimento, dal più esatto al più largo. Si allarga solo
   se il passo prima non ha trovato niente. */
function riconosci(testo) {
  const t = String(testo).trim();
  if (!t) return { stato: "ignota", scelte: [] };
  const prove = varianti(t);
  for (let i = 1; i < prove.length; i++) {
    const r = riconosciEsatto(prove[i - 1]);
    if (r.stato !== "ignota") return r;
  }
  return riconosciEsatto(prove[prove.length - 1], t);
}
function riconosciEsatto(testo, perSuggerimenti) {
  const t = String(testo).trim();
  if (!t) return { stato: "ignota", scelte: [] };
  indiciNomi();
  const basso = t.toLowerCase();
  const k1 = PER_NOME.get(basso);                       // nome inglese esatto
  const k2 = IT_ESATTO.get(basso);                      // nome italiano ufficiale
  /* capita una volta sola in tutto l'archivio — «Doppelganger» è una carta
     inglese ED è il nome italiano di un'altra — e lì si chiede, invece di far
     vincere l'inglese per decreto e sbagliare in silenzio */
  if (k1 !== undefined && k2 !== undefined && k1 !== k2)
    return { stato: "scelta", scelte: [k1, k2] };
  if (k1 !== undefined) return { stato: "ok", k: k1 };
  if (k2 !== undefined) return { stato: "ok", k: k2 };
  const n = senzaSegni(t);                              // senza trattini, accenti, apostrofi
  if (!n) return { stato: "ignota", scelte: [] };
  for (const mappa of [NORM_EN, NORM_IT]) {
    const v = mappa.get(n);
    if (!v) continue;
    if (v.length === 1) return { stato: "ok", k: v[0] };
    return { stato: "scelta", scelte: v.slice(0, 4) };  // due carte plausibili: si chiede
  }
  if (perSuggerimenti === undefined) return { stato: "ignota", scelte: [] };
  const vicine = suggerimenti(perSuggerimenti);
  /* Un refuso si corregge da solo, ma alla luce del sole: se una carta somiglia
     quasi identica e stacca nettamente la seconda, si prende quella e lo si
     dice, con le altre lì accanto da toccare. Se invece le prime due si
     somigliano fra loro — «Red-Eyes Black Dragon» contro «Red-Eyes Black Dragon
     Sword» — non si indovina: si chiede. */
  if (vicine.length && vicine[0][1] >= 0.9 && (vicine.length < 2 || vicine[0][1] - vicine[1][1] >= 0.12))
    return { stato: "vicina", k: vicine[0][0], scelte: soloChiavi(vicine) };
  return { stato: "ignota", scelte: soloChiavi(vicine) };
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
/* i segni da elenco che si portano dietro le liste incollate: trattini, puntini,
   tabulazioni, asterischi del markdown, emoji. Si toglie tutto quello che non è
   una lettera o una cifra — ma non le virgolette, perché «"A" Cell Breeding
   Device» e i suoi parenti cominciano davvero così. */
const SEGNI_PRIMA = /^[^\p{L}\p{N}"'(]+/u;
const SEGNI_DOPO = /[^\p{L}\p{N})\]"']+$/u;
const NUMERATA = /^\d+[.)]\s+/;
/* Una riga è un'intestazione solo se è TUTTA lì: così «Magie (32)» sparisce
   ma «Deck Devastation Virus», che comincia per Deck, resta una carta. */
const SEZIONE = /^[#!]?\s*(?:main|extra|side|principale|mostri?|magie?|trappole?|monsters?|spells?|traps?|deck ?list|sideboard|totale|total|fusioni?|sincro|synchro|xyz|link|pendulum|pendolo|rituali?)\s*(?:deck)?\s*[:\-–]?\s*(?:[([]?\s*\d+\s*[)\]]?)?\s*(?:carte|cards)?\s*$/i;
/* Seconda rete per le intestazioni, usata SOLO su una riga che non è risultata
   una carta: se è fatta tutta di parole da intestazione e numeri, è
   un'intestazione. «Deck Devastation Virus» non ci casca, perché "devastation"
   non è una di quelle parole — e comunque è già stata riconosciuta come carta. */
const PAROLA_SEZIONE = /^(?:carte|carta|mazzo|deck|decklist|lista|main|extra|side|sideboard|principale|mostri|mostro|magie|magia|trappole|trappola|monsters?|spells?|traps?|fusioni|fusione|sincro|synchro|xyz|link|pendulum|pendolo|rituali|rituale|effetto|effetti|normali|normale|veloci|veloce|continue|totale|total|cards?|deck)$/i;
const soloParoleDiSezione = r => {
  const p = r.replace(/[()[\]:.,\-–—]/g, " ").split(/\s+/).filter(Boolean);
  return p.length > 0 && p.length <= 4 && p.some(x => PAROLA_SEZIONE.test(x))
    && p.every(x => PAROLA_SEZIONE.test(x) || /^\d+$/.test(x));
};
const PARE_INDIRIZZO = /^(?:https?:\/\/|www\.)\S+$/i;

/* il Side Deck non esiste in questo gioco: da lì in giù si scarta, finché non
   ricomincia il Main o l'Extra */
const SEZIONE_SIDE = /^[#!]?\s*(?:side|sideboard)\s*(?:deck)?\b/i;
const SEZIONE_DENTRO = /^[#!]?\s*(?:main|extra|principale|mostri?|magie?|trappole?|monsters?|spells?|traps?)\b/i;
const NUMERI_IT = { una: 1, uno: 1, un: 1, due: 2, tre: 3 };

/* Le forme in cui si scrive una quantità. L'ordine conta: prima quelle con un
   segno esplicito, per ultima «3 Nome», che è anche l'inizio di «3-Hump Lacooda».
   «Harpie Lady 3» invece è un nome intero: un numero in coda vale come quantità
   solo se è staccato da una tabulazione o da più spazi. */
function staccaQuantita(t) {
  let m;
  /* la «x» del moltiplicatore o sta attaccata al numero («3x Nome») o ha uno
     spazio dopo («3 x Nome»): senza questa distinzione «2 XX-Saber Faultroll»
     diventava due copie di «X-Saber Faultroll», che è un'altra carta */
  if ((m = t.match(/^(\d{1,2})[x×*]\s*(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^(\d{1,2})\s*[x×*]\s+(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^[x×]\s*(\d{1,2})[\s.:-]+(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^(\d{1,2})\s+(?:copie|copia|volte)\s+(?:di\s+)?(.+)$/i))) return [+m[1], m[2]];
  if ((m = t.match(/^(una|uno|un|due|tre)\s+(?:copie|copia)\s+di\s+(.+)$/i))) return [NUMERI_IT[m[1].toLowerCase()], m[2]];
  if ((m = t.match(/^(una|uno|un|due|tre)\s+(.+)$/i))) return [NUMERI_IT[m[1].toLowerCase()], m[2]];
  if ((m = t.match(/^(.+?)\s*[([]\s*[x×*]\s*(\d{1,2})\s*[)\]]$/i))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)\s*[x×*]\s*(\d{1,2})$/i))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)\s*[([]\s*(\d{1,2})\s*[)\]]$/))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)\s*:\s*(\d{1,2})$/))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)[\s.·•_]{2,}(\d{1,2})$/))) return [+m[2], m[1]];
  if ((m = t.match(/^(.+?)(?:\t+|\s{2,})(\d{1,2})$/))) return [+m[2], m[1]];
  if ((m = t.match(/^(\d{1,2})[\s.:-]+(.+)$/))) return [+m[1], m[2]];
  return [1, t];
}

/* Quello che resta attaccato al nome nelle liste vere: il codice del set, la
   rarità, il nome italiano fra parentesi. Si tolgono solo se il nome così com'è
   non esiste — «Destiny HERO - Dominance» non va toccata. */
function varianti(t) {
  const out = [t];
  /* nessuno dei 10.026 nomi contiene una parentesi: quello che sta fra parentesi
     è sempre roba aggiunta da chi ha scritto la lista */
  const senzaParentesi = t.replace(/\s*[([][^)\]]*[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();
  if (senzaParentesi && senzaParentesi !== t) out.push(senzaParentesi);
  let x = out[out.length - 1];
  for (let i = 0; i < 3; i++) {
    const y = x.replace(/\s*[([][^)\]]*[)\]]\s*$/, "")
      .replace(/\s+[-–—]\s+[A-Za-zÀ-ÿ ]{3,20}$/, "").trim();
    if (!y || y === x) break;
    out.push(y); x = y;
  }
  return out;
}

/* Una riga può contenere più carte: separate da « / » (nessun nome ne contiene
   uno con gli spazi intorno, mentre «D/D Berfomet» e «A/D Changer» sì: sono 56
   nell'archivio e non vanno spezzate) oppure da virgole, ma solo se ogni pezzo
   dopo il primo comincia con una quantità — «Adreus, Keeper of Armageddon» è un
   nome solo. */
const CON_QUANTITA = /^(?:\d{1,2}\s*[x×*]?|[x×]\s*\d{1,2})\s+\S/i;
const SEPARATORI = [/\s*,\s*/, /\s+e\s+/i, /\s+and\s+/i, /\s+\+\s+/];
function spezzaRiga(r) {
  if (/\s\/\s/.test(r)) {
    const p = r.split(/\s+\/\s+/).map(x => x.trim()).filter(Boolean);
    if (p.length > 1) return p;
  }
  for (const sep of SEPARATORI) {
    if (!sep.test(r)) continue;
    const p = r.split(sep).map(x => x.trim()).filter(Boolean);
    if (p.length < 2) continue;
    /* con le quantità davanti è chiaro che sono carte diverse; senza, si accetta
       lo spezzettamento solo se OGNI pezzo è davvero una carta — così
       «Adreus, Keeper of Armageddon» resta una carta sola */
    if (p.slice(1).every(x => CON_QUANTITA.test(x))) return p;
    if (p.every(x => riconosciEsatto(staccaQuantita(x)[1].trim()).stato === "ok")) return p;
  }
  return [r];
}

/* ---- leggere tutta la lista ---- */
const ENTITA = [[/&amp;/gi, "&"], [/&quot;/gi, '"'], [/&(?:apos|#0?39);/gi, "'"],
  [/&nbsp;/gi, " "], [/&#x200b;/gi, ""], [/&#8203;/gi, ""], [/&[a-z]{2,6};/gi, ""]];

function leggiLista(testo) {
  azzeraScansioni();
  const righe = String(testo || "").replace(/\r/g, "").split("\n");
  const voci = [], indice = new Map();
  let nome = null, saltate = 0, side = 0, nelSide = false;

  const aggiungiVoce = (qta, grezzo, ris) => {
    const chiave = ris.stato === "ok" ? "k" + ris.k : "t" + grezzo.toLowerCase();
    const gia = indice.get(chiave);
    if (gia !== undefined) { voci[gia].qta += qta; return; }
    indice.set(chiave, voci.length);
    voci.push({ qta, testo: grezzo, stato: ris.stato, k: ris.k, scelte: ris.scelte || [] });
  };

  for (const grezza of righe) {
    let r = String(grezza).replace(/\u00a0/g, " ");
    for (const [re, con] of ENTITA) r = r.replace(re, con);
    r = r.trim();
    if (!r || r.startsWith("//")) continue;
    /* i commenti: «# Mazzo di prova» dà il nome, «#main» e «!side» dei .ydk no */
    if (r[0] === "#" || r[0] === "!") {
      if (SEZIONE_SIDE.test(r)) { nelSide = true; continue; }
      if (SEZIONE_DENTRO.test(r)) { nelSide = false; continue; }
      const c = r.slice(1).trim();
      if (!nome && c && !/^(main|extra|side|created|epoca|dove trovare)/i.test(c)) nome = c;
      continue;
    }
    r = r.replace(SEGNI_PRIMA, "").replace(NUMERATA, "")
      .replace(/^n[.°]?\s*(?=\d)/i, "").replace(SEGNI_DOPO, "").trim();
    if (!r) continue;
    if (PARE_INDIRIZZO.test(r)) { saltate++; continue; }
    const dentroSide = x => { if (SEZIONE_SIDE.test(x)) nelSide = true; else if (SEZIONE_DENTRO.test(x)) nelSide = false; };
    if (SEZIONE.test(r)) { dentroSide(r); saltate++; continue; }
    /* la riga intera è già una carta? allora non si spezza e non si interpreta:
       «Adreus, Keeper of Armageddon» e «Pot of Greed» finiscono qui */
    const intero = riconosciEsatto(r);
    /* righe senza nemmeno una lettera: righelli, conteggi, numeri sparsi. Si
       scartano DOPO aver provato il nome, perché esiste una carta che si chiama
       «7», e dopo aver provato a staccare la quantità, perché «3 7» sono tre. */
    if (intero.stato !== "ok" && !/[a-z]/i.test(r) && !/^\d{6,9}$/.test(r)
        && riconosciEsatto(staccaQuantita(r)[1].trim()).stato !== "ok") { saltate++; continue; }
    if (intero.stato !== "ok" && soloParoleDiSezione(r)) { dentroSide(r); saltate++; continue; }
    /* il titolo in cima («Mazzo Exodia — lista di Marti») dà il nome al mazzo */
    if (intero.stato !== "ok" && nome === null && !voci.length
        && /^(?:mazzo|deck|lista|decklist)\b/i.test(r) && r.split(/\s+/).length > 1) {
      nome = r; saltate++; continue;
    }
    const pezzi = intero.stato === "ok" ? [r] : spezzaRiga(r);
    const ultimo = pezzi[pezzi.length - 1];
    for (const pezzo of pezzi) {
      /* prima il nome così com'è, ma solo esatto: «7 Colored Fish» e «7» sono
         carte vere, mentre «Pot of Greed (3)» è una carta più una quantità */
      let ris = riconosciEsatto(pezzo), qta = 1, grezzo = pezzo;
      if (ris.stato !== "ok" && /^\d{6,9}$/.test(pezzo)) {     // un .ydk: solo codici
        indiciNomi();
        const k = PER_ID.get(pezzo) !== undefined ? PER_ID.get(pezzo) : PER_ID.get(String(+pezzo));
        if (k !== undefined) ris = { stato: "ok", k };
      }
      if (ris.stato !== "ok") {
        const [q, resto] = staccaQuantita(pezzo);
        if (q < 1 || q > 99 || !resto.trim()) { saltate++; continue; }
        const r2 = riconosci(resto.trim());
        /* la coda condivisa si prova solo su una riga davvero spezzata */
        const r3 = r2.stato === "ignota" && pezzi.length > 1 && pezzo !== ultimo
          ? completaConCoda(resto.trim(), staccaQuantita(ultimo)[1].trim())
          : null;
        ris = r3 || r2; qta = q; grezzo = resto.trim();
      }
      /* una frase di discorso non è una carta scritta male: si lascia perdere in
         silenzio (il nome più lungo dell'archivio è di nove parole) */
      if (ris.stato === "ignota" &&
          (grezzo.split(/\s+/).length >= 10 || /[?!]\s*$/.test(grezzo) && grezzo.split(/\s+/).length >= 6)) {
        saltate++; continue;
      }
      if (nelSide) { side += qta; continue; }
      aggiungiVoce(qta, grezzo, ris);
    }
  }
  return { nome, voci, saltate, side };
}

/* ---- che mazzo ne viene fuori ---- */
/* L'epoca proposta è la più stretta in cui il mazzo si gioca davvero: la tacca
   della carta più recente. È il senso di questa app — una ricetta vive dentro
   una saga — e risparmia all'utente di andarla a cercare. */
function riassuntoLettura(l, scelte) {
  const carte = [], tagliate = [], ignote = [], daScegliere = [], interpretate = [];
  for (let i = 0; i < l.voci.length; i++) {
    const v = l.voci[i];
    const scelto = scelte && scelte[i] !== undefined ? scelte[i] : undefined;
    const k = scelto !== undefined ? scelto
      : (v.stato === "ok" || v.stato === "vicina") ? v.k : undefined;
    if (k === undefined) {
      (v.stato === "scelta" ? daScegliere : ignote).push({ i, v });
      continue;
    }
    if (v.stato === "vicina" && scelto === undefined) interpretate.push({ i, v, k });
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
  return { carte, tagliate, ignote, daScegliere, interpretate, main, extra, epoca };
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

    const letteCosi = r.interpretate.length ? `<div class="avviso ok">
      ${r.interpretate.length === 1 ? "Una carta era scritta un po' diversa e l'ho interpretata"
        : `${r.interpretate.length} carte erano scritte un po' diverse e le ho interpretate`}.
      Se ho sbagliato, tocca quella giusta.
      ${r.interpretate.map(({ i, v, k }) => `<div class="ignota"><b>${esc(v.testo)}</b> →
        <span class="chip">${esc(CARTE[k][N])}</span>
        <div>${v.scelte.filter(x => x !== k).map(x => `<button class="chip spenta" data-scelta="${i}:${x}">
          ${esc(CARTE[x][N])}</button>`).join("")}
          <button class="chip spenta" data-togli-voce="${i}">Nessuna</button></div></div>`).join("")}</div>` : "";

    const tagliate = r.tagliate.length ? `<div class="avviso ok">Portate a 3 copie, che è il massimo:
      ${r.tagliate.map(t => `${esc(t.nome)} (ne chiedeva ${t.chieste})`).join(" · ")}</div>` : "";

    if (!totale && !r.ignote.length && !r.daScegliere.length && !r.interpretate.length)
      return `<p class="vuoto">In quel testo non ho trovato nessuna carta.<br>
        Controlla di aver incollato la lista giusta.</p>
        <button class="azione second" data-az="indietro">Torna a incollare</button>`;

    return `${scelte}${ignote}${letteCosi}${tagliate}
      ${l.side ? `<p class="nota">Ho lasciato fuori ${num(l.side)}
        ${plurale(l.side, "carta del Side Deck", "carte del Side Deck")}: in questo gioco
        il Side Deck non c'è.</p>` : ""}
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
