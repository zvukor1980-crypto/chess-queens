/* Шахматы Королев — интерфейс */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const C = window.Chess, A = window.CQAudio, PC = window.CQPieces;
  const LS_SET = 'cq.settings.v1', LS_SAVE = 'cq.save.v1';
  const LEVELS = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
  const THEMES = [['fairy', 'Сказка'], ['candy', 'Карамель'], ['marble', 'Мрамор'], ['wood', 'Дерево'], ['neon', 'Неон'], ['gold', 'Золото']];
  const SIDE = ['Свет ☀', 'Тьма ☾'];
  const LETTER = ' PNBRQK';

  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } };

  const settings = Object.assign({ sound: true, hints: true, anim: true, theme: 'fairy', autoFlip: false, pieces: 'hero',
    last: { mode: 'ai', color: 'w', level: 'medium', timer: 0 } }, load(LS_SET) || {});
  // v2: один раз включаем новое сказочное оформление (его можно вернуть в настройках)
  if (!settings.v2) { settings.v2 = 1; settings.theme = 'fairy'; settings.pieces = 'hero'; }
  if (!['hero', 'classic'].includes(settings.pieces)) settings.pieces = 'hero';
  PC.style = settings.pieces;
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
  if (!['fairy', 'candy', 'marble', 'wood', 'neon', 'gold'].includes(settings.theme)) settings.theme = 'fairy';
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
    const mats = [material(0), material(1)], START0 = [0, 8, 2, 2, 2, 1, 0];
    const startOf = side => { if (!G || !G.fen) return START0; const k = side ? 'pnbrqk' : 'PNBRQK', c = [0, 0, 0, 0, 0, 0, 0]; for (const ch of G.fen.split(' ')[0]) { const i = k.indexOf(ch); if (i >= 0) c[i + 1]++; } return c; };
    [['#panelBottom', bottomSide], ['#panelTop', bottomSide ^ 1]].forEach(([sel, side]) => {
      const el = $(sel), opp = side ^ 1;
      el.classList.toggle('dark', side === 1);
      el.classList.toggle('active', !!G && !G.over && chess.turn === side);
      el.querySelector('.avatar').innerHTML = PC.svg('K', side ? 'b' : 'w');
      let name = SIDE[side];
      if (G && G.mode === 'ai') name = side === G.human ? 'Вы · ' + SIDE[side] : 'Компьютер · ' + LEVELS[G.level];
      if (G && G.mode === 'puzzle') name = side === G.human ? 'Вы · ' + SIDE[side] : SIDE[side];
      el.querySelector('.pname').textContent = name;
      let tray = '';
      for (const t of [5, 4, 3, 2, 1]) {
        const miss = Math.max(0, startOf(opp)[t] - mats[opp].cnt[t]);
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
    let t = G.quest != null && QUESTS[G.quest] ? '🏰 Поход · этап ' + (G.quest + 1) + ': ' + QUESTS[G.quest].n : G.mode === 'puzzle' ? '🧩 Задача дня · мат в 1 ход' : G.mode === 'ai' ? 'Против компьютера · ' + LEVELS[G.level] : 'Вдвоём на одном телефоне';
    if (G.timer) t += ' · ' + G.timer + ' мин';
    $('#modeLabel').textContent = t;
  }
  function renderAll() {
    applySettings(); renderSquares(); renderPieces(); renderMarks(); renderPanels(); renderHistory(); renderMode(); updateButtons();
  }
  function updateButtons() {
    $('#btnUndo').disabled = !G || !chess.moveList.length || G.mode === 'puzzle';
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
      <div class="field" style="margin-top:14px"><label>Фигуры</label>${segHtml('pieces', [['hero', '👸 Героини'], ['classic', '♞ Классика']], settings.pieces)}</div>
      <div class="field"><label>Тема доски</label>${themeHtml(settings.theme)}</div>
      <div class="actions"><button class="btn primary" id="setDone">Готово</button></div>`);
    sheet.querySelectorAll('.toggle').forEach(t => t.addEventListener('click', () => {
      const k = t.dataset.key; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); saveSettings(); applySettings();
      if (k === 'sound' && settings.sound) { A.unlock(); A.play('select'); }
      if (G) renderMarks();
    }));
    wireSegs((n, v) => { if (n === 'pieces') { settings.pieces = v; PC.style = v; saveSettings(); renderHeroes(); if (G) { renderPieces(); renderPanels(); } } });
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
    if (o.fen) { G.fen = o.fen; G.quest = o.quest; G.help = 0; }
    chess = new C(); if (o.fen) chess.load(o.fen); selected = -1; hint = null; promoMoves = null; hidePromo();
    flipped = G.mode === 'ai' && human === 1;
    showScreen('game'); renderAll(); saveGame();
    toast(G.mode === 'ai' ? (human === 0 ? 'Вы играете за Свет ☀' : 'Вы играете за Тьму ☾') : 'Свет ходит первым ☀');
    maybeEngine();
  }
  function resumeGame(s) {
    cancelEngine();
    chess = new C(); if (s.fen) chess.load(s.fen);
    for (const u of s.moves) { const m = chess.findUci(u); if (!m) break; chess.play(m); }
    G = Object.assign({}, s, { moves: chess.moveList.map(x => x.uci) });
    flipped = !!s.flipped; selected = -1; hint = null;
    showScreen('game'); renderAll();
    maybeEngine();
  }
  function saveGame() { if (G && G.mode !== 'puzzle') store(LS_SAVE, Object.assign({}, G, { flipped })); }

  function deselect() {
    if (selected >= 0) { const el = pieceEls.get(selected); if (el) el.classList.remove('lift'); }
    selected = -1;
  }
  function onTap(sq) {
    if (!G || G.over || thinking || promoMoves || sq < 0) return;
    if ((G.mode === 'ai' || G.mode === 'puzzle') && chess.turn !== G.human) return;
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
    if (settings.anim) setTimeout(() => sparks(m.to, (m.piece >> 3) ? '#d8b4fe' : '#fff1a8', 6), 280);
    if (G.mode === 'puzzle') { puzzleAfterMove(st); return; }
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
    thinking = false; deselect(); saveGame(); const rec = recordResult(st);
    const humanWon0 = G.mode === 'ai' && st.result !== 'd' && ((st.result === 'w') === (G.human === 0)); const qr = questFinish(st, humanWon0);
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
      const qx = qr && qr.won ? `<div class="v3stars">${[0, 1, 2].map(k => `<i class="${k < qr.s ? 'on' : ''}" style="animation-delay:${.3 + k * .25}s">★</i>`).join('')}</div><p class="result-sub">Этап «${QUESTS[G.quest].n}» пройден за ${qr.myMoves} ход. (цель ${qr.par})${G.help ? ' · с подсказками' : ''}</p>` : qr ? '<p class="result-sub">Этап не пройден — попробуй ещё раз!</p>' : '';
      const extra = qx + (rec === 'w' ? `<p class="result-sub v2win">👑 +1 корона · 🔥 серия побед: <b>${stats.streak}</b></p>` : rec === 'l' ? '<p class="result-sub">Серия прервана — реванш?</p>' : '');
      if (rec === 'w') royalBurst();
      openModal(`<div class="result-icon">${icon}</div><h2 id="resultTitle">${title}</h2><p class="result-sub">${sub}</p>${extra}
        <div class="result-pieces anim"><div>${pcs}</div></div>
        <div class="actions">${qr && qr.won && qr.next != null ? '<button class="btn gold" id="resNext">🏰 Следующий этап</button>' : ''}${qr ? '<button class="btn glass small" id="resMap">🗺 Карта похода</button>' : ''}<button class="btn gold" id="resAgain">⟳ Реванш</button><button class="btn primary" id="resNew">♛ Новая игра</button><button class="btn glass small" id="resView">Посмотреть доску</button></div>`, true);
      const rn = $('#resNext'); if (rn) rn.onclick = () => startQuest(qr.next); const rm = $('#resMap'); if (rm) rm.onclick = openQuest;
      const qi = G.quest; if (qi != null) { $('#resAgain').onclick = () => startQuest(qi); } else $('#resAgain').onclick = () => { closeModal(); startGame({ mode: G.mode, color: G.mode === 'ai' ? (G.human ? 'w' : 'b') : 'w', level: G.level, timer: G.timer }); };
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
  function runEngine(id, moves, level, fen) {
    return new Promise(res => {
      const local = () => setTimeout(() => res(window.CQEngine.bestMove(moves, level, fen)), 20);
      const w = getWorker();
      if (!w) return local();
      pending.set(id, d => d.ok ? res(d.result) : local());
      w.postMessage({ id, moves, level, fen });
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
    runEngine(id, moves, G.level, G.fen).then(r => {
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
    if (G.mode === 'puzzle') { G.tries++; puzzleHint(); return; }
    if (G.mode === 'ai' && chess.turn !== G.human) return;
    const id = ++reqId, moves = G.moves.slice(); if (G.quest != null) G.help = (G.help || 0) + 1;
    toast('Королева размышляет… 💭');
    $('#btnHint').disabled = true;
    runEngine(id, moves, 'hint', G.fen).then(r => {
      updateButtons();
      if (id !== reqId || G.moves.length !== moves.length || !r) return;
      const m = chess.findUci(r.uci); if (!m) return;
      hint = m; deselect(); renderMarks();
      toast('Подсказка: ' + chess.san(m)); A.play('select');
    });
  }
  function undo() {
    if (!G || !chess.moveList.length) return;
    if (G.mode === 'puzzle') return;
    if (G.mode === 'ai') {
      const humanMoves = G.human === 0 ? Math.ceil(G.moves.length / 2) : Math.floor(G.moves.length / 2);
      if (!humanMoves) { toast('Нечего отменять'); return; }
    }
    cancelEngine(); promoMoves = null; hidePromo(); if (G.quest != null) G.help = (G.help || 0) + 1;
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


  // ================= v3: «Королевский поход» — 10 сказочных этапов, звёзды, новая сцена =================
  const LS_QUEST = 'cq.quest.v1';
  const STD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const QUESTS = [
    { n: 'Урок принцессы', d: 'У Тьмы лишь король и четыре пешки. Поставь первый мат!', fen: '4k3/pppp4/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1', lv: 'easy', par: 20, em: '🌸' },
    { n: 'Мост лучниц', d: 'Тёмный король прячется за ладьёй и пешками.', fen: 'r3k3/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQq - 0 1', lv: 'easy', par: 28, em: '🏹' },
    { n: 'Лесная засада', d: 'Тьма потеряла королеву в лесу — воспользуйся!', fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lv: 'easy', par: 32, em: '🌲' },
    { n: 'Две башни', d: 'У Тьмы нет ладей, но соперник стал умнее.', fen: '1nbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1', lv: 'medium', par: 36, em: '🗼' },
    { n: 'Тень над замком', d: 'Без королевы, но с хитрым стратегом.', fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lv: 'medium', par: 40, em: '🏰' },
    { n: 'Ночная охота', d: 'У Тьмы не хватает коня и слона.', fen: 'r1bqk1nr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lv: 'medium', par: 40, em: '🦉' },
    { n: 'Равный бой', d: 'Силы равны. Покажи, чему научилась!', fen: STD, lv: 'medium', par: 45, em: '⚖️' },
    { n: 'Лунная крепость', d: 'Твой конь ушёл в разведку — играй без него.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1', lv: 'medium', par: 50, em: '🌙' },
    { n: 'Тёмная королева', d: 'Мастер Тьмы без королевы — но очень силён.', fen: 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lv: 'hard', par: 50, em: '🔮' },
    { n: 'Трон Света', d: 'Финальная битва с сильнейшим соперником.', fen: STD, lv: 'hard', par: 60, em: '👑' },
  ];
  const quest = (() => { const q = load(LS_QUEST); return q && typeof q === 'object' && q.stars ? q : { stars: {} }; })();
  const saveQuest = () => store(LS_QUEST, quest);
  const qStars = () => Object.values(quest.stars).reduce((a, b) => a + (+b || 0), 0);
  const qOpen = i => i === 0 || (quest.stars[i - 1] || 0) > 0;
  const qNext = () => { for (let i = 0; i < QUESTS.length; i++) if (!(quest.stars[i] > 0)) return i; return QUESTS.length - 1; };
  function startQuest(i) { const Q = QUESTS[i]; closeModal(); startGame({ mode: 'ai', color: 'w', level: Q.lv, timer: 0, fen: Q.fen, quest: i }); toast(Q.em + ' Этап ' + (i + 1) + ': ' + Q.n); }
  function openQuest() {
    modal.dataset.dismiss = '';
    const rows = QUESTS.map((Q, i) => { const s = quest.stars[i] || 0, op = qOpen(i); return `<button class="v3q ${op ? '' : 'lock'} ${i === qNext() ? 'cur' : ''}" data-q="${i}"><i>${op ? Q.em : '🔒'}</i><span><b>${i + 1}. ${Q.n}</b><small>${op ? Q.d : 'Пройди предыдущий этап'}</small></span><em>${'★'.repeat(s)}<u>${'★'.repeat(3 - s)}</u></em></button>`; }).join('');
    openModal(`<h2>Королевский поход</h2><p class="result-sub">Проведи Свет через 10 сказочных битв · звёзды: <b>${qStars()} / 30</b></p><p class="v3rules">★ победа · ★ быстрая победа · ★ без отмен и подсказок</p><div class="v3qlist">${rows}</div><div class="actions"><button class="btn glass small" id="qClose">Закрыть</button></div>`, true);
    $('#qClose').onclick = closeModal;
    document.querySelectorAll('.v3q').forEach(b => b.onclick = () => { const i = +b.dataset.q; if (!qOpen(i)) { toast('Сначала пройди этап ' + i, true); A.play('bad'); return; } startQuest(i); });
    const cur = document.querySelector('.v3q.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function questFinish(st, won) {
    if (G.quest == null || G.qDone) return null; G.qDone = true; if (!won) return { won: false };
    const Q = QUESTS[G.quest], myMoves = Math.ceil(G.moves.length / 2);
    const s = 1 + (myMoves <= Q.par ? 1 : 0) + (!G.help ? 1 : 0), old = quest.stars[G.quest] || 0;
    quest.stars[G.quest] = Math.max(old, s); saveQuest(); refreshQuestBtn();
    return { won: true, s, myMoves, par: Q.par, next: G.quest + 1 < QUESTS.length ? G.quest + 1 : null };
  }
  function refreshQuestBtn() { const b = $('#btnQuest'); if (b) b.querySelector('small').textContent = 'Этап ' + (qNext() + 1) + ' из 10 · ★ ' + qStars() + '/30'; }
  // --- сцена титула: сияющая шахматная площадь в перспективе ---
  function v3Floor() {
    const hero = document.querySelector('.hero'); if (!hero) return; let cv = $('#v3floor'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'v3floor'; hero.insertBefore(cv, hero.firstChild); }
    const w = hero.clientWidth, h = hero.clientHeight; if (!w || !h) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d * 0.75);
    const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); const H = h * 0.75, y0 = H * 0.2, cx = w / 2, N = 8;
    const P = (u, v) => { const z = 1 + v * 2.2; return [cx + (u - 0.5) * w * 1.25 / z * 1.6, H - (H - y0) * (1 - 1 / z) * 1.45]; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = P(i / N, j / N), b = P((i + 1) / N, j / N), e = P((i + 1) / N, (j + 1) / N), f = P(i / N, (j + 1) / N); const dark = (i + j) % 2; const g = c.createLinearGradient(0, f[1], 0, a[1]); g.addColorStop(0, dark ? 'rgba(150,90,230,.55)' : 'rgba(255,240,200,.65)'); g.addColorStop(1, dark ? 'rgba(110,60,200,.9)' : 'rgba(255,250,235,.95)'); c.fillStyle = g; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(f[0], f[1]); c.closePath(); c.fill(); }
    // золотая кайма
    const l0 = P(0, 0), r0 = P(1, 0), r1 = P(1, 1), l1 = P(0, 1); c.strokeStyle = '#ffd25e'; c.lineWidth = 3; c.shadowColor = '#ffd25e'; c.shadowBlur = 12; c.beginPath(); c.moveTo(l0[0], l0[1]); c.lineTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.lineTo(l1[0], l1[1]); c.closePath(); c.stroke(); c.shadowBlur = 0;
    // туман вдали
    const fg = c.createLinearGradient(0, l1[1] - 4, 0, l1[1] + H * 0.35); fg.addColorStop(0, 'rgba(255,230,255,.9)'); fg.addColorStop(1, 'rgba(255,230,255,0)'); c.fillStyle = fg; c.fillRect(0, l1[1] - 6, w, H * 0.35);
  }

  // ================= v2: сказочный режим =================
  const LS_STATS = 'cq.stats.v1';
  const PUZZLES = ["6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1","1k6/ppp5/8/8/8/8/8/1K5R w - - 0 1","6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1","kr6/pp6/8/1N6/8/8/8/1K6 w - - 0 1","r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1","rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1","k7/7R/8/8/8/8/8/6RK w - - 0 1","7k/R7/8/8/8/8/8/KR6 w - - 0 1","r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1","1k5r/8/8/8/8/8/PPP5/1K6 b - - 0 1","7k/8/5N2/8/8/8/7R/6K1 w - - 0 1","k7/8/2N5/8/8/8/R7/1K6 w - - 0 1","7k/8/6K1/8/8/8/8/Q7 w - - 0 1","k7/8/1K6/8/8/8/8/7Q w - - 0 1","4k3/R7/4K3/8/8/8/8/8 w - - 0 1","3k4/7R/3K4/8/8/8/8/8 w - - 0 1","8/8/8/8/8/5k2/4q3/6K1 b - - 0 1","8/8/8/8/8/2k5/3q4/1K6 b - - 0 1"];
  const stats = (() => {
    const d = { games: 0, w: { easy: 0, medium: 0, hard: 0 }, l: { easy: 0, medium: 0, hard: 0 }, d: 0, streak: 0, best: 0, pz: { last: '', streak: 0, solved: 0, best: 0, lastDone: '' } };
    const s = load(LS_STATS) || {};
    const o = Object.assign({}, d, s); o.w = Object.assign({}, d.w, s.w); o.l = Object.assign({}, d.l, s.l); o.pz = Object.assign({}, d.pz, s.pz);
    return o;
  })();
  const saveStats = () => store(LS_STATS, stats);
  const today = (dt = new Date()) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  function dayIndex() { const t = today(); let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % PUZZLES.length; }
  function recordResult(st) {
    if (!G || G.mode !== 'ai' || G.recorded) return null;
    G.recorded = true; stats.games++;
    let out = 'd';
    if (st.result === 'd') { stats.d++; }
    else if ((st.result === 'w') === (G.human === 0)) { stats.w[G.level]++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); out = 'w'; }
    else { stats.l[G.level]++; stats.streak = 0; out = 'l'; }
    saveStats(); refreshHall(); return out;
  }
  function refreshHall() {
    const el = $('#v2hall'); if (!el) return;
    const crowns = stats.w.easy + stats.w.medium + stats.w.hard;
    el.innerHTML = `<span>👑 ${crowns}</span><span>🔥 ${stats.streak}</span><span>🧩 ${stats.pz.solved}</span>`;
    const pb = $('#btnPuzzle'); if (pb) pb.classList.toggle('ready', stats.pz.lastDone !== today());
  }
  function openHall() {
    modal.dataset.dismiss = '';
    const row = (k, n) => `<div class="v2lv"><b>${n}</b><span class="v2cr">👑 ${stats.w[k]}</span><small>поражений: ${stats.l[k]}</small></div>`;
    openModal(`<h2>Зал славы</h2><div class="v2crown">♛</div>
      <div class="v2grid">${row('easy', 'Лёгкий')}${row('medium', 'Средний')}${row('hard', 'Сложный')}</div>
      <div class="v2grid two"><div class="v2lv"><b>Серия побед</b><span class="v2cr">🔥 ${stats.streak}</span><small>рекорд: ${stats.best}</small></div>
      <div class="v2lv"><b>Задачи дня</b><span class="v2cr">🧩 ${stats.pz.solved}</span><small>серия: ${stats.pz.streak} · рекорд: ${stats.pz.best}</small></div></div>
      <p class="result-sub">Всего партий с компьютером: ${stats.games} · ничьих: ${stats.d}</p>
      <div class="actions"><button class="btn primary" id="hallOk">Закрыть</button></div>`, true);
    $('#hallOk').onclick = closeModal;
  }
  function mateMoves() { const r = []; for (const m of chess.legal()) { chess.make(m); const s = chess.status(); chess.unmake(m); if (s.over && s.reason === 'mate') r.push(m); } return r; }
  function startPuzzle() {
    cancelEngine();
    const idx = dayIndex(), fen = PUZZLES[idx];
    chess = new C(); chess.load(fen);
    G = { mode: 'puzzle', human: chess.turn, level: 'easy', timer: 0, clocks: [0, 0], moves: [], over: null, fen, pidx: idx, tries: 0 };
    selected = -1; hint = null; promoMoves = null; hidePromo();
    flipped = chess.turn === 1;
    showScreen('game'); renderAll();
    toast(`Задача дня: ${chess.turn ? 'Тьма' : 'Свет'} ставит мат в 1 ход`);
  }
  function puzzleAfterMove(st) {
    if (st.over && st.reason === 'mate') {
      G.over = { result: chess.turn ? 'w' : 'b', reason: 'mate' };
      const first = stats.pz.lastDone !== today();
      if (first) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        stats.pz.streak = stats.pz.lastDone === today(y) ? stats.pz.streak + 1 : 1;
        stats.pz.best = Math.max(stats.pz.best, stats.pz.streak); stats.pz.solved++; stats.pz.lastDone = today(); saveStats(); refreshHall();
      }
      renderMarks(); renderPanels(); updateButtons();
      confetti(G.over.result); A.play('win'); royalBurst();
      setTimeout(() => {
        modal.dataset.dismiss = '';
        openModal(`<div class="result-icon">🧩</div><h2>Задача решена!</h2><p class="result-sub">${G.tries ? 'Попыток: ' + (G.tries + 1) : 'С первой попытки — великолепно!'}</p>
          <p class="result-sub">🔥 Серия задач: <b>${stats.pz.streak}</b> · всего решено: <b>${stats.pz.solved}</b></p>
          <p class="result-sub">Новая задача появится завтра.</p>
          <div class="actions"><button class="btn primary" id="pzNew">♛ Сыграть партию</button><button class="btn glass small" id="pzHome">🏠 Главное меню</button></div>`, true);
        $('#pzNew').onclick = openNewGame; $('#pzHome').onclick = () => { closeModal(); G = null; showScreen('start'); };
      }, 1100);
      return;
    }
    G.tries++;
    toast('Это ещё не мат — попробуйте другой ход', true); A.play('bad');
    thinking = true;
    setTimeout(() => { thinking = false; chess.undo(); G.moves.pop(); renderAll(); }, 750);
  }
  function puzzleHint() {
    const ms = mateMoves(); if (!ms.length) return;
    hint = ms[0]; deselect(); renderMarks(); toast('Подсказка: ' + chess.san(hint)); A.play('select');
  }
  // королевский салют — золотые искры по всей доске
  function royalBurst() {
    for (let i = 0; i < 6; i++) setTimeout(() => sparks((Math.random() * 64) | 0, i % 2 ? '#ff7eb6' : '#ffd25e', 16), i * 140);
  }
  // ---------- живой сказочный фон ----------
  const FX = { cv: null, c: null, t: 0, last: 0, clouds: [], spk: [], w: 0, h: 0 };
  function fxInit() {
    FX.cv = document.createElement('canvas'); FX.cv.id = 'v2fx'; $('#bg').appendChild(FX.cv);
    const rs = () => { const d = Math.min(1.5, devicePixelRatio || 1); FX.w = innerWidth; FX.h = innerHeight; FX.cv.width = FX.w * d; FX.cv.height = FX.h * d; FX.c = FX.cv.getContext('2d'); FX.c.setTransform(d, 0, 0, d, 0, 0); };
    rs(); addEventListener('resize', rs);
    FX.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: .06 + i * .1 + Math.random() * .05, s: .6 + Math.random() * .7, v: .004 + Math.random() * .006 }));
    FX.spk = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.2, p: Math.random() * 6.3, v: .8 + Math.random() * 1.6 }));
    requestAnimationFrame(fxFrame);
  }
  function cloud(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.arc(0, 0, 22, 0, 6.3); c.arc(26, -10, 28, 0, 6.3); c.arc(56, 0, 22, 0, 6.3); c.arc(28, 8, 24, 0, 6.3); c.fill(); c.restore();
  }
  function castle(c, x, base, s, col, flip) {
    c.save(); c.translate(x, base); c.scale(flip ? -s : s, s); c.fillStyle = col;
    c.fillRect(-40, -60, 80, 60); c.fillRect(-60, -95, 26, 95); c.fillRect(34, -95, 26, 95); c.fillRect(-14, -130, 28, 70);
    c.beginPath(); c.moveTo(-64, -95); c.lineTo(-47, -130); c.lineTo(-30, -95); c.moveTo(30, -95); c.lineTo(47, -130); c.lineTo(64, -95); c.moveTo(-18, -130); c.lineTo(0, -168); c.lineTo(18, -130); c.fill();
    c.fillStyle = 'rgba(255,240,170,.85)'; for (const [wx, wy] of [[-50, -78], [44, -78], [-5, -110], [-10, -40], [6, -40]]) c.fillRect(wx, wy, 7, 11);
    c.restore();
  }
  function fxFrame(now) {
    requestAnimationFrame(fxFrame);
    if (document.hidden || !settings.anim || now - FX.last < 40) return;
    const dt = Math.min(.1, (now - FX.last) / 1000 || .04); FX.last = now; FX.t += dt;
    const c = FX.c, W = FX.w, H = FX.h, t = FX.t; c.clearRect(0, 0, W, H);
    // солнце и луна
    const sx = W * .16, sy = H * .1 + Math.sin(t * .3) * 4;
    let g = c.createRadialGradient(sx, sy, 0, sx, sy, 110); g.addColorStop(0, 'rgba(255,248,200,.95)'); g.addColorStop(.25, 'rgba(255,214,110,.75)'); g.addColorStop(1, 'rgba(255,214,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 110, 0, 6.3); c.fill();
    c.save(); c.translate(sx, sy); c.rotate(t * .08); c.fillStyle = 'rgba(255,240,170,.18)';
    for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(160, -10); c.lineTo(160, 10); c.fill(); }
    c.restore();
    const mx = W * .86, my = H * .16; g = c.createRadialGradient(mx, my, 0, mx, my, 70); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.3, 'rgba(220,200,255,.55)'); g.addColorStop(1, 'rgba(200,170,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(mx, my, 70, 0, 6.3); c.fill();
    // облака
    for (const k of FX.clouds) { k.x += k.v * dt; if (k.x > 1.2) k.x = -.3; cloud(c, k.x * W, k.y * H, k.s); }
    // замки Света и Тьмы
    castle(c, W * .12, H + 4, Math.min(1, W / 420) * .9, 'rgba(255,200,120,.55)', false);
    castle(c, W * .9, H + 4, Math.min(1, W / 420) * .8, 'rgba(150,110,230,.5)', true);
    // искры
    for (const p of FX.spk) {
      const a = Math.max(0, Math.sin(t * p.v + p.p)); if (a < .05) continue;
      const x = p.x * W, y = p.y * H, r = p.s * (1 + a * 2);
      c.fillStyle = `rgba(255,255,255,${a * .85})`; c.beginPath(); c.moveTo(x, y - r * 2); c.quadraticCurveTo(x, y, x + r * 2, y); c.quadraticCurveTo(x, y, x, y + r * 2); c.quadraticCurveTo(x, y, x - r * 2, y); c.quadraticCurveTo(x, y, x, y - r * 2); c.fill();
    }
  }
  function renderHeroes() {
    $('#heroL').innerHTML = PC.svg('K', 'w'); $('#heroD').innerHTML = PC.svg('Q', 'b');
    $('#heroL2').innerHTML = PC.svg('N', 'w'); $('#heroD2').innerHTML = PC.svg('B', 'b');
  }

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

  applySettings(); refreshStart(); saveSettings();
  $('#btnPuzzle').onclick = () => { A.unlock(); startPuzzle(); };
  $('#btnHall').onclick = openHall; $('#btnQuest').onclick = () => { A.unlock(); openQuest(); };
  refreshHall(); fxInit(); refreshQuestBtn(); setTimeout(v3Floor, 60); addEventListener('resize', () => setTimeout(v3Floor, 60));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(() => { });

  // хук для автотестов
  window.__cq = { QUESTS, quest, startQuest, openQuest,
    get chess() { return chess; }, get G() { return G; }, get thinking() { return thinking; }, get flipped() { return flipped; },
    tap: name => onTap(C.sqIdx(name)), at: name => { const p = chess.board[C.sqIdx(name)]; return p ? LETTER[p & 7] + ((p >> 3) ? 'b' : 'w') : ''; },
    startGame, settings, startPuzzle, get stats() { return stats; }, mateMoves, PUZZLES, finish: st => finishGame(st)
  };
})();
