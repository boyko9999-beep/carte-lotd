# carte-lotd

Guida alle carte di **Yu-Gi-Oh! Legacy of the Duelist: Link Evolution**, in italiano,
pensata per il telefono. Un solo file: `lotd-duellanti.html`. Si apre con doppio clic,
non ha bisogno di installare niente e i dati funzionano anche senza connessione
(dalla rete arrivano solo le immagini delle carte e i ritratti dei duellanti).

Online: **https://boyko9999-beep.github.io/carte-lotd/**

## Cosa fa

**Buste** — cosa c'è dentro la busta di ogni duellante: 33 buste, 10.026 carte,
quante sono rare, e da quali epoche vengono (la barra colorata in testa alla busta).

**Ricerca per tema, in italiano** — le carte hanno anche il loro nome italiano
ufficiale, quindi si cerca come si parla: *drago bianco occhi blu*, *zombie*,
*eroi elementari*. Le parole sono ridotte alla radice, così «eroi elementari»
trova gli «EROE Elementale» e «zombie» trova tutta la razza Zombie, non solo chi
ha Zombie nel nome. Singolare e plurale danno lo stesso risultato — anche quelli
duri, *drago*/*draghi*, *antico*/*antichi* — e articoli e preposizioni non
contano: «il drago bianco» trova quello che trova «drago bianco».

Sotto le carte trovate compare un secondo elenco, **«che ci vanno insieme»**:
stesso archetipo, carte nominate nel testo di quelle trovate, e carte che le
nominano. È così che cercando gli Eroi Elementali salta fuori anche
*Polimerizzazione*, che nel loro testo è nominata diciassette volte.

**Filtro per epoca** — una sola linea del tempo, sempre **cumulativa**:

- tocchi *GX* e vedi le carte di GX **insieme a quelle di Duel Monsters**;
- tocchi *2005* e vedi le uscite del 2005 **più tutte quelle di prima**; il 2006
  comprende anche il 2005, e così via fino al 2019.

Il filtro resta acceso in tutta l'app. Ogni busta e ogni duello mostrano sempre due
numeri — `156 di 314` — così vedi subito quanto ti rende quel posto nell'epoca che
stai giocando. Niente sparisce mai dall'elenco: le buste a zero restano, spente.

**Dove** — i 159 duelli (sfide e duelli di storia) che regalano carte garantite,
raggruppati per campagna del gioco. Le carte dei duelli si vincono una volta sola,
le buste si ricomprano: per questo i duelli vengono prima.

**Mazzi (ricette)** — un mazzo nasce dentro un'epoca. Aprendolo, tutta l'app si
allinea a quell'epoca e puoi pescare solo dalle carte che esistevano allora.
Main ed Extra Deck sono dedotti dal tipo di carta, il limite di 3 copie e le
dimensioni 40–60 / max 15 sono controllati mentre costruisci. Una carta fuori epoca
si può aggiungere lo stesso: l'app conta, non vieta, e te la segnala.
**Dove trovarle** trasforma il mazzo in una lista della spesa: quali duelli vincere
e quali buste comprare, dalla più ricca.

I mazzi restano nel browser (IndexedDB). Il pulsante *Esporta* li copia come testo:
è l'unico modo di metterli al sicuro.

## Come sono fatti i dati

L'indice delle carte è **precompilato** e incorporato nell'HTML come
`<script type="application/json">`: l'app parte subito, senza le centinaia di
richieste di rete che servivano prima.

Per ogni carta: nome inglese e italiano, immagine, tipo di cornice, razza,
attributo, archetipo, rarità, busta, duelli che la regalano, le carte nominate
nel suo testo, e la **tacca** di disponibilità — l'indice sulla linea del
tempo a 25 tagli (i 21 anni dal 1999 al 2019 più i 5 confini di saga, che cadono
ad aprile/maggio e quindi non coincidono con la fine dell'anno: *fine 2008* sono
3.594 carte, *fine GX* ne sono 3.154).

La tacca tiene conto anche della meccanica: una Synchro non è giocabile prima
dell'era 5D's qualunque sia la sua data di stampa, una Xyz prima di ZEXAL, un
Pendulum prima di ARC-V, un Link prima di VRAINS. Per questo un mazzo di epoca
Duel Monsters può avere nell'Extra Deck solo Fusioni, senza che serva una regola
scritta apposta.

Carte per saga di uscita: DM 2.020 · GX 1.134 · 5D's 1.667 · ZEXAL 1.533 ·
ARC-V 1.946 · VRAINS 1.726 (cumulate: 2.020 · 3.154 · 4.821 · 6.354 · 8.300 · 10.026).

## Il sito

GitHub Pages pubblica il branch `main` così com'è. Due file servono solo a questo:

- `index.html` — la radice del sito rimanda a `lotd-duellanti.html`. Senza, GitHub
  mostrerebbe il README al posto dell'app. Funziona anche a JavaScript spento
  (`meta refresh`) e non aggiunge una tappa alla cronologia del browser.
- `.nojekyll` — spegne Jekyll, che altrimenti rigenererebbe la pagina dal README.

Il foglio dei font di Google si carica senza bloccare il disegno della pagina: era
rimasto l'unico pezzo capace di far aspettare un'app che per il resto è istantanea.
Con i font irraggiungibili l'app compare comunque in ~150 ms, con i caratteri di
sistema, e i font veri subentrano appena arrivano.

L'app pubblicata è quella del branch `main`: finché una modifica non arriva lì, il
sito continua a mostrare la versione precedente.

## Rigenerare l'indice

```sh
cd strumenti
python3 build.py       # scarica le sorgenti e produce indice.json (con i controlli)
python3 assembla.py    # ricostruisce ../lotd-duellanti.html da src/ + indice.json
```

Sorgenti: il foglio pubblico *Card Master List* (quali carte sono nel gioco e dove
si trovano), `db.ygoprodeck.com` (data di uscita e tipo) e lo stesso archivio in
italiano (`?language=it`, 9.894 carte su 10.026: le 132 mancanti non sono mai
uscite in italiano e si cercano col nome inglese). Nei testi italiani i nomi di
carta stanno fra virgolette, quindi i riferimenti fra carte si estraggono in modo
esatto, non indovinato. `build.py` risolve il
join per codice carta, corregge i nove refusi del foglio e si ferma con un errore
se le buste non sono esattamente 33 o se una resta vuota — così un alias mancante
non produce mai in silenzio una busta fantasma.

`src/` contiene l'app divisa in pezzi leggibili; `lotd-duellanti.html` è il
risultato assemblato ed è il file da aprire.

## Prove

```sh
node strumenti/prova.mjs    # filtro epoca: saghe e anni cumulativi
node strumenti/prova2.mjs   # buste, ricerca, duelli, scheda carta
node strumenti/prova3.mjs   # costruttore di mazzi, lista della spesa, persistenza
node strumenti/prova4.mjs   # scroll, epoca dei mazzi, cancellazioni, carte fuori epoca
node strumenti/prova5.mjs   # reattività: avvio, griglia che cresce, ricerca, limiti
node strumenti/prova6.mjs   # nomi ostili: virgolette, barre, HTML nei nomi dei mazzi
node strumenti/prova8-ricerca.mjs  # ricerca per tema e riempimento della griglia
node strumenti/prova9-revisione.mjs # i difetti trovati dalla revisione: plurali,
                                    # articoli, salti fra le sezioni, stato vuoto
```

231 controlli su un Chromium headless. La prova 5 misura anche i tempi: avvio
sotto i 200 ms, ricerca su 10.026 carte sotto il mezzo secondo, e il pulsante
«Mostra altre carte» che non rallenta man mano che la griglia cresce.
