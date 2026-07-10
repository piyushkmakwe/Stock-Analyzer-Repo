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

  // ── 1. Ladder math ──
  const lad = await page.evaluate((mock) => {
    localStorage.removeItem('mb_store_v1');
    const d = JSON.parse(JSON.stringify(mock));
    d._g = estimateGrowth(d);
    return calcTargetLadder(d);
  }, MOCK);
  res.ladderShape = lad && lad.length === 4 && lad.map(r=>r.k).join(',') === '6M,1Y,2Y,5Y';
  res.ladderMonotonicBase = lad[0].base.px < lad[1].base.px && lad[1].base.px < lad[2].base.px && lad[2].base.px < lad[3].base.px;
  res.ladderOrder = lad.every(r => r.bear.px < r.base.px && r.base.px < r.bull.px);
  res.ladderTerms = lad[0].term==='short' && lad[1].term==='short' && lad[2].term==='long' && lad[3].term==='long';
  // 5Y base must equal the classic scenario base5 (same formula at t=5)
  res.ladder5yMatchesScen = await page.evaluate((mock) => {
    const d = JSON.parse(JSON.stringify(mock));
    d._g = estimateGrowth(d);
    const l = calcTargetLadder(d), s = calcScenarios(d);
    return Math.abs(l[3].base.px - s.base5) < 0.01;
  }, MOCK);
  // near-term base target should be closer to CMP than far targets (no instant re-rating)
  res.ladder6mReasonable = Math.abs(lad[0].base.ret) < Math.abs(lad[3].base.ret);

  // ── 2. UI presence ──
  await page.evaluate((mock) => { rawData = mock; renderReport(mock); storeAnalysis(mock); document.getElementById('report').style.display='block'; }, MOCK);
  const txt = await page.evaluate(() => document.getElementById('report').textContent);
  res.ui_ladderCard = txt.includes('Exit-Point Ladder');
  res.ui_shortTag = txt.includes('SHORT-TERM') && txt.includes('LONG-TERM');
  res.ui_6mBox = txt.includes('6M Target (Base)') && txt.includes('1Y Target (Base)');
  res.ui_honesty = txt.includes('6-month moves are dominated by market mood');

  // ── 3. PDF presence ──
  const popupP = ctx.waitForEvent('page');
  await page.evaluate(() => generatePDFReport());
  const popup = await popupP;
  await popup.waitForLoadState('load').catch(()=>{});
  await popup.evaluate(() => { window.print = () => {}; });
  await popup.waitForTimeout(400);
  const ptxt = await popup.evaluate(() => document.body.innerText);
  res.pdf_ladder = ptxt.includes('Exit-point ladder');
  res.pdf_1yTile = ptxt.toUpperCase().includes('1-YR TARGET');
  await popup.close();

  // ── 4. Export / import roundtrip ──
  const dl = page.waitForEvent('download');
  await page.evaluate(() => exportLibrary());
  const download = await dl;
  const path = __dirname + '/output/lib-backup.json';
  await download.saveAs(path);
  const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  res.exportHasEntry = backup.entries && backup.entries.TESTMFG && backup.entries.TESTMFG.data.stock_name === 'Test Manufacturing Ltd';
  res.importMerges = await page.evaluate((bk) => {
    localStorage.removeItem('mb_store_v1');
    renderShelf();
    // simulate the file-read path directly
    const s = mbLoadStore();
    for(const [k,e] of Object.entries(bk.entries)) s.entries[k] = e;
    mbSaveStore(s); renderShelf();
    return mbLoadStore().entries.TESTMFG != null &&
      document.getElementById('shelf').textContent.includes('Test Manufacturing Ltd');
  }, backup);
  res.shelfButtons = await page.evaluate(() =>
    document.getElementById('shelf').textContent.includes('Export backup') &&
    document.getElementById('shelf').textContent.includes('Import'));

  // ── 5. Quarterly reminder logic ──
  res.checkpointLogic = await page.evaluate(() => {
    const cp = lastResultsCheckpoint();
    const fresh = !needsRerun(Date.now());
    const stale = needsRerun(cp - 10*86400000);  // stored 10 days before the checkpoint
    return cp > 0 && fresh && stale;
  });
  res.staleBadge = await page.evaluate(() => {
    const s = mbLoadStore();
    s.entries.TESTMFG.t = lastResultsCheckpoint() - 10*86400000;
    mbSaveStore(s); renderShelf();
    return document.getElementById('shelf').textContent.includes('re-run advised');
  });
  res.staleBanner = await page.evaluate(() => {
    openAnalysis('TESTMFG');
    return document.getElementById('report').textContent.includes('Quarterly results have likely been published since this analysis');
  });

  // ── 6. Pinned delete needs TWO confirmations ──
  let dialogCount = 0;
  page.on('dialog', async d => { dialogCount++; await d.accept(); });
  await page.evaluate(() => { const s = mbLoadStore(); s.entries.TESTMFG.pinned = true; mbSaveStore(s); });
  await page.evaluate(() => deleteAnalysis('TESTMFG'));
  await page.waitForTimeout(300);
  res.pinnedDoubleConfirm = dialogCount === 2;
  res.deletedAfterConfirm = await page.evaluate(() => mbLoadStore().entries.TESTMFG == null);

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
