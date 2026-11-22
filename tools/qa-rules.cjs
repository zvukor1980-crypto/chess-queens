// Independent regression checks for the full chess rules.
const assert = require('node:assert/strict');
const { Chess } = require('../chess.js');
const g = new Chess();
const play = u => { const m = g.findUci(u); assert.ok(m, 'Legal UCI: ' + u); g.play(m); };
let tests = 0;
function test(name, fn) { fn(); tests++; console.log('PASS: ' + name); }
test('initial 8x8 arrangement, queens on d1/d8', () => {
  g.reset(); assert.equal(g.board.length, 64);
  assert.equal(g.board[Chess.sqIdx('d1')], Chess.Q);
  assert.equal(g.board[Chess.sqIdx('d8')], 8 + Chess.Q);
  assert.equal(g.legal().length, 20);
});
test('fools mate and side to move', () => {
  g.reset(); ['f2f3','e7e5','g2g4','d8h4'].forEach(play);
  assert.deepEqual(g.status(), {over:true,result:'b',reason:'mate'});
});
test('castling and undo restore all FEN fields', () => {
  const fen='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  g.load(fen);
  assert.ok(g.findUci('e1g1') && g.findUci('e1c1'));
  play('e1g1');
  assert.equal(g.board[Chess.sqIdx('g1')],Chess.K);
  assert.equal(g.board[Chess.sqIdx('f1')],Chess.R);
  g.undo(); assert.equal(g.fen(),fen);
});
test('en passant, undo and pinned en-passant forbidden', () => {
  let fen='4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
  g.load(fen); assert.ok(g.findUci('e5d6')); play('e5d6');
  assert.equal(g.board[Chess.sqIdx('d5')],0);
  g.undo(); assert.equal(g.fen(),fen);
  const pinned='4r2k/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
  g.load(pinned); assert.equal(g.findUci('e5d6'),null);
  const k1=g.key(); g.load(pinned.replace(' d6 ',' - ')); assert.equal(g.key(),k1);
});
test('all four pawn promotions', () => {
  g.load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const moves=g.legal().map(m=>g.uci(m));
  ['a7a8q','a7a8r','a7a8b','a7a8n'].forEach(m=>assert.ok(moves.includes(m)));
});
test('king capture is never legal', () => {
  g.load('4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(g.findUci('e7e8'),null);
});
test('threefold repetition claim, fivefold automatic', () => {
  g.reset(); const loop=['g1f3','g8f6','f3g1','f6g8'];
  [...loop,...loop].forEach(play);
  assert.equal(g.status().over,false);
  assert.equal(g.status().claim,'repetition');
  [...loop,...loop].forEach(play);
  assert.equal(g.status().over,true);assert.equal(g.status().reason,'fivefold');
});
test('50 move claim and 75 move automatic', () => {
  g.load('4k3/8/8/8/8/8/6R1/4K3 w - - 100 51');
  assert.equal(g.status().claim,'fifty'); assert.equal(g.status().over,false);
  g.load('4k3/8/8/8/8/8/6R1/4K3 w - - 150 76');
  assert.equal(g.status().reason,'seventyfive');
});
test('material on time: lone bishop vs knight can mate with help', () => {
  g.load('4k1n1/8/8/8/8/8/8/2B1K3 w - - 0 1');
  assert.equal(g.canMate(0),true);
  g.load('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1');
  assert.equal(g.canMate(0),false);
});
console.log(tests + ' regression groups passed.');
