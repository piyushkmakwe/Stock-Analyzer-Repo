// Realism batch: cyclical EPS normalization, volatility-aware bear case,
// Nifty benchmark in the track-record ledger, refresh-all-prices button.
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

  const res = await page.evaluate(async (mock) => {
    localStorage.removeItem('mb_ledger_v1');
    localStorage.removeItem('mb_store_v1');
    sessionStorage.setItem('mb_unlocked','1');
    window.alert = () => {};
    const out = {};

    // ── P2a: cyclical EPS normalization ──────────────────────
    // Steady MANUFACTURING mock: no normalization, no bear hardening
    const d0 = JSON.parse(JSON.stringify(mock));
    const A0 = computeAnalysis(d0);
    out.baselineUnchanged = A0.epsNorm == null && A0.epsBasis === 'ttm' && A0.bearSev === 1;

    // Same numbers declared MINING_METALS: TTM EPS 45.2 vs mid-cycle
    // avg-margin EPS ≈ 7.8% × 4200 ÷ 36.5 ≈ 8.97 → deviation ≫ 25% → normalize
    const d1 = JSON.parse(JSON.stringify(mock));
    d1.business_type = 'MINING_METALS';
    const A1 = computeAnalysis(d1);
    out.cyclicalNormalizes = A1.epsNorm != null && A1.epsNorm > 8 && A1.epsNorm < 10
      && A1.epsBasis === 'cycle-normalized';
    out.normalizedConservative = A1.scen && A0.scen && A1.scen.base5 < A0.scen.base5;
    // invariants survive normalization: ladder 5Y row === scenario numbers,
    // 5Y horizon call === headline rating
    out.ladderInvariantNormalized = A1.ladder && A1.scen
      && Math.abs(A1.ladder[3].base.px - A1.scen.base5) < 0.01
      && Math.abs(A1.ladder[3].bear.px - A1.scen.bear5) < 0.01
      && Math.abs(A1.ladder[3].bull.px - A1.scen.bull5) < 0.01;
    out.fiveYMatchesHeadline = A1.horizons && A1.horizons[2].rating === A1.rating;
    // TTM already near mid-cycle → leave EPS alone
    const d2 = JSON.parse(JSON.stringify(mock));
    d2.business_type = 'MINING_METALS'; d2.eps_ttm = 9.0;
    out.noNormNearMidCycle = computeAnalysis(d2).epsNorm == null;

    // ── P2b: volatility-aware bear case ──────────────────────
    const d3 = JSON.parse(JSON.stringify(mock));
    d3.financial_history.revenue_cr = [2100, 3600, 2400, 4100, 2900];   // lumpy
    const A3 = computeAnalysis(d3);
    out.lumpyHardensBear = A3.scen && A3.scen.sev >= 1.3
      && A3.scen.bear5 < A0.scen.bear5
      && A3.scen.bPE < (d3.pe_ratio * 0.80) - 1e-9;
    out.lumpyBaseUntouched = A3.scen && Math.abs(A3.scen.base5 - A0.scen.base5) < 0.01;

    // ── P1: Nifty benchmark in the ledger ────────────────────
    fetchNifty = async () => 25000;
    const dc = JSON.parse(JSON.stringify(mock));
    computeAnalysis(dc);
    ledgerRecordCall(dc);
    await new Promise(r => setTimeout(r, 120));       // async bm back-fill
    let L = ledgerLoad();
    out.callHasBenchmark = L.calls.length === 1 && L.calls[0].bm === 25000
      && L.obs[0].bm === 25000;
    ledgerRecordPrice(mbKey(dc), 1300, 25100);        // explicit bm — no fetch
    L = ledgerLoad();
    out.obsExplicitBm = L.obs[L.obs.length-1].price === 1300
      && L.obs[L.obs.length-1].bm === 25100;
    out.uiVsNifty = document.getElementById('ledger').innerHTML.includes('vs Nifty');

    // ── P1: refresh-all-prices over the saved library ────────
    yahooQuote = async () => ({ symbol:'TESTMFG.NS', name:'Test Manufacturing Ltd',
      price: 1400, hi52: 1890, lo52: 780, asOf: 'test' });
    rawData = dc;
    storeAnalysis(dc);
    out.refreshBtnRendered = !!document.getElementById('btn-refresh-all');
    await refreshAllPrices();
    const entry = mbLoadStore().entries[mbKey(dc)];
    L = ledgerLoad();
    const lastObs = L.obs[L.obs.length-1];
    out.refreshUpdatesLibrary = entry && entry.price === 1400
      && entry.data.current_price === 1400;
    out.refreshFeedsLedger = lastObs.price === 1400 && lastObs.bm === 25000;
    return out;
  }, MOCK);

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
