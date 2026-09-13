
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
    <div class="meta">${[CORNICE[cornice(c)] ? CORNICE[cornice(c)][0] : "",
      c[AR] >= 0 ? ARCHETIPI[c[AR]] : "", c[R] ? "rara" : ""]
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
    if (!sel.value) return;
    const mm = mazzoDi(sel.value);
    if (mm && aggiungi(mm, k)) { v.remove(); apriMazzo(mm.id); }
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
  }
  const v = STATO.vista === "carte" ? vistaCarte()
    : STATO.vista === "dove" ? vistaDove()
    : STATO.vista === "mazzi" ? vistaMazzi() : vistaBuste();
  v.testa = barraTab() + (v.testa || "");
  return v;
}

function indietro() {
  switch (STATO.schermata) {
    case "luogo": return vaiA({ schermata: null, luogo: null, q: "", tipiAttivi: new Set() });
    case "nuovo": esciDalContesto(); STATO.nomeNuovo = ""; return vaiA({ schermata: null, vista: "mazzi" });
    case "scegli": return vaiA({ schermata: "mazzo", qSel: "", tipiAttivi: new Set() });
    case "spesa": case "esporta": return vaiA({ schermata: "mazzo" });
    case "mazzo": return chiudiMazzo();
  }
  vaiA({ schermata: null });
}

/* =====================================================================
   Eventi
   ===================================================================== */
document.addEventListener("click", e => {
  const el = s => e.target.closest(s);
  let t;

  if ((t = el("[data-piu]"))) {
    const k = +t.dataset.piu, m = mazzoAperto();
    if (m && aggiungi(m, k)) aggiornaControllo(k);
    return;
  }
  if ((t = el("[data-meno]"))) {
    const k = +t.dataset.meno, m = mazzoAperto();
    if (m) { togli(m, CARTE[k][N]); aggiornaControllo(k); }
    return;
  }
  if ((t = el("[data-via]"))) { const m = mazzoAperto(); togli(m, t.dataset.via, true); return render(); }
  if ((t = el("[data-c]"))) return scheda(+t.dataset.c);
  if ((t = el("[data-l]"))) return vaiA({ schermata: "luogo", luogo: +t.dataset.l, q: "", tipiAttivi: new Set() });
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
    STATO.limite = 100;
    return ridisegnaCorpo();
  }
  if ((t = el("[data-v]"))) {
    STATO.soloNuove = false; STATO.gruppo = null;
    return vaiA({ vista: t.dataset.v, schermata: null, tipiAttivi: new Set(), pannello: false });
  }

  if (!(t = el("[data-az]"))) return;
  const m = mazzoAperto();
  switch (t.dataset.az) {
    case "pannello": STATO.pannello = !STATO.pannello; return render();
    case "indietro": return indietro();
    case "tutto": return impostaCursore(ULTIMA);
    case "solo-nuove": STATO.soloNuove = !STATO.soloNuove; STATO.limite = 100; return render();
    case "altre": STATO.limite += 100; return ridisegnaCorpo();
    case "ordine": STATO.ordine = STATO.ordine === "epoca" ? "nome" : "epoca"; return ridisegnaCorpo();
    case "nascondi": STATO.nascondiFuori = !STATO.nascondiFuori; STATO.limite = 100; return ridisegnaCorpo();
    case "fuori": STATO.mostraFuori = !STATO.mostraFuori; STATO.limite = 100; return ridisegnaCorpo();
    case "crea": {
      const nome = (document.getElementById("nm") || {}).value || STATO.nomeNuovo || "";
      const nuovo = nuovoMazzo(nome.trim() || "Mazzo " + (MAZZI.length + 1), STATO.cursore);
      STATO.mazzo = nuovo.id;
      STATO.nomeNuovo = "";
      return vaiA({ schermata: "scegli", qSel: "" });
    }
    case "scegli": return vaiA({ schermata: "scegli", qSel: "", tipiAttivi: new Set() });
    case "apri-mazzo": return vaiA({ schermata: "mazzo" });
    case "spesa": return vaiA({ schermata: "spesa" });
    case "esporta": return vaiA({ schermata: "esporta" });
    case "allarga": m.cursore = ULTIMA; STATO.cursore = ULTIMA; salvaMazzi(); return render();
    case "elimina":
      if (!confirm("Eliminare «" + m.nome + "»? Non si può annullare.")) return;
      MAZZI = MAZZI.filter(x => x.id !== m.id); salvaMazzi(true);
      return chiudiMazzo();
    case "copia-mazzo": return copia(testoMazzo(m), t);
    case "copia-spesa": return copia(testoSpesa(m), t);
  }
});

let attesaRicerca;
document.addEventListener("input", e => {
  const q = e.target.closest("[data-q]");
  if (q) {
    const chiave = q.dataset.q, v = q.value;
    clearTimeout(attesaRicerca);
    attesaRicerca = setTimeout(() => { STATO[chiave] = v; STATO.limite = 100; ridisegnaCorpo(); }, 200);
    return;
  }
  if (e.target.id === "nm") { STATO.nomeNuovo = e.target.value; return; }
  if (e.target.id === "nomeMazzo") {
    const m = mazzoAperto();
    if (m) { m.nome = e.target.value; m.modificato = Date.now(); salvaMazzi();
      const h = document.querySelector(".titolo"); if (h) h.textContent = m.nome; }
  }
});

/* =====================================================================
   Avvio
   ===================================================================== */
(async function avvia() {
  const c = await DB.get("cursore");
  if (typeof c === "number" && c >= 0 && c <= ULTIMA) STATO.cursore = c;
  const m = await DB.get("mazzi");
  if (Array.isArray(m)) MAZZI = m.filter(x => x && x.id && x.carte);
  render();
})();
</script>
</body>
</html>
