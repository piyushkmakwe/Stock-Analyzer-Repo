const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/pdf-test.js','utf8');
const MOCK = eval('(' + src.match(/const MOCK = (\{[\s\S]*?\n\});/)[1] + ')');

// A fixture mirroring Screener.in's statement markup
const SCREENER_FIXTURE = `
<html><body>
<section id="quarters">
<table class="data-table"><thead><tr><th class="text"></th><th>Sep 2025</th><th>Dec 2025</th><th>Mar 2026</th><th>Jun 2026</th></tr></thead>
<tbody>
<tr><td class="text">Sales&nbsp;<button>+</button></td><td>1,010</td><td>1,080</td><td>1,150</td><td>1,210</td></tr>
<tr><td class="text">Net Profit&nbsp;<button>+</button></td><td>81</td><td>88</td><td>95</td><td>99</td></tr>
</tbody></table>
</section>
<section id="profit-loss">
<table class="data-table"><thead><tr><th class="text"></th><th>Mar 2022</th><th>Mar 2023</th><th>Mar 2024</th><th>Mar 2025</th><th>Mar 2026</th><th>TTM</th></tr></thead>
<tbody>
<tr><td class="text">Sales&nbsp;<button>+</button></td><td>2,100</td><td>2,650</td><td>3,200</td><td>3,800</td><td>4,200</td><td>4,450</td></tr>
<tr><td class="text">OPM %</td><td>16%</td><td>18%</td><td>18%</td><td>19%</td><td>19%</td><td>19%</td></tr>
<tr><td class="text">Net Profit&nbsp;<button>+</button></td><td>150</td><td>205</td><td>260</td><td>300</td><td>340</td><td>363</td></tr>
</tbody></table>
</section>
<section id="balance-sheet">
<table class="data-table"><thead><tr><th class="text"></th><th>Mar 2025</th><th>Mar 2026</th></tr></thead>
<tbody>
<tr><td class="text">Equity Capital</td><td>73</td><td>73</td></tr>
<tr><td class="text">Reserves</td><td>2,430</td><td>2,727</td></tr>
<tr><td class="text">Borrowings&nbsp;<button>+</button></td><td>1,350</td><td>1,200</td></tr>
</tbody></table>
</section>
<section id="shareholding">
<table class="data-table"><thead><tr><th class="text"></th><th>Mar 2026</th><th>Jun 2026</th></tr></thead>
<tbody>
<tr><td class="text">Promoters&nbsp;<button>+</button></td><td>62.8%</td><td>62.5%</td></tr>
<tr><td class="text">FIIs&nbsp;<button>+</button></td><td>18.1%</td><td>18.5%</td></tr>
<tr><td class="text">DIIs&nbsp;<button>+</button></td><td>11.8%</td><td>12.0%</td></tr>
</tbody></table>
</section>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate(({mock, fixture}) => {
    const out = {};

    // ── A. Screener deep parsers on the fixture ──
    const hist = parseScreenerHistory(fixture);
    out.hist = hist;
    out.quarters = parseScreenerQuarters(fixture);
    out.balance = parseScreenerBalance(fixture);
    out.share = parseScreenerShareholding(fixture);

    // ── B. Consistency validator: clean data should pass ──
    const clean = JSON.parse(JSON.stringify(mock));
    clean.pe_ratio = +(clean.current_price/clean.eps_ttm).toFixed(1);          // make identities exact
    clean.market_cap_cr = +(clean.current_price*clean.shares_outstanding_cr).toFixed(0);
    clean.pb_ratio = +(clean.current_price/clean.book_value_per_share).toFixed(2);
    clean.revenue_cagr_3yr_pct = 18.9;  // implied by history 2650→4200 over 3y? compute: (4200/2650)^(1/3)-1 = 16.6% → set 16.6
    clean.revenue_cagr_3yr_pct = 16.6;
    clean.profit_cagr_3yr_pct = 18.4;   // (340/205)^(1/3)-1 = 18.4%
    clean.net_margin_pct = +(340/4200*100).toFixed(1);
    clean.operating_margin_pct = 19;
    clean.piotroski_data.net_income_cr = 340;
    clean.piotroski_data.total_assets_cr = 5400;
    clean.forensic_data.total_assets_cr = 5400;
    clean.eps_ttm = +(340/clean.shares_outstanding_cr).toFixed(2);
    clean.pe_ratio = +(clean.current_price/clean.eps_ttm).toFixed(1);
    const dqClean = validateDataConsistency(clean);
    out.clean = { failed: dqClean.failed, warned: dqClean.warned, ran: dqClean.ran };

    // ── C. Corrupted data should be caught ──
    const bad = JSON.parse(JSON.stringify(clean));
    bad.pe_ratio = 55;                        // contradicts price/eps
    bad.revenue_cagr_3yr_pct = 45;            // contradicts history
    bad.current_price = bad.fifty_two_week_high * 1.4;  // outside 52wk range
    const dqBad = validateDataConsistency(bad);
    out.bad = { failed: dqBad.failed, warned: dqBad.warned,
      names: dqBad.checks.filter(c=>!c.ok).map(c=>c.name) };

    // ── D. Confidence: clean+verified vs bad+unverified ──
    clean._provenance = { fields: new Array(14).fill('x'), sources:['Screener.in'], asOf:'today' };
    const confGood = deriveConfidence(clean, dqClean, {wide:false, ratio:1.5});
    delete bad._provenance;
    const confBad = deriveConfidence(bad, dqBad, {wide:true, ratio:3.4});
    out.confGood = { level: confGood.level, score: confGood.score };
    out.confBad = { level: confBad.level, score: confBad.score, nReasons: confBad.reasons.length };

    // ── E. applyVerifiedData with structured history ──
    const d2 = JSON.parse(JSON.stringify(mock));
    const applied = applyVerifiedData(d2, { fields: { current_price: 1300 },
      structured: { financial_history: hist, quarterly_results: parseScreenerQuarters(fixture) }, asOf: 'today' });
    out.applied = applied;
    out.d2hist = d2.financial_history.revenue_cr;
    out.d2q = d2.quarterly_results.length;

    // ── F. Full render with dq card ──
    rawData = mock; renderReport(mock); document.getElementById('report').style.display='block';
    const txt = document.getElementById('report').textContent;
    out.ui_dqCard = txt.includes('Data Quality — how much should you trust this run?');
    out.ui_checks = txt.includes('consistency checks');
    return out;
  }, {mock: MOCK, fixture: SCREENER_FIXTURE});

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');

  const ok =
    // parser
    res.hist && res.hist.years.length===5 && res.hist.revenue_cr[4]===4200 && res.hist.pat_cr[0]===150 && res.hist.opm_pct[4]===19
    && res.quarters && res.quarters.length===4 && res.quarters[0].revenue_cr===1210
    && res.balance && res.balance.total_debt_cr===1200 && Math.abs(res.balance.debt_to_equity-0.43)<0.01
    && res.share && res.share.promoter_holding_pct===62.5 && res.share.fii_holding_pct===18.5
    // validator
    && res.clean.failed===0
    && res.bad.failed>=3
    // confidence
    && res.confGood.level==='HIGH' && res.confBad.level==='LOW'
    // structured apply
    && res.applied.includes('financial_history') && res.applied.includes('quarterly_results')
    && res.d2hist[4]===4200 && res.d2q===4
    // UI
    && res.ui_dqCard && res.ui_checks
    && errs.length===0;

  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
