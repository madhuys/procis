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

  const S = { series: {}, order: [], sel: "sugar", supplier: "laminex", item: "toothpaste", assign: {}, mail: "sarna-price",
    wireFilter: "All", touring: -1, approved: false };

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
    $("#built").textContent = "Indices fetched " + mk.built.replace("T", " ").replace("Z", " UTC") + ". Company, suppliers and most events are demo.";
    computeWire();
    renderTiles(); renderChart();
    renderWireFilters(); renderWire();
    renderSuppliers(); renderItems(); renderMailList(); renderMail(); renderWatch();
    $("#wire-dot").hidden = false; $("#inbox-dot").hidden = false;
  }

  function computeWire() {
    D.wire.forEach(w => {
      if (!w.computed) return;
      const id = w.computed, ser = S.series[id], c = changeSince(id, BASE), l = lastOf(id), may = valueAt(id, BASE);
      w.title = ser.name.replace(/, producer prices$/, "") + (c >= 0 ? " up " : " down ") + Math.abs(c).toFixed(c > -10 && c < 10 ? 1 : 0) + "% since May";
      w.body = `${ser.name} stood at ${fmtVal(ser, l[1])} ${ser.unit} in ${mlabel(l[0])}, against ${fmtVal(ser, may)} in May. ${w.note}`;
      w.real = true; w.src = [ser.src, ser.url];
    });
  }

  /* ---------- screens ---------- */
  const SCREENS = ["markets", "wire", "suppliers", "cost", "inbox", "watch"];
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
    const m = /^F([1-6])$/.exec(e.key);
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
  const KINDS = ["All", "Markets", "Plants", "Shipping", "Weather", "Policy"];
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
    if (t === "item") { S.item = v; renderItems(); show("cost"); }
    if (t === "series") { selectSeries(v); show("markets"); }
    if (t === "screen") show(v);
  }

  /* ---------- suppliers ---------- */
  const itemById = id => D.items.find(p => p.id === id), supById = id => D.suppliers.find(s => s.id === id);
  const share = s => (s.spend / D.totalSpend * 100).toFixed(1);
  const crore = n => "₹" + n.toFixed(n < 10 ? 2 : 1) + " crore";
  function renderSuppliers() {
    $("#sup-table tbody").innerHTML = D.suppliers.map(s => `<tr data-id="${s.id}" aria-selected="${s.id === S.supplier}" tabindex="0">
      <td>${esc(s.name)}<div class="small muted">${esc(s.makes)}</div></td><td class="small">${esc(s.cat)}</td><td class="r">${share(s)}%</td><td>${esc(s.plant)}</td><td><span class="status ${s.status[0]}">${esc(s.status[1])}</span></td></tr>`).join("");
    rowsClick("#sup-table", id => { S.supplier = id; renderSuppliers(); });
    const s = supById(S.supplier);
    $("#sup-detail").innerHTML = `<p class="lbl">${esc(s.cat)} · ${esc(s.plant)} · ${crore(s.spend)} a year, ${share(s)}% of spend</p><h2>${esc(s.name)}</h2><p class="small">${esc(s.detail)}</p>
      ${s.exposure.length ? `<p class="lbl" style="margin-top:14px">Exposure by item</p>
      <table class="tbl"><thead><tr><th>Item</th><th class="r">Volume from ${esc(s.name.split(" ")[0])}</th><th class="r">Cover</th></tr></thead><tbody>
      ${s.exposure.map(([pid, sh, wk]) => `<tr data-id="${pid}"><td>${esc(itemById(pid).name)}<div class="bar${s.status[0] === "bad" ? " ember" : ""}"><i style="width:${sh}%"></i></div></td><td class="r">${sh}%</td><td class="r">${wk} wk</td></tr>`).join("")}
      </tbody></table>` : `<p class="note">No should-cost item: a service contract. Its index-linked part is on Index watch.</p>`}
      ${s.status[0] === "bad" ? `<p class="note">Alternative qualified source: Kestrel Packaging, Daman, with spare tube capacity. <button class="chip" type="button" id="go-move">Re-price on Kestrel</button></p>` : ""}`;
    $$("#sup-detail tbody tr").forEach(r => r.addEventListener("click", () => { S.item = r.dataset.id; renderItems(); show("cost"); }));
    const gm = $("#go-move"); if (gm) gm.addEventListener("click", () => { S.item = "toothpaste"; renderItems(); show("cost"); });
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
  const gapCls = g => g > 2 ? "up" : g < -2 ? "warn" : "down";
  function renderItems() {
    $("#sku-table tbody").innerHTML = D.items.map(p => {
      const q = priced(p), moved = S.assign[p.id] && S.assign[p.id] !== p.supplier;
      return `<tr data-id="${p.id}" aria-selected="${p.id === S.item}" tabindex="0"><td>${esc(p.name)}<div class="small muted">${esc(supById(q.sup).cat)}</div></td><td class="small">${esc(supById(q.sup).name)}${moved ? ' <span class="tag tag--warn">Moved</span>' : ""}</td>
        <td class="r">${inr(q.paid)}<div class="small muted">per ${esc(p.unit)}</div></td><td class="r">${inr(q.total)}</td><td class="r ${gapCls(q.gap)}">${pct(q.gap)}</td></tr>`;
    }).join("");
    rowsClick("#sku-table", id => { S.item = id; renderItems(); });
    const p = itemById(S.item), q = priced(p);
    const opts = [p.supplier].concat(Object.keys(p.alt || {}));
    const gapNote = q.gap > 2 ? "Paying above should-cost: a case to bring the price down." : q.gap < -2 ? "Paying below should-cost on today's indices: expect an ask, and know how much of it is fair." : "Within 2% of should-cost.";
    $("#sku-detail").innerHTML = `<p class="lbl">${esc(supById(q.sup).cat)} · per ${esc(p.unit)} · priced on ${mlabel(lastOf(p.mat)[0])} indices</p><h2>${esc(p.name)}</h2>
      ${opts.length > 1 ? `<p class="lbl" style="margin-top:10px">Supplier</p><div class="seg" role="group" aria-label="Supplier">${opts.map(o => `<button type="button" data-s="${o}" aria-pressed="${o === q.sup}">${esc(supById(o).name)}</button>`).join("")}</div>` : `<p class="small muted">${esc(supById(q.sup).name)}</p>`}
      <div class="total"><div><span class="lbl">Paid</span><span class="fig">${inr(q.paid)}</span></div><div><span class="lbl">Should-cost</span><span class="fig">${inr(q.total)}</span></div><div class="em"><span class="lbl">Gap</span><span class="fig ${gapCls(q.gap)}">${pct(q.gap)}</span></div></div>
      <p class="small">${gapNote}</p>
      <div class="stack" aria-hidden="true">${BLOCKS.map(([k, , c]) => `<span style="width:${(q.now[k] / q.total * 100).toFixed(2)}%;background:${c}"></span>`).join("")}</div>
      <div class="legend">${BLOCKS.map(([k, n, c]) => `<i style="background:${c}"></i><span>${n}${k === "material" ? ` <span class="muted small">${pct((q.mr - 1) * 100)} since May</span>` : k === "energy" ? ` <span class="muted small">${pct((q.er - 1) * 100)} since May</span>` : ""}</span><span class="v">${inr(q.now[k])}</span><span class="v muted">${(q.now[k] / q.total * 100).toFixed(0)}%</span>`).join("")}</div>
      <p class="note">Material re-prices on ${esc(S.series[p.mat].name)} (real), energy on EU natural gas (real), both from May. Block values are illustrative; a client deployment uses its own cost models and licensed grade feeds.</p>`;
    $$("#sku-detail .seg button").forEach(b => b.addEventListener("click", () => moveItem(p.id, b.dataset.s)));
  }
  function moveItem(pid, sup) {
    const p = itemById(pid); S.item = pid;
    if (sup === p.supplier) delete S.assign[pid]; else S.assign[pid] = sup;
    renderItems();
    if (sup !== p.supplier) toast(`${p.name} moved to ${supById(sup).name} in the plan. Purchase orders are not changed in the demo.`);
  }

  /* ---------- inbox ---------- */
  function renderMailList() {
    const ord = ["sarna-price", "halden-review", "kestrel-cap", "laminex-fm"];
    $("#mail-list").innerHTML = D.mail.slice().sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id)).map(m => `<li><button type="button" data-id="${m.id}" ${m.id === S.mail ? 'aria-current="true"' : ""}><span class="from">${esc(m.from)}</span><span class="subj">${esc(m.subj)}</span><span class="mono small muted">${esc(m.when)}</span></button></li>`).join("");
    $$("#mail-list button").forEach(b => b.addEventListener("click", () => { S.mail = b.dataset.id; renderMailList(); renderMail(); }));
  }
  function claimCheck(m) {
    return m.claims.map(c => {
      const asked = c.share * c.claimed / 100;
      let idx = null, just = 0, v, why = c.why || "";
      if (c.index) {
        idx = changeSince(c.index, BASE);
        const used = Math.max(0, Math.min(c.claimed, idx));
        just = c.share * used / 100;
        if (idx < 0) { v = ["v-no", "Not justified"]; const ser = S.series[c.index]; why = `${ser.name} is ${pct(idx)} since May (${fmtVal(ser, valueAt(c.index, BASE))} to ${fmtVal(ser, lastOf(c.index)[1])}, ${mlabel(lastOf(c.index)[0])}). The block should not rise.`; }
        else if (idx >= c.claimed) { v = ["v-yes", "Justified"]; why = `${S.series[c.index].name} is ${pct(idx)} since May, more than the ${c.claimed}% claimed. Accepted as claimed.`; }
        else { v = ["v-part", "Part-justified"]; why = `${S.series[c.index].name} is ${pct(idx)} since May against ${c.claimed}% claimed.`; }
      } else if (c.accept) { just = asked; v = ["v-yes", "Accepted"]; }
      else if (c.reject) { v = ["v-no", "Rejected"]; }
      else { v = ["v-part", "Pending evidence"]; }
      return Object.assign({}, c, { asked, idx, just, v, why });
    });
  }
  const r100 = n => Math.round(n / 100) * 100;
  function replyLine(r) {
    const d = r.driver.toLowerCase();
    if (r.index) {
      if (r.idx < 0) return `${r.ix} fell ${Math.abs(r.idx).toFixed(1)}% over that period, so the ${d} block should not rise.`;
      if (r.idx >= r.claimed) return `${r.ix} rose more than the ${r.claimed}% you claim for ${d}, and we accept your figure.`;
      return `${r.ix} rose ${r.idx.toFixed(1)}% over that period against the ${r.claimed}% you claim for ${d}; we accept ${r.idx.toFixed(1)}%.`;
    }
    if (r.accept) return `We accept ${d} at ${r.claimed}%.`;
    if (r.reject) return `We cannot accept the ${d}, which is not a cost.`;
    return `We will review ${d} when you send the lane invoices.`;
  }
  function checkTotals(m) {
    const rows = claimCheck(m), asked = rows.reduce((a, r) => a + r.asked, 0), just = rows.reduce((a, r) => a + r.just, 0);
    return { rows, asked, just, counter: r100(m.base * (1 + just / 100)), newPrice: r100(m.base * (1 + m.asked / 100)) };
  }
  function renderMail() {
    const m = D.mail.find(x => x.id === S.mail);
    let html = `<p class="meta">${esc(m.when)} · ${esc(m.addr)}</p><h2>${esc(m.subj)}</h2><div class="letter">${m.letter.map(p => `<p>${p}</p>`).join("")}</div>`;
    if (m.claims) {
      const { rows, asked, just, counter, newPrice } = checkTotals(m);
      html += `<section id="claim-check"><p class="lbl">Claim check · each driver against its index since May</p>
        <table class="tbl verdict"><thead><tr><th>Driver</th><th class="r">Share</th><th class="r">Claimed</th><th class="r">Index</th><th class="r">Asked</th><th class="r">Justified</th><th>Verdict</th></tr></thead><tbody>
        ${rows.map(r => `<tr title="${esc(r.why)}"><td>${esc(r.driver)}<div class="small muted">${esc(r.why)}</div></td><td class="r">${r.share === 100 ? "flat" : r.share + "%"}</td><td class="r">${pct(r.claimed, 0)}</td><td class="r">${r.idx == null ? "–" : pct(r.idx)}</td><td class="r">${pct(r.asked, 2)}</td><td class="r">${pct(r.just, 2)}</td><td class="${r.v[0]}">${r.v[1]}</td></tr>`).join("")}
        </tbody></table>
        <div class="total"><div><span class="lbl">Asked</span><span class="fig up">${pct(asked)}</span><span class="small muted">${inr(m.base)} to ${inr(newPrice)}</span></div><div><span class="lbl">Cost-justified</span><span class="fig">${pct(just)}</span><span class="small muted">on real indices</span></div><div class="em"><span class="lbl">Counter</span><span class="fig">${inr(counter)}</span><span class="small muted">${esc(m.unit)}</span></div></div>
        <p class="note">${esc(m.note)}</p></section>
        <section class="draft" id="draft"><p class="lbl">Reply drafted · awaiting your approval</p>
        <pre>${esc(m.greet)}

${esc(m.opener)}

We have checked each driver against its public index since May. ${rows.map(replyLine).join(" ")}

That supports ${pct(just)}: ${inr(counter)} ${esc(m.unit)} from 1 December, against the ${pct(asked)} asked. The workings are attached.

Regards,
${esc(m.sign)}</pre>
        <div class="approve"><button class="btn btn--ember" type="button" id="approve" ${S.approved ? "disabled" : ""}>${S.approved ? "Approved" : "Approve and send"}</button><button class="btn" type="button" id="edit-draft">Edit</button><span class="small muted">Attachment: ${esc(m.attach)}</span></div></section>`;
    }
    $("#mail").innerHTML = html;
    const ap = $("#approve");
    if (ap) ap.addEventListener("click", () => { S.approved = true; renderMail(); toast("Approved and queued. This is a demo: nothing was sent."); });
    const ed = $("#edit-draft");
    if (ed) ed.addEventListener("click", () => { const pre = $("#draft pre"); pre.contentEditable = "true"; pre.focus(); toast("Edit the draft, then approve."); });
  }

  /* ---------- index watch ---------- */
  function watchRows(list, sign) {
    return list.map(w => { const c = changeSince(w.index, BASE); return Object.assign({}, w, { c, val: w.spend * w.share / 100 * Math.abs(c) / 100, live: sign * c > 0 }); });
  }
  function tally() {
    const down = watchRows(D.watch.down, -1), up = watchRows(D.watch.up, 1);
    const m = D.mail.find(x => x.claims), t = checkTotals(m), sup = supById(m.supplier);
    return { down, up, recover: down.filter(r => r.live).reduce((a, r) => a + r.val, 0), expect: up.filter(r => r.live).reduce((a, r) => a + r.val, 0),
      held: sup.spend * (t.asked - t.just) / 100, just: inr(t.counter) + " " + m.unit, brent: down.find(r => r.index === "brent").val };
  }
  function watchTable(rows, id, head, totalLbl, total) {
    return `<table class="tbl" id="${id}"><thead><tr><th>${head}</th><th>Index since May</th><th class="r">Spend a year</th><th class="r">Linked</th><th class="r">${totalLbl}</th></tr></thead><tbody>
      ${rows.map(r => { const ser = S.series[r.index]; return `<tr><td>${esc(r.name)}<div class="small muted">${esc(supById(r.supplier).name)}</div></td><td class="small">${esc(ser.name.replace(/, producer prices$/, ""))} <span class="mono ${r.c > 0 ? "up" : "down"}">${pct(r.c)}</span></td><td class="r">${crore(r.spend)}</td><td class="r">${r.share}%</td><td class="r">${r.live ? crore(r.val) : "–"}</td></tr>`; }).join("")}
      <tr><td colspan="4"><b>Total</b></td><td class="r"><b>${crore(total)}</b></td></tr></tbody></table>`;
  }
  function renderWatch() {
    const t = tally();
    $("#watch").innerHTML = `<div class="total" id="tally"><div><span class="lbl">Supply</span><span class="fig">Covered</span><span class="small muted">Toothpaste tube on Kestrel</span></div><div><span class="lbl">Held off this week</span><span class="fig">${crore(t.held)}</span><span class="small muted">a year, SLES claim check</span></div><div class="em"><span class="lbl">To recover</span><span class="fig">${crore(t.recover)}</span><span class="small muted">a year, from falling indices</span></div></div>
      <p class="lbl" style="margin-top:18px">Prices to bring down · set in May, index fallen since</p>
      ${watchTable(t.down, "watch-down", "Contract", "Recoverable a year", t.recover)}
      <p class="lbl" style="margin-top:22px">Asks to expect · set in May, index risen since</p>
      ${watchTable(t.up, "watch-up", "Contract", "Exposure a year", t.expect)}
      <p class="note">Value = annual spend × the share of the price linked to the index × the index change since May. Indices are real; spend and links are demo figures.</p>`;
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
    if (a[0] === "supplier") { S.supplier = a[1]; renderSuppliers(); }
    if (a[0] === "move") { S.item = a[1]; renderItems(); setTimeout(() => moveItem(a[1], a[2]), 700); }
    if (a[0] === "mail") { S.mail = a[1]; renderMailList(); renderMail(); }
  }
  function fill(txt) {
    const t = tally();
    return txt.replace("{held}", crore(t.held)).replace("{recover}", crore(t.recover)).replace("{brent}", crore(t.brent)).replace("{just}", t.just);
  }
  function step(i) {
    $$(".hl").forEach(e => e.classList.remove("hl"));
    const st = D.tour[i]; S.touring = i;
    show(st.screen); act(st.act);
    $("#tour").hidden = false;
    $("#tour-when").textContent = st.when; $("#tour-text").textContent = fill(st.text);
    $("#tour-n").textContent = (i + 1) + " / " + D.tour.length;
    $("#clock").textContent = st.when.replace(/^(\w{3})\w*day/, "$1").replace(",", "") + " IST";
    $("#tour-prev").disabled = i === 0;
    $("#tour-next").textContent = i === D.tour.length - 1 ? "Finish" : "Next";
    setTimeout(() => { $$(".hl").forEach(e => e.classList.remove("hl")); const el = $(st.hl); if (el) { el.classList.add("hl"); el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } }, 120);
  }
  function endTour() { $$(".hl").forEach(e => e.classList.remove("hl")); $("#tour").hidden = true; S.touring = -1; tick(); $("#tour-btn").focus(); }
  $("#tour-btn").addEventListener("click", () => {
    S.assign = {}; S.approved = false; S.wireFilter = "All"; renderWireFilters(); renderWire(); renderItems(); renderMail(); step(0); $("#tour-next").focus();
  });
  $("#tour-next").addEventListener("click", () => S.touring < D.tour.length - 1 ? step(S.touring + 1) : endTour());
  $("#tour-prev").addEventListener("click", () => S.touring > 0 && step(S.touring - 1));
  $("#tour-end").addEventListener("click", endTour);
  if (/[?&]tour=1/.test(location.search)) addEventListener("load", () => setTimeout(() => $("#tour-btn").click(), 400));

  load();
})();
