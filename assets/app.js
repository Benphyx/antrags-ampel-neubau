/* Antrags-Ampel Neubau: theme toggle, copy button, search/filter on antraege.html */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
  const store = (k, v) => { try { localStorage.setItem("bv7-" + k, v); } catch (e) {} };
  const load = (k) => { try { return localStorage.getItem("bv7-" + k); } catch (e) { return null; } };

  /* Hell/Dunkel */
  const saved = load("theme");
  if (saved) document.documentElement.dataset.theme = saved;
  const tb = $("theme-btn");
  if (tb) {
    tb.hidden = false;
    tb.addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store("theme", next);
    });
  }

  /* Text kopieren (Nachfrage-Entwurf) */
  document.querySelectorAll("[data-copy]").forEach((b) => {
    b.hidden = false;
    b.addEventListener("click", () => {
      const txt = $(b.dataset.copy);
      const label = b.textContent;
      const done = () => { b.textContent = "Kopiert"; setTimeout(() => (b.textContent = label), 1800); };
      const fallback = () => {
        const s = getSelection(); const r = document.createRange();
        r.selectNodeContents(txt); s.removeAllRanges(); s.addRange(r);
        b.textContent = "Markiert – mit Strg+C kopieren";
      };
      try { navigator.clipboard.writeText(txt.textContent.trim()).then(done, fallback); } catch (e) { fallback(); }
    });
  });

  /* ---------- Finder ---------- */
  const list = $("results");
  if (!list || !window.BV7) return;
  const D = window.BV7;
  const R = D.e;
  const AMP = Object.fromEntries(D.ampel.map((a, i) => [a[0], { i, label: a[1], color: a[2] }]));
  const KEYS = ["q", "jahr", "fr", "thema", "ampel", "erg", "instr", "offen", "sort"];
  const NAMES = { jahr: "Jahr", fr: "Fraktion", thema: "Thema", ampel: "Stand", erg: "Abstimmung", instr: "Art", q: "Suche", offen: "nur offene" };
  const STEP = 50;
  let shown = STEP;
  const state = {};

  const count = (arr, key) => { const m = {}; arr.forEach((r) => { const k = key(r); m[k] = (m[k] || 0) + 1; }); return m; };
  function options(sel, entries, all) {
    sel.innerHTML = `<option value="">${all}</option>` + entries.map(([v, l]) => `<option value="${esc(v)}">${esc(l ?? v)}</option>`).join("");
  }
  const offen = (r) => (r.ampel === "grau" && r.erg === "angenommen") || r.ampel === "blau";

  const years = [...new Set(R.map((r) => r.d.slice(0, 4)))].sort().reverse();
  options($("f-jahr"), years.map((y) => [y]), "alle");
  const fr = count(R.flatMap((r) => r.fr), (f) => f);
  options($("f-fr"), Object.keys(fr).sort((a, b) => fr[b] - fr[a]).map((f) => [f, `${f} (${fr[f]})`]), "alle");
  const th = count(R, (r) => r.thema);
  options($("f-thema"), Object.keys(th).sort((a, b) => a.localeCompare(b, "de")).map((t) => [t, `${t} (${th[t]})`]), "alle");
  const am = count(R, (r) => r.ampel);
  options($("f-ampel"), D.ampel.filter((a) => am[a[0]]).map((a) => [a[0], `${a[1]} (${am[a[0]]})`]), "alle");
  const er = count(R.filter((r) => r.instr !== "Anfrage"), (r) => r.erg || "unbekannt");
  options($("f-erg"), Object.keys(er).map((e) => [e, `${e} (${er[e]})`]), "alle");
  options($("f-instr"), ["Antrag", "Resolution", "Anfrage", "Positionspapier"].filter((i) => R.some((r) => r.instr === i)).map((i) => [i]), "alle");

  function readUrl() {
    const p = new URLSearchParams(location.search);
    KEYS.forEach((k) => { state[k] = p.get(k) || ""; });
    if (!state.sort) state.sort = "neu";
    KEYS.forEach((k) => {
      const el = $("f-" + k);
      if (!el) return;
      if (el.type === "checkbox") el.checked = state[k] === "1"; else el.value = state[k];
    });
  }
  function writeUrl() {
    const p = new URLSearchParams();
    KEYS.forEach((k) => { if (state[k] && !(k === "sort" && state[k] === "neu")) p.set(k, state[k]); });
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const out = R.filter((r) =>
      (!state.jahr || r.d.startsWith(state.jahr)) &&
      (!state.fr || r.fr.includes(state.fr)) &&
      (!state.thema || r.thema === state.thema) &&
      (!state.ampel || r.ampel === state.ampel) &&
      (!state.erg || (r.instr !== "Anfrage" && (r.erg || "unbekannt") === state.erg)) &&
      (!state.instr || r.instr === state.instr) &&
      (state.offen !== "1" || offen(r)) &&
      (!q || r.s.includes(q)));
    const by = {
      neu: (a, b) => b.d.localeCompare(a.d) || a.o - b.o,
      alt: (a, b) => a.d.localeCompare(b.d) || a.o - b.o,
      ampel: (a, b) => (AMP[a.ampel].i - AMP[b.ampel].i) || b.d.localeCompare(a.d),
    };
    return out.sort(by[state.sort] || by.neu);
  }

  function item(r) {
    return `<li class="entry">
      <span class="sig sm" data-a="${esc(r.ampel)}" role="img" aria-label="${esc(AMP[r.ampel].label)}"><i></i><i></i><i></i></span>
      <div><a class="t" href="${esc(r.u)}">${esc(r.titel)}</a>
        <div class="tags">${r.fr.map((f) => `<span class="tag fr">${esc(f)}</span>`).join("")}<span class="tag">${esc(r.instr)}</span><span class="tag">${esc(r.thema)}</span></div></div>
      <div class="meta"><span class="num">${fmt(r.d)}</span><span>${esc(r.v || AMP[r.ampel].label)}</span></div>
    </li>`;
  }

  function render() {
    const rows = filtered();
    $("count").textContent = `${rows.length.toLocaleString("de-AT")} ${rows.length === 1 ? "Eintrag" : "Einträge"}`;
    list.innerHTML = rows.length ? rows.slice(0, shown).map(item).join("")
      : `<li class="empty">Nichts gefunden.</li>`;
    $("more").hidden = rows.length <= shown;
    $("more").textContent = `${Math.min(STEP, rows.length - shown)} weitere`;
    $("chips").innerHTML = KEYS.filter((k) => k !== "sort" && state[k]).map((k) =>
      `<button type="button" data-k="${k}">${esc(NAMES[k])}${k === "offen" ? "" : ": "}${esc(k === "offen" ? "" : k === "ampel" ? (AMP[state[k]] || {}).label || state[k] : state[k])}</button>`).join("");
    $("chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => set(b.dataset.k, "")));
    writeUrl();
  }
  function set(k, v) {
    state[k] = v;
    const el = $("f-" + k);
    if (el) { if (el.type === "checkbox") el.checked = v === "1"; else el.value = v; }
    shown = STEP;
    render();
  }

  readUrl();
  KEYS.forEach((k) => {
    const el = $("f-" + k);
    if (!el) return;
    el.addEventListener(el.type === "checkbox" ? "change" : "input", () => set(k, el.type === "checkbox" ? (el.checked ? "1" : "") : el.value));
  });
  $("reset").addEventListener("click", () => { KEYS.forEach((k) => { if (k !== "sort") set(k, ""); }); });
  $("more").addEventListener("click", () => { shown += STEP; render(); });
  if (matchMedia("(max-width: 900px)").matches) $("filters").open = false;
  $("finder").hidden = false;
  $("nojs").hidden = true;
  render();
})();
