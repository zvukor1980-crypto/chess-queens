// Known starting-position perft counts exercise legal moves and make/unmake.
const assert=require('node:assert/strict');
const {Chess}=require('../chess.js');
const game=new Chess(),initial=game.fen();
function perft(depth){if(!depth)return 1;let nodes=0;for(const move of game.legal()){game.make(move);nodes+=perft(depth-1);game.unmake(move);}return nodes;}
for(const [depth,expected] of [[1,20],[2,400],[3,8902],[4,197281]]){assert.equal(perft(depth),expected);assert.equal(game.fen(),initial);}
console.log('PASS: starting-position perft depths 1–4 and exact board restoration');
