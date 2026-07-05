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
  const URL = process.env.MB_URL || 'http://127.0.0.1:8000/index.html';
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const res = {};

  // ── 1. Render + auto-store, as analyze() does ──
  await page.evaluate((mock) => {
    localStorage.removeItem('mb_store_v1');
    rawData = mock;
    rawData._query = 'Test Manufacturing';
    renderReport(rawData);
    storeAnalysis(rawData);
    document.getElementById('report').style.display = 'block';
  }, MOCK);
  res.storedAfterRun = await page.evaluate(() =>
    Object.keys(mbLoadStore().entries).length === 1 &&
    mbLoadStore().entries['TESTMFG'] != null &&
    mbLoadStore().entries['TESTMFG'].rating != null);
  res.shelfVisible = await page.evaluate(() =>
    document.getElementById('shelf').style.display !== 'none' &&
    document.getElementById('shelf').textContent.includes('Test Manufacturing Ltd'));
  res.saveBtn = await page.evaluate(() =>
    document.getElementById('btn-save').textContent.includes('Save analysis'));

  // ── 2. Pin ("save only relevant"), then verify eviction spares it ──
  await page.evaluate(() => saveCurrent());
  res.pinnedLabel = await page.evaluate(() =>
    document.getElementById('btn-save').textContent.includes('Saved'));
  res.evictionSparesPinned = await page.evaluate((mock) => {
    for (let i = 0; i < 10; i++) {
      const d = JSON.parse(JSON.stringify(mock));
      d.ticker = 'FILLER' + i; d.stock_name = 'Filler ' + i;
      storeAnalysis(d);
    }
    const s = mbLoadStore();
    const keys = Object.keys(s.entries);
    return s.entries['TESTMFG'] && s.entries['TESTMFG'].pinned === true &&
      keys.filter(k => !s.entries[k].pinned).length <= 8;
  }, MOCK);

  // ── 3. Survives refresh; reopen costs zero AI calls ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  res.shelfAfterReload = await page.evaluate(() =>
    document.getElementById('shelf').textContent.includes('Test Manufacturing Ltd'));
  await page.evaluate(() => { window.__aiCalled = false; callAI = async () => { window.__aiCalled = true; return '{}'; }; });
  await page.evaluate(() => openAnalysis('TESTMFG'));
  await page.waitForTimeout(400);
  res.reopenRenders = await page.evaluate(() =>
    document.getElementById('report').style.display === 'block' &&
    document.getElementById('report').textContent.includes('Test Manufacturing Ltd'));
  res.reopenBanner = await page.evaluate(() =>
    document.getElementById('report').textContent.includes('Opened from your library'));
  res.reopenNoAI = await page.evaluate(() => window.__aiCalled === false);

  // ── 4. News-only refresh: stub the AI, verify merge + NEW badge + delta ──
  await page.evaluate(() => {
    document.getElementById('api-key').value = 'test-key';
    callAI = async (p, k, m, userMsg, sys) => {
      window.__newsSys = !!(sys && sys.includes('ONLY verified news'));
      window.__newsPrompt = userMsg;
      return JSON.stringify({
        recent_news: [
          { date:'Jun 2026', headline:'Wins ₹2,000 Cr order from global brand', sentiment:'Positive', impact:'High', horizon:'Long-term', effect:'Adds visibility', source:'ET', profitability_impact:'Positive', stability_impact:'Positive', management_trust_impact:'Neutral' },
          { date:'Jul 2026', headline:'Announces new US client win worth $80M', sentiment:'Positive', impact:'High', horizon:'Long-term', effect:'Export expansion', source:'BS', profitability_impact:'Positive', stability_impact:'Positive', management_trust_impact:'Positive' }
        ],
        news_impact_assessment: { overall_sentiment:'Positive',
          short_term:{ outlook:'Positive', rationale:'Order momentum continues' },
          long_term:{ outlook:'Positive', rationale:'Export diversification' },
          key_catalysts:['US client ramp-up'], thesis_impact:'Strengthens the thesis.' }
      });
    };
    return refreshNewsOnly();
  });
  await page.waitForTimeout(600);
  res.newsSysUsed = await page.evaluate(() => window.__newsSys === true);
  res.fundamentalsPreserved = await page.evaluate(() =>
    rawData.revenue_cagr_3yr_pct === 28.5 && rawData.stock_name === 'Test Manufacturing Ltd');
  res.newsReplaced = await page.evaluate(() => rawData.recent_news.length === 2);
  res.newFlagCorrect = await page.evaluate(() =>
    rawData.recent_news[0]._isNew === false && rawData.recent_news[1]._isNew === true);
  res.newBadgeShown = await page.evaluate(() =>
    document.getElementById('report').innerHTML.includes('>NEW<'));
  res.deltaLine = await page.evaluate(() =>
    document.getElementById('report').textContent.includes('News refreshed') &&
    document.getElementById('report').textContent.includes('new headline'));
  res.refreshStored = await page.evaluate(() =>
    mbLoadStore().entries['TESTMFG'].data.recent_news.length === 2);

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
