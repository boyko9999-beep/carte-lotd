<script>
"use strict";
/* =====================================================================
   Carte per duellante — Legacy of the Duelist: Link Evolution

   Tutti i dati delle 10.027 carte del gioco sono incorporati nel tag
   <script id="indice"> qui sopra: l'app parte subito, senza scaricare
   niente. Solo le immagini delle carte e i ritratti arrivano dalla rete.

   L'indice è prodotto da build.py (committato accanto a questo file).
   ===================================================================== */

const INDICE = JSON.parse(document.getElementById("indice").textContent);

/* TACCHE: i 25 tagli possibili della linea del tempo. Una tacca è un limite
   superiore ESCLUSIVO sulla data di uscita. Anni e confini di saga stanno
   sulla stessa linea perché le saghe finiscono ad aprile/maggio, non a
   dicembre: "fine 2008" (3.594 carte) non è "fine GX" (3.154). */
const TACCHE = INDICE.tacche;
const SAGHE = INDICE.saghe;
const LUOGHI = INDICE.luoghi;
const FRAMES = INDICE.frames;
const ARCHETIPI = INDICE.archetipi;
const RITRATTI = INDICE.ritratti;
const ULTIMA = TACCHE.length - 1;

/* carte: [nome, idImmagine, cornice, tacca, anno, rara, busta, fonti[], archetipo] */
const N = 0, ID = 1, F = 2, T = 3, A = 4, R = 5, BU = 6, FO = 7, AR = 8;
const CARTE = INDICE.carte;

const SERIE = [
  ["Duel Monsters", ["Grandpa Muto", "Mai Valentine", "Bakura", "Joey Wheeler", "Seto Kaiba", "Yugi"]],
  ["GX", ["Alexis Rhodes", "Bastion Misawa", "Chazz Princeton", "Syrus Truesdale", "Jesse Anderson", "Jaden Yuki"]],
  ["5D's", ["Tetsu Trudge", "Leo/Luna", "Akiza Izinski", "Jack Atlas", "Crow", "Yusei Fudo"]],
  ["ZEXAL", ["Cathy Katherine", "Quinton", "Kite Tenjo", "Shark", "Yuma Tsukumo"]],
  ["ARC-V", ["Gong Strong", "Zuzu Boyle", "Shay", "Declan Akaba", "Yuya Sakaki"]],
  ["VRAINS", ["Playmaker", "Blue Angel", "Soulburner", "Varis", "Ai"]]
];

const CORNICE = {
  normal: ["Mostro normale", "#c9a86b"], effect: ["Mostro effetto", "#c47b3f"],
  ritual: ["Rituale", "#5a7fc4"], fusion: ["Fusione", "#8a5fb0"],
  synchro: ["Synchro", "#d8d4cc"], xyz: ["Xyz", "#2f2c38"],
  link: ["Link", "#2e6fa3"], spell: ["Magia", "#2e9b8f"], trap: ["Trappola", "#b8447f"],
  normal_pendulum: ["Pendulum", "#5fa87a"], effect_pendulum: ["Pendulum", "#5fa87a"],
  fusion_pendulum: ["Pendulum Fusione", "#5fa87a"], synchro_pendulum: ["Pendulum Synchro", "#5fa87a"],
  xyz_pendulum: ["Pendulum Xyz", "#5fa87a"]
};
/* Extra Deck: elenco esplicito, non una regola sul nome della cornice.
   I Rituali e i Pendulum semplici stanno nel MAIN: "se contiene pendulum
   allora Extra" sbaglierebbe su metà dei casi. */
const CORNICI_EXTRA = new Set(["fusion", "synchro", "xyz", "link",
  "fusion_pendulum", "synchro_pendulum", "xyz_pendulum"]);
const MOSTRI = new Set(["normal", "effect", "ritual", "fusion", "synchro", "xyz", "link",
  "normal_pendulum", "effect_pendulum", "fusion_pendulum", "synchro_pendulum", "xyz_pendulum"]);

/* ================= indici costruiti all'avvio ================= */
const PER_NOME = new Map();
const PER_LUOGO = LUOGHI.map(() => []);
const ISTO = new Array(TACCHE.length).fill(0);
const CUM = new Array(TACCHE.length).fill(0);
/* COPERTURA[tacca][luogo] = carte di quel luogo disponibili fino a quella tacca.
   6.375 interi calcolati una volta sola: senza, ogni tocco costerebbe
   255 scansioni da 10.027 elementi. */
const COPERTURA = TACCHE.map(() => new Array(LUOGHI.length).fill(0));
const RARE_LUOGO = new Array(LUOGHI.length).fill(0);

CARTE.forEach((c, k) => {
  PER_NOME.set(c[N].toLowerCase(), k);
  if (c[T] >= 0) ISTO[c[T]]++;
  const luoghi = new Set([c[BU], ...c[FO]]);
  for (const l of luoghi) {
    PER_LUOGO[l].push(k);
    if (c[T] >= 0) COPERTURA[c[T]][l]++;
    if (c[R]) RARE_LUOGO[l]++;
  }
});
for (let i = 0, t = 0; i < TACCHE.length; i++) { t += ISTO[i]; CUM[i] = t; }
for (let i = 1; i < TACCHE.length; i++)
  for (let l = 0; l < LUOGHI.length; l++) COPERTURA[i][l] += COPERTURA[i - 1][l];
for (const l of PER_LUOGO) l.sort((a, b) => CARTE[a][N].localeCompare(CARTE[b][N]));

/* solo le tacche "fine anno": sono quelle su cui cammina lo stepper */
const ANNI = TACCHE.map((t, i) => ({ anno: t.a, i })).filter(x => TACCHE[x.i].d.endsWith("-01-01"));
const BUSTA_DI = new Map();          // nome duellante -> indice luogo
LUOGHI.forEach((l, i) => { if (l.tipo === "busta") BUSTA_DI.set(l.chi, i); });

const TUTTE = CARTE.map((_, k) => k);
const SIGLA = { "Duel Monsters": "DM" };
const sigla = s => SIGLA[s] || s;
const cornice = c => FRAMES[c[F]] || "";
const eExtra = c => CORNICI_EXTRA.has(cornice(c));
const nomeCarta = k => CARTE[k][N];
const trovaCarta = n => PER_NOME.get(String(n).toLowerCase());

/* ================= stato ================= */
const STATO = {
  vista: "buste",           // buste · carte · dove · mazzi
  schermata: null,          // null · luogo · mazzo · nuovo · spesa · esporta
  cursore: ULTIMA,
  soloNuove: false,         // vista temporanea, non si persiste mai
  pannello: false,          // sta nello stato: con il re-render totale, nel DOM si richiuderebbe
  luogo: null,
  mazzo: null,
  cursorePrima: null,
  q: "", qDove: "", qCarte: "", qSel: "",
  tipiAttivi: new Set(),
  limite: 100,
  limiteFuori: 60,
  nascondiFuori: false,
  ordine: "nome",
  gruppo: null,
  mostraFuori: false,
  zona: null,
  ritorno: null,
  nomeNuovo: "",
  avvisoSalvataggio: false
};
let MAZZI = [];

/* ================= filtro epoca ================= */
/* un solo asse: "fino a ___". Cumulativo per costruzione. */
function dentro(k) {
  const t = CARTE[k][T];
  if (t < 0) return true;                      // data ignota: sempre visibile
  if (t > STATO.cursore) return false;
  if (!STATO.soloNuove) return true;
  return t >= SAGHE[TACCHE[STATO.cursore].s].prima;
}
const dentroA = (k, cursore) => CARTE[k][T] < 0 || CARTE[k][T] <= cursore;
const epocaAttiva = () => STATO.cursore < ULTIMA || STATO.soloNuove;
const sagaDelCursore = () => TACCHE[STATO.cursore].s;
const disponibili = () => STATO.soloNuove ? novitaSaga(sagaDelCursore()) : CUM[STATO.cursore];
function novitaSaga(s) {
  const p = SAGHE[s].prima;
  return CUM[Math.min(STATO.cursore, SAGHE[s].ultima)] - (p > 0 ? CUM[p - 1] : 0);
}
/* quante carte di questo luogo sono nell'epoca attiva */
function copertura(l) {
  if (!STATO.soloNuove) return COPERTURA[STATO.cursore][l];
  const p = SAGHE[sagaDelCursore()].prima;
  return COPERTURA[STATO.cursore][l] - (p > 0 ? COPERTURA[p - 1][l] : 0);
}
