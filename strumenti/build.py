#!/usr/bin/env python3
"""
Costruisce l'indice precompilato incorporato in lotd-duellanti.html.

Sorgenti:
  - foglio Google "Card Master List" (quali carte sono nel gioco e dove si trovano)
  - db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes (data di uscita e tipo di ogni carta)

Il join nome->busta, la correzione degli alias e il calcolo della tacca di
disponibilita' avvengono QUI, una volta sola, non nel browser.

Uso:  python3 build.py            (riscarica le sorgenti se mancano)
"""
import csv, json, re, unicodedata, difflib, collections, gzip, os, sys
import urllib.request, urllib.parse

FOGLIO = "19tRadwIu9HH8nKa81Vk4XJSmZdwCy5k2pyACB6ma0yo"
CSV_URL = (f"https://docs.google.com/spreadsheets/d/{FOGLIO}"
           "/gviz/tq?tqx=out:csv&sheet=Card%20Master%20List")
API_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes"
CSV_FILE, API_FILE, OUT = "sheet.csv", "full.json", "indice.json"

def scarica(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 100000: return
    print(f"scarico {dest} ...", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "carte-lotd/2.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())

# ---------------------------------------------------------------- duellanti
SERIE = [
  ["Duel Monsters", ["Grandpa Muto","Mai Valentine","Bakura","Joey Wheeler","Seto Kaiba","Yugi"]],
  ["GX", ["Alexis Rhodes","Bastion Misawa","Chazz Princeton","Syrus Truesdale","Jesse Anderson","Jaden Yuki"]],
  ["5D's", ["Tetsu Trudge","Leo/Luna","Akiza Izinski","Jack Atlas","Crow","Yusei Fudo"]],
  ["ZEXAL", ["Cathy Katherine","Quinton","Kite Tenjo","Shark","Yuma Tsukumo"]],
  ["ARC-V", ["Gong Strong","Zuzu Boyle","Shay","Declan Akaba","Yuya Sakaki"]],
  ["VRAINS", ["Playmaker","Blue Angel","Soulburner","Varis","Ai"]],
]
CANON = [n for _, ns in SERIE for n in ns]
SAGA_DUELLANTE = {n: i for i, (_, ns) in enumerate(SERIE) for n in ns}

def chiave(s):
    s = re.sub(r"booster\s*pack|\bpack\b", "", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)

# Il foglio scrive "Bastion Booster Pack": senza questo alias la busta di Bastion
# finiva in "Altre provenienze" e la serie GX risultava senza carte.
ALIAS_BUSTA = {"bastion": "Bastion Misawa"}
MAPPA_BUSTA = {chiave(n): n for n in CANON} | ALIAS_BUSTA

def normalizza(s):
    s = unicodedata.normalize("NFKD", s)
    s = s.replace("–", "-").replace("—", "-").replace("−", "-").replace("’", "'")
    return re.sub(r"[^a-z0-9]", "", s.lower())

# ---------------------------------------------------------------- tacche
# Una tacca e' un limite superiore ESCLUSIVO sulla data di uscita.
# Anni e confini di saga stanno sulla STESSA linea perche' le saghe finiscono
# ad aprile/maggio e non coincidono con la fine dell'anno.
CONFINI_SAGA = ["2005-01-01", "2008-04-01", "2011-04-01", "2014-04-01", "2017-05-01", "2020-01-01"]
NOMI_SAGHE  = ["Duel Monsters", "GX", "5D's", "ZEXAL", "ARC-V", "VRAINS"]
COLORI_SAGHE = ["#c9a24a", "#d0703c", "#8e6bd0", "#3fa8b8", "#5aa86a", "#3f7fd0"]
PRIMO_ANNO, ULTIMO_ANNO = 1999, 2019

tagli = sorted({f"{y+1}-01-01" for y in range(PRIMO_ANNO, ULTIMO_ANNO + 1)} | set(CONFINI_SAGA))
TACCHE = []
for d in tagli:
    anno = int(d[:4]) - 1 if d.endswith("-01-01") else int(d[:4])
    saga = next(i for i, c in enumerate(CONFINI_SAGA) if d <= c)
    TACCHE.append({"d": d, "a": anno, "s": saga, "fs": d in CONFINI_SAGA})

SAGHE = []
for i, nome in enumerate(NOMI_SAGHE):
    idx = [j for j, t in enumerate(TACCHE) if t["s"] == i]
    SAGHE.append({"nome": nome, "prima": idx[0], "ultima": idx[-1], "colore": COLORI_SAGHE[i],
                  "confine": CONFINI_SAGA[i]})

def tacca(data):
    """indice della prima tacca che contiene questa data (limite esclusivo)"""
    for i, t in enumerate(TACCHE):
        if data < t["d"]: return i
    return len(TACCHE) - 1

# pavimento di meccanica: una Synchro non e' giocabile prima dell'era 5D's,
# qualunque cosa dica la sua data di uscita.
PAVIMENTO = {
    "synchro":          SAGHE[2]["prima"],
    "xyz":              SAGHE[3]["prima"],
    "link":             SAGHE[5]["prima"],
    "normal_pendulum":  SAGHE[4]["prima"],
    "effect_pendulum":  SAGHE[4]["prima"],
    "fusion_pendulum":  SAGHE[4]["prima"],
    "synchro_pendulum": SAGHE[4]["prima"],
    "xyz_pendulum":     SAGHE[4]["prima"],
}

# ---------------------------------------------------------------- sorgenti
scarica(CSV_URL, CSV_FILE); scarica(API_URL, API_FILE)
righe = list(csv.DictReader(open(CSV_FILE, encoding="utf-8")))
db = json.load(open(API_FILE))["data"]

per_id, per_nome = {}, {}
for c in db:
    per_nome.setdefault(normalizza(c["name"]), c)
    per_id.setdefault(str(c["id"]), c)
    for im in c.get("card_images", []): per_id.setdefault(str(im["id"]), c)
chiavi_nome = list(per_nome)

# ---------------------------------------------------------------- luoghi
# Buste e duelli nella stessa tabella: e' questa uniformita' che rende
# "dove si trova" un asse solo invece di due liste separate.
LUOGHI, indice_luogo = [], {}
def luogo(tipo, saga, chi, livello=None, episodio=None):
    k = (tipo, saga, chi, livello, episodio)
    if k not in indice_luogo:
        indice_luogo[k] = len(LUOGHI)
        LUOGHI.append({"tipo": tipo, "saga": saga, "chi": chi,
                       "livello": livello, "episodio": episodio, "taglia": 0})
    return indice_luogo[k]
for n in CANON: luogo("busta", SAGA_DUELLANTE[n], n)

ALIAS_SAGA = {"yugioh": 0, "yugi": 0, "dm": 0, "gx": 1, "5ds": 2, "zexal": 3,
              "arcv": 4, "arc v": 4, "vrains": 5}
def saga_campagna(s):
    # la saga dentro una fonte e' la saga di CAMPAGNA del gioco, non l'epoca della carta
    return ALIAS_SAGA.get(re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", "")).strip(), -1)

# ---------------------------------------------------------------- carte
frames, i_frame = [], {}
archi,  i_arch  = [], {}
def interna(lst, idx, v):
    if not v: return -1
    if v not in idx: idx[v] = len(lst); lst.append(v)
    return idx[v]

CARTE, note = [], collections.Counter()
for r in righe:
    dove = r["Link Evolution Location"].strip()
    if not dove or re.search(r"not in the game", dove, re.I): continue
    nome, cid = r["Card Name"].strip(), r["Card ID"].strip()
    c = per_id.get(cid) or per_nome.get(normalizza(nome))
    if not c:                                    # i 9 refusi del foglio
        g = difflib.get_close_matches(normalizza(nome), chiavi_nome, n=1, cutoff=0.8)
        if g: c = per_nome[g[0]]; note["refuso corretto"] += 1
    if not c:
        note["SENZA CORRISPONDENZA"] += 1; print("  ! nessuna corrispondenza:", nome); continue

    busta = MAPPA_BUSTA.get(chiave(dove))
    if not busta:
        note["BUSTA SCONOSCIUTA"] += 1; print("  ! busta sconosciuta:", dove); continue
    bu = indice_luogo[("busta", SAGA_DUELLANTE[busta], busta, None, None)]
    LUOGHI[bu]["taglia"] += 1

    # rarita': una regola sola, altrimenti il conteggio si gonfia
    rara = 1 if re.fullmatch(r"rare", r["Rare?"].strip(), re.I) else 0

    fonti = []
    for pezzo in re.split(r"\s*[,;]\s*|<BR\s*/?>|\n", r["Link Evolution Alternate Location"].strip()):
        pezzo = pezzo.strip()
        if not pezzo: continue
        seg = [x.strip() for x in pezzo.split(">")]
        t = seg[0].lower()
        if t in ("challenge", "campaign") and len(seg) >= 3:
            chi, ep, liv = ">".join(seg[2:]), None, None
            m = re.match(r"^(.*?)-([^-()]+?)\s*\((\d)\)$", chi)     # "Episodio-Avversario (2)"
            if m: ep, chi, liv = m.group(1).strip(), m.group(2).strip(), int(m.group(3))
            else:
                m2 = re.match(r"^(.*?)\s*\((\d)\)$", chi)           # "Avversario (2)"
                if m2: chi, liv = m2.group(1).strip(), int(m2.group(2))
            chi = chi.replace(">", " — ")
            fonti.append(luogo("sfida" if t == "challenge" else "campagna",
                               saga_campagna(seg[1]), chi, liv, ep))
        elif chiave(pezzo) in MAPPA_BUSTA:                          # una busta in piu'
            b2 = MAPPA_BUSTA[chiave(pezzo)]
            fonti.append(indice_luogo[("busta", SAGA_DUELLANTE[b2], b2, None, None)])
        else:
            note["fonte non riconosciuta: " + pezzo] += 1

    m = c.get("misc_info", [{}])[0]
    date = sorted(d for d in (m.get("ocg_date"), m.get("tcg_date")) if d and not d.startswith("0000"))
    cornice = c.get("frameType", "")
    t = max(tacca(date[0]), PAVIMENTO.get(cornice, 0)) if date else -1
    if not date: note["senza data"] += 1
    CARTE.append([
        nome,
        int(c["card_images"][0]["id"]) if c.get("card_images") else int(c["id"]),
        interna(frames, i_frame, cornice),
        t,
        int(date[0][:4]) if date else 0,
        rara, bu, sorted(set(fonti)),
        interna(archi, i_arch, c.get("archetype", "")),
    ])

conta_fonte = collections.Counter(i for c in CARTE for i in c[7])
for i, l in enumerate(LUOGHI):
    if l["tipo"] != "busta": l["taglia"] = conta_fonte[i]

# la rarita' non e' registrata per le buste DLC: zero rare non e' "nessuna rara"
rare_busta = collections.Counter(c[6] for c in CARTE if c[5])
for i, l in enumerate(LUOGHI):
    if l["tipo"] == "busta": l["rarNota"] = rare_busta[i] > 1

# ---------------------------------------------------------------- ritratti
# I ritratti dei 33 duellanti da yugipedia: si scaricano una volta e si
# incorporano come URL (le immagini restano remote, il <img onerror> ricade
# sulle iniziali se un giorno spariscono).
PAGINA = {"Yugi": "Yugi Muto", "Grandpa Muto": "Solomon Muto", "Shark": "Reginald Kastle",
          "Crow": "Crow Hogan", "Leo/Luna": "Leo", "Playmaker": "Yusaku Fujiki",
          "Blue Angel": "Aoi Zaizen", "Soulburner": "Takeru Homura", "Ai": "Ai",
          "Bakura": "Ryo Bakura", "Varis": "Ryoken Kogami", "Shay": "Shay Obsidian"}

def ritratti():
    if os.path.exists("ritratti.json"):
        return json.load(open("ritratti.json", encoding="utf-8"))
    print("scarico i ritratti ...", file=sys.stderr)
    out = {}
    for i in range(0, len(CANON), 20):
        gruppo = CANON[i:i + 20]
        titoli = [PAGINA.get(n, n) for n in gruppo]
        q = urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2",
            "redirects": "1", "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": "220",
            "titles": "|".join(titoli)})
        req = urllib.request.Request("https://yugipedia.com/api.php?" + q,
                                     headers={"User-Agent": "carte-lotd/2.0"})
        d = json.load(urllib.request.urlopen(req, timeout=120))
        norm = {r["from"]: r["to"] for r in d.get("query", {}).get("normalized", [])}
        redir = {r["from"]: r["to"] for r in d.get("query", {}).get("redirects", [])}
        pagine = {p["title"]: p.get("thumbnail", {}).get("source")
                  for p in d.get("query", {}).get("pages", [])}
        for n, t in zip(gruppo, titoli):
            u = pagine.get(redir.get(norm.get(t, t), norm.get(t, t)))
            if u: out[n] = u.replace("https://ms.yugipedia.com//", "https://ms.yugipedia.com/")
    json.dump(out, open("ritratti.json", "w", encoding="utf-8"), ensure_ascii=False)
    return out

RITRATTI = ritratti()
print("ritratti:", len(RITRATTI), "su", len(CANON))

# ---------------------------------------------------------------- controlli
buste = [l for l in LUOGHI if l["tipo"] == "busta"]
assert len(buste) == 33, f"buste attese 33, trovate {len(buste)}"
assert all(l["taglia"] > 0 for l in buste), "una busta e' rimasta vuota: alias mancante?"
assert not note["SENZA CORRISPONDENZA"] and not note["BUSTA SCONOSCIUTA"], dict(note)
assert len(TACCHE) == 25, f"tacche attese 25, trovate {len(TACCHE)}"

cum, tot = [], 0
isto = collections.Counter(c[3] for c in CARTE)
for i in range(len(TACCHE)): tot += isto[i]; cum.append(tot)
attesi = {5: 2020, 9: 3154, 13: 4821, 17: 6354, 21: 8300, 24: 10027}
for i, v in attesi.items():
    assert cum[i] == v, f"cumulata tacca {i}: attesa {v}, calcolata {cum[i]}"

print("carte:", len(CARTE), "· luoghi:", len(LUOGHI), "· tacche:", len(TACCHE))
print("note:", {k: v for k, v in note.items()})
print("cumulate fine saga:", {SAGHE[i]["nome"]: cum[SAGHE[i]["ultima"]] for i in range(6)})

payload = {"tacche": TACCHE, "saghe": SAGHE, "luoghi": LUOGHI,
           "frames": frames, "archetipi": archi, "carte": CARTE,
           "ritratti": RITRATTI}
raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
open(OUT, "w", encoding="utf-8").write(raw)
print(f"{OUT}: {len(raw.encode()):,} byte  ·  gzip {len(gzip.compress(raw.encode())):,} byte")
