/* The showcase viewer, after fuos.ai's: any [data-open="<id>"] opens that item from showcase/showcase.json in one
   dialog: the deck slide by slide, the memo's pages, the workbook's real cells (click one for its formula), the film,
   the live lab. A full-screen button, arrow keys, Esc to close; index.html#<id> opens an item on arrival. */
(function () {
  'use strict';
  var items = null, dlg = null, opener = null, fsBtn = null;
  var KIND = { slides: 'Deck · PowerPoint', document: 'Memo · Word', sheet: 'Model · Excel', video: 'Film', site: 'Live app' };
  var SRC = 'showcase/showcase.json?v=20261116e';

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      (Array.isArray(kid) ? kid : [kid]).forEach(function (c) { if (c != null) el.append(c); });
    }
    return el;
  }

  function load() {
    if (items) return Promise.resolve(items);
    return fetch(SRC, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      items = {};
      d.items.forEach(function (it) { items[it.id] = it; });
      return items;
    });
  }

  var ICON_FULL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICON_EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  var isFull = function () { return document.fullscreenElement === dlg || (dlg && dlg.classList.contains('is-full')); };
  function setFsIcon() {
    if (!fsBtn) return;
    var on = isFull();
    fsBtn.innerHTML = on ? ICON_EXIT : ICON_FULL;
    fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    fsBtn.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
  }
  function toggleFull() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (dlg.classList.contains('is-full')) { dlg.classList.remove('is-full'); setFsIcon(); return; }
    if (dlg.requestFullscreen) dlg.requestFullscreen().catch(function () { dlg.classList.add('is-full'); setFsIcon(); });
    else { dlg.classList.add('is-full'); setFsIcon(); }
  }
  document.addEventListener('fullscreenchange', setFsIcon);

  function shell() {
    if (dlg) return dlg;
    fsBtn = h('button', { type: 'button', class: 'v-btn v-icon v-full', onclick: toggleFull });
    dlg = h('dialog', { class: 'viewer', 'aria-labelledby': 'viewer-title' },
      h('div', { class: 'viewer-bar' },
        h('div', { class: 'viewer-id' },
          h('span', { class: 'viewer-kind' }),
          h('h2', { class: 'viewer-title', id: 'viewer-title' }),
          h('p', { class: 'viewer-made' })),
        h('div', { class: 'viewer-actions' }),
        fsBtn,
        h('button', { type: 'button', class: 'v-btn v-icon', 'aria-label': 'Close', title: 'Close (Esc)', onclick: function () { dlg.close(); } }, '×')),
      h('div', { class: 'viewer-body' }));
    setFsIcon();
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); toggleFull(); }
    });
    dlg.addEventListener('close', function () {
      if (dlg.open) return;   // the close event lands late: an item reopened meanwhile keeps its view
      if (document.fullscreenElement) document.exitFullscreen();
      dlg.classList.remove('is-full'); setFsIcon();
      dlg.querySelector('.viewer-body').replaceChildren();   // stops the film, frees the lab
      document.documentElement.style.overflow = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    });
    document.body.append(dlg);
    return dlg;
  }

  function pager(pages, label) {
    var i = 0;
    var img = h('img', { class: 'pager-img', alt: '' });
    var count = h('span', { class: 'pager-count', 'aria-live': 'polite' });
    var strip = h('div', { class: 'pager-strip' }, pages.map(function (p, k) {
      return h('button', { type: 'button', 'aria-label': label + ' ' + (k + 1), onclick: function () { show(k); } },
        h('img', { src: p.src, width: p.w, height: p.h, alt: '', loading: 'lazy', decoding: 'async' }));
    }));
    function show(k) {
      i = (k + pages.length) % pages.length;
      var p = pages[i];
      img.src = p.src; img.width = p.w; img.height = p.h; img.alt = label + ' ' + (i + 1) + ' of ' + pages.length;
      count.textContent = (i + 1) + ' / ' + pages.length;
      Array.prototype.forEach.call(strip.children, function (b, n) { b.toggleAttribute('aria-current', n === i); });
      var cur = strip.children[i];
      if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    var wrap = h('div', { class: 'pager', tabindex: '0', onkeydown: function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      } },
      h('div', { class: 'pager-stage' }, img,
        h('button', { type: 'button', class: 'pager-prev', 'aria-label': 'Previous slide', onclick: function () { show(i - 1); } }, '←'),
        h('button', { type: 'button', class: 'pager-next', 'aria-label': 'Next slide', onclick: function () { show(i + 1); } }, '→')),
      h('div', { class: 'pager-foot' }, count, strip));
    show(0);
    return wrap;
  }

  function pagesDown(pages, label) {
    return h('div', { class: 'doc', tabindex: '0' }, pages.map(function (p, k) {
      return h('img', { src: p.src, width: p.w, height: p.h, alt: label + ', page ' + (k + 1), loading: k ? 'lazy' : 'eager', decoding: 'async' });
    }));
  }

  function col(n) { var s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }

  function workbook(it) {
    var fx = h('output', { class: 'sheet-fx' });
    var tabs = h('div', { class: 'sheet-tabs', role: 'tablist' });
    var pane = h('div', { class: 'sheet-pane', tabindex: '0' });
    var hint = 'Click any shaded cell to see its formula.' + (it.sheetNote ? ' ' + it.sheetNote : '');
    function say(ref, c, td) {
      pane.querySelectorAll('td.is-sel').forEach(function (t) { t.classList.remove('is-sel'); });
      td.classList.add('is-sel');
      fx.replaceChildren(h('b', { text: ref }), (c.f || c.v || ''));
    }
    function showSheet(s, tab) {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', String(b === tab)); });
      var width = Math.max.apply(null, s.rows.map(function (r) { return r.length; }));
      var head = [h('th')];
      for (var c = 0; c < width; c++) head.push(h('th', { scope: 'col', text: col(c) }));
      var table = h('table', { class: 'sheet' },
        h('thead', {}, h('tr', {}, head)),
        h('tbody', {}, s.rows.map(function (r, ri) {
          return h('tr', {}, h('th', { scope: 'row', text: String(ri + 1) }), r.map(function (cell, ci) {
            var cls = [cell.f ? 'has-f' : '', /^-?[\d,.]+%?$/.test(cell.v) ? 'num' : ''].join(' ').trim();
            var td = h('td', { class: cls || null, tabindex: cell.v || cell.f ? '0' : null, title: cell.f || (cell.v && cell.v.length > 40 ? cell.v : null) }, cell.v);
            var ref = col(ci) + (ri + 1);
            td.addEventListener('click', function () { say(ref, cell, td); });
            td.addEventListener('focus', function () { say(ref, cell, td); });
            return td;
          }));
        })));
      pane.replaceChildren(table);
      pane.scrollTop = 0;
      fx.textContent = s.rows.some(function (r) { return r.some(function (c) { return c.f; }); }) ? hint : (it.sheetNote || '');
    }
    var first = null;
    it.sheets.forEach(function (s, i) {
      var b = h('button', { type: 'button', role: 'tab', text: s.name, onclick: function () { showSheet(s, b); } });
      tabs.append(b);
      if (i === (it.startSheet || 0)) first = function () { showSheet(s, b); };
    });
    if (first) first();
    return h('div', { class: 'workbook' }, fx, pane, tabs);
  }

  function open(id, from) {
    return load().then(function (all) {
      var it = all[id];
      if (!it) return;
      opener = from || document.activeElement;
      var d = shell();
      d.dataset.kind = it.kind;
      d.querySelector('.viewer-kind').textContent = KIND[it.kind] || it.kind;
      d.querySelector('.viewer-title').textContent = it.title;
      d.querySelector('.viewer-made').textContent = it.made || '';
      var actions = d.querySelector('.viewer-actions');
      actions.replaceChildren();
      if (it.download) actions.append(h('a', { class: 'v-btn v-btn--ember', href: it.download.src, download: true, text: it.download.label }));
      if (it.alt) actions.append(h('a', { class: 'v-btn', href: it.alt.src, target: '_blank', rel: 'noopener', text: it.alt.label }));
      if (it.site) actions.append(h('a', { class: 'v-btn', href: it.site.src, target: '_blank', rel: 'noopener', text: 'Open in a new tab' }));
      var body = d.querySelector('.viewer-body');
      var view;
      if (it.kind === 'slides') view = pager(it.pages, 'Slide');
      else if (it.kind === 'document') view = pagesDown(it.pages, it.title);
      else if (it.kind === 'sheet') view = workbook(it);
      else if (it.kind === 'video') view = h('video', { class: 'film', src: it.video.src, poster: it.video.poster, controls: true,
        autoplay: true, playsinline: true, preload: 'metadata', width: it.video.w, height: it.video.h });
      else if (it.kind === 'site') view = h('iframe', { class: 'site-frame', src: it.site.src, title: it.title + ', live' });
      body.replaceChildren(view);
      document.documentElement.style.overflow = 'hidden';
      if (!d.open) d.showModal();
      history.replaceState(null, '', '#' + id);
      var f = body.querySelector('.pager, .doc, video, iframe, .sheet-pane');
      if (f) f.focus({ preventScroll: true });
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open]');
    if (!t || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;   // a modified click keeps the plain link
    e.preventDefault();
    open(t.getAttribute('data-open'), t);
  });
  window.procisViewer = { open: open };
  if (location.hash.length > 1) {
    var id = decodeURIComponent(location.hash.slice(1));
    load().then(function (all) { if (all[id]) open(id); });
  }
})();
