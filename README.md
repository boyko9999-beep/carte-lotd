# carte-lotd

Guida alle carte di **Yu-Gi-Oh! Legacy of the Duelist: Link Evolution**, in italiano,
pensata per il telefono. Un solo file: `lotd-duellanti.html`. Si apre con doppio clic,
non ha bisogno di installare niente e i dati funzionano anche senza connessione
(dalla rete arrivano solo le immagini delle carte e i ritratti dei duellanti).

## Cosa fa

**Buste** — cosa c'è dentro la busta di ogni duellante: 33 buste, 10.027 carte,
quante sono rare, e da quali epoche vengono (la barra colorata in testa alla busta).

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

Per ogni carta: nome, immagine, tipo di cornice, archetipo, rarità, busta,
duelli che la regalano, e la **tacca** di disponibilità — l'indice sulla linea del
tempo a 25 tagli (i 21 anni dal 1999 al 2019 più i 5 confini di saga, che cadono
ad aprile/maggio e quindi non coincidono con la fine dell'anno: *fine 2008* sono
3.594 carte, *fine GX* ne sono 3.154).

La tacca tiene conto anche della meccanica: una Synchro non è giocabile prima
dell'era 5D's qualunque sia la sua data di stampa, una Xyz prima di ZEXAL, un
Pendulum prima di ARC-V, un Link prima di VRAINS. Per questo un mazzo di epoca
Duel Monsters può avere nell'Extra Deck solo Fusioni, senza che serva una regola
scritta apposta.

Carte per saga di uscita: DM 2.020 · GX 1.134 · 5D's 1.667 · ZEXAL 1.533 ·
ARC-V 1.946 · VRAINS 1.727 (cumulate: 2.020 · 3.154 · 4.821 · 6.354 · 8.300 · 10.027).

## Rigenerare l'indice

```sh
cd strumenti
python3 build.py       # scarica le sorgenti e produce indice.json (con i controlli)
python3 assembla.py    # ricostruisce ../lotd-duellanti.html da src/ + indice.json
```

Sorgenti: il foglio pubblico *Card Master List* (quali carte sono nel gioco e dove
si trovano) e `db.ygoprodeck.com` (data di uscita e tipo). `build.py` risolve il
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
```

103 controlli su un Chromium headless.
