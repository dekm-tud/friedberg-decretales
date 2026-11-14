#!/usr/bin/env python3
"""Webdaten aus daten/friedberg_bd2.jsonl erzeugen (nur Standardbibliothek).

  python3 build_data.py --in daten/friedberg_bd2.jsonl --out data

data/index.json        Gliederung (Sammlung, Buch, Titel, Kapitel), Kennzahlen je Sammlung, Adresse für Zitierlinks,
                       DOI aus CITATION.cff (Zeile „doi:“), sobald sie dort steht
data/t/<titel>.json    Kapitel eines Titels mit Text, Kursive, Spaltenwechseln, Textblöcken im Seitenbild, Korrekturen
data/volltext.json     Kennung und Text aller Kapitel für die Volltextsuche
"""
import argparse, collections, datetime, json, os, re

BASIS = "https://dekm-tud.github.io/friedberg-decretales/"
MANIFEST = "https://iiif.archive.org/iiif/3/BD1141952/manifest.json"
WERKE = {"X": "Liber Extra", "VI": "Liber Sextus", "Clem": "Clementinae",
         "Extrav.Io": "Extravagantes Ioannis XXII", "Extrav.comm": "Extravagantes communes"}
ROM = [(50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def rom(n):
    out = ""
    for v, s in ROM:
        while n >= v:
            out += s; n -= v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="daten/friedberg_bd2.jsonl"); ap.add_argument("--out", default="data")
    ap.add_argument("--stand", help="Datum der Datenfassung (JJJJ-MM-TT), sonst heute")
    a = ap.parse_args()
    recs = [json.loads(l) for l in open(a.src, encoding="utf-8")]
    for r in recs:                                       # Adressen ohne „#“
        r["id"] = r["id"].replace(" pr#", " pr")
    os.makedirs(os.path.join(a.out, "t"), exist_ok=True)
    groups = collections.OrderedDict()
    for r in recs:
        groups.setdefault((r["werk"], r["liber"], r["titulus"]), []).append(r)
    index, werk_i, volltext, dateien = [], {}, [], set()
    for (w, l, t), rs in groups.items():
        fn = "%s_%s_%s.json" % (w, l if l is not None else 0, t if t is not None else 0); dateien.add(fn)
        chs = []
        for r in rs:
            sp = [u["spalte"] for u in r["umbrueche"] if u.get("spalte")]
            chs.append(dict(
                id=r["id"], typ=r["typ"], summarium=r["summarium"], inscriptio=r["inscriptio"], text=r["text"],
                kursiv=r["kursiv"], umbrueche=r["umbrueche"], spalten=[min(sp), max(sp)] if sp else None,
                bloecke=r["teile"], augustana=r["augustana"], uebereinstimmung=r["uebereinstimmung"],
                korrekturen=[dict(k, anzahl=len(k["neu"])) for k in r["korrekturen"]], unsicher=r["unsicher"]))
            volltext.append([r["id"], r["text"]])
        json.dump(dict(werk=w, liber=l, titulus=t, rubrik=rs[0]["rubrik"], kapitel=chs),
                  open(os.path.join(a.out, "t", fn), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        if w not in werk_i:
            werk_i[w] = dict(werk=w, name=WERKE.get(w, w), libri=[]); index.append(werk_i[w])
        libri = werk_i[w]["libri"]
        if not libri or libri[-1]["liber"] != l:
            libri.append(dict(liber=l, tituli=[]))
        libri[-1]["tituli"].append(dict(
            titulus=t, rom=rom(t) if t else "", rubrik=rs[0]["rubrik"], datei="t/" + fn,
            kapitel=[dict(id=r["id"], inc=" ".join(r["text"].split()[:4]), blatt=(r["blatt"] or [None])[0],
                          **({} if r["typ"] in ("capitulum", "regula") else {"ohne": 1})) for r in rs]))
    for f in os.listdir(os.path.join(a.out, "t")):       # Titeldateien früherer Läufe entfernen
        if f.endswith(".json") and f not in dateien:
            os.remove(os.path.join(a.out, "t", f))
    stat = collections.OrderedDict()
    for r in recs:
        if r["typ"] not in ("capitulum", "regula"):
            continue
        st = stat.setdefault(r["werk"], dict(kapitel=0, woerter=0, u=[], berichtigt=0, unsicher=0))
        st["kapitel"] += r["typ"] == "capitulum"; st["woerter"] += len(r["text"].split())
        if r["uebereinstimmung"] is not None:
            st["u"].append(r["uebereinstimmung"])
        st["berichtigt"] += sum(len(k["neu"]) or 1 for k in r["korrekturen"] if k["feld"] == "text")
        st["unsicher"] += sum(1 for x in r["unsicher"] if x["feld"] == "text")
    for st in stat.values():
        u = st.pop("u")
        st["uebereinstimmung"] = round(sum(u) / len(u), 4) if u else None
        st["ab95"] = round(sum(x >= 0.95 for x in u) / len(u), 4) if u else None
    json.dump(volltext, open(os.path.join(a.out, "volltext.json"), "w", encoding="utf-8"), ensure_ascii=False,
              separators=(",", ":"))
    doi = None                                           # DOI der Zenodo-Veröffentlichung, einmal in CITATION.cff eingetragen
    cff = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CITATION.cff")
    if os.path.exists(cff):
        m = re.search(r'^doi:\s*"?(10\.[^"\s]+)', open(cff, encoding="utf-8").read(), re.M)
        doi = m.group(1) if m else None
    json.dump(dict(item="BD1141952", manifest=MANIFEST, basis=BASIS, stand=a.stand or datetime.date.today().isoformat(), doi=doi,
                   statistik=stat, werke=index),
              open(os.path.join(a.out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("webdaten: %d Titel, %d Datensätze" % (len(groups), len(recs)))


if __name__ == "__main__":
    main()
