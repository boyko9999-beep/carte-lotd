
/* =====================================================================
   Scheda della carta
   ===================================================================== */
function scheda(k) {
  const c = CARTE[k], m = mazzoAperto();
  const t = c[T], saga = t >= 0 ? SAGHE[TACCHE[t].s] : null;
  /* il pavimento di meccanica ha alzato la disponibilità? l'anno di uscita
     e l'anno della tacca non coincidono più */
  const alzata = t >= 0 && c[A] && c[A] !== TACCHE[t].a;
  const dentroOra = dentro(k);
  const luoghi = [...new Set([c[BU], ...c[FO]])];

  const quando = t < 0 ? "data di uscita non nota"
    : alzata ? `Uscita ${c[A]} · giocabile da ${saga.nome} perché è
        ${esc((CORNICE[cornice(c)] || ["una carta"])[0]).toLowerCase().startsWith("m") ? "un" : "una"}
        ${esc((CORNICE[cornice(c)] || ["carta"])[0])}`
    : `${c[A]} · ${esc(saga.nome)}`;
  const stato = dentroOra ? "nella tua epoca ✓"
    : `fuori dalla tua epoca (${esc(etichettaFino() || "tutto il gioco")})`;

  const v = document.createElement("div");
  v.className = "velo";
  v.innerHTML = `<div class="scheda">
    ${c[ID] ? `<img src="${imgGrande(c[ID])}" alt="${esc(c[N])}">` : ""}
    <h3>${esc(c[N])}</h3>
    ${c[NI] && c[NI] !== c[N] ? `<div class="nome-it">${esc(c[NI])}</div>` : ""}
    <div class="meta">${[CORNICE[cornice(c)] ? CORNICE[cornice(c)][0] : "",
      razzaIt(c), attributoIt(c), c[AR] >= 0 ? ARCHETIPI[c[AR]] : "", c[R] ? "rara" : ""]
      .filter(Boolean).map(esc).join(" · ")}</div>
    <div class="blocco-scheda"><h4>Quando è uscita</h4>
      <div class="meta">${quando}</div>
      <div class="meta ${dentroOra ? "bene" : "male"}">${stato}</div></div>
    <div class="blocco-scheda"><h4>Dove si trova</h4>
      ${luoghi.map(l => `<div class="meta riga-dove">${ICONA[LUOGHI[l].tipo]}
        ${esc(nomeLuogo(l))} · ${esc(dettaglioLuogoTesto(l))}</div>`).join("")}</div>
    ${m ? `<div class="scheda-mazzo"><span>In «${esc(m.nome)}»: <b class="copie-testo">${copie(m, c[N])} copie</b></span>
      ${controlloCopie(k, "largo")}</div>`
      : MAZZI.length ? `<div class="scheda-mazzo"><select class="campo" id="selMazzo">
        <option value="">Aggiungi a un mazzo…</option>
        ${MAZZI.map(x => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join("")}</select></div>` : ""}
    <button class="chiudi">Chiudi</button></div>`;
  v.addEventListener("click", e => {
    if (e.target.closest(".scheda") && !e.target.closest(".chiudi")) return;
    v.remove();
  });
  const sel = v.querySelector("#selMazzo");
  if (sel) sel.onchange = () => {
    const mm = sel.value && mazzoDi(sel.value);
    sel.value = "";
    if (!mm) return;
    const no = perchéNo(mm, k);
    if (no) {   // il mazzo è pieno o ha già 3 copie: dirlo, non tacere
      const p = document.createElement("p");
      p.className = "meta male"; p.textContent = `${mm.nome}: ${no}`;
      sel.parentNode.appendChild(p);
      return;
    }
    aggiungi(mm, k); v.remove(); apriMazzo(mm.id);
  };
  document.body.appendChild(v);
}

/* =====================================================================
   Quale schermata mostrare
   ===================================================================== */
function schermataCorrente() {
  switch (STATO.schermata) {
    case "luogo": return vistaLuogo();
    case "mazzo": return vistaMazzo();
    case "nuovo": return vistaNuovo();
    case "scegli": return vistaSelettore();
    case "spesa": return vistaSpesa();
    case "esporta": return vistaEsporta();
    case "incolla": return vistaIncolla();
    case "letto": return vistaLetto();
  }
  const v = STATO.vista === "carte" ? vistaCarte()
    : STATO.vista === "dove" ? vistaDove()
    : STATO.vista === "mazzi" ? vistaMazzi() : vistaBuste();
  v.testa = barraTab() + (v.testa || "");
  return v;
}

function indietro() {
  switch (STATO.schermata) {
    /* si torna da dove si è arrivati: dalla lista della spesa, non alle tab */
    case "luogo": return vaiA({ schermata: STATO.ritorno || null, luogo: null, q: "",
      tipiAttivi: new Set(), ritorno: null });
    case "nuovo": esciDalContesto(); STATO.nomeNuovo = ""; return vaiA({ schermata: null, vista: "mazzi" });
    case "scegli": return vaiA({ schermata: "mazzo", qSel: "", tipiAttivi: new Set() });
    case "spesa": case "esporta": return vaiA({ schermata: "mazzo" });
    case "mazzo": return chiudiMazzo();
    /* dal resoconto si torna al testo, che resta lì: si corregge e si rilegge */
    case "letto": esciDalContesto(); return vaiA({ schermata: "incolla" });
    case "incolla": esciDalContesto(); return vaiA({ schermata: null, vista: "mazzi" });
  }
  vaiA({ schermata: null });
}

/* =====================================================================
   Eventi
   ===================================================================== */
document.addEventListener("click", e => {
  const el = s => e.target.closest(s);
  let t;

  /* i salti fra le due sezioni dei risultati se li gestisce l'app: l'ancora
     nativa atterrava e poi la griglia di sopra cresceva e portava via la pagina */
  if ((t = el('a[href^="#"]'))) {
    e.preventDefault();
    vaiAncora(t.getAttribute("href").slice(1));
    return;
  }

  /* Raggiunto un limite, TUTTI i "+" a schermo vanno disattivati, non solo
     quello toccato: altrimenti restano accesi e non fanno niente. */
  const pieno = m => m ? (conta(m, false) >= 60) + "|" + (conta(m, true) >= 15) : "";
  /* Nella schermata del mazzo tutto dipende dalle copie (contatori, sottototali,
     avviso fuori epoca, righe che spariscono): lì si ridisegna il corpo intero,
     che è corto. Nel selettore, con mille piastrelle, si aggiorna solo quel che
     serve. */
  const dopoModifica = (k, cambioPieno) => {
    if (STATO.schermata === "mazzo") ridisegnaCorpo();
    else if (cambioPieno) aggiornaDisponibilita();
    /* per ultimo, e sempre: la scheda della carta vive fuori da #corpo, quindi
       il ridisegno non la tocca e restava ferma su "1 copie" mentre il mazzo
       cambiava davvero, col "+" acceso anche oltre la terza copia */
    aggiornaControllo(k);
  };
  if ((t = el("[data-piu]"))) {
    const k = +t.dataset.piu, m = mazzoAperto();
    if (!m) return;
    const prima = pieno(m);
    aggiungi(m, k);
    dopoModifica(k, pieno(m) !== prima);
    return;
  }
  if ((t = el("[data-meno]"))) {
    const k = +t.dataset.meno, m = mazzoAperto();
    if (!m) return;
    const prima = pieno(m);
    togli(m, CARTE[k][N]);
    dopoModifica(k, pieno(m) !== prima);
    return;
  }
  if ((t = el("[data-altre]"))) {
    if (!accodaCarte(t.dataset.altre)) ridisegnaCorpo();
    return;
  }
  if ((t = el("[data-via]"))) { const m = mazzoAperto(); togli(m, t.dataset.via, true); return render(); }
  if ((t = el("[data-c]"))) return scheda(+t.dataset.c);
  if ((t = el("[data-l]"))) return vaiA({ schermata: "luogo", luogo: +t.dataset.l, q: "",
    tipiAttivi: new Set(), ritorno: STATO.schermata });
  if ((t = el("[data-g]"))) { STATO.gruppo = STATO.gruppo === t.dataset.g ? null : t.dataset.g; return ridisegnaCorpo(); }
  if ((t = el("[data-saga]"))) return impostaCursore(SAGHE[+t.dataset.saga].ultima);
  if ((t = el("[data-tacca]"))) { if (t.dataset.tacca !== "") return impostaCursore(+t.dataset.tacca); return; }
  if ((t = el("[data-mazzo]"))) return apriMazzo(t.dataset.mazzo);
  if ((t = el("[data-nuovo]"))) {
    entraInContesto(); STATO.cursore = +t.dataset.nuovo; STATO.soloNuove = false;
    return vaiA({ schermata: "nuovo" });
  }
  if ((t = el("[data-t]"))) {
    const c = t.dataset.t;
    STATO.tipiAttivi.has(c) ? STATO.tipiAttivi.delete(c) : STATO.tipiAttivi.add(c);
    azzeraLimiti();
    return ridisegnaCorpo();
  }
  if ((t = el("[data-v]"))) {
    STATO.soloNuove = false; STATO.gruppo = null; STATO.q = "";
    return vaiA({ vista: t.dataset.v, schermata: null, tipiAttivi: new Set(), pannello: false });
  }

  /* resoconto della lista incollata: risolvere un dubbio o togliere una voce */
  if ((t = el("[data-scelta]"))) {
    const [i, k] = t.dataset.scelta.split(":").map(Number);
    STATO.scelteLettura[i] = k;
    return ridisegnaCorpo();
  }
  if ((t = el("[data-togli-voce]"))) {
    /* una carta può venire da più righe della lista: si tolgono tutte, dalla
       più in fondo, così gli indici di quelle prima restano buoni */
    const indici = String(t.dataset.togliVoce).split(",").map(Number)
      .filter(x => !isNaN(x)).sort((a, b) => b - a);
    for (const i of indici) {
      if (!STATO.lettura || !STATO.lettura.voci[i]) continue;
      STATO.lettura.voci.splice(i, 1);
      /* le scelte sono indicizzate sulle voci: vanno fatte scorrere anche loro */
      const nuove = {};
      for (const j in STATO.scelteLettura) {
        const x = +j;
        if (x < i) nuove[x] = STATO.scelteLettura[j];
        else if (x > i) nuove[x - 1] = STATO.scelteLettura[j];
      }
      STATO.scelteLettura = nuove;
    }
    return ridisegnaCorpo();
  }
  if (!(t = el("[data-az]"))) return;
  const m = mazzoAperto();
  switch (t.dataset.az) {
    case "pannello": STATO.pannello = !STATO.pannello; return render();
    case "indietro": return indietro();
    case "tutto": return impostaCursore(ULTIMA);
    case "pulisci":
      STATO.q = ""; STATO.tipiAttivi = new Set(); STATO.nascondiFuori = false;
      STATO.soloNuove = false; azzeraLimiti();
      /* l'epoca di un mazzo aperto è una sua proprietà: non si azzera per
         sbaglio insieme ai filtri di una schermata */
      if (!m && STATO.cursore < ULTIMA) return impostaCursore(ULTIMA);
      return render();
    case "solo-nuove": STATO.soloNuove = !STATO.soloNuove; azzeraLimiti(); return render();
    case "senza-tipi": STATO.tipiAttivi = new Set(); azzeraLimiti(); return ridisegnaCorpo();

    case "ordine": STATO.ordine = STATO.ordine === "epoca" ? "nome" : "epoca"; azzeraLimiti(); return ridisegnaCorpo();
    case "nascondi": STATO.nascondiFuori = !STATO.nascondiFuori; azzeraLimiti(); return ridisegnaCorpo();
    case "fuori": STATO.mostraFuori = !STATO.mostraFuori; azzeraLimiti(); return ridisegnaCorpo();
    case "crea": {
      const nome = (document.getElementById("nm") || {}).value || STATO.nomeNuovo || "";
      const nuovo = nuovoMazzo(nome.trim() || "Mazzo " + (MAZZI.length + 1), STATO.cursore);
      STATO.mazzo = nuovo.id;
      STATO.soloNuove = false;   // dentro un mazzo l'unica epoca che conta è la sua
      STATO.nomeNuovo = "";
      return vaiA({ schermata: "scegli", qSel: "" });
    }
    case "scegli": return vaiA({ schermata: "scegli", qSel: "", tipiAttivi: new Set() });
    case "incolla": esciDalContesto(); return vaiA({ schermata: "incolla", mazzo: null });
    case "leggi": {
      const campo = document.getElementById("lista");
      if (campo) STATO.testoLista = campo.value;
      STATO.lettura = leggiLista(STATO.testoLista);
      STATO.scelteLettura = {};
      STATO.nomeLettura = STATO.lettura.nome || "";
      /* il mazzo nasce nell'epoca più stretta in cui ci sta tutto: è quella che
         serve per giocarlo davvero. L'epoca di prima si ritrova uscendo. */
      entraInContesto();
      STATO.cursore = riassuntoLettura(STATO.lettura, {}).epoca;
      STATO.soloNuove = false;
      return vaiA({ schermata: "letto" });
    }
    case "crea-lista": {
      const l = STATO.lettura;
      if (!l) return vaiA({ schermata: "incolla" });
      const r = riassuntoLettura(l, STATO.scelteLettura);
      if (!r.carte.length) return;
      const campo = document.getElementById("nomeLista");
      const nome = ((campo && campo.value) || STATO.nomeLettura || l.nome || "Mazzo incollato").trim();
      const nuovo = creaDaLettura(nome || "Mazzo incollato", STATO.cursore, r);
      STATO.testoLista = ""; STATO.lettura = null; STATO.scelteLettura = {};
      STATO.nomeLettura = "";
      return apriMazzo(nuovo.id);
    }
    case "apri-mazzo": return vaiA({ schermata: "mazzo" });
    case "spesa": return vaiA({ schermata: "spesa" });
    case "esporta": return vaiA({ schermata: "esporta" });
    case "allarga":
      m.cursore = ULTIMA; STATO.cursore = ULTIMA; m.modificato = Date.now();
      salvaMazzi(); return render();
    case "elimina":
      if (!confirm("Eliminare «" + m.nome + "»? Non si può annullare.")) return;
      MAZZI = MAZZI.filter(x => x.id !== m.id);
      CANCELLATI.push(m.id);
      DB.set("cancellati", CANCELLATI).catch(() => {});
      salvaMazzi(true);
      return chiudiMazzo();
    case "copia-mazzo": return copia(testoMazzo(m), t);
    case "copia-spesa": return copia(testoSpesa(m), t);
  }
});

let attesaRicerca;
document.addEventListener("input", e => {
  const q = e.target.closest("[data-q]");
  if (q) {
    const chiave = q.dataset.q;
    /* il testo entra subito nello stato (così un render lo conserva), solo il
       ridisegno aspetta: il campo non perde mai i tasti */
    STATO[chiave] = q.value; azzeraLimiti();
    clearTimeout(attesaRicerca);
    attesaRicerca = setTimeout(ridisegnaCorpo, 200);
    return;
  }
  if (e.target.id === "nm") { STATO.nomeNuovo = e.target.value; return; }
  if (e.target.id === "lista") { STATO.testoLista = e.target.value; return; }
  if (e.target.id === "nomeLista") { STATO.nomeLettura = e.target.value; return; }
  if (e.target.id === "nomeMazzo") {
    const m = mazzoAperto();
    if (m) { m.nome = e.target.value; m.modificato = Date.now(); salvaMazzi();
      const h = document.querySelector(".titolo"); if (h) h.textContent = m.nome; }
  }
});

/* =====================================================================
   Avvio
   ===================================================================== */
/* Si disegna subito: i dati sono già in pagina, e se l'archivio locale è lento
   o bloccato l'utente non deve guardare uno schermo vuoto. */
render();
(async function avvia() {
  const [c, tolti, m] = await Promise.all([
    DB.get("cursore"), DB.get("cancellati"), DB.get("mazzi")]);
  let cambiato = false;
  if (typeof c === "number" && c >= 0 && c <= ULTIMA && c !== STATO.cursore) {
    STATO.cursore = c; cambiato = true;
  }
  if (Array.isArray(tolti)) CANCELLATI = tolti;
  if (Array.isArray(m)) {
    /* un mazzo con epoca mancante o fuori scala si sana, non si scarta */
    MAZZI = m.filter(x => x && x.id && x.carte && !CANCELLATI.includes(x.id))
      .map(x => Object.assign(x, {
        nome: typeof x.nome === "string" && x.nome ? x.nome : "Mazzo",
        cursore: typeof x.cursore === "number" && x.cursore >= 0 && x.cursore <= ULTIMA
          ? x.cursore : ULTIMA
      }));
    if (MAZZI.length) cambiato = true;
  }
  if (cambiato) render();
})();
</script>
</body>
</html>
