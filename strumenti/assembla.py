#!/usr/bin/env python3
"""Assembla lotd-duellanti.html: guscio + indice precompilato + codice."""
import json, io, os
QUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(QUI, "src")
OUT = os.path.join(QUI, os.pardir, "lotd-duellanti.html")

dati = open(os.path.join(QUI, "indice.json"), encoding="utf-8").read()
# dentro un <script type="application/json"> l'unica sequenza pericolosa è </script
dati = dati.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")

codice = ["02-modello.js", "03-aiuti.js", "04-guscio.js", "05-viste.js",
          "06-mazzi.js", "07-scheda-eventi.js"]

out = io.StringIO()
out.write(open(os.path.join(SRC, "01-head.html"), encoding="utf-8").read())
out.write('<script id="indice" type="application/json">')
out.write(dati)
out.write("</script>\n")
for f in codice:
    out.write(open(os.path.join(SRC, f), encoding="utf-8").read())
html = out.getvalue()
open(OUT, "w", encoding="utf-8").write(html)
print(f"{os.path.normpath(OUT)}: {len(html.encode()):,} byte")

# la radice del sito deve esistere, altrimenti GitHub Pages mostra il README
radice = os.path.join(QUI, os.pardir, "index.html")
if not os.path.exists(radice):
    print("ATTENZIONE: manca index.html, la pagina GitHub non aprirà l'app")
