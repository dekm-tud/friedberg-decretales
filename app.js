/* Corpus iuris canonici II (Friedberg): Text nach Kapiteln neben dem Seitenbild (OpenSeadragon, IIIF des Internet Archive). */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const state = { index: null, canvases: [], titel: null, datei: null, aktiv: null, viewer: null, blatt: null, rahmenFuer: null,
                  titelListe: [], volltext: null };

  const WERK = { X: "Liber Extra", VI: "Liber Sextus", Clem: "Clementinae", "Extrav.Io": "Extravagantes Ioannis XXII",
                 "Extrav.comm": "Extravagantes communes" };
  const SIGLE = { X: "X", VI: "VI", Clem: "Clem.", "Extrav.Io": "Extrav. Io. XXII", "Extrav.comm": "Extrav. comm." };
  const ZEICHEN = { "†": "† Beginn eines von Friedberg wieder eingefügten Stücks (bei Raymund mit „et infra“ ausgelassen)",
                    "*": "* Abweichung von der Editio Romana" };
  const ROM = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  const rom = (n) => { let o = ""; for (const [v, s] of ROM) while (n >= v) { o += s; n -= v; } return o; };

  // ---------------------------------------------------------------- Kennungen
  // interne Kennung "X 3.5.12" / "Extrav.Io 5.1" / "X 1.5 pr"; Anzeige in der üblichen Zitierform
  const zitId = (id) => { const [w, ...r] = id.split(" "); return (SIGLE[w] || w) + " " + r.join(" "); };
  const hashId = (id) => id.replace(/\s+/g, ".");
  const idFromHash = (h) => {
    const m = decodeURIComponent(h).replace(/^#/, "").match(/^(X|VI|Clem|Extrav\.Io|Extrav\.comm)\.(.+)$/);
    return m ? m[1] + " " + m[2].replace(/\.pr(\d*)$/, " pr$1") : null;
  };
  function parseId(q) {
    const m = q.trim().match(/^(x|vi|clem\.?|extrav\.?\s*(?:io\.?|jo\.?)\s*(?:xxii)?|extrav\.?\s*comm\.?)?\s*(\d+(?:\.\d+){1,2})\.?$/i);
    if (!m) return null;
    const w = (m[1] || "x").toLowerCase().replace(/[\s.]|xxii/g, "").replace("jo", "io");
    const werk = { x: "X", vi: "VI", clem: "Clem", extravio: "Extrav.Io", extravcomm: "Extrav.comm" }[w];
    return werk ? werk + " " + m[2] : null;
  }

  const cache = new Map();
  const json = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url + ": " + r.status); return r.json(); }));
    return cache.get(url);
  };

  function* alleKapitel() {
    for (const w of state.index.werke) for (const l of w.libri) for (const t of l.tituli)
      for (const k of t.kapitel) yield { w, l, t, k };
  }
  const findeKapitel = (id) => { for (const e of alleKapitel()) if (e.k.id === id) return e; return null; };

  // ---------------------------------------------------------------- Gliederung
  function titelName(w, l, t) {
    if (t.titulus == null) return l.liber == null ? "Bulla promulgationis" : "Ohne Titelzählung";
    return t.rubrik || "";
  }
  function baueGliederung() {
    const out = [];
    for (const w of state.index.werke) {
      out.push(`<details class="w"${w.werk === "X" ? " open" : ""}><summary>${esc(WERK[w.werk] || w.name)}</summary>`);
      const mehr = w.libri.length > 1;
      for (const l of w.libri) {
        if (mehr) out.push(`<details class="l"><summary>${l.liber == null ? "Prooemium" : "Liber " + rom(l.liber)}</summary>`);
        for (const t of l.tituli) {
          state.titelListe.push({ w, l, t });
          out.push(`<a href="#${esc(hashId(t.kapitel[0].id))}" data-datei="${esc(t.datei)}"><span class="nr">${esc(t.rom || "")}</span><span>${esc(titelName(w, l, t))}</span></a>`);
        }
        if (mehr) out.push("</details>");
      }
      out.push("</details>");
    }
    $("#gliederung").innerHTML = out.join("");
  }

  // ---------------------------------------------------------------- Text
  function textHtml(k) {
    const words = k.text.split(" ");
    const kurs = new Set(k.kursiv);
    const neu = new Map(), uns = new Map(), ub = new Map();
    for (const c of k.korrekturen) if (c.feld === "text" && c.an != null)
      for (let i = 0; i < Math.max(c.anzahl, 1); i++) neu.set(c.an + i, c);
    for (const u of k.unsicher) if (u.feld === "text" && u.an != null) uns.set(u.an, u);
    for (const u of k.umbrueche) if (u.wort > 0) { if (!ub.has(u.wort)) ub.set(u.wort, []); ub.get(u.wort).push(u); }
    let spalte = (k.umbrueche[0] || {}).spalte ?? null, blatt = (k.umbrueche[0] || {}).blatt ?? null;
    const out = [];
    words.forEach((w, i) => {
      for (const u of ub.get(i) || []) {
        if (u.spalte !== spalte || u.blatt !== blatt) {
          out.push(`<span class="ub" data-blatt="${u.blatt}" title="Scan ${u.blatt}"><span class="ubr">${u.spalte ? "Sp. " + u.spalte : ""}</span></span>`);
          spalte = u.spalte; blatt = u.blatt;
        }
      }
      if (ZEICHEN[w]) { out.push(`<sup class="zeichen" title="${esc(ZEICHEN[w])}">${esc(w)}</sup>`); return; }
      let h = esc(w);
      if (kurs.has(i)) h = `<i>${h}</i>`;
      const c = neu.get(i), u = uns.get(i);
      if (c && c.art !== "getilgt") h = `<span class="kb" title="OCR: ${esc(c.alt || "–")}">${h}</span>`;
      else if (u) h = `<span class="ku" title="auch: ${esc(u.olmocr ?? u.archive_org ?? "–")}">${h}</span>`;
      out.push((/^[.,;:?!)\]]+$/.test(w) ? "" : " ") + h);
    });
    return out.join("").trim();
  }

  function spaltenText(k) {
    if (!k.spalten) return "";
    return k.spalten[0] === k.spalten[1] ? "Sp. " + k.spalten[0] : `Sp. ${k.spalten[0]}–${k.spalten[1]}`;
  }
  // Zitierform; Adresse der veröffentlichten Fassung aus index.json (basis), lokal die eigene Adresse
  function adresse(id) {
    const basis = state.index.basis || location.origin + location.pathname.replace(/index\.html$/, "");
    return basis + "#" + hashId(id);
  }
  function zitat(k) {
    const sp = spaltenText(k);
    const stand = state.index.stand ? new Date(state.index.stand).toLocaleDateString("de-DE") : "";
    const reg = k.typ === "regula" ? ` (De regulis iuris, reg. ${k.id.split(".").pop()})` : "";
    return `${zitId(k.id)}${reg}, in: Corpus iuris canonici, ed. Aemilius Friedberg, Bd. 2: Decretalium collectiones, Leipzig 1881` +
           (sp ? `, ${sp}` : "") + `. Digitale Fassung bearb. von Michael Schonhardt, ${adresse(k.id)}` + (stand ? ` (Stand ${stand})` : "") +
           (state.index.doi ? `, DOI ${state.index.doi}` : "");
  }

  function lesung(k) {
    const teile = [];
    if (k.uebereinstimmung != null) {
      const p = (100 * k.uebereinstimmung).toFixed(1).replace(".", ",") + " %";
      teile.push(`<span${k.uebereinstimmung < 0.95 ? ' class="tief"' : ""}>Übereinstimmung ${p}</span>`);
    } else if (!k.augustana) teile.push('<span class="tief">nur eine Lesung</span>');
    const nb = k.korrekturen.filter((c) => c.feld === "text").length, nu = k.unsicher.filter((u) => u.feld === "text").length;
    if (nb) teile.push(`<span class="kb">${nb} berichtigt</span>`);
    if (nu) teile.push(`<span class="ku">${nu} unsicher</span>`);
    return teile.join("");
  }

  function kapitelHtml(k) {
    const c = k.typ === "capitulum" || k.typ === "regula" ? (k.typ === "regula" ? "reg. " : "c. ") + (k.id.split(" ")[1] || "").split(".").pop() : "";
    const name = k.typ === "capitulum" || k.typ === "regula" ? zitId(k.id) : (/^\S+ pr$/.test(k.id) ? zitId(k.id).replace(/ pr$/, "") + ", Bulla promulgationis" : zitId(k.id).replace(/ pr\d*$/, "") + " (ohne Kapitelzählung)");
    return `<article class="kap" id="${esc(hashId(k.id))}" data-id="${esc(k.id)}">
      <div class="rand">${c ? `<a class="c" href="#${esc(hashId(k.id))}">${esc(c)}</a>` : ""}</div>
      <div class="korpus">
        <div class="kzeile"><a class="kid" href="#${esc(hashId(k.id))}">${esc(name)}</a><span>${esc(spaltenText(k))}</span>${lesung(k)}</div>
        ${k.summarium ? `<p class="summ">${esc(k.summarium)}</p>` : ""}
        ${k.inscriptio ? `<p class="inscr">${esc(k.inscriptio)}</p>` : ""}
        <p class="kt">${textHtml(k)}</p>
        <p class="zitat"><span class="zt">${esc(zitat(k))}</span><button class="kopieren" type="button">kopieren</button></p>
      </div>
    </article>`;
  }

  function titelKopf(t) {
    const i = state.titelListe.findIndex((x) => x.t.datei === state.datei);
    const e = state.titelListe[i];
    const sig = (x) => x.t.titulus == null ? `${SIGLE[x.w.werk]} ${x.l.liber != null ? x.l.liber + " " : ""}pr.`
      : `${SIGLE[x.w.werk]} ${x.l.liber != null && x.w.werk !== "Extrav.Io" ? x.l.liber + "." : ""}${x.t.titulus}`;
    const nav = (x, pfeil) => x ? `<a href="#${esc(hashId(x.t.kapitel[0].id))}">${pfeil === "‹" ? "‹ " + esc(sig(x)) : esc(sig(x)) + " ›"}</a>` : "<span></span>";
    return `<header class="tit">
      <div class="sigle">${e ? esc(sig(e)) + ", " : ""}${esc(WERK[t.werk])}</div>
      <h1>${esc(e ? titelName(e.w, e.l, e.t) : t.rubrik || "")}</h1>
      <div class="tnav">${nav(state.titelListe[i - 1], "‹")}${nav(state.titelListe[i + 1], "›")}</div>
    </header>`;
  }

  async function zeigeTitel(datei) {
    if (state.datei === datei) return state.titel;
    const t = await json("data/" + datei);
    state.titel = t; state.datei = datei;
    $("#text").innerHTML = titelKopf(t) + t.kapitel.map(kapitelHtml).join("");
    $("#text").scrollTop = 0;
    for (const a of document.querySelectorAll(".gliederung a")) a.classList.toggle("aktiv", a.dataset.datei === datei);
    const akt = $(`.gliederung a[data-datei="${CSS.escape(datei)}"]`);
    if (akt) { let d = akt.parentElement; while (d && d.tagName === "DETAILS") { d.open = true; d = d.parentElement; } akt.scrollIntoView({ block: "nearest" }); }
    return t;
  }

  async function geheZu(id, { bild = true, scroll = true } = {}) {
    const e = findeKapitel(id);
    if (!e) return false;
    const t = await zeigeTitel(e.t.datei);
    const k = t.kapitel.find((x) => x.id === e.k.id);
    aktiviere(k, { bild, scroll });
    document.title = `${zitId(k.id)}, Corpus iuris canonici II (Friedberg)`;
    return true;
  }

  function aktiviere(k, { bild = true, scroll = true } = {}) {
    state.aktiv = k;
    for (const el of document.querySelectorAll(".kap.aktiv")) el.classList.remove("aktiv");
    const el = document.getElementById(hashId(k.id));
    if (el) { el.classList.add("aktiv"); if (scroll) el.scrollIntoView({ block: "start" }); }
    if (bild) zeigeBlatt(k.bloecke.length ? k.bloecke[0].blatt : null, k);
  }

  // ---------------------------------------------------------------- Bild (OpenSeadragon, IIIF Image API)
  function startViewer() {
    if (!window.OpenSeadragon) { $("#osd").innerHTML = '<p class="hinweis" style="padding:16px;margin:0">Seitenbild nicht verfügbar.</p>'; return; }
    state.viewer = OpenSeadragon({
      element: $("#osd"), prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
      showNavigator: true, navigatorPosition: "TOP_RIGHT", showRotationControl: false, gestureSettingsMouse: { clickToZoom: false },
      crossOriginPolicy: "Anonymous", visibilityRatio: 0.5, minZoomImageRatio: 0.5,
    });
    state.viewer.addHandler("open", () => rahmen());
    $("#vor").addEventListener("click", () => blaettern(+1));
    $("#zurueck").addEventListener("click", () => blaettern(-1));
  }

  function blaettern(d) {
    const b = (state.blatt ?? 0) + d;
    if (b < 0 || b >= state.canvases.length) return;
    zeigeBlatt(b, null); folgeBlatt(b);
  }

  async function folgeBlatt(blatt) {
    let best = null;
    for (const e of alleKapitel()) if (e.k.blatt != null && e.k.blatt <= blatt) best = e; else if (e.k.blatt > blatt) break;
    if (!best) return;
    const t = await zeigeTitel(best.t.datei);
    const k = t.kapitel.find((x) => x.id === best.k.id);
    if (k) { aktiviere(k, { bild: false }); history.replaceState(null, "", "#" + hashId(k.id)); }
  }

  function spaltenAufBlatt(blatt) {
    const s = new Set();
    for (const k of (state.titel || {}).kapitel || []) for (const b of k.bloecke) if (b.blatt === blatt && b.spalte) s.add(b.spalte);
    const a = [...s].sort((x, y) => x - y);
    return a.length ? "Sp. " + (a.length > 1 ? a[0] + "–" + a[a.length - 1] : a[0]) : "";
  }

  function zeigeBlatt(blatt, k) {
    if (blatt == null) return;
    state.rahmenFuer = k;
    if (!state.viewer || !state.canvases[blatt]) { state.blatt = blatt; return; }
    const c = state.canvases[blatt];
    const sp = spaltenAufBlatt(blatt);
    $("#blattnr").textContent = (sp ? sp + ", " : "") + "Scan " + blatt;
    $("#mirador-link").href = "https://projectmirador.org/embed/?iiif-content=" + encodeURIComponent(state.index.manifest) +
                              "&canvas=" + encodeURIComponent(c.id);
    if (state.blatt === blatt && state.viewer.world.getItemCount()) { rahmen(); return; }
    state.blatt = blatt;
    state.viewer.open(c.service + "/info.json");
  }

  function rahmen() {
    const v = state.viewer, k = state.rahmenFuer, c = state.canvases[state.blatt];
    v.clearOverlays();
    if (!k || !c) return;
    const r = c.h / c.w;
    let box = null;
    for (const b of k.bloecke) {
      if (b.blatt !== state.blatt || !b.bbox) continue;
      const [x1, y1, x2, y2] = b.bbox;
      const rect = new OpenSeadragon.Rect(x1 / 1000, y1 / 1000 * r, (x2 - x1) / 1000, (y2 - y1) / 1000 * r);
      const el = document.createElement("div"); el.className = "block";
      v.addOverlay({ element: el, location: rect });
      box = box ? box.union(rect) : rect;
    }
    if (box) {
      const pad = 0.04;
      v.viewport.fitBoundsWithConstraints(new OpenSeadragon.Rect(box.x - pad, box.y - pad, box.width + 2 * pad, box.height + 2 * pad));
    } else v.viewport.goHome();
  }

  async function ladeManifest() {
    const m = await json(state.index.manifest);
    state.canvases = (m.items || []).map((c) => {
      const body = c.items?.[0]?.items?.[0]?.body || {};
      const svc = (body.service || [])[0] || {};
      return { id: c.id, w: c.width, h: c.height, service: svc.id || svc["@id"] };
    });
  }

  // ---------------------------------------------------------------- Suche
  const norm = (s) => s.toLowerCase().replace(/æ/g, "ae").replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/v/g, "u").replace(/j/g, "i")
                       .replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
  let suchNr = 0;
  function suche(q) {
    const box = $("#treffer"); const nr = ++suchNr;
    q = q.trim();
    if (q.length < 2) { box.hidden = true; return; }
    const id = parseId(q); const res = [];
    if (id) { const e = findeKapitel(id); if (e) res.push(`<a href="#${esc(hashId(e.k.id))}"><b>${esc(zitId(e.k.id))}</b>${esc(e.k.inc)} …</a>`); }
    else {
      const nq = norm(q);
      for (const e of alleKapitel()) {
        if (norm(e.k.inc).startsWith(nq)) res.push(`<a href="#${esc(hashId(e.k.id))}"><b>${esc(zitId(e.k.id))}</b>${esc(e.k.inc)} …</a>`);
        if (res.length >= 12) break;
      }
      if (nq.length >= 3) res.push(`<a href="#" data-volltext="${esc(q)}"><b>Volltext</b>${esc(q)}</a>`);
    }
    box.innerHTML = res.length ? res.join("") : '<div class="leer">kein Treffer</div>';
    box.hidden = false;
    return nr;
  }
  // Volltext: Originaltext je Kapitel; verglichen wird wortweise normalisiert (u/v, i/j, ae/æ, ohne Satzzeichen)
  async function ladeVolltext() {
    if (state.volltext) return state.volltext;
    const roh = await json("data/volltext.json");
    state.volltext = roh.map(([id, text]) => {
      const w = text.split(" "), idx = [], nw = [];
      w.forEach((x, i) => { const n = norm(x); if (n) { nw.push(n); idx.push(i); } });
      return { id, w, idx, s: " " + nw.join(" ") + " ", nw };
    });
    return state.volltext;
  }
  async function volltextSuche(q) {
    const box = $("#treffer"); box.innerHTML = '<div class="leer">…</div>'; box.hidden = false;
    const V = await ladeVolltext();
    const nq = norm(q); const res = []; let n = 0;
    for (const e of V) {
      const pos = e.s.indexOf(nq);
      if (pos < 0) continue;
      n++;
      if (res.length >= 60) continue;
      const vorher = e.s.slice(0, pos).split(" ").length - 2;              // Index des ersten Trefferworts in nw
      const a = Math.max(0, vorher), b = Math.min(e.nw.length - 1, a + nq.split(" ").length - 1);
      const i0 = e.idx[a], i1 = e.idx[b];
      const ctx = (x, y) => esc(e.w.slice(x, y).filter((t) => t !== "*" && t !== "†").join(" "));
      res.push(`<a href="#${esc(hashId(e.id))}"><b>${esc(zitId(e.id))}</b><span class="ctx">${i0 > 8 ? "… " : ""}${ctx(Math.max(0, i0 - 8), i0)} <mark>${ctx(i0, i1 + 1)}</mark> ${ctx(i1 + 1, i1 + 9)}${i1 + 9 < e.w.length ? " …" : ""}</span></a>`);
    }
    box.innerHTML = `<div class="leer">${n} Kapitel${n > 60 ? " (60 angezeigt)" : ""}</div>` + res.join("");
  }

  // ---------------------------------------------------------------- Start
  async function route() {
    const id = idFromHash(location.hash);
    if (id && !(await geheZu(id))) $("#text").insertAdjacentHTML("afterbegin", `<p class="hinweis">${esc(zitId(id))} ist nicht vorhanden.</p>`);
  }

  function schalter(knopf, an) {
    knopf.setAttribute("aria-pressed", String(an));
  }

  async function start() {
    state.index = await json("data/index.json");
    $("#manifest-link").href = state.index.manifest;
    baueGliederung();
    startViewer();
    ladeManifest().then(() => { const b = state.blatt; state.blatt = null; if (b != null) zeigeBlatt(b, state.rahmenFuer); }).catch((e) => console.warn(e));
    $("#text").addEventListener("click", async (ev) => {
      const art = ev.target.closest(".kap");
      if (!art || !state.titel) return;
      const k = state.titel.kapitel.find((x) => x.id === art.dataset.id);
      if (!k) return;
      const z = ev.target.closest(".kopieren");
      if (z) {
        try { await navigator.clipboard.writeText(zitat(k)); z.textContent = "kopiert"; }
        catch (e) { const r = document.createRange(); r.selectNodeContents(art.querySelector(".zt")); getSelection().removeAllRanges(); getSelection().addRange(r); }
        setTimeout(() => { z.textContent = "kopieren"; }, 1800);
        return;
      }
      const ub = ev.target.closest(".ub");
      if (ub) { state.aktiv = k; zeigeBlatt(+ub.dataset.blatt, k); return; }
      if (ev.target.closest("a")) return;
      if (window.getSelection().toString()) return;
      aktiviere(k, { scroll: false });
      history.replaceState(null, "", "#" + hashId(k.id));
    });
    $("#q").addEventListener("input", (ev) => suche(ev.target.value));
    $("#q").addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { $("#treffer").hidden = true; ev.target.blur(); }
      if (ev.key === "ArrowDown") { const a = $("#treffer a"); if (a) { ev.preventDefault(); a.focus(); } }
    });
    $("#treffer").addEventListener("keydown", (ev) => {
      const a = document.activeElement;
      if (ev.key === "ArrowDown" && a.nextElementSibling) { ev.preventDefault(); a.nextElementSibling.focus(); }
      if (ev.key === "ArrowUp") { ev.preventDefault(); (a.previousElementSibling && a.previousElementSibling.tagName === "A" ? a.previousElementSibling : $("#q")).focus(); }
      if (ev.key === "Escape") { $("#treffer").hidden = true; $("#q").focus(); }
    });
    $("#suche").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const first = $("#treffer a[href]");
      if (!first) return;
      if (first.dataset.volltext) volltextSuche(first.dataset.volltext);
      else { location.hash = first.getAttribute("href"); $("#treffer").hidden = true; }
    });
    $("#treffer").addEventListener("click", (ev) => {
      const a = ev.target.closest("a"); if (!a) return;
      if (a.dataset.volltext) { ev.preventDefault(); volltextSuche(a.dataset.volltext); return; }
      $("#treffer").hidden = true;
    });
    document.addEventListener("click", (ev) => { if (ev.target.isConnected && !ev.target.closest(".suche")) $("#treffer").hidden = true; });
    $("#bildschalter").addEventListener("click", (ev) => {
      const an = ev.currentTarget.getAttribute("aria-pressed") !== "true";
      schalter(ev.currentTarget, an); $(".rahmen").classList.toggle("ohne-bild", !an);
      if (an && state.aktiv) zeigeBlatt(state.aktiv.bloecke.length ? state.aktiv.bloecke[0].blatt : state.blatt, state.aktiv);
    });
    $("#gl-schalter").addEventListener("click", (ev) => {
      const an = ev.currentTarget.getAttribute("aria-expanded") !== "true";
      ev.currentTarget.setAttribute("aria-expanded", String(an)); $("#gliederung").classList.toggle("offen", an);
    });
    $("#gliederung").addEventListener("click", (ev) => {
      if (ev.target.closest("a") && window.matchMedia("(max-width: 1000px)").matches) { $("#gl-schalter").click(); }
    });
    if (window.matchMedia("(max-width: 1000px)").matches) { schalter($("#bildschalter"), false); $(".rahmen").classList.add("ohne-bild"); }
    window.addEventListener("hashchange", route);
    if (location.hash) await route(); else await geheZu("X 1.1.1", { scroll: false });
  }
  start().catch((e) => { $("#text").innerHTML = `<p class="hinweis">Daten nicht verfügbar (${esc(e.message)})</p>`; console.error(e); });
})();
