
/* =====================================================================
   I MAZZI UFFICIALI — Structure Deck e Starter Deck fino al 2019

   Nel gioco non ci sono: sono prodotti veri, usciti in negozio. Qui servono
   come ricette già fatte — si apre quella che interessa, si vede quali carte
   sono in questo gioco e da che epoca si gioca, e con un tocco diventa un
   mazzo tuo, con la lista della spesa per andarle a prendere.
   ===================================================================== */
const taccaDiData = d => {
  for (let i = 0; i < TACCHE.length; i++) if (d < TACCHE[i].d) return i;
  return ULTIMA;
};
/* la saga in cui il prodotto è uscito: serve solo a raggrupparli */
const sagaUfficiale = u => TACCHE[taccaDiData(u.d)].s;
const nomeUfficiale = u => u.it || u.n;

const soloOCG = u => !!(u.g & 1);
const eStarter = u => !!(u.g & 2);
const FILTRI_UFF = [["tutti", "Tutti"], ["structure", "Structure Deck"],
  ["starter", "Starter Deck"], ["ocg", "Usciti solo in Giappone"]];

function vistaUfficiali() {
  const corpo = () => {
    const q = STATO.qUff.trim();
    const chiavi = q ? radici(q) : [];
    const f = STATO.filtroUff || "tutti";
    const dentroRicerca = u => !chiavi.length || (() => {
      const imp = " " + [...new Set(spezza(u.n + " " + u.it + " " + u.s + " " + u.d).map(radice))].join(" ") + " ";
      return chiavi.every(r => imp.includes(" " + r));
    })();
    const dentroFiltro = u => f === "tutti" || (f === "ocg" ? soloOCG(u)
      : f === "starter" ? eStarter(u) : !eStarter(u));
    const scelti = UFFICIALI.map((u, i) => ({ u, i })).filter(x => dentroFiltro(x.u) && dentroRicerca(x.u));

    let html = `<div class="filtri">${FILTRI_UFF.map(([k, et]) =>
      `<button class="f" data-fuff="${k}" aria-pressed="${f === k}">${esc(et)}</button>`).join("")}</div>`;
    if (!scelti.length) return html + `<p class="vuoto">Nessun mazzo${q ? ` per «${esc(q)}»` : ""}.</p>`;

    let sagaPrima = -1;
    for (const { u, i } of scelti) {
      const s = sagaUfficiale(u);
      if (s !== sagaPrima) {
        sagaPrima = s;
        html += `<p class="serie"><i class="pallino" style="background:${SAGHE[s].colore}"></i>
          ${esc(SAGHE[s].nome)}</p>`;
      }
      const qui = u.c.filter(dentro).length;
      html += `<button class="duel" data-uff="${i}">
        <div class="saga-t" style="background:${SAGHE[s].colore}">${esc(u.s || (eStarter(u) ? "ST" : "SD"))}</div>
        <span style="min-width:0"><span class="nome">${esc(nomeUfficiale(u))}</span>
        <small>${esc(u.d.slice(0, 4))} · ${eStarter(u) ? "Starter" : "Structure"} Deck${
          soloOCG(u) ? " · solo Giappone" : ""} · ${num(u.c.length)} carte${
          u.f ? ` · ${num(u.f)} non ${u.f === 1 ? "c'è" : "ci sono"} in questo gioco` : ""}</small>
        ${epocaAttiva() ? `<small class="${qui === u.c.length ? "bene" : qui ? "" : "male"}">${
          qui === u.c.length ? "tutte nella tua epoca" : `${num(qui)} di ${num(u.c.length)} nella tua epoca`
        }</small>` : ""}</span></button>`;
    }
    return html + `<p class="nota">Sono i prodotti veri, non buste del gioco: qui dentro trovi
      cosa contengono e da che epoca si giocano. Ci sono anche quelli usciti solo in Giappone,
      perché le carte poi sono le stesse. Le copie non sono dichiarate dall'archivio,
      quindi la ricetta parte con un esemplare per carta.</p>`;
  };
  return {
    titolo: "Mazzi ufficiali", indietro: true,
    conta: UFFICIALI.length + " mazzi",
    testa: campoRicerca("Cerca: dragon, zombie, SDY, 2005…", STATO.qUff, "qUff"),
    corpo
  };
}

/* Un mazzo ufficiale si apre nella stessa schermata di una lista incollata:
   è la stessa cosa, solo che la lista la conosciamo già. */
function apriUfficiale(i) {
  const u = UFFICIALI[i];
  if (!u) return;
  STATO.lettura = {
    nome: nomeUfficiale(u),
    voci: u.c.map(k => ({ qta: 1, testo: CARTE[k][N], stato: "ok", k, scelte: [] })),
    saltate: 0, side: 0, mancanti: u.f, ufficiale: i
  };
  STATO.scelteLettura = {};
  STATO.nomeLettura = nomeUfficiale(u);
  entraInContesto();
  STATO.cursore = riassuntoLettura(STATO.lettura, {}).epoca;
  STATO.soloNuove = false;
  vaiA({ schermata: "letto" });
}
