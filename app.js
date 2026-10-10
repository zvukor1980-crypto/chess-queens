/* Шахматы Королев — интерфейс */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const C = window.Chess, A = window.CQAudio, PC = window.CQPieces;
  const LS_SET = 'cq.settings.v1', LS_SAVE = 'cq.save.v1';
  const LEVELS = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
  const THEMES = [['marble', 'Мрамор'], ['wood', 'Дерево'], ['neon', 'Неон'], ['gold', 'Золото']];
  const SIDE = ['Свет ☀', 'Тьма ☾'];
  const LETTER = ' PNBRQK';

  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } };

  const settings = Object.assign({ sound: true, hints: true, anim: true, theme: 'marble', autoFlip: false,
    last: { mode: 'ai', color: 'w', level: 'medium', timer: 0 } }, load(LS_SET) || {});
  const saveSettings = () => store(LS_SET, settings);
  A.enabled = settings.sound;

  let G = null, chess = new C();
  let selected = -1, legal = [], flipped = false, thinking = false, reqId = 0, hint = null, promoMoves = null;
  const pieceEls = new Map();
  let worker = null; const pending = new Map();
  let lastTick = performance.now(), saveTick = 0;

  const board = $('#board'), sqLayer = board.querySelector('.squares'), markLayer = board.querySelector('.marks'),
    pieceLayer = board.querySelector('.pieces'), fxLayer = board.querySelector('.fx'), arrowLayer = board.querySelector('.arrows');

  document.body.insertAdjacentHTML('afterbegin', PC.DEFS);
  const pieceSvg = p => PC.svg(LETTER[p & 7], (p >> 3) ? 'b' : 'w');

  // ---------- экраны ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'start') refreshStart();
  }
  function refreshStart() {
    const s = load(LS_SAVE);
    $('#btnContinue').classList.toggle('hidden', !(s && !s.over && Array.isArray(s.moves)));
  }
  $('#heroL').innerHTML = PC.svg('K', 'w'); $('#heroD').innerHTML = PC.svg('Q', 'b');
  $('#heroL2').innerHTML = PC.svg('N', 'w'); $('#heroD2').innerHTML = PC.svg('B', 'b');
  ['#heroL', '#heroD', '#heroL2', '#heroD2'].forEach((s, i) => $(s).style.setProperty('--d', (-i * 0.9) + 's'));

  function applySettings() {
    board.className = 'theme-' + settings.theme + (settings.anim ? ' anim' : '');
    $('.hero').classList.toggle('anim', settings.anim);
    $('#btnSound').textContent = settings.sound ? '🔊' : '🔇';
    A.enabled = settings.sound;
  }

  // ---------- геометрия ----------
  const pos = sq => { const r = sq >> 3, f = sq & 7; return flipped ? { c: 7 - f, r: 7 - r } : { c: f, r }; };
  const tr = sq => { const p = pos(sq); return `translate(${p.c * 100}%, ${p.r * 100}%)`; };
  function sqFromPoint(x, y) {
    const b = board.getBoundingClientRect();
    const c = Math.floor((x - b.left) / b.width * 8), r = Math.floor((y - b.top) / b.height * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
    return flipped ? (7 - r) * 8 + (7 - c) : r * 8 + c;
  }

  // ---------- отрисовка ----------
  function renderSquares() {
    let h = '';
    for (let sq = 0; sq < 64; sq++) {
      const p = pos(sq), light = ((sq >> 3) + (sq & 7)) % 2 === 0;
      let coords = '';
      if (p.r === 7) coords += `<span class="coord f">${'abcdefgh'[sq & 7]}</span>`;
      if (p.c === 0) coords += `<span class="coord r">${8 - (sq >> 3)}</span>`;
      h += `<div class="sq ${light ? 'l' : 'd'}" data-sq="${C.sqName(sq)}" style="left:${p.c * 12.5}%;top:${p.r * 12.5}%">${coords}</div>`;
    }
    sqLayer.innerHTML = h;
  }
  function makePiece(p, sq) {
    const el = document.createElement('div');
    el.className = 'piece noanim';
    el.dataset.p = LETTER[p & 7] + ((p >> 3) ? 'b' : 'w');
    el.style.transform = tr(sq);
    el.style.setProperty('--d', (-Math.random() * 4).toFixed(2) + 's');
    el.innerHTML = `<div class="pc-in">${pieceSvg(p)}</div>`;
    pieceLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('noanim')));
    return el;
  }
  function renderPieces() {
    pieceLayer.innerHTML = ''; pieceEls.clear();
    for (let sq = 0; sq < 64; sq++) { const p = chess.board[sq]; if (p) pieceEls.set(sq, makePiece(p, sq)); }
  }
  function renderMarks() {
    let h = '';
    const mk = (sq, cls) => { const p = pos(sq); h += `<div class="mk ${cls}" style="left:${p.c * 12.5}%;top:${p.r * 12.5}%"></div>`; };
    const last = chess.moveList[chess.moveList.length - 1];
    if (last) { mk(last.m.from, 'last'); mk(last.m.to, 'last'); }
    if (hint) { mk(hint.from, 'hint'); mk(hint.to, 'hint'); }
    if (selected >= 0) {
      mk(selected, 'sel');
      if (settings.hints) {
        const seen = new Set();
        for (const m of legal) if (m.from === selected && !seen.has(m.to)) { seen.add(m.to); mk(m.to, (m.captured ? 'cap' : 'dot')); }
      }
    }
    const inCheck = chess.inCheck();
    const ks = chess.kings[chess.turn];
    if (inCheck) mk(ks, 'check');
    markLayer.innerHTML = h;
    pieceEls.forEach((el, sq) => el.classList.toggle('incheck', inCheck && sq === ks));
    // стрелка подсказки
    if (hint) {
      const a = pos(hint.from), b = pos(hint.to);
      const x1 = a.c + .5, y1 = a.r + .5, x2 = b.c + .5, y2 = b.r + .5, ang = Math.atan2(y2 - y1, x2 - x1);
      const ex = x2 - Math.cos(ang) * .28, ey = y2 - Math.sin(ang) * .28;
      const pt = (d, o) => `${(ex + Math.cos(ang) * d + Math.cos(ang + Math.PI / 2) * o).toFixed(3)},${(ey + Math.sin(ang) * d + Math.sin(ang + Math.PI / 2) * o).toFixed(3)}`;
      arrowLayer.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}"/><polygon points="${pt(.18, 0)} ${pt(-.12, .2)} ${pt(-.12, -.2)}"/>`;
    } else arrowLayer.innerHTML = '';
  }
  function material(side) {
    const cnt = [0, 0, 0, 0, 0, 0, 0]; let val = 0; const V = [0, 1, 3, 3, 5, 9, 0];
    for (let s = 0; s < 64; s++) { const p = chess.board[s]; if (p && (p >> 3) === side) { cnt[p & 7]++; val += V[p & 7]; } }
    return { cnt, val };
  }
  function renderPanels() {
    const bottomSide = flipped ? 1 : 0;
    const mats = [material(0), material(1)], START = [0, 8, 2, 2, 2, 1, 0];
    [['#panelBottom', bottomSide], ['#panelTop', bottomSide ^ 1]].forEach(([sel, side]) => {
      const el = $(sel), opp = side ^ 1;
      el.classList.toggle('dark', side === 1);
      el.classList.toggle('active', !!G && !G.over && chess.turn === side);
      el.querySelector('.avatar').innerHTML = PC.svg('K', side ? 'b' : 'w');
      let name = SIDE[side];
      if (G && G.mode === 'ai') name = side === G.human ? 'Вы · ' + SIDE[side] : 'Компьютер · ' + LEVELS[G.level];
      el.querySelector('.pname').textContent = name;
      let tray = '';
      for (const t of [5, 4, 3, 2, 1]) {
        const miss = Math.max(0, START[t] - mats[opp].cnt[t]);
        for (let i = 0; i < miss; i++) tray += `<span class="cp">${PC.svg(LETTER[t], opp ? 'b' : 'w')}</span>`;
      }
      const adv = mats[side].val - mats[opp].val;
      if (adv > 0) tray += `<span class="adv">+${adv}</span>`;
      el.querySelector('.tray').innerHTML = tray;
      const st = el.querySelector('.pstate');
      st.className = 'pstate'; let txt = '';
      if (G && !G.over && chess.turn === side) {
        if (thinking && G.mode === 'ai' && side !== G.human) { txt = 'Думает'; st.classList.add('think'); }
        else txt = chess.inCheck() ? 'Шах!' : 'Ход';
      } else if (G && G.over) {
        if (G.over.result === 'd') txt = 'Ничья';
        else txt = (G.over.result === 'w') === (side === 0) ? 'Победа 👑' : '';
      }
      st.textContent = txt;
    });
    renderClocks();
  }
  const fmt = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function renderClocks() {
    const bottomSide = flipped ? 1 : 0;
    [['#panelBottom', bottomSide], ['#panelTop', bottomSide ^ 1]].forEach(([sel, side]) => {
      const c = $(sel).querySelector('.clock');
      if (!G || !G.timer) { c.classList.add('hidden'); return; }
      c.classList.remove('hidden');
      c.textContent = fmt(G.clocks[side]);
      const run = !G.over && chess.turn === side && G.moves.length > 0;
      c.classList.toggle('run', run && G.clocks[side] >= 20000);
      c.classList.toggle('low', run && G.clocks[side] < 20000);
    });
  }
  function renderHistory() {
    const h = $('#history');
    if (!chess.moveList.length) { h.innerHTML = '<span class="empty">Ходов пока нет — начинайте!</span>'; return; }
    let s = '';
    chess.moveList.forEach((x, i) => {
      if (i % 2 === 0) s += `<span class="num">${i / 2 + 1}.</span>`;
      s += `<span class="mv${i === chess.moveList.length - 1 ? ' cur' : ''}">${x.san}</span>`;
    });
    h.innerHTML = s; h.scrollLeft = h.scrollWidth;
  }
  function renderMode() {
    if (!G) return;
    let t = G.mode === 'ai' ? 'Против компьютера · ' + LEVELS[G.level] : 'Вдвоём на одном телефоне';
    if (G.timer) t += ' · ' + G.timer + ' мин';
    $('#modeLabel').textContent = t;
  }
  function renderAll() {
    applySettings(); renderSquares(); renderPieces(); renderMarks(); renderPanels(); renderHistory(); renderMode(); updateButtons();
  }
  function updateButtons() {
    $('#btnUndo').disabled = !G || !chess.moveList.length;
    $('#btnHint').disabled = !G || !!G.over;
  }

  // ---------- эффекты ----------
  function sparks(sq, color, n = 14) {
    const p = pos(sq), cx = (p.c + .5) * 12.5, cy = (p.r + .5) * 12.5;
    const ring = document.createElement('div'); ring.className = 'ring';
    ring.style.cssText = `left:${p.c * 12.5}%;top:${p.r * 12.5}%;--c:${color}`; fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 600);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'); s.className = 'spark';
      const a = Math.PI * 2 * i / n + Math.random() * .4, d = 22 + Math.random() * 26;
      s.style.cssText = `left:${cx}%;top:${cy}%;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--c:${i % 3 ? color : '#fff'}`;
      fxLayer.appendChild(s); setTimeout(() => s.remove(), 750);
    }
  }
  function killPiece(el) {
    if (!el) return;
    el.style.setProperty('--t', el.style.transform);
    el.classList.add('dying');
    setTimeout(() => el.remove(), 470);
  }
  function slide(el, sq) {
    if (!el) return;
    el.classList.add('moving');
    el.style.transform = tr(sq);
    const inner = el.querySelector('.pc-in');
    inner.classList.remove('hop'); void inner.offsetWidth; inner.classList.add('hop');
    setTimeout(() => { el.classList.remove('moving'); inner.classList.remove('hop'); }, 340);
  }
  function animateMove(m) {
    const mover = m.piece >> 3;
    if (m.captured) {
      const capSq = (m.flags & C.F_EP) ? (mover === 0 ? m.to + 8 : m.to - 8) : m.to;
      const victim = pieceEls.get(capSq); pieceEls.delete(capSq);
      killPiece(victim);
      setTimeout(() => sparks(capSq, (m.captured >> 3) ? '#c084fc' : '#ffd25e'), 120);
    }
    const el = pieceEls.get(m.from); pieceEls.delete(m.from);
    if (el) el.classList.remove('lift');
    slide(el, m.to); pieceEls.set(m.to, el);
    if (m.flags & (C.F_OO | C.F_OOO)) {
      const rf = (m.flags & C.F_OO) ? m.from + 3 : m.from - 4, rt = (m.flags & C.F_OO) ? m.from + 1 : m.from - 1;
      const r = pieceEls.get(rf); pieceEls.delete(rf); setTimeout(() => slide(r, rt), 90); pieceEls.set(rt, r);
    }
    if (m.promo && el) {
      setTimeout(() => {
        const np = mover * 8 + m.promo; el.dataset.p = LETTER[m.promo] + (mover ? 'b' : 'w');
        el.querySelector('.pc-in').innerHTML = pieceSvg(np);
        sparks(m.to, '#ffe08a', 18);
      }, 280);
    }
  }

  // ---------- конфетти ----------
  function confetti(winner) {
    const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const cols = winner === 'b' ? ['#c084fc', '#a855f7', '#f472b6', '#e11d48', '#fff', '#67e8f9'] : ['#ffd25e', '#f59e0b', '#fff4c2', '#fb7185', '#fff', '#fde047'];
    const parts = [];
    for (let i = 0; i < 190; i++) parts.push({
      x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .42, vx: (Math.random() - .5) * 13, vy: -Math.random() * 15 - 4,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], star: i % 7 === 0
    });
    const t0 = performance.now();
    (function frame(t) {
      const el = t - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - el / 4200); ctx.fillStyle = p.c;
        if (p.star) { ctx.font = '16px sans-serif'; ctx.fillText('✦', -6, 6); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
        ctx.restore();
      }
      if (el < 4300) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // ---------- тосты и модалки ----------
  let toastT = 0;
  function toast(msg, bad) {
    const t = $('#toast'); t.textContent = msg; t.className = bad ? 'bad' : ''; clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add('hidden'), 1800);
  }
  const modal = $('#modal'), sheet = $('#sheet');
  function openModal(html, center) {
    sheet.innerHTML = html; modal.classList.toggle('center', !!center); modal.classList.remove('hidden');
  }
  function closeModal() { modal.classList.add('hidden'); sheet.innerHTML = ''; }
  const isModalOpen = () => !modal.classList.contains('hidden');
  modal.addEventListener('click', e => { if (e.target === modal && modal.dataset.dismiss !== 'no') closeModal(); });

  function segHtml(name, opts, val) {
    return `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  function themeHtml(val) {
    return `<div class="themes">${THEMES.map(([v, l]) => `<button data-theme="${v}" class="theme-${v} ${v === val ? 'on' : ''}"><div class="swatch"><i></i><i></i><i></i><i></i></div>${l}</button>`).join('')}</div>`;
  }
  function wireSegs(onChange) {
    sheet.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      A.play('select'); onChange && onChange(seg.dataset.name, b.dataset.v);
    }));
    sheet.querySelectorAll('.themes').forEach(th => th.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      th.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      settings.theme = b.dataset.theme; saveSettings(); applySettings(); A.play('select');
    }));
  }

  function openNewGame() {
    const L = settings.last;
    modal.dataset.dismiss = '';
    openModal(`<h2>Новая партия</h2>
      <div class="field"><label>Режим</label>${segHtml('mode', [['ai', '🤖 С компьютером'], ['pvp', '👭 Вдвоём']], L.mode)}</div>
      <div class="field ai-only"><label>Играть за</label>${segHtml('color', [['w', '☀ Свет'], ['b', '☾ Тьму'], ['r', '🎲 Случайно']], L.color)}</div>
      <div class="field ai-only"><label>Сложность</label>${segHtml('level', [['easy', 'Лёгкий'], ['medium', 'Средний'], ['hard', 'Сложный']], L.level)}</div>
      <div class="field"><label>Время на партию</label>${segHtml('timer', [[0, 'Без часов'], [5, '5 мин'], [10, '10 мин']], L.timer)}</div>
      <div class="field"><label>Доска</label>${themeHtml(settings.theme)}</div>
      <div class="actions"><button class="btn primary" id="goStart">♛ Начать партию</button><button class="btn glass small" id="goCancel">Отмена</button></div>`);
    const upd = () => sheet.querySelectorAll('.ai-only').forEach(x => x.classList.toggle('hidden', L.mode !== 'ai'));
    upd();
    wireSegs((n, v) => { L[n] = n === 'timer' ? +v : v; saveSettings(); upd(); });
    $('#goStart').onclick = () => { A.unlock(); closeModal(); startGame(L); };
    $('#goCancel').onclick = closeModal;
  }
  function toggleRow(key, label) {
    return `<div class="row"><span>${label}</span><button class="toggle ${settings[key] ? 'on' : ''}" data-key="${key}" aria-label="${label}"></button></div>`;
  }
  function openSettings() {
    modal.dataset.dismiss = '';
    openModal(`<h2>Настройки</h2>
      ${toggleRow('sound', '🔊 Звук')}${toggleRow('hints', '• Показывать возможные ходы')}${toggleRow('anim', '✨ Анимация фигур')}${toggleRow('autoFlip', '⇅ Авто-поворот доски (вдвоём)')}
      <div class="field" style="margin-top:14px"><label>Тема доски</label>${themeHtml(settings.theme)}</div>
      <div class="actions"><button class="btn primary" id="setDone">Готово</button></div>`);
    sheet.querySelectorAll('.toggle').forEach(t => t.addEventListener('click', () => {
      const k = t.dataset.key; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); saveSettings(); applySettings();
      if (k === 'sound' && settings.sound) { A.unlock(); A.play('select'); }
      if (G) renderMarks();
    }));
    wireSegs();
    $('#setDone').onclick = closeModal;
  }
  function openMenu() {
    modal.dataset.dismiss = '';
    const canResign = G && !G.over && G.moves.length > 0;
    openModal(`<h2>Меню</h2><div class="menu-list">
      <button id="mResume">▶ Продолжить</button>
      <button id="mNew">♛ Новая игра</button>
      ${canResign ? '<button id="mResign" class="danger">🏳 Сдаться</button>' : ''}
      <button id="mSettings">⚙ Настройки</button>
      <button id="mHome">🏠 Главное меню</button></div>`);
    $('#mResume').onclick = closeModal;
    $('#mNew').onclick = openNewGame;
    $('#mSettings').onclick = openSettings;
    $('#mHome').onclick = () => { closeModal(); cancelEngine(); saveGame(); showScreen('start'); };
    if (canResign) $('#mResign').onclick = () => {
      openModal(`<h2>Сдаться?</h2><p class="result-sub">Партия будет засчитана как поражение.</p>
        <div class="actions"><button class="btn primary" id="rYes">🏳 Да, сдаюсь</button><button class="btn glass small" id="rNo">Играть дальше</button></div>`, true);
      $('#rYes').onclick = () => { closeModal(); const loser = G.mode === 'ai' ? G.human : chess.turn; finishGame({ over: true, result: loser ? 'w' : 'b', reason: 'resign' }); };
      $('#rNo').onclick = closeModal;
    };
  }

  // ---------- партия ----------
  function startGame(o) {
    cancelEngine();
    const human = o.color === 'r' ? (Math.random() < .5 ? 0 : 1) : (o.color === 'b' ? 1 : 0);
    G = { mode: o.mode, human, level: o.level, timer: +o.timer || 0, clocks: [o.timer * 60000, o.timer * 60000], moves: [], over: null };
    chess = new C(); selected = -1; hint = null; promoMoves = null; hidePromo();
    flipped = G.mode === 'ai' && human === 1;
    showScreen('game'); renderAll(); saveGame();
    toast(G.mode === 'ai' ? (human === 0 ? 'Вы играете за Свет ☀' : 'Вы играете за Тьму ☾') : 'Свет ходит первым ☀');
    maybeEngine();
  }
  function resumeGame(s) {
    cancelEngine();
    chess = new C();
    for (const u of s.moves) { const m = chess.findUci(u); if (!m) break; chess.play(m); }
    G = Object.assign({}, s, { moves: chess.moveList.map(x => x.uci) });
    flipped = !!s.flipped; selected = -1; hint = null;
    showScreen('game'); renderAll();
    maybeEngine();
  }
  function saveGame() { if (G) store(LS_SAVE, Object.assign({}, G, { flipped })); }

  function deselect() {
    if (selected >= 0) { const el = pieceEls.get(selected); if (el) el.classList.remove('lift'); }
    selected = -1;
  }
  function onTap(sq) {
    if (!G || G.over || thinking || promoMoves || sq < 0) return;
    if (G.mode === 'ai' && chess.turn !== G.human) return;
    A.unlock();
    const p = chess.board[sq];
    if (selected >= 0) {
      const ms = legal.filter(m => m.from === selected && m.to === sq);
      if (ms.length) { if (ms.length > 1) askPromo(ms); else commit(ms[0]); return; }
    }
    if (p && (p >> 3) === chess.turn) {
      if (selected === sq) { deselect(); renderMarks(); return; }
      deselect(); selected = sq; legal = chess.legal();
      const el = pieceEls.get(sq); if (el) el.classList.add('lift');
      if (!legal.some(m => m.from === sq)) { A.play('bad'); if (chess.inCheck()) toast('Шах! Защитите королеву', true); }
      else A.play('select');
      renderMarks(); return;
    }
    if (selected >= 0) { deselect(); renderMarks(); }
  }
  sqLayer.addEventListener('click', e => onTap(sqFromPoint(e.clientX, e.clientY)));

  function askPromo(ms) {
    promoMoves = ms;
    const col = (ms[0].piece >> 3) ? 'b' : 'w';
    const names = { 5: 'Ферзь', 4: 'Ладья', 3: 'Слон', 2: 'Конь' };
    $('#promo .promo-opts').innerHTML = [5, 4, 3, 2].map(t => `<button data-t="${t}">${PC.svg(LETTER[t], col)}<span>${names[t]}</span></button>`).join('');
    $('#promo').classList.remove('hidden');
    A.play('select');
  }
  function hidePromo() { $('#promo').classList.add('hidden'); }
  $('#promo').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (b && promoMoves) { const m = promoMoves.find(x => x.promo === +b.dataset.t); promoMoves = null; hidePromo(); commit(m); }
    else if (e.target.id === 'promo') { promoMoves = null; hidePromo(); deselect(); renderMarks(); }
  });

  function commit(m) {
    hint = null; deselect(); legal = [];
    chess.play(m); G.moves.push(chess.uci(m));
    animateMove(m);
    const st = chess.status();
    if (!st.over || st.reason !== 'mate') {
      if (m.promo) A.play('promote'); else if (m.flags & (C.F_OO | C.F_OOO)) A.play('castle'); else A.play(m.captured ? 'capture' : 'move');
      if (st.check) setTimeout(() => A.play('check'), 140);
    } else A.play(m.captured ? 'capture' : 'move');
    renderMarks(); renderPanels(); renderHistory(); updateButtons();
    if (st.over) finishGame(st);
    else {
      saveGame();
      if (G.mode === 'pvp' && settings.autoFlip) setTimeout(() => { flipped = chess.turn === 1; renderAll(); }, 420);
      maybeEngine();
    }
  }

  const REASONS = { mate: 'Мат', stalemate: 'Пат — ходить некуда', material: 'Недостаточно материала для мата', fifty: 'Правило 50 ходов',
    repetition: 'Троекратное повторение позиции', time: 'Время вышло', resign: 'Соперник сдался', timeDraw: 'Время вышло, но мат поставить нечем' };
  function finishGame(st) {
    G.over = { result: st.result, reason: st.reason };
    thinking = false; deselect(); saveGame();
    renderMarks(); renderPanels(); updateButtons();
    const humanWon = G.mode === 'ai' && st.result !== 'd' && ((st.result === 'w') === (G.human === 0));
    const humanLost = G.mode === 'ai' && st.result !== 'd' && !humanWon;
    if (st.reason === 'mate') { confetti(st.result); setTimeout(() => A.play(humanLost ? 'lose' : 'win'), 250); }
    else if (st.result === 'd') A.play('draw'); else A.play(humanLost ? 'lose' : 'win');
    let icon, title, sub = REASONS[st.reason];
    if (st.result === 'd') { icon = '🤝'; title = st.reason === 'stalemate' ? 'Пат! Ничья' : 'Ничья'; }
    else {
      const wName = st.result === 'w' ? 'Света ☀' : 'Тьмы ☾';
      icon = st.reason === 'mate' ? '👑' : (st.reason === 'time' ? '⏰' : '🏳');
      title = st.reason === 'mate' ? 'Мат! ' : '';
      if (G.mode === 'ai') title += humanWon ? 'Вы победили!' : 'Победил компьютер';
      else title += 'Победа ' + wName;
      if (st.reason === 'resign') sub = G.mode === 'ai' && humanLost ? 'Вы сдались' : (G.mode === 'ai' ? 'Компьютер сдался' : 'Сдались ' + (st.result === 'w' ? 'Тьма' : 'Свет'));
      if (G.mode === 'ai' && humanLost && st.reason === 'mate') icon = '☾';
    }
    const wc = st.result === 'b' ? 'b' : 'w';
    const pcs = st.result === 'd' ? PC.svg('K', 'w') + '</div><div>' + PC.svg('K', 'b') : PC.svg('K', wc) + '</div><div>' + PC.svg('Q', wc);
    setTimeout(() => {
      modal.dataset.dismiss = '';
      openModal(`<div class="result-icon">${icon}</div><h2 id="resultTitle">${title}</h2><p class="result-sub">${sub}</p>
        <div class="result-pieces anim"><div>${pcs}</div></div>
        <div class="actions"><button class="btn gold" id="resAgain">⟳ Реванш</button><button class="btn primary" id="resNew">♛ Новая игра</button><button class="btn glass small" id="resView">Посмотреть доску</button></div>`, true);
      $('#resAgain').onclick = () => { closeModal(); startGame({ mode: G.mode, color: G.mode === 'ai' ? (G.human ? 'w' : 'b') : 'w', level: G.level, timer: G.timer }); };
      $('#resNew').onclick = openNewGame;
      $('#resView').onclick = closeModal;
    }, st.reason === 'mate' ? 1100 : 500);
  }

  // ---------- движок ----------
  function getWorker() {
    if (worker) return worker;
    try {
      worker = new Worker('engine-worker.js');
      worker.onmessage = e => { const cb = pending.get(e.data.id); if (cb) { pending.delete(e.data.id); cb(e.data); } };
      worker.onerror = ev => { ev.preventDefault && ev.preventDefault(); const w = worker; worker = null; try { w.terminate(); } catch (x) { }
        pending.forEach(cb => cb({ ok: false })); pending.clear(); };
    } catch (e) { worker = null; }
    return worker;
  }
  function runEngine(id, moves, level) {
    return new Promise(res => {
      const local = () => setTimeout(() => res(window.CQEngine.bestMove(moves, level)), 20);
      const w = getWorker();
      if (!w) return local();
      pending.set(id, d => d.ok ? res(d.result) : local());
      w.postMessage({ id, moves, level });
    });
  }
  function cancelEngine() {
    reqId++;
    if (thinking && worker) { worker.terminate(); worker = null; pending.clear(); }
    thinking = false;
  }
  function maybeEngine() {
    if (!G || G.mode !== 'ai' || G.over || chess.turn === G.human) { updateButtons(); return; }
    const id = ++reqId, moves = G.moves.slice(), t0 = performance.now();
    thinking = true; renderPanels();
    runEngine(id, moves, G.level).then(r => {
      if (id !== reqId || !G || G.over) return;
      const wait = Math.max(0, 420 - (performance.now() - t0));
      setTimeout(() => {
        if (id !== reqId) return;
        thinking = false;
        G.lastThinkMs = Math.round(performance.now() - t0);
        const m = r && chess.findUci(r.uci);
        if (m) commit(m); else renderPanels();
      }, wait);
    });
  }
  function askHint() {
    if (!G || G.over || thinking) return;
    if (G.mode === 'ai' && chess.turn !== G.human) return;
    const id = ++reqId, moves = G.moves.slice();
    toast('Королева размышляет… 💭');
    $('#btnHint').disabled = true;
    runEngine(id, moves, 'hint').then(r => {
      updateButtons();
      if (id !== reqId || G.moves.length !== moves.length || !r) return;
      const m = chess.findUci(r.uci); if (!m) return;
      hint = m; deselect(); renderMarks();
      toast('Подсказка: ' + chess.san(m)); A.play('select');
    });
  }
  function undo() {
    if (!G || !chess.moveList.length) return;
    if (G.mode === 'ai') {
      const humanMoves = G.human === 0 ? Math.ceil(G.moves.length / 2) : Math.floor(G.moves.length / 2);
      if (!humanMoves) { toast('Нечего отменять'); return; }
    }
    cancelEngine(); promoMoves = null; hidePromo();
    chess.undo();
    if (G.mode === 'ai') while (chess.turn !== G.human && chess.moveList.length) chess.undo();
    G.moves = chess.moveList.map(x => x.uci);
    G.over = null; hint = null; selected = -1;
    if (G.mode === 'pvp' && settings.autoFlip) flipped = chess.turn === 1;
    renderAll(); saveGame(); A.play('move');
    maybeEngine();
  }

  // ---------- часы ----------
  setInterval(() => {
    const now = performance.now(), dt = now - lastTick; lastTick = now;
    if (!G || G.over || !G.timer || !G.moves.length || document.hidden || isModalOpen() || !$('#game').classList.contains('active')) return;
    const side = chess.turn;
    G.clocks[side] -= dt;
    if (G.clocks[side] <= 0) {
      G.clocks[side] = 0; cancelEngine(); renderClocks();
      const winner = side ^ 1;
      finishGame(chess.canMate(winner) ? { over: true, result: winner ? 'b' : 'w', reason: 'time' } : { over: true, result: 'd', reason: 'timeDraw' });
      return;
    }
    renderClocks();
    if ((saveTick += dt) > 2000) { saveTick = 0; saveGame(); }
  }, 200);

  // ---------- кнопки ----------
  $('#btnNew').onclick = () => { A.unlock(); openNewGame(); };
  $('#btnContinue').onclick = () => { A.unlock(); const s = load(LS_SAVE); if (s) resumeGame(s); };
  $('#btnSettingsStart').onclick = openSettings;
  $('#btnMenu').onclick = openMenu;
  $('#btnSettings').onclick = openSettings;
  $('#btnSound').onclick = () => { settings.sound = !settings.sound; saveSettings(); applySettings(); if (settings.sound) { A.unlock(); A.play('select'); } toast(settings.sound ? 'Звук включён 🔊' : 'Звук выключен 🔇'); };
  $('#btnUndo').onclick = undo;
  $('#btnHint').onclick = askHint;
  $('#btnFlip').onclick = () => { flipped = !flipped; renderAll(); saveGame(); A.play('select'); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 320) e.preventDefault(); lastTouch = n; }, { passive: false });

  applySettings(); refreshStart();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(() => { });

  // хук для автотестов
  window.__cq = {
    get chess() { return chess; }, get G() { return G; }, get thinking() { return thinking; }, get flipped() { return flipped; },
    tap: name => onTap(C.sqIdx(name)), at: name => { const p = chess.board[C.sqIdx(name)]; return p ? LETTER[p & 7] + ((p >> 3) ? 'b' : 'w') : ''; },
    startGame, settings
  };
})();
