(() => {
  "use strict";
  const D = window.DEMO;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
  const pct = (n, d = 1) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(d) + "%";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mlabel = d => MONTHS[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
  const dlabel = d => +d.slice(8, 10) + " " + mlabel(d);

  const S = { series: {}, order: [], sel: "plastics-eu", supplier: "laminex", pack: "toothpaste", assign: {}, mail: "kestrel-price",
    wireFilter: "All", radarFilter: "All", touring: -1, approved: false };

  /* ---------- data ---------- */
  function valueAt(id, ym) { // value for month "YYYY-MM" (first point in that month)
    const s = S.series[id]; if (!s || !s.data) return null;
    const p = s.data.find(p => p[0].startsWith(ym)); return p ? p[1] : null;
  }
  const lastOf = id => S.series[id].data[S.series[id].data.length - 1];
  const changeSince = (id, ym) => { const a = valueAt(id, ym), b = lastOf(id)[1]; return a ? (b / a - 1) * 100 : null; };
  const BASE = D.baseMonth.slice(0, 7);

  function yoy(s) {
    const [d, v] = s.data[s.data.length - 1];
    const target = (+d.slice(0, 4) - 1) + d.slice(4, 7);
    const p = s.data.find(p => p[0].startsWith(target)) || null;
    return p ? (v / p[1] - 1) * 100 : null;
  }

  async function load() {
    let mk;
    try { mk = await (await fetch("data/markets.json", { cache: "no-cache" })).json(); }
    catch (e) { $("#tiles").innerHTML = '<p class="muted">The market data did not load. Open this page from a web server, not a file.</p>'; return; }
    mk.series.forEach(s => { S.series[s.id] = s; });
    D.illustrative.forEach(il => {
      const src = S.series[il.from], last = src.data[src.data.length - 1][1];
      S.series[il.id] = { id: il.id, name: il.name, unit: il.unit, group: il.group, freq: src.freq, real: false,
        src: "Illustrative grade price. Shape follows " + src.name + " (real); a client deployment uses the licensed grade feed.",
        data: src.data.map(([d, v]) => [d, Math.round(il.level * v / last * 100) / 100]) };
    });
    const f = D.freight;
    S.series.wci = { id: "wci", name: f.name, unit: f.unit, group: f.group, real: true, snapshot: true, src: f.src, url: f.url, data: [f.last] };
    S.order = D.tilesOrder.filter(id => S.series[id]);
    $("#built").textContent = "Indices fetched " + mk.built.replace("T", " ").replace("Z", " UTC") + ". Company and most events are demo.";
    computeWire();
    renderTiles(); renderChart();
    renderWireFilters(); renderWire();
    renderSuppliers(); renderPacks(); renderMailList(); renderMail();
    renderRivals(); renderRadarFilters(); renderRadar();
    $("#wire-dot").hidden = false; $("#inbox-dot").hidden = false;
  }

  function computeWire() {
    const g = changeSince("gas-eu", BASE), r = changeSince("plastics-eu", BASE);
    const gl = lastOf("gas-eu"), rl = lastOf("plastics-eu");
    D.wire.forEach(w => {
      if (w.computed === "gas") {
        w.title = "EU gas price " + (g >= 0 ? "up " : "down ") + Math.abs(g).toFixed(0) + "% since May";
        w.body = "EU natural gas averaged $" + gl[1].toFixed(2) + " per MMBtu in " + mlabel(gl[0]) + ", against $" + valueAt("gas-eu", BASE).toFixed(2) + " in May. Energy blocks in every pack re-price on it.";
        w.real = true; w.src = ["IMF via FRED, PNGASEUUSDM", S.series["gas-eu"].url];
      }
      if (w.computed === "resin") {
        w.title = "EU primary plastics " + (r < 0 ? Math.abs(r).toFixed(1) + "% below" : r.toFixed(1) + "% above") + " its May level";
        w.body = "The producer price index stood at " + rl[1] + " in " + mlabel(rl[0]) + " against " + valueAt("plastics-eu", BASE) + " in May. A polymer increase claimed since May needs to show why.";
        w.real = true; w.src = ["Eurostat sts_inppd_m, C20.16", S.series["plastics-eu"].url];
      }
    });
  }

  /* ---------- screens ---------- */
  const SCREENS = ["markets", "wire", "suppliers", "cost", "inbox", "rivals", "radar"];
  function show(name) {
    SCREENS.forEach(n => { $("#s-" + n).hidden = n !== name; });
    $$(".rail button").forEach(b => b.toggleAttribute("aria-current", b.dataset.screen === name));
    if (name === "wire") $("#wire-dot").hidden = true;
    if (name === "inbox") $("#inbox-dot").hidden = true;
    if (S.touring < 0) $("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
  $$(".rail button").forEach(b => b.addEventListener("click", () => show(b.dataset.screen)));
  document.addEventListener("keydown", e => {
    const m = /^F([1-7])$/.exec(e.key);
    if (m && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); show(SCREENS[+m[1] - 1]); }
    if (S.touring >= 0 && e.key === "Escape") endTour();
  });

  /* ---------- markets ---------- */
  function spark(data) {
    const pts = data.slice(-36), vs = pts.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), w = 180, h = 34;
    const xy = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - 3 - ((p[1] - lo) / (hi - lo || 1)) * (h - 6)]);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" points="${xy.map(p => p.map(n => n.toFixed(1)).join(",")).join(" ")}"/></svg>`;
  }
  const fmtVal = (s, v) => s.unit.startsWith("INR per") && v > 1000 ? Math.round(v).toLocaleString("en-IN") : s.unit.startsWith("USD per 40") || v >= 1000 ? Math.round(v).toLocaleString("en-US") : (+v).toFixed(v < 30 ? 2 : 1);

  function renderTiles() {
    let html = "";
    S.order.forEach(id => {
      const s = S.series[id];
      const last = s.data[s.data.length - 1];
      const chg = s.snapshot ? D.freight.wow : yoy(s);
      const chgTxt = chg == null ? "" : `<span class="mono small ${chg > 0 ? "up" : "down"}">${pct(chg)} ${s.snapshot ? "w/w" : "y/y"}</span>`;
      html += `<button class="tile" type="button" data-id="${id}" aria-pressed="${id === S.sel}">
        <span class="row"><span class="grp">${esc(s.group)}</span>${s.real ? '<span class="tag tag--real">Real</span>' : '<span class="tag">Illustrative</span>'}</span>
        <span class="nm">${esc(s.name)}</span>
        <span class="row"><span class="fig">${fmtVal(s, last[1])}</span>${chgTxt}</span>
        <span class="small muted">${esc(s.unit)} · ${s.snapshot ? dlabel(last[0]) : (s.freq || "").startsWith("weekly") ? dlabel(last[0]) : mlabel(last[0])}</span>
        ${s.snapshot ? '<span class="small muted">Weekly snapshot</span>' : `<span class="${(chg || 0) > 0 ? "up" : "down"}">${spark(s.data)}</span>`}
      </button>`;
    });
    $("#tiles").innerHTML = html;
    $$("#tiles .tile").forEach(t => t.addEventListener("click", () => selectSeries(t.dataset.id)));
  }
  function selectSeries(id) {
    S.sel = id; $$("#tiles .tile").forEach(t => t.setAttribute("aria-pressed", t.dataset.id === id)); renderChart();
  }

  function renderChart() {
    const s = S.series[S.sel], svg = $("#chart");
    $("#ch-group").textContent = s.group + (s.real ? " · Real" : " · Illustrative");
    $("#ch-title").textContent = s.name;
    $("#ch-src").innerHTML = (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a>` : esc(s.src)) + " · " + esc(s.unit);
    const last = s.data[s.data.length - 1];
    $("#ch-last").textContent = fmtVal(s, last[1]);
    if (s.snapshot) {
      $("#ch-chg").textContent = pct(D.freight.wow) + " on the week · " + dlabel(last[0]);
      const lanes = D.freight.lanes, max = Math.max(...lanes.map(l => l[1]));
      svg.innerHTML = lanes.map((l, i) => {
        const y = 40 + i * 64, w = (l[1] / max) * 560;
        return `<text x="0" y="${y + 20}">${esc(l[0])}</text><rect x="210" y="${y}" width="${w.toFixed(0)}" height="30" fill="#F2EEE6" opacity="${i ? .55 : .9}"/><text x="${(220 + w).toFixed(0)}" y="${y + 20}">$${l[1].toLocaleString("en-US")} · ${l[2]}</text>`;
      }).join("") + `<text x="0" y="250">${esc(D.freight.note)}</text>`;
      return;
    }
    const y1 = yoy(s), sm = changeSince(S.sel, BASE);
    $("#ch-chg").textContent = [y1 != null ? pct(y1) + " y/y" : "", sm != null ? pct(sm) + " since May" : "", (s.freq || "").startsWith("weekly") ? dlabel(last[0]) : mlabel(last[0])].filter(Boolean).join(" · ");
    const W = 900, H = 260, L = 46, R = 14, T = 14, B = 26, data = s.data;
    const vs = data.map(p => p[1]); let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
    const t0 = Date.parse(data[0][0]), t1 = Date.parse(last[0]);
    const X = d => L + (Date.parse(d) - t0) / (t1 - t0) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = "";
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(242,238,230,.08)"/><text x="${L - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmtVal(s, v)}</text>`; }
    ["2024-01-01", "2025-01-01", "2026-01-01"].forEach(d => { if (Date.parse(d) >= t0) g += `<text x="${X(d).toFixed(1)}" y="${H - 6}" text-anchor="middle">${d.slice(0, 4)}</text>`; });
    const bx = X(D.baseMonth);
    g += `<line x1="${bx.toFixed(1)}" x2="${bx.toFixed(1)}" y1="${T}" y2="${H - B}" stroke="#FF4F1F" stroke-dasharray="3 4" opacity=".7"/><text x="${(bx + 5).toFixed(1)}" y="${T + 10}" fill="#FF4F1F" style="fill:#FF4F1F">May price</text>`;
    const path = data.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("");
    const area = path + `L${X(last[0]).toFixed(1)},${H - B}L${L},${H - B}Z`;
    g += `<path d="${area}" fill="rgba(242,238,230,.06)"/><path d="${path}" fill="none" stroke="${s.real ? "#F2EEE6" : "#A7A298"}" stroke-width="1.8" ${s.real ? "" : 'stroke-dasharray="5 4"'}/>`;
    g += `<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4" fill="#FF4F1F"/>`;
    svg.innerHTML = g;
    svg.setAttribute("aria-label", `${s.name}: ${fmtVal(s, last[1])} ${s.unit}, ${$("#ch-chg").textContent}`);
  }

  /* ---------- wire ---------- */
  const KINDS = ["All", "Plants", "Shipping", "Weather", "Markets", "Policy", "Competitors"];
  function renderWireFilters() {
    $("#wire-filters").innerHTML = KINDS.map(k => `<button type="button" aria-pressed="${k === S.wireFilter}">${k}</button>`).join("");
    $$("#wire-filters button").forEach(b => b.addEventListener("click", () => { S.wireFilter = b.textContent; renderWireFilters(); renderWire(); }));
  }
  function renderWire(flash) {
    const items = D.wire.filter(w => S.wireFilter === "All" || w.kind === S.wireFilter);
    $("#wire").innerHTML = items.map(w => `<li id="w-${w.id}" class="sev-${w.sev}${w.id === flash ? " new" : ""}">
      <span class="when">${esc(w.when)}<br>${esc(w.kind)}</span>
      <div><h3>${esc(w.title)}</h3><p class="small">${esc(w.body)}</p>
        ${w.src ? `<p class="small muted">Source: <a href="${esc(w.src[1])}" target="_blank" rel="noopener">${esc(w.src[0])}</a></p>` : ""}
        ${w.links.length ? `<div class="chips">${w.links.map(l => `<button class="chip" type="button" data-t="${l[0]}" data-v="${l[1]}">${esc(l[2])}</button>`).join("")}</div>` : ""}</div>
      <span>${w.real ? '<span class="tag tag--real">Real</span>' : '<span class="tag">Demo event</span>'}</span></li>`).join("") || '<li class="muted">Nothing under this filter.</li>';
    $$("#wire .chip").forEach(c => c.addEventListener("click", () => follow(c.dataset.t, c.dataset.v)));
  }
  function follow(t, v) {
    if (t === "supplier") { S.supplier = v; renderSuppliers(); show("suppliers"); }
    if (t === "pack") { S.pack = v; renderPacks(); show("cost"); }
    if (t === "series") { selectSeries(v); show("markets"); }
    if (t === "screen") show(v);
  }

  /* ---------- suppliers ---------- */
  const packById = id => D.packs.find(p => p.id === id), supById = id => D.suppliers.find(s => s.id === id);
  function renderSuppliers() {
    $("#sup-table tbody").innerHTML = D.suppliers.map(s => `<tr data-id="${s.id}" aria-selected="${s.id === S.supplier}" tabindex="0">
      <td>${esc(s.name)}</td><td class="small">${esc(s.makes)}</td><td class="r">${s.share}%</td><td>${esc(s.plant)}</td><td><span class="status ${s.status[0]}">${esc(s.status[1])}</span></td></tr>`).join("");
    rowsClick("#sup-table", id => { S.supplier = id; renderSuppliers(); });
    const s = supById(S.supplier);
    $("#sup-detail").innerHTML = `<p class="lbl">${esc(s.plant)} · ${s.share}% of packaging spend</p><h2>${esc(s.name)}</h2><p class="small">${esc(s.detail)}</p>
      <p class="lbl" style="margin-top:14px">Exposure by pack</p>
      <table class="tbl"><thead><tr><th>Pack</th><th class="r">Volume from ${esc(s.name.split(" ")[0])}</th><th class="r">Cover</th></tr></thead><tbody>
      ${s.exposure.map(([pid, sh, wk]) => `<tr data-id="${pid}"><td>${esc(packById(pid).name)}<div class="bar${s.status[0] === "bad" ? " ember" : ""}"><i style="width:${sh}%"></i></div></td><td class="r">${sh}%</td><td class="r">${wk} wk</td></tr>`).join("")}
      </tbody></table>
      ${s.status[0] === "bad" ? `<p class="note">Alternative qualified source: Kestrel Packaging, Daman, with spare tube capacity. <button class="chip" type="button" id="go-move">Re-price on Kestrel</button></p>` : ""}`;
    $$("#sup-detail tbody tr").forEach(r => r.addEventListener("click", () => { S.pack = r.dataset.id; renderPacks(); show("cost"); }));
    const gm = $("#go-move"); if (gm) gm.addEventListener("click", () => { S.pack = "toothpaste"; renderPacks(); show("cost"); });
  }
  function rowsClick(sel, fn) {
    $$(sel + " tbody tr").forEach(r => {
      r.addEventListener("click", () => fn(r.dataset.id));
      r.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(r.dataset.id); } });
    });
  }

  /* ---------- should-cost ---------- */
  const BLOCKS = [["material", "Material", "#F2EEE6"], ["conversion", "Conversion", "#A7A298"], ["energy", "Energy", "#FF4F1F"], ["freight", "Freight", "#6E8FA8"], ["overhead", "Overhead", "#5C5A55"], ["margin", "Margin", "#3A3D44"]];
  function priced(p, supplier) {
    const sup = supplier || S.assign[p.id] || p.supplier, alt = sup !== p.supplier && p.alt && p.alt[sup];
    const b = Object.assign({}, p.blocks, alt ? { conversion: alt.conversion, freight: alt.freight } : {});
    const mr = lastOf(p.mat)[1] / valueAt(p.mat, BASE), er = lastOf("gas-eu")[1] / valueAt("gas-eu", BASE);
    const now = Object.assign({}, b, { material: b.material * mr, energy: b.energy * er });
    const total = Object.values(now).reduce((a, c) => a + c, 0);
    const paid = alt ? alt.paid : p.paid;
    return { sup, paid, now, total, gap: (paid / total - 1) * 100, mr, er };
  }
  function renderPacks() {
    $("#sku-table tbody").innerHTML = D.packs.map(p => {
      const q = priced(p), moved = S.assign[p.id] && S.assign[p.id] !== p.supplier;
      return `<tr data-id="${p.id}" aria-selected="${p.id === S.pack}" tabindex="0"><td>${esc(p.name)}</td><td class="small">${esc(supById(q.sup).name)}${moved ? ' <span class="tag tag--warn">Moved</span>' : ""}</td>
        <td class="r">${inr(q.paid)}</td><td class="r">${inr(q.total)}</td><td class="r ${q.gap > 2 ? "up" : "down"}">${pct(q.gap)}</td></tr>`;
    }).join("");
    rowsClick("#sku-table", id => { S.pack = id; renderPacks(); });
    const p = packById(S.pack), q = priced(p);
    const opts = [p.supplier].concat(Object.keys(p.alt || {}));
    $("#sku-detail").innerHTML = `<p class="lbl">Per 1,000 packs · priced on ${mlabel(lastOf(p.mat)[0])} indices</p><h2>${esc(p.name)}</h2>
      ${opts.length > 1 ? `<p class="lbl" style="margin-top:10px">Supplier</p><div class="seg" role="group" aria-label="Supplier">${opts.map(o => `<button type="button" data-s="${o}" aria-pressed="${o === q.sup}">${esc(supById(o).name)}</button>`).join("")}</div>` : `<p class="small muted">${esc(supById(q.sup).name)}</p>`}
      <div class="total"><div><span class="lbl">Paid</span><span class="fig">${inr(q.paid)}</span></div><div><span class="lbl">Should-cost</span><span class="fig">${inr(q.total)}</span></div><div class="em"><span class="lbl">Gap</span><span class="fig ${q.gap > 2 ? "up" : "down"}">${pct(q.gap)}</span></div></div>
      <div class="stack" aria-hidden="true">${BLOCKS.map(([k, , c]) => `<span style="width:${(q.now[k] / q.total * 100).toFixed(2)}%;background:${c}"></span>`).join("")}</div>
      <div class="legend">${BLOCKS.map(([k, n, c]) => `<i style="background:${c}"></i><span>${n}${k === "material" ? ` <span class="muted small">${pct((q.mr - 1) * 100)} since May</span>` : k === "energy" ? ` <span class="muted small">${pct((q.er - 1) * 100)} since May</span>` : ""}</span><span class="v">${inr(q.now[k])}</span><span class="v muted">${(q.now[k] / q.total * 100).toFixed(0)}%</span>`).join("")}</div>
      <p class="note">Material re-prices on ${esc(S.series[p.mat].name)} (real), energy on EU natural gas (real), both from May. Indian grade prices are paid series; a client deployment uses the licensed feed. Block values are illustrative.</p>`;
    $$("#sku-detail .seg button").forEach(b => b.addEventListener("click", () => movePack(p.id, b.dataset.s)));
  }
  function movePack(pid, sup) {
    const p = packById(pid); S.pack = pid;
    if (sup === p.supplier) delete S.assign[pid]; else S.assign[pid] = sup;
    renderPacks();
    if (sup !== p.supplier) toast(`${p.name} moved to ${supById(sup).name} in the plan. Purchase orders are not changed in the demo.`);
  }

  /* ---------- inbox ---------- */
  function renderMailList() {
    const ord = ["kestrel-price", "corvel-tether", "kestrel-cap", "laminex-fm"];
    $("#mail-list").innerHTML = D.mail.slice().sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id)).map(m => `<li><button type="button" data-id="${m.id}" ${m.id === S.mail ? 'aria-current="true"' : ""}><span class="from">${esc(m.from)}</span><span class="subj">${esc(m.subj)}</span><span class="mono small muted">${esc(m.when)}</span></button></li>`).join("");
    $$("#mail-list button").forEach(b => b.addEventListener("click", () => { S.mail = b.dataset.id; renderMailList(); renderMail(); }));
  }
  function claimCheck(m) {
    return m.claims.map(c => {
      const asked = c.share * c.claimed / 100;
      let idx = null, just = 0, v, why = c.why || "";
      if (c.index) {
        idx = changeSince(c.index, BASE);
        const used = Math.min(c.claimed, idx);
        just = c.share * used / 100;
        if (idx < 0) { v = ["v-no", "Not justified"]; why = `${S.series[c.index].name} is ${pct(idx)} since May (${valueAt(c.index, BASE)} to ${lastOf(c.index)[1].toFixed(1)}, ${mlabel(lastOf(c.index)[0])}). The block should come down.`; }
        else if (idx >= c.claimed) { v = ["v-yes", "Justified"]; why = `${S.series[c.index].name} is ${pct(idx)} since May, more than the ${c.claimed}% claimed. Accepted as claimed.`; }
        else { v = ["v-part", "Part-justified"]; why = `${S.series[c.index].name} is ${pct(idx)} since May against ${c.claimed}% claimed.`; }
      } else if (c.accept) { just = asked; v = ["v-yes", "Accepted"]; }
      else if (c.reject) { v = ["v-no", "Rejected"]; }
      else { v = ["v-part", "Pending evidence"]; }
      return Object.assign({}, c, { asked, idx, just, v, why });
    });
  }
  function renderMail() {
    const m = D.mail.find(x => x.id === S.mail);
    let html = `<p class="meta">${esc(m.when)} · ${esc(m.addr)}</p><h2>${esc(m.subj)}</h2><div class="letter">${m.letter.map(p => `<p>${p}</p>`).join("")}</div>`;
    if (m.claims) {
      const rows = claimCheck(m), asked = rows.reduce((a, r) => a + r.asked, 0), just = rows.reduce((a, r) => a + r.just, 0);
      const counter = m.base * (1 + just / 100), newPrice = m.base * (1 + m.asked / 100);
      html += `<section id="claim-check"><p class="lbl">Claim check · each driver against its index since May</p>
        <table class="tbl verdict"><thead><tr><th>Driver</th><th class="r">Share</th><th class="r">Claimed</th><th class="r">Index</th><th class="r">Asked</th><th class="r">Justified</th><th>Verdict</th></tr></thead><tbody>
        ${rows.map(r => `<tr title="${esc(r.why)}"><td>${esc(r.driver)}<div class="small muted">${esc(r.why)}</div></td><td class="r">${r.share === 100 ? "flat" : r.share + "%"}</td><td class="r">${pct(r.claimed, 0)}</td><td class="r">${r.idx == null ? "–" : pct(r.idx)}</td><td class="r">${pct(r.asked, 2)}</td><td class="r">${pct(r.just, 2)}</td><td class="${r.v[0]}">${r.v[1]}</td></tr>`).join("")}
        </tbody></table>
        <div class="total"><div><span class="lbl">Asked</span><span class="fig up">${pct(asked)}</span><span class="small muted">${inr(m.base)} to ${inr(newPrice)}</span></div><div><span class="lbl">Cost-justified</span><span class="fig">${pct(just)}</span><span class="small muted">on real indices</span></div><div class="em"><span class="lbl">Counter</span><span class="fig">${inr(counter)}</span><span class="small muted">per 1,000</span></div></div>
        <p class="note">Proxy: EU primary plastics PPI (real) and EU natural gas (real), May to latest. Indian PE grade prices are paid series; a client deployment uses the licensed feed.</p></section>
        <section class="draft" id="draft"><p class="lbl">Reply drafted · awaiting your approval</p>
        <pre>Dear Ravi,

Thank you for taking the extra tube volume at short notice.

We have checked each driver in your letter against its public index since May. ${rows[0].idx<0?`Polymer prices fell ${Math.abs(rows[0].idx).toFixed(1)}% over that period, so the polymer block should come down, not up.`:`Polymer prices rose ${rows[0].idx.toFixed(1)}% over that period, less than the 9% you claim, and we accept that figure.`} Energy is up more than you claim and we accept your figure. We will review freight when you send the lane invoices, and we accept labour at 6%. We cannot accept the supply security surcharge, which is not a cost.

That supports ${pct(just)}: ${inr(counter)} per 1,000 from 1 December. The workings are attached.

Regards,
Category Manager, Packaging, Brightwater</pre>
        <div class="approve"><button class="btn btn--ember" type="button" id="approve" ${S.approved ? "disabled" : ""}>${S.approved ? "Approved" : "Approve and send"}</button><button class="btn" type="button" id="edit-draft">Edit</button><span class="small muted">Attachment: claim-check-kestrel-abl-tube.xlsx</span></div></section>`;
    }
    $("#mail").innerHTML = html;
    const ap = $("#approve");
    if (ap) ap.addEventListener("click", () => { S.approved = true; renderMail(); toast("Approved and queued. This is a demo: nothing was sent."); });
    const ed = $("#edit-draft");
    if (ed) ed.addEventListener("click", () => { const pre = $("#draft pre"); pre.contentEditable = "true"; pre.focus(); toast("Edit the draft, then approve."); });
  }

  /* ---------- rivals & radar ---------- */
  function renderRivals() {
    $("#rivals").innerHTML = D.rivals.map((r, i) => `<article class="card" id="r-${i}"><p class="lbl">Demo brand</p><h2>${esc(r.name)}</h2><ul class="small">${r.moves.map(m => `<li><span class="mono muted">${esc(m[0])}</span> ${esc(m[1])}</li>`).join("")}</ul></article>`).join("");
  }
  function renderRadarFilters() {
    $("#radar-filters").innerHTML = ["All", "Innovation", "Technology"].map(k => `<button type="button" aria-pressed="${k === S.radarFilter}">${k}</button>`).join("");
    $$("#radar-filters button").forEach(b => b.addEventListener("click", () => { S.radarFilter = b.textContent; renderRadarFilters(); renderRadar(); }));
  }
  function renderRadar() {
    $("#radar").innerHTML = D.radar.filter(r => S.radarFilter === "All" || r.kind === S.radarFilter).map((r, i) => `<article class="card" id="rd-${i}">
      <div class="row"><p class="lbl">${esc(r.area)}</p><span class="mono small stage-${r.stage}">${r.stage.toUpperCase()}</span></div>
      <h3>${esc(r.name)}</h3><p class="mono small">${esc(r.effect)}</p><p class="small muted">${esc(r.note)}</p></article>`).join("");
  }

  /* ---------- toast, clock, tour ---------- */
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 4200); }
  function tick() {
    if (S.touring >= 0) return;
    const d = new Date(), f = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    $("#clock").textContent = f.format(d).replace(",", "") + " IST";
  }
  tick(); setInterval(tick, 20000);

  function act(a) {
    if (!a) return;
    if (a[0] === "series") selectSeries(a[1]);
    if (a[0] === "flash") { S.wireFilter = "All"; renderWireFilters(); renderWire(a[1]); }
    if (a[0] === "filter" && $("#s-wire").hidden === false) { S.wireFilter = a[1]; renderWireFilters(); renderWire(); }
    if (a[0] === "filter" && $("#s-radar").hidden === false) { S.radarFilter = a[1]; renderRadarFilters(); renderRadar(); }
    if (a[0] === "supplier") { S.supplier = a[1]; renderSuppliers(); }
    if (a[0] === "move") { S.pack = a[1]; renderPacks(); setTimeout(() => movePack(a[1], a[2]), 700); }
    if (a[0] === "mail") { S.mail = a[1]; renderMailList(); renderMail(); }
  }
  function step(i) {
    $$(".hl").forEach(e => e.classList.remove("hl"));
    const st = D.tour[i]; S.touring = i;
    show(st.screen); act(st.act);
    $("#tour").hidden = false;
    $("#tour-when").textContent = st.when; $("#tour-text").textContent = st.text;
    $("#tour-n").textContent = (i + 1) + " / " + D.tour.length;
    $("#clock").textContent = st.when.replace(/^(\w{3})\w*day/, "$1").replace(",", "") + " IST";
    $("#tour-prev").disabled = i === 0;
    $("#tour-next").textContent = i === D.tour.length - 1 ? "Finish" : "Next";
    setTimeout(() => { const el = $(st.hl); if (el) { el.classList.add("hl"); el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } }, 120);
  }
  function endTour() { $$(".hl").forEach(e => e.classList.remove("hl")); $("#tour").hidden = true; S.touring = -1; tick(); $("#tour-btn").focus(); }
  $("#tour-btn").addEventListener("click", () => {
    S.assign = {}; S.approved = false; S.wireFilter = "All"; S.radarFilter = "All"; renderWireFilters(); renderRadarFilters(); renderRadar(); renderPacks(); step(0); $("#tour-next").focus();
  });
  $("#tour-next").addEventListener("click", () => S.touring < D.tour.length - 1 ? step(S.touring + 1) : endTour());
  $("#tour-prev").addEventListener("click", () => S.touring > 0 && step(S.touring - 1));
  $("#tour-end").addEventListener("click", endTour);
  if (/[?&]tour=1/.test(location.search)) addEventListener("load", () => setTimeout(() => $("#tour-btn").click(), 400));

  load();
})();
