const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/pdf-test.js','utf8');
const MOCK = eval('(' + src.match(/const MOCK = (\{[\s\S]*?\n\});/)[1] + ')');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate((mock)=>{
    rawData = mock; renderReport(mock);
    document.getElementById('report').style.display='block';
    const txt = document.getElementById('report').textContent;
    const out = {
      card:  /Why (STRONG BUY|BUY|HOLD|AVOID)\? — The Full Decision Path/.test(txt),
      step1: txt.includes('The growth estimate that everything rests on'),
      step2: txt.includes('The 5-year return score'),
      step3: txt.includes('The composite quality score'),
      step4: txt.includes('Which rating band do those two numbers land in?'),
      step5: txt.includes('Guardrail audit'),
      step6: txt.includes('What would change this call'),
      algos: txt.includes('Every algorithm used in this analysis'),
      bandMarker: txt.includes('◄'),
      guardStatus: /passed|fired|caution/.test(txt)
    };
    return out;
  }, MOCK);

  const popupP = ctx.waitForEvent('page');
  await page.evaluate(()=>generatePDFReport());
  const popup = await popupP;
  await popup.waitForLoadState('load').catch(()=>{});
  await popup.evaluate(()=>{ window.print=()=>{}; });
  await popup.waitForTimeout(400);
  const ptxt = await popup.evaluate(()=>document.body.innerText);
  res.pdf_why   = /Why (STRONG BUY|BUY|HOLD|AVOID), exactly/.test(ptxt);
  res.pdf_steps = ptxt.includes('Band test') && ptxt.includes('Guardrails:') && ptxt.includes('Downgrade trigger');
  res.pdf_math  = ptxt.includes('exit P/E');

  console.log(JSON.stringify(res,null,2));
  console.log('ERRORS:', errs.length?errs:'none');
  const ok = Object.values(res).every(v=>v===true) && errs.length===0;
  console.log(ok?'RESULT: PASS':'RESULT: FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
