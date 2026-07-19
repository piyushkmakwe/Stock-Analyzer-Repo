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
    localStorage.removeItem('mb_ledger_v1');
    localStorage.removeItem('mb_store_v1');
    const out = {};
    const d = JSON.parse(JSON.stringify(mock));

    // 1. a full analysis records exactly one call + one observation
    renderReport(d);                 // sets d._lastRating via computeAnalysis
    ledgerRecordCall(d);
    let l = ledgerLoad();
    out.callRecorded = l.calls.length === 1 && l.obs.length === 1 &&
      l.calls[0].key === 'TESTMFG' && l.calls[0].price === 1250 &&
      l.calls[0].t1y != null && typeof l.calls[0].rating === 'string';

    // 2. reopening from the library records nothing
    storeAnalysis(d);
    openAnalysis('TESTMFG');
    l = ledgerLoad();
    out.reopenSilent = l.calls.length === 1 && l.obs.length === 1;

    // 3. price observations accrue and evaluate the call
    ledgerRecordPrice('TESTMFG', 1400);
    l = ledgerLoad();
    out.obsRecorded = l.obs.length === 2;

    // 4. backdate the call 90 days → return, annualised & aggregates appear
    l = ledgerLoad();
    l.calls[0].t -= 90*86400000;
    l.obs[0].t   -= 90*86400000;
    ledgerSave(l); renderTrackRecord();
    const txt = document.getElementById('ledger').textContent;
    out.panelVisible = document.getElementById('ledger').style.display !== 'none';
    out.showsReturn = txt.includes('+12.0%');                    // 1250→1400
    out.showsAgg = txt.includes('By rating band') && txt.includes('1/1 positive');
    out.honesty = txt.includes('compare against what the Nifty did');
    out.immutableNote = txt.includes('cannot be edited, only exported');

    // 5. latest-observation logic picks the newest
    ledgerRecordPrice('TESTMFG', 1100);
    const o = ledgerLatestObs(ledgerLoad(), 'TESTMFG', 0);
    out.latestWins = o.price === 1100;
    return out;
  }, MOCK);

  // 6. export downloads a JSON with the call
  const dl = page.waitForEvent('download');
  await page.evaluate(() => exportLedger());
  const download = await dl;
  const path = __dirname + '/output/ledger-backup.json';
  await download.saveAs(path);
  const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  res.exportOk = Array.isArray(backup.calls) && backup.calls.length === 1 && backup.calls[0].key === 'TESTMFG';

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
