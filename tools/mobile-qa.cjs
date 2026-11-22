// Mobile browser audit at Samsung-like portrait viewports; produces real gameplay screenshot.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:6720/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const [width,height] of [[360,780],[390,844],[412,915],[320,640]]) {
      const page = await browser.newPage();
      await page.setViewport({width,height,deviceScaleFactor:2,isMobile:true,hasTouch:true});
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(BASE,{waitUntil:'networkidle0'});
      await page.evaluate(() => {
        localStorage.clear();
        __cq.startGame({mode:'pvp',color:'w',level:'easy',timer:0});
      });
      await sleep(200);
      const geom=await page.evaluate(() => {
        const b=document.querySelector('#board').getBoundingClientRect();
        const squares=[...document.querySelectorAll('#board .sq')];
        const pieces=[...document.querySelectorAll('#board .piece')];
        const cell=b.width/8;
        const drift=pieces.map(el=>{
          const r=el.getBoundingClientRect();
          const x=(r.left+r.width/2-b.left)/cell-.5;
          const y=(r.top+r.height/2-b.top)/cell-.5;
          return Math.max(Math.abs(x-Math.round(x)),Math.abs(y-Math.round(y)));
        });
        const over={left:b.left,top:b.top,right:b.right,bottom:b.bottom};
        return {boardW:b.width,boardH:b.height,squares:squares.length,pieces:pieces.length,
          squareW:squares[0].getBoundingClientRect().width,
          maxPieceDrift:Math.max(...drift),over,gameVisible:document.querySelector('#game').classList.contains('active'),
          realViewport:[innerWidth,innerHeight]};
      });
      assert.equal(geom.squares,64);
      assert.equal(geom.pieces,32);
      assert.ok(geom.gameVisible);
      assert.ok(Math.abs(geom.boardW-geom.boardH) < .75,'square board');
      assert.ok(Math.abs(geom.squareW*8-geom.boardW)<.75,'equal square width');
      assert.ok(geom.maxPieceDrift<.025,'figures centered on squares: '+geom.maxPieceDrift);
      assert.ok(geom.over.left>=0 && geom.over.right<=geom.realViewport[0]+1, 'board fits viewport width');
      assert.ok(geom.over.top>=0 && geom.over.bottom<=geom.realViewport[1]+1, 'board fits viewport height');
      // Execute quick real touchscreen taps to catch click suppression / hitbox offsets.
      const center=async (file,rank)=>{
        const b=await page.$eval('#board',el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,s:r.width/8};});
        await page.touchscreen.tap(b.x+(file+.5)*b.s,b.y+(rank+.5)*b.s);
      };
      await center(4,6); await sleep(70); await center(4,4); await sleep(200);
      assert.equal(await page.evaluate(()=>__cq.at('e4')),'Pw','touch move e2-e4');
      assert.equal(await page.evaluate(()=>__cq.G.moves.length),1,'one move recorded');
      if(width===390){
        await page.screenshot({path:path.join(__dirname,'../shots/mobile-game-390x844.png'),fullPage:true});
        await page.evaluate(()=>document.querySelector('#btnFlip').click());
        const pos=await page.$eval('#board .sq[data-sq="a1"]',el=>({left:el.style.left,top:el.style.top}));
        assert.equal(pos.left,'87.5%');assert.equal(pos.top,'0%');
      }
      assert.deepEqual(errors,[],'No browser exceptions');
      console.log('PASS viewport '+width+'x'+height+': board='+Math.round(geom.boardW)+'px, cell='+geom.squareW.toFixed(1)+'px, max center drift='+geom.maxPieceDrift);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
