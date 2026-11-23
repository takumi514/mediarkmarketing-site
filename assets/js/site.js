/* 株式会社メディアーク ホームページ:全ページ共通の動き
   (メニューの開け閉め/上の帯の影/出てくる時の動き/画面に入った時だけ映像を流す/スマホの下の帯/お問い合わせの入力の確かめ)
   外には何も送らない。 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 上の帯:少し下へ送ったら影を付ける ---- */
  var hd = $('#hd');
  function onScroll() { if (hd) hd.classList.toggle('is-stuck', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---- スマホのメニュー ---- */
  var btn = $('.menu-btn'), drawer = $('#drawer');
  function setMenu(open) {
    if (!btn || !drawer) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var lb = $('.menu-lb', btn); if (lb) lb.textContent = open ? '閉じる' : 'メニュー';
    if (open) {
      drawer.hidden = false; void drawer.offsetWidth; drawer.classList.add('is-open');
      doc.body.style.overflow = 'hidden';
    } else {
      drawer.classList.remove('is-open'); doc.body.style.overflow = '';
      setTimeout(function () { if (btn.getAttribute('aria-expanded') !== 'true') drawer.hidden = true; }, 260);
    }
  }
  if (btn && drawer) {
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setMenu(false); btn.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1240 && btn.getAttribute('aria-expanded') === 'true') setMenu(false); });
  }

  /* ---- 出てくる時の動き ---- */
  var rv = $$('.rv, .rv-l, .rv-r, .rv-pop');
  var showAll = function () { rv.forEach(function (el) { el.classList.add('is-in'); }); };
  if (!('IntersectionObserver' in window) || reduce || /[?&]still=1/.test(location.search)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
    window.addEventListener('beforeprint', showAll);   /* 印刷の時は、全部出す */
  }

  /* ---- 画面に入っている間だけ流す映像(スマホの電池と通信を使いすぎないため) ---- */
  var vids = $$('video.js-inview');
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { vio.observe(v); });
  }

  /* ---- スマホの下の帯(電話・お問い合わせ):最初の面を過ぎたら出し、お問い合わせの所では引っ込める ---- */
  var dock = $('#dock'), hero = $('.hero, .l-hero'), contact = $('#contact');
  if (dock && 'IntersectionObserver' in window) {
    var past = !hero, atContact = false;
    var upd = function () { dock.classList.toggle('is-on', past && !atContact); };
    if (hero) new IntersectionObserver(function (es) { past = !es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(hero);
    if (contact) new IntersectionObserver(function (es) { atContact = es[0].isIntersecting; upd(); }, { threshold: 0.12 }).observe(contact);
    upd();
  }

  /* ---- お問い合わせ:入力の確かめと送信(送り先は form の data-endpoint。空なら確認用でどこにも送らない) ---- */
  var form = $('#contact-form');
  if (form) {
    var fields = [
      { el: $('#f-name'), ok: function (v) { return v.trim().length > 0; } },
      { el: $('#f-mail'), ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
      { el: $('#f-body'), ok: function (v) { return v.trim().length > 0; } },
      { el: $('#f-agree'), ok: function (_v, el) { return el.checked; } }
    ];
    var check = function (f) {
      var good = f.ok(f.el.value, f.el), box = f.el.closest('.fld');
      box.classList.toggle('is-err', !good);
      f.el.setAttribute('aria-invalid', good ? 'false' : 'true');
      return good;
    };
    fields.forEach(function (f) {
      var ev = f.el.type === 'checkbox' ? 'change' : 'blur';
      f.el.addEventListener(ev, function () { if (f.el.type === 'checkbox' || f.touched || f.el.value) { f.touched = true; check(f); } });
      f.el.addEventListener('input', function () { if (f.el.closest('.fld').classList.contains('is-err')) check(f); });
    });
    var sendBtn = form.querySelector('button[type="submit"]'), sendLabel = sendBtn.querySelector('.lb'), sendErr = $('#e-send');
    var sending = false, openedAt = Date.now();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;                                   /* 二重に送らない */
      var bad = fields.filter(function (f) { f.touched = true; return !check(f); });
      if (bad.length) { bad[0].el.focus(); return; }
      var endpoint = form.getAttribute('data-endpoint');
      /* 確認用の版(送り先が空):送信せず、送信完了の画面だけを見せる。 */
      if (!endpoint) { window.location.href = '/thanks?preview=1'; return; }
      /* 本番:送り先(data-endpoint)へ送り、うまくいったら /thanks へ進む(移し替えの手順を参照)。 */
      var trap = form.querySelector('input[name="_gotcha"]');
      if (trap && trap.value) { window.location.href = '/thanks'; return; }   /* 機械の書き込みは送らない */
      var data = {};
      [].forEach.call(form.elements, function (el) {
        if (!el.name || el.name === '_gotcha' || el.type === 'submit') return;
        data[el.name] = el.type === 'checkbox' ? (el.checked ? '同意する' : '') : el.value.trim();
      });
      data._t = Date.now() - openedAt;                        /* 開いてから送るまでのミリ秒(受け口が、速すぎる機械の送信を見分ける) */
      var finish = function (ok) {
        if (ok) { window.location.href = '/thanks'; return; }
        sending = false; sendBtn.disabled = false; sendBtn.removeAttribute('aria-busy');
        if (sendLabel) sendLabel.textContent = '送信する';
        if (sendErr) { sendErr.hidden = false; sendErr.focus(); }
      };
      sending = true; sendBtn.disabled = true; sendBtn.setAttribute('aria-busy', 'true');
      if (sendLabel) sendLabel.textContent = '送信しています…';
      if (sendErr) sendErr.hidden = true;
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);   /* 20秒待っても返事が無ければ、失敗として知らせる */
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(timer); finish(r.ok); })
        .catch(function () { clearTimeout(timer); finish(false); });
    });
  }

  /* ---- 送信完了の画面:確認用の版から来た時の知らせ ---- */
  if (/[?&]preview=1/.test(location.search)) root.classList.add('is-preview');
})();
