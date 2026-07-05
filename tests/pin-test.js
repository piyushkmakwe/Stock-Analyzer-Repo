const { chromium } = require('playwright');

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

  // instrument: AI must never be reached while locked
  await page.evaluate(() => {
    sessionStorage.removeItem('mb_unlocked');
    window.__aiCalled = false;
    callAI = async () => { window.__aiCalled = true; return '{}'; };
    fetchVerifiedData = async () => { throw new Error('offline'); };
    document.getElementById('api-key').value = 'test-key';
    document.getElementById('stock-input').value = 'Test Stock';
  });

  // 1. Starting an analysis opens the PIN modal (and does not call the AI)
  await page.evaluate(() => { analyze(); });
  await page.waitForTimeout(300);
  res.modalShown = await page.locator('#pin-input').isVisible();
  res.noAIWhileLocked = await page.evaluate(() => window.__aiCalled === false);

  // 2. Wrong PIN is rejected, modal stays
  await page.fill('#pin-input', 'WRONG123');
  await page.click('#pin-go');
  await page.waitForTimeout(300);
  res.wrongRejected = await page.evaluate(() =>
    document.querySelector('#pin-err').textContent.includes('Incorrect') &&
    sessionStorage.getItem('mb_unlocked') !== '1');

  // 3. Cancel closes without unlocking or spending tokens
  await page.click('#pin-cancel');
  await page.waitForTimeout(200);
  res.cancelCloses = await page.evaluate(() =>
    !document.querySelector('#pin-input') &&
    sessionStorage.getItem('mb_unlocked') !== '1' &&
    window.__aiCalled === false);

  // 4. First valid PIN unlocks and the analysis proceeds to the AI call
  await page.evaluate(() => { analyze(); });
  await page.waitForTimeout(200);
  await page.fill('#pin-input', 'MS148543');
  await page.click('#pin-go');
  await page.waitForTimeout(600);
  res.pin1Unlocks = await page.evaluate(() =>
    sessionStorage.getItem('mb_unlocked') === '1' && window.__aiCalled === true);

  // 5. Unlock persists for the session — no second prompt
  await page.evaluate(() => { window.__aiCalled = false; analyze(); });
  await page.waitForTimeout(400);
  res.noReprompt = await page.evaluate(() =>
    !document.querySelector('#pin-input') && window.__aiCalled === true);

  // 6. Second valid PIN also works (fresh lock state)
  await page.evaluate(() => { sessionStorage.removeItem('mb_unlocked'); window.__aiCalled = false; analyze(); });
  await page.waitForTimeout(200);
  await page.fill('#pin-input', 'MS134117');
  await page.click('#pin-go');
  await page.waitForTimeout(600);
  res.pin2Unlocks = await page.evaluate(() =>
    sessionStorage.getItem('mb_unlocked') === '1' && window.__aiCalled === true);

  // 7. The PINs themselves do not appear in the page source (only hashes)
  const src = await page.content();
  res.pinsNotInSource = !src.includes('MS148543') && !src.includes('MS134117');

  console.log(JSON.stringify(res, null, 2));
  console.log('ERRORS:', errs.length ? errs : 'none');
  const ok = Object.values(res).every(v => v === true) && errs.length === 0;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
