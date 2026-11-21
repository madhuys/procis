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
const S = { pid: null, part: null, open: null, exploded: false, node: null, rt: null };
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
let tw = null, ctw = null;
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
  if (tw) { const a = Math.min(1, (t - tw.t0) / tw.d), e = a < .5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2; Object.entries(parts).forEach(([k, v]) => v.node.position.lerpVectors(tw.from[k], tw.to[k], e)); if (a >= 1) { const f = tw.after; tw = null; f && f(); } }
  if (ctw) { const a = Math.min(1, (t - ctw.t0) / ctw.d), e = 1 - Math.pow(1 - a, 3); cam.position.lerpVectors(ctw.fp, ctw.to.p, e); ctl.target.lerpVectors(ctw.ft, ctw.to.t, e); if (a >= 1) ctw = null; }
  ctl.update(); renderer.render(scene, cam);
})(0);
$("#b-asm").onclick = () => setExplode(false);
$("#b-exp").onclick = () => setExplode(true);
$("#b-reset").onclick = () => { if (!home) return; cam.position.copy(home.p); ctl.target.copy(home.t); ctl.update(); };
function setExplode(v) { S.exploded = v; $("#b-asm").setAttribute("aria-pressed", !v); $("#b-exp").setAttribute("aria-pressed", v); applyExplode(); if (!tw) refit(); else tw.after = refit; }
/* keep the whole (exploded) pack in view: move the camera along its current direction until the box fits */

function refit() {
  if (!root) return;
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), r = box.getBoundingSphere(new THREE.Sphere()).radius;
  const fov = THREE.MathUtils.degToRad(cam.fov) / 2, fit = r / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * cam.aspect))) * 1.08;
  const dir = cam.position.clone().sub(ctl.target).normalize();
  const to = { p: c.clone().add(dir.multiplyScalar(fit)), t: c.clone() };
  if (reduced) { cam.position.copy(to.p); ctl.target.copy(to.t); ctl.update(); return; }
  ctw = { t0: performance.now(), d: 600, fp: cam.position.clone(), ft: ctl.target.clone(), to };
}

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
  const p = prod();
  if (p.deep && (i.heads || []).length) {
    const G = p.graph, rs = new Set(), q = [...i.heads];
    while (q.length) { const x = q.pop(); if (rs.has(x) || !G[x]) continue; rs.add(x); q.push(...G[x].inputs); }
    const roots = [...rs].filter(x => G[x].kind === "root").map(x => G[x]);
    h += `<p class="xs" style="margin:0 0 8px">Traced through ${rs.size - roots.length} steps to ${roots.length} natural origin${roots.length === 1 ? "" : "s"}: ${roots.slice(0, 6).map(r => `<b>${esc((ROOT[r.rootType] || [r.rootType])[0])}</b> ${esc((r.players[0] || {}).site || r.stage || "")}`).join("; ")}${roots.length > 6 ? "…" : ""} <button class="pt-trlink" data-go="flow">See the trace ↓</button></p>`;
  }
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
  if (e.target.closest("[data-go=flow]")) { $(".pt-trace").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); return; }
  const r = e.target.closest("tr.it"); if (!r) return;
  S.open = S.open === r.dataset.id ? null : r.dataset.id; S.node = null; S.rt = null; stopPlay(); side(); trace(); globeData();
});
$("#side").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.it")) { e.preventDefault(); e.target.click(); } });

/* ---------- trace graph: pack <- tier 1 <- ... <- natural roots ---------- */
const ROOT = { oil_field: ["Oil field", "#B58CFF"], gas_field: ["Gas field", "#7FB2FF"], mine: ["Mine", "#E0A060"], quarry: ["Quarry", "#CDBB98"], plantation: ["Plantation", "#6FCF8E"], farm: ["Farm", "#B5DC6E"], forest: ["Forest", "#3FB06A"], fishery: ["Fishery", "#5CC8D0"], salt_pan: ["Salt pan", "#EDE7DA"], air_water: ["Air and water", "#9FD3F5"] };
const DEPTH_COL = ["#FF4F1F", "#FF8A3D", "#F2C14E", "#D7D36A", "#9FD3A8", "#8EC5FF", "#A9A2FF", "#C99BFF"];
const ncol = n => n.kind === "root" && ROOT[n.rootType] ? ROOT[n.rootType][1] : DEPTH_COL[Math.min((n._d || 1), DEPTH_COL.length - 1)];
const located = n => (n.players || []).filter(x => x.lat != null && x.lon != null);
function viewItems() { const p = prod(); return S.open ? p.bom.filter(i => i.id === S.open) : S.part ? itemsOf(p, S.part) : p.bom; }
/* the sub-graph seen now: BOM lines (column 0) and every node upstream of them, depth = longest path */
function viewGraph() {
  const p = prod(), G = p.graph, its = viewItems().filter(i => (i.heads || []).length);
  const depth = {}, cons = {};
  const visit = (id, d, from, guard) => {
    const n = G[id]; if (!n || guard.has(id)) return;
    (cons[id] = cons[id] || new Set()).add(from);
    if ((depth[id] || 0) >= d) return; depth[id] = d;
    const g2 = new Set(guard); g2.add(id);
    n.inputs.forEach(x => visit(x, d + 1, id, g2));
  };
  its.forEach(i => i.heads.forEach(h => visit(h, 1, "bom:" + i.id, new Set())));
  const ids = Object.keys(depth);
  const maxD = Math.max(1, ...ids.filter(id => G[id].kind !== "root").map(id => depth[id]));
  const rootD = maxD + 1;
  ids.forEach(id => { G[id]._d = G[id].kind === "root" ? rootD : depth[id]; });
  return { its, ids, cons, rootD };
}
function lineage(id, cons) {   // everything upstream and downstream of a node
  const G = prod().graph, up = new Set(), down = new Set();
  const u = x => { if (up.has(x)) return; up.add(x); (G[x] ? G[x].inputs : prod().bom.find(i => "bom:" + i.id === x)?.heads || []).forEach(u); };
  const d = x => { if (down.has(x)) return; down.add(x); (cons[x] || []).forEach(d); };
  u(id); d(id); return new Set([...up, ...down]);
}
let VG = null;
function trace(animate = true) {
  const p = prod(), G = p.graph; VG = viewGraph();
  const { its, ids, cons, rootD } = VG;
  // columns: rootD (earth, left) ... 1, then 0 = the BOM lines (right)
  const cols = {}; ids.forEach(id => (cols[G[id]._d] = cols[G[id]._d] || []).push(id));
  const order = { 0: its.slice().sort((a, b) => (b.cost || 0) - (a.cost || 0)).map(i => "bom:" + i.id) };
  const pos = {}; order[0].forEach((k, i) => pos[k] = i);
  for (let d = 1; d <= rootD; d++) {
    const c = cols[d] || [];
    const key = id => { const cs = [...(cons[id] || [])].map(x => pos[x]).filter(v => v != null); return cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : 999; };
    c.sort((a, b) => key(a) - key(b) || String(G[a].rootType).localeCompare(String(G[b].rootType)));
    order[d] = c; c.forEach((k, i) => pos[k] = i * (order[0].length / Math.max(1, c.length)));
  }
  const roots = ids.filter(id => G[id].kind === "root");
  const countries = new Set(), sites = new Set();
  ids.forEach(id => G[id].players.forEach(x => { if (x.country) countries.add(String(x.country).toUpperCase()); if (x.lat != null) sites.add(x.name + x.lat); }));
  const deepest = Math.max(0, ...ids.map(id => G[id]._d));
  const scope = S.open ? "One BOM line: " + (p.bom.find(i => i.id === S.open) || {}).item : S.part ? "Part: " + (S.part === "_none" ? "process and shipper" : PART_LABEL[S.part] || S.part) : "The whole pack, every BOM line";
  $("#t-scope").textContent = scope + (p.deep ? "" : " · chains as first researched, not yet traced to the natural resource");
  $("#t-stats").innerHTML = [[roots.length, "natural origins"], [countries.size || "—", "countries"], [sites.size, "sites on the map"], [deepest, "steps, deepest chain"]].map(([v, l]) => `<div class="pt-stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  const byT = {}; roots.forEach(id => byT[G[id].rootType] = (byT[G[id].rootType] || 0) + 1);
  $("#t-rtypes").innerHTML = Object.entries(byT).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<button class="pt-rt" data-rt="${esc(t)}" aria-pressed="${S.rt === t}" style="--rc:${(ROOT[t] || ["", "#8EC5FF"])[1]}"><i></i>${esc((ROOT[t] || [t])[0])}<b>${n}</b></button>`).join("");
  $("#t-sum").textContent = !S.part && !S.open && p.rootsSummary ? p.rootsSummary : "";
  const card = id => {
    if (id.startsWith("bom:")) { const i = p.bom.find(x => "bom:" + x.id === id); return `<button class="pt-node pack" data-id="${esc(id)}" style="--nc:#FF4F1F;--dl:${animate ? (rootD + 1) * 120 : 0}ms"><span class="s">${esc(i.item)}</span><span class="m">${esc(PART_LABEL[i.part3d] || (i.part3d ? i.part3d : "process"))} · ${inr(i.cost)}</span></button>`; }
    const n = G[id], pl = n.players[0], rt = n.kind === "root" ? (ROOT[n.rootType] || [n.rootType])[0] : "";
    const dl = animate ? (rootD - n._d) * 120 : 0;
    return `<button class="pt-node${n.kind === "root" ? " root" : ""}" data-id="${esc(id)}" style="--nc:${ncol(n)};--dl:${dl}ms">${rt ? `<span class="rt">${esc(rt)}</span>` : ""}<span class="s">${esc(n.stage || n.material || "")}</span>${n.material && n.stage ? `<span class="m">${esc(n.material)}</span>` : ""}${pl ? `<span class="w" title="${esc(pl.name)}">${esc(pl.site || pl.name)}${n.players.length > 1 ? " +" + (n.players.length - 1) : ""}</span>` : ""}</button>`;
  };
  const head = d => d === 0 ? "HUL pack (BOM line)" : d === rootD ? "Natural origin" : d === 1 ? "Tier 1 · supplies HUL" : "Tier " + d;
  let h = "";
  for (let d = rootD; d >= 0; d--) if ((order[d] || []).length) h += `<div class="pt-col"><h3>${head(d)}</h3>${order[d].map(card).join("")}</div>`;
  const fl = $("#flow"); fl.classList.toggle("anim", animate && !reduced);
  $("#cols").innerHTML = ids.length ? h : `<p class="muted small" style="padding:16px">No chain recorded for this selection.</p>`;
  requestAnimationFrame(() => { edges(animate); if (innerWidth < 980) fl.scrollLeft = fl.scrollWidth; });
  markLineage();
  nodeDetail();
}
function edges(animate) {
  if (!VG) return;
  const G = prod().graph, wrap = $("#flow-in"), r0 = wrap.getBoundingClientRect(), svg = $("#edges");
  svg.setAttribute("width", wrap.scrollWidth); svg.setAttribute("height", wrap.scrollHeight);
  const el = {}; $$(".pt-node", wrap).forEach(b => el[b.dataset.id] = b.getBoundingClientRect());
  const P2 = [];
  const add = (from, to, col, dl) => { const a = el[from], b = el[to]; if (!a || !b) return;
    const x1 = a.right - r0.left, y1 = a.top + a.height / 2 - r0.top, x2 = b.left - r0.left, y2 = b.top + b.height / 2 - r0.top, mx = (x1 + x2) / 2;
    const len = Math.round(Math.hypot(x2 - x1, y2 - y1) * 1.25);
    P2.push(`<path data-a="${esc(from)}" data-b="${esc(to)}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${col}" style="--len:${len};--dl:${dl}ms"/>`); };
  VG.ids.forEach(id => { const n = G[id]; (VG.cons[id] || []).forEach(c => add(id, c, ncol(n), (VG.rootD - n._d) * 120 + 200)); });
  svg.innerHTML = P2.join("");
  svg.classList.toggle("draw", !!animate && !reduced);
  markLineage();
}
function markLineage() {
  if (!VG) return;
  const G = prod().graph;
  let on = null;
  if (S.node && (G[S.node] || S.node.startsWith("bom:"))) on = lineage(S.node, VG.cons);
  else if (S.rt) { on = new Set(); VG.ids.filter(id => G[id].rootType === S.rt).forEach(id => lineage(id, VG.cons).forEach(x => on.add(x))); }
  $$("#cols .pt-node").forEach(b => { const k = b.dataset.id; b.classList.toggle("off", !!on && !on.has(k)); b.classList.toggle("on", !!on && on.has(k)); b.classList.toggle("sel", k === S.node); });
  $$("#edges path").forEach(pth => { const x = on && on.has(pth.dataset.a) && on.has(pth.dataset.b); pth.classList.toggle("on", !!x); pth.classList.toggle("off", !!on && !x); });
  $("#b-clear").hidden = !(S.node || S.rt);
}
function nodeDetail() {
  const p = prod(), G = p.graph, id = S.node, el = $("#t-node");
  if (!id) { el.innerHTML = ""; return; }
  if (id.startsWith("bom:")) { const i = p.bom.find(x => "bom:" + x.id === id); el.innerHTML = i ? `<div class="pt-nd" style="--nc:#FF4F1F"><h3>${esc(i.item)}</h3><p class="xs muted">${esc(i.material || "")} · ${num(i.qty)} ${esc(i.unit || "")} per pack · ${inr(i.cost)}</p></div>` : ""; return; }
  const n = G[id]; if (!n) { el.innerHTML = ""; return; }
  const name = x => G[x] ? (G[x].stage || G[x].material) : (p.bom.find(i => "bom:" + i.id === x) || {}).item;
  const feeds = [...(VG.cons[id] || [])].map(name).filter(Boolean);
  el.innerHTML = `<div class="pt-nd" style="--nc:${ncol(n)}"><p class="lbl">${n.kind === "root" ? "Natural origin · " + esc((ROOT[n.rootType] || [n.rootType])[0]) : "Process step"}</p>
    <h3>${esc(n.stage || "")}</h3>${n.material ? `<p class="xs muted" style="margin:0">Output: ${esc(n.material)}${n.share != null ? " · " + esc(n.share) : ""}</p>` : ""}
    ${n.players.map(x => `<p class="pl"><b>${esc(x.name)}</b> <span class="site">${esc([x.site, x.country].filter(Boolean).join(", "))}${x.capacity ? " · " + esc(x.capacity) : ""}</span>${x.link ? `<span class="pt-link ${esc(x.link)}">${esc(x.link)}</span>` : ""} ${srcA(x.src)}${x.lat == null ? ` <span class="xs faint">no site on the map</span>` : ""}</p>`).join("")}
    ${n.inputs.length ? `<p class="flow2">Made from: ${n.inputs.map(x => esc(name(x))).join(" · ")}</p>` : ""}
    ${feeds.length ? `<p class="flow2">Goes into: ${feeds.map(esc).join(" · ")}</p>` : ""}
    ${n.risk ? `<p class="flow2"><b style="color:var(--warn)">Risk:</b> ${esc(n.risk)}</p>` : ""}${n.note ? `<p class="flow2">${esc(n.note)}</p>` : ""}${n.src ? `<p class="flow2">Source: ${srcA(n.src)}</p>` : ""}</div>`;
}
function selectNode(id, fly = true) {
  S.node = S.node === id ? null : id; S.rt = null;
  $$("#t-rtypes .pt-rt").forEach(b => b.setAttribute("aria-pressed", "false"));
  markLineage(); nodeDetail(); globeData(fly);
}
$("#cols").addEventListener("click", e => { const b = e.target.closest(".pt-node"); if (b) { stopPlay(); selectNode(b.dataset.id); } });
$("#t-rtypes").addEventListener("click", e => { const b = e.target.closest(".pt-rt"); if (!b) return; stopPlay(); S.rt = S.rt === b.dataset.rt ? null : b.dataset.rt; S.node = null; $$("#t-rtypes .pt-rt").forEach(x => x.setAttribute("aria-pressed", x.dataset.rt === S.rt)); markLineage(); nodeDetail(); globeData(true); });
$("#b-clear").onclick = () => { stopPlay(); S.node = null; S.rt = null; trace(false); globeData(true); };
new ResizeObserver(() => edges(false)).observe($("#flow"));
/* Play: walk the costliest line from its natural origin to the pack, flying the globe stop by stop */
let play = null;
function stopPlay() { if (play) { clearTimeout(play.t); play = null; $("#b-play").textContent = "▶ Play the trace"; } }
$("#b-play").onclick = () => {
  if (play) return stopPlay();
  const p = prod(), G = p.graph, its = viewItems().filter(i => i.heads && i.heads.length).sort((a, b) => (b.cost || 0) - (a.cost || 0));
  if (!its.length) return toast("Nothing to trace here");
  // the deepest located path from the line's heads
  let best = [];
  const walk = (id, path, seen) => { if (seen.has(id) || !G[id]) return; const pa = [...path, id]; const ins = G[id].inputs.filter(x => G[x]); if (!ins.length) { const sc = pa.filter(x => located(G[x]).length).length * 10 + pa.length; if (sc > (best.sc || 0)) { best = pa; best.sc = sc; } return; } const s2 = new Set(seen); s2.add(id); ins.forEach(x => walk(x, pa, s2)); };
  its[0].heads.forEach(h => walk(h, [], new Set()));
  const steps = [...best].reverse().concat("bom:" + its[0].id);
  $("#b-play").textContent = "■ Stop";
  $("#flow").scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
  play = { i: 0 };
  const step = () => {
    if (!play) return;
    const id = steps[play.i]; S.node = null; selectNode(id, false);
    const n = G[id], loc = n ? located(n)[0] : null;
    if (globe && loc) globe.pointOfView({ lat: loc.lat, lng: loc.lon, altitude: .75 }, reduced ? 0 : 1400);
    const b = $(`#cols .pt-node[data-id="${CSS.escape(id)}"]`); if (b) b.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "center" });
    play.i++;
    if (play.i < steps.length) play.t = setTimeout(step, 2300); else { play.t = setTimeout(() => { stopPlay(); globeData(true); }, 2600); }
  };
  step();
};

/* ---------- globe ---------- */
let globe = null, GEO = null;
const gEl = $("#pglobe");
function initGlobe() {
  const ok = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  if (!ok || typeof Globe !== "function") { gEl.innerHTML = `<p class="muted small" style="padding:16px">The globe needs WebGL.</p>`; return; }
  globe = Globe({ animateIn: !reduced })(gEl)
    .backgroundColor("rgba(0,0,0,0)").showAtmosphere(true).atmosphereColor("#FF4F1F").atmosphereAltitude(.12).showGraticules(true)
    .polygonCapColor(() => "rgba(42,48,60,.95)").polygonSideColor(() => "rgba(255,79,31,.06)").polygonStrokeColor(() => "rgba(242,238,230,.10)").polygonAltitude(.004)
    .pointLat("lat").pointLng("lon").pointAltitude(d => d.root ? .035 : .02).pointRadius(d => d.sel ? .6 : d.root ? .45 : .34).pointColor("col").pointsMerge(false)
    .pointLabel(d => `<div style="font:11.5px Geist,sans-serif;background:#12151C;border:1px solid rgba(242,238,230,.22);padding:6px 9px;border-radius:5px;color:#F2EEE6;max-width:280px;white-space:normal"><b>${esc(d.name)}</b><br>${esc(d.site || "")}${d.capacity ? " · " + esc(d.capacity) : ""}<br><span style="color:${d.col}">${esc(d.what)}</span></div>`)
    .onPointClick(d => { stopPlay(); S.node = null; selectNode(d.nid, false); const b = $(`#cols .pt-node[data-id="${CSS.escape(d.nid)}"]`); if (b) b.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); })
    .arcStartLat(d => d.a.lat).arcStartLng(d => d.a.lon).arcEndLat(d => d.b.lat).arcEndLng(d => d.b.lon)
    .arcColor(d => [d.a.col + "44", d.b.col]).arcStroke(d => d.on ? .6 : .3).arcAltitudeAutoScale(.4)
    .arcDashLength(.45).arcDashGap(.15).arcDashAnimateTime(reduced ? 0 : 2200)
    .ringLat("lat").ringLng("lon").ringColor(d => t => d.col + Math.round((1 - t) * 255).toString(16).padStart(2, "0")).ringMaxRadius(3.2).ringPropagationSpeed(2.2).ringRepeatPeriod(1100);
  const m = globe.globeMaterial(); m.color && m.color.set("#0f131b"); if (m.emissive) m.emissive.set("#0b0e14");
  globe.controls().autoRotate = false;
  globe.width(gEl.clientWidth).height(gEl.clientHeight);
  fetch("data/countries.json").then(r => r.json()).then(g => { GEO = g; globe.polygonsData(g.features.filter(f => f.properties.iso !== "ATA")); }).catch(() => {});
  new ResizeObserver(() => globe.width(gEl.clientWidth).height(gEl.clientHeight)).observe(gEl);
}
function globeData(fly = true) {
  const p = prod(); if (!VG) return;
  const G = p.graph;
  let on = null;
  if (S.node) on = lineage(S.node, VG.cons); else if (S.rt) { on = new Set(); VG.ids.filter(id => G[id].rootType === S.rt).forEach(id => lineage(id, VG.cons).forEach(x => on.add(x))); }
  const ids = VG.ids.filter(id => !on || on.has(id));
  const pts = [], arcs = [], at = {};
  ids.forEach(id => { const n = G[id]; at[id] = [];
    located(n).forEach(x => { const d = { ...x, nid: id, col: ncol(n), root: n.kind === "root", sel: id === S.node, what: (n.kind === "root" ? (ROOT[n.rootType] || [n.rootType])[0] + ": " : "Tier " + n._d + ": ") + (n.stage || n.material || "") }; pts.push(d); at[id].push(d); }); });
  // an edge input -> consumer; a consumer with no site passes the arc on to its own nearest located consumer
  const target = (id, seen = new Set()) => { if (seen.has(id)) return []; seen.add(id); if (at[id] && at[id].length) return [at[id][0]]; return [...(VG.cons[id] || [])].filter(c => !on || on.has(c)).flatMap(c => target(c, seen)); };
  ids.forEach(id => (at[id] || []).forEach(a => [...(VG.cons[id] || [])].filter(c => !on || on.has(c)).forEach(c => target(c).forEach(b => { if (a.lat !== b.lat || a.lon !== b.lon) arcs.push({ a, b, on: !!on }); }))));
  const nPl = ids.reduce((s, id) => s + G[id].players.length, 0);
  $("#g-title").textContent = S.node ? "Lineage: " + (G[S.node] ? G[S.node].stage : (p.bom.find(i => "bom:" + i.id === S.node) || {}).item) : S.open ? "Chain: " + (p.bom.find(i => i.id === S.open) || {}).item : S.part ? "Chain: " + (S.part === "_none" ? "process and shipper" : PART_LABEL[S.part] || S.part) : "Supply chain: " + p.short;
  $("#g-count").textContent = `${pts.length} of ${nPl} sites placed`;
  const rts = [...new Set(ids.filter(id => G[id].kind === "root").map(id => G[id].rootType))];
  $("#g-legend").innerHTML = rts.map(t => `<span><i style="background:${(ROOT[t] || ["", "#8EC5FF"])[1]}"></i>${esc((ROOT[t] || [t])[0])}</span>`).join("") + `<span><i style="background:#F2C14E"></i>Processing</span><span><i style="background:#FF4F1F"></i>Tier 1 supplier</span><span class="faint">Arcs run with the material, from the ground towards HUL. Players without a known site are in the trace, not on the map.</span>`;
  if (!globe) return;
  globe.pointsData(pts).arcsData(arcs.slice(0, 600)).ringsData(reduced ? [] : pts.filter(d => d.root || d.sel).slice(0, 60));
  if (fly && pts.length) { const la = pts.reduce((s, d) => s + d.lat, 0) / pts.length, lo = pts.reduce((s, d) => s + d.lon, 0) / pts.length; const spread = Math.max(...pts.map(d => Math.hypot(d.lat - la, d.lon - lo))); globe.pointOfView({ lat: la, lng: lo, altitude: spread > 60 ? 2.4 : spread > 20 ? 1.7 : 1.0 }, reduced ? 0 : 900); }
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
  if (p.id === "kissan-ketchup" && !/200\s*g/.test(p.ref.size || "")) list.push(`<b>Pack mismatch.</b> The BOM is costed for the 1 kg squeeze bottle; the 3D model is the 200 g glass bottle.`);
  (p.unsure || []).forEach(u => list.push(esc(typeof u === "string" ? u : u.claim || u.what || JSON.stringify(u))));
  (p.weakest || []).slice(0, 6).forEach(u => list.push(`<b>Weak estimate:</b> ${esc(typeof u === "string" ? u : u.item || JSON.stringify(u))}`));
  (p.skuUnsure || []).forEach(u => list.push(`<b>SKU:</b> ${esc(typeof u === "string" ? u : JSON.stringify(u))}`));
  if (p.cost.notes) list.push(`<b>Basis:</b> ${esc(p.cost.notes)}`);
  $("#caveats").innerHTML = `<ul class="pt-cav">${list.map(x => `<li>${x}</li>`).join("")}</ul>`;
}

/* ---------- selection ---------- */
function selectPart(k, keepOpen) {
  S.part = k || null; if (!keepOpen) S.open = null; S.node = null; S.rt = null; stopPlay();
  chips(); side(); trace(); globeData(); highlight(hoverPart);
  history.replaceState(null, "", `#${S.pid}${S.part ? "/" + S.part : ""}`);
}
function pick(id) {
  if (!P.items.some(p => p.id === id)) id = P.items[0].id;
  S.pid = id; S.part = null; S.open = null; S.node = null; S.rt = null; stopPlay();
  $$(".pt-tab").forEach(b => b.setAttribute("aria-selected", b.dataset.id === id));
  const p = prod();
  $("#vnote").textContent = `Size ${p.dims ? `${p.dims.w} × ${p.dims.h} × ${p.dims.d} cm` : "—"} (${p.dimsSrc || ""}). Model built from the real Amazon.in pack photos.`;
  chips(); side(); cost(); skus(); trace(); globeData();
  ctl.autoRotate = !reduced;
  loadModel(p).catch(e => { console.error(e); toast("Model failed to load"); });
  history.replaceState(null, "", `#${id}`);
}
size(); initGlobe();
const [h0, h1] = location.hash.slice(1).split("/");
pick(h0 || P.items[0].id);
if (h1) selectPart(h1);
addEventListener("hashchange", () => {
  const [a, b] = location.hash.slice(1).split("/");
  if (a && a !== S.pid) pick(a);
  if (b && b !== S.part) selectPart(b);
});
window.__pt = { S, parts: () => Object.keys(parts), VG: () => VG, cam, ctl, root: () => root, THREE, refit };
