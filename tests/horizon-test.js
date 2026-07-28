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
  await page.goto(process.env.MB_URL || 'http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate((mock) => {
    localStorage.removeItem('mb_ledger_v1');
    const out = {};
    const d = JSON.parse(JSON.stringify(mock));
    const A = computeAnalysis(d);

    // shape: exactly 1Y / 2Y / 5Y with valid ratings + numeric returns
    out.shape = A.horizons && A.horizons.length === 3 &&
      A.horizons.map(h=>h.k).join(',') === '1Y,2Y,5Y' &&
      A.horizons.every(h => ['STRONG BUY','BUY','HOLD','AVOID'].includes(h.rating) && isFinite(h.annRet));

    // invariant: the 5Y horizon call IS the headline rating (same EV, bands, ceiling)
    out.fiveYMatchesHeadline = A.horizons[2].rating === A.rating;

    // guardrail ceiling caps every horizon: manipulation profile → all ≤ HOLD
    const manip = JSON.parse(JSON.stringify(mock));
    manip.beneish_data = {
      receivables_t: 400, receivables_p: 100, sales_t: 1000, sales_p: 900,
      cogs_t: 700, cogs_p: 500, current_assets_t: 500, current_assets_p: 450,
      ppe_t: 300, ppe_p: 280, total_assets_t: 1000, total_assets_p: 900,
      depreciation_t: 40, depreciation_p: 50, sga_t: 100, sga_p: 80,
      current_liab_t: 300, current_liab_p: 270, ltd_t: 200, ltd_p: 180,
      net_income_t: 150, cfo_t: 20 };
    const AM = computeAnalysis(manip);
    const ORDER = ['AVOID','HOLD','BUY','STRONG BUY'];
    out.ceilingCapsAll = AM.horizons.every(h => ORDER.indexOf(h.rating) <= ORDER.indexOf('HOLD'));

    // UI: horizon strip with FOCUS tags + ladder Call column
    rawData = d; renderReport(d); document.getElementById('report').style.display='block';
    const txt = document.getElementById('report').textContent;
    out.uiStrip = txt.includes('Horizon calls — same engine, three holding periods');
    out.uiFocus = txt.includes('FOCUS');
    out.uiNote = txt.includes('1Y & 2Y are the actionable calls');
    out.uiLadderCall = document.getElementById('report').innerHTML.includes('<th>Call</th>');

    // ledger records the horizon calls
    ledgerRecordCall(d);
    const call = ledgerLoad().calls[0];
    out.ledgerHorizons = typeof call.r1y === 'string' && typeof call.r2y === 'string';
    return out;
  }, MOCK);

  // PDF carries the horizon boxes + trail line
  const popupP = ctx.waitForEvent('page');
  await page.evaluate(() => generatePDFReport());
  const popup = await popupP;
  await popup.waitForLoadState('load').catch(()=>{});
  await popup.evaluate(() => { window.print = () => {}; });
  await popup.waitForTimeout(400);
  const ptxt = await popup.evaluate(() => document.body.innerText);
  res.pdfBoxes = ptxt.includes('1Y call') && ptxt.includes('2Y call');
  res.pdfTrail = ptxt.includes('Horizon calls:');

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
