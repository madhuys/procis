/* Procis product teardown: 3D pack, click a part -> BOM lines -> chain to raw materials on the globe -> should-cost.
   Data: data/products.js (window.PRODUCTS), built by product-teardown/3d/tools/build_desk_data.py */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const P = window.PRODUCTS;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (v, d = 2) => v == null || isNaN(v) ? "—" : "₹" + (+v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v, d = 3) => v == null || isNaN(v) ? "—" : (+v).toLocaleString("en-IN", { maximumFractionDigits: d });
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const srcA = (u, t) => u && /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${esc(t || host(u))}</a>` : "";
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2400); }
$("#asof").textContent = new Date(P.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const PART_COL = ["#FF4F1F", "#8EC5FF", "#F2C14E", "#9FD3A8", "#C99BFF", "#E8B85C"];
const TIER_COL = { 1: "#FF4F1F", 2: "#F2C14E", 3: "#9FD3A8", 4: "#8EC5FF", 5: "#C99BFF" };
const PART_LABEL = { "soap-bar": "Soap bar", carton: "Carton", cap: "Cap", sleeve: "Shrink sleeve", bottle: "Bottle and liquid", "inner-pack": "Inner pack and tea", "neck-label": "Neck label", label: "Wrap label", glass: "Glass bottle", ketchup: "Ketchup", tube: "Tube and paste" };
// commodity desks a BOM line can open (the desk's own ?c= ids)
const DESKS = [[/palm|kernel|lauric|stear|fatty acid|tallow|soap noodle/i, "palm", "Palm oil"], [/sugar/i, "sugar", "Sugar"], [/\bPET\b|polyethylene terephthalate/i, "pet", "PET resin"], [/\bPP\b|polypropylene/i, "pp", "Polypropylene"], [/\bPTA\b|terephthalic/i, "pta", "PTA"], [/\bMEG\b|mono-?ethylene glycol/i, "meg", "MEG"], [/wheat|flour/i, "wheat", "Wheat"]];
const deskFor = i => { const t = `${i.item} ${i.material || ""}`; const m = DESKS.find(([re]) => re.test(t)); return m ? `<a class="pt-desk" href="index.html?c=${m[1]}" title="Open the ${m[2]} desk">${m[2]} desk ↗</a>` : ""; };

function packSize(p) { const r = p.ref; return r.size ? `${r.size}${r.unit && !String(r.size).includes(r.unit) ? " " + r.unit : ""}` : String(r.pack_size || "").replace(/\s*\(.*\)/, ""); }
const S = { pid: null, part: null, open: null, exploded: false };
const prod = () => P.items.find(p => p.id === S.pid);

/* ---------- tabs ---------- */
$("#tabs").innerHTML = P.items.map(p => {
  const sz = packSize(p);
  return `<button class="pt-tab" role="tab" data-id="${p.id}" aria-selected="false"><b>${esc(p.short)}</b><span>${esc(sz)} · should-cost ${inr(p.cost.total)}</span></button>`;
}).join("");
$("#tabs").addEventListener("click", e => { const b = e.target.closest(".pt-tab"); if (b) pick(b.dataset.id); });

/* ---------- 3D viewer ---------- */
const vEl = $("#viewer");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
vEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, .6));
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(.4, .8, .6); scene.add(key);
const cam = new THREE.PerspectiveCamera(32, 1, .001, 50);
const ctl = new OrbitControls(cam, renderer.domElement);
ctl.enableDamping = true; ctl.dampingFactor = .08; ctl.autoRotate = !reduced; ctl.autoRotateSpeed = .8;
ctl.addEventListener("start", () => ctl.autoRotate = false);
const loader = new GLTFLoader();
const cache = {};
let root = null, parts = {}, home = null;
function size() { const w = vEl.clientWidth, h = vEl.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; cam.aspect = w / h; cam.updateProjectionMatrix(); }
new ResizeObserver(size).observe(vEl);
const partName = o => { for (let n = o; n; n = n.parent) { const u = n.userData || {}; if (u.part) return u.part; const m = /^part[:_]?(.+)$/.exec(n.name || ""); if (m && parts[m[1]]) return m[1]; } return null; };

async function loadModel(p) {
  if (root) scene.remove(root);
  parts = {}; root = null;
  const g = cache[p.id] || (cache[p.id] = await loader.loadAsync(p.model));
  if (S.pid !== p.id) return;
  root = g.scene; scene.add(root);
  root.traverse(o => {
    const m = /^part[:_]?(.+)$/.exec(o.name || "");
    if (m && !parts[m[1]]) parts[m[1]] = { node: o, base: o.position.clone(), off: new THREE.Vector3(...(p.explode[m[1]] || [0, 0, 0])) };
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => { if (x.emissive) x.userData.e0 = x.emissive.clone(); });
    }
  });
  Object.entries(parts).forEach(([k, v]) => v.node.traverse(o => o.userData.part = k));
  applyExplode(true);
  frame();
  highlight();
  const missing = p.parts3d.map(x => x.name).filter(n => !parts[n]);
  if (missing.length) console.warn("parts not found in model", missing);
}
function frame() {
  const box = new THREE.Box3().setFromObject(root); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()).length();
  ctl.target.copy(c); cam.position.copy(c).add(new THREE.Vector3(.55, .32, 1).normalize().multiplyScalar(s * 1.9));
  cam.near = s / 100; cam.far = s * 20; cam.updateProjectionMatrix(); ctl.update();
  home = { p: cam.position.clone(), t: c.clone() };
}
let tw = null;
function applyExplode(now) {
  const from = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.node.position.clone()]));
  const to = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.base.clone().add(S.exploded ? v.off : new THREE.Vector3())]));
  if (now || reduced) { Object.entries(parts).forEach(([k, v]) => v.node.position.copy(to[k])); tw = null; return; }
  tw = { t0: performance.now(), d: 650, from, to };
}
function highlight(hover) {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh) return;
    const k = o.userData.part, sel = k && k === S.part, hov = k && k === hover;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m.emissive) return;
      if (sel) m.emissive.set(0xff4f1f).multiplyScalar(.28); else if (hov) m.emissive.set(0xffffff).multiplyScalar(.10); else m.emissive.copy(m.userData.e0 || new THREE.Color(0));
      m.transparent = !!(S.part && !sel); m.opacity = S.part && !sel ? .35 : 1; m.depthWrite = !(S.part && !sel);
    });
  });
}
const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
let down = null, hoverPart = null;
function hit(e) { const r = renderer.domElement.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mv, cam); const h = root ? ray.intersectObject(root, true) : []; return h.length ? h[0].object.userData.part || partName(h[0].object) : null; }
renderer.domElement.addEventListener("pointerdown", e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener("pointerup", e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; const k = hit(e); selectPart(k && k === S.part ? null : k); });
renderer.domElement.addEventListener("pointermove", e => { if (e.buttons) return; const k = hit(e); if (k !== hoverPart) { hoverPart = k; highlight(k); renderer.domElement.style.cursor = k ? "pointer" : "grab"; } });
(function loop(t) {
  requestAnimationFrame(loop);
  if (tw) { const a = Math.min(1, (t - tw.t0) / tw.d), e = a < .5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2; Object.entries(parts).forEach(([k, v]) => v.node.position.lerpVectors(tw.from[k], tw.to[k], e)); if (a >= 1) tw = null; }
  ctl.update(); renderer.render(scene, cam);
})(0);
$("#b-asm").onclick = () => setExplode(false);
$("#b-exp").onclick = () => setExplode(true);
$("#b-reset").onclick = () => { if (!home) return; cam.position.copy(home.p); ctl.target.copy(home.t); ctl.update(); };
function setExplode(v) { S.exploded = v; $("#b-asm").setAttribute("aria-pressed", !v); $("#b-exp").setAttribute("aria-pressed", v); applyExplode(); }

/* ---------- part chips ---------- */
const itemsOf = (p, k) => p.bom.filter(i => k === "_none" ? !i.part3d : i.part3d === k);
const sumCost = a => a.reduce((s, i) => s + (i.cost || 0), 0);
function chips() {
  const p = prod();
  const ks = p.parts3d.map(x => x.name);
  const html = ks.map(k => { const its = itemsOf(p, k); return `<button class="pt-chip" data-k="${k}" aria-pressed="${S.part === k}">${esc(PART_LABEL[k] || k)}<i>${its.length ? inr(sumCost(its)) : "no BOM line"}</i></button>`; });
  if (itemsOf(p, "_none").length) html.push(`<button class="pt-chip" data-k="_none" aria-pressed="${S.part === "_none"}">Process, shipper<i>${inr(sumCost(itemsOf(p, "_none")))}</i></button>`);
  $("#chips").innerHTML = `<button class="pt-chip" data-k="" aria-pressed="${!S.part}">Whole pack<i>${inr(p.cost.linesSum)}</i></button>` + html.join("");
}
$("#chips").addEventListener("click", e => { const b = e.target.closest(".pt-chip"); if (b) selectPart(b.dataset.k || null); });

/* ---------- side panel ---------- */
function side() {
  const p = prod(), k = S.part;
  const its = k ? itemsOf(p, k) : p.bom;
  const info = k && k !== "_none" ? p.parts3d.find(x => x.name === k) : null;
  const title = !k ? p.name : k === "_none" ? "Process and shipper (not on the model)" : (PART_LABEL[k] || k);
  const mrp = p.price.mrp;
  let h = `<h2>${esc(title)}</h2>`;
  if (!k) {
    h += `<p class="sub">${esc(p.ref.variant || "")}${p.ref.size ? " · " + esc(p.ref.size) + " " + esc(p.ref.unit || "") : ""} · ${p.bom.length} BOM lines. Click a part on the model, or a chip, to see its lines.</p>
    <div class="pt-kpis"><div class="pt-kpi"><p class="lbl">Should-cost</p><div class="v">${inr(p.cost.total)}</div></div>
    <div class="pt-kpi"><p class="lbl">MRP</p><div class="v">${inr(mrp, 0)}</div></div>
    <div class="pt-kpi"><p class="lbl">Share of MRP</p><div class="v">${mrp && p.cost.total ? Math.round(p.cost.total / mrp * 100) + "%" : "—"}</div></div></div>`;
  } else {
    h += `<p class="sub">${info ? esc(info.label || "") + (info.bbox ? " · " + info.bbox.map(v => (+v).toFixed(1)).join(" × ") + " cm" : "") + " · " : ""}${its.length} BOM line${its.length === 1 ? "" : "s"} · ${inr(sumCost(its))} of direct cost</p>`;
  }
  if (!its.length) h += `<p class="muted small">No BOM line is mapped to this part.</p>`;
  else {
    h += `<table class="pt-bom"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Cost</th></tr></thead><tbody>`;
    its.slice().sort((a, b) => (b.cost || 0) - (a.cost || 0)).forEach(i => {
      const open = S.open === i.id;
      h += `<tr class="it" data-id="${esc(i.id)}" aria-expanded="${open}" tabindex="0"><td><b>${esc(i.item)}</b>${deskFor(i)}<br><span class="xs muted">${esc(i.material || "")}</span></td>
        <td class="n mono">${num(i.qty)} ${esc(i.unit || "")}${i.qtyBasis === "estimate" ? `<br><span class="tag tag--warn">est</span>` : ""}</td><td class="n mono">${inr(i.cost)}</td></tr>`;
      if (open) h += `<tr class="det"><td colspan="3">${detail(i)}</td></tr>`;
    });
    h += `</tbody></table>`;
  }
  $("#side").innerHTML = h;
}
function detail(i) {
  let h = "";
  if (i.qtyNote) h += `<p class="xs muted" style="margin:0 0 6px">Quantity: ${esc(i.qtyNote)} ${srcA(i.qtySrc, "source")}</p>`;
  if (i.chain.length) {
    h += `<p class="lbl">Chain to raw material</p><ul class="pt-chain">`;
    i.chain.slice().sort((a, b) => (a.tier || 0) - (b.tier || 0)).forEach(t => {
      h += `<li style="--tc:${TIER_COL[t.tier] || "#8EC5FF"}"><span class="st">Tier ${t.tier ?? "?"}: ${esc(t.stage || "")}</span>`;
      t.players.forEach(pl => h += `<div class="pl">${esc(pl.name)}${pl.where ? " · " + esc(pl.where) : ""}${pl.link ? `<span class="pt-link ${esc(pl.link)}">${esc(pl.link)}</span>` : ""} ${srcA(pl.src)}</div>`);
      if (t.note) h += `<div class="pl">${esc(t.note)}</div>`;
      h += `</li>`;
    });
    h += `</ul>`;
  }
  if (i.risks.length) h += `<p class="lbl" style="margin-top:6px">Risks</p>` + i.risks.map(r => `<p class="xs muted" style="margin:2px 0">${esc(r.what || r)}${r.where ? " (" + esc(r.where) + ")" : ""} ${srcA(r.src)}</p>`).join("");
  return h || `<span class="muted xs">No chain recorded.</span>`;
}
$("#side").addEventListener("click", e => {
  if (e.target.closest("a")) return;
  const r = e.target.closest("tr.it"); if (!r) return;
  S.open = S.open === r.dataset.id ? null : r.dataset.id; side(); globeData();
});
$("#side").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.it")) { e.preventDefault(); e.target.click(); } });

/* ---------- globe ---------- */
let globe = null, GEO = null;
const gEl = $("#pglobe");
function initGlobe() {
  const ok = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  if (!ok || typeof Globe !== "function") { gEl.innerHTML = `<p class="muted small" style="padding:16px">The globe needs WebGL.</p>`; return; }
  globe = Globe({ animateIn: !reduced })(gEl)
    .backgroundColor("rgba(0,0,0,0)").showAtmosphere(true).atmosphereColor("#FF4F1F").atmosphereAltitude(.12).showGraticules(true)
    .polygonCapColor(() => "rgba(42,48,60,.95)").polygonSideColor(() => "rgba(255,79,31,.06)").polygonStrokeColor(() => "rgba(242,238,230,.10)").polygonAltitude(.004)
    .pointLat("lat").pointLng("lon").pointAltitude(.02).pointRadius(d => d.sel ? .55 : .38).pointColor(d => TIER_COL[d.tier] || "#8EC5FF").pointsMerge(false)
    .pointLabel(d => `<div style="font:11.5px Geist,sans-serif;background:#12151C;border:1px solid rgba(242,238,230,.22);padding:6px 9px;border-radius:5px;color:#F2EEE6;max-width:260px;white-space:normal"><b>${esc(d.name)}</b><br>${esc(d.where || "")}<br><span style="color:#A7A298">Tier ${d.tier}: ${esc(d.stage)} · for ${esc(d.item)}</span></div>`)
    .onPointClick(d => { S.open = d.bid; const it = prod().bom.find(i => i.id === d.bid); if (it && it.part3d !== S.part) selectPart(it.part3d || "_none", true); else side(); globeData(); })
    .arcStartLat(d => d.a.lat).arcStartLng(d => d.a.lon).arcEndLat(d => d.b.lat).arcEndLng(d => d.b.lon)
    .arcColor(d => [TIER_COL[d.a.tier] + "33", TIER_COL[d.b.tier] || "#FF4F1F"]).arcStroke(.35).arcAltitudeAutoScale(.35)
    .arcDashLength(.5).arcDashGap(.2).arcDashAnimateTime(reduced ? 0 : 2400);
  const m = globe.globeMaterial(); m.color && m.color.set("#0f131b"); if (m.emissive) m.emissive.set("#0b0e14");
  globe.controls().autoRotate = false;
  globe.width(gEl.clientWidth).height(gEl.clientHeight);
  fetch("data/countries.json").then(r => r.json()).then(g => { GEO = g; globe.polygonsData(g.features.filter(f => f.properties.iso !== "ATA")); }).catch(() => {});
  new ResizeObserver(() => globe.width(gEl.clientWidth).height(gEl.clientHeight)).observe(gEl);
}
function globeData() {
  const p = prod(); const its = S.open ? p.bom.filter(i => i.id === S.open) : S.part ? itemsOf(p, S.part) : p.bom;
  const pts = [], arcs = [];
  its.forEach(i => {
    const byTier = {};
    i.chain.forEach(t => t.players.forEach(pl => { if (pl.lat == null || pl.lon == null) return; const d = { ...pl, lat: +pl.lat, lon: +pl.lon, tier: t.tier || 1, stage: t.stage || "", item: i.item, bid: i.id, sel: S.open === i.id }; pts.push(d); (byTier[d.tier] = byTier[d.tier] || []).push(d); }));
    Object.keys(byTier).map(Number).sort((a, b) => a - b).forEach(t => { const up = byTier[t + 1]; if (up) up.forEach(a => arcs.push({ a, b: byTier[t][0] })); });
  });
  const nAll = its.reduce((s, i) => s + i.chain.reduce((x, t) => x + t.players.length, 0), 0);
  $("#g-title").textContent = S.open ? "Chain: " + (p.bom.find(i => i.id === S.open) || {}).item : S.part ? "Chain: " + (S.part === "_none" ? "process and shipper" : PART_LABEL[S.part] || S.part) : "Supply chain: " + p.short;
  $("#g-count").textContent = `${pts.length} of ${nAll} players placed`;
  const tiers = [...new Set(pts.map(d => d.tier))].sort();
  $("#g-legend").innerHTML = tiers.map(t => `<span><i style="background:${TIER_COL[t] || "#8EC5FF"}"></i>Tier ${t}</span>`).join("") + `<span class="faint">Tier 1 is the supplier nearest HUL; higher tiers run back to the raw material. Players without a known site are listed in the BOM, not plotted.</span>`;
  if (!globe) return;
  globe.pointsData(pts).arcsData(arcs);
  if (pts.length) { const la = pts.reduce((s, d) => s + d.lat, 0) / pts.length, lo = pts.reduce((s, d) => s + d.lon, 0) / pts.length; const spread = Math.max(...pts.map(d => Math.hypot(d.lat - la, d.lon - lo))); globe.pointOfView({ lat: la, lng: lo, altitude: spread > 60 ? 2.3 : spread > 20 ? 1.6 : 1.0 }, reduced ? 0 : 900); }
}

/* ---------- should-cost ---------- */
function cost() {
  const p = prod(), c = p.cost, mrp = p.price.mrp;
  const groups = {};
  p.bom.forEach(i => { const k = i.part3d || "_none"; groups[k] = (groups[k] || 0) + (i.cost || 0); });
  const other = (p.otherLines || []).reduce((s, l) => s + (l.cost || 0), 0);
  if (other) groups._conv = other;
  const keys = Object.keys(groups).filter(k => groups[k] > 0).sort((a, b) => groups[b] - groups[a]);
  const col = {}; keys.forEach((k, i) => col[k] = PART_COL[i % PART_COL.length]);
  const lab = k => k === "_none" ? "Process and shipper" : k === "_conv" ? "Conversion (energy, labour, freight)" : PART_LABEL[k] || k;
  const overhead = c.total != null ? c.total - c.linesSum : null; // overhead + margin as the researcher stated them
  const segs = keys.map(k => [lab(k), groups[k], col[k]]);
  const inM = c.marginPct && c.withMargin == null;
  if (overhead > 0.005) segs.push([`Overhead${inM ? " and margin" : ""} (${c.overheadPct ?? "?"}%${inM ? " + " + c.marginPct + "%" : ""})`, overhead, "#6F6B64"]);
  const base = c.total || 1;
  let h = `<p class="lbl">Per pack, ${esc(packSize(p))}</p><div class="pt-bar" role="img" aria-label="Should-cost split">${segs.map(([l, v, cl]) => `<span style="width:${(v / base * 100).toFixed(2)}%;background:${cl}" title="${esc(l)} ${inr(v)}"></span>`).join("")}</div>`;
  h += `<table class="pt-cl">${segs.map(([l, v, cl]) => `<tr><td><i class="sw" style="background:${cl}"></i>${esc(l)}</td><td class="n">${inr(v)}</td><td class="n faint">${Math.round(v / base * 100)}%</td></tr>`).join("")}<tr class="tot"><td>Should-cost</td><td class="n">${inr(c.total)}</td><td class="n"></td></tr></table>`;
  if (mrp) {
    const gst = p.price.gstPct != null ? mrp - mrp / (1 + p.price.gstPct / 100) : null;
    const ex = gst != null ? mrp - gst : null, trade = ex != null && p.price.tradePct != null ? ex * p.price.tradePct / 100 : null;
    const net = trade != null ? ex - trade : null;
    h += `<p class="lbl" style="margin-top:16px">Against the shelf price</p><table class="pt-cl">
      <tr><td>MRP</td><td class="n">${inr(mrp)}</td></tr>
      ${gst != null ? `<tr><td>less GST ${p.price.gstPct}%</td><td class="n">−${inr(gst)}</td></tr>` : ""}
      ${trade != null ? `<tr><td>less trade margin ${p.price.tradePct}% <span class="tag tag--warn">est</span></td><td class="n">−${inr(trade)}</td></tr>` : ""}
      ${net != null ? `<tr class="tot"><td>HUL realisation (est.)</td><td class="n">${inr(net)}</td></tr>` : ""}
      <tr><td>Should-cost as share of ${net != null ? "realisation" : "MRP"}</td><td class="n">${c.total ? Math.round(c.total / (net || mrp) * 100) + "%" : "—"}</td></tr></table>`;
    h += `<p class="pt-note">The gap between should-cost and realisation pays for brand, selling, distribution and HUL's margin. The negotiation lever is the material lines above, each priced against its index.</p>`;
  }
  if (c.withMargin != null) h += `<p class="pt-note">With a ${c.marginPct}% supplier margin: ${inr(c.withMargin)}.</p>`;
  if (c.sensitivity && typeof c.sensitivity === "object") h += `<p class="pt-note">Range ${inr(c.sensitivity.low)} to ${inr(c.sensitivity.high)} on low and high input prices.</p>`;
  $("#cost").innerHTML = h;
}

/* ---------- SKUs and caveats ---------- */
function skus() {
  const p = prod(); $("#sku-n").textContent = `${p.skus.length} SKUs`;
  $("#skus").innerHTML = p.skus.length ? `<table class="pt-skus"><thead><tr><th>Variant</th><th>Size</th><th>Format</th><th class="n">MRP</th></tr></thead><tbody>${p.skus.map(s => `<tr><td>${s.url ? srcA(s.url, s.variant) : esc(s.variant)}</td><td>${esc(s.size ?? "")} ${esc(s.unit || "")}</td><td class="muted">${esc(s.format || "")}</td><td class="n">${s.mrp_inr != null ? inr(s.mrp_inr, 0) : "—"}</td></tr>`).join("")}</tbody></table>${p.plants.length ? `<p class="pt-note"><b>Plant on pack:</b> ${p.plants.map(esc).join("; ")}</p>` : ""}` : `<p class="muted small">No SKUs recorded.</p>`;
  const list = [];
  if (p.id === "kissan-ketchup") list.push(`<b>Pack mismatch.</b> The BOM is costed for the 1 kg squeeze bottle; the 3D model is the 200 g glass bottle. Glass-bottle costing is not done yet.`);
  (p.unsure || []).forEach(u => list.push(esc(typeof u === "string" ? u : u.claim || u.what || JSON.stringify(u))));
  (p.weakest || []).slice(0, 6).forEach(u => list.push(`<b>Weak estimate:</b> ${esc(typeof u === "string" ? u : u.item || JSON.stringify(u))}`));
  (p.skuUnsure || []).forEach(u => list.push(`<b>SKU:</b> ${esc(typeof u === "string" ? u : JSON.stringify(u))}`));
  if (p.cost.notes) list.push(`<b>Basis:</b> ${esc(p.cost.notes)}`);
  $("#caveats").innerHTML = `<ul class="pt-cav">${list.map(x => `<li>${x}</li>`).join("")}</ul>`;
}

/* ---------- selection ---------- */
function selectPart(k, keepOpen) {
  S.part = k || null; if (!keepOpen) S.open = null;
  chips(); side(); globeData(); highlight(hoverPart);
  history.replaceState(null, "", `#${S.pid}${S.part ? "/" + S.part : ""}`);
}
function pick(id) {
  if (!P.items.some(p => p.id === id)) id = P.items[0].id;
  S.pid = id; S.part = null; S.open = null;
  $$(".pt-tab").forEach(b => b.setAttribute("aria-selected", b.dataset.id === id));
  const p = prod();
  $("#vnote").textContent = `Size ${p.dims ? `${p.dims.w} × ${p.dims.h} × ${p.dims.d} cm` : "—"} (${p.dimsSrc || ""}). Model built from the real Amazon.in pack photos.`;
  chips(); side(); cost(); skus(); globeData();
  ctl.autoRotate = !reduced;
  loadModel(p).catch(e => { console.error(e); toast("Model failed to load"); });
  history.replaceState(null, "", `#${id}`);
}
size(); initGlobe();
const [h0, h1] = location.hash.slice(1).split("/");
pick(h0 || P.items[0].id);
if (h1) selectPart(h1);
window.__pt = { S, parts: () => Object.keys(parts) };
