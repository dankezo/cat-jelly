/* Run against a server rooted at /workspace on port 8766 (tests the Pages base path).
   BROWSER_EXECUTABLE=/usr/bin/chromium uses a system browser; otherwise Playwright's pinned browser. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.CAT_JELLY_URL||'http://127.0.0.1:8766/cat-jelly/';
const output=process.env.CAT_QA_OUTPUT||'/tmp/cat-jelly-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const observations=[];
 try{
  for(const mobile of [false,true]){
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:.5,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   await page.goto(base+(mobile?'press.html':''),{waitUntil:'load'});
   await page.waitForFunction(()=>window.catJelly?.snapshot().physics?.steps>5,{},{timeout:60000});
   const snap=()=>page.evaluate(()=>catJelly.snapshot());
   const shot=stage=>page.screenshot({path:path.join(output,(mobile?'mobile-':'desktop-')+stage+'.png'),fullPage:true});
   await shot('initial');console.log('loaded',mobile?'mobile':'desktop');
   for(const type of ['mochi','pudding','soda','tabby']){
    await page.locator('[data-cat='+type+']').click();
    await page.waitForFunction(type=>catJelly.snapshot().type===type&&catJelly.snapshot().physics.steps>3,type);
    const s=await snap();assert.equal(s.physics.inverted,0);assert(Number.isFinite(s.physics.volume));assert(s.physics.volumeRatio>.95);await shot(type);
   }
   await page.locator('[data-cat=mochi]').click();
   // Find a visible physical pick location with real canvas pointer events.
   const canvas=page.locator('#scene'),size=await canvas.boundingBox();let grabbed=false;
   for(const [x,y] of [[.5,.57],[.5,.60],[.49,.54],[.5,.50],[.48,.64]]){
    await page.mouse.move(size.width*x,size.height*y);await page.mouse.down();
    if((await snap()).grabbed){grabbed=true;break;}await page.mouse.up();
   }
   if(!mobile){assert(grabbed,'specimen is pickable');await page.mouse.move(size.width*.55,size.height*.45,{steps:5});assert((await snap()).grabbed);await page.mouse.up();assert(!(await snap()).grabbed);}
   else await page.mouse.up();
   await page.locator('#resetBtn').click();
   for(const lang of ['vi','es','zh','en']){await page.locator('[data-lang='+lang+']').click();assert.equal(await page.locator('html').getAttribute('lang'),lang==='zh'?'zh-CN':lang);}
   await page.locator('#labSettings summary').click();
   for(const quality of ['low','balanced','high','ultra','auto']){await page.locator('#quality').selectOption(quality);assert.equal((await snap()).quality,quality);}
   await page.locator('#slowMotion').check();await page.locator('#slowMotion').uncheck();
   await page.locator('#showDiagnostics').check();assert(await page.locator('#diagnostics').isVisible());await page.locator('#showDiagnostics').uncheck();
   await page.locator('#photoMode').click();assert(await page.locator('body').evaluate(el=>el.classList.contains('photo')));await page.keyboard.press('Escape');
   await page.locator('#labSettings summary').click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no overflow');
   // Pointer cancellation always releases the press, including touch input.
   await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:7,pointerType:mobile?'touch':'mouse',bubbles:true});
   await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(!(await snap()).holding);
   if(!mobile){
    await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:8,pointerType:'mouse',bubbles:true});
    await page.waitForFunction(()=>{if(catJelly.snapshot().lifecycle!=='DEFORMING')return false;window.dispatchEvent(new Event('blur'));return true;},null,{timeout:90000});
    await shot('contact');
    await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:10,pointerType:'mouse',bubbles:true});
    // Release in the same browser task as the measurement: screenshot readback can be slow.
    await page.waitForFunction(()=>{const s=catJelly.snapshot();if(!s.physics||s.physics.height>=1.9||s.physics.strain<=.26)return false;window.__qaCompression=s;window.dispatchEvent(new Event('blur'));return true;},null,{timeout:90000});
    const contact=await page.evaluate(()=>window.__qaCompression);assert.equal(contact.physics.inverted,0);assert(contact.pressure>0);await shot('compression');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(()=>{const p=catJelly.snapshot().physics;return p&&p.strain<.12&&p.volumeRatio>.95},null,{timeout:90000}).catch(async e=>{console.log('recovery timeout',await snap());await shot('failure');throw e;});await shot('recovery');console.log('elastic recovery verified');
    await page.locator('#resetBtn').click();
    await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:9,pointerType:'mouse',bubbles:true});
    await page.waitForFunction(()=>catJelly.snapshot().mode==='play',null,{timeout:120000});
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    const broken=await snap();assert.equal(broken.fracture.count,7);assert(Math.abs(broken.fracture.fragmentVolume-broken.fracture.sourceVolume)<1e-8);await shot('fracture');
    await page.waitForTimeout(2500);await shot('aftermath');console.log('fracture verified');
    await page.locator('#resetBtn').click();await page.waitForTimeout(1000);const baseline=await snap();
    for(let i=0;i<8;i++){await page.locator('#resetBtn').click();await page.waitForTimeout(200);}
    const reset=await snap();assert.equal(reset.pieces,0);assert.equal(reset.droplets,0);assert(reset.geometries<=baseline.geometries+2,'GPU geometries stable across reset');assert(reset.textures<=baseline.textures+1,'GPU textures stable');await shot('reset');
    observations.push({contact,broken,reset,baseline});
   }
   await page.setViewportSize(mobile?{width:844,height:390}:{width:1080,height:720});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   assert.deepEqual(errors,[],'no browser exceptions or console errors');
   observations.push({mobile,snapshot:await snap()});console.log('PASS V3 '+(mobile?'mobile':'desktop')+' controls, routes, rendering and lifecycle');await page.close();
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(observations,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
