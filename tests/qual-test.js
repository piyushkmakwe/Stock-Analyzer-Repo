const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/pdf-test.js','utf8');
const MOCK = eval('(' + src.match(/const MOCK = (\{[\s\S]*?\n\});/)[1] + ')');

// enrich mock with the new qualitative + news-dimension fields
MOCK.qualitative_assessment = {
  product_quality:  { score: 82, text: 'ISO-certified plants; low field-failure rates vs peers.', evidence: ['ISO 9001','Client audits passed'] },
  market_presence:  { score: 74, text: '#2 EMS player in India.', market_share: '~18% share', reach: 'Pan-India, exports to 12 countries' },
  demand_outlook:   { score: 88, text: 'Electronics demand rising on China+1 and PLI.', drivers: ['China+1 shift','PLI incentives'] },
  growth_strategy:  { score: 76, text: 'Funded capacity expansion with committed client volumes.', strategies: [{strategy:'Chennai plant',credibility:'High',timeline:'FY27'}] },
  geopolitical:     { score: 60, text: 'Import dependence on Chinese components is the main exposure.', factors: ['Component imports from China'] }
};
MOCK.management_profile.trust_score = 81;
MOCK.management_profile.governance_flags = ['None found'];
MOCK.recent_news[0].profitability_impact = 'Positive';
MOCK.recent_news[0].stability_impact = 'Positive';
MOCK.recent_news[0].management_trust_impact = 'Neutral';
MOCK.recent_news[1].profitability_impact = 'Positive';
MOCK.recent_news[1].stability_impact = 'Neutral';
MOCK.recent_news[1].management_trust_impact = 'Positive';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('main: '+e.message));
  await page.goto((process.env.MB_URL || 'http://127.0.0.1:8000/index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = await page.evaluate((mock)=>{
    rawData = mock;
    // pillar scores
    const d = mock;
    d._g = estimateGrowth(d);
    d.sd = d.sector_specific_data?.[d.business_type]||{};
    const peg = calcPEG(d.pe_ratio, d.profit_cagr_3yr_pct);
    const sc = calcScores(d, peg);
    // news dims
    const news = calcNewsImpact(d, 'BUY');
    // weights sum
    const wsum = Object.values(SCORE_WEIGHTS).reduce((a,b)=>a+b,0);
    // full render (interactive)
    renderReport(d); document.getElementById('report').style.display='block';
    const txt = document.getElementById('report').textContent;
    return {
      gScore:+sc.gScore.toFixed(1), qScore:+sc.qScore.toFixed(1), mScore:+sc.mScore.toFixed(1),
      pScore:+sc.pScore.toFixed(1), composite:+sc.composite.toFixed(1), wsum,
      dims:{ profit:news.dims.profit.score, stability:news.dims.stability.score, trust:news.dims.trust.score },
      ui_qualCard: txt.includes('Qualitative Lens'),
      ui_dims: txt.includes('What the news means for the business') && txt.includes('Management trust'),
      ui_pillars: txt.includes('Future Growth (25%)'),
      ui_trust: txt.includes('Trust & Reliability Score'),
      ui_govFlags: txt.includes('Governance Flags')
    };
  }, MOCK);

  // PDF popup contains the new content too
  const popupP = ctx.waitForEvent('page');
  await page.evaluate(()=>generatePDFReport());
  const popup = await popupP;
  await popup.waitForLoadState('load').catch(()=>{});
  await popup.evaluate(()=>{ window.print=()=>{}; });
  await popup.waitForTimeout(400);
  const ptxt = await popup.evaluate(()=>document.body.innerText);
  res.pdf_qual = ptxt.includes('qualitative lens') || ptxt.includes('Product quality');
  res.pdf_dims = ptxt.toLowerCase().includes('profitability:') || ptxt.includes('the news flow reads');
  res.pdf_trust = ptxt.includes('Can you trust the people running it?');
  res.pdf_weights = ptxt.includes('Future Growth 25%');

  console.log(JSON.stringify(res,null,2));
  console.log('ERRORS:', errs.length?errs:'none');
  const ok = Math.abs(res.wsum-1)<1e-9
    && res.gScore>70   // demand 88, strategy 76, tailwind 85, scalability 80, g-scaled → high
    && res.qScore>70   // product 82, market 74, competitive 68
    && res.dims.profit===100 && res.dims.stability>0 && res.dims.trust>0
    && res.ui_qualCard && res.ui_dims && res.ui_pillars && res.ui_trust && res.ui_govFlags
    && res.pdf_qual && res.pdf_dims && res.pdf_trust && res.pdf_weights
    && errs.length===0;
  console.log(ok?'RESULT: PASS':'RESULT: FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
