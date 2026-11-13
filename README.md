# Corpus iuris canonici II (Friedberg), digitale Fassung

Text der Dekretalensammlungen nach Friedbergs Ausgabe von 1881, kapitelweise und mit dem Seitenbild verbunden.
Enthalten sind Liber Extra, Liber Sextus, Clementinen, Extravaganten Johannes' XXII. und Extravagantes communes.

Lesefassung: https://dekm-tud.github.io/friedberg-decretales/

## Inhalt

| Pfad | Inhalt |
|---|---|
| `daten/friedberg_bd2.jsonl` | ein Datensatz je Kapitel: Kennung, Summarium, Inskription, Text, Kursive, Spalten, Lage im Seitenbild, Korrekturen |
| `daten/friedberg_bd2.xml` | derselbe Text als TEI, mit Seiten- und Spaltenwechseln (`pb/@facs` verweist auf die IIIF-Leinwand) |
| `index.html`, `ausgabe.html`, `app.js`, `style.css`, `fonts/` | Lesefassung (statisch, ohne Server) |
| `build_data.py` | erzeugt die Webdaten in `data/` (`python3 build_data.py`), beim Veröffentlichen automatisch |
| `.github/workflows/pages.yml` | veröffentlicht die Lesefassung nach jeder Änderung auf GitHub Pages |

Kennungen folgen der üblichen Zählung (`X 3.5.12`, `VI 1.6.3`, `Clem 3.4.2`, `Extrav.Io 5.1`, `Extrav.comm 3.2.1`).
Die Lesefassung adressiert ein Kapitel mit `#X.3.5.12`.

Zum lokalen Ansehen: `python3 build_data.py && python3 -m http.server`, dann http://localhost:8000.

## Zum Text

Grundlage ist das Digitalisat des Internet Archive (BD1141952). Der Text ist maschinell gelesen (Chandra OCR 2,
olmOCR 2) und wortweise korrigiert. Im Liber Extra wurde zusätzlich mit der Transkription der Bibliotheca Augustana
abgeglichen. Friedbergs Apparat ist nicht aufgenommen. Eine Stichprobe am Seitenbild ergab 0,46 % falsch gelesene
Wörter. Berichtigte und unsichere Stellen sind in den Daten und in der Lesefassung ausgewiesen. Näheres steht auf der
Seite [Zur Ausgabe](https://dekm-tud.github.io/friedberg-decretales/ausgabe.html).

## Zitieren

X 3.5.12, in: Corpus iuris canonici, ed. Aemilius Friedberg, Bd. 2: Decretalium collectiones, Leipzig 1881, Sp. 468.
Digitale Fassung bearb. von Michael Schonhardt, https://dekm-tud.github.io/friedberg-decretales/#X.3.5.12

## Verantwortlich

Michael Schonhardt, Fachgebiet Digitale Editorik und Kulturgeschichte des Mittelalters, Technische Universität
Darmstadt. Entstanden im Projekt *Embedding the Past*, gefördert im Programm LOEWE-Exploration sowie von der
Technischen Universität Darmstadt und der Akademie der Wissenschaften und der Literatur | Mainz.

## Lizenz

Text und Daten: CC BY 4.0 (`LICENSE`). Schriften: SIL Open Font License (`fonts/`). Die Seitenbilder liegen beim
Internet Archive und sind nicht Teil des Repositoriums.
