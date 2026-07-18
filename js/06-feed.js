// ════════════════════════════════════════════════════════
// VERIFIED DATA FEED — structured sources (browser-side)
// Yahoo Finance → live price / 52-week range
// Screener.in   → Indian fundamentals (P/E, BV, ROE, ROCE, MCap…)
// Verified numbers OVERRIDE AI-returned values so identical
// stocks give identical results regardless of AI model, and the
// AI is told to skip searching for them (fewer tokens/quota).
// Uses public CORS proxies when direct fetch is blocked; fails
// soft — if the feed is unreachable, the app runs AI-only.
// ════════════════════════════════════════════════════════
const FEED_TTL_MS = 15*60*1000;   // 15-min cache per stock
const CORS_ROUTES = [
  u => u,                                                        // direct (works if site sends CORS)
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),     // proxy fallback 1
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) // proxy fallback 2
];
async function feedFetch(url, asJson){
  let lastErr;
  for(const wrap of CORS_ROUTES){
    try{
      const r = await fetch(wrap(url));
      if(!r.ok){ lastErr = new Error('HTTP '+r.status); continue; }
      return asJson ? await r.json() : await r.text();
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('all fetch routes failed');
}
function parseINum(s){ if(s==null) return null; const n = parseFloat(String(s).replace(/,/g,'').trim()); return isFinite(n) ? n : null; }

// ── Yahoo: resolve "Waaree Energies" → WAAREEENER.NS, then quote ──
async function yahooQuote(query){
  const s = await feedFetch('https://query1.finance.yahoo.com/v1/finance/search?q='+encodeURIComponent(query)+'&quotesCount=6&newsCount=0', true);
  const q = (s.quotes||[]).find(x=>/\.NS$/.test(x.symbol)) || (s.quotes||[]).find(x=>/\.BO$/.test(x.symbol));
  if(!q) throw new Error('no NSE/BSE listing found on Yahoo');
  const c = await feedFetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(q.symbol)+'?range=1d&interval=1d', true);
  const meta = c.chart?.result?.[0]?.meta;
  if(!meta || meta.regularMarketPrice==null) throw new Error('no quote data');
  return {
    symbol: q.symbol, name: q.shortname || q.longname || query,
    price: meta.regularMarketPrice,
    hi52: meta.fiftyTwoWeekHigh ?? null, lo52: meta.fiftyTwoWeekLow ?? null,
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime*1000).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')
  };
}

// ── Screener.in: resolve company page, parse ratios + full statements ──
async function screenerFundamentals(query){
  const res = await feedFetch('https://www.screener.in/api/company/search/?q='+encodeURIComponent(query), true);
  const hit = Array.isArray(res) ? res[0] : (res.results||[])[0];
  if(!hit || !hit.url) throw new Error('company not found on Screener');
  let html;
  try { html = await feedFetch('https://www.screener.in'+hit.url+'consolidated/', false); }
  catch(_){ html = await feedFetch('https://www.screener.in'+hit.url, false); }
  const out = parseScreenerRatios(html);
  if(!Object.keys(out).length) throw new Error('could not parse Screener ratios');
  // Deep sections — each fails soft so a layout change never kills the feed
  try{ out.history     = parseScreenerHistory(html);     }catch(_){}
  try{ out.quarters    = parseScreenerQuarters(html);    }catch(_){}
  try{ out.balance     = parseScreenerBalance(html);     }catch(_){}
  try{ out.shareholding= parseScreenerShareholding(html);}catch(_){}
  try{ out.cfo_history = parseScreenerCashflow(html);   }catch(_){}
  out._page = hit.url;
  return out;
}

// Generic Screener data-table parser: given the HTML of one <section>,
// returns { headers:[...], rows:{ "Label": [numbers...] } }.
// Screener's statement tables have kept this exact shape for years:
// thead th column labels, tbody rows with a td.text label cell then values.
function parseScreenerTable(sectionHtml){
  const headers = [];
  const thead = /<thead[\s\S]*?<\/thead>/i.exec(sectionHtml);
  if(thead){
    const re = /<th[^>]*>([\s\S]*?)<\/th>/gi; let m;
    while((m = re.exec(thead[0]))) headers.push(m[1].replace(/<[^>]*>/g,'').trim());
  }
  const rows = {};
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi; let tr;
  while((tr = trRe.exec(sectionHtml))){
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi; let td;
    while((td = tdRe.exec(tr[1]))) cells.push(td[1].replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim());
    if(cells.length < 2) continue;
    const label = cells[0].replace(/\s*\+\s*$/,'').trim();
    if(!label) continue;
    rows[label] = cells.slice(1).map(x => parseINum(x.replace(/%/g,'')));
  }
  return { headers, rows };
}
function screenerSection(html, id){
  const m = new RegExp('<section[^>]*id="'+id+'"[\\s\\S]*?<\\/section>','i').exec(html);
  return m ? m[0] : null;
}
const skRow = (rows, ...names) => { for(const n of names){ const k = Object.keys(rows).find(r => r.toLowerCase().startsWith(n.toLowerCase())); if(k) return rows[k]; } return null; };

// Annual P&L: years, revenue, PAT, OPM — the ground truth for growth history
function parseScreenerHistory(html){
  const sec = screenerSection(html, 'profit-loss'); if(!sec) return null;
  const { headers, rows } = parseScreenerTable(sec);
  const sales = skRow(rows,'Sales','Revenue'), pat = skRow(rows,'Net Profit'), opm = skRow(rows,'OPM');
  if(!sales || !pat) return null;
  // headers[0] is the empty label column; drop a trailing TTM column if present
  let years = headers.slice(1);
  let n = years.length;
  if(/TTM/i.test(years[n-1]||'')){ years = years.slice(0,-1); n--; }
  const take = a => a ? a.slice(0, n) : null;
  const last = Math.min(n, 5);                    // most recent 5 FYs
  const sl = arr => arr ? arr.slice(n-last, n) : null;
  const out = {
    years:      sl(years).map(y => y.replace(/^\w+\s+/,'FY').replace(/^FY?20/,'FY')),
    revenue_cr: sl(take(sales)),
    pat_cr:     sl(take(pat)),
    opm_pct:    opm ? sl(take(opm)) : null
  };
  if(!out.revenue_cr || out.revenue_cr.filter(x=>x!=null).length < 3) return null;
  return out;
}

// Latest quarterly Sales / Net Profit (most recent 4)
function parseScreenerQuarters(html){
  const sec = screenerSection(html, 'quarters'); if(!sec) return null;
  const { headers, rows } = parseScreenerTable(sec);
  const sales = skRow(rows,'Sales','Revenue'), pat = skRow(rows,'Net Profit');
  if(!sales || !pat) return null;
  const labels = headers.slice(1);
  const n = Math.min(sales.length, pat.length, labels.length);
  const out = [];
  for(let i = Math.max(0, n-4); i < n; i++){
    if(sales[i]==null && pat[i]==null) continue;
    out.push({ quarter: labels[i], revenue_cr: sales[i], profit_cr: pat[i] });
  }
  return out.length ? out.reverse() : null;   // newest first, like the AI schema
}

// Balance sheet: borrowings + equity → verified debt-to-equity
function parseScreenerBalance(html){
  const sec = screenerSection(html, 'balance-sheet'); if(!sec) return null;
  const { rows } = parseScreenerTable(sec);
  const borrow = skRow(rows,'Borrowings'), eqCap = skRow(rows,'Equity Capital'), res = skRow(rows,'Reserves');
  if(!borrow || !eqCap) return null;
  const lastOf = a => { for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return a[i]; return null; };
  const debt = lastOf(borrow), ec = lastOf(eqCap), rv = res ? lastOf(res) : 0;
  if(debt==null || ec==null) return null;
  const equity = ec + (rv||0);
  return { total_debt_cr: debt, book_equity_cr: equity, debt_to_equity: equity>0 ? +(debt/equity).toFixed(2) : null };
}

// Shareholding: promoter / FII / DII — latest quarter PLUS the promoter
// history, because a steadily falling promoter stake is one of the
// strongest real-world warning signs in Indian markets.
function parseScreenerShareholding(html){
  const sec = screenerSection(html, 'shareholding'); if(!sec) return null;
  const { headers, rows } = parseScreenerTable(sec);
  const lastOf = a => { if(!a) return null; for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return a[i]; return null; };
  const promSeries = (skRow(rows,'Promoters')||[]).filter(x=>x!=null);
  const out = {
    promoter_holding_pct: lastOf(skRow(rows,'Promoters')),
    fii_holding_pct:      lastOf(skRow(rows,'FIIs')),
    dii_holding_pct:      lastOf(skRow(rows,'DIIs')),
    promoter_history:     promSeries.length>=2 ? promSeries.slice(-8) : null,
    promoter_quarters:    headers.slice(1).slice(-8)
  };
  return (out.promoter_holding_pct!=null) ? out : null;
}

// Cash-flow statement: operating cash flow history — for the cumulative
// cash-conversion check (profits that never become cash are suspect).
function parseScreenerCashflow(html){
  const sec = screenerSection(html, 'cash-flow'); if(!sec) return null;
  const { rows } = parseScreenerTable(sec);
  const cfo = skRow(rows,'Cash from Operating Activity','Cash from Operating');
  if(!cfo) return null;
  const clean = cfo.filter(x=>x!=null);
  return clean.length>=3 ? clean.slice(-5) : null;
}
// Two-stage parser: anchored to Screener's name/number spans, with a
// loose label-proximity fallback so minor layout changes don't kill it.
function parseScreenerRatios(html){
  const grab = (label) => {
    let m = new RegExp('name">\\s*'+label+'[\\s\\S]{0,400}?number">([\\d,.]+)','i').exec(html);
    if(m) return parseINum(m[1]);
    m = new RegExp(label+'[\\s\\S]{0,250}?([\\d]{1,3}(?:,[\\d]{2,3})*(?:\\.\\d+)?)','i').exec(html);
    return m ? parseINum(m[1]) : null;
  };
  const out = {};
  const mc = grab('Market Cap');        if(mc!=null) out.market_cap_cr = mc;
  const cp = grab('Current Price');     if(cp!=null) out.price = cp;
  const pe = grab('Stock P\\/E');       if(pe!=null) out.pe = pe;
  const bv = grab('Book Value');        if(bv!=null) out.book_value = bv;
  const dy = grab('Dividend Yield');    if(dy!=null) out.dividend_yield_pct = dy;
  const rc = grab('ROCE');              if(rc!=null) out.roce = rc;
  const re = grab('ROE');               if(re!=null) out.roe = re;
  const hl = /High \/ Low[\s\S]{0,400}?number">([\d,.]+)<[\s\S]{0,120}?number">([\d,.]+)/i.exec(html);
  if(hl){ out.hi52 = parseINum(hl[1]); out.lo52 = parseINum(hl[2]); }
  return out;
}

// ── Orchestrate: fetch both sources, derive, cache ──
async function fetchVerifiedData(query, force){
  const ck = 'mbfeed:'+query.toLowerCase().trim();
  if(!force){ try{ const c = JSON.parse(localStorage.getItem(ck)||'null'); if(c && Date.now()-c.t < FEED_TTL_MS) return c.v; }catch(_){} }
  const v = { fields:{}, sources:[], asOf:new Date().toLocaleString('en-IN') };
  let y=null, sc=null;
  try{ y = await yahooQuote(query); v.sources.push('Yahoo Finance'); }catch(_){}
  try{ sc = await screenerFundamentals(query); v.sources.push('Screener.in'); }catch(_){}
  if(!y && !sc) throw new Error('no structured source reachable');
  const F = v.fields;
  const price = (y && y.price) || (sc && sc.price);
  if(price>0) F.current_price = price;
  if(y){ if(y.hi52>0) F.fifty_two_week_high=y.hi52; if(y.lo52>0) F.fifty_two_week_low=y.lo52; v.asOf = y.asOf; v.symbol=y.symbol; }
  if(sc){
    if(F.fifty_two_week_high==null && sc.hi52>0) F.fifty_two_week_high=sc.hi52;
    if(F.fifty_two_week_low==null  && sc.lo52>0) F.fifty_two_week_low=sc.lo52;
    if(sc.market_cap_cr>0) F.market_cap_cr = sc.market_cap_cr;
    if(sc.pe>0)            F.pe_ratio = sc.pe;
    if(sc.book_value>0)    F.book_value_per_share = sc.book_value;
    if(sc.roe!=null && isFinite(sc.roe))  F.roe_pct  = sc.roe;
    if(sc.roce!=null && isFinite(sc.roce)) F.roce_pct = sc.roce;
    // Derivations from verified pairs
    if(F.current_price>0 && sc.pe>0)         F.eps_ttm = +(F.current_price/sc.pe).toFixed(2);
    if(F.current_price>0 && sc.book_value>0) F.pb_ratio = +(F.current_price/sc.book_value).toFixed(2);
    if(sc.market_cap_cr>0 && F.current_price>0) F.shares_outstanding_cr = +(sc.market_cap_cr/F.current_price).toFixed(2);
    if(sc.dividend_yield_pct!=null && F.current_price>0) F.dividend_per_share = +(sc.dividend_yield_pct*F.current_price/100).toFixed(2);

    // Deep-section verification: statements parsed straight from Screener
    if(sc.balance){
      if(sc.balance.total_debt_cr!=null)  F.total_debt_cr  = sc.balance.total_debt_cr;
      if(sc.balance.debt_to_equity!=null) F.debt_to_equity = sc.balance.debt_to_equity;
    }
    if(sc.shareholding){
      for(const k of ['promoter_holding_pct','fii_holding_pct','dii_holding_pct'])
        if(sc.shareholding[k]!=null) F[k] = sc.shareholding[k];
    }
    if(sc.history){
      v.structured = v.structured || {};
      v.structured.financial_history = sc.history;
      // CAGRs recomputed from the verified statement — overrides the AI's claim
      const cagr = (arr, yrs) => {
        const a = (arr||[]).filter(x=>x!=null&&x>0);
        if(a.length < yrs+1) return null;
        const first = a[a.length-1-yrs], lastV = a[a.length-1];
        return first>0 ? +((Math.pow(lastV/first, 1/yrs)-1)*100).toFixed(1) : null;
      };
      const r3 = cagr(sc.history.revenue_cr, 3), p3 = cagr(sc.history.pat_cr, 3);
      if(r3!=null) F.revenue_cagr_3yr_pct = r3;
      if(p3!=null) F.profit_cagr_3yr_pct  = p3;
      const opm = (sc.history.opm_pct||[]).filter(x=>x!=null);
      if(opm.length) F.operating_margin_pct = opm[opm.length-1];
    }
    if(sc.quarters){
      v.structured = v.structured || {};
      v.structured.quarterly_results = sc.quarters;
    }
    if(sc.shareholding && sc.shareholding.promoter_history){
      v.structured = v.structured || {};
      v.structured.promoter_history = sc.shareholding.promoter_history;
      v.structured.promoter_quarters = sc.shareholding.promoter_quarters || [];
    }
    if(sc.cfo_history){
      v.structured = v.structured || {};
      v.structured.cfo_history = sc.cfo_history;
    }
  }
  try{ localStorage.setItem(ck, JSON.stringify({t:Date.now(), v})); }catch(_){}
  return v;
}

// ── Apply: verified values override the AI's JSON ──
function applyVerifiedData(d, v){
  if(!v || !v.fields) return [];
  const applied = [];
  for(const [k,val] of Object.entries(v.fields)){
    if(val==null || !isFinite(val)) continue;
    d[k] = val; applied.push(k);
  }
  // Structured statements: verified history replaces the AI's outright;
  // verified quarterly headline numbers override, AI keeps the highlights.
  const st = v.structured || {};
  if(st.financial_history){
    d.financial_history = { ...st.financial_history };
    applied.push('financial_history');
  }
  if(st.quarterly_results && st.quarterly_results.length){
    const aiQ = d.quarterly_results || [];
    d.quarterly_results = st.quarterly_results.map(q=>{
      const ai = aiQ.find(a=>a && a.quarter && q.quarter && a.quarter.replace(/\s/g,'').toLowerCase().includes(q.quarter.replace(/\s/g,'').toLowerCase().slice(0,6)));
      return {
        quarter: q.quarter,
        revenue_cr: q.revenue_cr, profit_cr: q.profit_cr,
        yoy_growth_pct: (ai && ai.yoy_growth_pct!=null) ? ai.yoy_growth_pct : null,
        highlights: ai ? ai.highlights : null
      };
    });
    applied.push('quarterly_results');
  }
  if(st.promoter_history){
    d._promoterHistory = { series: st.promoter_history, quarters: st.promoter_quarters || [] };
    applied.push('promoter_history');
  }
  if(st.cfo_history){
    d._cfoHistory = st.cfo_history;
    applied.push('cfo_history');
  }
  if(applied.length){ d.price_as_of = v.asOf; }
  return applied;
}
