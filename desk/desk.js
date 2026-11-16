/* Procis Commodity Desk — all client-side. Data: data/wheat.js (window.DESK), data/prices.json, data/countries.json */
(() => {
"use strict";
const D = window.DESK;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f0 = v => v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("en-GB");
const f1 = v => v == null || isNaN(v) ? "—" : (+v).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = v => v == null || isNaN(v) ? "—" : (+v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v, d = 1) => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(d) + "%";
const sgn = (v, f = f1) => (v > 0 ? "+" : v < 0 ? "−" : "±") + f(Math.abs(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CMD = D.id || "wheat";
const BU = 0.0272155; // t per bushel of wheat
const cbu2t = c => c / 100 / BU;
const eur2usd = e => e * D.fx.eurusd;
const FXC = { usd: v => v, eur: v => v * D.fx.eurusd, cbu: cbu2t, myr: v => v / D.fx.usdmyr, cny: v => v / D.fx.usdcny, clb: v => v * 22.0462 };
const toUSD = (cv, v) => (FXC[cv || "usd"])(v);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NOWM = +D.asOf.slice(5, 7); // 11
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const byId = Object.fromEntries(D.countries.map(c => [c.id, c]));
const catBy = Object.fromEntries(D.cats.map(c => [c.id, c]));
D.news.forEach((n, i) => n.id = "n" + n.d.replace(/-/g, "") + "-" + i);
D.news.sort((a, b) => b.d.localeCompare(a.d));

/* ---------- state ---------- */
const KEY = CMD === "wheat" ? "procis-desk-v1" : "procis-desk-v1-" + CMD;
const S = Object.assign({ stars: { c: [], n: [], i: [] }, alerts: [], fired: [] }, JSON.parse(localStorage.getItem(KEY) || "{}"));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const isStar = (k, id) => S.stars[k].includes(id);
function toggleStar(k, id) {
  const a = S.stars[k]; const i = a.indexOf(id);
  i >= 0 ? a.splice(i, 1) : a.push(id); save(); updateCounts();
  $$(`.star[data-k="${k}"][data-id="${id}"]`).forEach(b => b.setAttribute("aria-pressed", isStar(k, id)));
  toast(i >= 0 ? "Removed from watchlist" : "Added to watchlist");
  if (cur === "watch") renderWatch();
}
const starBtn = (k, id, label) => `<button class="star" data-k="${k}" data-id="${esc(id)}" aria-pressed="${isStar(k, id)}" aria-label="Star ${esc(label)}" title="Add to watchlist">★</button>`;
document.addEventListener("click", e => {
  const b = e.target.closest(".star"); if (b) { e.stopPropagation(); toggleStar(b.dataset.k, b.dataset.id); return; }
  const g = e.target.closest("[data-go]"); if (g) { go(g.dataset.go); if (g.dataset.focus) setTimeout(() => focusCountry(g.dataset.focus), 50); }
});
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2600); }

/* ---------- derived figures ---------- */
const B = Object.fromEntries(D.benchmarks.map(b => [b.id, b]));
D.benchmarks.forEach(b => b.usd = toUSD(b.conv, b.px));
const W = D.world;
const STU0 = W.stocksUSDA / W.consumption[2];
const CB = B[D.curveBench || "cbot"];
const curve = CB.curve.map(([m, c]) => ({ m, c, t: toUSD(CB.conv, c) }));
const CI = D.carryIdx || [0, 2];
const carry = curve[CI[1]].c / curve[CI[0]].c - 1; // wheat: Dec->May
const RISK = D.risk;
const RISKIDX = Math.round(RISK.reduce((s, r) => s + r.v * r.w, 0));

/* ---------- prices ---------- */
let P = null, GEO = null;
const YR = W.years;

/* ---------- commodity profiles: everything a commodity says in its own words ---------- */
const PF = {};
PF.wheat = () => ({
  noun: "wheat", hex: "#E8B85C", rgb: "232,184,92", base: "hrw", volK: "srw", mdK: "hrw", expMin: 10,
  calA: "Harvest", calB: "Sowing",
  ticker: () => { const hrw = ser("hrw").at(-1); return [
    `<span><b>CBOT</b> <span class="px">$${f1(B.cbot.usd)}</span> <span class="chg muted">${f2(B.cbot.px)}c</span></span>`,
    `<span><b>MATIF</b> <span class="px">€${f1(B.matif.px)}</span> <span class="chg muted">$${f0(B.matif.usd)}</span></span>`,
    `<span class="hide-m"><b>KC HRW</b> <span class="px">$${f1(B.kc.usd)}</span></span>`,
    `<span class="hide-m"><b>US Gulf</b> <span class="px">$${f0(hrw[1])}</span> <span class="muted">${hrw[0]}</span></span>`,
    `<span class="hide-m"><b>BDI</b> <span class="px">${f0(D.freight.bdi)}</span></span>`]; },
  lede: () => { const p26 = W.production[2], p25 = W.production[1]; return `The world grows ${p26} Mt this season, down ${f1((1 - p26 / p25) * 100)}%, yet stocks are comfortable and Chicago sits near four-month lows. The risk is in moving the grain, not growing it: Black Sea ports and the Red Sea are where a bearish market can turn.`; },
  kpis: () => [
    { l: "CBOT Dec 26", f: `$${f1(B.cbot.usd)}`, s: `${f2(B.cbot.px)} c/bu · ${B.cbot.chg.toLowerCase()}` },
    { l: "MATIF Dec 26", f: `$${f1(B.matif.usd)}`, s: `€${f1(B.matif.px)}/t · +$${f0(B.matif.usd - B.cbot.usd)} over Chicago` },
    { l: "Stocks-to-use", f: (STU0 * 100).toFixed(1) + "%", s: `USDA ${W.stocksUSDA} Mt ÷ ${W.consumption[2]} Mt use` },
    { l: "World trade 26/27", f: `${W.trade[2]} Mt`, s: `${pct(W.trade[2] / W.trade[1] - 1)} on 25/26` },
    { l: "Desk risk index", f: `${RISKIDX}<span class="xs muted">/100</span>`, s: `Logistics-led · <span class="faint">desk</span>`, g: RISKIDX },
    { l: "Desk call", f: `Bearish`, s: `$200-250/t range into Q1; upside tails`, call: 1 }],
  callTag: "Bearish near term",
  call: () => [
    ["View", `Range-bound to lower, roughly $200-250/t through year-end; support near 580 c/bu, resistance near 600 c/bu (market pack, 16 Nov).`],
    ["Why", `Stocks raised to ${W.stocksUSDA} Mt; Argentine and Australian harvests landing; firm dollar; US exports at 750 Mbu.`],
    ["Tails", `<span class="bull">Up:</span> Black Sea breakdown, China buying US wheat, Russian duty change on 31 Dec, El Niño. <span class="bear">Down:</span> a Black Sea corridor deal.`],
    ["Do", `Layer Q1-Q2 2027 cover now while the curve pays carry (Dec→May ${pct(carry)}); hold an option layer on Black Sea-origin volume.`]],
  balNote: () => `Stocks: USDA ${W.stocksUSDA} Mt (Nov WASDE); FAO-AMIS ${W.stocksFAO} Mt, of which about ${W.chinaStocks} Mt in China. ${esc(W.note)}`,
  ovPrice: () => [{ k: "hrw", name: "US HRW", color: "#E8B85C" }, { k: "srw", name: "US SRW", color: "#8EC5FF" }], ovAria: "US wheat export prices",
  mk: [["hrw", "#E8B85C"], ["srw", "#F2EEE6"], ["maize", "#9FD3A8"], ["soy", "#C9A7FF"], ["rice", "#8EC5FF"], ["urea", "#FF4F1F"], ["dap", "#F2C14E"], ["brent", "#FF6B57"], ["gas", "#6FA8DC"]],
  mkSel: ["hrw", "srw", "maize"],
  mkKpis: () => { const hrw = ser("hrw"); return [
    { l: "CBOT SRW Dec", f: `$${f1(B.cbot.usd)}`, s: `${f2(B.cbot.px)} c/bu · ${B.cbot.date.slice(5)}` },
    { l: "KC HRW Dec", f: `$${f1(B.kc.usd)}`, s: `${f0(B.kc.px)} c/bu · ${B.kc.date.slice(5)}` },
    { l: "MATIF Dec", f: `$${f1(B.matif.usd)}`, s: `€${f1(B.matif.px)}/t at ${D.fx.eurusd}` },
    { l: "KC over Chicago", f: `+$${f1(B.kc.usd - B.cbot.usd)}`, s: `protein premium, $/t` },
    { l: "Paris over Chicago", f: `+$${f1(B.matif.usd - B.cbot.usd)}`, s: `EU origin premium, $/t` },
    { l: "US Gulf HRW", f: `$${f0(hrw.at(-1)[1])}`, s: `${hrw.at(-1)[0]} average · ${pct(hrw.at(-1)[1] / hrw.at(-13)[1] - 1, 0)} y/y` }]; },
  mkNote: "Monthly averages, World Bank Pink Sheet, to Oct 2026. Fertiliser and energy are wheat's main cost drivers; maize is its feed substitute.",
  curveTip: v => `${f2(v)}c · $${f1(cbu2t(v))}/t`,
  curveNote: () => `Contango: May 27 is ${pct(carry)} over Dec, about $${f1(curve[2].t - curve[0].t)}/t of carry. The market is paid to store, which is what a well-supplied market looks like.`,
  physCur: "€/t", physVs: "cbot", physVsName: "CBOT",
  lgKpis: () => [
    { l: "Baltic Dry Index", f: f0(D.freight.bdi), s: `${D.freight.date.slice(5)} · after a seven-session run` },
    { l: "Panamax earnings", f: `$${f0(D.freight.panamaxDay)}`, s: `per day · index ${f0(D.freight.panamax)}` },
    { l: "Black Sea capacity hit", f: "~97%", s: "shut by mid-Aug (Azov-Black Sea)" },
    { l: "Russia seaborne, Oct", f: "−55.8%", s: "year on year" },
    { l: "Suez traffic", f: "−50%", s: "year on year" },
    { l: "Panama transits", f: "−32%", s: "year on year" }],
  shocks: [
    { id: "bs", n: "Black Sea shipping halt", u: "%", min: 0, max: 100, st: 5, def: 40, why: "Share of about 40.5 Mt of Black Sea seaborne exports (Ukraine 12.5 Mt plus 70% of Russia's 40 Mt) that can't move.", eff: v => -v / 100 * 40.5 },
    { id: "ru", n: "Russia restricts exports (duty or quota)", u: "Mt", min: 0, max: 15, st: .5, def: 5, why: "The duty suspension ends 31 Dec 2026; a reinstated duty or quota holds grain at home.", eff: v => -v },
    { id: "corr", n: "Black Sea corridor deal", u: "Mt", min: 0, max: 8, st: .5, def: 4, why: "Releases part of Ukraine's 11.8 Mt of stranded stocks. Bearish.", eff: v => +v },
    { id: "in", n: "India heatwave in Mar-Apr", u: "Mt", min: 0, max: 15, st: .5, def: 6, why: "A 2022-style heat shock at grain fill; India would turn from seller to buyer.", eff: v => -v },
    { id: "sh", n: "Australia & Argentina drought", u: "Mt", min: 0, max: 12, st: .5, def: 5, why: "El Niño risk to the Southern Hemisphere crop.", eff: v => -v },
    { id: "beat", n: "EU & US yield beat", u: "Mt", min: 0, max: 10, st: .5, def: 4, why: "Good spring weather adds supply. Bearish.", eff: v => +v },
    { id: "cn", n: "China returns as a buyer", u: "Mt", min: 0, max: 10, st: .5, def: 5, why: "Its stocks are not on the world market, so purchases draw on exporters' stocks.", eff: v => -v },
    { id: "red", n: "Red Sea freight premium", u: "$/t", min: 0, max: 40, st: 1, def: 12, why: "Extra cost of Cape diversions on Europe & Black Sea to Asia lanes; added to delivered price.", add: v => v },
    { id: "oil", n: "Brent crude", u: "$/bbl", min: 60, max: 150, st: 1, def: 110, base: 92.14, why: "From $92 (11 Nov). Pass-through of $0.25/t per $1/bbl via fuel, freight and fertiliser: an assumption.", add: v => (v - 92.14) * .25 }],
  presets: [["Today", {}], ["Black Sea flare", { bs: 55, ru: 5, red: 10 }], ["Corridor deal", { corr: 6, beat: 3 }], ["El Niño bites", { sh: 7, in: 6, oil: 100 }], ["China returns", { cn: 6 }], ["Perfect storm", { bs: 70, ru: 8, sh: 8, in: 8, cn: 5, red: 25, oil: 125 }]],
  scBench: "cbot", scBenchName: "CBOT Dec", scEquiv: P => `${f0(P * BU * 100)} c/bu equivalent`,
  fan: () => [["Now", "Dec", "Jan", "Feb", "Mar", "Apr", "May"], [curve[0].t, curve[0].t, curve[0].t + (curve[1].t - curve[0].t) / 3, curve[0].t + (curve[1].t - curve[0].t) * 2 / 3, curve[1].t, (curve[1].t + curve[2].t) / 2, curve[2].t]],
  holdCheck: "the 31 Dec Russia decision",
  mdWhat: "US Gulf export", mdCaveat: "Statistical models know nothing of the Black Sea; read them with the Scenarios screen.",
  rules: (daysTo, recent) => { const srw = ser("srw").map(d => d[1]), avg5 = srw.slice(-60).reduce((s, v) => s + v, 0) / 60, last = srw.at(-1); return [
    { st: carry > .02 ? "fire" : carry > 0 ? "arm" : "calm", t: "The curve pays you to wait", tr: "Dec→May carry above 2%", now: `Carry ${pct(carry)} ($${f1(curve[2].t - curve[0].t)}/t)`, a: "Price forward months (Mar, May 27) rather than spot; let the market fund storage." },
    { st: last < avg5 * .95 ? "fire" : last < avg5 ? "arm" : "calm", t: "Below the five-year average", tr: "US SRW more than 5% under its 5y mean", now: `$${f0(last)} vs $${f0(avg5)} average (${pct(last / avg5 - 1)})`, a: "Extend cover further out; prices this low have not tended to last." },
    { st: D.chokepoints.some(c => c.status === "bad") ? "fire" : "arm", t: "Black Sea chokepoint shut", tr: "Any Black Sea chokepoint rated shut", now: "Azov-Black Sea ports severely constrained", a: "Hold a call-option or fixed-price layer on any volume tied to Black Sea origin; qualify a Canadian or EU alternative." },
    { st: daysTo("2026-12-31") <= 30 ? "fire" : daysTo("2026-12-31") <= 60 ? "arm" : "calm", t: "Russian export duty decision", tr: "Within 60 days of 31 Dec 2026", now: `${daysTo("2026-12-31")} days to go`, a: "Keep Q1 cover flexible until the regime is known; a reinstated duty lifts world prices." },
    { st: [12, 1, 2].includes(NOWM) ? "fire" : NOWM === 11 ? "arm" : "calm", t: "Southern Hemisphere harvest pressure", tr: "December to February", now: "Australian harvest under way; Argentina starting", a: "The seasonal low is usually in this window; buy into weakness, not before it." },
    { st: D.freight.bdi > 3000 ? "fire" : D.freight.bdi > 2500 ? "arm" : "calm", t: "Freight spike", tr: "Baltic Dry above 3,000 (armed at 2,500)", now: `BDI ${f0(D.freight.bdi)}`, a: "Fix CFR rather than FOB on new contracts; ask suppliers for freight-inclusive offers." },
    { st: recent > 3 ? "fire" : recent > -3 ? "arm" : "calm", t: "News turns bullish", tr: "Net news pressure over 14 days above +3", now: `Net ${recent > 0 ? "+" : ""}${recent} (${recent < 0 ? "bearish" : "bullish"})`, a: "When the flow of news turns, pull planned purchases forward." },
    { st: D.inputs.urea > 400 ? "arm" : "calm", t: "Fertiliser squeeze on next year's crop", tr: "Urea above $400/t", now: `Urea $${D.inputs.urea}/t · DAP $${D.inputs.dap}/t (DTN)`, a: "A 2027/28 risk, not this season's: note it in the FY28 budget." }]; },
  ladder: () => [["Q1 27", curve[1].t, "Mar 27"], ["Q2 27", curve[2].t, "May 27"], ["Q3 27", curve[2].t + (curve[3].t - curve[2].t) * .4, "Sep 27, interpolated"], ["Q4 27", curve[2].t + (curve[3].t - curve[2].t) * .7, "Dec 27, interpolated"]],
  cats: [
    ["2026-11-16", "Black Sea trilateral talks", "Corridor deal bearish; breakdown bullish."],
    ["2026-12-10", "USDA December WASDE (expected)", "Next official world balance sheet."],
    ["2026-12-31", "Russia's export duty suspension ends", "Extension or a new duty sets Q1 Black Sea offers."],
    ["2027-01-15", "Southern Hemisphere harvest peak (Dec-Feb)", "Seasonal supply pressure."],
    ["2027-02-01", "El Niño peak window", "Check Australia's planting outlook and India's late-season heat."],
    ["2027-03-15", "India harvest starts (Mar-May)", "First test of India's return as an exporter."]],
  alb: () => [["cbot", "CBOT SRW Dec, $/t", B.cbot.usd], ["kc", "KC HRW Dec, $/t", B.kc.usd], ["matif", "MATIF Dec, $/t", B.matif.usd], ["gulf", "US Gulf HRW, $/t", ser("hrw").at(-1)[1]]],
  alHint: "CBOT falls below $210",
  html: {}
});
PF.palm = () => {
  const sw = [["i", "rgba(142,197,255,.45)", "low season"], ["i", "var(--wheat)", "peak output"]].map(([, c, t]) => `<i style="display:inline-block;width:10px;height:10px;background:${c};vertical-align:-1px"></i> ${t} &nbsp; `).join("") + `<span style="outline:1px solid var(--ember);padding:0 3px">now</span>`;
  const pogo = () => B.cbotso.usd - B.fcpo.usd, myr = v => f0(v * D.fx.usdmyr);
  return {
  noun: "palm oil", title: "Procis Commodity Desk · Palm oil", hex: "#E0A458", rgb: "224,164,88", base: "palm", volK: "palm", mdK: "palm", expMin: 0.5,
  calA: "Peak output", calB: "Low season", elas: 1.0, coverWhere: "near months first, while Dec trades below the 2027 curve",
  ticker: () => { const wb = ser("palm").at(-1); return [
    `<span><b>FCPO</b> <span class="px">RM${f0(B.fcpo.px)}</span> <span class="chg muted">$${f0(B.fcpo.usd)}</span></span>`,
    `<span><b>CBOT soyoil</b> <span class="px">$${f0(B.cbotso.usd)}</span> <span class="chg muted">${f2(B.cbotso.px)}c/lb</span></span>`,
    `<span class="hide-m"><b>Soy over palm</b> <span class="px">+$${f0(pogo())}</span></span>`,
    `<span class="hide-m"><b>ID ref.</b> <span class="px">$${f1(B.idref.px)}</span></span>`,
    `<span class="hide-m"><b>World Bank</b> <span class="px">$${f0(wb[1])}</span> <span class="muted">${wb[0]}</span></span>`]; },
  lede: () => `Malaysia holds record stocks, so the next few weeks look calm. 2027 does not: El Niño's lag, Indonesia's new export rules and a possible B50 mandate could take ${f1(W.production[1] - W.production[2])} Mt out of supply, and the futures curve already climbs ${pct(carry)} from December to May.`,
  kpis: () => [
    { l: "Bursa FCPO Jan 27", f: `$${f0(B.fcpo.usd)}`, s: `RM${f0(B.fcpo.px)}/t at ${D.fx.usdmyr} · ${B.fcpo.date.slice(5)}` },
    { l: "Soy oil over palm", f: `+$${f0(pogo())}`, s: `CBOT soyoil $${f0(B.cbotso.usd)}/t · palm's discount` },
    { l: "Stocks-to-use", f: (STU0 * 100).toFixed(1) + "%", s: `USDA ${W.stocksUSDA} Mt ÷ ${W.consumption[2]} Mt use` },
    { l: "World trade 26/27", f: `${W.trade[2]} Mt`, s: `${pct(W.trade[2] / W.trade[1] - 1)} on 25/26` },
    { l: "Desk risk index", f: `${RISKIDX}<span class="xs muted">/100</span>`, s: `Weather & policy-led · <span class="faint">desk</span>`, g: RISKIDX },
    { l: "Desk call", f: `Bullish 2027`, s: `Neutral to year-end; tighter from Q1`, call: 1 }],
  callTag: "Neutral now, bullish 2027",
  call: () => [
    ["View", `Sideways near term, with record Malaysian stocks (3.62 Mt) against the seasonal fall in output. Firmer into 2027: the curve peaks at RM${f0(curve[3].c)} in May 27 against RM${f0(curve[0].c)} for Dec.`],
    ["Why", `USDA puts 26/27 output down ${f1(W.production[1] - W.production[2])} Mt and stocks at ${W.stocksUSDA} Mt, the lowest since 2017/18. At IPOC, Dorab Mistry expected RM4,500-5,000 to April and Thomas Mielke $1,300/t in H1 2027.`],
    ["Tails", `<span class="bull">Up:</span> El Niño worse than feared, B50 approved, Indonesian exports cut by the new routing rules, EUDR premiums. <span class="bear">Down:</span> Hormuz reopens and crude falls, Malaysian stocks stay high, India switches to soy and sunflower oil.`],
    ["Do", `Price Q1 now while Dec trades ${pct(curve[0].t / curve[2].t - 1)} under Mar 27; layer Q2 on dips. Avoid fixing 2028, where the curve falls back to RM${f0(curve[6].c)}.`]],
  balNote: () => `Stocks: USDA ${W.stocksUSDA} Mt at end-26/27, from ${W.stocks2425} Mt two seasons earlier. ${esc(W.note)}`,
  ovPrice: () => [{ k: "palm", name: "Palm oil", color: "#E0A458" }, { k: "soyoil", name: "Soybean oil", color: "#8EC5FF" }], ovAria: "Palm and soybean oil prices",
  mk: [["palm", "#E0A458"], ["soyoil", "#8EC5FF"], ["rapeoil", "#F2C14E"], ["sunoil", "#F2EEE6"], ["pko", "#9FD3A8"], ["cocooil", "#C9A7FF"], ["brent", "#FF6B57"], ["urea", "#FF4F1F"]],
  mkSel: ["palm", "soyoil", "sunoil"],
  mkKpis: () => { const pl = ser("palm"); return [
    { l: "Bursa FCPO Jan 27", f: `$${f0(B.fcpo.usd)}`, s: `RM${f0(B.fcpo.px)}/t · ${B.fcpo.date.slice(5)}` },
    { l: "CBOT soyoil Dec", f: `$${f0(B.cbotso.usd)}`, s: `${f2(B.cbotso.px)} c/lb · ${B.cbotso.date.slice(5)}` },
    { l: "Soy oil over palm", f: `+$${f0(pogo())}`, s: `the discount that keeps India buying` },
    { l: "Indonesia ref., Nov", f: `$${f1(B.idref.px)}`, s: `sets export duty & levy · −6.1%` },
    { l: "Malaysia ref., Dec", f: `$${f0(B.myref.usd)}`, s: `RM${f2(B.myref.px)} · duty 10%` },
    { l: "World Bank palm", f: `$${f0(pl.at(-1)[1])}`, s: `${pl.at(-1)[0]} average · ${pct(pl.at(-1)[1] / pl.at(-13)[1] - 1, 0)} y/y` }]; },
  mkNote: "Monthly averages, World Bank Pink Sheet, to Oct 2026. Soybean, sunflower and rapeseed oil are palm's substitutes; crude oil sets its value as biodiesel feedstock.",
  curveTip: v => `RM${f0(v)} · $${f0(v / D.fx.usdmyr)}/t`,
  curveNote: () => `Hump-shaped: May 27 is ${pct(carry)} over Dec, then the curve falls to RM${f0(curve[6].c)} by May 28. The market prices a 2027 squeeze and easier supply after it.`,
  physCur: "Quoted", physVs: "fcpo", physVsName: "FCPO",
  lgKpis: () => [
    { l: "Malaysia exports, Oct", f: "1.71 Mt", s: "+55.8% m/m (MPOB)" },
    { l: "Malaysia exports, 1-10 Nov", f: "−2%", s: "cargo surveyors, m/m" },
    { l: "Indonesia exports 26/27", f: "21.6 Mt", s: "from 25.0 Mt (USDA) · −13.7%" },
    { l: "World trade 26/27", f: `${W.trade[2]} Mt`, s: `${pct(W.trade[2] / W.trade[1] - 1)} on 25/26` },
    { l: "Suez traffic", f: "−50%", s: "year on year" },
    { l: "Cape diversion", f: "+7-14 days", s: "Asia-Europe voyages" }],
  shocks: [
    { id: "nino", n: "El Niño output loss in 2027", u: "Mt", min: 0, max: 5, st: .1, def: 2.7, why: "IPOC speakers expect 2.5-3 Mt lost in the Feb-Nov 2027 low cycle, worst in Indonesia.", eff: v => -v },
    { id: "b50", n: "Indonesia moves to B50", u: "Mt", min: 0, max: 4, st: .1, def: 2, why: "Extra palm oil kept at home for biodiesel. Under study; no decision yet. Desk sizing.", eff: v => -v },
    { id: "dmo", n: "Export routing rules cut Indonesian supply", u: "Mt", min: 0, max: 5, st: .1, def: 2, why: "State-designated exporters from Jan 2027. GAPKI says exports could fall about 5 Mt in a bad-weather year.", eff: v => -v },
    { id: "mys", n: "Malaysian stocks stay high", u: "Mt", min: 0, max: 2, st: .1, def: .8, why: "Record 3.62 Mt in October. If the seasonal draw disappoints, more oil is available. Bearish.", eff: v => +v },
    { id: "sub", n: "India switches to soy & sunflower oil", u: "Mt", min: 0, max: 3, st: .1, def: 1, why: "Palm demand lost when its discount narrows. Bearish.", eff: v => +v },
    { id: "eudr", n: "EUDR compliance premium", u: "$/t", min: 0, max: 60, st: 1, def: 20, why: "Cost of traceable, deforestation-free supply into the EU from 30 Dec 2026. Desk assumption; added to delivered price.", add: v => v },
    { id: "red", n: "Red Sea freight premium", u: "$/t", min: 0, max: 40, st: 1, def: 10, why: "Extra cost of Cape diversions on Asia-Europe lanes; added to delivered price.", add: v => v },
    { id: "oil", n: "Brent crude", u: "$/bbl", min: 50, max: 150, st: 1, def: 96, base: D.brentNow.v, why: `From $${D.brentNow.v} (${D.brentNow.date.slice(5)}, US EIA). Pass-through of $3/t of palm per $1/bbl through biodiesel demand: an assumption.`, add: v => (v - D.brentNow.v) * 3 }],
  presets: [["Today", {}], ["El Niño bites", { nino: 3 }], ["B50 + export rules", { b50: 2.5, dmo: 3 }], ["Stocks overhang", { mys: 1.5, sub: 1.5 }], ["Hormuz reopens", { oil: 70 }], ["Perfect storm", { nino: 3.5, b50: 3, dmo: 4, eudr: 40, red: 20, oil: 120 }]],
  scBench: "fcpo", scBenchName: "FCPO Jan", scEquiv: P => `RM${myr(P)}/t equivalent`,
  fan: () => [["Now", "Dec", "Jan", "Feb", "Mar", "Apr", "May"], [curve[0].t, curve[0].t, curve[1].t, (curve[1].t + curve[2].t) / 2, curve[2].t, (curve[2].t + curve[3].t) / 2, curve[3].t]],
  holdCheck: "MPOB's November data (about 10 Dec)",
  mdWhat: "palm oil", mdCaveat: "Statistical models know nothing of El Niño or Indonesian policy; read them with the Scenarios screen.",
  rules: (daysTo, recent) => { const pl = ser("palm").map(d => d[1]), avg5 = pl.slice(-60).reduce((s, v) => s + v, 0) / 60, last = pl.at(-1), sp = pogo(); return [
    { st: curve[2].t / curve[0].t - 1 > .05 ? "fire" : curve[2].t > curve[0].t ? "arm" : "calm", t: "Near months are the cheap end of the curve", tr: "Mar 27 more than 5% over Dec", now: `Dec $${f0(curve[0].t)} vs Mar $${f0(curve[2].t)} (${pct(curve[2].t / curve[0].t - 1)})`, a: "Price Q1 now rather than waiting; the curve already charges for 2027 tightness." },
    { st: last < avg5 * .95 ? "fire" : last < avg5 ? "arm" : "calm", t: "Below the five-year average", tr: "World Bank palm more than 5% under its 5y mean", now: `$${f0(last)} vs $${f0(avg5)} average (${pct(last / avg5 - 1)})`, a: "Extend cover further out; prices this low have not tended to last." },
    { st: daysTo("2027-01-01") <= 30 ? "fire" : daysTo("2027-01-01") <= 60 ? "arm" : "calm", t: "Indonesian export routing starts", tr: "Within 60 days of 1 Jan 2027", now: `${daysTo("2027-01-01")} days to go`, a: "Confirm how January loadings will be documented and who pays any new charge; qualify Malaysian supply as backup." },
    { st: daysTo("2026-12-30") <= 30 ? "fire" : daysTo("2026-12-30") <= 60 ? "arm" : "calm", t: "EUDR applies", tr: "Within 60 days of 30 Dec 2026", now: `${daysTo("2026-12-30")} days to go`, a: "Collect plot geolocation from suppliers for EU-bound volume; price a compliance premium into tenders." },
    { st: [2, 3, 4, 5].includes(NOWM) ? "fire" : [12, 1].includes(NOWM) ? "arm" : "calm", t: "Seasonal low-output window", tr: "February to May (armed from December)", now: NOWM === 11 ? "Output past its peak; low cycle from February" : "In window", a: "Output falls and stocks draw in these months. Have Q1-Q2 cover in place before February." },
    { st: sp < 150 ? "fire" : sp < 250 ? "arm" : "calm", t: "Palm loses its discount", tr: "Soy oil over palm below $150/t (armed at $250)", now: `+$${f0(sp)}/t`, a: "A narrow discount sends India to soy and sunflower oil: price your blend, not palm alone." },
    { st: recent > 3 ? "fire" : recent > -3 ? "arm" : "calm", t: "News turns bullish", tr: "Net news pressure over 14 days above +3", now: `Net ${recent > 0 ? "+" : ""}${recent} (${recent < 0 ? "bearish" : "bullish"})`, a: "When the flow of news turns, pull planned purchases forward." },
    { st: D.brentNow.v > 100 ? "fire" : D.brentNow.v > 85 ? "arm" : "calm", t: "Crude supports biodiesel demand", tr: "Brent above $100 (armed at $85)", now: `Brent $${f2(D.brentNow.v)} (${D.brentNow.date.slice(5)})`, a: "High crude makes blending pay and lifts palm's floor; a crude sell-off is the main downside risk." }]; },
  ladder: () => [["Q1 27", curve[2].t, "Mar 27"], ["Q2 27", curve[3].t, "May 27"], ["Q3 27", curve[3].t + (curve[4].t - curve[3].t) * .6, "Aug 27, interpolated"], ["Q4 27", curve[5].t, "Nov 27"]],
  cats: [
    ["2026-12-10", "MPOB November data (expected)", "First read on how fast Malaysian stocks draw down."],
    ["2026-12-10", "USDA December WASDE (expected)", "Next official world balance sheet."],
    ["2026-12-30", "EUDR applies", "Traceability for EU-bound palm oil."],
    ["2027-01-01", "Indonesia's export routing starts", "State-designated exporters; possible new charges."],
    ["2027-01-15", "B50 decision (expected)", "Indonesia's 2027 biodiesel blend."],
    ["2027-02-01", "Low-output cycle begins", "El Niño's lagged effect on yields, Feb-Nov 2027."],
    ["2027-04-30", "End of Mistry's RM4,500-5,000 window", "Check the call against the market."]],
  alb: () => [["fcpo", "Bursa FCPO Jan, $/t", B.fcpo.usd], ["cbotso", "CBOT soyoil Dec, $/t", B.cbotso.usd], ["idref", "Indonesia reference, $/t", B.idref.usd], ["wb", "World Bank palm, $/t", ser("palm").at(-1)[1]]],
  alHint: "FCPO falls below $1,000",
  globeAria: "Globe of palm oil producers, trade lanes, chokepoints and news",
  html: {
    "#h-ov": "Palm oil, this week", "#bal-tag": "USDA FAS",
    "#ovp-lbl": "Palm and soybean oil prices, $/t, monthly",
    "#ovp-note": `Palm oil (Malaysia/Indonesia, 5% bulk, c.i.f. North-West Europe) against soybean oil, its main substitute. The gap between them drives India's buying. Source: <a href="https://www.worldbank.org/en/research/commodity-markets" target="_blank" rel="noopener">World Bank Pink Sheet</a>.`,
    "#h-co": "Top 10 producers", "#co-p": "The ten largest growers by 2025/26 output. Ranks 6-10 come from an industry tally that gives 2025/26 only, so their 2026/27 column is blank. Pick a row for the rationale, output calendar and source.",
    "#cal-lbl": "Output calendar", "#cal-legend": sw,
    "#cal-note": "Palm fruit is harvested all year. Shown: peak and low-output months in Indonesia, Malaysia, Thailand and Colombia. Seasons for the other producers are not in the pack.",
    "#mk-p": "Exchange benchmarks converted to $/t, the Bursa forward curve, and twenty years of monthly prices for palm oil and the oils and energy that drive it.",
    "#curve-lbl": "Forward curve, Bursa FCPO", "#curve-unit": "RM/t", "#phys-unit": "Quoted → $/t",
    "#corr-lbl": "Correlation with palm oil, monthly returns, 5y",
    "#lg-p": "Where palm oil gets held up. Chokepoint status, export flows and the routes that carry the world's exports.",
    "#in-p": "Fifteen developments across five categories that change how palm oil is grown, milled, traced or replaced. Each has a dated milestone and a source.",
    "#elas-why": "−1.0 means a 10% fall in stocks-to-use lifts price about 10%. Vegetable oils respond less than grains because buyers can switch between palm, soy, sunflower and rapeseed oil.",
    "#md-series": `<button data-k="palm" aria-pressed="true">Palm oil</button><button data-k="soyoil" aria-pressed="false">Soybean oil</button>`
  }
}; };
const K = (PF[CMD] || PF.wheat)();
document.documentElement.style.setProperty("--wheat", K.hex);
Object.entries(K.html).forEach(([sel, h]) => $$(sel).forEach(el => el.innerHTML = h));
if (K.title) document.title = K.title;
if (K.globeAria) $("#globe")?.setAttribute("aria-label", K.globeAria);
const ser = k => P.series[k].data;

/* ---------- charts (hand SVG) ---------- */
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
}
/* lineChart: labels[], series[{name,color,vals[],dash,width,area}], opts{h,yfmt,band:{lo[],hi[],color},vline,unit,xEvery} */
function cw(el) { const w = el && el.clientWidth; return w ? Math.max(340, Math.min(960, Math.round(w))) : 720; }
function lineChart(el, labels, series, o = {}) {
  const Wd = cw(el), H = o.h || 260, L = 46, R = 12, T = 12, Bm = 26;
  const all = series.flatMap(s => s.vals).concat(o.band ? o.band.lo.concat(o.band.hi) : []).filter(v => v != null && isFinite(v));
  let lo = Math.min(...all), hi = Math.max(...all); if (o.zero) lo = Math.min(0, lo);
  const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
  const n = labels.length, x = i => L + (Wd - L - R) * (n <= 1 ? .5 : i / (n - 1)), y = v => T + (H - T - Bm) * (1 - (v - lo) / (hi - lo));
  const yf = o.yfmt || f0, ticks = niceTicks(lo, hi, 5);
  const every = o.xEvery || Math.max(1, Math.ceil(n / 7));
  let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(o.aria || "chart")}"><g class="grid">`;
  ticks.forEach(t => s += `<line x1="${L}" x2="${Wd - R}" y1="${y(t)}" y2="${y(t)}"/>`);
  s += `</g>`;
  ticks.forEach(t => s += `<text class="ax" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${yf(t)}</text>`);
  labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1 && n < 14) s += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`; });
  if (o.zero && lo < 0) s += `<line x1="${L}" x2="${Wd - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
  if (o.vline != null) s += `<line x1="${x(o.vline)}" x2="${x(o.vline)}" y1="${T}" y2="${H - Bm}" stroke="var(--line-2)" stroke-dasharray="3 3"/><text class="ax" x="${x(o.vline) + 4}" y="${T + 9}">${esc(o.vlabel || "")}</text>`;
  if (o.band) {
    let p = "", q = "";
    o.band.lo.forEach((v, i) => { if (v != null) p += (p ? "L" : "M") + x(i) + "," + y(v); });
    for (let i = o.band.hi.length - 1; i >= 0; i--) if (o.band.hi[i] != null) q += "L" + x(i) + "," + y(o.band.hi[i]);
    s += `<path d="${p}${q}Z" fill="${o.band.color || "rgba(255,79,31,.14)"}"/>`;
  }
  series.forEach(se => {
    let d = "", start = null, last = null;
    se.vals.forEach((v, i) => { if (v == null || !isFinite(v)) { return; } d += (d && last === i - 1 ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); if (start == null) start = i; last = i; });
    if (se.area && d) s += `<path d="${d}L${x(last)},${H - Bm}L${x(start)},${H - Bm}Z" fill="${se.color}" opacity=".10"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.width || 1.8}" ${se.dash ? `stroke-dasharray="${se.dash}"` : ""} stroke-linejoin="round" opacity="${se.op || 1}"/>`;
    if (se.dots) se.vals.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${se.color}"/>`; });
  });
  s += `<line class="hl" x1="0" x2="0" y1="${T}" y2="${H - Bm}" stroke="var(--bone)" stroke-opacity=".35" style="display:none"/><rect x="${L}" y="${T}" width="${Wd - L - R}" height="${H - T - Bm}" fill="transparent"/></svg><div class="tip"></div>`;
  el.innerHTML = s;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), hl = el.querySelector(".hl");
  const move = ev => {
    const r = svg.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const sx = px * Wd / r.width, i = clamp(Math.round((sx - L) / (Wd - L - R) * (n - 1)), 0, n - 1);
    hl.setAttribute("x1", x(i)); hl.setAttribute("x2", x(i)); hl.style.display = "";
    let h = `<b>${esc(labels[i])}</b>`;
    series.forEach(se => { if (!se.noTip && se.vals[i] != null) h += `<br><i style="display:inline-block;width:8px;height:2px;background:${se.color};vertical-align:middle;margin-right:5px"></i>${esc(se.name)} ${(o.tipfmt || yf)(se.vals[i])}`; });
    if (o.band && o.band.lo[i] != null) h += `<br><span class="faint">80% band ${(o.tipfmt || yf)(o.band.lo[i])}–${(o.tipfmt || yf)(o.band.hi[i])}</span>`;
    tip.innerHTML = h; tip.style.display = "block";
    const tx = x(i) * r.width / Wd; tip.style.left = (tx > r.width * .6 ? tx - tip.offsetWidth - 12 : tx + 12) + "px"; tip.style.top = "8px";
  };
  svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true }); svg.addEventListener("touchmove", move, { passive: true });
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; hl.style.display = "none"; });
}
function barChart(el, groups, keys, o = {}) {
  /* groups [{label, vals:{key:v}}], keys [{k,name,color}] */
  const Wd = cw(el), H = o.h || 230, L = 44, R = 10, T = 12, Bm = 26;
  const all = groups.flatMap(g => keys.map(k => g.vals[k.k])).filter(v => v != null);
  const lo = o.lo ?? 0, hi = Math.max(...all) * 1.06;
  const y = v => T + (H - T - Bm) * (1 - (v - lo) / (hi - lo));
  const gw = (Wd - L - R) / groups.length, bw = Math.min(46, gw * .8 / keys.length);
  let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(o.aria || "bar chart")}"><g class="grid">`;
  const ticks = niceTicks(lo, hi, 4); ticks.forEach(t => s += `<line x1="${L}" x2="${Wd - R}" y1="${y(t)}" y2="${y(t)}"/>`); s += "</g>";
  ticks.forEach(t => s += `<text class="ax" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${f0(t)}</text>`);
  groups.forEach((g, gi) => {
    const cx = L + gw * gi + gw / 2, x0 = cx - bw * keys.length / 2;
    keys.forEach((k, ki) => { const v = g.vals[k.k]; if (v == null) return;
      s += `<rect data-t="${esc(g.label)} · ${esc(k.name)}: ${f1(v)} ${o.unit || ""}" x="${x0 + ki * bw + 1}" y="${y(v)}" width="${bw - 2}" height="${y(lo) - y(v)}" fill="${k.color}" rx="1.5" opacity=".9"/>`; });
    s += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(g.label)}</text>`;
  });
  s += `</svg><div class="tip"></div>`;
  el.innerHTML = s + `<div class="chart-legend">${keys.map(k => `<span><i style="background:${k.color}"></i>${esc(k.name)}</span>`).join("")}</div>`;
  const tip = el.querySelector(".tip");
  el.querySelectorAll("rect[data-t]").forEach(r => {
    const show = () => { tip.textContent = r.dataset.t; tip.style.display = "block"; const bb = r.getBoundingClientRect(), eb = el.getBoundingClientRect(); tip.style.left = clamp(bb.left - eb.left - 30, 0, eb.width - 200) + "px"; tip.style.top = Math.max(0, bb.top - eb.top - 34) + "px"; };
    r.addEventListener("mouseenter", show); r.addEventListener("touchstart", show, { passive: true });
    r.addEventListener("mouseleave", () => tip.style.display = "none");
  });
}

/* ---------- router ---------- */
let cur = "overview";
const rendered = {};
function go(s, push = true) {
  if (!$("#s-" + s)) s = "overview";
  cur = s;
  $$(".screen").forEach(x => x.classList.toggle("on", x.id === "s-" + s));
  $$("#rail button").forEach(b => b.dataset.s === s ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  const btn = $(`#rail button[data-s="${s}"]`); if (btn && innerWidth <= 900) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced ? "auto" : "smooth" });
  if (push) history.replaceState(null, "", "#" + s);
  if (!rendered[s] && R[s]) { R[s](); rendered[s] = true; }
  if (s === "watch") renderWatch();
  if (s === "overview" && globe) sizeGlobe();
  if (push) scrollTo({ top: 0 });
}
$("#rail").addEventListener("click", e => { const b = e.target.closest("button[data-s]"); if (b) go(b.dataset.s); });
addEventListener("keydown", e => {
  if (e.target.matches("input,select,textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  const order = $$("#rail button[data-s]").map(b => b.dataset.s), k = e.key === "0" ? 9 : +e.key - 1;
  if (k >= 0 && k < order.length && /^[0-9]$/.test(e.key)) go(order[k]);
});

/* ---------- top ---------- */
function ticker() {
  $("#ticker").innerHTML = K.ticker().join("");
  $("#asof").textContent = new Date(D.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function updateCounts() {
  $("#cnt-news").textContent = D.news.length; $("#cnt-inno").textContent = D.innovations.length;
  const w = S.stars.c.length + S.stars.n.length + S.stars.i.length + S.alerts.length; $("#cnt-watch").textContent = w || "";
}

/* ---------- OVERVIEW ---------- */
const R = {};
R.overview = () => {
  $("#ov-lede").textContent = K.lede();
  $("#ov-asof").textContent = "Data to " + D.asOf;
  $("#ov-kpis").innerHTML = K.kpis().map(k => `<div class="kpi ${k.call ? "kpi--call" : ""}"><p class="lbl">${k.l}</p><span class="fig">${k.f}</span><span class="sub">${k.s}</span>${k.g != null ? `<div class="gauge"><i style="width:${k.g}%"></i></div>` : ""}</div>`).join("");
  $("#call-tag").textContent = K.callTag;
  $("#callbox").innerHTML = K.call().map(([b, t]) => `<div class="row"><b>${b}</b><span>${t}</span></div>`).join("") + `<p class="note">The call is the desk's judgement from the dated sources on this page, not advice.</p>`;
  $("#ov-wire").innerHTML = D.news.slice(0, 6).map(n => `<div class="it" data-n="${n.id}" tabindex="0"><div class="meta">${n.d.slice(5)} · ${dirTag(n.dir)} · ${esc(n.theme)} ${impBars(n.imp)}</div><h3>${esc(n.h)}</h3></div>`).join("");
  $("#ov-wire").addEventListener("click", e => { const it = e.target.closest("[data-n]"); if (it) { go("news"); setTimeout(() => { const c = $("#nc-" + it.dataset.n); if (c) { c.scrollIntoView({ block: "center" }); c.animate([{ borderColor: "#FF4F1F" }, { borderColor: "rgba(242,238,230,.1)" }], 1600); } }, 60); } });
  barChart($("#ch-balance"), W.years.map((y, i) => ({ label: y, vals: { p: W.production[i], c: W.consumption[i], t: W.trade[i] } })),
    [{ k: "p", name: "Production", color: K.hex }, { k: "c", name: "Consumption", color: "#8EC5FF" }, { k: "t", name: "Trade", color: "#FF4F1F" }], { unit: "Mt", aria: `World ${K.noun} balance` });
  $("#bal-note").innerHTML = K.balNote() + " " + W.src.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])}</a>`).join(" · ");
  const op = K.ovPrice();
  lineChart($("#ch-ov-price"), ser(op[0].k).slice(-60).map(d => d[0]), op.map((o, i) => ({ name: o.name, color: o.color, vals: ser(o.k).slice(-60).map(d => d[1]), area: i === 0 ? 1 : 0, width: i ? 1.4 : 1.8 })), { yfmt: f0, tipfmt: v => "$" + f1(v), aria: K.ovAria });
  initGlobe();
};
const dirTag = d => d > 0 ? `<span class="tag tag--bad">Bullish</span>` : `<span class="tag tag--ok">Bearish</span>`;
const impBars = n => `<span class="imp" title="Impact ${n}/5 (desk)" aria-label="Impact ${n} of 5">${[1,2,3,4,5].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;

/* ---------- GLOBE ---------- */
let globe = null, layers = { prod: true, flows: true, choke: true, news: false, risk: false };
const isoTo = {}; D.countries.forEach(c => c.iso.forEach(i => isoTo[i] = c));
const riskCol = (r, a = .85) => { const t = r / 100; const c = t < .5 ? [159 + (242 - 159) * t * 2, 211 + (193 - 211) * t * 2, 168 + (78 - 168) * t * 2] : [242 + (255 - 242) * (t - .5) * 2, 193 + (107 - 193) * (t - .5) * 2, 78 + (87 - 78) * (t - .5) * 2]; return `rgba(${c.map(Math.round).join(",")},${a})`; };
const stCol = { bad: "#FF6B57", warn: "#F2C14E", ok: "#9FD3A8" };
function gAlt(base) { if (innerWidth < 700) return base; const w = $(".globe-wrap"), f = w && w.clientWidth ? Math.max(1, (w.clientHeight / w.clientWidth) / .75) : 1; return (base + 1) * f - 1; }
function sizeGlobe() { if (!globe) return; const w = $(".globe-wrap"); globe.width(w.clientWidth).height(w.clientHeight); }
function initGlobe() {
  const el = $("#globe");
  const ok = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  if (!ok || typeof Globe !== "function") { $("#globe-fb").hidden = false; $("#layers").hidden = true; $("#spin").hidden = true; return; }
  const maxP = Math.max(...D.countries.map(c => c.prod[1] || 0));
  globe = Globe({ animateIn: !reduced })(el)
    .backgroundColor("rgba(0,0,0,0)").showAtmosphere(true).atmosphereColor("#FF4F1F").atmosphereAltitude(.13)
    .showGraticules(true)
    .polygonsData(GEO.features.filter(f => f.properties.iso !== "ATA"))
    .polygonCapColor(f => { const c = isoTo[f.properties.iso]; if (!c) return "rgba(30,35,46,.92)"; if (layers.risk) return riskCol(c.risk, .8); if (!layers.prod) return "rgba(42,48,60,.95)"; const a = .35 + .6 * (c.prod[1] || 0) / maxP; return `rgba(${K.rgb},${a.toFixed(2)})`; })
    .polygonSideColor(() => `rgba(${K.rgb},.10)`).polygonStrokeColor(() => "rgba(242,238,230,.10)")
    .polygonAltitude(f => { const c = isoTo[f.properties.iso]; return c && (layers.prod || layers.risk) ? .006 + .045 * (c.prod[1] || 0) / maxP : .004; })
    .polygonLabel(f => { const c = isoTo[f.properties.iso]; return c ? `<div style="font:12px Geist,sans-serif;background:#12151C;border:1px solid rgba(242,238,230,.22);padding:6px 9px;border-radius:5px;color:#F2EEE6"><b>${c.flag} ${esc(c.name)}</b><br>${c.prod[2] != null ? f1(c.prod[2]) + " Mt " + YR[2] : f1(c.prod[1]) + " Mt " + YR[1]} · exports ${c.exp} Mt<br>Risk ${c.risk}/100 (desk)</div>` : `<span style="font:11px Geist;color:#A7A298">${esc(f.properties.name)}</span>`; })
    .onPolygonClick(f => { const c = isoTo[f.properties.iso]; if (c) cardCountry(c); })
    .polygonsTransitionDuration(reduced ? 0 : 500)
    .arcStartLat(d => d.a.lat).arcStartLng(d => d.a.lng).arcEndLat(d => d.b.lat).arcEndLng(d => d.b.lng)
    .arcColor(() => ["rgba(142,197,255,.15)", "rgba(142,197,255,.9)"]).arcStroke(d => .25 + d.w * .9).arcAltitudeAutoScale(.38)
    .arcDashLength(.45).arcDashGap(.25).arcDashAnimateTime(d => reduced ? 0 : 2600 + d.r * 1800)
    .arcLabel(d => `<div style="font:11.5px Geist;background:#12151C;border:1px solid rgba(242,238,230,.22);padding:5px 8px;border-radius:5px;color:#F2EEE6">${esc(d.a.name)} → ${esc(d.b.name)}<br><span style="color:#A7A298">Typical lane, illustrative</span></div>`)
    .pointLat("lat").pointLng("lng").pointAltitude(d => d.kind === "news" ? .07 : .02).pointRadius(d => d.kind === "news" ? .35 + d.imp * .08 : .55)
    .pointColor(d => d.kind === "news" ? (d.dir > 0 ? "#FF6B57" : "#9FD3A8") : stCol[d.status]).pointsMerge(false)
    .pointLabel(d => `<div style="font:11.5px Geist;background:#12151C;border:1px solid rgba(242,238,230,.22);padding:5px 8px;border-radius:5px;color:#F2EEE6;max-width:240px;white-space:normal">${d.kind === "news" ? esc(d.h) : `<b>${esc(d.name)}</b><br>${esc(d.label)}`}</div>`)
    .onPointClick(d => d.kind === "news" ? cardNews(d) : cardChoke(d))
    .ringLat("lat").ringLng("lng").ringColor(d => t => `rgba(${d.status === "bad" ? "255,107,87" : d.status === "warn" ? "242,193,78" : "159,211,168"},${1 - t})`)
    .ringMaxRadius(d => d.status === "bad" ? 5 : 3).ringPropagationSpeed(2).ringRepeatPeriod(d => reduced ? 0 : d.status === "bad" ? 900 : 1600);
  const m = globe.globeMaterial(); m.color && m.color.set("#0f131b"); if (m.emissive) { m.emissive.set("#0b0e14"); } m.shininess = 2;
  globe.pointOfView({ lat: 34, lng: 38, altitude: gAlt(innerWidth < 700 ? 2.6 : 2.05) }, 0);
  const c = globe.controls(); c.autoRotate = !reduced; c.autoRotateSpeed = .35; c.enableZoom = true;
  if (reduced) $("#spin").setAttribute("aria-pressed", "false");
  el.addEventListener("pointerdown", () => { c.autoRotate = false; $("#spin").setAttribute("aria-pressed", "false"); }, { once: true });
  applyLayers(); sizeGlobe();
  new ResizeObserver(() => sizeGlobe()).observe($(".globe-wrap"));
  // pause when off-screen to save battery
  new IntersectionObserver(es => es.forEach(e => { if (!globe) return; e.isIntersecting ? globe.resumeAnimation() : globe.pauseAnimation(); })).observe($(".globe-wrap"));
}
function applyLayers() {
  if (!globe) return;
  const maxE = Math.max(...D.countries.map(c => c.exp));
  globe.arcsData(layers.flows ? D.flows.map(([cid, ii], r) => ({ a: byId[cid], b: D.importers[ii], w: byId[cid].exp / maxE, r: (r * 7 % 10) / 10 })) : []);
  const pts = [];
  if (layers.choke) D.chokepoints.forEach(c => pts.push({ ...c, kind: "choke" }));
  if (layers.news) D.news.forEach(n => pts.push({ ...n, kind: "news" }));
  globe.pointsData(pts).ringsData(layers.choke ? D.chokepoints.filter(c => c.status !== "ok") : []);
  globe.polygonsData(globe.polygonsData()); // re-colour
  const lg = [];
  if (layers.risk) lg.push(`Tint: desk risk <span style="color:var(--ok)">low</span> → <span style="color:var(--bad)">high</span>`); else if (layers.prod) lg.push(`Tint &amp; height: ${YR[1]} output`);
  if (layers.flows) lg.push(`<span style="color:var(--sky)">Lanes</span>: typical, not volumes`);
  if (layers.choke) lg.push(`Chokepoints: <span style="color:var(--bad)">●</span> shut <span style="color:var(--warn)">●</span> strained <span style="color:var(--ok)">●</span> open`);
  if (layers.news) lg.push(`News: <span style="color:var(--bad)">●</span> bullish <span style="color:var(--ok)">●</span> bearish`);
  $("#legend").innerHTML = lg.join("<br>") || "Turn on a layer";
}
$("#layers").addEventListener("click", e => {
  const b = e.target.closest("button[data-l]"); if (!b) return;
  const l = b.dataset.l; layers[l] = !layers[l];
  if (l === "risk" && layers.risk) { layers.prod = false; $('#layers [data-l="prod"]').setAttribute("aria-pressed", "false"); }
  if (l === "prod" && layers.prod) { layers.risk = false; $('#layers [data-l="risk"]').setAttribute("aria-pressed", "false"); }
  b.setAttribute("aria-pressed", layers[l]); applyLayers();
});
$("#spin").addEventListener("click", e => { if (!globe) return; const c = globe.controls(); c.autoRotate = !c.autoRotate; e.currentTarget.setAttribute("aria-pressed", c.autoRotate); });
const gcard = $("#gcard");
gcard.querySelector(".x").addEventListener("click", () => gcard.classList.remove("on"));
function openCard(h) { $("#gcard-b").innerHTML = h; gcard.classList.add("on"); }
function cardCountry(c) {
  const ch = c.prod[2] != null && c.prod[1] ? c.prod[2] / c.prod[1] - 1 : null;
  openCard(`<p class="lbl">Producer</p><h2 style="margin:2px 0 6px">${c.flag} ${esc(c.name)}</h2>
    <div class="pill-row" style="margin-bottom:6px"><span class="tag tag--mute">${c.prod[2] != null ? f1(c.prod[2]) + " Mt " + YR[2] : f1(c.prod[1]) + " Mt " + YR[1]}</span>${ch != null ? `<span class="tag ${ch < 0 ? "tag--warn" : "tag--ok"}">${pct(ch)}</span>` : ""}<span class="tag tag--sky">exports ${c.exp} Mt</span></div>
    <p class="small" style="margin:0 0 6px">${esc(c.why)}</p><div class="gauge"><i style="width:${c.risk}%"></i></div><p class="xs muted" style="margin:4px 0 8px">Risk ${c.risk}/100 · desk</p>
    <button class="btn" data-go="countries" data-focus="${c.id}">Full profile</button> ${starBtn("c", c.id, c.name)}`);
  if (globe) globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: gAlt(innerWidth < 700 ? 2.3 : 1.7) }, reduced ? 0 : 900);
}
function cardChoke(c) {
  openCard(`<p class="lbl">Chokepoint</p><h2 style="margin:2px 0 6px">${esc(c.name)}</h2><span class="tag tag--${c.status === "ok" ? "ok" : c.status === "warn" ? "warn" : "bad"}">${esc(c.label)}</span>
    <p class="small" style="margin:8px 0">${esc(c.detail)}</p><p class="src">Source: <a href="${c.src[1]}" target="_blank" rel="noopener">${esc(c.src[0])}</a></p><button class="btn" data-go="logistics">Shipping &amp; risk</button>`);
}
function cardNews(n) {
  openCard(`<p class="lbl">${n.d} · ${esc(n.pub)}</p><h3 style="margin:4px 0 6px;font-size:14px">${esc(n.h)}</h3><div class="pill-row">${dirTag(n.dir)} ${impBars(n.imp)}</div>
    <p class="small" style="margin:8px 0 4px">${esc(n.so)}</p><p class="src"><a href="${n.src}" target="_blank" rel="noopener">Read the source</a></p>`);
}
function focusCountry(id) { selCountry = id; renderCountries(); const d = $("#co-detail"); if (innerWidth <= 1280) d.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }

/* ---------- COUNTRIES ---------- */
let coSort = "prod", selCountry = byId.EU ? "EU" : D.countries[0].id;
R.countries = () => {
  $("#co-metric").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; coSort = b.dataset.m; $$("#co-metric button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderCountries(); });
  renderCountries(); renderCal();
};
function coChange(c) { return c.prod[2] != null && c.prod[1] ? c.prod[2] / c.prod[1] - 1 : null; }
function renderCountries() {
  const rows = [...D.countries].sort((a, b) => coSort === "prod" ? (b.prod[1] || 0) - (a.prod[1] || 0) : coSort === "exp" ? b.exp - a.exp : coSort === "risk" ? b.risk - a.risk : (coChange(a) ?? 9) - (coChange(b) ?? 9));
  const maxP = Math.max(...D.countries.map(c => c.prod[1] || 0)), rankP = [...D.countries].sort((a, b) => (b.prod[1] || 0) - (a.prod[1] || 0)).map(c => c.id);
  $("#co-tbl").innerHTML = `<thead><tr><th class="hs">#</th><th>Country</th><th class="n hs">${YR[0]}</th><th>${YR[1]} output</th><th class="n hs">${YR[2]}f</th><th class="n">Chg</th><th class="n hs">Exports</th><th class="n">Risk</th><th></th></tr></thead><tbody>` +
    rows.map(c => { const ch = coChange(c); return `<tr data-id="${c.id}" class="${c.id === selCountry ? "sel" : ""}" tabindex="0"><td class="mono faint hs">${rankP.indexOf(c.id) + 1}</td><td style="white-space:nowrap"><span class="flag" aria-hidden="true">${c.flag}</span>${esc(c.name)}</td>
      <td class="n faint hs">${f1(c.prod[0])}</td><td class="bar-cell"><div class="bc"><i style="width:calc((100% - 52px) * ${((c.prod[1] || 0) / maxP).toFixed(3)})"></i><span>${f1(c.prod[1])}</span></div></td>
      <td class="n hs">${f1(c.prod[2])}</td><td class="n ${ch < 0 ? "up" : ch > 0 ? "dn" : "flat"}">${ch == null ? "—" : pct(ch)}</td><td class="n hs">${c.exp ? f1(c.exp) : "<span class='faint'>—</span>"}</td>
      <td class="n"><span class="tag tag--${c.risk >= 70 ? "bad" : c.risk >= 45 ? "warn" : "ok"}">${c.risk}</span></td><td>${starBtn("c", c.id, c.name)}</td></tr>`; }).join("") + "</tbody>";
  $$("#co-tbl tbody tr").forEach(tr => { const pick = () => { selCountry = tr.dataset.id; renderCountries(); if (innerWidth <= 1280) $("#co-detail").scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); };
    tr.addEventListener("click", pick); tr.addEventListener("keydown", e => { if (e.key === "Enter") pick(); }); });
  renderDetail();
}
function renderDetail() {
  const c = byId[selCountry], ch = coChange(c), share = c.exp / W.trade[2];
  const mlist = a => a.map(m => MONTHS[m - 1]).join("-");
  $("#co-detail").innerHTML = `<div class="panel__h" style="margin-bottom:2px"><p class="lbl">Country profile</p>${starBtn("c", c.id, c.name)}</div>
    <h2>${c.flag} ${esc(c.name)}</h2><span class="tag tag--mute">${esc(c.trend)}</span>
    <div class="chart" id="co-mini" style="margin-top:8px"></div>
    <dl><dt>Output ${YR[2]}</dt><dd>${c.prod[2] != null ? f1(c.prod[2]) + " Mt" : "<span class='muted'>not in the pack</span>"} ${ch != null ? `<span class="${ch < 0 ? "up" : "dn"} mono small">${pct(ch)}</span>` : ""}</dd>
    <dt>Exports ${YR[2]}</dt><dd>${c.exp ? f1(c.exp) + ` Mt <span class="muted small">· ${(share * 100).toFixed(0)}% of world trade</span>` : "<span class='muted'>not a significant exporter</span>"}</dd>
    <dt>${K.calA}</dt><dd>${mlist(c.harvest)}</dd>${c.sow && c.sow.length ? `<dt>${K.calB}</dt><dd>${mlist(c.sow)}</dd>` : ""}
    <dt>Risk</dt><dd><div class="gauge" style="margin:6px 0 2px"><i style="width:${c.risk}%"></i></div><span class="xs muted">${c.risk}/100 · desk judgement</span></dd></dl>
    <p class="lbl" style="margin-top:12px">Conditions</p><p class="small" style="margin:4px 0 10px">${esc(c.cond)}</p>
    <div class="action"><b>Desk read.</b> ${esc(c.why)}</div>
    <p class="src">Source: <a href="${c.src[1]}" target="_blank" rel="noopener">${esc(c.src[0])}</a></p>
    <button class="btn" data-go="overview" id="co-globe">Show on globe</button>`;
  $("#co-globe").addEventListener("click", () => setTimeout(() => cardCountry(c), 80));
  barChart($("#co-mini"), D.world.years.map((y, i) => ({ label: y, vals: { p: c.prod[i] } })), [{ k: "p", name: "Output, Mt", color: K.hex }], { h: 150, unit: "Mt" });
}
function renderCal() {
  let h = `<span></span>` + MONTHS.map((m, i) => `<span class="h ${i + 1 === NOWM ? "" : ""}">${m[0]}</span>`).join("");
  [...D.countries].sort((a, b) => (b.prod[1] || 0) - (a.prod[1] || 0)).forEach(c => {
    h += `<span class="nm">${c.flag} ${esc(c.name)}</span>` + MONTHS.map((m, i) => { const mm = i + 1, cls = c.harvest.includes(mm) ? "h2" : c.sow.includes(mm) ? "p" : ""; return `<span class="c ${cls} ${mm === NOWM ? "now" : ""}" title="${esc(c.name)} · ${m}${cls === "h2" ? " · " + K.calA.toLowerCase() : cls === "p" ? " · " + K.calB.toLowerCase() : ""}"></span>`; }).join("");
  });
  $("#cal").innerHTML = h;
}

/* ---------- MARKET ---------- */
let MK = [], mkSel = [], mkRange = 60, mkMode = "abs";
R.market = () => {
  MK = K.mk; mkSel = [...K.mkSel];
  const kp = K.mkKpis();
  $("#mk-kpis").innerHTML = kp.map(k => `<div class="kpi"><p class="lbl">${k.l}</p><span class="fig">${k.f}</span><span class="sub">${k.s}</span></div>`).join("");
  $("#mk-series").innerHTML = MK.map(([k, c]) => `<button class="btn" data-k="${k}" aria-pressed="${mkSel.includes(k)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></i>${esc(P.series[k].name)}</button>`).join("");
  $("#mk-series").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.k; mkSel = mkSel.includes(k) ? mkSel.filter(x => x !== k) : [...mkSel, k]; if (!mkSel.length) mkSel = [K.base]; $$("#mk-series button").forEach(x => x.setAttribute("aria-pressed", mkSel.includes(x.dataset.k))); drawMarket(); });
  $("#mk-range").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mkRange = +b.dataset.r; $$("#mk-range button").forEach(x => x.setAttribute("aria-pressed", x === b)); drawMarket(); });
  $("#mk-mode").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mkMode = b.dataset.v; $$("#mk-mode button").forEach(x => x.setAttribute("aria-pressed", x === b)); drawMarket(); });
  drawMarket();
  lineChart($("#ch-curve"), curve.map(c => c.m), [{ name: CB.name, color: "#FF4F1F", vals: curve.map(c => c.c), dots: 1 }], { h: 200, yfmt: f0, tipfmt: K.curveTip, aria: CB.name + " forward curve" });
  $("#curve-note").innerHTML = K.curveNote() + ` <a href="${CB.src[1]}" target="_blank" rel="noopener">${esc(CB.src[0])}</a>`;
  const PB = B[K.physVs], CUR = { eur: "€", usd: "$", myr: "RM", cny: "¥" };
  $("#phys").innerHTML = `<thead><tr><th>Offer</th><th class="n">${K.physCur}</th><th class="n">$/t</th><th class="n">vs ${esc(K.physVsName)}</th></tr></thead><tbody>` + D.physical.map(p => { const u = toUSD(p.cur, p.px); return `<tr><td>${esc(p.name)} <span class="faint xs">${p.date.slice(5)}</span></td><td class="n">${f0(p.px)}</td><td class="n">${f0(u)}</td><td class="n">${sgn(u - PB.usd, f0)}</td></tr>`; }).join("") + "</tbody>";
  // correlations
  const rets = k => { const a = ser(k).slice(-61); return a.slice(1).map((d, i) => d[1] / a[i][1] - 1); };
  const base = rets(K.base), corr = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
  $("#corr").innerHTML = `<div class="wf">` + MK.filter(([k]) => k !== K.base).map(([k, col]) => { const r = corr(base, rets(k)); return `<div class="r"><span class="small">${esc(P.series[k].name)}</span><span class="trk"><span class="mid"></span><i style="left:${r >= 0 ? 50 : 50 + r * 50}%;width:${Math.abs(r) * 50}%;background:${col}"></i></span><span class="mono small" style="text-align:right">${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}</span></div>`; }).join("") + `</div>`;
};
function drawMarket() {
  const sel = mkSel.map(k => P.series[k]); let mode = mkMode;
  const units = new Set(sel.map(s => s.unit)); let warn = "";
  if (mode === "abs" && units.size > 1) { mode = "idx"; warn = " Mixed units, so shown indexed to 100."; }
  const n = Math.min(mkRange, ser(K.base).length), labels = ser(K.base).slice(-n).map(d => d[0]);
  const series = mkSel.map(k => { const d = ser(k).slice(-n).map(x => x[1]); let v = d;
    if (mode === "idx") v = d.map(x => x / d[0] * 100);
    if (mode === "yoy") { const full = ser(k), off = full.length - n; v = d.map((x, i) => full[off + i - 12] ? x / full[off + i - 12][1] - 1 : null); }
    return { name: P.series[k].name, color: MK.find(m => m[0] === k)[1], vals: v, width: k === K.base ? 2.2 : 1.5 }; });
  const u = [...units][0];
  $("#mk-title").textContent = mode === "abs" ? `Price history, ${u}` : mode === "idx" ? "Price history, indexed (start = 100)" : "Year-on-year change";
  lineChart($("#ch-market"), labels, series, { h: 300, zero: mode === "yoy", yfmt: mode === "yoy" ? v => Math.round(v * 100) + "%" : mode === "idx" ? f0 : (u === "$/kg" ? f2 : f0), tipfmt: mode === "yoy" ? v => pct(v) : mode === "idx" ? f1 : v => f1(v) + " " + u, aria: "Commodity price history", xEvery: Math.ceil(n / 6) });
  const nt = $("#ch-market").nextElementSibling; nt.textContent = K.mkNote + warn;
}

/* ---------- LOGISTICS ---------- */
R.logistics = () => {
  const kp = K.lgKpis();
  $("#lg-kpis").innerHTML = kp.map(k => `<div class="kpi"><p class="lbl">${k.l}</p><span class="fig">${k.f}</span><span class="sub">${k.s}</span></div>`).join("");
  drawMap2d();
  $("#choke").innerHTML = D.chokepoints.map(c => `<div class="card" data-c="${c.id}" tabindex="0"><div class="top2"><h3 style="margin:0">${esc(c.name)}</h3><span class="tag tag--${c.status === "ok" ? "ok" : c.status === "warn" ? "warn" : "bad"}">${c.status === "bad" ? "shut" : c.status === "warn" ? "strained" : "open"}</span></div>
    <span class="small" style="color:${stCol[c.status]}">${esc(c.label)}</span><span class="small muted">${esc(c.detail)}</span><span class="src"><a href="${c.src[1]}" target="_blank" rel="noopener">${esc(c.src[0])}</a></span></div>`).join("");
  $("#choke").addEventListener("click", e => { const c = e.target.closest("[data-c]"); if (!c || e.target.closest("a")) return; const d = $(`#map2d [data-cp="${c.dataset.c}"]`); if (d) { $("#map2d").scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); d.animate([{ r: 6 }, { r: 22 }, { r: 6 }], { duration: 1200, iterations: 2 }); } });
  $("#riskwf").innerHTML = RISK.map(r => `<div class="r" title="${esc(r.why)}"><span class="small">${esc(r.n)} <span class="faint xs">×${r.w}</span></span><span class="trk"><i style="left:0;width:${r.v}%;background:${riskCol(r.v)}"></i></span><span class="mono small" style="text-align:right">${r.v}</span></div><div class="xs faint" style="margin:-4px 0 4px">${esc(r.why)}</div>`).join("") +
    `<div class="r" style="border-top:1px solid var(--line-2);padding-top:8px"><b class="small">Desk risk index</b><span class="trk"><i style="left:0;width:${RISKIDX}%;background:${riskCol(RISKIDX)}"></i></span><b class="mono" style="text-align:right">${RISKIDX}</b></div>`;
};
function drawMap2d() {
  const Wd = 1000, top = 78, bot = -56, H = Math.round(Wd * (top - bot) / 360);
  const X = lng => (lng + 180) / 360 * Wd, Y = lat => (top - lat) / (top - bot) * H;
  const ring = r => r.map(([lng, lat], i) => (i ? "L" : "M") + X(lng).toFixed(1) + "," + Y(lat).toFixed(1)).join("") + "Z";
  let s = `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="World map of ${K.noun} export lanes and chokepoints"><defs><clipPath id="mclip"><rect width="${Wd}" height="${H}"/></clipPath></defs><g clip-path="url(#mclip)">`;
  GEO.features.forEach(f => { if (f.properties.iso === "ATA") return; const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    s += `<path class="land ${isoTo[f.properties.iso] ? "hl" : ""}" d="${polys.map(p => p.map(ring).join("")).join("")}"><title>${esc(f.properties.name)}</title></path>`; });
  const maxE = Math.max(...D.countries.map(c => c.exp));
  D.flows.forEach(([cid, ii]) => { const a = byId[cid], b = D.importers[ii]; let bl = b.lng; if (bl - a.lng > 180) bl -= 360; if (a.lng - bl > 180) bl += 360;
    [0, -360, 360].forEach(sh => { const x1 = X(a.lng + sh), y1 = Y(a.lat), x2 = X(bl + sh), y2 = Y(b.lat), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * .18 - 10;
      if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > Wd) return;
      s += `<path class="route" d="M${x1},${y1}Q${mx},${my} ${x2},${y2}" stroke="rgba(142,197,255,${.35 + .5 * a.exp / maxE})" style="stroke-width:${.8 + 2.2 * a.exp / maxE}"><title>${esc(a.name)} → ${esc(b.name)} (typical lane)</title></path>`; }); });
  D.countries.filter(c => c.exp >= K.expMin).forEach(c => s += `<circle cx="${X(c.lng)}" cy="${Y(c.lat)}" r="${2.5 + 5 * c.exp / maxE}" fill="${K.hex}" opacity=".9"><title>${esc(c.name)}: ${c.exp} Mt exports ${YR[2]}</title></circle><text x="${X(c.lng) + 7}" y="${Y(c.lat) - 6}" style="font:10px var(--mono);fill:${K.hex}">${esc(c.short || c.name.replace("United States", "USA"))}</text>`);
  D.importers.forEach(b => s += `<circle cx="${X(b.lng)}" cy="${Y(b.lat)}" r="3" fill="none" stroke="#8EC5FF"/><text x="${X(b.lng) + 6}" y="${Y(b.lat) + 12}" style="font:9.5px var(--mono);fill:#8EC5FF">${esc(b.name)}</text>`);
  D.chokepoints.forEach(c => s += `<circle data-cp="${c.id}" cx="${X(c.lng)}" cy="${Y(c.lat)}" r="6" fill="${stCol[c.status]}" fill-opacity=".22" stroke="${stCol[c.status]}" stroke-width="1.5"><title>${esc(c.name)}: ${esc(c.label)}</title></circle>`);
  s += `</g></svg>`;
  $("#map2d").innerHTML = s;
}

/* ---------- NEWS ---------- */
let nwDir = "all";
R.news = () => {
  const themes = [...new Set(D.news.map(n => n.theme))].sort();
  $("#nw-theme").innerHTML = `<option value="">All themes</option>` + themes.map(t => `<option>${esc(t)}</option>`).join("");
  const cs = [...new Set(D.news.flatMap(n => n.c))];
  $("#nw-country").innerHTML = `<option value="">All countries</option>` + cs.map(c => `<option value="${c}">${byId[c].flag} ${esc(byId[c].name)}</option>`).join("");
  $("#nw-dir").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; nwDir = b.dataset.d; $$("#nw-dir button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderNews(); });
  ["#nw-theme", "#nw-country", "#nw-sort"].forEach(s => $(s).addEventListener("change", renderNews));
  renderNews();
  // theme sentiment
  const sums = themes.map(t => [t, D.news.filter(n => n.theme === t).reduce((s, n) => s + n.dir * n.imp, 0)]);
  const mx = Math.max(...sums.map(s => Math.abs(s[1])));
  $("#nw-themes").innerHTML = `<div class="wf">` + sums.map(([t, v]) => `<div class="r"><span class="small">${esc(t)}</span><span class="trk"><span class="mid"></span><i style="left:${v >= 0 ? 50 : 50 + v / mx * 50}%;width:${Math.abs(v) / mx * 50}%;background:${v > 0 ? "var(--bad)" : "var(--ok)"}"></i></span><span class="mono small" style="text-align:right">${v > 0 ? "+" : ""}${v}</span></div>`).join("") + `</div>`;
  // weekly pressure
  const wk = d => { const t = new Date(d), j = new Date(t.getFullYear(), 0, 1); return Math.ceil(((t - j) / 864e5 + j.getDay() + 1) / 7); };
  const weeks = {}; D.news.forEach(n => { const k = wk(n.d); weeks[k] = (weeks[k] || 0) + n.dir * n.imp; });
  const ks = Object.keys(weeks).map(Number).sort((a, b) => a - b), all = []; for (let k = ks[0]; k <= ks.at(-1); k++) all.push(k);
  let cum = 0;
  lineChart($("#ch-news"), all.map(k => "W" + k), [{ name: "Weekly net", color: "#FF4F1F", vals: all.map(k => weeks[k] || 0), dots: 1 }, { name: "Cumulative", color: "#8EC5FF", vals: all.map(k => cum += weeks[k] || 0), dash: "4 3", width: 1.4 }], { h: 190, zero: true, yfmt: f0, aria: "Net news pressure by week" });
};
function renderNews() {
  const th = $("#nw-theme").value, co = $("#nw-country").value, so = $("#nw-sort").value;
  let L = D.news.filter(n => (nwDir === "all" || n.dir === +nwDir) && (!th || n.theme === th) && (!co || n.c.includes(co)));
  if (so === "imp") L = [...L].sort((a, b) => b.imp - a.imp || b.d.localeCompare(a.d));
  $("#news-list").innerHTML = L.length ? L.map(n => { const dt = new Date(n.d); return `<article class="news-card" id="nc-${n.id}"><div class="dt"><b>${dt.getDate()}</b>${MONTHS[dt.getMonth()]}</div>
    <div><div class="pill-row" style="margin-bottom:5px;align-items:center">${dirTag(n.dir)}<span class="tag tag--mute">${esc(n.theme)}</span>${impBars(n.imp)}${n.c.map(c => `<span title="${esc(byId[c].name)}">${byId[c].flag}</span>`).join("")}</div>
    <h3 style="font-size:14.5px">${esc(n.h)}</h3><p class="small" style="margin:2px 0">${esc(n.s)}</p><p class="so"><b style="color:var(--bone)">For buyers:</b> ${esc(n.so)}</p>
    <p class="src" style="margin:4px 0 0">${esc(n.pub)} · <a href="${n.src}" target="_blank" rel="noopener">source</a></p></div>${starBtn("n", n.id, n.h)}</article>`; }).join("") : `<div class="wl-empty">No stories match these filters.</div>`;
}

/* ---------- INNOVATION ---------- */
let inCat = "all", inView = "cards";
const STAGES = ["Research", "Pilot", "Early commercial", "Scaling", "Mature"];
R.innovation = () => {
  const tabs = [{ id: "all", name: "All five", color: "var(--bone)" }, ...D.cats];
  $("#cat-tabs").innerHTML = tabs.map(c => `<button data-c="${c.id}" aria-pressed="${c.id === inCat}"><i style="background:${c.color}"></i>${esc(c.name)} <span class="mono faint xs">${c.id === "all" ? D.innovations.length : D.innovations.filter(x => x.cat === c.id).length}</span></button>`).join("");
  $("#cat-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; inCat = b.dataset.c; $$("#cat-tabs button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderInno(); });
  $("#in-type").innerHTML = `<option value="">All impact types</option>` + [...new Set(D.innovations.map(i => i.type))].sort().map(t => `<option>${esc(t)}</option>`).join("");
  $("#in-region").innerHTML = `<option value="">All regions</option>` + [...new Set(D.innovations.map(i => i.region))].sort().map(t => `<option>${esc(t)}</option>`).join("");
  ["#in-type", "#in-region", "#in-sort"].forEach(s => $(s).addEventListener("change", renderInno));
  $("#in-view").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; inView = b.dataset.v; $$("#in-view button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderInno(); });
  renderInno();
};
function innoList() {
  const t = $("#in-type").value, r = $("#in-region").value, so = $("#in-sort").value;
  return D.innovations.filter(i => (inCat === "all" || i.cat === inCat) && (!t || i.type === t) && (!r || i.region === r))
    .sort((a, b) => so === "stage" ? b.stage - a.stage || b.imp - a.imp : so === "horizon" ? a.horizon - b.horizon || b.imp - a.imp : b.imp - a.imp || b.stage - a.stage);
}
function renderInno() {
  const L = innoList(), body = $("#in-body");
  if (!L.length) { body.innerHTML = `<div class="wl-empty">Nothing matches these filters.</div>`; return; }
  if (inView === "cards") {
    body.innerHTML = `<div class="inno-list">` + L.map(i => { const c = catBy[i.cat]; return `<article class="inno" id="in-${i.id}"><span class="cbar" style="background:${c.color}"></span>
      <div class="hd"><div><p class="lbl" style="color:${c.color}">${esc(c.name)}</p><h3 style="font-size:14.5px;margin:3px 0 0">${esc(i.name)}</h3><div class="org">${esc(i.org)}</div></div>${starBtn("i", i.id, i.name)}</div>
      <div><div class="stage" aria-label="Stage ${i.stage} of 5: ${STAGES[i.stage - 1]}">${[1,2,3,4,5].map(s => `<i class="${s <= i.stage ? "on" : ""}"></i>`).join("")}</div><span class="xs muted">${STAGES[i.stage - 1]} · scale in ~${i.horizon}y · adoption ~${i.adopt}%</span></div>
      <div class="pill-row"><span class="tag">${"●".repeat(i.imp)}<span style="opacity:.3">${"●".repeat(5 - i.imp)}</span> impact</span><span class="tag tag--mute">${esc(i.type)}</span><span class="tag tag--sky">${esc(i.region)}</span></div>
      <p class="small" style="margin:0">${esc(i.what)}</p><p class="small" style="margin:0"><b>For buyers:</b> <span class="muted">${esc(i.buyer)}</span></p>
      <div class="ms"><b style="color:var(--bone)">Milestone.</b> ${esc(i.ms)}<div class="src" style="margin-top:4px">${i.src.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])}</a>`).join(" · ")}</div></div></article>`; }).join("") + `</div>`;
  } else if (inView === "matrix") {
    const Wd = Math.max(560, cw(body) - 34), H = Math.round(Math.min(460, Math.max(360, Wd * .5))), Lm = 50, Rm = 16, T = 16, Bm = 44, x = s => Lm + (Wd - Lm - Rm) * (s - .5) / 5, y = v => T + (H - T - Bm) * (1 - (v - .5) / 5);
    const cellW = (Wd - Lm - Rm) / 5, cnt = {}, seen = {};
    L.forEach(i => { const k = i.stage + "-" + i.imp; cnt[k] = (cnt[k] || 0) + 1; });
    let s = `<div class="panel"><div class="chart"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Innovation impact against maturity"><g class="grid">`;
    for (let i = 1; i <= 5; i++) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - Bm}"/><line x1="${Lm}" x2="${Wd - Rm}" y1="${y(i)}" y2="${y(i)}"/>`;
    s += `</g><rect x="${x(3)}" y="${T}" width="${x(5.5) - x(3)}" height="${y(3) - T}" fill="rgba(255,79,31,.06)"/><text class="ax" x="${Wd - Rm - 6}" y="${T + 14}" text-anchor="end" style="fill:var(--ember)">Act now: high impact, ready</text>`;
    for (let i = 1; i <= 5; i++) s += `<text class="ax" x="${x(i)}" y="${H - Bm + 16}" text-anchor="middle">${STAGES[i - 1]}</text><text class="ax" x="${Lm - 10}" y="${y(i) + 3}" text-anchor="end">${i}</text>`;
    s += `<text class="ax" x="${(Wd + Lm) / 2}" y="${H - 6}" text-anchor="middle">Maturity →</text><text class="ax" transform="translate(14 ${(H - Bm) / 2}) rotate(-90)" text-anchor="middle">Impact on a ${K.noun} buyer (desk) →</text>`;
    let key = "";
    L.forEach((i, idx) => { const k = i.stage + "-" + i.imp, m = cnt[k], n = seen[k] = (seen[k] || 0) + 1, step = Math.min(30, cellW * .8 / Math.max(1, m - 1)), cx = x(i.stage) + (m > 1 ? (n - (m + 1) / 2) * step : 0), cy = y(i.imp), c = catBy[i.cat], r = 8 + Math.sqrt(i.adopt) * 1.3, no = idx + 1;
      s += `<g class="pt" data-i="${i.id}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.color}" fill-opacity=".28" stroke="${c.color}" stroke-width="1.5"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" style="font:600 11px var(--mono);fill:var(--text);pointer-events:none">${no}</text><title>${esc(i.name)} · ${STAGES[i.stage - 1]} · impact ${i.imp}/5 · adoption ~${i.adopt}%</title></g>`;
      key += `<button data-i="${i.id}"><b style="color:${c.color}">${no}</b><span>${esc(i.name)}</span></button>`; });
    s += `</svg></div><div class="chart-legend">${D.cats.map(c => `<span><i style="background:${c.color}"></i>${esc(c.name)}</span>`).join("")}<span>Bubble size: adoption (desk)</span></div><div class="mx-key">${key}</div></div>`;
    body.innerHTML = s;
    $$(".pt, .mx-key button", body).forEach(g => g.addEventListener("click", () => { inView = "cards"; $$("#in-view button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === "cards")); renderInno(); const c = $("#in-" + g.dataset.i); if (c) { c.scrollIntoView({ block: "center" }); c.animate([{ borderColor: "#FF4F1F" }, { borderColor: "rgba(242,238,230,.1)" }], 1600); } }));
  } else {
    const yrs = 7, cats = D.cats.filter(c => L.some(i => i.cat === c.id));
    let s = `<div class="panel"><div class="tbl-wrap"><div style="min-width:640px"><div style="display:grid;grid-template-columns:150px repeat(${yrs},1fr);gap:2px;font:10.5px var(--mono);color:var(--faint);margin-bottom:6px"><span></span>${Array.from({ length: yrs }, (_, k) => `<span>${2026 + k}</span>`).join("")}</div>`;
    cats.forEach(c => { const items = L.filter(i => i.cat === c.id);
      s += `<div style="display:grid;grid-template-columns:150px 1fr;gap:2px;align-items:start;border-top:1px solid var(--line);padding:8px 0"><span class="small" style="color:${c.color}">${esc(c.name)}</span><div style="position:relative;height:${items.length * 26}px">` +
        items.map((i, k) => `<div title="${esc(i.ms)}" style="position:absolute;top:${k * 26}px;left:0;width:${Math.min(100, (i.horizon + .5) / yrs * 100)}%;height:20px;border-radius:3px;background:linear-gradient(90deg,transparent,${c.color}33 30%,${c.color}88);display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:11.5px;white-space:nowrap">${esc(i.name)} <span class="mono faint" style="margin-left:6px">~${2026 + i.horizon}</span></div>`).join("") + `</div></div>`; });
    s += `</div></div><p class="note">Bars run from today to the year the desk expects each to reach scale in ${K.noun}. Hover for the latest milestone.</p></div>`;
    body.innerHTML = s;
  }
}

/* ---------- SCENARIOS ---------- */
let SHOCKS = [], PRESETS = [];
let SC = {};
R.scenarios = () => {
  SHOCKS = K.shocks; PRESETS = K.presets;
  $("#presets").innerHTML = PRESETS.map(([n], i) => `<button class="btn" data-p="${i}" aria-pressed="${i === 0}">${esc(n)}</button>`).join("");
  $("#presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; setPreset(+b.dataset.p); $$("#presets button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  $("#shocks").innerHTML = SHOCKS.map(s => `<div class="shock off" id="sh-${s.id}"><input type="checkbox" id="cb-${s.id}" aria-label="Turn on ${esc(s.n)}"><label for="cb-${s.id}">${esc(s.n)}</label>
    <div class="ctl"><input type="range" id="rg-${s.id}" min="${s.min}" max="${s.max}" step="${s.st}" value="${s.def}" aria-label="${esc(s.n)} size"><output id="o-${s.id}"></output></div><span class="why">${esc(s.why)}</span></div>`).join("");
  SHOCKS.forEach(s => { $("#cb-" + s.id).addEventListener("change", () => { $$("#presets button").forEach(x => x.setAttribute("aria-pressed", "false")); runScenario(); });
    $("#rg-" + s.id).addEventListener("input", () => { $("#cb-" + s.id).checked = true; $$("#presets button").forEach(x => x.setAttribute("aria-pressed", "false")); runScenario(); }); });
  $("#elas").value = K.elas || 1.6;
  $("#elas").addEventListener("input", runScenario); ["#vol", "#hedged"].forEach(s => $(s).addEventListener("input", runScenario));
  $("#sc-reset").addEventListener("click", () => { setPreset(0); $("#elas").value = K.elas || 1.6; $$("#presets button").forEach((x, i) => x.setAttribute("aria-pressed", i === 0)); runScenario(); });
  runScenario();
};
function setPreset(i) { const p = PRESETS[i][1]; SHOCKS.forEach(s => { $("#cb-" + s.id).checked = p[s.id] != null; $("#rg-" + s.id).value = p[s.id] ?? s.def; }); runScenario(); }
function scenarioCalc(on, b) {
  const P0 = B[K.scBench].usd, U = W.consumption[2], S0 = W.stocksUSDA;
  const priceAt = dS => P0 * Math.pow(Math.max(.12, (S0 + dS) / U) / STU0, -b);
  let dS = 0, add = 0; const parts = [];
  SHOCKS.forEach(s => { if (!on[s.id] && on[s.id] !== 0) return; const v = on[s.id];
    if (s.eff) { const e = s.eff(v); dS += e; parts.push({ n: s.n, v: priceAt(e) - P0, kind: "f" }); } else { const a = s.add(v); add += a; parts.push({ n: s.n, v: a, kind: "a" }); } });
  const fund = priceAt(dS); const fsum = parts.filter(p => p.kind === "f").reduce((s, p) => s + p.v, 0), inter = fund - P0 - fsum;
  if (Math.abs(inter) > .5) parts.push({ n: inter > 0 ? "Shocks compounding" : "Overlap: stocks-to-use floored at 12%", v: inter, kind: "i" });
  return { P0, P: fund + add, dS, stu: Math.max(.12, (S0 + dS) / U), parts };
}
function runScenario() {
  const b = +$("#elas").value; $("#elas-o").textContent = "−" + b.toFixed(1);
  const on = {};
  SHOCKS.forEach(s => { const v = +$("#rg-" + s.id).value, act = $("#cb-" + s.id).checked; $("#o-" + s.id).textContent = (s.u === "$/t" || s.u === "$/bbl" ? "$" : "") + (s.st < 1 ? f1(v) : f0(v)) + (s.u === "%" ? "%" : s.u === "Mt" ? " Mt" : ""); $("#sh-" + s.id).classList.toggle("off", !act); if (act) on[s.id] = v; });
  const r = SC = scenarioCalc(on, b), ch = r.P / r.P0 - 1;
  $("#res-figs").innerHTML = [
    { l: "Scenario price", f: `$${f1(r.P)}`, s: K.scEquiv(r.P) },
    { l: "vs today", f: `<span class="${ch > .001 ? "up" : ch < -.001 ? "dn" : ""}">${pct(ch)}</span>`, s: `from $${f1(r.P0)} ${K.scBenchName}` },
    { l: "Stocks-to-use", f: (r.stu * 100).toFixed(1) + "%", s: `${sgn(r.dS)} Mt to exporters' supply` },
    { l: "Elasticity", f: `−${b.toFixed(1)}`, s: `price ∝ (stocks-to-use)^b` }
  ].map(k => `<div class="kpi"><p class="lbl">${k.l}</p><span class="fig">${k.f}</span><span class="sub">${k.s}</span></div>`).join("");
  // fan: base = futures curve interpolated; scenario converges over 3 months
  const sig = volSRW(), [labels, cv] = K.fan();
  const sc = cv.map((v, i) => v * (1 + ch * Math.min(1, i / 3)));
  const lo = sc.map((v, i) => v * Math.exp(-1.2816 * sig * Math.sqrt(i))), hi = sc.map((v, i) => v * Math.exp(1.2816 * sig * Math.sqrt(i)));
  lineChart($("#ch-fan"), labels, [{ name: "Futures curve (base)", color: "#A7A298", vals: cv, dash: "4 3", width: 1.4 }, { name: "Scenario", color: "#FF4F1F", vals: sc, width: 2.2, dots: 1 }], { h: 220, band: { lo, hi }, yfmt: f0, tipfmt: v => "$" + f1(v), aria: "Scenario price path" });
  $("#ch-fan").nextElementSibling.textContent = `Shaded band: 80% range from monthly ${K.noun} price volatility over the last five years (${(sig * 100).toFixed(1)}% a month), around the scenario path. Base is the ${CB.name} curve in $/t.`;
  const mx = Math.max(10, ...r.parts.map(p => Math.abs(p.v)));
  $("#wf").innerHTML = r.parts.length ? r.parts.map(p => `<div class="r"><span class="small">${esc(p.n)}</span><span class="trk"><span class="mid"></span><i style="left:${p.v >= 0 ? 50 : 50 + p.v / mx * 50}%;width:${Math.abs(p.v) / mx * 50}%;background:${p.v > 0 ? "var(--bad)" : "var(--ok)"}"></i></span><span class="mono small" style="text-align:right">${sgn(p.v)}</span></div>`).join("") +
    `<div class="r" style="border-top:1px solid var(--line-2);padding-top:6px"><b class="small">Net change</b><span></span><b class="mono" style="text-align:right">${sgn(r.P - r.P0)}</b></div>` : `<p class="muted small">Turn a shock on, or pick a preset.</p>`;
  // exposure
  const V = +$("#vol").value || 0, h = clamp(+$("#hedged").value || 0, 0, 100) / 100, open = V * (1 - h), dc = open * (r.P - r.P0);
  const rec = clamp(Math.round((40 + (RISKIDX - 50) * .5 + (ch > .05 ? 15 : ch > .02 ? 8 : ch < -.05 ? -10 : 0)) / 5) * 5, 20, 85);
  $("#exposure").innerHTML = `<div class="res-figs" style="margin-bottom:6px"><div class="kpi"><p class="lbl">Budget at today</p><span class="fig">$${f0(V * r.P0 / 1e6 * 10) / 10 > 0 ? f1(V * r.P0 / 1e6) : "0"}m</span><span class="sub">${f0(V)} t × $${f1(r.P0)}</span></div>
    <div class="kpi"><p class="lbl">Open volume</p><span class="fig">${f0(open)} t</span><span class="sub">${Math.round((1 - h) * 100)}% unpriced</span></div>
    <div class="kpi"><p class="lbl">Cost change</p><span class="fig ${dc > 0 ? "up" : dc < 0 ? "dn" : ""}">${dc >= 0 ? "+" : "−"}$${f1(Math.abs(dc) / 1e6)}m</span><span class="sub">on open volume</span></div>
    <div class="kpi"><p class="lbl">Rule-of-thumb cover</p><span class="fig">${rec}%</span><span class="sub">you hold ${Math.round(h * 100)}%</span></div></div>
    <div class="action">${rec > h * 100 + 4 ? `Add about ${f0(V * (rec / 100 - h))} t of cover to reach ${rec}%: ${K.coverWhere || "forward months first, where the curve pays carry"}.` : rec < h * 100 - 4 ? `You hold more cover than the rule suggests; let ${f0(V * (h - rec / 100))} t roll off rather than adding.` : `Cover is in line with the rule of thumb. Hold, and re-check after ${K.holdCheck}.`}</div>
    <p class="note">Futures price only; basis, freight and currency excluded. The cover rule starts at 40% and moves with the desk risk index and the scenario. A rule of thumb, not advice.</p>`;
}
let _vol = null;
function volSRW() { if (_vol) return _vol; const a = ser(K.volK).slice(-61).map(d => d[1]), r = a.slice(1).map((v, i) => Math.log(v / a[i])), m = r.reduce((s, v) => s + v, 0) / r.length; return _vol = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (r.length - 1)); }

/* ---------- MODELS ---------- */
const MODELS = [
  { id: "rw", n: "Random walk", d: "Next price = today's. The benchmark to beat.", f: (x, t, h) => x[t] },
  { id: "drift", n: "Drift", d: "Today's price grown at its 36-month average rate.", f: (x, t, h) => { const k = Math.min(36, t); return x[t] * Math.exp(h * Math.log(x[t] / x[t - k]) / k); } },
  { id: "ar1", n: "AR(1) mean reversion", d: "Pulls back towards the 5-year average at a fitted speed.", f: (x, t, h) => { const k = Math.min(60, t), lg = x.slice(t - k, t + 1).map(Math.log), m = lg.reduce((s, v) => s + v, 0) / lg.length; let num = 0, den = 0; for (let i = 1; i < lg.length; i++) { num += (lg[i] - m) * (lg[i - 1] - m); den += (lg[i - 1] - m) ** 2; } const ph = clamp(num / den, 0, .995); return Math.exp(m + Math.pow(ph, h) * (lg.at(-1) - m)); } },
  { id: "mom", n: "Momentum", d: "Extends half of the last three months' trend.", f: (x, t, h) => x[t] * Math.exp(.5 * h * Math.log(x[t] / x[t - 3]) / 3) },
  { id: "seas", n: "Seasonal naive", d: "Applies last year's move over the same months.", f: (x, t, h) => x[t] * x[t + h - 12] / x[t - 12] },
  { id: "ma", n: "12-month average", d: "The average of the past year.", f: (x, t, h) => x.slice(t - 11, t + 1).reduce((s, v) => s + v, 0) / 12 }
];
let mdK = K.mdK, mdH = 3;
R.models = () => {
  $("#md-series").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mdK = b.dataset.k; $$("#md-series button").forEach(x => x.setAttribute("aria-pressed", x === b)); runModels(); });
  $("#md-h").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mdH = +b.dataset.h; $$("#md-h button").forEach(x => x.setAttribute("aria-pressed", x === b)); runModels(); });
  $("#approaches").innerHTML = D.approaches.map(([a, b]) => `<div class="model-row" style="grid-template-columns:1fr"><div><h3 style="margin:0 0 2px">${esc(a)}</h3><span class="small muted">${esc(b)}</span></div></div>`).join("");
  $("#products").innerHTML = D.products.map(([a, b]) => `<div class="model-row" style="grid-template-columns:1fr"><div><h3 style="margin:0 0 2px">${esc(a)}</h3><span class="small muted">${esc(b)}</span></div></div>`).join("") + `<p class="note">Named as reference points for what professional desks use; Procis is not affiliated with them.</p>`;
  runModels();
};
function backtest(x, h) {
  const N = x.length, res = MODELS.map(m => ({ ...m, err: [], hit: 0, nh: 0 }));
  for (let t = N - 60 - h; t <= N - 1 - h; t++) {
    if (t < 61) continue;
    res.forEach(m => { const f = m.f(x, t, h), a = x[t + h]; m.err.push(Math.abs(f - a) / a); if (m.id !== "rw" && m.id !== "ma" || m.id === "ma") { const df = f - x[t], da = a - x[t]; if (Math.abs(df) > 1e-9) { m.nh++; if (Math.sign(df) === Math.sign(da)) m.hit++; } } });
  }
  res.forEach(m => m.mape = m.err.reduce((s, v) => s + v, 0) / m.err.length);
  const inv = res.map(m => 1 / m.mape), tot = inv.reduce((s, v) => s + v, 0); res.forEach((m, i) => m.w = inv[i] / tot);
  // ensemble backtest
  let ee = []; for (let t = N - 60 - h; t <= N - 1 - h; t++) { if (t < 61) continue; const f = res.reduce((s, m) => s + m.w * m.f(x, t, h), 0); ee.push(Math.abs(f - x[t + h]) / x[t + h]); }
  return { res, ens: ee.reduce((s, v) => s + v, 0) / ee.length };
}
function runModels() {
  const full = ser(mdK), x = full.map(d => d[1]), N = x.length, { res, ens } = backtest(x, mdH);
  const best = [...res].sort((a, b) => a.mape - b.mape)[0];
  $("#md-win").textContent = `Best single: ${best.n}`;
  $("#md-board").innerHTML = [...res].sort((a, b) => a.mape - b.mape).map(m => `<div class="model-row"><div><b style="font-weight:600">${esc(m.n)}</b><div class="xs muted">${esc(m.d)}</div></div><span class="mono">${(m.mape * 100).toFixed(1)}%</span><span class="mono">${m.nh ? Math.round(m.hit / m.nh * 100) + "%" : "—"}</span><span class="wcol"><span class="wbar"><i style="width:${m.w * 100}%"></i></span><span class="xs mono muted">${Math.round(m.w * 100)}%</span></span></div>`).join("") +
    `<div class="model-row" style="border-top:1px solid var(--line-2)"><div><b style="color:var(--ember)">Ensemble</b><div class="xs muted">Weighted blend of all six</div></div><span class="mono" style="color:var(--ember)">${(ens * 100).toFixed(1)}%</span><span></span><span class="wcol xs muted">${ens < best.mape ? "beats the best single model" : "close to the best single model"}</span></div>`;
  // forecasts 1..6 from last point, each model at each horizon
  const H = 6, hist = 30, lab = full.slice(-hist).map(d => d[0]); const [ly, lm] = full.at(-1)[0].split("-").map(Number);
  for (let h = 1; h <= H; h++) { const m = (lm + h - 1) % 12, y = ly + Math.floor((lm + h - 1) / 12); lab.push(`${y}-${String(m + 1).padStart(2, "0")}`); }
  const pad = v => Array(hist - 1).fill(null).concat([x[N - 1]], v);
  const fcs = res.map(m => { const v = []; for (let h = 1; h <= H; h++) v.push(m.f(x, N - 1, h)); return v; });
  const ensF = Array.from({ length: H }, (_, h) => res.reduce((s, m, i) => s + m.w * fcs[i][h], 0));
  const errH = h => backtest(x, h).ens; const eh = Array.from({ length: H }, (_, h) => errH(h + 1));
  const lo = pad(ensF.map((v, h) => v * (1 - 1.28 * eh[h] * 1.25))), hi = pad(ensF.map((v, h) => v * (1 + 1.28 * eh[h] * 1.25)));
  const fv = K.fan()[1], cr = fv.slice(0, 6).map(v => v / fv[0]);
  const futF = cr.map(r => x[N - 1] * r);
  const cols = ["#6F6B64", "#9FD3A8", "#8EC5FF", "#C9A7FF", "#F2C14E", "#A7A298"];
  const series = [{ name: "Actual", color: K.hex, vals: x.slice(-hist).concat(Array(H).fill(null)), width: 2.2 },
    ...res.map((m, i) => ({ name: m.n, color: cols[i], vals: pad(fcs[i]), width: 1, op: .55, dash: "3 3" })),
    { name: "Futures-implied", color: "#F2EEE6", vals: pad(futF), width: 1.4, dash: "6 3" },
    { name: "Ensemble", color: "#FF4F1F", vals: pad(ensF), width: 2.4, dots: 1 }];
  lineChart($("#ch-fc"), lab, series, { h: 300, band: { lo, hi, color: "rgba(255,79,31,.12)" }, vline: hist - 1, vlabel: "forecast →", yfmt: f0, tipfmt: v => "$" + f1(v), aria: "Price forecast", xEvery: 6 });
  $("#fc-legend").innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("") + `<span class="faint">Band: ensemble's backtest error, 80%</span>`;
  const e6 = ensF[5], e3 = ensF[2];
  $("#fc-legend").insertAdjacentHTML("afterend", `<p class="note" id="fc-note"></p>`); const old = $$("#fc-note"); old.slice(0, -1).forEach(o => o.remove());
  $("#fc-note").innerHTML = `${esc(P.series[mdK].name)} (${K.mdWhat}, monthly average). Ensemble: $${f0(e3)} in 3 months (${pct(e3 / x[N - 1] - 1)}), $${f0(e6)} in 6 (${pct(e6 / x[N - 1] - 1)}). Futures-implied applies the ${CB.name} curve's shape to the latest price. ${K.mdCaveat}`;
}

/* ---------- PLAYBOOK ---------- */
R.playbook = () => {
  const daysTo = d => Math.round((new Date(d) - new Date(D.asOf)) / 864e5);
  const recent = D.news.filter(n => daysTo(n.d) >= -14).reduce((s, n) => s + n.dir * n.imp, 0);
  const rules = K.rules(daysTo, recent);
  const ord = { fire: 0, arm: 1, calm: 2 };
  $("#rules").innerHTML = rules.sort((a, b) => ord[a.st] - ord[b.st]).map(r => `<div class="rule"><span class="st ${r.st}">${r.st === "fire" ? "Firing" : r.st === "arm" ? "Armed" : "Quiet"}</span><div><h3>${esc(r.t)}</h3><div class="xs muted mono" style="margin-bottom:4px">Trigger: ${esc(r.tr)} · Now: ${esc(r.now)}</div><span class="small">${esc(r.a)}</span></div></div>`).join("");
  const base = clamp(Math.round((40 + (RISKIDX - 50) * .5) / 5) * 5, 20, 85);
  const q = K.ladder();
  $("#ladder-tag").textContent = `Risk index ${RISKIDX}`;
  $("#ladder").innerHTML = q.map(([n, c, m], i) => { const cov = Math.max(10, base + (i === 0 ? 10 : 0) - i * 10); return `<div class="step"><p class="lbl">${n}</p><span class="fig">${cov}%</span><span class="xs muted">cover · $${f1(c)}/t<br>${m}</span><div class="gauge"><i style="width:${cov}%;background:var(--ember)"></i></div></div>`; }).join("");
  const cats = K.cats;
  $("#catalysts").innerHTML = cats.map(([d, t, s]) => { const n = daysTo(d); return `<div class="rule" style="grid-template-columns:70px 1fr"><span class="mono small ${n <= 45 ? "" : "muted"}" style="color:${n <= 45 ? "var(--ember)" : ""}">${n <= 0 ? "now" : n + "d"}</span><div><h3>${esc(t)}</h3><span class="small muted">${d} · ${esc(s)}</span></div></div>`; }).join("");
};

/* ---------- WATCHLIST ---------- */
const ALB = () => K.alb();
function renderWatch() {
  const c = S.stars.c.map(id => byId[id]).filter(Boolean), n = S.stars.n.map(id => D.news.find(x => x.id === id)).filter(Boolean), i = S.stars.i.map(id => D.innovations.find(x => x.id === id)).filter(Boolean);
  $("#wl-list").innerHTML = (c.length + n.length + i.length) ? [
    c.length ? `<p class="lbl" style="margin:4px 0 6px">Countries</p>` + c.map(x => `<div class="rule" style="grid-template-columns:1fr auto;padding:8px 0"><div><b>${x.flag} ${esc(x.name)}</b> <span class="tag tag--${x.risk >= 70 ? "bad" : x.risk >= 45 ? "warn" : "ok"}">risk ${x.risk}</span><div class="small muted">${esc(x.cond)}</div></div><div>${starBtn("c", x.id, x.name)}</div></div>`).join("") : "",
    n.length ? `<p class="lbl" style="margin:12px 0 6px">Stories</p>` + n.map(x => `<div class="rule" style="grid-template-columns:1fr auto;padding:8px 0"><div><span class="xs mono muted">${x.d}</span> ${dirTag(x.dir)}<div class="small">${esc(x.h)}</div><div class="xs muted">${esc(x.so)}</div></div><div>${starBtn("n", x.id, x.h)}</div></div>`).join("") : "",
    i.length ? `<p class="lbl" style="margin:12px 0 6px">Innovations</p>` + i.map(x => `<div class="rule" style="grid-template-columns:1fr auto;padding:8px 0"><div><b>${esc(x.name)}</b> <span class="xs muted">${esc(catBy[x.cat].name)} · ${STAGES[x.stage - 1]}</span><div class="small muted">${esc(x.ms)}</div></div><div>${starBtn("i", x.id, x.name)}</div></div>`).join("") : ""
  ].join("") : `<div class="wl-empty">Nothing starred yet. Use ★ on any country, story or innovation.</div>`;
  if (!$("#al-b").options.length) {
    $("#al-b").innerHTML = ALB().map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
    $("#al-add").onclick = () => { const v = +$("#al-v").value; if (!v) { toast("Enter a level in $/t"); return; } S.alerts.push({ b: $("#al-b").value, op: $("#al-op").value, v, at: D.asOf }); save(); $("#al-v").value = ""; renderWatch(); updateCounts(); checkAlerts(true); };
    $("#wl-export").onclick = () => { const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), commodity: D.commodity, stars: S.stars, alerts: S.alerts }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "procis-desk-watchlist.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  }
  const cur = Object.fromEntries(ALB().map(([k, n, v]) => [k, [n, v]]));
  $("#al-list").innerHTML = S.alerts.length ? S.alerts.map((a, k) => { const [n, v] = cur[a.b], hit = a.op === "lt" ? v < a.v : v > a.v;
    return `<div class="rule" style="grid-template-columns:96px 1fr auto;padding:8px 0;align-items:center"><span class="st ${hit ? "fire" : "calm"}">${hit ? "Triggered" : "Watching"}</span><span class="small">${esc(n)} ${a.op === "lt" ? "falls below" : "rises above"} <b class="mono">$${f1(a.v)}</b><br><span class="xs muted">Now $${f1(v)}</span></span><button class="btn" data-del="${k}" aria-label="Delete alert">Delete</button></div>`; }).join("") : `<p class="small muted">No alerts yet. Try ${K.alHint}.</p>`;
  $$("#al-list [data-del]").forEach(b => b.onclick = () => { S.alerts.splice(+b.dataset.del, 1); save(); renderWatch(); updateCounts(); });
}
function checkAlerts(quiet) {
  const cur = Object.fromEntries(ALB().map(([k, n, v]) => [k, [n, v]]));
  const hits = S.alerts.filter(a => { const v = cur[a.b]?.[1]; return v != null && (a.op === "lt" ? v < a.v : v > a.v); });
  if (hits.length) toast(`${hits.length} price alert${hits.length > 1 ? "s" : ""} triggered. See Watchlist.`);
}

/* ---------- boot ---------- */
Promise.all([fetch("data/prices.json").then(r => r.json()), fetch("data/countries.json").then(r => r.json())]).then(([p, g]) => {
  P = p; GEO = g; ticker(); updateCounts();
  const h = location.hash.slice(1); go(h && $("#s-" + h) ? h : "overview", false);
  if (!rendered.overview && cur !== "overview") { /* render overview lazily when visited */ }
  checkAlerts();
}).catch(err => { console.error(err); $("#main").insertAdjacentHTML("afterbegin", `<div class="panel" style="border-color:var(--bad)">The desk's data files did not load. Open it from a web server, not from a file.</div>`); });
addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== cur) go(h, false); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
