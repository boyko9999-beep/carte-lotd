
/* ================= archivio locale ================= */
const DB = (() => {
  let p;
  const apri = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open("lotd-le6", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    setTimeout(() => rej(new Error("timeout")), 5000);
  }));
  const tx = async (modo, fn) => {
    const db = await apri();
    return await new Promise((res, rej) => {
      const q = fn(db.transaction("kv", modo).objectStore("kv"));
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  };
  return {
    get: async k => { try { return await tx("readonly", s => s.get(k)); } catch (e) { return null; } },
    set: (k, v) => tx("readwrite", s => s.put(v, k))
  };
})();

let attesaEpoca, attesaMazzi;
const salvaEpoca = () => {
  clearTimeout(attesaEpoca);
  attesaEpoca = setTimeout(() => {
    /* l'epoca che viene da un mazzo non si salva: domani riapriresti l'app
       filtrato da un mazzo aperto ieri */
    if (STATO.cursorePrima === null) DB.set("cursore", STATO.cursore).catch(() => {});
  }, 400);
};
function salvaMazzi(subito) {
  clearTimeout(attesaMazzi);
  const scrivi = () => DB.set("mazzi", MAZZI).then(() => {
    if (STATO.avvisoSalvataggio) { STATO.avvisoSalvataggio = false; render(); }
  }).catch(() => {
    if (!STATO.avvisoSalvataggio) { STATO.avvisoSalvataggio = true; render(); }
  });
  if (subito) scrivi(); else attesaMazzi = setTimeout(scrivi, 300);
}
addEventListener("pagehide", () => salvaMazzi(true));
addEventListener("visibilitychange", () => { if (document.hidden) salvaMazzi(true); });

/* ================= testo ================= */
const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = n => n.toLocaleString("it-IT");
const iniziali = n => n.split(/[\s\/]+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
const img = i => `https://images.ygoprodeck.com/images/cards_small/${i}.jpg`;
const imgGrande = i => `https://images.ygoprodeck.com/images/cards/${i}.jpg`;
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/* "GX · marzo 2008" per i confini di saga, "fine 2008" per gli anni */
function descriviTacca(i) {
  const t = TACCHE[i];
  const quando = t.d.endsWith("-01-01")
    ? "fine " + t.a
    : MESI[+t.d.slice(5, 7) - 2] + " " + t.d.slice(0, 4);
  return t.fs ? SAGHE[t.s].nome + " · " + quando : quando;
}
/* i confini di saga cadono ad aprile/maggio: "fine 2008" è già dentro 5D's */
function dentroSaga(i) {
  const t = TACCHE[i];
  return t.fs ? "" : "sei già dentro " + SAGHE[t.s].nome;
}
/* nella barra sticky lo spazio è poco: si dice la saga O l'anno, non tutti e due.
   Il dettaglio completo sta nel pannello, dove c'è posto. */
function etichettaBreve(i) {
  const t = TACCHE[i];
  return t.fs ? SAGHE[t.s].nome : "fine " + t.a;
}
function etichettaEpoca() {
  if (STATO.soloNuove) {
    const s = SAGHE[sagaDelCursore()];
    return `Solo ${s.nome} — ${num(disponibili())} nuove`;
  }
  if (STATO.cursore >= ULTIMA) return `Tutto il gioco · ${num(CUM[ULTIMA])} carte`;
  return `Fino a ${etichettaBreve(STATO.cursore)} — ${num(disponibili())} di ${num(CUM[ULTIMA])}`;
}
const coloreTacca = i => SAGHE[TACCHE[i].s].colore;

function ritrattoHTML(nome, cls) {
  const u = RITRATTI[nome];
  cls = cls || "ritratto";
  return u ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy"
      onerror="this.outerHTML='&lt;div class=&quot;${cls} iniziali&quot;&gt;${esc(iniziali(nome))}&lt;/div&gt;'">`
    : `<div class="${cls} iniziali">${esc(iniziali(nome))}</div>`;
}

const ICONA = { busta: "🎴", sfida: "⚔️", campagna: "🏁" };
const ETICHETTA_LUOGO = { busta: "Busta", sfida: "Sfida", campagna: "Campagna" };
function nomeLuogo(l) {
  const L = LUOGHI[l];
  if (L.tipo === "busta") return "Busta di " + L.chi;
  const chi = L.chi + (L.livello ? ` (${L.livello})` : "");
  /* l'episodio fa parte del nome: due duelli contro lo stesso avversario in
     episodi diversi danno carte diverse e non vanno confusi */
  return L.episodio ? `${L.episodio} — ${chi}` : (L.tipo === "sfida" ? "Sfida " : "Duello ") + chi;
}
function dettaglioLuogoTesto(l) {
  const L = LUOGHI[l];
  if (L.tipo === "busta") return `serie ${SAGHE[L.saga].nome} · casuale`;
  const s = L.saga >= 0 ? `campagna ${SAGHE[L.saga].nome}` : "";
  return [s, L.tipo === "sfida" ? "sfida" : "storia", "garantita"].filter(Boolean).join(" · ");
}
const plurale = (n, uno, tanti) => n === 1 ? uno : tanti;

/* ================= mazzi: regole ================= */
const mazzoDi = id => MAZZI.find(m => m.id === id) || null;
const mazzoAperto = () => STATO.mazzo === null ? null : mazzoDi(STATO.mazzo);
const copie = (m, nome) => (m && m.carte[nome]) || 0;
function conta(m, extra) {
  let t = 0;
  for (const nome in m.carte) {
    const k = trovaCarta(nome);
    if (k === undefined) continue;
    if (eExtra(CARTE[k]) === extra) t += m.carte[nome];
  }
  return t;
}
const elencoZona = (m, extra) => Object.keys(m.carte)
  .filter(n => { const k = trovaCarta(n); return k !== undefined && eExtra(CARTE[k]) === extra; });
const fuoriEpoca = m => Object.keys(m.carte)
  .filter(n => { const k = trovaCarta(n); return k !== undefined && !dentroA(k, m.cursore); });

/* perché non posso aggiungere questa carta (null = si può) */
function perchéNo(m, k) {
  if (!m) return null;
  const c = CARTE[k];
  if (copie(m, c[N]) >= 3) return "Hai già 3 copie";
  if (eExtra(c)) { if (conta(m, true) >= 15) return "Extra pieno (15)"; }
  else if (conta(m, false) >= 60) return "Main pieno (60)";
  return null;
}
function aggiungi(m, k) {
  if (perchéNo(m, k)) return false;
  const n = CARTE[k][N];
  m.carte[n] = (m.carte[n] || 0) + 1;
  m.modificato = Date.now();
  salvaMazzi();
  return true;
}
function togli(m, nome, tutte) {
  if (!m.carte[nome]) return;
  if (tutte || m.carte[nome] <= 1) delete m.carte[nome]; else m.carte[nome]--;
  m.modificato = Date.now();
  salvaMazzi();
}
function semaforo(m) {
  const main = conta(m, false), extra = conta(m, true), fuori = fuoriEpoca(m).length;
  if (extra > 15) return ["male", `Hai ${extra - 15} carte di troppo nell'Extra`];
  if (main > 60) return ["male", `Hai ${main - 60} carte di troppo nel Main`];
  if (main < 40) return ["male", `Ti mancano ${40 - main} carte nel Main`];
  if (fuori) return ["", `Giocabile, ma ${fuori} ${fuori === 1 ? "carta è fuori" : "carte sono fuori"} dalla tua epoca`];
  return ["bene", "Pronto da giocare"];
}
const etichettaCursore = i => i >= ULTIMA ? "tutto il gioco" : descriviTacca(i);
