const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/pdf-test.js','utf8');
const MOCK = eval('(' + src.match(/const MOCK = (\{[\s\S]*?\n\});/)[1] + ')');

const FIXTURE = `
<html><body>
<section id="shareholding">
<table><thead><tr><th></th><th>Sep 2025</th><th>Dec 2025</th><th>Mar 2026</th><th>Jun 2026</th></tr></thead>
<tbody>
<tr><td class="text">Promoters&nbsp;<button>+</button></td><td>68.0%</td><td>66.2%</td><td>64.9%</td><td>63.4%</td></tr>
<tr><td class="text">FIIs&nbsp;<button>+</button></td><td>12.0%</td><td>13.1%</td><td>14.0%</td><td>15.0%</td></tr>
<tr><td class="text">DIIs&nbsp;<button>+</button></td><td>8.0%</td><td>8.5%</td><td>9.0%</td><td>9.5%</td></tr>
</tbody></table>
</section>
<section id="cash-flow">
<table><thead><tr><th></th><th>Mar 2022</th><th>Mar 2023</th><th>Mar 2024</th><th>Mar 2025</th><th>Mar 2026</th></tr></thead>
<tbody>
<tr><td class="text">Cash from Operating Activity&nbsp;<button>+</button></td><td>60</td><td>75</td><td>90</td><td>110</td><td>120</td></tr>
</tbody></table>
</section>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.MB_URL || 'http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate(({mock, fixture}) => {
    const out = {};

    // ── parsers ──
    const sh = parseScreenerShareholding(fixture);
    out.shHistory = sh && sh.promoter_history && sh.promoter_history.length === 4 &&
      sh.promoter_history[0] === 68 && sh.promoter_history[3] === 63.4;
    const cfo = parseScreenerCashflow(fixture);
    out.cfoParsed = cfo && cfo.length === 5 && cfo[4] === 120;

    // ── calculators ──
    const dSell = { _promoterHistory: { series: sh.promoter_history, quarters: sh.promoter_quarters } };
    const pt = calcPromoterTrend(dSell);
    out.promFlag = pt && pt.flag === true && Math.abs(pt.delta - (-4.6)) < 0.01;
    const dStable = { _promoterHistory: { series: [62.4, 62.5, 62.5, 62.5], quarters: [] } };
    out.promStableOk = calcPromoterTrend(dStable).flag === false;

    // healthy cash conversion: CFO sum 455 vs PAT sum (150+205+260+300+340)=1255? -> use aligned mock history
    const dCash = { _cfoHistory: cfo, financial_history: { pat_cr: [150,205,260,300,340] } };
    const cc = calcCashConversion(dCash);
    out.ccComputed = cc && cc.years === 5 && cc.ratio < 0.6 && cc.flag === true;  // 455/1255 = 0.36 → flag
    const dCashGood = { _cfoHistory: [160,210,270,310,350], financial_history: { pat_cr: [150,205,260,300,340] } };
    out.ccGoodPasses = calcCashConversion(dCashGood).flag === false;

    // ── guardrails cap the rating ──
    const base = JSON.parse(JSON.stringify(mock));
    const rate = (d) => computeAnalysis(d).rating;
    const clean = rate(JSON.parse(JSON.stringify(base)));
    const withSelling = JSON.parse(JSON.stringify(base));
    withSelling._promoterHistory = { series: [68.0, 66.2, 64.9, 63.4], quarters: [] };
    const soldRating = rate(withSelling);
    out.sellingCaps = ['BUY','HOLD','AVOID'].includes(soldRating);
    const withBadCash = JSON.parse(JSON.stringify(base));
    withBadCash._cfoHistory = [30, 40, 50, 55, 60];   // vs PAT 1255 → ratio ~0.19
    const cashRating = rate(withBadCash);
    out.badCashCaps = ['BUY','HOLD','AVOID'].includes(cashRating);
    out.cleanRating = clean;

    // guardrail audit lists the two screens, and the selling screen FIRES
    const A = computeAnalysis(withSelling);
    out.auditListed = A.why.guardrails.some(g=>g.name.includes('Promoter-stake')) &&
                      A.why.guardrails.some(g=>g.name.includes('Cash-conversion'));
    out.sellingFired = A.why.guardrails.find(g=>g.name.includes('Promoter-stake')).status === 'fired';
    // and when the base rating is ABOVE the cap, the cap is recorded with its reason
    const strong = JSON.parse(JSON.stringify(base));
    strong.current_price = 620;                    // cheap entry → base rating rises above BUY
    strong._promoterHistory = { series: [68.0, 66.2, 64.9, 63.4], quarters: [] };
    const AS = computeAnalysis(strong);
    out.capReason = RATING_ORDER.indexOf(AS.base) <= RATING_ORDER.indexOf('BUY') ||
                    (AS.caps||[]).some(c=>/Promoters sold/.test(c.why));

    // render shows promoter trend box
    rawData = withSelling; renderReport(withSelling);
    document.getElementById('report').style.display='block';
    out.uiTrendBox = document.getElementById('report').textContent.includes('Promoter Stake Trend');
    return out;
  }, {mock: MOCK, fixture: FIXTURE});

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = ['shHistory','cfoParsed','promFlag','promStableOk','ccComputed','ccGoodPasses',
              'sellingCaps','badCashCaps','auditListed','sellingFired','capReason','uiTrendBox']
    .every(k => res[k] === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
