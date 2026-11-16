/* Procis should-cost model: pure arithmetic, no DOM. Used by app.js in the browser and by the node test. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.ProcisModel = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DRIVERS = ['material', 'energy', 'freight', 'labour'];

  /* Each driver fixes the units of its lines. cost per 1,000 units = qty x rate x f */
  var KINDS = {
    material: { label: 'Material', qtyUnit: 'g / unit', rateUnit: 'EUR / kg', f: 1, qtyStep: 0.1, rateStep: 0.01 },
    energy:   { label: 'Energy',   qtyUnit: 'kWh / 1,000', rateUnit: 'EUR / kWh', f: 1, qtyStep: 0.1, rateStep: 0.01 },
    freight:  { label: 'Freight',  qtyUnit: 'pallets / 1,000', rateUnit: 'EUR / pallet', f: 1, qtyStep: 0.01, rateStep: 0.5 },
    labour:   { label: 'Labour',   qtyUnit: 'min / 1,000', rateUnit: 'EUR / hour', f: 1 / 60, qtyStep: 0.5, rateStep: 0.5 }
  };

  function claims(m, e, f, l) {
    return { material: { ask: m[0], idx: m[1] }, energy: { ask: e[0], idx: e[1] }, freight: { ask: f[0], idx: f[1] }, labour: { ask: l[0], idx: l[1] } };
  }

  /* All templates are illustrative. The PET bottle is the locked default case. */
  var TEMPLATES = {
    pet330: {
      name: '330 ml PET bottle',
      labels: { material: 'Resin', energy: 'Energy', freight: 'Freight', labour: 'Labour' },
      lines: [
        { name: 'PET resin', driver: 'material', qty: 18.0, rate: 1.50 },
        { name: 'Blow moulding power', driver: 'energy', qty: 24, rate: 0.20 },
        { name: 'Line labour', driver: 'labour', qty: 12, rate: 18.00 },
        { name: 'Outbound freight', driver: 'freight', qty: 0.10, rate: 36.00 }
      ],
      overheadPct: 20, marginPct: 15,
      claims: claims([12, 5], [20, 18], [25, 10], [5, 4]),
      volume: 250
    },
    carton250: {
      name: 'Folding carton, 250 g pack',
      labels: { material: 'Board', energy: 'Energy', freight: 'Freight', labour: 'Labour' },
      lines: [
        { name: 'Folding boxboard', driver: 'material', qty: 42.0, rate: 1.10 },
        { name: 'Ink and varnish', driver: 'material', qty: 2.5, rate: 6.00 },
        { name: 'Print and die-cut power', driver: 'energy', qty: 30, rate: 0.20 },
        { name: 'Converting labour', driver: 'labour', qty: 20, rate: 18.00 },
        { name: 'Outbound freight', driver: 'freight', qty: 0.25, rate: 36.00 }
      ],
      overheadPct: 22, marginPct: 13,
      claims: claims([9, 3], [15, 12], [18, 10], [6, 4]),
      volume: 80
    },
    pouch200: {
      name: 'Laminated pouch, 200 ml',
      labels: { material: 'Film', energy: 'Energy', freight: 'Freight', labour: 'Labour' },
      lines: [
        { name: 'PET/PE laminate', driver: 'material', qty: 6.5, rate: 3.20 },
        { name: 'Adhesive', driver: 'material', qty: 0.6, rate: 4.50 },
        { name: 'Lamination and sealing power', driver: 'energy', qty: 15, rate: 0.20 },
        { name: 'Pouch-making labour', driver: 'labour', qty: 8, rate: 18.00 },
        { name: 'Outbound freight', driver: 'freight', qty: 0.04, rate: 36.00 }
      ],
      overheadPct: 20, marginPct: 15,
      claims: claims([10, 6], [18, 15], [20, 9], [5, 4]),
      volume: 120
    },
    can330: {
      name: '330 ml aluminium can',
      labels: { material: 'Aluminium', energy: 'Energy', freight: 'Freight', labour: 'Labour' },
      lines: [
        { name: 'Aluminium body and end (incl. premium)', driver: 'material', qty: 9.5, rate: 2.90 },
        { name: 'Inside coating', driver: 'material', qty: 0.4, rate: 8.00 },
        { name: 'Line power', driver: 'energy', qty: 45, rate: 0.20 },
        { name: 'Line labour', driver: 'labour', qty: 6, rate: 18.00 },
        { name: 'Outbound freight', driver: 'freight', qty: 0.12, rate: 36.00 }
      ],
      overheadPct: 18, marginPct: 12,
      claims: claims([14, 8], [22, 18], [20, 10], [5, 4]),
      volume: 300
    }
  };

  function r2(x) { return Math.round((x + (x >= 0 ? 1 : -1) * 1e-9) * 100) / 100; }
  function num(x) { var n = +x; return isFinite(n) ? n : 0; }

  function defaultState(key) {
    var t = TEMPLATES[key] || TEMPLATES.pet330;
    return {
      v: 1,
      template: TEMPLATES[key] ? key : 'pet330',
      name: t.name,
      labels: JSON.parse(JSON.stringify(t.labels)),
      lines: JSON.parse(JSON.stringify(t.lines)),
      overheadPct: t.overheadPct,
      marginPct: t.marginPct,
      claims: JSON.parse(JSON.stringify(t.claims)),
      tolerance: 2,
      volume: t.volume,       /* million units a year */
      walkPct: 75,            /* walk-away = justified + this share of the gap */
      watchDriver: 'material',
      watchWindow: 12
    };
  }

  function lineCost(l) { return num(l.qty) * num(l.rate) * (KINDS[l.driver] ? KINDS[l.driver].f : 0); }

  /* Should-cost per 1,000 units. Overhead and margin are a share of the selling price. */
  function build(s) {
    var by = { material: 0, energy: 0, freight: 0, labour: 0 };
    var direct = 0;
    s.lines.forEach(function (l) { var c = lineCost(l); if (by[l.driver] !== undefined) by[l.driver] += c; direct += c; });
    var om = (num(s.overheadPct) + num(s.marginPct)) / 100;
    var price = om < 1 ? direct / (1 - om) : NaN;
    var shares = {};
    DRIVERS.forEach(function (d) { shares[d] = price ? by[d] / price : 0; });
    var other = price - direct;
    shares.other = price ? other / price : 0;
    return {
      byDriver: by, direct: direct, other: other, price: price, shares: shares,
      overhead: price * num(s.overheadPct) / 100, margin: price * num(s.marginPct) / 100
    };
  }

  /* Verdict per driver.
     Justified: the ask is within tolerance (percentage points) of what the index says.
     Part-justified: the index rose, but by less than the ask.
     Not justified: the index was flat or fell. */
  function verdict(ask, idx, tol) {
    if (ask <= idx + tol) return 'Justified';
    if (idx > 0) return 'Part-justified';
    return 'Not justified';
  }

  function claim(s, b) {
    b = b || build(s);
    var tol = num(s.tolerance);
    var rows = DRIVERS.map(function (d) {
      var c = s.claims[d] || { ask: 0, idx: 0 };
      var ask = num(c.ask), idx = num(c.idx), share = b.shares[d];
      return {
        driver: d, label: s.labels[d], share: share, cost: b.byDriver[d],
        ask: ask, idx: idx,
        askPts: share * ask, idxPts: share * idx,              /* contribution to the total %, in points */
        askEur: b.price * share * ask / 100, idxEur: b.price * share * idx / 100,
        verdict: verdict(ask, idx, tol)
      };
    });
    var askPct = rows.reduce(function (a, r) { return a + r.askPts; }, 0);
    var idxPct = rows.reduce(function (a, r) { return a + r.idxPts; }, 0);
    var base = r2(b.price);
    var asked = r2(b.price * (1 + askPct / 100));
    var justified = r2(b.price * (1 + idxPct / 100));
    var gap = r2(asked - justified);
    return { rows: rows, askPct: askPct, idxPct: idxPct, base: base, asked: asked, justified: justified, gap: gap, counter: justified };
  }

  /* Negotiation pack. Volume in million units a year, prices per 1,000 units. */
  function pack(s, c) {
    c = c || claim(s);
    var kUnits = num(s.volume) * 1000;                 /* thousands of units a year */
    var target = c.justified;
    var fallback = r2(c.justified + c.gap / 2);
    var walk = r2(c.justified + c.gap * num(s.walkPct) / 100);
    function pos(p) { return { price: p, vsBase: c.base ? (p / c.base - 1) * 100 : 0, savingYr: r2((c.asked - p) * kUnits) }; }
    return { target: pos(target), fallback: pos(fallback), walk: pos(walk), stakeYr: r2(c.gap * kUnits), kUnits: kUnits };
  }

  /* Index watch: an illustrative 24-month index and the supplier's price for one driver.
     Index = trend that ends the last 12 months at idx% + a cost shock around month 7.
     Price rises with the index at once (rocket) and falls back slowly (feather). */
  var SHOCK = { material: 22, energy: 38, freight: 45, labour: 3 };
  var FEATHER = 0.14;
  function series(driver, idxPct) {
    var ix = [], px = [];
    for (var t = 0; t < 24; t++) {
      var trend = 100 * Math.pow(1 + num(idxPct) / 100, (t - 11) / 12);
      ix.push(trend + (SHOCK[driver] || 0) * Math.exp(-Math.pow((t - 6) / 2.6, 2)));
    }
    px.push(ix[0]);
    for (t = 1; t < 24; t++) {
      var prev = px[t - 1];
      px.push(ix[t] >= prev ? ix[t] : prev - FEATHER * (prev - ix[t]));
    }
    return { index: ix, price: px };
  }

  /* Overpayment while price sat above index, over the last `months` months. */
  function recover(s, b, driver, months) {
    b = b || build(s);
    var c = s.claims[driver] || { idx: 0 };
    var sr = series(driver, c.idx);
    var perMonthK = num(s.volume) * 1000 / 12;
    var total = 0, gapPts = 0, n = 0;
    for (var t = 24 - months; t < 24; t++) {
      var g = Math.max(0, sr.price[t] - sr.index[t]);
      total += g / 100 * b.byDriver[driver] * perMonthK;
      gapPts += g; if (g > 0.005) n++;
    }
    return { amount: total, avgGapPts: gapPts / months, monthsAbove: n, series: sr };
  }

  /* Accept only well-formed state (e.g. from a shared link). */
  function sanitize(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.lines)) return null;
    var base = defaultState(TEMPLATES[o.template] ? o.template : 'pet330');
    var s = base;
    s.template = TEMPLATES[o.template] ? o.template : 'custom';
    s.name = String(o.name || base.name).slice(0, 80);
    DRIVERS.forEach(function (d) {
      if (o.labels && o.labels[d]) s.labels[d] = String(o.labels[d]).slice(0, 24);
      var c = o.claims && o.claims[d];
      if (c) s.claims[d] = { ask: clamp(c.ask, -100, 500), idx: clamp(c.idx, -100, 500) };
    });
    s.lines = o.lines.slice(0, 30).filter(function (l) { return l && KINDS[l.driver]; }).map(function (l) {
      return { name: String(l.name || '').slice(0, 60), driver: l.driver, qty: clamp(l.qty, 0, 1e6), rate: clamp(l.rate, 0, 1e6) };
    });
    s.overheadPct = clamp(o.overheadPct, 0, 90);
    s.marginPct = clamp(o.marginPct, 0, 90);
    if (s.overheadPct + s.marginPct >= 99) s.marginPct = Math.max(0, 98 - s.overheadPct);
    s.tolerance = clamp(o.tolerance, 0, 50);
    s.volume = clamp(o.volume, 0, 1e5);
    s.walkPct = clamp(o.walkPct, 0, 100);
    s.watchDriver = KINDS[o.watchDriver] ? o.watchDriver : 'material';
    s.watchWindow = o.watchWindow === 24 ? 24 : 12;
    return s;
  }
  function clamp(x, lo, hi) { var n = num(x); return Math.min(hi, Math.max(lo, n)); }

  return { DRIVERS: DRIVERS, KINDS: KINDS, TEMPLATES: TEMPLATES, r2: r2, defaultState: defaultState, lineCost: lineCost,
    build: build, claim: claim, pack: pack, verdict: verdict, series: series, recover: recover, sanitize: sanitize };
});
