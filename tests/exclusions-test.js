const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/pdf-test.js','utf8');
const MOCK = eval('(' + src.match(/const MOCK = (\{[\s\S]*?\n\});/)[1] + ')');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.MB_URL || 'http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate((mock) => {
    const out = {};
    const ORDER = ['AVOID','HOLD','BUY','STRONG BUY'];

    // 1. Beneish is N/A for banks — even with manipulation-shaped data supplied
    const bank = JSON.parse(JSON.stringify(mock));
    bank.business_type = 'BANKING_NBFC';
    bank.beneish_data = { receivables_t:400, receivables_p:100, sales_t:1000, sales_p:900,
      cogs_t:700, cogs_p:500, current_assets_t:500, current_assets_p:450, ppe_t:300, ppe_p:280,
      total_assets_t:1000, total_assets_p:900, depreciation_t:40, depreciation_p:50, sga_t:100,
      sga_p:80, current_liab_t:300, current_liab_p:270, ltd_t:200, ltd_p:180, net_income_t:150, cfo_t:20 };
    bank._cfoHistory = [30,40,50,55,60];          // terrible CFO/PAT — must NOT cap a bank
    const AB = computeAnalysis(bank);
    out.bankBeneishNA = AB.beneish && AB.beneish.na === true;
    out.bankCashNA = AB.cashConv && AB.cashConv.na === true;
    out.bankNoFalseCaps = !(AB.caps||[]).some(c=>/manipulation|operating cash/i.test(c.why));
    out.bankAuditLabels = AB.why.guardrails.filter(g=>g.status==='n/a for banks').length >= 2;

    // 2. Altman grey zone: no cap for ENERGY_POWER, still caps MANUFACTURING
    const greyF = { working_capital_cr: -250, retained_earnings_cr: 50, ebit_cr: 10,
      total_assets_cr: 1000, total_liabilities_cr: 900, sales_cr: 800, book_equity_cr: 100 };  // Z'' ≈ 1.96 → Grey
    const power = JSON.parse(JSON.stringify(mock));
    power.business_type = 'ENERGY_POWER'; power.forensic_data = greyF;
    const AP = computeAnalysis(power);
    const mfg = JSON.parse(JSON.stringify(mock));
    mfg.forensic_data = greyF;
    const AM = computeAnalysis(mfg);
    out.greyIsGrey = AP.altman && AP.altman.zone === 'Grey' && AM.altman.zone === 'Grey';
    out.powerNotGreyCapped = !(AP.caps||[]).some(c=>/grey zone/i.test(c.why));
    out.mfgGreyStillWorks = AM.base==null || ORDER.indexOf(AM.rating) <= ORDER.indexOf('BUY');

    // 3. Promoter checklist items N/A for institutionally-owned companies
    const inst = JSON.parse(JSON.stringify(mock));
    inst.promoter_holding_pct = 0; inst.promoter_pledge_pct = 0;
    const AI2 = computeAnalysis(inst);
    const naItems = AI2.cl.filter(x=>x.na);
    out.instNA = naItems.length >= 1 && AI2.clTotal === AI2.cl.length - naItems.length;
    const AN2 = computeAnalysis(JSON.parse(JSON.stringify(mock)));
    out.normalNoNA = AN2.cl.every(x=>!x.na) && AN2.clTotal === AN2.cl.length;

    // 4. Pillar dedup: gScore ignores scalability + g; qScore ignores competitive score
    const pd = JSON.parse(JSON.stringify(mock));
    delete pd.qualitative_assessment;
    pd.sector_tailwind_score = 40; pd.business_scalability_score = 95; pd.competitive_position_score = 95;
    pd._g = 0.25;
    const peg = calcPEG(pd.pe_ratio, 25);
    const scP = calcScores(pd, peg);
    out.gScoreDeduped = Math.abs(scP.gScore - 40) < 0.01;   // only tailwind remains
    out.qScoreDeduped = Math.abs(scP.qScore - 50) < 0.01;   // nothing left → neutral

    // 5. Feed-derived identity checks are skipped
    const dv = JSON.parse(JSON.stringify(mock));
    const ranAll = validateDataConsistency(dv).ran;
    dv._provenance = { fields: ['eps_ttm','pb_ratio','shares_outstanding_cr'], sources: [], asOf: '' };
    const ranSkipped = validateDataConsistency(dv).ran;
    out.identitySkipped = ranSkipped === ranAll - 3;

    // 6. TTM-vs-FY check: 30% gap no longer warns (wide tolerance)
    const tt = JSON.parse(JSON.stringify(mock));
    tt.eps_ttm = (tt.financial_history.pat_cr[4] * 1.30) / tt.shares_outstanding_cr;
    delete tt.pe_ratio;                                    // avoid triggering the P/E identity instead
    const dqT = validateDataConsistency(tt);
    const epsCheck = dqT.checks.find(c=>/EPS×Shares/.test(c.name));
    out.ttmTolerant = epsCheck && epsCheck.ok === true;

    // 7. Confidence: no coverage penalty when statements verified
    const cf = JSON.parse(JSON.stringify(mock));
    delete cf.piotroski_data; delete cf.beneish_data;
    cf._provenance = { fields: ['financial_history'], sources: ['Screener.in'], asOf: '' };
    const c1 = deriveConfidence(cf, {checks:[],failed:0,warned:0,ran:0}, null);
    delete cf._provenance;
    const c2 = deriveConfidence(cf, {checks:[],failed:0,warned:0,ran:0}, null);
    out.coverageNoPenalty = c1.score > c2.score &&
      c1.reasons.some(r=>/no penalty/.test(r));

    // 8. Renamed/threshold checklist items live
    const AM2 = computeAnalysis(JSON.parse(JSON.stringify(mock)));
    out.backlogThreshold = AM2.cl.some(x=>/Order Backlog > 6 Months/.test(x.lbl));
    return out;
  }, MOCK);

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
