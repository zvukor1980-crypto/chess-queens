// v2 test in headless Chrome 390x844: python3 -m http.server 6720 (repo root), then node tools/v2test.cjs
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:6720/';
const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const oldSave = { mode: 'ai', human: 0, level: 'easy', timer: 0, clocks: [0, 0], moves: ['e2e4', 'e7e5', 'g1f3'], over: null, flipped: false };
  await p.evaluateOnNewDocument(s => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('cq.settings.v1', JSON.stringify({ sound: false, hints: true, anim: true, theme: 'marble', autoFlip: false, last: { mode: 'ai', color: 'w', level: 'easy', timer: 0 } }));
    localStorage.setItem('cq.save.v1', JSON.stringify(s)); }, oldSave);
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await sleep(800);
  ok(await p.evaluate(() => !document.querySelector('#btnContinue').classList.contains('hidden')), 'old saved game offered (Продолжить)');
  ok(await p.evaluate(() => __cq.settings.theme === 'fairy' && __cq.settings.pieces === 'hero' && __cq.settings.sound === false), 'old settings kept, new fairy look switched on once');
  await p.screenshot({ path: OUT + 'v2-start.png' });
  await p.tap('#btnContinue'); await sleep(900);
  ok(await p.evaluate(() => __cq.G.moves.length >= 3 && __cq.at('f3') === 'Nw'), 'old game resumed (3 moves, knight on f3)');
  await p.waitForFunction(() => !__cq.thinking && __cq.chess.turn === 0, { timeout: 15000 });
  ok(await p.evaluate(() => __cq.G.moves.length === 4), 'computer answered');
  await p.evaluate(() => __cq.tap('f1')); await sleep(300);
  await p.screenshot({ path: OUT + 'v2-game.png' });
  await p.evaluate(() => __cq.tap('c4')); await sleep(400);
  ok(await p.evaluate(() => __cq.at('c4') === 'Bw'), 'player move by taps');
  await p.waitForFunction(() => !__cq.thinking && __cq.chess.turn === 0, { timeout: 15000 });
  const saved = await p.evaluate(() => localStorage.getItem('cq.save.v1'));

  console.log('Puzzle of the day:');
  await p.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); __cq.startPuzzle(); }); await sleep(600);
  const pz = await p.evaluate(() => { const c = __cq.chess, mates = __cq.mateMoves().map(m => c.uci(m)); const wrong = c.legal().map(m => c.uci(m)).find(u => !mates.includes(u)); return { mates, wrong, turn: c.turn }; });
  ok(pz.mates.length >= 1, 'puzzle has a mate in one: ' + pz.mates.join(','));
  await p.screenshot({ path: OUT + 'v2-puzzle.png' });
  const tapU = async u => { await p.evaluate(u => { __cq.tap(u.slice(0, 2)); }, u); await sleep(150); await p.evaluate(u => { __cq.tap(u.slice(2, 4)); }, u); };
  if (pz.wrong) { await tapU(pz.wrong); await sleep(1100); ok(await p.evaluate(() => __cq.G.moves.length === 0 && __cq.G.tries === 1), 'wrong move is taken back'); }
  await tapU(pz.mates[0]); await sleep(1800);
  ok(await p.evaluate(() => /Задача решена/.test(document.querySelector('#sheet').textContent) && __cq.stats.pz.solved === 1 && __cq.stats.pz.streak === 1), 'puzzle solved, streak saved');
  await p.screenshot({ path: OUT + 'v2-puzzle-solved.png' });
  ok(await p.evaluate(() => localStorage.getItem('cq.save.v1')) === saved, 'puzzle did not overwrite the saved game');

  console.log('Crowns / hall of fame:');
  await p.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); __cq.startGame({ mode: 'ai', color: 'w', level: 'medium', timer: 0 }); }); await sleep(500);
  await p.evaluate(() => __cq.finish({ over: true, result: 'w', reason: 'mate' })); await sleep(1700);
  ok(await p.evaluate(() => __cq.stats.w.medium === 1 && __cq.stats.streak === 1 && /корона/.test(document.querySelector('#sheet').textContent)), 'win adds a crown and streak');
  await p.screenshot({ path: OUT + 'v2-win.png' });
  await p.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); document.querySelector('#btnMenu').click(); }); await sleep(300);
  await p.evaluate(() => document.querySelector('#mHome').click()); await sleep(400);
  ok(await p.evaluate(() => document.querySelector('#v2hall').textContent.includes('👑 1')), 'start screen shows crowns');
  await p.tap('#btnHall'); await sleep(500); await p.screenshot({ path: OUT + 'v2-hall.png' });
  await p.evaluate(() => document.querySelector('#hallOk').click()); await sleep(200);

  console.log('Piece style:');
  await p.tap('#btnSettingsStart'); await sleep(400);
  await p.evaluate(() => document.querySelector('.seg[data-name="pieces"] [data-v="classic"]').click()); await sleep(300);
  ok(await p.evaluate(() => !document.querySelector('#heroL svg').classList.contains('pc-hero') && JSON.parse(localStorage.getItem('cq.settings.v1')).pieces === 'classic'), 'classic pieces selectable and saved');
  await p.evaluate(() => document.querySelector('.seg[data-name="pieces"] [data-v="hero"]').click()); await sleep(200);
  await p.evaluate(() => document.querySelector('#setDone').click());
  await p.reload({ waitUntil: 'networkidle0' }); await sleep(600);
  ok(await p.evaluate(() => __cq.stats.pz.solved === 1 && __cq.stats.w.medium === 1), 'stats survive reload');
  ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'service worker registered');
  ok(errs.length === 0, 'no JS errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? 'V2 FAILED: ' + fails : 'V2 ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
