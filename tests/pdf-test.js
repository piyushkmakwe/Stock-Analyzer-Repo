const { chromium } = require('playwright');

const MOCK = {
  stock_name: 'Test Manufacturing Ltd', ticker: 'TESTMFG', sector: 'Capital Goods',
  sub_sector: 'Electronics EMS', exchange: 'NSE', business_type: 'MANUFACTURING',
  price_as_of: '02 Jul 2026', data_as_of: 'Q4 FY26',
  current_price: 1250, fifty_two_week_high: 1890, fifty_two_week_low: 780,
  market_cap_cr: 45000, shares_outstanding_cr: 36.5, eps_ttm: 45.2,
  book_value_per_share: 185.5, dividend_per_share: 5, ebitda_cr: 800,
  total_debt_cr: 1200, cash_cr: 400,
  revenue_cagr_3yr_pct: 28.5, profit_cagr_3yr_pct: 35, eps_cagr_3yr_pct: 32,
  operating_margin_pct: 18.5, net_margin_pct: 11.5, roe_pct: 24, roce_pct: 28.5,
  debt_to_equity: 0.45, current_ratio: 1.85, interest_coverage: 9.5,
  pe_ratio: 28.5, pb_ratio: 4.2, ev_ebitda: 18.5,
  sector_pe_avg: 32, sector_pb_avg: 5, sector_ev_ebitda_avg: 22,
  promoter_holding_pct: 62.5, promoter_pledge_pct: 2.1, fii_holding_pct: 18.5, dii_holding_pct: 12,
  sector_tailwind_score: 85, management_track_record_score: 78,
  competitive_position_score: 68, government_support_score: 88, business_scalability_score: 80,
  piotroski_data: { net_income_cr: 285, net_income_prior_cr: 210, cfo_cr: 320,
    total_assets_cr: 5400, total_assets_prior_cr: 4800, long_term_debt_cr: 900,
    long_term_debt_prior_cr: 1100, current_ratio: 1.9, current_ratio_prior: 1.7,
    shares_outstanding_cr: 36.5, shares_prior_cr: 36.5, gross_margin_pct: 38,
    gross_margin_prior_pct: 36.5, asset_turnover: 1.8, asset_turnover_prior: 1.7 },
  quant_data: { beta: 1.1, tax_rate_pct: 25, cost_of_debt_pct: 9, capex_cr: 350,
    depreciation_cr: 180, working_capital_change_cr: 60, ebit_cr: 620 },
  forensic_data: { working_capital_cr: 900, retained_earnings_cr: 2100, ebit_cr: 620,
    total_assets_cr: 5400, total_liabilities_cr: 2600, sales_cr: 4200, book_equity_cr: 2800 },
  financial_history: { years: ['FY22','FY23','FY24','FY25','FY26'],
    revenue_cr: [2100,2650,3200,3800,4200], pat_cr: [150,205,260,300,340],
    opm_pct: [16,17.5,18,18.5,19], roce_pct: [18,20,22,24,25] },
  sector_specific_data: { MANUFACTURING: { capacity_util_pct: 78, asset_turnover: 1.8,
    inventory_days: 45, debtor_days: 32, working_capital_days: 49,
    gross_margin_pct: 38, capex_to_rev_pct: 8, order_backlog_months: 8 } },
  business_overview: { description: 'Makes electronics for global brands.',
    key_products: ['TVs','Phones'], revenue_model: 'Contract manufacturing',
    future_plans: ['New plant in Chennai adding 30% capacity by FY27','Entry into automotive electronics'],
    capacity_expansion: '78% utilized; new plant FY27', order_book: '₹8,000 Cr (~14 months of revenue)' },
  management_profile: { key_persons: ['CMD: A. Kumar'], track_record_text: 'Consistent',
    recent_moves: ['Bought back shares'], commentary: 'Strong execution track record.' },
  government_support_detail: { schemes: [{name:'PLI Electronics',benefit:'4-6% incentive on incremental sales',impact:'High'}],
    budget_allocation: '₹17,000 Cr PLI outlay', policy_commentary: 'Strong policy push for local manufacturing.',
    tailwind_strength: 'STRONG' },
  sector_detail: { market_size_current: '$100B', market_size_2030: '$300B',
    cagr_forecast_text: '20% CAGR', penetration_text: 'Low', mega_trends: ['China+1','Make in India'],
    sector_stage: 'Growth', commentary: 'India EMS is scaling rapidly on China+1 tailwinds.' },
  competitors: [
    {name:'Test Manufacturing Ltd',ticker:'TESTMFG',market_cap_cr:45000,pe:28.5,revenue_growth_pct:35,strength:'Scale',is_target:true},
    {name:'Rival One',ticker:'RIV1',market_cap_cr:30000,pe:32,revenue_growth_pct:22,strength:'Brand',is_target:false},
    {name:'Rival Two',ticker:'RIV2',market_cap_cr:22000,pe:35,revenue_growth_pct:30,strength:'Niche',is_target:false},
    {name:'Rival Three',ticker:'RIV3',market_cap_cr:18000,pe:26,revenue_growth_pct:18,strength:'Cost',is_target:false}
  ],
  moat_type: 'Scale', competitive_moat_text: 'Largest capacity in segment.',
  risks: [
    {factor:'Client concentration',severity:'High',mitigation:'Top client 30% of revenue; diversifying'},
    {factor:'Margin pressure',severity:'Medium',mitigation:'PLI incentives cushion margins'},
    {factor:'Currency risk',severity:'Low',mitigation:'Natural hedge via imports'}
  ],
  quarterly_results: [
    {quarter:'Q4 FY26',revenue_cr:1150,profit_cr:95,yoy_growth_pct:32.1,highlights:'Record quarter'},
    {quarter:'Q3 FY26',revenue_cr:1080,profit_cr:88,yoy_growth_pct:28.5,highlights:'New client win'},
    {quarter:'Q2 FY26',revenue_cr:1010,profit_cr:81,yoy_growth_pct:25.2,highlights:'Capacity added'}
  ],
  recent_news: [
    {date:'Jun 2026',headline:'Wins ₹2,000 Cr order from global brand',sentiment:'Positive',impact:'High',horizon:'Long-term',effect:'Adds 4 months of revenue visibility',source:'ET'},
    {date:'May 2026',headline:'Q4 beats estimates',sentiment:'Positive',impact:'Medium',horizon:'Short-term',effect:'Confidence in execution',source:'BS'}
  ],
  news_impact_assessment: { overall_sentiment:'Positive',
    short_term:{outlook:'Positive',rationale:'Order momentum'},
    long_term:{outlook:'Positive',rationale:'Structural EMS growth'},
    key_catalysts:['Chennai plant commissioning Q1 FY27','PLI disbursements'],
    thesis_impact:'Recent wins reinforce the growth thesis.' }
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('main: ' + e.message));
  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // load mock data + render the on-screen report
  await page.evaluate((mock) => { rawData = mock; renderReport(rawData); document.getElementById('report').style.display='block'; }, MOCK);

  // stub window.print in popups so the dialog doesn't block the test
  const popupPromise = ctx.waitForEvent('page');
  await page.evaluate(() => { generatePDFReport(); });
  const popup = await popupPromise;
  popup.on('pageerror', e => errs.push('popup: ' + e.message));
  await popup.waitForLoadState('load').catch(()=>{});
  await popup.evaluate(() => { window.print = () => { window.__printCalled = true; }; });
  await popup.waitForTimeout(700);

  const checks = {};
  checks.title = await popup.title();
  const text = await popup.evaluate(() => document.body.innerText);
  checks.textLength = text.length;
  for (const [k, needle] of Object.entries({
    verdict: 'MultibaggerAI · Equity Research Report'.toUpperCase(),
    section1: 'What is the share actually worth?',
    section2: 'Track record',
    section3: 'Stability',
    section4: 'Future prospects',
    section5: 'What could go wrong',
    plainLang: 'plain words',
    revenueChart: 'Revenue (₹ Cr)',
    piotroski: 'Piotroski',
    altman: 'Altman',
    scenarios: 'Three futures for the share price',
    disclaimer: 'not investment advice',
  })) checks['has_' + k] = text.toUpperCase().includes(String(needle).toUpperCase());

  // chart marks actually rendered?
  checks.barCount = await popup.evaluate(() =>
    [...document.querySelectorAll('div')].filter(el => (el.getAttribute('style')||'').includes('border-radius:4px 4px 0 0')).length);

  // produce an actual PDF via the browser's print engine — proves printability
  const pdfPath = (process.env.SCRATCH || __dirname + '/output') + '/TESTMFG_report.pdf';
  await popup.emulateMedia({ media: 'print' });
  await popup.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  checks.pdfBytes = require('fs').statSync(pdfPath).size;

  await popup.screenshot({ path: (process.env.SCRATCH || __dirname + '/output') + '/pdf-page1.png' });

  console.log(JSON.stringify(checks, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.entries(checks).every(([k,v]) => k.startsWith('has_') ? v === true : true)
    && checks.textLength > 4000 && checks.barCount >= 15 && checks.pdfBytes > 30000 && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
