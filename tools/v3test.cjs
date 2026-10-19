// v3: «Королевский поход». node tools/v3test.cjs
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:6720/'; const OUT = __dirname + '/../shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms)); let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' }); await sleep(700);
  ok(await p.evaluate(() => !!document.querySelector('#v3floor') && /Этап 1 из 10/.test(document.querySelector('#btnQuest').textContent)), 'start: glowing chess floor + «Королевский поход»');
  await p.screenshot({ path: OUT + 'v3-start.png' });
  await p.evaluate(() => document.querySelector('#btnQuest').click()); await sleep(400);
  ok(await p.evaluate(() => document.querySelectorAll('.v3q').length === 10 && document.querySelectorAll('.v3q.lock').length === 9), 'quest map: 10 stages, 9 locked');
  await p.screenshot({ path: OUT + 'v3-quest.png' });
  await p.evaluate(() => document.querySelector('.v3q[data-q="0"]').click()); await sleep(600);
  let s = await p.evaluate(() => ({ q: __cq.G.quest, fen: __cq.G.fen, bq: __cq.at('d8'), wq: __cq.at('d1'), label: document.querySelector('#modeLabel').textContent }));
  ok(s.q === 0 && s.bq === '' && s.wq === 'Qw' && /Поход/.test(s.label), 'stage 1 loaded from FEN: ' + s.label);
  await p.evaluate(() => __cq.tap('e2')); await sleep(150); await p.evaluate(() => __cq.tap('e4')); await sleep(300);
  await p.waitForFunction(() => __cq.G.moves.length >= 2 && !__cq.thinking, { timeout: 15000 });
  s = await p.evaluate(() => ({ moves: __cq.G.moves.slice(), turn: __cq.chess.turn }));
  ok(s.moves.length === 2 && s.turn === 0, 'engine replied on the custom position: ' + s.moves.join(' '));
  await sleep(500); await p.screenshot({ path: OUT + 'v3-game.png' });
  // сохранение и возобновление с FEN
  await p.reload({ waitUntil: 'networkidle0' }); await sleep(600);
  await p.evaluate(() => document.querySelector('#btnContinue').click()); await sleep(600);
  s = await p.evaluate(() => ({ q: __cq.G.quest, moves: __cq.G.moves.length, bq: __cq.at('d8'), e4: __cq.at('e4') }));
  ok(s.q === 0 && s.moves === 2 && s.bq === '' && s.e4 === 'Pw', 'quest game resumes after reload with FEN');
  // победа
  await p.evaluate(() => __cq.finish({ over: true, result: 'w', reason: 'mate' })); await sleep(1600);
  s = await p.evaluate(() => ({ st: JSON.parse(localStorage.getItem('cq.quest.v1')).stars[0], txt: document.querySelector('#sheet, .sheet, #modal').textContent, next: !!document.querySelector('#resNext') }));
  ok(s.st === 3 && s.next && /пройден/.test(s.txt), 'stage won: 3 stars, «Следующий этап» offered');
  await sleep(700); await p.screenshot({ path: OUT + 'v3-win.png' });
  await p.evaluate(() => document.querySelector('#resNext').click()); await sleep(600);
  s = await p.evaluate(() => ({ q: __cq.G.quest, help: __cq.G.help }));
  ok(s.q === 1, 'stage 2 started');
  await p.evaluate(() => document.querySelector('#btnHint').click()); await sleep(1500);
  ok(await p.evaluate(() => __cq.G.help === 1), 'hint counted (loses 3rd star)');
  // обычная игра без похода работает
  await p.evaluate(() => __cq.startGame({ mode: 'ai', color: 'w', level: 'easy', timer: 0 })); await sleep(300);
  ok(await p.evaluate(() => __cq.G.quest == null && !__cq.G.fen && __cq.at('d8') === 'Qb'), 'normal game unaffected');
  ok(!errs.length, 'no JS errors ' + errs.join(' | '));
  await b.close(); process.exitCode = fails ? 1 : 0;
})();
