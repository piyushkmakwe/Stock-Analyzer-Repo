const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  // Flag set by any XSS payload that manages to execute
  await page.addInitScript(() => { window.__xssFired = false; });

  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 1. Basic UI renders ──
  const checks = {};
  checks.headerVisible   = await page.locator('.logo-text').isVisible();
  checks.searchInput     = await page.locator('#stock-input').isVisible();
  checks.providerSelect  = await page.locator('#ai-provider').isVisible();
  checks.analyzeButton   = await page.locator('#abtn').isVisible();
  checks.providerOptions = await page.locator('#ai-provider option').count();
  checks.modelOptions    = await page.locator('#ai-model option').count();

  // ── 2. esc() unit checks in page context ──
  checks.escBasic = await page.evaluate(() =>
    esc('<script>alert(1)<\/script>') === '&lt;script&gt;alert(1)&lt;/script&gt;');
  checks.escQuotes = await page.evaluate(() =>
    esc(`"'&`) === '&quot;&#39;&amp;');
  checks.escNull = await page.evaluate(() => esc(null) === '' && esc(undefined) === '');
  checks.escNumber = await page.evaluate(() => esc(42) === '42');

  // ── 3. Full renderReport() with XSS payloads in every text field ──
  const XSS = `<img src=x onerror="window.__xssFired=true">`;
  const renderResult = await page.evaluate((XSS) => {
    const P = XSS + ' payload';
    const d = {
      stock_name: P, ticker: P, sector: P, sub_sector: P, exchange: P,
      business_type: 'MANUFACTURING',
      price_as_of: P, data_as_of: P,
      current_price: 1250.5, fifty_two_week_high: 1890, fifty_two_week_low: 780,
      market_cap_cr: 45000, shares_outstanding_cr: 36.5, eps_ttm: 45.2,
      book_value_per_share: 185.5, dividend_per_share: 5, ebitda_cr: 800,
      total_debt_cr: 1200, cash_cr: 400,
      revenue_cagr_3yr_pct: 28.5, profit_cagr_3yr_pct: 35, eps_cagr_3yr_pct: 32,
      operating_margin_pct: 18.5, net_margin_pct: 11.5, roe_pct: 24, roce_pct: 28.5,
      debt_to_equity: 0.45, current_ratio: 1.85, interest_coverage: 9.5,
      pe_ratio: 28.5, pb_ratio: 4.2, ev_ebitda: 18.5,
      sector_pe_avg: 32, sector_pb_avg: 5, sector_ev_ebitda_avg: 22,
      promoter_holding_pct: 62.5, promoter_pledge_pct: 2.1,
      fii_holding_pct: 18.5, dii_holding_pct: 12,
      sector_tailwind_score: 85, management_track_record_score: 78,
      competitive_position_score: 68, government_support_score: 88,
      business_scalability_score: 80, low_competition_in_niche: false,
      large_addressable_market: true, margin_expansion_potential: true,
      sector_specific_data: { MANUFACTURING: { capacity_util_pct: 78, asset_turnover: 1.8,
        inventory_days: 45, debtor_days: 32, working_capital_days: 49,
        gross_margin_pct: 38, capex_to_rev_pct: 8, order_backlog_months: 8 } },
      business_overview: { description: P, key_products: [P], revenue_model: P,
        future_plans: [P], capacity_expansion: P, order_book: P },
      management_profile: { key_persons: [P], track_record_text: P,
        recent_moves: [P], commentary: P },
      government_support_detail: { schemes: [{ name: P, benefit: P, impact: P }],
        budget_allocation: P, policy_commentary: P, tailwind_strength: 'STRONG' },
      sector_detail: { market_size_current: P, market_size_2030: P,
        cagr_forecast_text: P, penetration_text: P, mega_trends: [P],
        sector_stage: P, commentary: P },
      competitors: [
        { name: P, ticker: P, market_cap_cr: 45000, pe: 28.5, revenue_growth_pct: 35, strength: P, is_target: true },
        { name: P, ticker: P, market_cap_cr: 30000, pe: 32, revenue_growth_pct: 22, strength: P, is_target: false }
      ],
      moat_type: P, competitive_moat_text: P,
      risks: [{ factor: P, severity: 'High', mitigation: P }],
      quarterly_results: [{ quarter: P, revenue_cr: 3456, profit_cr: 285, yoy_growth_pct: 45.2, highlights: P }],
      recent_news: [{ date: P, headline: P, sentiment: P, impact: P, horizon: P, effect: P, source: P }],
      news_impact_assessment: { overall_sentiment: P,
        short_term: { outlook: P, rationale: P },
        long_term: { outlook: P, rationale: P },
        key_catalysts: [P], thesis_impact: P }
    };
    try {
      renderReport(d);
      document.getElementById('report').style.display = 'block';
      return { rendered: true, error: null };
    } catch (e) {
      return { rendered: false, error: e.message };
    }
  }, XSS);

  await page.waitForTimeout(1200); // give any onerror handler time to fire

  checks.renderOK  = renderResult.rendered;
  checks.renderErr = renderResult.error;
  checks.xssFired  = await page.evaluate(() => window.__xssFired);
  // payload should be VISIBLE as literal text (proof it was escaped, not swallowed)
  checks.payloadShownAsText = await page.evaluate(() =>
    document.getElementById('report').textContent.includes('<img src=x'));
  checks.injectedImgTags = await page.evaluate(() =>
    document.querySelectorAll('#report img[src="x"]').length);

  await page.screenshot({ path: (process.env.SCRATCH || __dirname + '/output') + '/report-render.png', fullPage: false });

  // ── Results ──
  console.log('== CHECKS ==');
  for (const [k, v] of Object.entries(checks)) console.log(`${k}: ${JSON.stringify(v)}`);
  console.log('== CONSOLE ERRORS ==');
  consoleErrors.forEach(e => console.log('  ', e.slice(0, 200)));
  console.log('== PAGE ERRORS ==');
  pageErrors.forEach(e => console.log('  ', e.slice(0, 200)));

  const pass = checks.headerVisible && checks.searchInput && checks.analyzeButton &&
    checks.escBasic && checks.escQuotes && checks.escNull &&
    checks.renderOK && !checks.xssFired && checks.payloadShownAsText &&
    checks.injectedImgTags === 0 && pageErrors.length === 0;
  console.log(pass ? '\nRESULT: PASS' : '\nRESULT: FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
