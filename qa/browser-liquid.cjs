const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const out=process.env.CAT_QA_OUTPUT||'/tmp/cat-jelly-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:.5});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(process.env.CAT_JELLY_URL||'http://127.0.0.1:8766/cat-jelly/press.html');await page.waitForFunction(()=>window.catJelly);
 await page.locator('.material-drawer summary').click();
 for(const kind of ['glass','iron','diamond','brick','lego','water']){await page.locator('[data-tex='+kind+']').click();assert.equal(await page.evaluate(()=>catJelly.snapshot().material),kind);await page.waitForTimeout(100);}
 await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',bubbles:true});
 await page.waitForFunction(()=>catJelly.snapshot().mode==='play',null,{timeout:150000});await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 let state=await page.evaluate(()=>catJelly.snapshot());assert(state.droplets>0);assert.equal(state.pieces,0);await page.screenshot({path:out+'/liquid-rupture.png'});
 await page.waitForFunction(()=>catJelly.snapshot().puddles>0,null,{timeout:60000});await page.screenshot({path:out+'/liquid-aftermath.png'});
 state=await page.evaluate(()=>catJelly.snapshot());assert(state.droplets<=150&&state.puddles<=12&&state.streams<=22&&state.waterfalls<=4);console.log('Wet effect counts',state);
 await page.locator('#resetBtn').click();state=await page.evaluate(()=>catJelly.snapshot());assert.equal(state.droplets,0);assert.equal(state.puddles,0);assert.equal(state.streams,0);assert.equal(state.waterfalls,0);assert.deepEqual(errors,[]);
 console.log('PASS legacy material selection, liquid rupture, bounded wet effects and reset');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
