# Automated tests

Headless-browser (Playwright) tests that exercise the real `index.html` —
no test framework, just Node scripts that load the page, drive it, and
assert on the result. Each is self-contained and exits non-zero on failure.

| File | What it checks |
|---|---|
| `smoke-test.js` | Page loads with no JS errors; `esc()` escaping works; feeding every text field an XSS payload (`<img onerror=...>`) through `renderReport()` never executes it — the payload must appear as literal, visible text. |
| `engine-test.js` | Rating-engine guardrails: a manipulation-flagged mock gets capped to HOLD, a distressed mock to AVOID; the growth formula and per-sector WACC compute exactly. |
| `pdf-test.js` | The PDF popup opens, contains all five report sections and 24+ chart bars, and the browser's print engine can actually turn it into a real, non-trivial-sized PDF. |
| `qual-test.js` | Qualitative pillars (product quality, demand, growth strategy, geopolitics), the six-pillar composite weights, and per-headline business-impact chips all compute and render in both the UI and PDF. |
| `accuracy-test.js` | The Screener statement parsers against a fixture page; the 15-point consistency validator (passes clean data, catches injected errors); confidence swinging HIGH→LOW accordingly; verified history/quarterlies overriding AI data. |
| `why-test.js` | The rating-rationale card: all six decision steps and the algorithm reference render in the UI, and the condensed six-line trail renders in the PDF. |

## Prerequisites (once)

```bash
npm install playwright
```

Playwright's bundled Chromium download isn't required if you already have
a `PLAYWRIGHT_BROWSERS_PATH` configured; otherwise let the install fetch it.

## Running everything

```bash
# Terminal 1, from the repo root:
python3 -m http.server 8000

# Terminal 2:
cd tests
./run-all.sh
```

## Running one test

```bash
cd tests
node smoke-test.js
```

Override the URL if you're serving from a different port or testing a
deployed copy (e.g. your GitHub Pages URL):

```bash
MB_URL=https://youruser.github.io/Stock-Analyzer-Repo/ node smoke-test.js
```

## After changing index.html

Run the full suite before committing. If you add a new feature to the
calculation engine or a new report section, add a check for it to the
relevant test (or a new test file) rather than only eyeballing it —
that's what catches the next regression.
