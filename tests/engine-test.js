const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const results = await page.evaluate(() => {
    const healthy = () => ({
      stock_name: 'Test Manufacturing Ltd', ticker: 'TEST', business_type: 'MANUFACTURING',
      current_price: 1250, eps_ttm: 45.2, book_value_per_share: 185.5, dividend_per_share: 5,
      market_cap_cr: 45000, shares_outstanding_cr: 36.5, ebitda_cr: 800,
      total_debt_cr: 1200, cash_cr: 400,
      revenue_cagr_3yr_pct: 28.5, profit_cagr_3yr_pct: 35, eps_cagr_3yr_pct: 32,
      operating_margin_pct: 18.5, net_margin_pct: 11.5, roe_pct: 24, roce_pct: 28.5,
      debt_to_equity: 0.45, current_ratio: 1.85, interest_coverage: 9.5,
      pe_ratio: 28.5, pb_ratio: 4.2, ev_ebitda: 18.5,
      sector_pe_avg: 32, sector_pb_avg: 5, sector_ev_ebitda_avg: 22,
      promoter_holding_pct: 62.5, promoter_pledge_pct: 2.1,
      sector_tailwind_score: 85, management_track_record_score: 78,
      competitive_position_score: 68, government_support_score: 88,
      business_scalability_score: 80,
      sector_specific_data: { MANUFACTURING: { capacity_util_pct: 78, working_capital_days: 49 } },
    });

    // run the same pipeline renderReport uses, returning rating + caps
    const rate = (d) => {
      d._g = estimateGrowth(d);
      d.sd = d.sector_specific_data?.[d.business_type] || {};
      const cfg = getSectorConfig(d);
      const w = calcWACC(d); d._wacc = w ? w.wacc : (cfg.wacc || WACC);
      const dcf = calcDCF(d), graham = calcGraham(d), lynch = calcLynch(d), ev = calcEV(d);
      const fv = calcFV(d, dcf, graham, lynch, ev);
      const scen = calcScenarios(d);
      const peg = calcPEG(d.pe_ratio, d.profit_cagr_3yr_pct || d.eps_cagr_3yr_pct);
      const sc = calcScores(d, peg);
      const revDCF = calcReverseDCF(d);
      const altman = calcAltmanZ(d), beneish = calcBeneishM(d);
      const score5y = scen && d.current_price ? Math.min(5, Math.max(1, scen.base5 / d.current_price)) : 2.0;
      const { r, c, caps } = deriveRating(score5y, sc.composite, d, { beneish, altman, revDCF, fv });
      return { rating: r, conf: c, caps: (caps||[]).map(x => `${x.from}->${x.to}`),
               score5y: +score5y.toFixed(2), fv: fv && +fv.toFixed(0),
               g: +(d._g*100).toFixed(1), wacc: d._wacc, dcfWACC: dcf && dcf.usedWACC,
               beneishFlag: beneish && beneish.flag, altmanZone: altman && altman.zone,
               revImplied: revDCF && revDCF.implied!=null ? +(revDCF.implied*100).toFixed(1) : null };
    };

    const out = {};

    // 1. baseline healthy company
    out.healthy = rate(healthy());

    // 2. same company, Beneish manipulation profile
    const manip = healthy();
    manip.beneish_data = {
      receivables_t: 400, receivables_p: 100, sales_t: 1000, sales_p: 900,
      cogs_t: 700, cogs_p: 500, current_assets_t: 500, current_assets_p: 450,
      ppe_t: 300, ppe_p: 280, total_assets_t: 1000, total_assets_p: 900,
      depreciation_t: 40, depreciation_p: 50, sga_t: 100, sga_p: 80,
      current_liab_t: 300, current_liab_p: 270, ltd_t: 200, ltd_p: 180,
      net_income_t: 150, cfo_t: 20
    };
    out.manipulation = rate(manip);

    // 3. same company, Altman distress balance sheet
    const distress = healthy();
    distress.forensic_data = {
      working_capital_cr: -500, retained_earnings_cr: -100, ebit_cr: -50,
      total_assets_cr: 1000, total_liabilities_cr: 900, sales_cr: 800, book_equity_cr: 100
    };
    out.distress = rate(distress);

    // 4. wildly overpriced (same fundamentals, 3x the price)
    const rich = healthy();
    rich.current_price = 3750;
    out.overpriced = rate(rich);

    // 5. growth formula now uses ROE (was ROCE)
    out.growthFormula = {
      got: calcFundamentalGrowth({ eps_ttm: 10, dividend_per_share: 0, roe_pct: 20, roce_pct: 30 }),
      want: 0.20
    };

    // 6. sector WACC flows into the main DCF (ENERGY_POWER = 10%)
    const en = { business_type: 'ENERGY_POWER', eps_ttm: 10, _g: 0.15, sector_pe_avg: 20 };
    out.energyDCF = { usedWACC: calcDCF(en).usedWACC, want: 0.10 };

    // 7. guardrail box renders in the report
    renderReport(manip);
    out.capBoxShown = document.getElementById('report').textContent.includes('Rating capped by guardrails');

    return out;
  });

  console.log(JSON.stringify(results, null, 2));
  console.log('== PAGE ERRORS ==', pageErrors.length ? pageErrors : 'none');

  const ORDER = ['AVOID','HOLD','BUY','STRONG BUY'];
  const le = (a,b) => ORDER.indexOf(a) <= ORDER.indexOf(b);
  const ok =
    ORDER.includes(results.healthy.rating) &&
    results.manipulation.beneishFlag === true && le(results.manipulation.rating,'HOLD') &&
    results.distress.altmanZone === 'Distress' && results.distress.rating === 'AVOID' &&
    le(results.overpriced.rating,'HOLD') &&
    Math.abs(results.growthFormula.got - 0.20) < 1e-9 &&
    Math.abs(results.energyDCF.usedWACC - 0.10) < 1e-9 &&
    results.capBoxShown === true &&
    pageErrors.length === 0;

  console.log(ok ? '\nRESULT: PASS' : '\nRESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
