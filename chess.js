/* Шахматы Королев — правила шахмат (общие для UI и Web Worker) */
(function (root) {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const F_EP = 1, F_OO = 2, F_OOO = 4, F_DBL = 8;
  // индекс клетки: r*8+f, r=0 — 8-я горизонталь
  const FILES = 'abcdefgh';
  const sqName = i => FILES[i & 7] + (8 - (i >> 3));
  const sqIdx = s => (8 - parseInt(s[1], 10)) * 8 + FILES.indexOf(s[0]);
  const colorOf = p => p >> 3;
  const typeOf = p => p & 7;

  // предвычисленные таблицы
  const KNIGHT = [], KING = [], RAYS = [];
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (let s = 0; s < 64; s++) {
    const r = s >> 3, f = s & 7;
    KNIGHT[s] = []; KING[s] = []; RAYS[s] = [];
    for (const [dr, df] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) KNIGHT[s].push(rr * 8 + ff);
    }
    for (let d = 0; d < 8; d++) {
      const [dr, df] = DIRS[d]; const ray = [];
      let rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) KING[s].push(rr * 8 + ff);
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) { ray.push(rr * 8 + ff); rr += dr; ff += df; }
      RAYS[s].push(ray);
    }
  }

  class Chess {
    constructor() { this.reset(); }
    reset() {
      const b = this.board = new Int8Array(64);
      const back = [R, N, B, Q, K, B, N, R];
      for (let f = 0; f < 8; f++) { b[f] = 8 + back[f]; b[8 + f] = 8 + P; b[48 + f] = P; b[56 + f] = back[f]; }
      this.turn = 0; this.castle = 15; this.ep = -1; this.half = 0; this.full = 1;
      this.kings = [60, 4];
      this.stack = [];
      this.keys = [this.key()];
      this.moveList = [];
    }
    clone() {
      const c = new Chess();
      c.board = Int8Array.from(this.board); c.turn = this.turn; c.castle = this.castle; c.ep = this.ep;
      c.half = this.half; c.full = this.full; c.kings = this.kings.slice(); c.stack = [];
      c.keys = this.keys.slice(); c.moveList = this.moveList.slice();
      return c;
    }
    attacked(sq, by) {
      const b = this.board, r = sq >> 3, f = sq & 7;
      // пешки
      if (by === 0) {
        if (r < 7) { if (f > 0 && b[sq + 7] === P) return true; if (f < 7 && b[sq + 9] === P) return true; }
      } else {
        if (r > 0) { if (f > 0 && b[sq - 9] === 8 + P) return true; if (f < 7 && b[sq - 7] === 8 + P) return true; }
      }
      const off = by * 8;
      const kn = KNIGHT[sq]; for (let i = 0; i < kn.length; i++) if (b[kn[i]] === off + N) return true;
      const kg = KING[sq]; for (let i = 0; i < kg.length; i++) if (b[kg[i]] === off + K) return true;
      const rays = RAYS[sq];
      for (let d = 0; d < 8; d++) {
        const ray = rays[d];
        for (let i = 0; i < ray.length; i++) {
          const p = b[ray[i]];
          if (!p) continue;
          if ((p >> 3) === by) {
            const t = p & 7;
            if (t === Q || (d < 4 ? t === R : t === B)) return true;
          }
          break;
        }
      }
      return false;
    }
    inCheck(side = this.turn) { return this.attacked(this.kings[side], side ^ 1); }

    pseudo(capturesOnly = false) {
      const b = this.board, us = this.turn, them = us ^ 1, out = [];
      const add = (from, to, piece, flags, captured) => {
        if ((piece & 7) === P && ((to >> 3) === 0 || (to >> 3) === 7)) {
          for (const pr of [Q, R, B, N]) out.push({ from, to, piece, captured, promo: pr, flags });
        } else out.push({ from, to, piece, captured, promo: 0, flags });
      };
      for (let s = 0; s < 64; s++) {
        const p = b[s]; if (!p || (p >> 3) !== us) continue;
        const t = p & 7;
        if (t === P) {
          const dir = us === 0 ? -8 : 8, f = s & 7, r = s >> 3;
          const one = s + dir;
          const promoRank = (one >> 3) === 0 || (one >> 3) === 7;
          if (!b[one] && (!capturesOnly || promoRank)) {
            add(s, one, p, 0, 0);
            const start = us === 0 ? 6 : 1;
            if (!capturesOnly && r === start && !b[one + dir]) add(s, one + dir, p, F_DBL, 0);
          }
          for (const df of [-1, 1]) {
            if (f + df < 0 || f + df > 7) continue;
            const to = one + df, q = b[to];
            if (q && (q >> 3) === them) add(s, to, p, 0, q);
            else if (to === this.ep) add(s, to, p, F_EP, them * 8 + P);
          }
        } else if (t === N || t === K) {
          const tbl = t === N ? KNIGHT[s] : KING[s];
          for (let i = 0; i < tbl.length; i++) {
            const to = tbl[i], q = b[to];
            if (!q) { if (!capturesOnly) add(s, to, p, 0, 0); }
            else if ((q >> 3) === them) add(s, to, p, 0, q);
          }
          if (t === K && !capturesOnly) this._castles(s, p, out);
        } else {
          const d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8;
          for (let d = d0; d < d1; d++) {
            const ray = RAYS[s][d];
            for (let i = 0; i < ray.length; i++) {
              const to = ray[i], q = b[to];
              if (!q) { if (!capturesOnly) add(s, to, p, 0, 0); continue; }
              if ((q >> 3) === them) add(s, to, p, 0, q);
              break;
            }
          }
        }
      }
      return out;
    }
    _castles(s, p, out) {
      const us = this.turn, b = this.board, them = us ^ 1;
      const home = us === 0 ? 60 : 4;
      if (s !== home) return;
      const kBit = us === 0 ? 1 : 4, qBit = us === 0 ? 2 : 8;
      const rook = us * 8 + R;
      if ((this.castle & kBit) && !b[s + 1] && !b[s + 2] && b[s + 3] === rook &&
        !this.attacked(s, them) && !this.attacked(s + 1, them) && !this.attacked(s + 2, them))
        out.push({ from: s, to: s + 2, piece: p, captured: 0, promo: 0, flags: F_OO });
      if ((this.castle & qBit) && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === rook &&
        !this.attacked(s, them) && !this.attacked(s - 1, them) && !this.attacked(s - 2, them))
        out.push({ from: s, to: s - 2, piece: p, captured: 0, promo: 0, flags: F_OOO });
    }
    make(m) {
      const b = this.board, us = this.turn;
      this.stack.push([this.castle, this.ep, this.half]);
      b[m.from] = 0;
      b[m.to] = m.promo ? us * 8 + m.promo : m.piece;
      if (m.flags & F_EP) b[us === 0 ? m.to + 8 : m.to - 8] = 0;
      if (m.flags & F_OO) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = 0; }
      if (m.flags & F_OOO) { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = 0; }
      if ((m.piece & 7) === K) { this.kings[us] = m.to; this.castle &= us === 0 ? ~3 : ~12; }
      const cr = sq => { if (sq === 63) this.castle &= ~1; else if (sq === 56) this.castle &= ~2; else if (sq === 7) this.castle &= ~4; else if (sq === 0) this.castle &= ~8; };
      cr(m.from); cr(m.to);
      this.ep = (m.flags & F_DBL) ? (m.from + m.to) >> 1 : -1;
      this.half = ((m.piece & 7) === P || m.captured) ? 0 : this.half + 1;
      if (us === 1) this.full++;
      this.turn = us ^ 1;
    }
    unmake(m) {
      const b = this.board;
      this.turn ^= 1; const us = this.turn;
      if (us === 1) this.full--;
      const [c, e, h] = this.stack.pop(); this.castle = c; this.ep = e; this.half = h;
      b[m.from] = m.piece;
      b[m.to] = 0;
      if (m.flags & F_EP) b[us === 0 ? m.to + 8 : m.to - 8] = m.captured;
      else b[m.to] = m.captured;
      if (m.flags & F_OO) { b[m.from + 3] = b[m.from + 1]; b[m.from + 1] = 0; }
      if (m.flags & F_OOO) { b[m.from - 4] = b[m.from - 1]; b[m.from - 1] = 0; }
      if ((m.piece & 7) === K) this.kings[us] = m.from;
    }
    legal() {
      const out = [], us = this.turn;
      for (const m of this.pseudo()) {
        this.make(m);
        if (!this.attacked(this.kings[us], us ^ 1)) out.push(m);
        this.unmake(m);
      }
      return out;
    }
    legalFrom(sq) { return this.legal().filter(m => m.from === sq); }
    key() {
      let ep = -1;
      if (this.ep >= 0) {
        const pawn = this.turn * 8 + P, f = this.ep & 7, src = this.turn === 0 ? this.ep + 8 : this.ep - 8;
        if ((f > 0 && this.board[src - 1] === pawn) || (f < 7 && this.board[src + 1] === pawn)) ep = this.ep;
      }
      return this.board.join(',') + '|' + this.turn + this.castle + '|' + ep;
    }
    uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo ? ' pnbrqk'[m.promo] : ''); }
    findUci(u) { return this.legal().find(m => this.uci(m) === u) || null; }
    san(m, legal = this.legal()) {
      let s;
      if (m.flags & F_OO) s = 'O-O';
      else if (m.flags & F_OOO) s = 'O-O-O';
      else {
        const t = m.piece & 7, letter = ['', '', 'К', 'С', 'Л', 'Ф', 'Кр'][t];
        const to = sqName(m.to);
        if (t === P) {
          s = (m.captured ? FILES[m.from & 7] + 'x' : '') + to;
          if (m.promo) s += '=' + ['', '', 'К', 'С', 'Л', 'Ф'][m.promo];
        } else {
          let dis = '';
          const others = legal.filter(o => o !== m && o.to === m.to && o.piece === m.piece && o.from !== m.from);
          if (others.length) {
            const sameFile = others.some(o => (o.from & 7) === (m.from & 7));
            const sameRank = others.some(o => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) dis = FILES[m.from & 7];
            else if (!sameRank) dis = String(8 - (m.from >> 3));
            else dis = sqName(m.from);
          }
          s = letter + dis + (m.captured ? 'x' : '') + to;
        }
      }
      this.make(m);
      if (this.inCheck()) s += this.legal().length ? '+' : '#';
      this.unmake(m);
      return s;
    }
    // ход с записью в историю партии (для UI)
    play(m) {
      const san = this.san(m);
      this.make(m);
      this.keys.push(this.key());
      this.moveList.push({ m, san, uci: this.uci(m) });
      return san;
    }
    undo() {
      const last = this.moveList.pop(); if (!last) return null;
      this.keys.pop(); this.unmake(last.m);
      return last;
    }
    insufficient() {
      const minors = [], b = this.board;
      for (let s = 0; s < 64; s++) {
        const p = b[s]; if (!p) continue; const t = p & 7;
        if (t === K) continue;
        if (t === P || t === R || t === Q) return false;
        minors.push({ t, s, c: p >> 3 });
      }
      if (minors.length <= 1) return true;
      // только слоны одного цвета полей
      if (minors.every(x => x.t === B)) {
        const col = x => ((x.s >> 3) + (x.s & 7)) & 1;
        return minors.every(x => col(x) === col(minors[0]));
      }
      return false;
    }
    // может ли сторона в принципе поставить мат (для флажка)
    canMate(side) {
      let n = 0, b = 0;
      for (let s = 0; s < 64; s++) {
        const p = this.board[s]; if (!p || (p >> 3) !== side) continue;
        const t = p & 7;
        if (t === P || t === R || t === Q) return true;
        if (t === N) n++; if (t === B) b++;
      }
      return n + b >= 2;
    }
    status() {
      const legal = this.legal();
      if (!legal.length) return this.inCheck() ? { over: true, result: this.turn === 0 ? 'b' : 'w', reason: 'mate' } : { over: true, result: 'd', reason: 'stalemate' };
      if (this.insufficient()) return { over: true, result: 'd', reason: 'material' };
      if (this.half >= 100) return { over: true, result: 'd', reason: 'fifty' };
      const k = this.keys[this.keys.length - 1];
      let cnt = 0; for (const x of this.keys) if (x === k) cnt++;
      if (cnt >= 3) return { over: true, result: 'd', reason: 'repetition' };
      return { over: false, check: this.inCheck() };
    }
    load(fen) {
      const [pl, t, cs, ep, h, f] = fen.trim().split(/\s+/);
      this.board.fill(0); let s = 0;
      for (const ch of pl) {
        if (ch === '/') continue;
        if (/\d/.test(ch)) { s += +ch; continue; }
        const ty = ' pnbrqk'.indexOf(ch.toLowerCase()), col = ch === ch.toLowerCase() ? 1 : 0;
        this.board[s] = col * 8 + ty; if (ty === K) this.kings[col] = s; s++;
      }
      this.turn = t === 'b' ? 1 : 0;
      this.castle = (cs || '').split('').reduce((a, c) => a | ({ K: 1, Q: 2, k: 4, q: 8 }[c] || 0), 0);
      this.ep = ep && ep !== '-' ? sqIdx(ep) : -1; this.half = +h || 0; this.full = +f || 1;
      this.stack = []; this.moveList = []; this.keys = [this.key()];
      return this;
    }
    fen() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 8 + f];
          if (!p) { e++; continue; }
          if (e) { s += e; e = 0; }
          const ch = ' pnbrqk'[p & 7]; s += (p >> 3) ? ch : ch.toUpperCase();
        }
        if (e) s += e; if (r < 7) s += '/';
      }
      let c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
      return s + ' ' + (this.turn ? 'b' : 'w') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
    }
  }
  Chess.P = P; Chess.N = N; Chess.B = B; Chess.R = R; Chess.Q = Q; Chess.K = K;
  Chess.F_EP = F_EP; Chess.F_OO = F_OO; Chess.F_OOO = F_OOO; Chess.F_DBL = F_DBL;
  Chess.sqName = sqName; Chess.sqIdx = sqIdx; Chess.colorOf = colorOf; Chess.typeOf = typeOf;
  root.Chess = Chess;
})(typeof self !== 'undefined' ? self : this);
