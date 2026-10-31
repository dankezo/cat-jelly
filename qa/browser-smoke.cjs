const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  let failed = false;
  try {
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('#holdBtn').waitFor({state:'visible',timeout:30000});
      await page.waitForTimeout(2200);
      const ready=await page.evaluate(()=>({webgl:!!document.querySelector('canvas')?.getContext('webgl2')||!!document.querySelector('canvas')?.getContext('webgl'),fallback:getComputedStyle(document.getElementById('fallback')).display,scroll:document.documentElement.scrollWidth-innerWidth}));
      if(!ready.webgl||ready.fallback!=='none')throw new Error('WebGL boot failed: '+JSON.stringify(ready));
      if(ready.scroll>4)throw new Error('Horizontal overflow: '+JSON.stringify(ready));
      await page.locator('.material-drawer summary').click();
      await page.locator('[data-tex="water"]').click();
      await page.locator('#genBtn').click();
      await page.locator('#holdBtn').dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch',bubbles:true});
      await page.waitForTimeout(150);
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      if(await page.locator('#holdBtn').evaluate(el=>el.classList.contains('held')))throw new Error('HOLD stuck after blur');
      await page.screenshot({path:'smoke-'+viewport.width+'.png',fullPage:true});
      if(errors.length)throw new Error('JS exceptions: '+errors.join(' | '));
      console.log('PASS browser smoke '+viewport.width+'x'+viewport.height);
      await page.close();
    }
  } catch(e){failed=true; console.error(e);} finally {await browser.close();}
  if(failed)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
