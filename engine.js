/* Шахматы Королев — движок: альфа-бета + таблицы позиций (PST) */
(function (root) {
  'use strict';
  const C = root.Chess;
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  // таблицы для белых, индекс r*8+f (r=0 — 8-я горизонталь)
  const PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  ];
  const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  const MATE = 100000;
  const ABORT = {};

  function evaluate(c) {
    const b = c.board;
    let score = 0, mat = 0, queens = 0;
    for (let s = 0; s < 64; s++) { const p = b[s]; if (p) { const t = p & 7; if (t !== 6 && t !== 1) mat += VAL[t]; if (t === 5) queens++; } }
    const endgame = queens === 0 || mat <= 2600;
    let wb = 0, bb = 0;
    for (let s = 0; s < 64; s++) {
      const p = b[s]; if (!p) continue;
      const t = p & 7, black = p >> 3, idx = black ? s ^ 56 : s;
      let v = VAL[t] + (t === 6 && endgame ? KING_END[idx] : PST[t][idx]);
      if (t === 3) { if (black) bb++; else wb++; }
      score += black ? -v : v;
    }
    if (wb >= 2) score += 30; if (bb >= 2) score -= 30;
    return c.turn === 0 ? score : -score;
  }

  function orderScore(m, pv, killers) {
    if (pv && m.from === pv.from && m.to === pv.to && m.promo === pv.promo) return 1e6;
    let s = 0;
    if (m.captured) s += 10000 + VAL[m.captured & 7] * 10 - VAL[m.piece & 7] / 10;
    if (m.promo) s += 9000 + VAL[m.promo];
    if (killers && killers.some(k => k && k.from === m.from && k.to === m.to)) s += 5000;
    return s;
  }
  function sortMoves(ms, pv, killers) {
    for (const m of ms) m._o = orderScore(m, pv, killers);
    ms.sort((a, b) => b._o - a._o);
    return ms;
  }

  function search(c, opts) {
    const maxDepth = opts.depth || 4, deadline = Date.now() + (opts.time || 1500), noise = opts.noise || 0;
    let nodes = 0;
    const killers = [];
    const us0 = c.turn;
    const rootKeys = new Set(c.keys || []);

    function quiesce(alpha, beta, qd) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) throw ABORT;
      const stand = evaluate(c);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd > 6) return alpha;
      const ms = sortMoves(c.pseudo(true));
      const us = c.turn;
      for (const m of ms) {
        c.make(m);
        if (c.attacked(c.kings[us], us ^ 1)) { c.unmake(m); continue; }
        const v = -quiesce(-beta, -alpha, qd + 1);
        c.unmake(m);
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }

    function negamax(depth, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) throw ABORT;
      if (c.half >= 100) return 0;
      const us = c.turn;
      const check = c.attacked(c.kings[us], us ^ 1);
      if (check && ply < 12) depth++;
      if (depth <= 0) return quiesce(alpha, beta, 0);
      const ms = sortMoves(c.pseudo(), null, killers[ply]);
      let legal = 0;
      for (const m of ms) {
        c.make(m);
        if (c.attacked(c.kings[us], us ^ 1)) { c.unmake(m); continue; }
        legal++;
        let v;
        if (ply <= 2 && rootKeys.size && rootKeys.has(c.key())) v = 0; // избегаем/ищем повторения
        else v = -negamax(depth - 1, -beta, -alpha, ply + 1);
        c.unmake(m);
        if (v >= beta) {
          if (!m.captured) { const k = killers[ply] || (killers[ply] = []); k.unshift(m); k.length = Math.min(k.length, 2); }
          return beta;
        }
        if (v > alpha) alpha = v;
      }
      if (!legal) return check ? -MATE + ply : 0;
      return alpha;
    }

    const rootMoves = c.legal();
    if (!rootMoves.length) return null;
    if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0, nodes };
    let best = rootMoves[0], bestScore = -Infinity, doneDepth = 0;
    let pv = null;
    for (let d = 1; d <= maxDepth; d++) {
      try {
        sortMoves(rootMoves, pv);
        let alpha = -Infinity, curBest = null, curScore = -Infinity;
        for (const m of rootMoves) {
          c.make(m);
          let v;
          if (rootKeys.has(c.key())) v = 0;
          else v = -negamax(d - 1, -Infinity, noise ? Infinity : -alpha, 1);
          c.unmake(m);
          if (noise) v += (Math.random() * 2 - 1) * noise;
          if (v > curScore) { curScore = v; curBest = m; }
          if (!noise && v > alpha) alpha = v;
        }
        best = curBest; bestScore = curScore; pv = curBest; doneDepth = d;
        if (Math.abs(bestScore) > MATE - 100) break;
      } catch (e) {
        if (e !== ABORT) throw e;
        break; // позиция-копия испорчена прерыванием, берём лучший ход прошлой глубины
      }
    }
    return { move: best, score: bestScore, depth: doneDepth, nodes };
  }

  const LEVELS = {
    easy: { depth: 1, time: 400, noise: 140 },
    medium: { depth: 3, time: 900, noise: 25 },
    hard: { depth: 7, time: 1700, noise: 0 },
    hint: { depth: 5, time: 1000, noise: 0 }
  };

  function bestMove(moves, level, fen) {
    const c = new C(); if (fen) c.load(fen);
    for (const u of moves) { const m = c.findUci(u); if (!m) break; c.play(m); }
    const opts = LEVELS[level] || LEVELS.medium;
    // работаем на копии, чтобы прерывание по времени не портило позицию
    const work = c.clone();
    const t0 = Date.now();
    const r = search(work, opts);
    if (!r) return null;
    return { uci: c.uci(r.move), score: r.score, depth: r.depth, nodes: r.nodes, ms: Date.now() - t0 };
  }

  root.CQEngine = { bestMove, evaluate, search, LEVELS };
})(typeof self !== 'undefined' ? self : this);
