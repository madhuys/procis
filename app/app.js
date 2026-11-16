/* Procis should-cost lab. Plain JS, no dependencies. Arithmetic lives in model.js. */
(function () {
  'use strict';
  var M = window.ProcisModel;
  var KEY = 'procis.shouldcost.v1';
  var D = M.DRIVERS;
  var COL = { material: 'var(--c1)', energy: 'var(--c2)', freight: 'var(--c3)', labour: 'var(--c4)', other: 'var(--c5)' };
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var state;

  /* ---------- formatting ---------- */
  var MINUS = '−';
  function n2(x) { return (x < 0 ? MINUS : '') + Math.abs(M.r2(x)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function eur(x) { return 'EUR ' + n2(x); }
  function eur0(x) {
    var a = Math.abs(x), s = x < 0 ? MINUS : '';
    if (a >= 1e7) return 'EUR ' + s + (a / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'm';
    return 'EUR ' + s + Math.round(a).toLocaleString('en-GB');
  }
  function sp(x, dp) { dp = dp === undefined ? 2 : dp; var v = Math.abs(x) < Math.pow(10, -dp) / 2 ? 0 : x; return (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(dp) + '%'; }
  function pc(x, dp) { return (x * 100).toFixed(dp === undefined ? 1 : dp) + '%'; }
  function vol(v) { return (+v).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'm units a year'; }
  function lab(d) { return d === 'other' ? 'Other and margin' : state.labels[d]; }

  /* ---------- state ---------- */
  function encode(s) { var b = new TextEncoder().encode(JSON.stringify(s)); var str = ''; b.forEach(function (c) { str += String.fromCharCode(c); }); return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function decode(t) { var b = atob(t.replace(/-/g, '+').replace(/_/g, '/')); var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); }
  function load() {
    var m = location.hash.match(/^#c=([A-Za-z0-9_-]+)$/);
    if (m) { try { var s = M.sanitize(decode(m[1])); if (s) return s; } catch (e) { /* bad link: fall through */ } }
    try { var raw = localStorage.getItem(KEY); if (raw) { var s2 = M.sanitize(JSON.parse(raw)); if (s2) return s2; } } catch (e) { /* storage off */ }
    return M.defaultState('pet330');
  }
  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage off */ } }, 150);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---------- small DOM helpers ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function svgRoot(w, h, label) {
    var s = sv('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'group', 'aria-label': label });
    s.appendChild(sv('title', {}, label));
    return s;
  }
  function focusable(g, label, read, readEl) {
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'img'); g.setAttribute('aria-label', label);
    var show = function () { readEl.textContent = read; };
    g.addEventListener('focus', show); g.addEventListener('mouseenter', show);
    return g;
  }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function width(node, fallback) { return Math.max(280, Math.round(node.clientWidth || fallback)); }

  /* ---------- 01 bill of materials ---------- */
  function renderTemplates() {
    var sel = $('tpl'); sel.textContent = '';
    Object.keys(M.TEMPLATES).forEach(function (k) { sel.appendChild(el('option', { value: k, text: M.TEMPLATES[k].name + ' (Illustrative)' })); });
    sel.appendChild(el('option', { value: 'custom', text: 'Custom case' }));
    sel.value = state.template;
  }
  function renderLines() {
    var box = $('bom-lines'); box.textContent = '';
    state.lines.forEach(function (l, i) {
      var k = M.KINDS[l.driver];
      var name = el('input', { type: 'text', maxlength: '60', 'aria-label': 'Line ' + (i + 1) + ' name' }); name.value = l.name;
      name.addEventListener('input', function () { l.name = name.value; markCustom(); update(); });
      var drv = el('select', { 'aria-label': 'Line ' + (i + 1) + ' driver' });
      D.forEach(function (d) { drv.appendChild(el('option', { value: d, text: state.labels[d] })); });
      drv.value = l.driver;
      drv.addEventListener('change', function () { l.driver = drv.value; markCustom(); renderLines(); update(); });
      var q = numInput(l.qty, k.qtyStep, 'Line ' + (i + 1) + ' quantity, ' + k.qtyUnit, function (v) { l.qty = v; });
      var r = numInput(l.rate, k.rateStep, 'Line ' + (i + 1) + ' rate, ' + k.rateUnit, function (v) { l.rate = v; });
      var del = el('button', { type: 'button', class: 'del', 'aria-label': 'Remove line ' + (i + 1) + ', ' + (l.name || 'unnamed'), text: '×' });
      del.addEventListener('click', function () { state.lines.splice(i, 1); markCustom(); renderLines(); update(); $('add-line').focus(); });
      var row = el('div', { class: 'bom-row', role: 'row' }, [
        el('span', { role: 'cell' }, [name]),
        el('span', { role: 'cell' }, [drv]),
        el('span', { role: 'cell' }, [unitWrap(q, k.qtyUnit)]),
        el('span', { role: 'cell' }, [unitWrap(r, k.rateUnit)]),
        el('span', { role: 'cell', class: 'r mono', 'data-cost': i }),
        el('span', { role: 'cell', class: 'r mono muted', 'data-share': i }),
        el('span', { role: 'cell' }, [del])
      ]);
      box.appendChild(row);
    });
  }
  function unitWrap(input, unit) { var w = el('label', { class: 'unit' }, [input]); w.appendChild(el('i', { text: unit.replace(' / ', '/') })); input.style.paddingRight = (unit.length * 6 + 12) + 'px'; return w; }
  function numInput(v, step, label, set) {
    var i = el('input', { type: 'number', step: String(step), min: '0', inputmode: 'decimal', 'aria-label': label });
    i.value = v;
    i.addEventListener('input', function () { set(i.value === '' ? 0 : Math.max(0, +i.value)); markCustom(); update(); });
    return i;
  }
  function markCustom() {
    if (state.template !== 'custom') { state.template = 'custom'; $('tpl').value = 'custom'; }
  }

  function drawDonut(b) {
    var host = $('donut'); host.textContent = '';
    var S = 240, cx = S / 2, cy = S / 2, R = 104, w = 26;
    var svg = svgRoot(S, S, 'Cost share donut for ' + state.name + ': should-cost ' + eur(b.price) + ' per 1,000');
    var keys = D.concat(['other']);
    var a0 = -Math.PI / 2, read = $('donut-read');
    keys.forEach(function (k) {
      var sh = Math.max(0, b.shares[k] || 0); if (!sh) return;
      var a1 = a0 + sh * Math.PI * 2, gap = sh > 0.02 ? 0.012 : 0;
      var g = sv('g');
      var p = sv('path', { d: arc(cx, cy, R, a0 + gap, a1 - gap), fill: 'none', style: 'stroke:' + COL[k], 'stroke-width': w, class: 'seg-arc' });
      var hit = sv('path', { d: arc(cx, cy, R + w / 2 + 2, a0 + gap, a1 - gap), fill: 'none', stroke: 'transparent', class: 'hit' });
      if (k === 'other') { p.setAttribute('style', 'stroke:var(--c5)'); }
      g.appendChild(p); g.appendChild(hit);
      var v = k === 'other' ? b.other : b.byDriver[k];
      focusable(g, lab(k) + ': ' + eur(v) + ', ' + pc(sh) + ' of the price', lab(k) + '  ' + eur(v) + ' per 1,000  ' + pc(sh), read);
      svg.appendChild(g);
      a0 = a1;
    });
    svg.appendChild(sv('text', { x: cx, y: cy - 14, 'text-anchor': 'middle' }, 'SHOULD-COST'));
    var big = sv('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', class: 't-strong', style: 'font-size:26px' }, n2(b.price));
    svg.appendChild(big);
    svg.appendChild(sv('text', { x: cx, y: cy + 34, 'text-anchor': 'middle' }, 'EUR per 1,000'));
    host.appendChild(svg);
  }
  function arc(cx, cy, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
  }
  function drawShareBars(b) {
    var box = $('share-bars'); box.textContent = '';
    var max = Math.max.apply(null, D.map(function (d) { return b.shares[d]; }).concat([b.shares.other]));
    D.concat(['other']).forEach(function (k) {
      var sh = b.shares[k] || 0, v = k === 'other' ? b.other : b.byDriver[k];
      var bar = el('span'); bar.style.width = (max ? Math.max(0, sh / max) * 100 : 0) + '%'; bar.style.background = COL[k];
      if (k === 'other') bar.style.boxShadow = 'inset 0 0 0 1px var(--c3)';
      var nm = el('span'); var dot = el('i', { class: 'dot', 'aria-hidden': 'true' }); dot.style.background = COL[k];
      if (k === 'other') dot.style.boxShadow = 'inset 0 0 0 1px var(--c3)';
      nm.appendChild(dot); nm.appendChild(document.createTextNode(lab(k)));
      box.appendChild(el('div', { class: 'sb', role: 'listitem', 'aria-label': lab(k) + ' ' + eur(v) + ', ' + pc(sh) }, [
        nm, el('span', { class: 'track', 'aria-hidden': 'true' }, [bar]), el('span', { class: 'mono', text: n2(v) }), el('span', { class: 'mono muted', text: pc(sh, 0) })
      ]));
    });
  }

  /* ---------- 02 claim check ---------- */
  function renderClaimRows() {
    var box = $('claim-rows'); box.textContent = '';
    D.forEach(function (d) {
      var c = state.claims[d];
      var a = el('input', { type: 'number', step: '0.5', inputmode: 'decimal', 'aria-label': state.labels[d] + ': supplier asks, percent' }); a.value = c.ask;
      var x = el('input', { type: 'number', step: '0.5', inputmode: 'decimal', 'aria-label': state.labels[d] + ': index says, percent' }); x.value = c.idx;
      a.addEventListener('input', function () { c.ask = a.value === '' ? 0 : +a.value; update(); });
      x.addEventListener('input', function () { c.idx = x.value === '' ? 0 : +x.value; update(); });
      box.appendChild(el('div', { class: 'claim-row', role: 'row' }, [
        el('span', { role: 'cell', class: 'nm', text: state.labels[d] }),
        el('span', { role: 'cell', class: 'r mono muted', 'data-csh': d }),
        el('span', { role: 'cell', 'data-m': 'asks' }, [unitWrap(a, '%')]),
        el('span', { role: 'cell', 'data-m': 'index' }, [unitWrap(x, '%')]),
        el('span', { role: 'cell', class: 'r mono', 'data-cae': d, 'data-m': 'asked' }),
        el('span', { role: 'cell', class: 'r mono', 'data-cie': d, 'data-m': 'justified' }),
        el('span', { role: 'cell', 'data-cv': d })
      ]));
    });
  }
  function chip(v) {
    var cls = v === 'Justified' ? 'chip--ok' : v === 'Part-justified' ? 'chip--part' : 'chip--no';
    return el('span', { class: 'chip ' + cls, text: v });
  }

  function drawWaterfall(c) {
    var host = $('waterfall'); host.textContent = '';
    var read = $('wf-read');
    var W = width(host, 600), H = 300, pl = 44, pr = 8, pt = 26, pb = 46;
    var excess = c.asked - c.justified;
    var steps = [{ k: 'Today', v: c.base, total: true }];
    c.rows.forEach(function (r) { steps.push({ k: r.label, v: r.idxEur, driver: r.driver }); });
    steps.push({ k: 'Justified', v: c.justified, total: true, strong: true });
    steps.push({ k: 'Not backed', v: excess, ember: true });
    steps.push({ k: 'Asked', v: c.asked, total: true, outline: true });
    var hi = Math.max(c.asked, c.justified, c.base), lo = Math.min(c.base, c.justified, c.asked);
    var span = Math.max(hi - lo, c.base * 0.02);
    var y0 = Math.max(0, Math.floor((lo - span * 0.9) / niceStep(span)) * niceStep(span));
    var y1 = hi + span * 0.18;
    var Y = function (v) { return pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0)); };
    var svg = svgRoot(W, H, 'Waterfall from today’s price ' + eur(c.base) + ' to the asked price ' + eur(c.asked) + ' through the cost-justified price ' + eur(c.justified));
    var st = niceStep(y1 - y0);
    for (var g = Math.ceil(y0 / st) * st; g <= y1; g += st) {
      svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: Y(g), y2: Y(g), style: 'stroke:var(--grid)' }));
      svg.appendChild(sv('text', { x: pl - 6, y: Y(g) + 4, 'text-anchor': 'end' }, n2(g).replace('.00', '')));
    }
    // axis break marks: the axis does not start at zero
    svg.appendChild(sv('path', { d: 'M' + (pl - 4) + ' ' + (H - pb + 4) + 'l8 -4 M' + (pl - 4) + ' ' + (H - pb + 9) + 'l8 -4', style: 'stroke:var(--c3)', fill: 'none' }));
    var n = steps.length, slot = (W - pl - pr) / n, bw = Math.min(54, slot * 0.62);
    var run = 0;
    steps.forEach(function (s, i) {
      var x = pl + slot * i + (slot - bw) / 2, top, bot, fill, stroke = 'none';
      if (s.total) { top = Y(s.v); bot = Y(y0); run = s.v; }
      else { top = Y(run + Math.max(0, s.v)); bot = Y(run + Math.min(0, s.v)); run += s.v; }
      if (s.total && s.outline) { fill = 'transparent'; stroke = 'var(--c1)'; }
      else if (s.total) fill = s.strong ? 'var(--c1)' : 'var(--c3)';
      else if (s.ember) fill = 'var(--ember)';
      else fill = 'var(--c2)';
      var gEl = sv('g');
      var h = Math.max(1.5, bot - top);
      gEl.appendChild(sv('rect', { x: x, y: top, width: bw, height: h, rx: 2, style: 'fill:' + fill + ';stroke:' + stroke, 'stroke-width': s.outline ? 1.5 : 0 }));
      gEl.appendChild(sv('rect', { x: x - 2, y: top - 2, width: bw + 4, height: h + 4, rx: 3, fill: 'none', stroke: 'transparent', class: 'hit' }));
      if (i < n - 1) {
        var ny = Y(run);
        svg.appendChild(sv('line', { x1: x + bw, x2: x + slot, y1: ny, y2: ny, style: 'stroke:var(--c4)', 'stroke-dasharray': '2 3' }));
      }
      var label = s.total ? n2(s.v) : (s.v >= 0 ? '+' : MINUS) + n2(Math.abs(s.v));
      var tight = slot < 56, fs = tight ? 'font-size:9.5px' : '';
      gEl.appendChild(sv('text', { x: x + bw / 2, y: top - 7 - (tight && i % 2 ? 11 : 0), 'text-anchor': 'middle', class: s.ember ? 't-ember' : (s.total ? 't-strong' : ''), style: fs }, label));
      var nm = tight ? ({ 'Not backed': 'Gap', Justified: 'Just.' }[s.k] || s.k) : (s.k.length > 10 && slot < 80 ? s.k.slice(0, 9) + '.' : s.k);
      gEl.appendChild(sv('text', { x: x + bw / 2, y: H - pb + 16 + (tight && i % 2 ? 13 : 0), 'text-anchor': 'middle', class: s.ember ? 't-ember' : '', style: fs }, nm));
      if (!tight && !s.total && s.driver) gEl.appendChild(sv('text', { x: x + bw / 2, y: H - pb + 32, 'text-anchor': 'middle' }, sp(c.rows[i - 1].idx, 0)));
      var desc = s.total ? s.k + ': ' + eur(s.v) + ' per 1,000' : s.k + ': ' + (s.ember ? 'asked above the index, ' : 'index-justified, ') + label + ' EUR per 1,000';
      focusable(gEl, desc, desc, read);
      svg.appendChild(gEl);
    });
    host.appendChild(svg);
  }
  function niceStep(span) {
    var raw = span / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  /* ---------- 03 index watch ---------- */
  function monthLabels() {
    var out = [], end = new Date(2026, 9, 1); // Oct 2026, the last full month
    for (var i = 23; i >= 0; i--) { var d = new Date(end.getFullYear(), end.getMonth() - i, 1); out.push(d.toLocaleString('en-GB', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2)); }
    return out;
  }
  function renderWatchDrivers() {
    var box = $('watch-drivers'); box.textContent = '';
    D.forEach(function (d) {
      var btn = el('button', { type: 'button', role: 'radio', 'aria-checked': String(state.watchDriver === d), tabindex: state.watchDriver === d ? '0' : '-1', text: state.labels[d] });
      btn.addEventListener('click', function () { state.watchDriver = d; renderWatchDrivers(); update(); box.querySelector('[aria-checked=true]').focus(); });
      btn.addEventListener('keydown', function (e) {
        var i = D.indexOf(state.watchDriver), j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
        if (j === null) return; e.preventDefault(); state.watchDriver = D[(j + D.length) % D.length]; renderWatchDrivers(); update(); box.querySelector('[aria-checked=true]').focus();
      });
      box.appendChild(btn);
    });
  }
  function drawWatch(b) {
    var host = $('watch'); host.textContent = '';
    var read = $('watch-read');
    var d = state.watchDriver, months = state.watchWindow;
    var rec = M.recover(state, b, d, months), sr = rec.series, labels = monthLabels();
    var W = width(host, 900), H = W < 600 ? 260 : 320, pl = 40, pr = 12, pt = 30, pb = 34;
    var all = sr.index.concat(sr.price), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var st = niceStep(hi - lo || 4), y0 = Math.floor((lo - st * 0.3) / st) * st, y1 = Math.ceil((hi + st * 0.3) / st) * st;
    var X = function (i) { return pl + (W - pl - pr) * i / 23; };
    var Y = function (v) { return pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0)); };
    var svg = svgRoot(W, H, state.labels[d] + ': 24-month illustrative index against the supplier’s price. The price sat above the index in ' + rec.monthsAbove + ' of the last ' + months + ' months.');
    // recovery window band
    var wx = X(24 - months) - (months === 24 ? 0 : (X(1) - X(0)) / 2);
    svg.appendChild(sv('rect', { x: wx, y: pt - 18, width: X(23) - wx, height: H - pb - pt + 18, style: 'fill:var(--grid)', opacity: 0.6 }));
    var narrow = W < 600;
    if (!narrow) svg.appendChild(sv('text', { x: wx + 6, y: pt - 6 }, 'RECOVERY WINDOW, ' + months + ' MONTHS'));
    for (var g = y0; g <= y1 + 1e-9; g += st) {
      svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: Y(g), y2: Y(g), style: 'stroke:var(--grid)' }));
      svg.appendChild(sv('text', { x: pl - 6, y: Y(g) + 4, 'text-anchor': 'end' }, String(Math.round(g))));
    }
    var every = W < 600 ? 6 : 3;
    labels.forEach(function (l, i) { if ((23 - i) % every === 0) svg.appendChild(sv('text', { x: X(i), y: H - pb + 18, 'text-anchor': i === 23 ? 'end' : 'middle' }, l)); });
    // gap: price above index
    var top = sr.price.map(function (v, i) { return X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
    var bot = sr.index.map(function (v, i) { return X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).reverse();
    svg.appendChild(sv('path', { d: 'M' + top.join('L') + 'L' + bot.join('L') + 'Z', fill: 'var(--ember)', 'fill-opacity': 0.38 }));
    svg.appendChild(sv('path', { d: 'M' + sr.index.map(function (v, i) { return X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('L'), fill: 'none', style: 'stroke:var(--c3)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4' }));
    svg.appendChild(sv('path', { d: 'M' + top.join('L'), fill: 'none', style: 'stroke:var(--c1)', 'stroke-width': 2.25, 'stroke-linejoin': 'round' }));
    // legend
    var lg = sv('g', { transform: narrow ? 'translate(' + pl + ',' + (pt - 10) + ')' : 'translate(' + (W - pr - 230) + ',' + (pt + 4) + ')' });
    lg.appendChild(sv('line', { x1: 0, x2: 18, y1: 0, y2: 0, style: 'stroke:var(--c1)', 'stroke-width': 2.25 }));
    lg.appendChild(sv('text', { x: 24, y: 4, class: 't-strong' }, 'Price'));
    lg.appendChild(sv('line', { x1: 72, x2: 90, y1: 0, y2: 0, style: 'stroke:var(--c3)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4' }));
    lg.appendChild(sv('text', { x: 96, y: 4 }, 'Index'));
    lg.appendChild(sv('rect', { x: 146, y: -5, width: 14, height: 10, fill: 'var(--ember)', 'fill-opacity': 0.5 }));
    lg.appendChild(sv('text', { x: 166, y: 4, class: 't-ember' }, 'Gap'));
    svg.appendChild(lg);
    // keyboard + hover points: one per month
    var cursor = sv('line', { x1: 0, x2: 0, y1: pt, y2: H - pb, style: 'stroke:var(--c2)', opacity: 0 });
    svg.appendChild(cursor);
    var slotW = (W - pl - pr) / 23;
    sr.index.forEach(function (v, i) {
      var p = sr.price[i], gpt = p - v;
      var txt = labels[i] + '  price ' + p.toFixed(1) + '  index ' + v.toFixed(1) + '  gap ' + (gpt > 0.05 ? gpt.toFixed(1) + ' pts' : 'none');
      var gEl = sv('g');
      gEl.appendChild(sv('rect', { x: X(i) - slotW / 2, y: pt, width: slotW, height: H - pt - pb, fill: 'transparent' }));
      gEl.appendChild(sv('circle', { cx: X(i), cy: Y(p), r: 3.5, style: 'fill:var(--c1)', opacity: 0, class: 'pt' }));
      focusable(gEl, txt, txt, read);
      var on = function () { cursor.setAttribute('x1', X(i)); cursor.setAttribute('x2', X(i)); cursor.setAttribute('opacity', 0.5); };
      gEl.addEventListener('focus', on); gEl.addEventListener('mouseenter', on);
      if (i > 0) gEl.setAttribute('tabindex', '-1');
      gEl.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? 23 : null;
        if (j === null || j < 0 || j > 23) return; e.preventDefault();
        var pts = svg.querySelectorAll('g[data-m]'); gEl.setAttribute('tabindex', '-1'); pts[j].setAttribute('tabindex', '0'); pts[j].focus();
      });
      gEl.setAttribute('data-m', i);
      svg.appendChild(gEl);
    });
    host.appendChild(svg);

    $('rec-one').textContent = eur0(rec.amount);
    $('rec-one-note').textContent = state.labels[d] + ': price above index in ' + rec.monthsAbove + ' of ' + months + ' months, average ' + rec.avgGapPts.toFixed(1) + ' index pts, on ' + vol(state.volume);
    var tbl = $('rec-table'); tbl.textContent = '';
    tbl.appendChild(el('div', { class: 'rec-row hd', role: 'row' }, ['Driver', 'Months above', 'Avg gap, pts', 'To recover'].map(function (h) { return el('span', { role: 'columnheader', text: h }); })));
    var tot = 0;
    D.forEach(function (k) {
      var r = M.recover(state, b, k, months); tot += r.amount;
      tbl.appendChild(el('div', { class: 'rec-row', role: 'row' }, [state.labels[k], r.monthsAbove + ' / ' + months, r.avgGapPts.toFixed(1), eur0(r.amount)].map(function (t) { return el('span', { role: 'cell', text: String(t) }); })));
    });
    $('rec-all').textContent = eur0(tot);
    return tot;
  }

  /* ---------- 04 pack ---------- */
  function drawLadder(c, p) {
    var host = $('ladder'); host.textContent = '';
    var W = width(host, 600), H = 200, pl = 16, pr = 16;
    var lo = Math.min(c.base, c.justified), hi = Math.max(c.asked, c.base);
    var pad = Math.max((hi - lo) * 0.08, 0.05);
    var X = function (v) { return pl + (W - pl - pr) * (v - (lo - pad)) / ((hi + pad) - (lo - pad)); };
    var svg = svgRoot(W, H, 'Price ladder: today ' + eur(c.base) + ', target ' + eur(p.target.price) + ', fallback ' + eur(p.fallback.price) + ', walk-away ' + eur(p.walk.price) + ', asked ' + eur(c.asked));
    var y = 100;
    svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: y, y2: y, style: 'stroke:var(--c4)', 'stroke-width': 1 }));
    svg.appendChild(sv('rect', { x: X(c.justified), y: y - 5, width: Math.max(1, X(c.asked) - X(c.justified)), height: 10, fill: 'var(--ember)', 'fill-opacity': 0.4 }));
    var marks = [
      { k: 'Today', v: c.base, up: false }, { k: 'Target', v: p.target.price, up: true, ember: true },
      { k: 'Fallback', v: p.fallback.price, up: false }, { k: 'Walk-away', v: p.walk.price, up: true }, { k: 'Asked', v: c.asked, up: false }
    ];
    var read = { textContent: '' };
    // label slots: near above, near below, far above, far below; each keeps the right edge of its last label
    var slots = [{ up: true, d: 0, end: -1e9 }, { up: false, d: 0, end: -1e9 }, { up: true, d: 36, end: -1e9 }, { up: false, d: 36, end: -1e9 }];
    marks.forEach(function (m) {
      var x = X(m.v), g = sv('g');
      var w = Math.max(m.k.length * 7, 40);
      var anchor = x < 50 ? 'start' : x > W - 50 ? 'end' : 'middle';
      var left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      var order = slots.filter(function (s) { return s.up === m.up; }).concat(slots.filter(function (s) { return s.up !== m.up; }));
      order.sort(function (a, b) { return a.d - b.d; });
      var slot = order.filter(function (s) { return left > s.end + 8; })[0] || order[0];
      slot.end = left + w;
      var tick = slot.d ? 14 + slot.d : 14;
      g.appendChild(sv('line', { x1: x, x2: x, y1: y - 14, y2: y + 14, style: 'stroke:' + (m.ember ? 'var(--ember)' : 'var(--c1)'), 'stroke-width': 2 }));
      if (slot.d) g.appendChild(sv('line', { x1: x, x2: x, y1: slot.up ? y - tick : y + 14, y2: slot.up ? y - 14 : y + tick, style: 'stroke:var(--c4)', 'stroke-width': 1 }));
      g.appendChild(sv('text', { x: x, y: slot.up ? y - 38 - slot.d : y + 34 + slot.d, 'text-anchor': anchor }, m.k.toUpperCase()));
      g.appendChild(sv('text', { x: x, y: slot.up ? y - 22 - slot.d : y + 50 + slot.d, 'text-anchor': anchor, class: m.ember ? 't-ember' : 't-strong', style: 'font-size:13px' }, n2(m.v)));
      focusable(g, m.k + ': ' + eur(m.v) + ' per 1,000', '', read);
      svg.appendChild(g);
    });
    host.appendChild(svg);
  }

  function summaryText(b, c, p) {
    var L = [];
    L.push('Procis should-cost summary (Illustrative)');
    L.push('Item: ' + state.name);
    L.push('Today’s price: ' + eur(c.base) + ' per 1,000');
    L.push('Supplier asks: ' + sp(c.askPct) + ' (' + eur(c.asked) + ' per 1,000)');
    L.push('Indices justify: ' + sp(c.idxPct) + ' (' + eur(c.justified) + ' per 1,000)');
    L.push('Gap: ' + eur(c.gap) + ' per 1,000, ' + eur0(p.stakeYr) + ' a year on ' + vol(state.volume));
    L.push('');
    L.push('By driver (share, asks vs index, verdict):');
    c.rows.forEach(function (r) { L.push('- ' + r.label + ': ' + pc(r.share) + ' of price, ' + sp(r.ask, 1) + ' vs ' + sp(r.idx, 1) + ', ' + r.verdict); });
    L.push('Tolerance: ' + (+state.tolerance).toFixed(1) + ' pp');
    L.push('');
    L.push('Position:');
    L.push('- Target: ' + eur(p.target.price) + ' (cost-justified price, ' + sp(p.target.vsBase) + ')');
    L.push('- Fallback: ' + eur(p.fallback.price) + ' (justified plus half the gap, ' + sp(p.fallback.vsBase) + ')');
    L.push('- Walk-away: ' + eur(p.walk.price) + ' (justified plus ' + (+state.walkPct) + '% of the gap, ' + sp(p.walk.vsBase) + ')');
    L.push('Saving against the ask at target: ' + eur0(p.target.savingYr) + ' a year');
    L.push('');
    L.push('Illustrative model. Your real indices and specs replace these in a teardown.');
    return L.join('\n');
  }

  /* ---------- update everything that is computed ---------- */
  var last = {};
  function update() {
    var b = M.build(state), c = M.claim(state, b), p = M.pack(state, c);
    last = { b: b, c: c, p: p };
    var ok = isFinite(b.price);
    // KPIs
    $('k-base').textContent = ok ? eur(c.base) : 'Check overhead + margin';
    $('k-ask').textContent = eur(c.asked); $('k-ask-p').textContent = sp(c.askPct) + ' weighted';
    $('k-just').textContent = eur(c.justified); $('k-just-p').textContent = sp(c.idxPct) + ' weighted';
    $('k-gap').textContent = eur(c.gap);
    $('k-stake').textContent = eur0(p.stakeYr); $('k-vol').textContent = 'on ' + vol(state.volume);
    // 01
    state.lines.forEach(function (l, i) {
      var cost = M.lineCost(l), ce = document.querySelector('[data-cost="' + i + '"]'), se = document.querySelector('[data-share="' + i + '"]');
      if (ce) ce.textContent = n2(cost); if (se) se.textContent = ok ? pc(cost / b.price) : '-';
    });
    $('oh-eur').textContent = n2(b.overhead); $('oh-sh').textContent = (+state.overheadPct).toFixed(1) + '%';
    $('mg-eur').textContent = n2(b.margin); $('mg-sh').textContent = (+state.marginPct).toFixed(1) + '%';
    $('bom-total').textContent = ok ? eur(b.price) : 'n/a';
    if (ok) { drawDonut(b); drawShareBars(b); }
    // 02
    c.rows.forEach(function (r) {
      document.querySelector('[data-csh="' + r.driver + '"]').textContent = pc(r.share, 0);
      document.querySelector('[data-cae="' + r.driver + '"]').textContent = (r.askEur >= 0 ? '+' : MINUS) + n2(Math.abs(r.askEur));
      document.querySelector('[data-cie="' + r.driver + '"]').textContent = (r.idxEur >= 0 ? '+' : MINUS) + n2(Math.abs(r.idxEur));
      var v = document.querySelector('[data-cv="' + r.driver + '"]'); v.textContent = ''; v.appendChild(chip(r.verdict));
    });
    $('c-askp').textContent = sp(c.askPct); $('c-idxp').textContent = sp(c.idxPct);
    $('c-aske').textContent = '+' + n2(c.asked - c.base); $('c-idxe').textContent = '+' + n2(c.justified - c.base);
    var tv = $('c-verd'); tv.textContent = ''; tv.appendChild(chip(M.verdict(c.askPct, c.idxPct, +state.tolerance)));
    $('cmp-ask').textContent = eur(c.asked); $('cmp-ask-p').textContent = sp(c.askPct) + ' on ' + eur(c.base);
    $('cmp-just').textContent = eur(c.justified); $('cmp-just-p').textContent = sp(c.idxPct) + ' on ' + eur(c.base);
    $('cmp-counter').textContent = eur(c.counter);
    $('cmp-counter-note').textContent = 'Open at the cost-justified price. It accepts every move the indices back (' + sp(c.idxPct) + ') and declines the ' + eur(c.gap) + ' per 1,000 they do not, worth ' + eur0(p.stakeYr) + ' a year.';
    if (ok) drawWaterfall(c);
    // 03
    if (ok) drawWatch(b);
    // 04
    $('pk-t').textContent = eur(p.target.price); $('pk-t-s').textContent = sp(p.target.vsBase) + ' on today, saves ' + eur0(p.target.savingYr) + ' / yr vs ask';
    $('pk-f').textContent = eur(p.fallback.price); $('pk-f-s').textContent = sp(p.fallback.vsBase) + ' on today, saves ' + eur0(p.fallback.savingYr) + ' / yr vs ask';
    $('pk-w').textContent = eur(p.walk.price); $('pk-w-s').textContent = sp(p.walk.vsBase) + ' on today, saves ' + eur0(p.walk.savingYr) + ' / yr vs ask';
    if (ok) drawLadder(c, p);
    $('summary').value = summaryText(b, c, p);
    save();
  }

  /* ---------- export ---------- */
  function csv() {
    var b = last.b, c = last.c, p = last.p;
    var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var R = [['Procis should-cost model (Illustrative)'], ['Item', state.name], ['Currency', 'EUR, per 1,000 units'], [],
      ['Section', 'Line', 'Driver', 'Quantity', 'Quantity unit', 'Rate', 'Rate unit', 'EUR per 1,000', 'Share of price']];
    state.lines.forEach(function (l) { var k = M.KINDS[l.driver], v = M.lineCost(l); R.push(['BOM', l.name, state.labels[l.driver], l.qty, k.qtyUnit, l.rate, k.rateUnit, v.toFixed(4), (v / b.price).toFixed(4)]); });
    R.push(['BOM', 'Overhead', 'Other and margin', state.overheadPct, '% of price', '', '', b.overhead.toFixed(4), (state.overheadPct / 100).toFixed(4)]);
    R.push(['BOM', 'Margin', 'Other and margin', state.marginPct, '% of price', '', '', b.margin.toFixed(4), (state.marginPct / 100).toFixed(4)]);
    R.push(['BOM', 'Should-cost', '', '', '', '', '', b.price.toFixed(4), '1.0000']);
    R.push([]);
    R.push(['Claim', 'Driver', 'Share of price', 'Supplier asks %', 'Index says %', 'Asked EUR per 1,000', 'Justified EUR per 1,000', 'Verdict']);
    c.rows.forEach(function (r) { R.push(['Claim', r.label, r.share.toFixed(4), r.ask, r.idx, r.askEur.toFixed(4), r.idxEur.toFixed(4), r.verdict]); });
    R.push(['Claim', 'Total weighted', '', c.askPct.toFixed(4), c.idxPct.toFixed(4), (c.asked - c.base).toFixed(2), (c.justified - c.base).toFixed(2), 'Tolerance ' + state.tolerance + ' pp']);
    R.push([]);
    R.push(['Prices', "Today's price", c.base.toFixed(2)], ['Prices', 'Asked', c.asked.toFixed(2)], ['Prices', 'Cost-justified', c.justified.toFixed(2)], ['Prices', 'Gap per 1,000', c.gap.toFixed(2)]);
    R.push(['Pack', 'Target', p.target.price.toFixed(2)], ['Pack', 'Fallback', p.fallback.price.toFixed(2)], ['Pack', 'Walk-away (' + state.walkPct + '% of gap)', p.walk.price.toFixed(2)]);
    R.push(['Pack', 'Annual volume, million units', state.volume], ['Pack', 'At stake a year, EUR', p.stakeYr.toFixed(0)]);
    R.push([]); R.push(['Illustrative model. Your real indices and specs replace these in a teardown.']);
    var blob = new Blob(['﻿' + R.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'procis-should-cost-' + (state.template || 'case') + '.csv' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('CSV exported');
  }
  function copyText(text, done) {
    var fallback = function () {
      var t = el('textarea', { style: 'position:fixed;opacity:0;top:0' }); t.value = text; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove(); done(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  /* ---------- tabs ---------- */
  function setupTabs() {
    var tabs = [].slice.call(document.querySelectorAll('[role=tab]'));
    function select(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
      if (focus) t.focus();
      try { sessionStorage.setItem('procis.tab', t.id); } catch (e) { /* ignore */ }
      update();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (j === null) return; e.preventDefault(); select(tabs[(j + tabs.length) % tabs.length], true);
      });
    });
    var q = new URLSearchParams(location.search).get('pane');
    var start = q ? $('t-' + q) : null;
    if (!start) { try { start = $(sessionStorage.getItem('procis.tab') || ''); } catch (e) { start = null; } }
    if (start && start.getAttribute('role') === 'tab') select(start);
  }

  /* ---------- wiring ---------- */
  function bindScalar(id, key, after) {
    var i = $(id);
    i.addEventListener('input', function () { state[key] = i.value === '' ? 0 : +i.value; if (after) after(); update(); });
  }
  function fillScalars() {
    $('item-name').value = state.name;
    $('oh').value = state.overheadPct; $('mg').value = state.marginPct;
    $('tol').value = state.tolerance; $('walk').value = state.walkPct;
    $('vol').value = state.volume; $('vol-w').value = state.volume;
    $('watch-window').value = String(state.watchWindow);
  }
  function renderAll() { renderTemplates(); fillScalars(); renderLines(); renderClaimRows(); renderWatchDrivers(); update(); }

  function init() {
    state = load();
    $('tpl').addEventListener('change', function () {
      var v = $('tpl').value; if (v === 'custom') { state.template = 'custom'; save(); return; }
      var keep = { tolerance: state.tolerance, walkPct: state.walkPct, watchWindow: state.watchWindow };
      state = M.defaultState(v); Object.assign(state, keep); renderAll(); toast(M.TEMPLATES[v].name + ' loaded (Illustrative)');
    });
    $('item-name').addEventListener('input', function () { state.name = $('item-name').value; markCustom(); update(); });
    bindScalar('oh', 'overheadPct', markCustom); bindScalar('mg', 'marginPct', markCustom);
    bindScalar('tol', 'tolerance'); bindScalar('walk', 'walkPct');
    bindScalar('vol', 'volume', function () { $('vol-w').value = state.volume; });
    bindScalar('vol-w', 'volume', function () { $('vol').value = state.volume; });
    $('watch-window').addEventListener('change', function () { state.watchWindow = +$('watch-window').value; update(); });
    $('add-line').addEventListener('click', function () {
      state.lines.push({ name: 'New line', driver: 'material', qty: 1, rate: 1 }); markCustom(); renderLines(); update();
      var ins = $('bom-lines').querySelectorAll('input[type=text]'); ins[ins.length - 1].select();
    });
    $('reset').addEventListener('click', function () {
      if (!confirm('Reset to the illustrative 330 ml PET bottle case? Your edits here will be lost.')) return;
      state = M.defaultState('pet330'); renderAll(); toast('Reset to the default case');
    });
    $('share').addEventListener('click', function () {
      var url = location.origin + location.pathname + location.search + '#c=' + encode(state);
      history.replaceState(null, '', url);
      copyText(url, function (ok) { toast(ok ? 'Share link copied' : 'Link is in the address bar'); });
    });
    $('csv').addEventListener('click', csv);
    $('print').addEventListener('click', function () { window.print(); });
    $('copy').addEventListener('click', function () {
      copyText($('summary').value, function (ok) {
        $('copy-status').textContent = ok ? 'Summary copied to the clipboard.' : 'Copy was blocked here: select the text and copy it.';
        if (!ok) { $('summary').focus(); $('summary').select(); }
      });
    });
    window.addEventListener('hashchange', function () { var m = location.hash.match(/^#c=/); if (m) { state = load(); renderAll(); } });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(update, 120); });
    window.addEventListener('beforeprint', update);
    renderAll();
    setupTabs();
    window.__procis = { state: function () { return state; }, last: function () { return last; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
