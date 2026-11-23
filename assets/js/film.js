/* トップページの「動く見本」(会社向けのアニメーション)。約35秒で1周し、くり返す。音は無い。
   絵柄と言葉は、本番の説明アニメ(app.mediarkmarketing.com/demo/standard/)にそろえてある:暗いスタジオ・オレンジの差し色・見出しの組み方・札の形。
   ホームページの中で軽く動くよう、3Dの道具(three.js)は使わず、ふつうの部品(HTMLとCSSの立体)だけで組む。読み込むのは、この1本と見本の映像1本(約400KB)だけ。
   ・絵はすべて「時刻 t から決まる」ように描く(どこへ飛ばしても同じ絵になる。録画の時もコマ落ちしない)
   ・大きさは、舞台の幅に合わせた「1単位」で決める(横長=幅720単位、縦長=幅360単位)。文字がぼやけないよう、拡大・縮小ではなく実寸で組む
   ・無料お試しの期間は、HTMLの data-trial(build.py の TRIAL)から読む
   ・場面:1 撮る → 2 仕上げる(AIが下書き → 直して公開・画像や表)→ 3 見る(9か国語の字幕と読み上げ)→ 4 確かめる → 5 料金
   確認用の開き方:  #t=12.5(その秒で止めて開く) / #rec(録画用。自分では動かず、外から window.__film.seek(秒) で時刻を送る) */
(function () {
  'use strict';
  var root = document.getElementById('film');
  if (!root) return;
  var stage = root.querySelector('.film-stage');
  var HASH = location.hash || '';
  var REC = /rec/.test(HASH);
  var FIX = (HASH.match(/t=([\d.]+)/) || [])[1];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOV = '/mediarkmarketing-site/assets/film/';
  var TRIAL = root.getAttribute('data-trial') || '1か月';      /* 印が無い時の控えも、今の期間(1か月)にしてある */

  /* ---------- 数の道具 ---------- */
  function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function seg(t, a, b) { return b <= a ? (t >= b ? 1 : 0) : c01((t - a) / (b - a)); }
  var E = {
    out: function (p) { return 1 - Math.pow(1 - p, 5); },                       /* 速く入って、静かに止まる */
    out3: function (p) { return 1 - Math.pow(1 - p, 3); },
    in2: function (p) { return p * p; },
    io: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    back: function (p) { var c = 0.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }   /* はね返りは、ごく小さく */
  };
  function ramp(t, a, b, e) { return (e || E.out)(seg(t, a, b)); }
  function fl(t, sp, amp, ph) { return Math.sin(t * sp + (ph || 0)) * amp; }

  /* ---------- 場面の時刻 ---------- */
  var DUR = [5.2, 11.4, 7.6, 5.2, 5.6], START = [], TOTAL = 0;
  DUR.forEach(function (d) { START.push(TOTAL); TOTAL += d; });
  var OUT = 0.42;                              /* 場面の終わりに、消えるのにかける時間 */
  var SETTLE = [2.2, 5.4, 6.2, 3.6, 3.6];      /* 動きを止めて見せる時の、場面ごとの「見せたい時刻」 */
  var FIRST = 2.2;                             /* 開いた時に、最初に見せる時刻(止め絵 film-poster と同じ) */

  /* ---------- 部品を作る(数字はすべて「単位」。K を掛けてピクセルにする) ---------- */
  var K = 1;
  function px(v) { return (v * K).toFixed(2) + 'px'; }
  function mk(cls, html, parent) {
    var d = document.createElement('div'); d.className = 'fx ' + cls;
    if (html != null) d.innerHTML = html;
    if (parent) parent.appendChild(d);
    return d;
  }
  function size(e, w, h) { e.style.width = px(w); if (h != null) e.style.height = px(h); return e; }
  function pos(e, x, y) { e.style.left = px(x); e.style.top = px(y); return e; }
  function box(e, x, y, w, h) { e.style.left = px(x); e.style.top = px(y); e.style.width = px(w); e.style.height = px(h); return e; }
  function op(e, o) {
    o = o < 0.004 ? 0 : o > 0.996 ? 1 : Math.round(o * 250) / 250;
    if (e._o !== o) { e.style.opacity = o; e._o = o; var v = o === 0 ? 'hidden' : 'visible'; if (e._v !== v) { e.style.visibility = v; e._v = v; } }
  }
  /* 位置(x,y,奥行きz)・回転(rx,ry,rz 度)・大きさ・濃さ */
  function tf(e, x, y, z, rx, ry, rz, s, o) {
    var v = 'translate3d(' + (x * K).toFixed(1) + 'px,' + (y * K).toFixed(1) + 'px,' + ((z || 0) * K).toFixed(1) + 'px)';
    if (ry) v += ' rotateY(' + ry.toFixed(2) + 'deg)';
    if (rx) v += ' rotateX(' + rx.toFixed(2) + 'deg)';
    if (rz) v += ' rotateZ(' + rz.toFixed(2) + 'deg)';
    if (s != null && s !== 1) v += ' scale(' + s.toFixed(4) + ')';
    if (e._t !== v) { e.style.transform = v; e._t = v; }
    if (o != null) op(e, o);
  }
  /* 平らな部品(文字の札など):少し下から、ふわっと出す */
  function pop(e, x, y, k, o, dy) { tf(e, x, y + (1 - k) * (dy == null ? 14 : dy), 0, 0, 0, 0, lerp(0.94, 1, k), o == null ? c01(k * 1.5) : o); }
  function cls(e, name, on) { var k = '_k' + name; if (e[k] !== !!on) { e[k] = !!on; e.classList.toggle(name, !!on); } }
  function text(e, s) { if (e._x !== s) { e.textContent = s; e._x = s; } }
  function edges(p) { for (var i = 4; i >= 1; i--) { var ed = mk('edge', null, p); ed.style.transform = 'translateZ(' + px(-2.2 * i) + ')'; } }
  function vid() {
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = REC ? 'auto' : 'metadata';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = MOV + 'clip_raw.jpg'; v.src = MOV + 'clip_raw.mp4';
    v.tabIndex = -1; v.disablePictureInPicture = true;
    return v;
  }

  /* 絵記号(線の太さ・形は、ページのほかの絵記号と同じ調子) */
  function svg(d, fill) { return '<svg viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  var I = {
    cut: svg('<circle cx="6" cy="17.5" r="3"/><circle cx="6" cy="6.5" r="3"/><path d="M8.5 8.3L20 18M8.5 15.7L20 6"/>'),
    sub: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M6.5 11.5h4M13.5 11.5h4M6.5 15h7M16.5 15h1"/>'),
    voice: svg('<path d="M3.5 9.5v5h3.5l5 4v-13l-5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    warn: svg('<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
    globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.500 12h17M12 3.500c2.500 2.600 3.600 5.400 3.600 8.500s-1.100 5.900-3.600 8.500c-2.500-2.600-3.600-5.400-3.600-8.500s1.100-5.900 3.600-8.500z"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    up: svg('<path d="M12 16V4.500M7 9.500l5-5 5 5M4.500 19.500h15"/>'),
    pen: svg('<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500z"/><path d="M14.500 6l3 3"/>'),
    table: svg('<rect x="3" y="4.500" width="18" height="15" rx="2"/><path d="M3 9.500h18M3 14.500h18M9.500 4.500v15"/>'),
    qr: svg('<rect x="3.500" y="3.500" width="6.500" height="6.500" rx="1"/><rect x="14" y="3.500" width="6.500" height="6.500" rx="1"/><rect x="3.500" y="14" width="6.500" height="6.500" rx="1"/><path d="M14 14h2.500v2.500M20.500 14v.500M14 20.500h.500M17.500 17.500v3h3v-3"/>'),
    phone: svg('<rect x="6.500" y="2.500" width="11" height="19" rx="2.500"/><path d="M10.500 18.500h3"/>'),
    play: svg('<path d="M7 4.500v15a1 1 0 0 0 1.500.900l12-7.500a1 1 0 0 0 0-1.800l-12-7.500A1 1 0 0 0 7 4.500z"/>', true),
    tri: '<svg viewBox="0 0 24 24"><path d="M12 2.800L1.800 20.600h20.400z" fill="#111" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.300v5.400M12 17.300v.4" stroke="#ffd400" stroke-width="2.400" stroke-linecap="round"/></svg>',
    cur: '<svg viewBox="0 0 26 26"><path d="M5 3l15 9.500-6.500 1.500 4 7.500-3.200 1.700-4-7.600L5.500 20z" fill="#fff" stroke="#0a1220" stroke-width="1.800" stroke-linejoin="round"/></svg>'
  };

  /* スマホ(よこ):幅 w */
  function phoneLand(w, parent) {
    var b = w * 0.018, sw = w - b * 2, sh = sw * 9 / 16, h = sh + b * 2;
    var p = size(mk('f-phone f3d', null, parent), w, h); p.style.borderRadius = px(h * 0.14);
    edges(p);
    var s = box(mk('scr', null, p), b, b, sw, sh); s.style.borderRadius = px(h * 0.105);
    mk('gl', null, p);
    p.W = w; p.H = h; p.scr = s; p.SW = sw; p.SH = sh; p.B = b;
    return p;
  }
  /* スマホ(たて):幅 w */
  function phone(w, parent) {
    var b = w * 0.032, sw = w - b * 2, sh = sw * 844 / 390, h = sh + b * 2;
    var p = size(mk('f-phone f3d', null, parent), w, h); p.style.borderRadius = px(w * 0.15);
    edges(p);
    var s = box(mk('scr', null, p), b, b, sw, sh); s.style.borderRadius = px(w * 0.122);
    box(mk('isl', null, p), w * 0.37, b + w * 0.026, w * 0.26, w * 0.06);
    mk('gl', null, p);
    p.W = w; p.H = h; p.scr = s; p.SW = sw; p.SH = sh; p.B = b;
    return p;
  }
  /* 見出し(上の小さい字+大きい字2行。2行目はオレンジ)。入る時刻 a・消える時刻 z は、場面の中の秒 */
  function head(parent, kick, l1, l2, center) {
    var h = mk('f-hd' + (center ? ' is-c' : ''), '<div class="f-kick"><i></i><span>' + kick + '</span></div><div class="f-h"><span class="ln">' + l1 + '</span>' + (l2 ? '<span class="ln hot">' + l2 + '</span>' : '') + '</div>', parent);
    h.rule = h.querySelector('.f-kick i'); h.kick = h.querySelector('.f-kick span'); h.lns = [].slice.call(h.querySelectorAll('.ln'));
    return h;
  }
  function headAt(h, x, y, tau, a, z) {
    var k = seg(tau, a, a + 1.0), out = z == null ? 0 : seg(tau, z - 0.32, z), o = (k > 0 ? 1 : 0) * (1 - out);
    tf(h, x - E.in2(out) * 22, y, 0, 0, 0, 0, 1, o);
    if (!o) return;
    h.rule.style.transform = 'scaleX(' + ramp(tau, a, a + 0.55).toFixed(3) + ')';
    var kk = ramp(tau, a + 0.05, a + 0.5); h.kick.style.opacity = kk.toFixed(3); h.kick.style.transform = 'translateX(' + px((1 - kk) * -10) + ')';
    h.lns.forEach(function (ln, i) {
      var p = ramp(tau, a + 0.14 + i * 0.13, a + 0.72 + i * 0.13);
      ln.style.opacity = c01(p * 1.6).toFixed(3); ln.style.transform = 'translateY(' + px((1 - p) * 18) + ')';
    });
  }

  /* ---------- 組み立て ---------- */
  var canvas, M, S = [], built = false, wide = true;
  function build() {
    var cw = stage.clientWidth || 600, ch = stage.clientHeight || 500;
    wide = cw / Math.max(1, ch) >= 1.02;
    M = wide ? { W: 720, H: 600 } : { W: 360, H: 450 };
    K = cw / M.W;
    if (canvas) canvas.remove();
    canvas = document.createElement('div'); canvas.className = 'film-canvas' + (wide ? '' : ' tall');
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; canvas.style.setProperty('--u', K.toFixed(4) + 'px');
    var W = wide;
    S = [];

    /* 背景:暗いスタジオ。床の明かり・ゆっくり動く光・舞うほこり */
    var bg = mk('f-bg', null, canvas);
    var g1 = size(mk('f-glow g1', null, bg), M.W * 0.9, M.W * 0.9), g2 = size(mk('f-glow g2', null, bg), M.W * 1.0, M.W * 1.0);
    var dust = [];
    for (var i = 0; i < (W ? 16 : 10); i++) {
      var d = mk('f-dust', null, bg), r = (i * 37 % 10) / 10;
      d.style.width = d.style.height = px(1.6 + r * 2.2);
      dust.push({ e: d, x: ((i * 61) % 100) / 100, y: ((i * 29 + 13) % 100) / 100, sp: 0.05 + r * 0.07, ph: i * 1.7, o: 0.16 + r * 0.3 });
    }
    S.bg = { g1: g1, g2: g2, dust: dust };
    function sc() { var s = mk('f-sc', null, canvas); return s; }

    /* --- 場面1:撮る --- */
    var s0 = { el: sc() };
    s0.hd = head(s0.el, 'げんば動画スタジオなら', 'スマホで撮って、', '送るだけ。');
    s0.shadow = size(mk('f-shadow', null, s0.el), W ? 400 : 300, W ? 54 : 40);
    s0.ph = phoneLand(W ? 440 : 324, s0.el);
    s0.v = vid(); s0.ph.scr.appendChild(s0.v);
    s0.dim = mk('dim', null, s0.ph.scr);
    s0.rec = pos(mk('f-rec', '<i></i><span>REC</span><b>00:12</b>', s0.ph), s0.ph.W * 0.05, s0.ph.H * 0.11);
    s0.recDot = s0.rec.querySelector('i'); s0.recT = s0.rec.querySelector('b');
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (c) {
      var k = pos(mk('f-corner', null, s0.ph), s0.ph.W * (c[0] ? 0.9 : 0.06), s0.ph.H * (c[1] ? 0.76 : 0.30));
      k.style[c[0] ? 'borderRightWidth' : 'borderLeftWidth'] = px(2); k.style[c[1] ? 'borderBottomWidth' : 'borderTopWidth'] = px(2);
    });
    s0.sent = mk('f-sent', '<i>' + I.check + '</i><span>送りました</span>', s0.ph.scr);
    s0.btn = mk('f-btn', I.up + '<span>動画をアップロード</span><em class="fx"><b class="fx"></b></em>', s0.el);
    s0.btnBar = s0.btn.querySelector('em b'); s0.btnTxt = s0.btn.querySelector('span');
    s0.tap = mk('f-tap', null, s0.el);
    s0.cur = mk('f-cursor', I.cur, s0.el);
    S.push(s0);

    /* --- 場面2:仕上げる(AIが下書き → 直したい所だけ直して公開。写真・図・表も) --- */
    var s1 = { el: sc() };
    s1.hdA = head(s1.el, 'あとは、AIが手伝います', 'AIが、', '下書きを作る。');
    s1.hdB = head(s1.el, 'あとは、AIが手伝います', '直したい所だけ、', '直して公開。');
    var FW = W ? 500 : 324, FH = FW * 9 / 16;
    s1.shadow = size(mk('f-shadow', null, s1.el), FW * 0.9, W ? 52 : 38);
    s1.fr = size(mk('f-frame f3d', null, s1.el), FW, FH); s1.fr.W = FW; s1.fr.H = FH;
    s1.v = vid(); s1.fr.appendChild(s1.v);
    s1.shade = mk('shade', null, s1.fr);
    s1.cutL = mk('cutbar', '<i></i><b></b>', s1.fr);                                  /* 最初のむだのカット(映像の下の帯の、左の端が切れる) */
    s1.cap = mk('f-cap', '<span>保護面をつけてから始める</span><i class="pen">' + I.pen + '</i>', s1.fr);
    s1.capTxt = s1.cap.querySelector('span');
    s1.mark = mk('f-mark', I.tri + '<span>注意</span>', s1.fr);
    s1.wave = mk('f-wave', null, s1.fr); s1.bars = [];
    for (i = 0; i < 34; i++) s1.bars.push(mk('', null, s1.wave));
    s1.lang = mk('f-langtag', I.globe + '<span>9か国語</span>', s1.fr);
    s1.tbl = mk('f-tbl', '<h6>溶接の前に、周りを確かめる</h6><table><tr><th>確かめる所</th><th>見る点</th></tr><tr><td>足元</td><td>油・紙くず・布が無い</td></tr><tr><td>周り</td><td>スプレー缶・塗料が無い</td></tr><tr><td>消火器</td><td>すぐ手の届く所にある</td></tr></table>', s1.fr);
    s1.pub = mk('f-pub', '<i>' + I.check + '</i><span>公開中</span>', s1.fr);
    s1.chips = mk('f-chips', null, s1.el);
    s1.chip = [['cut', '最初のむだのカット'], ['sub', '字幕'], ['voice', '読み上げ'], ['warn', '注意マーク'], ['globe', '外国語の字幕と読み上げ']].map(function (c) {
      var e = document.createElement('div'); e.className = 'f-chip'; e.innerHTML = I[c[0]] + '<span>' + c[1] + '</span><i></i>'; s1.chips.appendChild(e); return e;
    });
    s1.tagE = mk('f-tag', I.pen + '<span>文を書き換えると、' + (W ? '' : '<br>') + '読み上げも作り直します</span>', s1.el);
    s1.tagT = mk('f-tag', I.table + '<span>画像・表:写真・図・表も、' + (W ? '' : '<br>') + '大きく出せます</span>', s1.el);
    s1.tagP = mk('f-tag ok', I.check + '<span>公開しました。' + (W ? '' : '<br>') + '社員の方が見られるようになります</span>', s1.el);
    S.push(s1);

    /* --- 場面3:見る(スマホで見るだけ → 字幕と読み上げを9か国語で) --- */
    var s2 = { el: sc() };
    s2.hdA = head(s2.el, '社員の方は', 'スマホで、', '見るだけ。');
    s2.hdB = head(s2.el, '外国の方にも', '9か国語の字幕と', '読み上げで。');
    s2.ph = phone(W ? 296 : 224, s2.el);
    var sw = s2.ph.SW, u = sw / 285;                  /* スマホの画面の中は、幅285の時の大きさを基準に組む */
    s2.ui = mk('f-ui', null, s2.ph.scr); s2.ui.style.setProperty('--v', (u * K).toFixed(4) + 'px');
    s2.ui.innerHTML = '<div class="bar"><b>‹</b>一覧へ</div><div class="vw"></div>' +
      '<div class="ctl"><i>' + I.play + '</i><em><b></b></em><span>0:14 / 1:07</span></div>' +
      '<div class="ttl">溶接作業の安全手順</div><div class="meta">安全作業の手順 ・ 長さ 1:07</div>' +
      '<div class="lg">' + I.globe + '<span>字幕 / Language:<b>日本語のみ</b></span></div>' +
      '<div class="sm">読み上げは合成音声(機械の声)です</div>';
    s2.vw = s2.ui.querySelector('.vw'); s2.v = vid(); s2.vw.appendChild(s2.v);
    s2.mark = mk('f-mark sm', I.tri + '<span>注意</span>', s2.vw);
    s2.capJ = mk('f-cap is-warn', '<span>保護面をつけてから始める</span>', s2.vw);
    s2.capP = mk('f-cap is-warn lat', '<span>Coloque a máscara de proteção<br>antes de começar.</span>', s2.vw);
    s2.lgB = s2.ui.querySelector('.lg b'); s2.lg = s2.ui.querySelector('.lg'); s2.seek = s2.ui.querySelector('.ctl em b');
    s2.b1 = mk('f-tag', I.qr + '<span>QRコードと暗証番号で</span>', s2.el);
    s2.b2 = mk('f-tag', I.phone + '<span>アプリは要りません</span>', s2.el);
    s2.pan = mk('f-pan', '<h6>' + I.globe + '<span>言葉を選ぶ</span></h6><ul></ul><p>' + I.voice + '<span>読み上げは、機械の声(合成音声)です</span></p>', s2.el);
    s2.lis = ['英語', 'ポルトガル語', '中国語', 'ベトナム語', 'タガログ語', 'インドネシア語', 'スペイン語', 'ヒンディー語', 'ベンガル語'].map(function (n) {
      var li = document.createElement('li'); li.textContent = n; s2.pan.querySelector('ul').appendChild(li); return li;
    });
    S.push(s2);

    /* --- 場面4:確かめる --- */
    var s3 = { el: sc() };
    s3.hd = head(s3.el, '会社の方は', 'だれが見たか、', 'まだかも、ひと目で。');
    s3.shadow = size(mk('f-shadow', null, s3.el), W ? 380 : 290, W ? 52 : 38);
    s3.pn = mk('f-panel f3d', '<header><b>だれが見たか</b><span>溶接作業の安全手順</span></header>' +
      [['佐', '佐藤', 'ok', '見た'], ['鈴', '鈴木', 'ok', '見た'], ['田', '田中', 'half', '途中'], ['高', '高橋', 'yet', 'まだ']].map(function (r) {
        return '<div class="row"><i>' + r[0] + '</i><b>' + r[1] + '</b><span class="st ' + r[2] + '">' + (r[2] === 'ok' ? I.check : '') + r[3] + '</span></div>';
      }).join(''), s3.el);
    s3.sts = [].slice.call(s3.pn.querySelectorAll('.st'));
    s3.ring = mk('f-ring round', null, s3.pn);
    s3.sheen = mk('sheen', null, s3.pn);
    s3.tag = mk('f-tag', '<span>「まだ」の人にだけ、' + (W ? '<br>' : '') + '声をかけられます</span>', s3.el);
    s3.note = mk('f-note', '※社員ごとの暗証番号で見た場合', s3.el);
    S.push(s3);

    /* --- 場面5:料金 --- */
    var s4 = { el: sc() };
    s4.hd = head(s4.el, 'げんば動画スタジオ', '料金と<em>お試し</em>', null, true);
    s4.a = mk('f-slab hot f3d', '<div class="in"><small>' + TRIAL + '</small><b>無料</b><small>でお試し</small></div><i class="sheen fx"></i>', s4.el);
    s4.b = mk('f-slab f3d', '<div class="top">続ける場合</div><div class="in"><small>月額</small><b>30,250円</b><small>(税込)</small></div>', s4.el);
    s4.c = mk('f-slab sm f3d', '<div class="in"><small>初期費用</small><b>なし</b></div>', s4.el);
    s4.sheen = s4.a.querySelector('.sheen');
    s4.note = mk('f-note is-c', '<span>お試しは、1社様につき1回です。</span><br><span>何もしなければ自動で終わり、</span><span>料金はかかりません。</span>', s4.el);
    S.push(s4);

    stage.appendChild(canvas);
    measure();
    built = true; cur = -1;
  }
  /* 大きさを測っておく物(文字の札は、中身で幅が決まる)。書体が読めた後に、もう一度測る */
  function measure() {
    S.forEach(function (s) { for (var k in s) { var e = s[k]; if (e && e.nodeType === 1 && /f-tag|f-chips|f-pan|f-btn|f-note|f-hd|f-panel|f-slab/.test(e.className)) { e.W = e.offsetWidth / K; e.H = e.offsetHeight / K; } } });
  }

  /* ---------- 描く ---------- */
  var drawers = [
    /* 場面1:撮る */
    function (s, tau, t) {
      var W = wide, HX = W ? 44 : 20, HY = W ? 40 : 18;
      headAt(s.hd, HX, HY, tau, 0.05);
      var a = ramp(tau, 0.12, 1.25), px0 = W ? 238 : 18, py0 = W ? 208 : 136;
      var send = ramp(tau, 3.05, 3.7, E.io), done = seg(tau, 4.1, 4.4);
      tf(s.ph, px0 + (1 - a) * 150, py0 + fl(t, 1.2, 3.5) - send * 6, (1 - a) * -420,
        lerp(18, 7, a) + fl(t, 0.9, 1.0), lerp(-52, W ? -17 : -11, a) + fl(t, 0.7, 1.6) + send * 3, lerp(-6, -1.5, a), 1, c01(a * 1.3));
      tf(s.shadow, px0 + (s.ph.W - (W ? 400 : 300)) / 2 + 10, py0 + s.ph.H + (W ? 26 : 18), 0, 0, 0, 0, lerp(0.7, 1, a), a * 0.95);
      var sec = Math.min(59, 12 + Math.floor(tau * 1.0)); text(s.recT, '00:' + (sec < 10 ? '0' : '') + sec);
      s.recDot.style.opacity = (Math.floor(tau * 1.6) % 2) ? '.25' : '1';
      op(s.rec, 1 - seg(tau, 3.0, 3.3));
      op(s.dim, send * 0.74);
      var sk = ramp(tau, 4.1, 4.6, E.back); s.sent.style.transform = 'translate(-50%,-50%) scale(' + lerp(0.8, 1, sk).toFixed(3) + ')'; op(s.sent, c01(sk * 1.4));
      /* 「動画をアップロード」を押す → 送っています → 送りました */
      var bw = s.btn.W, bh = s.btn.H, bx = W ? 56 : (M.W - bw) / 2, by = W ? 492 : 352;
      var b = ramp(tau, 2.0, 2.55, E.back), press = Math.min(seg(tau, 3.0, 3.07), 1 - seg(tau, 3.07, 3.25));
      tf(s.btn, bx, by + (1 - b) * 16, 0, 0, 0, 0, lerp(0.9, 1, b) * (1 - press * 0.05), c01(b * 1.4));
      var fill = ramp(tau, 3.15, 4.1, E.io);
      text(s.btnTxt, tau < 3.1 ? '動画をアップロード' : done >= 1 ? '送りました' : '送っています… ' + Math.round(fill * 100) + '%');
      s.btnBar.style.transform = 'scaleX(' + fill.toFixed(3) + ')'; cls(s.btn, 'is-busy', tau >= 3.1 && done < 1); cls(s.btn, 'is-done', done >= 1);
      var cu = ramp(tau, 2.35, 3.0, E.io), cx = lerp(bx + bw + 60, bx + bw * 0.84, cu), cy = lerp(by + 96, by + bh * 0.6, cu);
      tf(s.cur, cx, cy, 0, 0, 0, 0, 1, seg(tau, 2.3, 2.55) * (1 - seg(tau, 3.5, 3.8)));
      var tp = seg(tau, 3.04, 3.6);
      tf(s.tap, bx + bw * 0.84, by + bh * 0.6, 0, 0, 0, 0, lerp(0.4, 1.8, E.out3(tp)), tp > 0 && tp < 1 ? (1 - tp) * 0.9 : 0);
    },
    /* 場面2:仕上げる */
    function (s, tau, t) {
      var W = wide, HX = W ? 44 : 20, HY = W ? 40 : 18, SW = 6.0;                       /* SW=「直して公開」へ切り替わる時刻 */
      headAt(s.hdA, HX, HY, tau, 0.05, SW); headAt(s.hdB, HX, HY, tau, SW + 0.05);
      var a = ramp(tau, 0.1, 1.15), fx = W ? 172 : 18, fy = W ? 184 : 128, F = s.fr;
      tf(F, fx + (1 - a) * 130, fy + fl(t, 1.1, 3), (1 - a) * -380, lerp(12, 4, a) + fl(t, 0.8, 0.6), lerp(-40, W ? -8 : -5, a) + fl(t, 0.6, 1.0), 0, 1, c01(a * 1.3));
      tf(s.shadow, fx + F.W * 0.05, fy + F.H + (W ? 22 : 14), 0, 0, 0, 0, lerp(0.7, 1, a), a * 0.9);
      /* AIが下書きを作る:一覧の札が、順に点く(本番の説明アニメと同じ順) */
      var ON = [1.0, 1.75, 2.5, 3.25, 4.05];
      var ck = ramp(tau, 0.55, 1.0) * (1 - seg(tau, SW - 0.25, SW + 0.1));
      pop(s.chips, W ? 40 : 18, W ? 488 : 322, ck, ck);
      s.chip.forEach(function (c, i) { cls(c, 'on', tau >= ON[i]); var p = seg(tau, ON[i], ON[i] + 0.35); c.style.transform = 'scale(' + (p > 0 && p < 1 ? 1 + Math.sin(p * Math.PI) * 0.05 : 1).toFixed(3) + ')'; });
      /* 最初のむだのカット */
      var cut = ramp(tau, ON[0], ON[0] + 0.5, E.io);
      op(s.cutL, seg(tau, 0.6, 0.9) * (1 - seg(tau, 2.2, 2.6))); s.cutL.firstChild.style.transform = 'scaleX(' + (1 - cut).toFixed(3) + ')'; s.cutL.lastChild.style.opacity = (cut > 0 && cut < 1 ? 1 : 0);
      /* 字幕 */
      var cp = ramp(tau, ON[1], ON[1] + 0.45, E.back);
      s.cap.style.transform = 'translate(-50%,' + px((1 - cp) * 12) + ')'; op(s.cap, c01(cp * 1.5) * (1 - seg(tau, 7.95, 8.2)) + seg(tau, 9.95, 10.2));
      /* 読み上げ(声の波) */
      var wv = seg(tau, ON[2], ON[2] + 0.3) * (1 - seg(tau, SW - 0.3, SW));
      op(s.wave, wv);
      if (wv > 0) s.bars.forEach(function (b, i) { var hgt = 0.18 + 0.82 * Math.abs(Math.sin(i * 0.9 + t * 7.5) * Math.sin(i * 0.37 + t * 2.3)); b.style.transform = 'scaleY(' + (hgt * c01((tau - ON[2]) * 3 - i * 0.04)).toFixed(3) + ')'; });
      /* 注意マーク */
      var mkp = ramp(tau, ON[3], ON[3] + 0.4, E.back);
      s.mark.style.transform = 'scale(' + lerp(0.5, 1, mkp).toFixed(3) + ')'; op(s.mark, c01(mkp * 1.6));
      cls(s.cap, 'is-warn', tau >= ON[3]);
      /* 外国語の字幕と読み上げ */
      var lg = ramp(tau, ON[4], ON[4] + 0.4, E.back);
      s.lang.style.transform = 'scale(' + lerp(0.6, 1, lg).toFixed(3) + ')'; op(s.lang, c01(lg * 1.6) * (1 - seg(tau, SW - 0.3, SW)));
      /* 直したい所だけ直す:字幕の文を書き換える */
      cls(s.cap, 'is-edit', tau >= 6.6 && tau < 7.85);
      text(s.capTxt, tau >= 7.15 ? '保護面を、必ずつけてから始める' : '保護面をつけてから始める');
      var tgY = W ? 492 : 328, te = ramp(tau, 6.6, 7.0, E.back) * (1 - seg(tau, 7.8, 8.05));
      pop(s.tagE, W ? fx + 36 : (M.W - s.tagE.W) / 2, tgY, te);
      /* 写真・図・表も、大きく出せます */
      var tb = ramp(tau, 8.15, 8.7, E.back) * (1 - seg(tau, 9.85, 10.1));
      s.tbl.style.transform = 'translate(-50%,-50%) scale(' + lerp(0.82, 1, tb).toFixed(3) + ')'; op(s.tbl, c01(tb * 1.5));
      op(s.shade, c01(tb * 1.4) * 0.62);
      var tt = ramp(tau, 8.2, 8.6, E.back) * (1 - seg(tau, 9.85, 10.1));
      pop(s.tagT, W ? fx + 36 : (M.W - s.tagT.W) / 2, tgY, tt);
      /* 公開 */
      var pb = ramp(tau, 10.25, 10.7, E.back);
      s.pub.style.transform = 'scale(' + lerp(0.6, 1, pb).toFixed(3) + ')'; op(s.pub, c01(pb * 1.6));
      var tp = ramp(tau, 10.3, 10.7, E.back);
      pop(s.tagP, W ? fx + 36 : (M.W - s.tagP.W) / 2, tgY, tp);
    },
    /* 場面3:見る */
    function (s, tau, t) {
      var W = wide, HX = W ? 44 : 20, HY = W ? 40 : 18, SW = 3.3;
      headAt(s.hdA, HX, HY, tau, 0.05, SW); headAt(s.hdB, HX, HY, tau, SW + 0.05);
      var a = ramp(tau, 0.1, 1.2), x0 = W ? 404 : (M.W - s.ph.W) / 2, y0 = W ? 150 : 124;      /* スマホは大きく置き、下は舞台の外へはみ出させる(画面の中の字幕が読めるように) */
      tf(s.ph, x0 + (1 - a) * 140, y0 + fl(t, 1.2, 3) + (1 - a) * 30, (1 - a) * -360, lerp(12, 3, a), lerp(-44, W ? -13 : -6, a) + fl(t, 0.7, 1.0), 0, 1, c01(a * 1.3));
      s.seek.style.transform = 'scaleX(' + (0.2 + (tau / DUR[2]) * 0.16).toFixed(3) + ')';
      var b1 = ramp(tau, 1.05, 1.5, E.back) * (1 - seg(tau, SW - 0.25, SW)), b2 = ramp(tau, 1.35, 1.8, E.back) * (1 - seg(tau, SW - 0.25, SW));
      pop(s.b1, W ? 44 : 34, W ? 214 : 330, b1); pop(s.b2, W ? 44 : 34, W ? 264 : 374, b2);
      /* 言葉を選ぶ:英語 → ポルトガル語。字幕と読み上げが、その言葉に切り替わる */
      var pk = ramp(tau, SW + 0.5, SW + 1.0, E.back);
      pop(s.pan, W ? 40 : 18, W ? 216 : M.H - s.pan.H - 12, pk, null, 22);
      var sel = tau >= SW + 1.9 ? 1 : tau >= SW + 1.3 ? 0 : -1;
      s.lis.forEach(function (li, i) { cls(li, 'on', i === sel); });
      var fk = ramp(tau, SW + 2.15, SW + 2.5, E.io);
      op(s.capP, fk); op(s.capJ, 1 - fk);
      text(s.lgB, fk > 0.5 ? 'Português' : '日本語のみ'); cls(s.lg, 'on', fk > 0.5);
    },
    /* 場面4:確かめる */
    function (s, tau, t) {
      var W = wide, HX = W ? 44 : 20, HY = W ? 40 : 18;
      headAt(s.hd, HX, HY, tau, 0.05);
      var a = ramp(tau, 0.15, 1.2), x0 = W ? 268 : (M.W - s.pn.W) / 2, y0 = W ? 190 : 122, P = s.pn;
      tf(P, x0 + (1 - a) * 130, y0 + fl(t, 1.1, 3), (1 - a) * -360, lerp(12, 4, a) + fl(t, 0.8, 0.5), lerp(-40, W ? -9 : -5, a) + fl(t, 0.6, 0.9), 0, 1, c01(a * 1.3));
      tf(s.shadow, x0 + (P.W - (W ? 380 : 290)) / 2 + 8, y0 + P.H + (W ? 20 : 12), 0, 0, 0, 0, lerp(0.7, 1, a), a * 0.9);
      var AT = [1.15, 1.5, 1.85, 2.2];
      s.sts.forEach(function (e, i) { var p = ramp(tau, AT[i], AT[i] + 0.4, E.back); e.style.transform = 'scale(' + lerp(0.5, 1, p).toFixed(3) + ')'; op(e, c01(p * 1.6)); });
      var sh = seg(tau, 0.9, 1.9); s.sheen.style.transform = 'translateX(' + (lerp(-120, 320, sh)).toFixed(1) + '%) skewX(-18deg)'; op(s.sheen, sh > 0 && sh < 1 ? 0.5 : 0);
      /* 「まだ」の人を指す */
      var rk = seg(tau, 2.75, 3.05), last = s.sts[3];
      if (rk > 0) box(s.ring, last.offsetLeft / K - 7, (last.offsetTop) / K - 6, last.offsetWidth / K + 14, last.offsetHeight / K + 12);
      s.ring.style.transform = 'scale(' + lerp(1.4, 1, E.out3(rk)).toFixed(3) + ')'; op(s.ring, rk);
      var tg = ramp(tau, 2.85, 3.3, E.back);
      pop(s.tag, W ? 44 : (M.W - s.tag.W) / 2, W ? 396 : y0 + P.H + 36, tg);
      var nk = ramp(tau, 1.6, 2.2);
      pop(s.note, W ? x0 + 20 : (M.W - s.note.W) / 2, y0 + P.H + (W ? 40 : 8), nk, nk * 0.92, 8);
    },
    /* 場面5:料金 */
    function (s, tau, t) {
      var W = wide;
      headAt(s.hd, (M.W - s.hd.W) / 2, W ? 62 : 30, tau, 0.05);
      function slab(e, x, y, at, i) {
        var k = ramp(tau, at, at + 0.9), f = fl(t, 1.0, 2.4, i * 1.3);
        tf(e, x, y + (1 - k) * 46 + f, (1 - k) * -220, lerp(22, 0, k), fl(t, 0.6, 1.2, i), 0, 1, c01(k * 1.4));
      }
      if (W) { slab(s.a, (M.W - s.a.W) / 2, 194, 0.45, 0); slab(s.b, M.W / 2 - s.b.W - 9, 316, 0.95, 1); slab(s.c, M.W / 2 + 9, 316, 1.4, 2); }
      else { slab(s.a, 18, 104, 0.45, 0); slab(s.b, 18, 198, 0.95, 1); slab(s.c, 18, 286, 1.4, 2); }
      var sh = seg(tau, 1.2, 2.3); s.sheen.style.transform = 'translateX(' + (lerp(-140, 420, sh)).toFixed(1) + '%) skewX(-20deg)'; op(s.sheen, sh > 0 && sh < 1 ? 0.55 : 0);
      var nk = ramp(tau, 0.45, 1.2);               /* 注記(1社様につき1回…)は、無料の札と同時に出す */
      pop(s.note, (M.W - s.note.W) / 2, W ? 446 : 362, nk, nk, 10);
    }
  ];

  var T = 0, cur = -1, segs = [].slice.call(root.querySelectorAll('.film-seg'));
  function sceneAt(t) { for (var i = DUR.length - 1; i >= 0; i--) if (t >= START[i]) return i; return 0; }
  function draw(t) {
    if (!built) return;
    T = t;
    var i = sceneAt(t), tau = t - START[i], out = ramp(tau, DUR[i] - OUT, DUR[i], E.in2), inn = seg(tau, 0, 0.28);
    if (i !== cur) { S.forEach(function (s, k) { if (k !== i) op(s.el, 0); }); cur = i; }
    /* 場面のつなぎ:前の場面は左へ流れて消え、次の場面が右から入る(本番の説明アニメの「流し撮り」と同じ向き) */
    var el = S[i].el, v = 'translate3d(' + ((-out * 46 + (1 - E.out3(inn)) * 30) * K).toFixed(1) + 'px,0,0)';
    if (el._t !== v) { el.style.transform = v; el._t = v; }
    op(el, (1 - out) * c01(inn * 1.4 + 0.02));
    drawers[i](S[i], tau, t);
    /* 背景の光と、ほこりは、ゆっくり動かす */
    tf(S.bg.g1, -M.W * 0.35 + Math.sin(t * 0.21) * 34, -M.W * 0.42 + Math.cos(t * 0.17) * 22, 0, 0, 0, 0, 1, 1);
    tf(S.bg.g2, M.W * 0.30 + Math.cos(t * 0.19) * 40, M.H * 0.42 + Math.sin(t * 0.23) * 24, 0, 0, 0, 0, 1, 1);
    S.bg.dust.forEach(function (d) {
      var y = ((d.y - t * d.sp * 0.12) % 1 + 1) % 1, x = d.x + Math.sin(t * 0.3 + d.ph) * 0.02;
      tf(d.e, x * M.W, y * M.H, 0, 0, 0, 0, 1, d.o * (0.6 + 0.4 * Math.sin(t * 0.8 + d.ph)) * Math.sin(y * Math.PI));
    });
    segs.forEach(function (b, k) {
      cls(b, 'is-on', k === i);
      var f = b.firstElementChild; if (f) f.style.transform = k < i ? 'scaleX(1)' : k === i ? 'scaleX(' + c01(tau / DUR[i]).toFixed(3) + ')' : 'scaleX(0)';
      if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  /* 画面の中の映像:出ている間だけ流す(録画・止めている時は、時刻に合わせて1コマずつ) */
  function videos(t, playing) {
    if (!built) return Promise.resolve();
    var i = sceneAt(t), tau = t - START[i];
    var want = [[S[0].v, i === 0 && tau < 3.4, tau], [S[1].v, i === 1, tau + 1.5], [S[2].v, i === 2, tau + 3.2]];
    var waits = [];
    want.forEach(function (w) {
      var v = w[0];
      if (REC || !playing) {
        if (!v.paused) v.pause();
        if (w[1] && v.readyState >= 1 && v.duration) {
          var ct = (w[2] % v.duration + v.duration) % v.duration;
          if (Math.abs(v.currentTime - ct) > 0.02) {
            waits.push(new Promise(function (res) {
              var done = false, fin = function () { if (!done) { done = true; v.removeEventListener('seeked', fin); res(); } };
              v.addEventListener('seeked', fin); setTimeout(fin, 900); v.currentTime = ct;
            }));
          }
        }
      } else if (w[1]) { if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
      else if (!v.paused) v.pause();
    });
    return Promise.all(waits);
  }
  function ready() {      /* 映像が読めたら知らせる(録画用) */
    var list = [];
    [].slice.call(canvas.querySelectorAll('video')).forEach(function (v) {
      list.push(new Promise(function (res) { if (v.readyState >= 2) res(); else { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 6000); v.load(); } }));
    });
    if (document.fonts && document.fonts.ready) list.push(document.fonts.ready);
    return Promise.all(list);
  }

  /* ---------- 動かす ---------- */
  var playing = false, userPaused = false, inView = true, raf = 0, last = 0;
  function tick(now) {
    raf = 0;
    if (!playing) return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var t = T + dt; if (t >= TOTAL) t -= TOTAL;
    draw(t);
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    on = !!on && !REC;
    if (on === playing) return;
    playing = on;
    if (on) { last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
    videos(T, on);
  }
  function refresh() {
    setPlaying(!userPaused && inView && !document.hidden);
    cls(root, 'is-paused', userPaused);
    var b = root.querySelector('.film-toggle'); if (b) b.setAttribute('aria-label', userPaused ? '動きを再生する' : '動きを止める');
  }
  function watchVideos() { if (playing) videos(T, true); setTimeout(watchVideos, 400); }

  function start() {
    build();
    root.classList.add('is-live');
    /* 最初は、手順1が出そろった所から始める(止め絵と同じ絵。切り替わる時に、がたつかないように) */
    draw(FIX != null ? parseFloat(FIX) : FIRST);
    if (FIX != null || reduce) userPaused = true;
    var api = window.__film = {
      ready: false, total: TOTAL, starts: START.slice(), settle: SETTLE.slice(), first: FIRST,
      seek: function (t) { t = ((t % TOTAL) + TOTAL) % TOTAL; draw(t); return videos(t, false).then(function () { return true; }); }
    };
    ready().then(function () {
      measure(); draw(T);                 /* 書体が読めた後で、文字の札の幅を測り直す(読める前は、代わりの書体の幅になっている) */
      api.ready = true; if (FIX != null || reduce || REC) videos(T, false);
    });
    var rz = 0, lastW = stage.clientWidth;
    window.addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(function () {
        if (stage.clientWidth === lastW) return;
        lastW = stage.clientWidth; var keep = T; build(); draw(keep); videos(T, playing);
      }, 140);
    });
    if (REC) { root.classList.add('is-rec'); document.documentElement.classList.add('film-rec'); return; }      /* 録画の時は、下に付いてくる帯(電話・お問い合わせ)を出さない(舞台に重なって写るため) */
    segs.forEach(function (b, k) {
      b.addEventListener('click', function () { draw(START[k] + (userPaused ? SETTLE[k] : 0.001)); videos(T, playing); });
    });
    var tg = root.querySelector('.film-toggle');
    if (tg) tg.addEventListener('click', function () { userPaused = !userPaused; refresh(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; refresh(); }, { threshold: 0.05 }).observe(stage);
    document.addEventListener('visibilitychange', refresh);
    refresh(); watchVideos();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
