// ════════════════════════════════════════════════════════
// PDF REPORT — native print pipeline
// buildPrintReport() composes a standalone, light-theme, A4
// print-ready HTML document in plain language with div-based
// charts (no canvas, no external libraries). generatePDFReport()
// opens it in a new tab and triggers the browser print dialog —
// choose "Save as PDF" there.
// The previous html2pdf.js/html2canvas screenshot approach was
// removed: it silently produced blank pages on many machines and
// depended on a CDN script.
// ════════════════════════════════════════════════════════

// ── tiny chart builders (pure divs — reliable in print) ──
const PDF_INK='#0b0b0b', PDF_INK2='#52514e', PDF_MUT='#898781', PDF_GRID='#e1e0d9',
      PDF_BLUE='#2a78d6', PDF_AQUA='#1baf7a',
      PDF_GOOD='#0ca30c', PDF_WARN='#fab219', PDF_SER='#ec835a', PDF_CRIT='#d03b3b',
      PDF_GOODTXT='#006300';

function pdfNum(n,dec=0){ if(n==null||isNaN(n)) return 'N/A'; return n.toLocaleString('en-IN',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
function pdfINR(n,dec=0){ if(n==null||isNaN(n)) return 'N/A'; return '₹'+pdfNum(n,dec); }
function pdfPct(n,dec=1){ return n==null||isNaN(n) ? 'N/A' : n.toFixed(dec)+'%'; }

// Vertical bar panel: one measure, one hue, every bar value-labelled
// (labels double as the contrast relief for the light aqua hue).
function pdfBarPanel(title, sub, labels, values, { color=PDF_BLUE, fmt=pdfNum }={}){
  const pts = labels.map((l,i)=>({ l, v: (values&&values[i]!=null&&!isNaN(values[i]))?+values[i]:null }));
  if(!pts.some(p=>p.v!=null)) return '';
  const max = Math.max(...pts.map(p=>p.v??0), 0.0001);
  const bars = pts.map(p=>`
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:0">
      <div style="font-size:8.5px;font-weight:700;color:${PDF_INK}">${p.v!=null?fmt(p.v):'–'}</div>
      <div style="width:70%;max-width:34px;height:${p.v!=null?Math.max(3,(p.v/max*78)).toFixed(1):0}px;background:${color};border-radius:4px 4px 0 0"></div>
      <div style="font-size:8px;color:${PDF_MUT};border-top:1px solid ${PDF_GRID};width:100%;text-align:center;padding-top:3px">${esc(p.l)}</div>
    </div>`).join('');
  return `
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:10px 12px 8px;background:#fff">
    <div style="font-size:9.5px;font-weight:800;color:${PDF_INK}">${title}</div>
    <div style="font-size:8px;color:${PDF_MUT};margin-bottom:8px">${sub}</div>
    <div style="display:flex;align-items:flex-end;gap:2px;height:110px">${bars}</div>
  </div>`;
}

// Horizontal fair-value bars with a dashed "today's price" reference line.
function pdfValueChart(items, cmp){
  const rows = items.filter(m=>m.val!=null&&m.val>0);
  if(!rows.length || !cmp) return '';
  const max = Math.max(...rows.map(m=>m.val), cmp)*1.12;
  const cmpPct = (cmp/max*100).toFixed(1);
  return `
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:12px 14px;background:#fff">
    <div style="font-size:9.5px;font-weight:800;color:${PDF_INK};margin-bottom:2px">What each model says the share is worth</div>
    <div style="font-size:8px;color:${PDF_MUT};margin-bottom:10px">Bars = model fair value · dashed line = today's price (${pdfINR(cmp)})</div>
    <div style="position:relative">
      <div style="position:absolute;left:${cmpPct}%;top:-4px;bottom:-2px;border-left:2px dashed ${PDF_INK};opacity:0.65;z-index:2"></div>
      <div style="position:absolute;left:${cmpPct}%;top:-14px;transform:translateX(-50%);font-size:7.5px;font-weight:700;color:${PDF_INK};white-space:nowrap;background:#fff;padding:0 3px">CMP</div>
      ${rows.map(m=>{
        const w=(m.val/max*100).toFixed(1);
        const up=(m.val-cmp)/cmp*100;
        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="width:118px;font-size:8.5px;color:${PDF_INK2};text-align:right;flex-shrink:0">${m.nm}</div>
          <div style="flex:1;position:relative;height:14px">
            <div style="position:absolute;left:0;top:0;bottom:0;width:${w}%;background:${PDF_BLUE};border-radius:0 4px 4px 0"></div>
            <div style="position:absolute;left:calc(${w}% + 5px);top:1px;font-size:8.5px;font-weight:700;color:${PDF_INK};white-space:nowrap">${pdfINR(m.val)} <span style="color:${up>=0?PDF_GOODTXT:PDF_CRIT};font-weight:700">(${up>=0?'+':''}${up.toFixed(0)}%)</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// Bear / Base / Bull range strip — every marker carries its own label,
// so the status colors never work alone.
function pdfRangeStrip(scen, cmp){
  if(!scen || !cmp) return '';
  const pts=[
    {l:'Bear',   v:scen.bear5, c:PDF_CRIT},
    {l:'Today',  v:cmp,        c:PDF_INK},
    {l:'Base',   v:scen.base5, c:PDF_BLUE},
    {l:'Bull',   v:scen.bull5, c:PDF_GOOD}
  ];
  const mn=Math.min(...pts.map(p=>p.v))*0.9, mx=Math.max(...pts.map(p=>p.v))*1.06;
  const pp=v=>((v-mn)/(mx-mn)*100).toFixed(1);
  return `
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:30px 18px 30px;background:#fff">
    <div style="height:6px;background:${PDF_GRID};border-radius:3px;position:relative">
      ${pts.map((p,i)=>`
      <div style="position:absolute;left:${pp(p.v)}%;top:-7px;transform:translateX(-50%);width:3px;height:20px;background:${p.c};border-radius:2px">
        <div style="position:absolute;${i%2?'top:-16px':'bottom:-16px'};left:50%;transform:translateX(-50%);font-size:8px;font-weight:800;color:${p.c};white-space:nowrap">${p.l} ${pdfINR(p.v)}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// Stat tile — status colors always paired with a symbol + words.
function pdfTile(label, value, sub, tone){
  const c = tone==='good'?PDF_GOODTXT : tone==='warn'?'#a36f00' : tone==='crit'?PDF_CRIT : PDF_INK;
  const ic = tone==='good'?'✓' : tone==='warn'?'▲' : tone==='crit'?'✕' : '';
  return `
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:9px 11px;background:#fff">
    <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${PDF_MUT};margin-bottom:3px">${label}</div>
    <div style="font-size:13px;font-weight:800;color:${c}">${ic?ic+' ':''}${value}</div>
    ${sub?`<div style="font-size:7.5px;color:${PDF_INK2};margin-top:2px;line-height:1.4">${sub}</div>`:''}
  </div>`;
}

function pdfSection(no, title, intro){
  return `
  <div style="margin:0 0 10px;border-bottom:2px solid ${PDF_INK};padding-bottom:6px">
    <div style="font-size:14px;font-weight:800;color:${PDF_INK}">${no}. ${title}</div>
    ${intro?`<div style="font-size:9px;color:${PDF_INK2};margin-top:3px;line-height:1.55">${intro}</div>`:''}
  </div>`;
}

// ── the report document ──────────────────────────────────
function buildPrintReport(d){
  // Identical analysis to the on-screen report — same shared pipeline.
  const AN = computeAnalysis(d);
  const { cfg, waccObj, dcf, graham, lynch, ev, fv, scen, peg, cl, sc,
          revDCF, altman, beneish, score5y, rating, caps, dq, confObj, conf,
          why, news, ladder, fscore, decomp, trend, passCount } = AN;
  const usedWACC = AN.usedWACC;
  const cmp=d.current_price;
  const genDate=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
  const h=d.financial_history||{};
  const name=esc(d.stock_name)||'—', tick=esc(d.ticker)||'—';

  const ratingTone = rating==='STRONG BUY'||rating==='BUY' ? PDF_GOODTXT : rating==='HOLD' ? '#a36f00' : rating==='INSUFFICIENT DATA' ? PDF_INK2 : PDF_CRIT;

  // ── plain-language building blocks ──
  const mult = scen&&cmp ? scen.base5/cmp : null;
  const verdictWords =
    rating==='INSUFFICIENT DATA' ? `We could not gather enough reliable data to rate ${name} — several core figures were missing. Treat everything in this report as incomplete.` :
    rating==='STRONG BUY' ? `Our models suggest ${name} could roughly ${mult?mult.toFixed(1)+'×':'multiply'} your money over 5 years in the middle-of-the-road case, and the company scores well on quality checks. That combination is rare — hence the strongest rating.` :
    rating==='BUY'  ? `Our models point to meaningful upside over 5 years (base case ${mult?mult.toFixed(2)+'× today’s price':'above today’s price'}), and the company passes most quality checks. Worth serious consideration, with position sizing that respects the risks listed at the end.` :
    rating==='HOLD' ? `The upside our models find is modest, or important warning signs cap our enthusiasm. This is a "watch, don’t chase" situation — the reasons are spelled out below.` :
    `The numbers do not support buying at today’s price: projected returns are weak and/or serious red flags appeared in the health checks below.`;

  const capBlock = caps&&caps.length ? `
    <div style="background:#fff8ec;border:1px solid ${PDF_WARN};border-radius:8px;padding:10px 13px;margin-top:10px">
      <div style="font-size:9px;font-weight:800;color:#a36f00;margin-bottom:4px">▲ WHY THE RATING WAS REDUCED</div>
      ${caps.map(c=>`<div style="font-size:8.5px;color:${PDF_INK2};line-height:1.55;margin-bottom:3px"><strong style="color:#a36f00">${c.from} → ${c.to}:</strong> ${c.why}</div>`).join('')}
      <div style="font-size:8px;color:${PDF_MUT};margin-top:4px">These guardrails only ever lower a rating — a stock must clear every safety screen to keep a bullish verdict.</div>
    </div>` : '';

  // growth explanation
  const growthWords = `The company grew profits about <strong>${pdfPct(d.profit_cagr_3yr_pct)}</strong> a year over the last 3 years. High growth rarely lasts, so we deliberately assume it cools to <strong>${pdfPct(d._g*100)}</strong> a year for the next 5 years (${cfg.name} companies historically keep about ${(cfg.growthReg*100)|0}% of their past pace). We also cross-check that the company can fund this growth itself: it keeps ${d.eps_ttm&&d.dividend_per_share!=null?pdfPct((1-d.dividend_per_share/d.eps_ttm)*100,0):'most'} of its profit in the business, earning ${pdfPct(d.roe_pct)} on shareholders’ money.`;

  // stability verdict sentence
  const stabilityBits=[];
  if(d.debt_to_equity!=null) stabilityBits.push(d.debt_to_equity<0.5?`debt is low (₹${d.debt_to_equity.toFixed(2)} of borrowing per ₹1 of shareholder money)`:d.debt_to_equity<1?`debt is moderate (${d.debt_to_equity.toFixed(2)}× equity)`:`debt is high (${d.debt_to_equity.toFixed(2)}× equity) — a real risk in downturns`);
  if(d.interest_coverage!=null) stabilityBits.push(d.interest_coverage>5?`profits cover interest payments ${d.interest_coverage.toFixed(1)}× over — very comfortable`:`interest cover of ${d.interest_coverage.toFixed(1)}× leaves less breathing room`);
  if(d.promoter_pledge_pct!=null) stabilityBits.push(d.promoter_pledge_pct<5?`promoters have pledged almost none of their shares (${pdfPct(d.promoter_pledge_pct)})`:`promoters have pledged ${pdfPct(d.promoter_pledge_pct)} of their holding — worth watching`);
  const stabilityWords = stabilityBits.length? 'In plain terms: '+stabilityBits.join('; ')+'.' : '';

  const steadyWords = trend&&trend.revR2!=null ?
    (trend.revR2>0.9?`Growth has been remarkably steady (steadiness score ${trend.revR2.toFixed(2)} out of 1) — the kind of predictability long-term investors pay up for.`
    :trend.revR2>0.7?`Growth has been reasonably consistent (steadiness ${trend.revR2.toFixed(2)}/1), with some lumpy years.`
    :`Growth has been lumpy (steadiness ${trend.revR2.toFixed(2)}/1) — future projections deserve extra caution.`) : '';

  const revWords = revDCF&&!revDCF.na&&revDCF.implied!=null ?
    `Working backwards from today’s price: the market is currently paying for about <strong>${pdfPct(revDCF.implied*100)}</strong> yearly profit growth. Our sustainable estimate is <strong>${pdfPct(revDCF.sustainable*100)}</strong>. ${revDCF.implied>revDCF.sustainable*1.25?'The price already assumes better performance than the business has sustainably shown — that leaves little room for disappointment.':revDCF.implied<revDCF.sustainable*0.75?'The market expects less than the company has been delivering — if execution simply continues, patient investors are positioned well.':'Expectations look broadly fair.'}` : '';

  // scenario words
  const scenWords = scen&&cmp ? `If growth disappoints badly (bear case), our models put the share near <strong>${pdfINR(scen.bear5)}</strong> in 5 years. If it broadly delivers (base case): <strong>${pdfINR(scen.base5)}</strong> (${(scen.base5/cmp).toFixed(2)}× today). If everything clicks (bull case): <strong>${pdfINR(scen.bull5)}</strong>. A sensible investor anchors on the base case and treats the bull case as a bonus, not a plan.` : '';

  // model explanations
  const modelRows=[
    {nm:'Discounted Cash Flow (10-yr)', val:dcf?.fairVal, why:'Projects 10 years of earnings, shrinks each year back to today’s value, and applies a 10% safety discount. Best single estimate of what the business itself is worth.'},
    {nm:'Cash-flow DCF (FCFF)', val:(AN.fcfDCF&&AN.fcfDCF.perShare>0)?AN.fcfDCF.perShare:null, why:'The same idea using actual free cash flow after reinvestment — corrects the earnings-DCF’s tendency to overvalue companies that reinvest heavily.'},
    {nm:'Peter Lynch fair value',        val:lynch,        why:'The famous fund manager’s rule of thumb: a fair P/E roughly equals the growth rate. Quick sense-check for growth stocks.'},
    {nm:'Graham Number (floor — not in blend)', val:graham, why:'Benjamin Graham’s conservative floor based on earnings and book value. Growth companies always trade above it, so it is shown as the deep-value anchor but kept OUT of the blended fair value.'},
    {nm:'EV/EBITDA vs sector',           val:ev,           why:'What the share would cost if the company traded at its sector’s average operating-profit multiple.'}
  ];

  // news / catalysts
  const A=d.news_impact_assessment||{};
  const dimTxt = news&&news.dims ? ['profit','stability','trust'].map(k=>{const D=news.dims[k];return D.score==null?null:`${D.name.toLowerCase()}: <strong style="color:${D.score>15?PDF_GOODTXT:D.score<-15?PDF_CRIT:'#a36f00'}">${D.lbl}</strong>`;}).filter(Boolean).join(' · ') : '';
  const newsWords = news ? `Of the ${news.count} recent verified headlines, ${news.pos} were positive, ${news.neg} negative and ${news.neu} neutral. ${dimTxt?`Weighing each story by importance, the news flow reads — ${dimTxt}. `:''}${esc(A.thesis_impact)||news.alignment}` : 'No recent verified news was available for this analysis.';

  // qualitative lens tiles (only dimensions the AI actually assessed)
  const qa = d.qualitative_assessment || {};
  const qaTone = s => s==null?undefined : s>70?'good' : s>45?'warn' : 'crit';
  const qaTiles = [
    ['Product quality',    qa.product_quality],
    ['Market presence',    qa.market_presence],
    ['Demand for products',qa.demand_outlook],
    ['Geopolitical safety',qa.geopolitical]
  ].filter(([,o])=>o&&(o.score!=null||o.text))
   .map(([l,o])=>pdfTile(l, o.score!=null?o.score+'/100':'—', esc(o.text)||'', qaTone(o.score))).join('');
  const stratList = (qa.growth_strategy?.strategies||[]).filter(s=>s&&s.strategy);
  const stratWords = qa.growth_strategy&&(qa.growth_strategy.text||stratList.length)
    ? `${qa.growth_strategy.text?esc(qa.growth_strategy.text)+' ':''}${stratList.length?'Key initiatives: '+stratList.map(s=>`${esc(s.strategy)}${s.timeline?' ('+esc(s.timeline)+')':''}${s.credibility?' — '+esc(s.credibility).toLowerCase()+' credibility':''}`).join('; ')+'.':''}`
    : '';

  // shareholding chart
  const shHold = pdfBarPanel('Who owns the company','% of shares held',
      ['Promoters','FIIs','DIIs','Public'],
      [d.promoter_holding_pct, d.fii_holding_pct, d.dii_holding_pct,
       (d.promoter_holding_pct!=null&&d.fii_holding_pct!=null&&d.dii_holding_pct!=null)?Math.max(0,100-d.promoter_holding_pct-d.fii_holding_pct-d.dii_holding_pct):null],
      { color:PDF_AQUA, fmt:v=>v.toFixed(1)+'%' });

  // ── document ──
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${tick}_MultibaggerAI_Report</title>
<style>
  @page { size: A4; margin: 11mm 11mm 13mm; }
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; color:${PDF_INK}; font-size:9.5px; line-height:1.6; background:#fff; }
  .wrap { max-width:186mm; margin:0 auto; padding:12px 0 30px; }
  .pgbrk { break-before:page; padding-top:6px; }
  p { margin-bottom:7px; color:${PDF_INK2}; }
  strong { color:${PDF_INK}; }
  table { width:100%; border-collapse:collapse; }
  th { font-size:7.5px; text-transform:uppercase; letter-spacing:0.05em; color:${PDF_MUT}; text-align:left; padding:5px 8px; border-bottom:1.5px solid ${PDF_GRID}; }
  td { font-size:8.5px; color:${PDF_INK2}; padding:5px 8px; border-bottom:1px solid ${PDF_GRID}; vertical-align:top; }
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .no-print{position:fixed;top:10px;right:12px;z-index:9}
  @media print { .no-print{display:none} }
</style></head><body>
<div class="no-print"><button onclick="window.print()" style="padding:9px 18px;background:${PDF_BLUE};color:#fff;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">Print / Save as PDF</button></div>
<div class="wrap">

  <!-- ══ COVER / VERDICT ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${PDF_INK};padding-bottom:10px;margin-bottom:12px">
    <div>
      <div style="font-size:8px;font-weight:700;letter-spacing:0.12em;color:${PDF_MUT};text-transform:uppercase">MultibaggerAI · Equity Research Report</div>
      <div style="font-size:21px;font-weight:800;line-height:1.15;margin-top:2px">${name}</div>
      <div style="font-size:9px;color:${PDF_INK2};margin-top:2px">${tick} · ${esc(d.exchange)||'NSE'} · ${esc(d.sector)||'—'} ${d.sub_sector?('· '+esc(d.sub_sector)):''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:8px;color:${PDF_MUT}">Report date</div>
      <div style="font-size:10px;font-weight:700">${genDate}</div>
      <div style="font-size:8px;color:${PDF_MUT};margin-top:4px">Price as of ${esc(d.price_as_of)||genDate}</div>
    </div>
  </div>

  <div style="display:flex;gap:12px;align-items:stretch;margin-bottom:12px">
    <div style="flex:1;border:2px solid ${ratingTone};border-radius:10px;padding:13px 16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="background:${ratingTone};color:#fff;font-size:13px;font-weight:800;padding:5px 15px;border-radius:7px">${rating}</span>
        <span style="font-size:9px;color:${PDF_INK2}">Confidence: <strong>${conf}</strong> · Quality score <strong>${sc.composite.toFixed(0)}/100</strong> · Checklist <strong>${passCount}/10</strong></span>
      </div>
      <p style="font-size:9.5px">${verdictWords}</p>
      ${capBlock}
      ${why?`
      <div style="border-top:1px solid ${PDF_GRID};margin-top:10px;padding-top:9px">
        <div style="font-size:9px;font-weight:800;color:${PDF_INK};margin-bottom:5px">Why ${why.rating}, exactly — the decision trail</div>
        <div style="font-size:8.5px;color:${PDF_INK2};line-height:1.65">
          <strong>1.</strong> Growth assumption: ${why.growth.histCagr!=null?`historical ${pdfPct(why.growth.histCagr)}/yr faded by the sector factor (×${why.growth.reg})`:'sector default'}${why.growth.gFund!=null?`, cross-checked against self-funded growth (retention × ROE = ${pdfPct(why.growth.gFund*100)})`:''} → <strong>${pdfPct(why.growth.g*100)}/yr</strong>.<br>
          ${why.target?`<strong>2.</strong> 5-yr score: base target = EPS ${pdfINR(why.target.eps,2)} × (1+${(why.target.g*100).toFixed(1)}%)⁵ × exit P/E ${why.target.exitPE.toFixed(1)} = ${pdfINR(why.target.base5)}; expected value = 25% bear ${pdfINR(why.target.bear5)} + 50% base + 25% bull ${pdfINR(why.target.bull5)}${why.target.div5?` + dividends ${pdfINR(why.target.div5)}`:''}; ÷ price ${pdfINR(why.target.cmp)} = <strong>score ${why.target.score.toFixed(2)}</strong>.<br>`:''}
          <strong>3.</strong> Composite quality: ${why.pillars.map(p=>`${p.name} ${p.score.toFixed(0)}×${(p.w*100).toFixed(0)}%`).join(' + ')} = <strong>${why.composite.toFixed(0)}/100</strong>.<br>
          <strong>4.</strong> Band test: ${why.base} requires ${why.base==='AVOID'?'— no band was met (HOLD needs score ≥ 1.8 and composite > 44)':`score ≥ ${(RATING_RULES.find(r=>r[0]===why.base)||[])[1]} <strong>(${score5y.toFixed(2)} ${score5y>=((RATING_RULES.find(r=>r[0]===why.base)||[])[1]||0)?'✓':'✗'})</strong> and composite > ${(RATING_RULES.find(r=>r[0]===why.base)||[])[2]} <strong>(${sc.composite.toFixed(0)} ✓)</strong>`}.<br>
          <strong>5.</strong> Guardrails: ${why.guardrails.map(g=>`${g.name.replace(/\s*\(.*\)/,'')} <strong style="color:${g.status==='fired'?PDF_CRIT:g.status==='caution'?'#a36f00':g.status==='passed'?PDF_GOODTXT:PDF_MUT}">${g.status}</strong>`).join(' · ')}${why.base!==why.rating?` — <strong style="color:#a36f00">rating capped ${why.base} → ${why.rating}</strong>`:''}.<br>
          ${why.up?`<strong>Upgrade path:</strong> ${why.up}<br>`:''}
          ${why.down?`<strong>Downgrade trigger:</strong> ${why.down}`:''}
        </div>
      </div>`:''}
    </div>
  </div>

  <div class="g4" style="margin-bottom:12px">
    ${pdfTile("Today's price", pdfINR(cmp))}
    ${pdfTile('1-yr target (base)', ladder?pdfINR(ladder[1].base.px):'N/A', ladder&&cmp?`5-yr base: ${pdfINR(ladder[3].base.px)} (${(ladder[3].base.px/cmp).toFixed(2)}×)`:'' )}
    ${pdfTile('Fair value (blended)', fv?pdfINR(fv):'N/A', fv&&cmp?(cmp<fv?'price is below fair value':'price is above fair value'):'', fv&&cmp?(cmp<fv?'good':'warn'):undefined)}
    ${pdfTile('Market cap', d.market_cap_cr?('₹'+pdfNum(d.market_cap_cr)+' Cr'):'N/A')}
  </div>

  <p style="font-size:8px;color:${PDF_MUT};border:1px solid ${PDF_GRID};border-radius:6px;padding:6px 10px">
    How this report works: an AI researched the raw numbers from public sources${d._provenance&&d._provenance.fields&&d._provenance.fields.length?` (${d._provenance.fields.length} core figures independently verified via ${d._provenance.sources.join(' + ')})`:' (structured feed unavailable — figures are AI-sourced; verify before acting)'}; every calculation, score and rating was then computed by fixed formulas in your browser. No opinion is generated by AI.
    <br><strong style="color:${dq.failed?PDF_CRIT:PDF_INK2}">Data quality: ${confObj.level} (${confObj.score}/100).</strong> ${dq.ran?`${dq.ran} cross-field consistency checks ran — ${dq.failed?`<strong style="color:${PDF_CRIT}">${dq.failed} FAILED</strong> (at least one input figure is wrong; treat affected numbers with caution)`:'none failed'}${dq.warned?`, ${dq.warned} soft mismatch(es)`:''}.`:''} Confidence reflects the trustworthiness of this run's data, not the quality of the company.
  </p>

  <!-- ══ 1. VALUATION ══ -->
  <div class="pgbrk"></div>
  ${pdfSection(1,'What is the share actually worth?','Four independent methods, each answering the question differently. When several point the same way, the signal is stronger than any one of them.')}
  ${pdfValueChart(modelRows, cmp)}
  <table style="margin-top:10px;margin-bottom:10px">
    <tr><th style="width:150px">Method</th><th>What it means in plain words</th><th style="width:70px">Fair value</th></tr>
    ${modelRows.map(m=>`<tr><td style="font-weight:700;color:${PDF_INK}">${m.nm}</td><td>${m.why}</td><td style="font-weight:700;color:${PDF_INK}">${m.val!=null?pdfINR(m.val):'N/A'}</td></tr>`).join('')}
    <tr><td style="font-weight:800;color:${PDF_INK}">Blended fair value</td><td>Weighted mix ${d.business_type==='BANKING_NBFC'?'(banks: price-to-book 60% + Graham 25% + Lynch 15%)':'(EPS-DCF 35% + cash-flow DCF 15% + Lynch 25% + EV/EBITDA 25% — Graham shown as the deep-value floor, not blended)'}</td><td style="font-weight:800;color:${PDF_INK}">${fv?pdfINR(fv):'N/A'}</td></tr>
  </table>
  ${revWords?`<p><strong>The expectations test.</strong> ${revWords}</p>`:''}
  ${decomp?`<p><strong>Where would the return come from?</strong> Of the projected base-case gain, about <strong>${(Math.max(0,Math.min(1,decomp.epsShare))*100).toFixed(0)}%</strong> comes from profits actually growing and <strong>${(Math.max(0,Math.min(1,decomp.reShare))*100).toFixed(0)}%</strong> from hoping the market pays a richer multiple. ${decomp.rerate>1.3?'That is a heavy reliance on market mood — riskier.':'Returns built on real profit growth are the durable kind.'}</p>`:''}

  <!-- ══ 2. TRACK RECORD ══ -->
  <div class="pgbrk"></div>
  ${pdfSection(2,'Track record — has this business actually delivered?','Numbers from the last five financial years. A company that has already done it is a safer bet than one that promises to.')}
  <div class="g2" style="margin-bottom:10px">
    ${pdfBarPanel('Revenue (₹ Cr)','Total sales per financial year', h.years||[], h.revenue_cr||[]) || '<div style="font-size:8.5px;color:'+PDF_MUT+'">5-year revenue history not available.</div>'}
    ${pdfBarPanel('Net profit (₹ Cr)','Profit after tax per financial year', h.years||[], h.pat_cr||[]) || ''}
  </div>
  <div class="g2" style="margin-bottom:10px">
    ${pdfBarPanel('Operating margin (%)','Paise of operating profit per ₹1 of sales', h.years||[], h.opm_pct||[], {color:PDF_AQUA, fmt:v=>v.toFixed(1)+'%'}) || ''}
    ${pdfBarPanel('Return on capital (%)','Efficiency of money employed in the business', h.years||[], h.roce_pct||[], {color:PDF_AQUA, fmt:v=>v.toFixed(1)+'%'}) || ''}
  </div>
  ${steadyWords?`<p>${steadyWords}</p>`:''}
  ${(d.quarterly_results||[]).length?`
  <table style="margin-top:4px">
    <tr><th>Quarter</th><th>Revenue (Cr)</th><th>Profit (Cr)</th><th>Growth vs year ago</th><th>What happened</th></tr>
    ${d.quarterly_results.map(q=>`<tr><td style="font-weight:700;color:${PDF_INK}">${esc(q.quarter)}</td><td>${q.revenue_cr!=null?pdfNum(q.revenue_cr):'N/A'}</td><td>${q.profit_cr!=null?pdfNum(q.profit_cr):'N/A'}</td><td style="color:${(q.yoy_growth_pct||0)>=0?PDF_GOODTXT:PDF_CRIT};font-weight:700">${q.yoy_growth_pct!=null?(q.yoy_growth_pct>=0?'+':'')+q.yoy_growth_pct.toFixed(1)+'%':'N/A'}</td><td>${esc(q.highlights)||'—'}</td></tr>`).join('')}
  </table>`:''}

  <!-- ══ 3. STABILITY ══ -->
  <div class="pgbrk"></div>
  ${pdfSection(3,'Stability — can it survive bad times?','Great returns mean nothing if the company cannot get through a rough patch. These checks look at debt, cash generation and accounting honesty.')}
  <div class="g4" style="margin-bottom:10px">
    ${pdfTile('Debt vs equity', d.debt_to_equity!=null?d.debt_to_equity.toFixed(2)+'×':'N/A', d.debt_to_equity!=null?(d.debt_to_equity<0.5?'low debt':d.debt_to_equity<1?'moderate':'high debt'):'', d.debt_to_equity!=null?(d.debt_to_equity<0.5?'good':d.debt_to_equity<1?'warn':'crit'):undefined)}
    ${pdfTile('Interest cover', d.interest_coverage!=null?d.interest_coverage.toFixed(1)+'×':'N/A', 'profit ÷ interest bill', d.interest_coverage!=null?(d.interest_coverage>5?'good':d.interest_coverage>2?'warn':'crit'):undefined)}
    ${pdfTile('Current ratio', d.current_ratio!=null?d.current_ratio.toFixed(2)+'×':'N/A', 'short-term assets vs bills', d.current_ratio!=null?(d.current_ratio>1.5?'good':d.current_ratio>1?'warn':'crit'):undefined)}
    ${pdfTile('Promoter pledge', pdfPct(d.promoter_pledge_pct), 'shares pledged as loan collateral', d.promoter_pledge_pct!=null?(d.promoter_pledge_pct<5?'good':d.promoter_pledge_pct<15?'warn':'crit'):undefined)}
  </div>
  ${stabilityWords?`<p>${stabilityWords}</p>`:''}
  <div class="g3" style="margin-bottom:10px">
    ${pdfTile('Piotroski health check',
        fscore&&fscore.na?'N/A for banks':fscore?`${fscore.score}/${fscore.max}`:'insufficient data',
        fscore&&!fscore.na&&fscore.score!=null?'9 simple pass/fail tests of improving fundamentals':'',
        fscore&&!fscore.na&&fscore.score!=null?(fscore.score>=7?'good':fscore.score>=4?'warn':'crit'):undefined)}
    ${pdfTile('Bankruptcy risk (Altman Z)',
        altman&&altman.na?'N/A for banks':altman?altman.Z.toFixed(2)+' — '+altman.zone:'insufficient data',
        altman&&!altman.na&&altman.Z!=null?'above 2.6 = safe zone; below 1.1 = distress':'',
        altman&&!altman.na&&altman.Z!=null?(altman.zone==='Safe'?'good':altman.zone==='Grey'?'warn':'crit'):undefined)}
    ${pdfTile('Accounting red flags (Beneish M)',
        beneish&&beneish.M!=null?beneish.M.toFixed(2)+(beneish.flag?' — flag raised':' — clean'):'insufficient data',
        beneish&&beneish.M!=null?'statistical screen for manipulated earnings':'',
        beneish&&beneish.M!=null?(beneish.flag?'crit':'good'):undefined)}
  </div>
  ${fscore&&!fscore.na&&fscore.tests?`
  <table style="margin-bottom:10px">
    <tr><th>Health check</th><th style="width:56px">Result</th><th>Health check</th><th style="width:56px">Result</th></tr>
    ${(()=>{const t=fscore.tests;const half=Math.ceil(t.length/2);let rows='';for(let i=0;i<half;i++){const a=t[i],b=t[i+half];rows+=`<tr><td>${a.lbl}</td><td style="font-weight:800;color:${a.pass?PDF_GOODTXT:PDF_CRIT}">${a.pass?'✓ Pass':'✕ Fail'}</td><td>${b?b.lbl:''}</td><td style="font-weight:800;color:${b?(b.pass?PDF_GOODTXT:PDF_CRIT):'inherit'}">${b?(b.pass?'✓ Pass':'✕ Fail'):''}</td></tr>`;}return rows;})()}
  </table>`:''}
  <div class="g2">
    ${shHold}
    <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:10px 13px;background:#fff">
      <div style="font-size:9.5px;font-weight:800;margin-bottom:5px">Why ownership matters</div>
      <p style="font-size:8.5px">${d.promoter_holding_pct!=null?`Promoters hold <strong>${pdfPct(d.promoter_holding_pct)}</strong> — ${d.promoter_holding_pct>50?'a controlling stake, meaning the people running the company have most of their own wealth riding on it.':'less than half, so watch whether their stake rises (confidence) or keeps falling (caution).'}`:'Promoter holding data was unavailable.'} ${d.fii_holding_pct!=null?`Foreign institutions hold ${pdfPct(d.fii_holding_pct)} and domestic funds ${pdfPct(d.dii_holding_pct)} — institutional presence adds scrutiny and liquidity.`:''} ${AN.promoterTrend?`<strong style="color:${AN.promoterTrend.flag?PDF_CRIT:AN.promoterTrend.soft?'#a36f00':PDF_GOODTXT}">Trend check (verified): promoter stake moved ${AN.promoterTrend.from}% → ${AN.promoterTrend.to}% over about a year${AN.promoterTrend.flag?' — insiders are selling, a serious warning that caps the rating.':AN.promoterTrend.soft?' — a mild reduction worth watching.':' — stable or rising, a good sign.'}</strong>`:''} ${AN.cashConv?`Cash check: over ${AN.cashConv.years} years the company turned ₹${AN.cashConv.patSum} Cr of reported profit into ₹${AN.cashConv.cfoSum} Cr of operating cash (ratio ${AN.cashConv.ratio})${AN.cashConv.flag?' — <strong style="color:'+PDF_CRIT+'">profits are not becoming cash; treat reported earnings with suspicion.</strong>':AN.cashConv.soft?' — slightly weak conversion, monitor.':' — healthy conversion.'}`:''}</p>
    </div>
  </div>
  ${(d.management_profile?.trust_score!=null || (d.management_profile?.governance_flags||[]).length)?`
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:10px 13px;background:#fff;margin-top:10px">
    <div style="font-size:9.5px;font-weight:800;margin-bottom:5px">Can you trust the people running it?</div>
    <p style="font-size:8.5px;margin-bottom:${(d.management_profile?.governance_flags||[]).length?'5px':'0'}">${d.management_profile.trust_score!=null?`Management trust &amp; reliability scores <strong>${d.management_profile.trust_score}/100</strong> — based on governance record, promises kept versus guidance missed, and integrity signals found in public records.`:''} ${d.management_profile.track_record_text?esc(d.management_profile.track_record_text):''}</p>
    ${(d.management_profile?.governance_flags||[]).map(f=>{const clean=/^\s*none/i.test(f);return `<div style="font-size:8.5px;color:${clean?PDF_GOODTXT:PDF_CRIT};font-weight:${clean?'400':'700'}">${clean?'✓':'▲'} ${esc(f)}</div>`;}).join('')}
  </div>`:''}

  <!-- ══ 4. FUTURE PROSPECTS ══ -->
  <div class="pgbrk"></div>
  ${pdfSection(4,'Future prospects — where could this go?','The growth assumption behind every number in this report, the sector’s runway, and what the company itself is building.')}
  <p><strong>Our growth assumption, honestly explained.</strong> ${growthWords}</p>
  ${qaTiles?`
  <div style="font-size:9.5px;font-weight:800;margin:4px 0 6px">The qualitative lens — product, market, demand &amp; geopolitics</div>
  <div class="g4" style="margin-bottom:8px">${qaTiles}</div>
  <p style="font-size:8px;color:${PDF_MUT};margin-bottom:10px">Scores are AI-assessed from searched evidence (0–100, higher = better or safer) and feed the composite score: demand &amp; strategy → Future Growth pillar (25%); product &amp; market → Quality pillar (10%); geopolitics → Policy &amp; Geo pillar (5%).</p>`:''}
  ${stratWords?`<p><strong>Growth strategy, and can they pull it off?</strong> ${stratWords}</p>`:''}
  <div class="g4" style="margin-bottom:10px">
    ${pdfTile('Sector market size (now)', esc(d.sector_detail?.market_size_current)||'N/A')}
    ${pdfTile('Expected by 2030', esc(d.sector_detail?.market_size_2030)||'N/A')}
    ${pdfTile('Sector growth rate', esc(d.sector_detail?.cagr_forecast_text)||'N/A')}
    ${pdfTile('Sector life stage', esc(d.sector_detail?.sector_stage)||'N/A', 'growth-stage sectors lift all competent players')}
  </div>
  ${d.sector_detail?.commentary?`<p><strong>Sector outlook.</strong> ${esc(d.sector_detail.commentary)}</p>`:''}
  ${(d.business_overview?.future_plans||[]).length?`
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:10px 13px;margin-bottom:10px;background:#fff">
    <div style="font-size:9.5px;font-weight:800;margin-bottom:5px">What the company says it will build</div>
    ${d.business_overview.future_plans.map(p=>`<div style="font-size:8.5px;color:${PDF_INK2};margin-bottom:3px;padding-left:12px;position:relative"><span style="position:absolute;left:0;color:${PDF_BLUE};font-weight:800">→</span>${esc(p)}</div>`).join('')}
    ${d.business_overview.capacity_expansion?`<div style="font-size:8.5px;color:${PDF_INK2};margin-top:5px"><strong>Capacity:</strong> ${esc(d.business_overview.capacity_expansion)}</div>`:''}
    ${d.business_overview.order_book?`<div style="font-size:8.5px;color:${PDF_INK2};margin-top:3px"><strong>Order book:</strong> ${esc(d.business_overview.order_book)} — orders already won are future revenue you can almost see.</div>`:''}
  </div>`:''}
  ${(A.key_catalysts||[]).length?`<p><strong>Catalysts to watch:</strong> ${A.key_catalysts.map(c=>esc(c)).join(' · ')}</p>`:''}
  <p><strong>Recent news, weighed.</strong> ${newsWords}</p>
  ${ladder?`
  <div style="margin:12px 0 4px;font-size:9.5px;font-weight:800">Exit-point ladder — short &amp; long-term targets</div>
  <table style="margin-bottom:6px">
    <tr><th>Horizon</th><th></th><th>Bear</th><th>Base — exit reference</th><th>Bull</th><th>Base return /yr (incl. div)</th></tr>
    ${ladder.map(r=>`<tr>
      <td style="font-weight:700;color:${PDF_INK}">${r.label}</td>
      <td style="font-size:7px;font-weight:800;color:${r.term==='short'?'#1c5cab':'#4a3aa7'}">${r.term==='short'?'SHORT-TERM':'LONG-TERM'}</td>
      <td style="color:${PDF_CRIT}">${pdfINR(r.bear.px)} (${r.bear.ret>=0?'+':''}${r.bear.ret.toFixed(0)}%)</td>
      <td style="font-weight:800;color:${PDF_INK}">${pdfINR(r.base.px)} (${r.base.ret>=0?'+':''}${r.base.ret.toFixed(0)}%)</td>
      <td style="color:${PDF_GOODTXT}">${pdfINR(r.bull.px)} (${r.bull.ret>=0?'+':''}${r.bull.ret.toFixed(0)}%)</td>
      <td>${r.base.cagrTotal.toFixed(1)}%</td>
    </tr>`).join('')}
  </table>
  <p style="font-size:8px;color:${PDF_MUT};margin-bottom:10px">The base column is the exit reference: reaching a target well ahead of schedule means the easy gains are in. Multiples re-rate gradually in this model, so near-term targets are earnings-driven. Honesty note: 6-month prices are dominated by market mood — treat short-term rows as wide-error planning references; the 2–5 year rows are where the analysis has an edge.</p>`:''}
  <div style="margin:12px 0 4px;font-size:9.5px;font-weight:800">Three futures for the share price (5-year view)</div>
  ${pdfRangeStrip(scen,cmp)}
  ${scenWords?`<p style="margin-top:8px">${scenWords}</p>`:''}

  <!-- ══ 5. RISKS ══ -->
  <div class="pgbrk"></div>
  ${pdfSection(5,'What could go wrong','No investment is risk-free. These are the specific ways this thesis could fail, and what softens each blow.')}
  ${(d.risks||[]).length?`
  <table style="margin-bottom:10px">
    <tr><th style="width:64px">Severity</th><th style="width:170px">Risk</th><th>What softens it</th></tr>
    ${d.risks.map(r=>{const sv=(r.severity||'').toLowerCase();const c=sv==='high'?PDF_CRIT:sv==='medium'?'#a36f00':PDF_GOODTXT;return `<tr><td style="font-weight:800;color:${c}">${sv==='high'?'●●● High':sv==='medium'?'●●○ Med':'●○○ Low'}</td><td style="font-weight:700;color:${PDF_INK}">${esc(r.factor)}</td><td>${esc(r.mitigation)}</td></tr>`;}).join('')}
  </table>`:'<p>No specific risks were returned — treat that as missing data, not absence of risk.</p>'}
  <div style="border:1px solid ${PDF_GRID};border-radius:8px;padding:10px 13px;margin-bottom:12px;background:#fff">
    <div style="font-size:9.5px;font-weight:800;margin-bottom:4px">What would change our view</div>
    <p style="font-size:8.5px;margin-bottom:0">${[
      cl.filter(x=>!x.pass).length?`The company currently fails ${cl.filter(x=>!x.pass).length} of 10 sector checklist items (${cl.filter(x=>!x.pass).slice(0,3).map(x=>x.lbl).join('; ')}${cl.filter(x=>!x.pass).length>3?'; …':''}) — clearing these would strengthen the thesis.`:'The company passes the full sector checklist — deterioration in any item would be the first warning.',
      caps&&caps.length?'Resolving the guardrail warnings on page 1 would lift the rating cap.':'',
      'A material fall in promoter holding, a spike in pledging, or margin decline across two consecutive quarters would each warrant a re-run of this analysis.'
    ].filter(Boolean).join(' ')}</p>
  </div>

  <div style="border-top:2px solid ${PDF_INK};padding-top:8px">
    <div style="font-size:8px;color:${PDF_MUT};line-height:1.6">
      <strong style="color:${PDF_INK2}">Method:</strong> growth = 3-yr CAGR regressed by sector factor, blended with retention × ROE · discount rate ${(d._wacc*100).toFixed(1)}% ${waccObj?'(CAPM)':'(sector default)'} · terminal growth ${(TERMINAL_G*100).toFixed(1)}% · 10% margin of safety on DCF · composite score = Financial 30% + Future Growth 25% + Valuation 20% + Quality &amp; Market 10% + Management 10% + Policy &amp; Geo 5% · engine: ${esc(d._engineLabel)||'AI + local computation'}.
      <br><strong style="color:${PDF_INK2}">Disclaimer:</strong> This report is generated by software for education and research. It is not investment advice, and the authors hold no SEBI registration. Figures may contain errors — verify independently before investing. Markets can fall as well as rise; never invest money you cannot afford to lose.
      <br>Generated ${genDate} · ${name} (${tick}) · MultibaggerAI
    </div>
  </div>

</div>
<script>
  // Auto-open the print dialog once fonts/layout settle; the button stays as fallback.
  window.addEventListener('load', function(){ setTimeout(function(){ try{ window.print(); }catch(e){} }, 350); });
</script>
</body></html>`;
}

function generatePDFReport(){
  if(!rawData){ alert('Please run an analysis first.'); return; }
  let html;
  try{ html = buildPrintReport(rawData); }
  catch(e){ alert('Could not build the report: '+e.message); return; }
  const w = window.open('', '_blank');
  if(!w){
    alert('Your browser blocked the report pop-up. Please allow pop-ups for this page, then click the button again.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
