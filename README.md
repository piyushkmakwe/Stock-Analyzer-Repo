# Multibagger AI — Precision Stock Analyzer

A client-side stock research tool for Indian equities (no build step, no backend — `index.html` plus plain CSS/JS modules under `css/` and `js/`). It combines an
AI web-research layer (Claude or Gemini, with live web/Google search grounding) for
raw fundamentals with a local, deterministic valuation engine — DCF (10-year,
3-phase), Graham Number, Peter Lynch fair value, EV/EBITDA relative valuation,
Piotroski F-Score, Altman Z-Score, Beneish M-Score, reverse-DCF, and sector-aware
checklists for 12 business types (Banking/NBFC, IT Services, Manufacturing, Pharma,
FMCG, Real Estate, Energy, Chemicals, Auto, Telecom, Infrastructure, Diversified).

All valuation math runs locally in the browser — the AI is only asked to fetch raw
numbers and recent news, never to opine or calculate.

## Usage

1. Clone or download the whole repo (the app is `index.html` + `css/` + `js/`), then open `index.html` in a browser (see note on Gemini + `file://` below).
2. Pick a provider (Claude or Gemini) and paste your own API key. The key is used
   directly from your browser to call the provider's API and is never sent
   anywhere else; it is stored only in `localStorage` on your machine for
   convenience (provider/model choice, recent searches, and a 15-minute cache of
   verified market data).
3. Enter a stock name (e.g. "Waaree Energies") and click **Run Analysis**.

### Running with Gemini

Gemini's API rejects `file://` origins with a CORS error. Serve the file locally
instead:

```bash
python -m http.server 8000
# then open http://localhost:8000/index.html
```

Claude works fine when the file is opened directly, since it enables
`anthropic-dangerous-direct-browser-access`.

### Getting an API key

- Claude (Anthropic): https://console.anthropic.com/settings/keys
- Gemini (Google AI Studio): https://aistudio.google.com/apikey

## How it works

- **Data layer**: the app first tries a structured feed (Yahoo Finance for
  price/52-week range, Screener.in for fundamentals) via public CORS proxies, so
  core numbers are identical across AI models. It then asks the selected AI to
  fill in everything else (growth history, sector metrics, quarterly results,
  news) via a strict JSON schema. If the structured feed is unreachable, the app
  falls back to AI-only data — this is visible in the report's provenance banner.
- **Valuation engine**: pure JavaScript, no network calls. Combines DCF (40%),
  Peter Lynch (25%), Graham Number (15%), and EV/EBITDA (20%) into a blended fair
  value, with bear/base/bull 5-year scenarios and a return decomposition
  (earnings growth vs. multiple re-rating).
- **PDF export**: renders a print-optimized report client-side via `html2pdf.js`.

## Security notes

- All AI/web-sourced text (company names, news headlines, business descriptions,
  etc.) is HTML-escaped (`esc()` in `js/02-engine.js`) before being inserted into the
  page, since that text ultimately originates from web search results the AI
  reproduces — without escaping, adversarial content indexed by search could
  execute as HTML/script in your browser.
- API keys are entered client-side and used only for direct calls to the
  provider's official API endpoint. There is no backend and no telemetry.
- The structured data feed proxies requests through third-party public CORS
  proxies (`corsproxy.io`, `allorigins.win`) when a direct fetch is blocked, so
  those services can see the stock names you search for. Disable/adjust
  `CORS_ROUTES` in `js/06-feed.js` if that's not acceptable for your use case.

## Disclaimer

This tool is for educational/research purposes only and is not investment advice.
Verify all figures independently before making investment decisions.

## Code layout

| File | Contents |
|---|---|
| `index.html` | Page markup only — loads the modules below in order |
| `css/styles.css` | All styling |
| `js/00-utils.js` | Shared utilities: HTML escaping, formatters, scaling, JSON extraction |
| `js/01-prompt.js` | Both AI prompts: full research instruction + news-only refresh |
| `js/02-engine.js` | Every calculation, ending in `computeAnalysis(d)` — the single pipeline both renderers consume |
| `js/03-report.js` | On-screen report renderer |
| `js/04-app.js` | PIN gate, analysis library (save/export/import/reminders), app state, loading/error panels |
| `js/05-pdf.js` | Print-native PDF report builder |
| `js/06-feed.js` | Verified data feed (Yahoo / Screener parsers) |
| `js/07-ai.js` | AI provider layer (Claude/Gemini), analyze flow, news-only refresh |

Plain `<script>` files sharing one global scope — load order matters and is
encoded in the filenames. No bundler, no modules, so `file://` usage still works.
Note: splitting files is for maintainability only; it adds no security — all
client-side code is fully visible to every visitor regardless of file layout.
