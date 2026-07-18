// ════════════════════════════════════════════════════════
// RENDER FUNCTION
// ════════════════════════════════════════════════════════
function renderReport(d){
  // All analysis comes from the shared pipeline — this function only renders.
  const A = computeAnalysis(d);
  const { cfg, dcf, graham, lynch, ev, fv, scen, peg, cl, sc, revDCF, fscore,
          decomp, altman, beneish, score5y, rating, dq, confObj, conf, why,
          news, ladder, fcfDCF, trend, resInc, justPE, dcfCapm, dcfFlat,
          passCount, usedWACC } = A;
  const wacc = A.waccObj, ratingCaps = A.caps;
  const _pinned = !!(mbLoadStore().entries[mbKey(d)]||{}).pinned;
  const gc = score5y>=4?'#00e676':score5y>=3?'#40c4ff':score5y>=2?'#ffab40':'#ff5252';

  // Gauge arc math
  const R=76, CX=92, CY=84;
  const ang = (score5y-1)/4;
  const sx=CX+R*Math.cos(Math.PI), sy=CY+R*Math.sin(Math.PI);
  const fa=Math.PI+(Math.PI*-1)*ang;
  const ex=CX+R*Math.cos(fa), ey=CY+R*Math.sin(fa);
  const laf=ang>0.5?1:0;

  const wkPos = d.fifty_two_week_high && d.fifty_two_week_low && d.current_price
    ? ((d.current_price-d.fifty_two_week_low)/(d.fifty_two_week_high-d.fifty_two_week_low)*100).toFixed(0)+'% of range'
    : 'N/A';

  // Valuation models list
  const models = [
    {nm:`DCF 10Y — 3-Phase (w=${fcfDCF&&fcfDCF.perShare>0?'35':'50'}%)`, val:dcf?.fairVal, col:dcf?.fairVal>=(d.current_price||0)?'var(--g)':'var(--r)'},
    {nm:'Cash-Flow DCF — FCFF (w=15%)', val:(fcfDCF&&fcfDCF.perShare>0)?fcfDCF.perShare:null, col:(fcfDCF&&fcfDCF.perShare>0&&fcfDCF.perShare>=(d.current_price||0))?'var(--g)':'var(--r)'},
    {nm:'Peter Lynch Fair Value (w=25%)', val:lynch,  col:lynch>=(d.current_price||0)?'var(--g)':'var(--r)'},
    {nm:'EV/EBITDA Relative (w=25%)', val:ev,   col:ev>=(d.current_price||0)?'var(--g)':'var(--r)'},
    {nm:'Graham Number (floor — not in blend)', val:graham, col:'var(--m)'}
  ].filter(m=>m.val!=null);
  const maxM = Math.max(...models.map(m=>m.val), d.current_price||1)*1.06;

  // DCF year-by-year rows
  const dcfRows = dcf ? dcf.rows.map(r=>`
    <tr>
      <td>Year ${r.yr}${r.yr===1?' <span style="font-size:0.5rem;color:var(--g);">▶ high growth</span>':r.yr===6?' <span style="font-size:0.5rem;color:var(--bl);">▶ transition</span>':''}</td>
      <td>${(r.g*100).toFixed(1)}%</td>
      <td>${fmtINR(r.eps,1)}</td>
      <td>${(1/Math.pow(1+(dcf?.usedWACC||WACC),r.yr)).toFixed(4)}</td>
      <td style="color:var(--g)">${fmtINR(r.pv,1)}</td>
      <td style="color:var(--bl)">${fmtINR(r.cumPV,1)}</td>
    </tr>`).join('') : '';

  // Scenario range bar
  let scenHTML = '<div style="color:var(--m);font-size:0.75rem;">EPS data required for scenario analysis.</div>';
  if(scen && d.current_price){
    const all=[d.current_price, scen.bear5, scen.base5, scen.bull5];
    const mn=Math.min(...all)*0.86, mx=Math.max(...all)*1.05;
    const pp=v=>((v-mn)/(mx-mn)*100).toFixed(1);
    scenHTML = `
      <div style="position:relative;padding:32px 0 28px;">
        <div style="height:6px;background:linear-gradient(90deg,var(--r),var(--a),var(--g));border-radius:3px;position:relative;">
          <div style="position:absolute;left:${pp(d.current_price)}%;top:-12px;transform:translateX(-50%);width:2px;height:30px;background:white;border-radius:1px;">
            <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:0.52rem;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;color:white;background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:3px;">${fmtINR(d.current_price,0)} CMP</div>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:0.5rem;color:var(--m);white-space:nowrap;">Today</div>
          </div>
          <div style="position:absolute;left:${pp(scen.bear5)}%;top:-12px;transform:translateX(-50%);width:2px;height:30px;background:var(--r);border-radius:1px;">
            <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:0.52rem;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;color:var(--r);">${fmtINR(scen.bear5,0)}</div>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:0.5rem;color:var(--r);white-space:nowrap;">Bear 5Y</div>
          </div>
          <div style="position:absolute;left:${pp(scen.base5)}%;top:-12px;transform:translateX(-50%);width:2px;height:30px;background:var(--a);border-radius:1px;">
            <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:0.52rem;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;color:var(--a);">${fmtINR(scen.base5,0)}</div>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:0.5rem;color:var(--a);white-space:nowrap;">Base 5Y</div>
          </div>
          <div style="position:absolute;left:${pp(scen.bull5)}%;top:-12px;transform:translateX(-50%);width:2px;height:30px;background:var(--g);border-radius:1px;">
            <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:0.52rem;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;color:var(--g);">${fmtINR(scen.bull5,0)}</div>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:0.5rem;color:var(--g);white-space:nowrap;">Bull 5Y</div>
          </div>
        </div>
      </div>
      <div class="g3" style="margin-top:8px;">
        <div class="kbox" style="background:var(--rb);border-color:rgba(255,82,82,0.2)">
          <div class="kl">Bear Case 5Y (Growth×0.45)</div>
          <div class="kv r">${fmtINR(scen.bear5,0)}</div>
          <div class="ks">${fmtX(scen.bear5/d.current_price)} return · Exit PE ${scen.bPE.toFixed(1)}×</div>
        </div>
        <div class="kbox" style="background:var(--ab);border-color:rgba(255,171,64,0.2)">
          <div class="kl">Base Case 5Y (Expected)</div>
          <div class="kv a">${fmtINR(scen.base5,0)}</div>
          <div class="ks">${fmtX(scen.base5/d.current_price)} return · Exit PE ${scen.bsPE.toFixed(1)}×</div>
        </div>
        <div class="kbox" style="background:var(--gb);border-color:rgba(0,230,118,0.2)">
          <div class="kl">Bull Case 5Y (Growth×1.35)</div>
          <div class="kv g">${fmtINR(scen.bull5,0)}</div>
          <div class="ks">${fmtX(scen.bull5/d.current_price)} return · Exit PE ${scen.buPE.toFixed(1)}×</div>
        </div>
      </div>`;
  }

  const stageIdx = {'Nascent':1,'Growth':2,'Mature':3,'Declining':4}[d.sector_detail?.sector_stage]||2;
  const twFill   = {'STRONG':5,'MODERATE':3,'WEAK':1}[d.government_support_detail?.tailwind_strength]||2;
  const fwdEPS5  = d.eps_ttm ? d.eps_ttm * Math.pow(1+d._g, 5) : null;

  const html = `<div id="ri">
    <div class="exp-row rs" style="flex-wrap:wrap">
      <button class="ebtn" id="btn-save" onclick="saveCurrent()" style="${_pinned?'color:var(--g);border-color:rgba(0,230,118,0.35)':''}"><i class="fas ${_pinned?'fa-bookmark':'fa-regular fa-bookmark'}"></i> ${_pinned?'Saved ✓':'Save analysis'}</button>
      <button class="ebtn" id="btn-refresh-news" onclick="refreshNewsOnly()"><i class="fas fa-rotate"></i> Refresh news only <span style="font-size:0.52rem;color:var(--m2)">(small AI call)</span></button>
      <button class="ebtn" id="btn-price" onclick="updatePriceFree()"><i class="fas fa-bolt"></i> Update price <span style="font-size:0.52rem;color:var(--m2)">(free, no AI)</span></button>
      <button class="ebtn" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
      <button class="ebtn" onclick="copyJSON()"><i class="fas fa-code"></i> Raw JSON</button>
      <button class="ebtn" onclick="generatePDFReport()" style="background:linear-gradient(135deg,#00c853,#00897b);color:#000;font-weight:800;border:none;padding:8px 20px;letter-spacing:0.04em;box-shadow:0 3px 12px rgba(0,200,83,0.3)">
        <i class="fas fa-file-pdf"></i> Download Full PDF Report
      </button>
    </div>

    ${d._storedAt ? `
    <div class="rs" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;border-radius:10px;margin-bottom:12px;background:var(--blb);border:1px solid rgba(64,196,255,0.25)">
      <i class="fas fa-box-archive" style="color:var(--bl)"></i>
      <div style="font-size:0.66rem;color:var(--t);line-height:1.5">
        <strong style="color:var(--bl)">Opened from your library</strong> — analysed ${mbAge(d._storedAt)}, zero tokens spent to reopen.
        Use <strong>Update price</strong> (free) for fresh prices/ratios, <strong>Refresh news only</strong> (small AI call) for the latest news impact, or re-run the full analysis from the search box if fundamentals may have changed (e.g. after quarterly results).
      </div>
    </div>
    ${needsRerun(d._storedAt) ? `
    <div class="rs" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;border-radius:10px;margin-bottom:12px;background:var(--ab);border:1px solid rgba(255,171,64,0.35)">
      <i class="fas fa-clock" style="color:var(--a)"></i>
      <div style="font-size:0.66rem;color:var(--t);line-height:1.5">
        <strong style="color:var(--a)">Quarterly results have likely been published since this analysis</strong> — the fundamentals below may be one quarter stale. A full re-run from the search box is recommended before acting on the targets.
      </div>
    </div>` : ''}` : ''}

    <!-- DATA PROVENANCE -->
    ${d._provenance && d._provenance.fields.length ? `
    <div class="rs" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;border-radius:10px;margin-bottom:12px;background:var(--gb);border:1px solid rgba(0,230,118,0.22)">
      <i class="fas fa-shield-check" style="color:var(--g)"></i>
      <div style="font-size:0.66rem;color:var(--t);line-height:1.5">
        <strong style="color:var(--g)">${d._provenance.fields.length} core figures verified</strong> via ${d._provenance.sources.join(' + ')}${d._provenance.symbol?` (${esc(d._provenance.symbol)})`:''} · as of ${d._provenance.asOf} — these override AI-sourced values, so results are consistent across AI models.
        <span style="color:var(--m)">AI supplied: growth history, sector &amp; quant data, news.</span>
      </div>
    </div>` : `
    <div class="rs" style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:10px;margin-bottom:12px;background:var(--ab);border:1px solid rgba(255,171,64,0.22)">
      <i class="fas fa-triangle-exclamation" style="color:var(--a)"></i>
      <div style="font-size:0.66rem;color:var(--t)">Structured data feed unreachable — <strong style="color:var(--a)">all figures below are AI-sourced</strong> and may vary between models. Verify key numbers before acting.</div>
    </div>`}

    <!-- DATA QUALITY & CONSISTENCY -->
    <div class="card rs">
      <div class="ch">
        <div class="ct"><i class="fas fa-clipboard-check" style="color:${confObj.level==='HIGH'?'var(--g)':confObj.level==='MEDIUM'?'var(--a)':'var(--r)'}"></i> Data Quality — how much should you trust this run?</div>
        <span class="cbadge c${confObj.level[0]}">${confObj.level} · ${confObj.score}/100</span>
      </div>
      <div class="cb">
        <div style="font-size:0.68rem;color:var(--m);line-height:1.6;margin-bottom:9px">
          ${confObj.reasons.map(r=>`<div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:3px"><i class="fas fa-circle" style="font-size:0.3rem;margin-top:6px;color:var(--m2);flex-shrink:0"></i><span>${r}</span></div>`).join('')}
        </div>
        ${dq.ran ? `
        <details>
          <summary><i class="fas fa-chevron-right"></i> Cross-field consistency checks (${dq.ran} ran · ${dq.failed} failed · ${dq.warned} soft mismatches)</summary>
          <div style="margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:5px">
            ${dq.checks.map(c=>`
            <div style="display:flex;align-items:flex-start;gap:7px;padding:6px 9px;border-radius:7px;background:${c.ok?'var(--s2)':c.severity==='fail'?'var(--rb)':'var(--ab)'};border:1px solid ${c.ok?'var(--b)':c.severity==='fail'?'rgba(255,82,82,0.25)':'rgba(255,171,64,0.25)'}">
              <i class="fas ${c.ok?'fa-check':c.severity==='fail'?'fa-xmark':'fa-triangle-exclamation'}" style="color:${c.ok?'var(--g)':c.severity==='fail'?'var(--r)':'var(--a)'};font-size:0.62rem;margin-top:2px"></i>
              <div><div style="font-size:0.64rem;font-weight:700;color:${c.ok?'var(--t)':'var(--t)'}">${c.name}</div>
              ${!c.ok?`<div style="font-size:0.56rem;color:var(--m);font-family:'JetBrains Mono',monospace">${c.detail}</div>`:''}</div>
            </div>`).join('')}
          </div>
        </details>` : ''}
        <div style="font-size:0.58rem;color:var(--m2);margin-top:8px">Confidence measures the trustworthiness of this run's data — verified coverage, internal consistency, completeness and model agreement — not the quality of the company.</div>
      </div>
    </div>

    <!-- STOCK HEADER -->
    <div class="sh rs">
      <div>
        <div class="sn">${esc(d.stock_name)||'—'}</div>
        <div class="stk"><i class="fas fa-circle" style="font-size:0.35rem;margin-right:4px"></i>${esc(d.ticker)||'—'} · ${esc(d.exchange)||'NSE'}</div>
        <div><span class="chip cp">${esc(d.sector)||'—'}</span><span class="chip cb2">${esc(d.exchange)||'NSE'}</span></div>
      </div>
      <div class="stat-r">
        <div class="spill"><div class="sl">52W High</div><div class="sv" style="color:var(--g)">${d.fifty_two_week_high?fmtINR(d.fifty_two_week_high,0):'—'}</div></div>
        <div class="spill"><div class="sl">52W Low</div><div class="sv" style="color:var(--r)">${d.fifty_two_week_low?fmtINR(d.fifty_two_week_low,0):'—'}</div></div>
        <div class="spill"><div class="sl">Range Pos.</div><div class="sv" style="color:var(--a)">${wkPos}</div></div>
        <div class="spill"><div class="sl">Market Cap</div><div class="sv">${d.market_cap_cr?'&#8377;'+d.market_cap_cr.toLocaleString()+' Cr':'—'}</div></div>
        <div class="spill"><div class="sl">EPS (TTM)</div><div class="sv" style="color:var(--bl)">${d.eps_ttm?fmtINR(d.eps_ttm,2):'—'}</div></div>
      </div>
      <div>
        <div class="cmp">${d.current_price?'&#8377;'+d.current_price.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
        <div class="cmp-sub">Current Market Price</div>
      </div>
    </div>

    <!-- SECTOR BADGE + METRICS -->
    <div class="card rs">
      <div class="ch" style="background:${cfg.color}18;border-bottom:2px solid ${cfg.color}30;">
        <div class="ct" style="color:${cfg.color};font-size:0.7rem;">
          <span style="font-size:1.1rem;">${cfg.icon}</span>
          ${cfg.name.toUpperCase()} · SECTOR-SPECIFIC METRICS
        </div>
        <span style="font-size:0.62rem;font-weight:700;color:${cfg.color};background:${cfg.color}15;padding:3px 10px;border-radius:99px;border:1px solid ${cfg.color}30;">${esc(d.business_type)||'—'}</span>
      </div>
      <div class="cb">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;margin-bottom:12px;">
          ${cfg.metrics.map(m=>{
            const raw = d.sd[m.id];
            const val = raw==null?null:raw;
            const disp = val==null?'N/A':(typeof val==='boolean'?(val?'Yes':'No'):val.toLocaleString()+m.unit);
            const scored = val==null||typeof val==='boolean'?50:m.hi
              ? Math.max(0,Math.min(100,(val-m.lo)/(m.hi_v-m.lo)*100))
              : Math.max(0,Math.min(100,(m.hi_v-val)/(m.hi_v-m.lo)*100));
            const barC = scored>70?'var(--g)':scored>45?'var(--a)':'var(--r)';
            const txtC = scored>70?'var(--g)':scored>45?'var(--a)':'var(--r)';
            return `<div class="kbox" style="border-top:2px solid ${barC}30;">
              <div class="kl">${m.lbl}</div>
              <div class="kv" style="color:${typeof val==='boolean'?(val?'var(--g)':'var(--r)'):txtC};font-size:0.88rem;">${disp}</div>
              ${typeof val!=='boolean'&&val!=null?`<div style="height:3px;background:var(--s3);border-radius:2px;margin-top:5px;overflow:hidden;"><div style="height:100%;background:${barC};width:${scored.toFixed(0)}%;border-radius:2px;"></div></div>`:''}
              <div class="ks" style="margin-top:3px;">${m.desc}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="background:${cfg.color}10;border-left:3px solid ${cfg.color};border-radius:6px;padding:9px 14px;font-size:0.72rem;color:var(--m);line-height:1.6;">
          <strong style="color:${cfg.color};">Analyst Note:</strong> ${cfg.note}
        </div>
      </div>
    </div>

    <!-- VERDICT -->
    <div class="vgrid rs">
      <div class="vc" style="align-items:center;text-align:center">
        <div style="font-size:0.56rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--m);margin-bottom:12px;display:flex;align-items:center;gap:5px;justify-content:center"><i class="fas fa-calculator" style="color:${gc}"></i> Computed 5Y Return</div>
        <div class="gauge-wrap">
          <svg class="gsv" viewBox="0 0 184 100">
            <path d="M${CX-R} ${CY} A${R} ${R} 0 0 1 ${CX+R} ${CY}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="10" stroke-linecap="round"/>
            <text x="8"  y="92" fill="rgba(255,255,255,0.22)" font-size="8" font-family="JetBrains Mono,monospace">1x</text>
            <text x="84" y="10" fill="rgba(255,255,255,0.22)" font-size="8" font-family="JetBrains Mono,monospace" text-anchor="middle">3x</text>
            <text x="164" y="92" fill="rgba(255,255,255,0.22)" font-size="8" font-family="JetBrains Mono,monospace">5x</text>
            ${ang>0?`<path d="M${sx} ${sy} A${R} ${R} 0 ${laf} 1 ${ex} ${ey}" fill="none" stroke="${gc}" stroke-width="10" stroke-linecap="round"/>`:''}
            <circle cx="${ex}" cy="${ey}" r="5" fill="${gc}" style="filter:drop-shadow(0 0 5px ${gc})"/>
          </svg>
          <div class="g-num">${score5y.toFixed(2)}<span class="g-den">/5</span></div>
          <div class="g-lbl">${score5y>=4?'🚀 Strong Multibagger':score5y>=3?'📈 Good Growth':score5y>=2?'⚖️ Moderate':'⚠️ Limited Potential'}</div>
          <div class="g-calc">${scen&&d.current_price?fmtINR(scen.base5,0)+' ÷ '+fmtINR(d.current_price,0)+' = '+fmtX(scen.base5/d.current_price):'Base5Y ÷ CMP'}</div>
        </div>
      </div>
      <div class="vc">
        <div class="rbadge ${rating==='STRONG BUY'?'rSB':rating==='BUY'?'rB':rating==='HOLD'?'rH':rating==='INSUFFICIENT DATA'?'rH':'rA'}">
          <i class="fas ${rating.includes('BUY')?'fa-arrow-trend-up':rating==='HOLD'?'fa-minus':rating==='INSUFFICIENT DATA'?'fa-circle-question':'fa-arrow-trend-down'}"></i>${rating}
        </div>
        <div class="conf-row">
          <span class="conf-l">Confidence</span>
          <span class="cbadge c${conf[0]}">${conf}</span>
          <span style="font-size:0.56rem;color:var(--m);margin-left:4px">Composite: ${sc.composite.toFixed(0)}/100 · confidence reflects data quality (${confObj.score}/100), not company quality</span>
        </div>
        ${ratingCaps && ratingCaps.length ? `
        <div style="margin-bottom:12px;padding:9px 12px;border-radius:8px;background:var(--ab);border:1px solid rgba(255,171,64,0.25)">
          <div style="font-size:0.58rem;font-weight:800;color:var(--a);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px"><i class="fas fa-shield-halved"></i> Rating capped by guardrails</div>
          ${ratingCaps.map(c=>`<div style="font-size:0.66rem;color:var(--t);line-height:1.55;margin-bottom:3px"><strong style="color:var(--a)">${c.from} → ${c.to}:</strong> ${c.why}</div>`).join('')}
        </div>`:''}
        <div class="tg">
          <div class="tb"><div class="tbl">6M Target (Base)</div><div class="tbv">${ladder?fmtINR(ladder[0].base.px,0):'—'}</div></div>
          <div class="tb"><div class="tbl">1Y Target (Base)</div><div class="tbv">${ladder?fmtINR(ladder[1].base.px,0):'—'}</div></div>
          <div class="tb"><div class="tbl">5Y Target (Base)</div><div class="tbv">${ladder?fmtINR(ladder[3].base.px,0):'—'}</div></div>
        </div>
        <div class="g4" style="margin-bottom:12px">
          <div class="kbox"><div class="kl">Growth Est. (5Y)</div><div class="kv g" style="font-size:0.82rem">${pct(d._g*100)}/yr</div><div class="ks">${cfg.growthReg*100|0}% of hist. CAGR</div></div>
          <div class="kbox"><div class="kl">Fwd EPS (5Y)</div><div class="kv b" style="font-size:0.82rem">${fwdEPS5?fmtINR(fwdEPS5,1):'N/A'}</div></div>
          <div class="kbox"><div class="kl">PEG Ratio</div><div class="kv ${peg&&peg<1.5?'g':peg&&peg<2?'a':'r'}" style="font-size:0.82rem">${peg?peg.toFixed(2):'N/A'}</div><div class="ks">&lt;1.0 ideal</div></div>
          <div class="kbox"><div class="kl">Avg Fair Value</div><div class="kv a" style="font-size:0.82rem">${fv?fmtINR(fv,0):'N/A'}</div></div>
        </div>
        <div class="vsumm">
          <strong style="color:${cfg.color}">${cfg.icon} ${cfg.name}:</strong> ${cfg.note.split('.')[0]}.<br>
          <strong style="color:var(--t)">Growth Logic:</strong> 3Y PAT CAGR ${pct(d.profit_cagr_3yr_pct)} → regressed to ${pct(d._g*100)}/yr (sector regression ×${cfg.growthReg}, cap ${pct(cfg.maxGrowthCap*100)}). Score = Base-5Y ÷ CMP. WACC: ${(usedWACC*100).toFixed(0)}% · Terminal g: ${(TERMINAL_G*100).toFixed(1)}% · DCF margin of safety: ${(MOS*100).toFixed(0)}%.
        </div>
      </div>
    </div>

    <!-- WHY THIS CALL — DECISION PATH -->
    ${why ? `
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-scale-balanced" style="color:var(--g)"></i> Why ${why.rating}? — The Full Decision Path</div>
        <span style="font-size:0.56rem;color:var(--m)">every number and threshold behind the call</span></div>
      <div class="cb">

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 1 · The growth estimate that everything rests on</div>
        <div class="formula" style="margin-top:0;margin-bottom:12px">Historical: ${why.growth.histCagr!=null?pct(why.growth.histCagr):'n/a'} × sector fade ${why.growth.reg} = <span class="vl">${why.growth.gHist!=null?pct(why.growth.gHist*100):'n/a'}</span>${why.growth.gFund!=null?`
Fundamental: retention × ROE = <span class="vl">${pct(why.growth.gFund*100)}</span>
Blend of the two, capped at ${pct(why.growth.capG*100)} → <span class="vl">g = ${pct(why.growth.g*100)}/yr</span>`:`
No fundamental cross-check available → <span class="vl">g = ${pct(why.growth.g*100)}/yr</span>`}</div>

        ${why.target ? `
        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 2 · The 5-year return score</div>
        <div class="formula" style="margin-top:0;margin-bottom:12px">EPS ${fmtINR(why.target.eps,2)} × (1+${(why.target.g*100).toFixed(1)}%)⁵ × exit P/E ${why.target.exitPE.toFixed(1)} = <span class="vl">${fmtINR(why.target.base5,0)}</span> base-case 5-yr target
${fmtINR(why.target.base5,0)} ÷ CMP ${fmtINR(why.target.cmp,0)} = <span class="vl">score ${why.target.score.toFixed(2)}</span> <span class="cm">(1.0 = flat, 5.0 = 5-bagger)</span></div>` : ''}

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 3 · The composite quality score</div>
        <table class="dcf-t" style="margin-bottom:12px">
          <tr><th>Pillar</th><th>Score /100</th><th>Weight</th><th>Contribution</th></tr>
          ${why.pillars.map(p=>`<tr><td>${p.name}</td><td>${p.score.toFixed(0)}</td><td>${(p.w*100).toFixed(0)}%</td><td style="color:var(--g)">${p.contrib.toFixed(1)}</td></tr>`).join('')}
          <tr class="totrow"><td>Composite</td><td colspan="2"></td><td>${why.composite.toFixed(1)}</td></tr>
        </table>

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 4 · Which rating band do those two numbers land in?</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
          ${why.tests.map(t=>`
          <div style="display:flex;align-items:center;gap:9px;padding:7px 11px;border-radius:8px;background:${t.level===why.base?'var(--gb)':'var(--s2)'};border:1px solid ${t.level===why.base?'rgba(0,230,118,0.3)':'var(--b)'}">
            <span style="font-size:0.62rem;font-weight:800;width:92px;color:${t.level===why.base?'var(--g)':'var(--m)'}">${t.level}${t.level===why.base?' ◄':''}</span>
            ${t.conds.map(c=>`<span style="font-size:0.62rem;color:${c.ok?'var(--g)':'var(--r)'}"><i class="fas ${c.ok?'fa-check':'fa-xmark'}" style="font-size:0.55rem"></i> ${c.lbl} <span style="font-family:'JetBrains Mono',monospace">(${c.val})</span></span>`).join('<span style="color:var(--m2);font-size:0.6rem">AND</span>')}
          </div>`).join('')}
          ${why.base==='AVOID'?`<div style="font-size:0.64rem;color:var(--r);padding:0 4px">No band's conditions were met → pre-guardrail decision is AVOID.</div>`:''}
        </div>

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 5 · Guardrail audit ${why.base!==why.rating?`— capped ${why.base} → ${why.rating}`:'— none fired'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:12px">
          ${why.guardrails.map(g=>{
            const c = g.status==='fired'?'var(--r)':g.status==='caution'?'var(--a)':g.status==='passed'?'var(--g)':'var(--m)';
            const ic = g.status==='fired'?'fa-xmark':g.status==='caution'?'fa-triangle-exclamation':g.status==='passed'?'fa-check':'fa-minus';
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:8px;background:var(--s2);border:1px solid var(--b)">
              <i class="fas ${ic}" style="color:${c};font-size:0.66rem;margin-top:2px"></i>
              <div><div style="font-size:0.64rem;font-weight:700;color:var(--t)">${g.name} — <span style="color:${c};text-transform:uppercase;font-size:0.56rem">${g.status}</span></div>
              ${g.detail?`<div style="font-size:0.58rem;color:var(--m);font-family:'JetBrains Mono',monospace">${g.detail}</div>`:''}</div>
            </div>`;}).join('')}
        </div>

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Step 6 · What would change this call</div>
        ${why.up?`<div style="font-size:0.68rem;color:var(--t);line-height:1.6;margin-bottom:4px"><i class="fas fa-arrow-trend-up" style="color:var(--g);margin-right:5px"></i>${why.up}</div>`:''}
        ${why.down?`<div style="font-size:0.68rem;color:var(--m);line-height:1.6"><i class="fas fa-arrow-trend-down" style="color:var(--r);margin-right:5px"></i>${why.down}</div>`:''}

        <details style="margin-top:12px">
          <summary><i class="fas fa-chevron-right"></i> Every algorithm used in this analysis</summary>
          <div style="margin-top:9px;font-size:0.64rem;color:var(--m);line-height:1.8">
            <strong style="color:var(--t)">Growth:</strong> g = blend( 3-yr CAGR × sector fade factor, retention × ROE ), capped per sector · <strong style="color:var(--t)">DCF:</strong> 3-phase 10-yr EPS discounting at ${(d._wacc*100).toFixed(1)}% (CAPM when beta known, else sector WACC), years 6–10 decay linearly to terminal ${(TERMINAL_G*100).toFixed(1)}%, exit P/E = sector avg × 0.7 clamped 12–28, minus ${(MOS*100).toFixed(0)}% margin of safety · <strong style="color:var(--t)">Graham:</strong> √(22.5 × EPS × BVPS) · <strong style="color:var(--t)">Lynch:</strong> EPS × growth% (P/E capped 40) · <strong style="color:var(--t)">EV/EBITDA:</strong> (EBITDA × sector multiple − debt + cash) ÷ shares · <strong style="color:var(--t)">Blend:</strong> ${d.business_type==='BANKING_NBFC'?'P/B 60% + Graham 25% + Lynch 15% (banks — book-value businesses are Graham territory)':'EPS-DCF 35% + FCFF-DCF 15% (EPS-DCF 50% when cash-flow data is missing) + Lynch 25% + EV/EBITDA 25%; Graham shown as deep-value floor only'} · <strong style="color:var(--t)">Discount rate:</strong> CAPM (beta clamped 0.5–2.0) + small-cap size premium (+1.5% below ₹5,000 Cr, +0.75% below ₹20,000 Cr) · <strong style="color:var(--t)">Scenarios:</strong> bear/base/bull = growth ×0.45 / ×1 / ×1.35 with exit P/Es 0.8×current / drift 40% to sector / sector avg · <strong style="color:var(--t)">Composite:</strong> Financial 30% + Future Growth 25% + Valuation 20% + Quality 10% + Management 10% + Policy 5% · <strong style="color:var(--t)">Forensics:</strong> Piotroski 9-test F-score, Altman Z″ (emerging-market coefficients), Beneish 8-ratio M-score · <strong style="color:var(--t)">Reverse DCF:</strong> bisection for the growth rate that makes intrinsic value equal today's price · <strong style="color:var(--t)">Confidence:</strong> verified-field coverage + 15 cross-field consistency checks + completeness + model dispersion.
          </div>
        </details>
      </div>
    </div>` : ''}

    <!-- ACCURACY / REALITY CHECK -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-microscope" style="color:var(--p)"></i> Reality Check — Return Drivers, Reverse DCF &amp; Forensic Strength</div></div>
      <div class="cb">
        ${decomp ? (()=>{
          const ep=(decomp.epsShare*100), rr=(decomp.reShare*100);
          const epW=Math.max(0,Math.min(100,ep)), rrW=Math.max(0,Math.min(100,rr));
          const lean = decomp.rerate>1.30 ? `<span style="color:var(--r);font-weight:700">⚠ Leans on P/E re-rating (${decomp.rerate.toFixed(2)}×) — higher risk: the thesis needs the market to pay a richer multiple, not just earnings to grow.</span>`
                     : decomp.rerate<0.85 ? `<span style="color:var(--g);font-weight:700">Conservative — assumes the multiple <em>de-rates</em> to ${decomp.exitPE.toFixed(0)}×, so the return rests almost entirely on earnings.</span>`
                     : `<span style="color:var(--g);font-weight:700">Healthy — most of the projected return comes from earnings growth, not multiple expansion.</span>`;
          return `
          <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">What drives the ${decomp.total.toFixed(2)}× base-case 5Y return?</div>
          <div style="display:flex;height:26px;border-radius:7px;overflow:hidden;margin-bottom:7px;border:1px solid var(--b)">
            <div style="width:${epW}%;background:linear-gradient(90deg,var(--g2),var(--g));display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800;color:#000">${ep.toFixed(0)}%</div>
            <div style="width:${rrW}%;background:linear-gradient(90deg,#ffab40,#ff8f00);display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800;color:#000">${rr.toFixed(0)}%</div>
          </div>
          <div style="display:flex;gap:16px;font-size:0.62rem;margin-bottom:8px">
            <span><i class="fas fa-square" style="color:var(--g)"></i> Earnings growth · ${decomp.epsMult.toFixed(2)}× <span style="color:var(--m)">(${pct(decomp.g*100)}/yr)</span></span>
            <span><i class="fas fa-square" style="color:var(--a)"></i> P/E re-rating · ${decomp.rerate.toFixed(2)}× <span style="color:var(--m)">(${decomp.curPE.toFixed(1)}→${decomp.exitPE.toFixed(1)})</span></span>
          </div>
          <div style="font-size:0.68rem;line-height:1.6;color:var(--m);padding:8px 11px;background:var(--s2);border-radius:7px;border:1px solid var(--b);margin-bottom:14px">${lean}</div>`;
        })() : ''}

        <div class="g2">
          <!-- Reverse DCF -->
          <div class="kbox" style="padding:12px 14px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--bl);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><i class="fas fa-rotate-left"></i> Reverse DCF — Growth Priced In</div>
            ${revDCF?.na ? `<div style="font-size:0.68rem;color:var(--m)">Not applicable to banks/NBFCs — EPS-DCF isn't meaningful for financials.</div>`
              : revDCF ? `
              <div style="display:flex;gap:14px;margin-bottom:8px">
                <div><div class="kl">Implied by price</div><div class="kv ${revDCF.tone}" style="font-size:1rem">${(revDCF.implied*100).toFixed(1)}%/yr</div></div>
                <div><div class="kl">Sustainable est.</div><div class="kv b" style="font-size:1rem">${(revDCF.sustainable*100).toFixed(1)}%/yr</div></div>
              </div>
              <div style="font-size:0.66rem;line-height:1.6;color:var(--t)">${revDCF.verdict}</div>`
              : `<div style="font-size:0.68rem;color:var(--m)">Insufficient data (needs positive EPS &amp; price).</div>`}
          </div>

          <!-- Piotroski F-Score -->
          <div class="kbox" style="padding:12px 14px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px"><i class="fas fa-shield-halved"></i> Piotroski F-Score — Fundamental Strength</div>
            ${fscore?.na ? `<div style="font-size:0.68rem;color:var(--m)">Not applicable to banks/NBFCs.</div>`
              : fscore ? (()=>{
                const col = fscore.score>=7?'var(--g)':fscore.score>=4?'var(--a)':'var(--r)';
                const lbl = fscore.score>=7?'Strong':fscore.score>=4?'Moderate':'Weak';
                return `
                <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
                  <span style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:${col}">${fscore.score}<span style="font-size:0.8rem;color:var(--m)">/${fscore.max}</span></span>
                  <span style="font-size:0.7rem;font-weight:700;color:${col}">${lbl}</span>
                  ${fscore.max<9?`<span style="font-size:0.55rem;color:var(--m2)">(${fscore.max} of 9 had data)</span>`:''}
                </div>
                <div style="display:grid;grid-template-columns:1fr;gap:3px">
                  ${fscore.tests.map(t=>`<div style="display:flex;align-items:center;gap:6px;font-size:0.62rem;color:${t.pass?'var(--t)':'var(--m)'}"><i class="fas ${t.pass?'fa-check':'fa-xmark'}" style="color:${t.pass?'var(--g)':'var(--r)'};font-size:0.6rem;width:10px"></i>${t.lbl}</div>`).join('')}
                </div>`;
              })()
              : `<div style="font-size:0.68rem;color:var(--m)">Prior-year data not returned by the AI — try re-running or a different model. (F-Score needs current + previous year figures.)</div>`}
          </div>
        </div>
      </div>
    </div>

    <!-- QUANTITATIVE DEEP DIVE -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-square-root-variable" style="color:var(--bl)"></i> Quantitative Deep Dive — Cost of Capital, Cash Flow &amp; Forensics</div></div>
      <div class="cb">

        <!-- Discount rate & growth -->
        <div class="g2" style="margin-bottom:12px">
          <div class="kbox" style="padding:11px 13px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--bl);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Cost of Capital (CAPM)</div>
            ${wacc ? `
              <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:white">${(wacc.wacc*100).toFixed(2)}% <span style="font-size:0.6rem;color:var(--m)">WACC</span></div>
              <div style="font-size:0.62rem;color:var(--m);line-height:1.7;margin-top:4px">
                Kₑ = ${(RF*100).toFixed(0)}% + β${wacc.beta.toFixed(2)} × ${(ERP*100).toFixed(1)}% = <span style="color:var(--t)">${(wacc.ke*100).toFixed(1)}%</span><br>
                Weights: equity ${(wacc.we*100).toFixed(0)}% · debt ${(wacc.wd*100).toFixed(0)}% (after-tax Kd ${(wacc.kd*(1-wacc.tax)*100).toFixed(1)}%)
              </div>` : `<div style="font-size:0.68rem;color:var(--m)">Beta not returned — using flat ${(WACC*100).toFixed(0)}% WACC. Fair values above are computed at the flat rate.</div>`}
          </div>
          <div class="kbox" style="padding:11px 13px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Growth — Two Independent Views</div>
            <div style="display:flex;gap:14px;margin-bottom:5px">
              <div><div class="kl">Historical (regressed)</div><div class="kv b">${d._gHist!=null?(d._gHist*100).toFixed(1)+'%':'N/A'}</div></div>
              <div><div class="kl">Fundamental (RR×ROIC)</div><div class="kv g">${d._gFund!=null?(d._gFund*100).toFixed(1)+'%':'N/A'}</div></div>
              <div><div class="kl">Blend used</div><div class="kv a">${(d._g*100).toFixed(1)}%</div></div>
            </div>
            <div style="font-size:0.58rem;color:var(--m)">Fundamental = retention × ROIC — self-consistent with the company's own returns.</div>
          </div>
        </div>

        <!-- DCF sensitivity to discount rate + FCFF -->
        <div class="g3" style="margin-bottom:12px">
          <div class="kbox"><div class="kl">EPS-DCF @ flat 12%</div><div class="kv">${dcfFlat?fmtINR(dcfFlat*(1-MOS),0):'N/A'}</div></div>
          <div class="kbox"><div class="kl">EPS-DCF @ CAPM ${wacc?(wacc.wacc*100).toFixed(1)+'%':'—'}</div><div class="kv">${dcfCapm?fmtINR(dcfCapm*(1-MOS),0):'N/A'}</div></div>
          <div class="kbox" style="border-color:rgba(64,196,255,0.25)"><div class="kl">Cash-Flow DCF (FCFF)</div><div class="kv b">${fcfDCF&&fcfDCF.perShare!=null?fmtINR(fcfDCF.perShare,0):fcfDCF&&fcfDCF.negative?'FCFF < 0':'N/A'}</div></div>
        </div>
        <div style="font-size:0.62rem;color:var(--m);line-height:1.6;margin-bottom:14px">
          The <strong style="color:var(--bl)">FCFF DCF</strong> discounts actual free cash flow (EBIT after tax + depreciation − capex − working-capital change), not EPS. When it sits well below the EPS-DCF, the business converts less of its earnings into cash — a red flag for capex-heavy names that EPS valuations flatter.
        </div>

        <!-- Forensic scores -->
        <div class="g2" style="margin-bottom:12px">
          <div class="kbox" style="padding:11px 13px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--a);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Altman Z″ — Bankruptcy Risk</div>
            ${altman&&altman.na ? `<div style="font-size:0.66rem;color:var(--m)">Not applicable to banks/NBFCs.</div>`
              : altman ? `<div style="font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;color:var(--${altman.tone})">${altman.Z.toFixed(2)} <span style="font-size:0.65rem">${altman.zone}</span></div><div style="font-size:0.56rem;color:var(--m);margin-top:3px">Safe &gt; 2.6 · Grey 1.1–2.6 · Distress &lt; 1.1</div>`
              : `<div style="font-size:0.66rem;color:var(--m)">Balance-sheet data not returned — needs working capital, retained earnings, EBIT, total assets/liabilities.</div>`}
          </div>
          <div class="kbox" style="padding:11px 13px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--r);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Beneish M — Earnings-Manipulation Flag</div>
            ${beneish&&beneish.incomplete ? `<div style="font-size:0.66rem;color:var(--m)">Needs full current + prior-year accounting data (8 ratios) — not returned. Use a stronger model for the forensic pull.</div>`
              : beneish ? `<div style="font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;color:var(--${beneish.tone})">${beneish.M.toFixed(2)} <span style="font-size:0.62rem">${beneish.flag?'⚠ Possible manipulation':'Clean'}</span></div><div style="font-size:0.56rem;color:var(--m);margin-top:3px">Threshold: M &gt; −1.78 raises a flag</div>`
              : `<div style="font-size:0.66rem;color:var(--m)">Forensic accounting data not returned.</div>`}
          </div>
        </div>

        <!-- Trend & consistency -->
        ${trend ? `
        <div style="font-size:0.6rem;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${trend.n}-Year Trend &amp; Consistency</div>
        <div class="g4" style="margin-bottom:12px">
          <div class="kbox"><div class="kl">Revenue CAGR</div><div class="kv g">${trend.revCagr!=null?(trend.revCagr*100).toFixed(1)+'%':'N/A'}</div></div>
          <div class="kbox"><div class="kl">Growth steadiness (R²)</div><div class="kv ${trend.revR2>0.9?'g':trend.revR2>0.7?'a':'r'}">${trend.revR2!=null?trend.revR2.toFixed(2):'N/A'}</div><div class="ks">1.0 = perfectly steady</div></div>
          <div class="kbox"><div class="kl">Margin trend</div><div class="kv ${trend.opmTrend>0?'g':'r'}">${trend.opmTrend!=null?(trend.opmTrend>0?'↑ ':'↓ ')+trend.opmLatest.toFixed(1)+'%':'N/A'}</div></div>
          <div class="kbox"><div class="kl">ROCE trend</div><div class="kv ${trend.roceTrend>0?'g':'r'}">${trend.roceTrend!=null?(trend.roceTrend>0?'↑ ':'↓ ')+trend.roceLatest.toFixed(1)+'%':'N/A'}</div><div class="ks">avg ${trend.roceMean!=null?trend.roceMean.toFixed(0)+'%':'—'}</div></div>
        </div>` : ''}

        <!-- Residual income (banks) / Justified PE (peers) -->
        <div class="g2">
          ${resInc ? `
          <div class="kbox" style="padding:11px 13px;border-color:rgba(0,230,118,0.2)">
            <div style="font-size:0.6rem;font-weight:800;color:var(--g);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Residual-Income Value (Bank)</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:white">${fmtINR(resInc.value,0)}</div>
            <div style="font-size:0.6rem;color:var(--m);margin-top:3px">Justified P/B ${resInc.justifiedPB.toFixed(2)} = (ROE ${(resInc.impliedROE*100).toFixed(1)}% − g)/(Kₑ ${(resInc.ke*100).toFixed(1)}% − g). The correct rigorous bank valuation.</div>
          </div>` : ''}
          ${justPE ? `
          <div class="kbox" style="padding:11px 13px">
            <div style="font-size:0.6rem;font-weight:800;color:var(--p);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Peer-Regression Justified P/E</div>
            <div style="font-size:0.68rem;color:var(--t);line-height:1.7">Peers imply a fair P/E of <strong style="color:var(--p)">${justPE.predictedPE.toFixed(1)}×</strong> at this growth; stock trades at <strong>${justPE.actualPE?.toFixed(1)||'—'}×</strong>.<br><span style="color:${/Cheaper/.test(justPE.verdict)?'var(--g)':/Richer/.test(justPE.verdict)?'var(--r)':'var(--a)'};font-weight:700">${justPE.verdict||''}</span> <span style="color:var(--m2);font-size:0.55rem">(n=${justPE.n}, R²=${justPE.r2.toFixed(2)} — small-sample, indicative)</span></div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- RECENT NEWS & IMPACT -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-newspaper" style="color:var(--bl)"></i> Recent News &amp; Impact on Thesis</div>
        ${news?`<span style="font-size:0.56rem;color:var(--m);font-family:'JetBrains Mono',monospace">${news.count} items · ${news.pos}▲ ${news.neg}▼ ${news.neu}■</span>`:''}
      </div>
      <div class="cb">
      ${d._newsRefreshedAt ? `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 11px;border-radius:8px;margin-bottom:11px;background:var(--gb);border:1px solid rgba(0,230,118,0.2)">
        <i class="fas fa-rotate" style="color:var(--g);font-size:0.7rem"></i>
        <span style="font-size:0.64rem;color:var(--t)">News refreshed <strong>${esc(d._newsRefreshedAt)}</strong>${news&&(news.items||[]).some(n=>n._isNew)?` · <strong style="color:var(--g)">${news.items.filter(n=>n._isNew).length} new headline(s)</strong> since the stored analysis`:' · no new headlines found'}${d._newsPrev&&news?` · sentiment shift: short-term ${d._newsPrev.short==null?'–':(d._newsPrev.short>0?'+':'')+d._newsPrev.short}→${news.shortScore==null?'–':(news.shortScore>0?'+':'')+news.shortScore}, long-term ${d._newsPrev.long==null?'–':(d._newsPrev.long>0?'+':'')+d._newsPrev.long}→${news.longScore==null?'–':(news.longScore>0?'+':'')+news.longScore}`:''}</span>
      </div>`:''}
      ${!news ? `<div style="font-size:0.72rem;color:var(--m)">No recent news was returned for this stock. Try re-running, or use a model that searches more thoroughly (Gemini 2.5 Pro / Claude Opus).</div>` : (()=>{
        const A = d.news_impact_assessment || {};
        const oc = o => /pos/i.test(o||'')?'var(--g)':/neg/i.test(o||'')?'var(--r)':'var(--a)';
        const meter = sc => sc==null ? '<div style="font-size:0.58rem;color:var(--m);margin:5px 0">no clear signal</div>' :
          `<div style="height:8px;background:var(--s3);border-radius:4px;position:relative;overflow:hidden;margin:6px 0">
             <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--m2)"></div>
             <div style="position:absolute;top:0;bottom:0;${sc>=0?`left:50%;width:${sc/2}%`:`right:50%;width:${-sc/2}%`};background:${sc>=0?'var(--g)':'var(--r)'}"></div>
           </div>`;
        return `
        <div class="g2" style="margin-bottom:12px">
          <div class="kbox" style="padding:11px 13px">
            <div style="display:flex;justify-content:space-between;align-items:center"><div class="kl">Short-term (1–3 months)</div>
              <span style="font-size:0.62rem;font-weight:800;color:${oc(A.short_term?.outlook||news.shortLbl)}">${esc(A.short_term?.outlook)||news.shortLbl}${news.shortScore!=null?` · ${news.shortScore>0?'+':''}${news.shortScore}`:''}</span></div>
            ${meter(news.shortScore)}
            <div style="font-size:0.64rem;color:var(--m);line-height:1.5">${esc(A.short_term?.rationale)||'Based on weighted sentiment of recent short-horizon headlines.'}</div>
          </div>
          <div class="kbox" style="padding:11px 13px">
            <div style="display:flex;justify-content:space-between;align-items:center"><div class="kl">Long-term (multi-year thesis)</div>
              <span style="font-size:0.62rem;font-weight:800;color:${oc(A.long_term?.outlook||news.longLbl)}">${esc(A.long_term?.outlook)||news.longLbl}${news.longScore!=null?` · ${news.longScore>0?'+':''}${news.longScore}`:''}</span></div>
            ${meter(news.longScore)}
            <div style="font-size:0.64rem;color:var(--m);line-height:1.5">${esc(A.long_term?.rationale)||'Based on weighted sentiment of news flagged as fundamentally significant.'}</div>
          </div>
        </div>

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">What the news means for the business</div>
        <div class="g3" style="margin-bottom:12px">
          ${['profit','stability','trust'].map(k=>{const D=news.dims[k];return `
          <div class="kbox" style="padding:9px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center"><div class="kl">${D.name}</div>
              <span style="font-size:0.6rem;font-weight:800;color:${D.score==null?'var(--m)':D.score>15?'var(--g)':D.score<-15?'var(--r)':'var(--a)'}">${D.lbl}${D.score!=null?` · ${D.score>0?'+':''}${D.score}`:''}</span></div>
            ${meter(D.score)}
          </div>`;}).join('')}
        </div>

        <div style="display:flex;align-items:flex-start;gap:9px;padding:9px 12px;border-radius:8px;margin-bottom:12px;background:${news.aTone==='g'?'var(--gb)':news.aTone==='r'?'var(--rb)':'var(--ab)'};border:1px solid ${news.aTone==='g'?'rgba(0,230,118,0.25)':news.aTone==='r'?'rgba(255,82,82,0.25)':'rgba(255,171,64,0.25)'}">
          <i class="fas fa-scale-balanced" style="color:${news.aTone==='g'?'var(--g)':news.aTone==='r'?'var(--r)':'var(--a)'};margin-top:2px"></i>
          <div style="font-size:0.7rem;line-height:1.6;color:var(--t)"><strong>Rating ${rating} vs news flow:</strong> ${news.alignment}</div>
        </div>

        ${A.thesis_impact?`<div style="font-size:0.7rem;color:var(--m);line-height:1.6;margin-bottom:12px"><strong style="color:var(--t)">Thesis impact:</strong> ${esc(A.thesis_impact)}</div>`:''}

        ${(A.key_catalysts&&A.key_catalysts.length)?`
        <div style="font-size:0.6rem;font-weight:800;color:var(--p);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px"><i class="fas fa-bolt"></i> Catalysts to Watch</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${A.key_catalysts.map(c=>`<span style="font-size:0.62rem;font-weight:600;padding:3px 9px;border-radius:6px;background:var(--pb);color:var(--p);border:1px solid rgba(179,136,255,0.14)">${esc(c)}</span>`).join('')}</div>`:''}

        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Headline-by-Headline Impact</div>
        <div style="display:flex;flex-direction:column;gap:5px">
        ${news.items.map(n=>{
          const sc = /pos/i.test(n.sentiment)?'var(--g)':/neg/i.test(n.sentiment)?'var(--r)':'var(--a)';
          const ic = /high/i.test(n.impact||'')?'var(--r)':/low/i.test(n.impact||'')?'var(--m)':'var(--a)';
          return `<div style="padding:8px 11px;border-radius:8px;background:var(--s2);border:1px solid var(--b);border-left:3px solid ${sc}">
            <div style="font-size:0.71rem;font-weight:700;color:var(--t);margin-bottom:3px">${n._isNew?'<span style="background:var(--g);color:#000;font-size:0.48rem;font-weight:900;padding:2px 6px;border-radius:4px;margin-right:6px;vertical-align:middle">NEW</span>':''}${esc(n.headline)}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:0.54rem;color:var(--m);font-family:'JetBrains Mono',monospace">${esc(n.date)||''}</span>
              <span style="font-size:0.54rem;font-weight:800;color:${sc};text-transform:uppercase">${esc(n.sentiment)||''}</span>
              ${n.impact?`<span style="font-size:0.53rem;font-weight:700;color:${ic};border:1px solid ${ic};padding:1px 6px;border-radius:99px">${esc(n.impact)} impact</span>`:''}
              ${n.horizon?`<span style="font-size:0.53rem;font-weight:600;color:var(--bl);background:var(--blb);padding:1px 6px;border-radius:99px">${esc(n.horizon)}</span>`:''}
              ${n.source?`<span style="font-size:0.52rem;color:var(--m2)">${esc(n.source)}</span>`:''}
            </div>
            ${n.effect?`<div style="font-size:0.63rem;color:var(--m);margin-top:4px;line-height:1.5"><i class="fas fa-arrow-right-long" style="color:${sc};font-size:0.55rem"></i> ${esc(n.effect)}</div>`:''}
            ${(n.profitability_impact||n.stability_impact||n.management_trust_impact)?`
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">
              ${[['Profitability',n.profitability_impact],['Stability',n.stability_impact],['Mgmt trust',n.management_trust_impact]].map(([lbl,v])=>{
                if(!v) return '';
                const c=/pos/i.test(v)?'var(--g)':/neg/i.test(v)?'var(--r)':'var(--m)';
                const arrow=/pos/i.test(v)?'▲':/neg/i.test(v)?'▼':'■';
                return `<span style="font-size:0.52rem;font-weight:700;color:${c};background:var(--s3);padding:2px 7px;border-radius:99px">${lbl} ${arrow}</span>`;
              }).join('')}
            </div>`:''}
          </div>`;
        }).join('')}
        </div>`;
      })()}
      </div>
    </div>

    <!-- QUALITATIVE LENS -->
    ${(()=>{
      const qa = d.qualitative_assessment || {};
      const rows = [
        {k:'product_quality', lbl:'Product Quality',      ic:'fa-medal',        extra: qa.product_quality?.evidence},
        {k:'market_presence', lbl:'Market Presence',      ic:'fa-store',        extra: [qa.market_presence?.market_share, qa.market_presence?.reach].filter(Boolean)},
        {k:'demand_outlook',  lbl:'Demand for Products',  ic:'fa-fire',         extra: qa.demand_outlook?.drivers},
        {k:'growth_strategy', lbl:'Growth Strategy',      ic:'fa-route',        extra: (qa.growth_strategy?.strategies||[]).map(s=>s&&s.strategy?`${s.strategy}${s.timeline?' ('+s.timeline+')':''}${s.credibility?' — '+s.credibility+' credibility':''}`:null).filter(Boolean)},
        {k:'geopolitical',    lbl:'Geopolitical Safety',  ic:'fa-earth-asia',   extra: qa.geopolitical?.factors}
      ].filter(r=>qa[r.k] && (qa[r.k].score!=null || qa[r.k].text));
      if(!rows.length) return '';
      return `
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-magnifying-glass-chart" style="color:var(--p)"></i> Qualitative Lens — Product, Market, Demand &amp; Geopolitics</div>
        <span style="font-size:0.56rem;color:var(--m)">feeds Future Growth (25%) &amp; Quality (10%) pillars</span></div>
      <div class="cb">
        ${rows.map(r=>{
          const o = qa[r.k]; const s = o.score;
          const bc = s==null?'var(--m2)':s>70?'var(--g)':s>45?'var(--a)':'var(--r)';
          return `
        <div style="padding:9px 0;border-bottom:1px solid var(--b)">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:5px">
            <i class="fas ${r.ic}" style="color:${bc};width:15px;font-size:0.75rem"></i>
            <div style="font-size:0.72rem;font-weight:700;color:var(--t);width:150px;flex-shrink:0">${r.lbl}</div>
            <div class="qs-bg"><div class="qs-fill" style="width:${s!=null?s:0}%;background:${bc}"></div></div>
            <div class="qs-val" style="color:${bc}">${s!=null?s:'N/A'}</div>
          </div>
          ${o.text?`<div style="font-size:0.68rem;color:var(--m);line-height:1.55;margin-left:24px">${esc(o.text)}</div>`:''}
          ${(r.extra&&r.extra.length)?`<div class="pills" style="margin-left:24px">${r.extra.map(e=>`<span class="pb2">${esc(e)}</span>`).join('')}</div>`:''}
        </div>`;}).join('')}
        <div style="font-size:0.6rem;color:var(--m2);margin-top:9px;line-height:1.5">Scores are AI-assessed from searched evidence (0–100, higher = better / safer) and flow into the composite: Demand &amp; Strategy → Future Growth pillar; Product &amp; Market → Quality pillar; Geopolitical → Policy &amp; Geo pillar.</div>
      </div>
    </div>`;
    })()}

    <!-- TARGET LADDER + SCENARIO ANALYSIS -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-stairs" style="color:var(--g)"></i> Exit-Point Ladder — Short &amp; Long-Term Targets</div>
        <span style="font-size:0.56rem;color:var(--m)">multiple re-rates gradually — near-term targets are earnings-driven</span></div>
      <div class="cb">
        ${ladder ? `
        <table class="dcf-t" style="margin-bottom:10px">
          <tr><th>Horizon</th><th></th><th style="color:var(--r)">Bear</th><th style="color:var(--a)">Base — exit reference</th><th style="color:var(--g)">Bull</th><th>Base return /yr (incl. div)</th></tr>
          ${ladder.map(r=>`
          <tr${r.k==='1Y'?' style="border-bottom:2px solid var(--b2)"':''}>
            <td style="font-weight:700;color:var(--t)">${r.label}</td>
            <td><span style="font-size:0.5rem;font-weight:800;padding:1px 6px;border-radius:99px;${r.term==='short'?'background:var(--blb);color:var(--bl)':'background:var(--pb);color:var(--p)'}">${r.term==='short'?'SHORT-TERM':'LONG-TERM'}</span></td>
            <td style="color:var(--r)">${fmtINR(r.bear.px,0)} <span style="font-size:0.55rem">(${fmtP(r.bear.ret)})</span></td>
            <td style="color:var(--a);font-weight:700">${fmtINR(r.base.px,0)} <span style="font-size:0.55rem">(${fmtP(r.base.ret)})</span></td>
            <td style="color:var(--g)">${fmtINR(r.bull.px,0)} <span style="font-size:0.55rem">(${fmtP(r.bull.ret)})</span></td>
            <td style="color:var(--bl)">${fmtP(r.base.cagrTotal)}</td>
          </tr>`).join('')}
        </table>
        <div style="font-size:0.62rem;color:var(--m);line-height:1.6;padding:8px 11px;background:var(--s2);border-radius:7px;border:1px solid var(--b);margin-bottom:14px">
          <strong style="color:var(--t)">How to use this:</strong> the <strong style="color:var(--a)">base column is your exit reference</strong> — if the price reaches the 6-month or 1-year base target well ahead of schedule, the easy gains are in and trimming is rational; if it reaches the bull number, the market is paying tomorrow's price today. <strong style="color:var(--r)">Honesty note:</strong> 6-month moves are dominated by market mood, not fundamentals — treat short-term rows as planning references with wide error bars, and the 2–5 year rows as where this analysis actually has an edge.
        </div>` : '<div style="font-size:0.72rem;color:var(--m);margin-bottom:10px">EPS and price data required for the target ladder.</div>'}
        <div style="font-size:0.6rem;font-weight:800;color:var(--m);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">5-Year Range Visualised</div>
        ${scenHTML}
      </div>
    </div>

    <!-- VALUATION MODELS -->
    <div class="card rs">
      <div class="ch">
        <div class="ct"><i class="fas fa-scale-balanced" style="color:var(--bl)"></i> Multi-Model Valuation — Weighted Average</div>
        <span class="ap ${fv&&d.current_price?(fv>d.current_price*1.1?'aU':fv>d.current_price*0.9?'aF':'aO'):'aF'}">${fv&&d.current_price?(fv>d.current_price*1.1?'Undervalued':fv>d.current_price*0.9?'Fairly Valued':'Overvalued'):'—'}</span>
      </div>
      <div class="cb">
        ${models.map(m=>{
          const up = (m.val-d.current_price)/d.current_price*100;
          const bw = (m.val/maxM*100).toFixed(1);
          return `<div class="mrow">
            <div class="mnm">${m.nm}</div>
            <div class="mbar-bg"><div class="mbar-fill" style="width:${bw}%;background:${m.col}"></div></div>
            <div class="mval" style="color:${m.col}">${fmtINR(m.val,0)}</div>
            <div class="mups" style="color:${up>=0?'var(--g)':'var(--r)'}">${up>=0?'+':''}${up.toFixed(1)}%</div>
          </div>`;
        }).join('')}
        <div style="background:var(--s2);border:1px solid var(--b);border-radius:6px;height:1px;margin:6px 0 10px"></div>
        <div class="mavg-row">
          <div>
            <div style="font-size:0.65rem;font-weight:800;color:var(--t);text-transform:uppercase;letter-spacing:0.06em">Weighted Avg Fair Value</div>
            <div style="font-size:0.58rem;color:var(--m);margin-top:2px">${d.business_type==='BANKING_NBFC'?'P/B×60% + Graham×25% + Lynch×15% (DCF & EV/EBITDA excluded — not meaningful for banks)':'EPS-DCF×35% + FCFF×15% + Lynch×25% + EV/EBITDA×25% (Graham = floor only; EPS-DCF takes 50% when FCFF data is missing)'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:700;color:var(--g)">${fv?fmtINR(fv,0):'N/A'}</div>
            ${fv&&d.current_price?`<div style="font-size:0.62rem;font-weight:700;color:${fv>d.current_price?'var(--g)':'var(--r)'}">${fv>d.current_price?'+':''}${((fv/d.current_price-1)*100).toFixed(1)}% vs CMP</div>`:''}
          </div>
        </div>
        ${(()=>{ const sp=calcFVSpread(models.map(m=>m.val)); if(!sp) return ''; return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:8px 11px;border-radius:8px;background:${sp.wide?'var(--ab)':'var(--s2)'};border:1px solid ${sp.wide?'rgba(255,171,64,0.25)':'var(--b)'}">
          <div style="font-size:0.6rem;font-weight:700;color:${sp.wide?'var(--a)':'var(--m)'};text-transform:uppercase;letter-spacing:0.05em">${sp.wide?'<i class="fas fa-triangle-exclamation"></i> Models disagree widely':'Model range'}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;font-weight:700;color:var(--t)">${fmtINR(sp.lo,0)} – ${fmtINR(sp.hi,0)} <span style="color:var(--m);font-weight:600">(${sp.ratio.toFixed(1)}× spread)</span></div>
        </div>
        ${sp.wide?`<div style="font-size:0.6rem;color:var(--m);margin-top:5px;line-height:1.5">The four models span more than 2×, so the blended midpoint is a weak signal — treat the <strong style="color:var(--a)">range</strong>, not the single number, as the fair-value estimate. Wide spreads are common for high-growth names (Graham/EV understate them) and deep cyclicals.</div>`:''}`; })()}

        <!-- FORMULAS -->
        <details style="margin-top:12px">
          <summary><i class="fas fa-chevron-right"></i> View Calculation Formulas &amp; Assumptions</summary>
          <div class="formula" style="margin-top:8px">
<span class="cm"># ── Constants ──────────────────────────────────────────────</span>
WACC          = <span class="vl">12.0%</span>  <span class="cm">(India RFR 7% + Equity Risk Premium 5%)</span>
Terminal g    = <span class="vl">5.5%</span>   <span class="cm">(India long-run GDP ~6.5% + CPI ~4% blended)</span>
Growth (5Y)   = <span class="vl">${pct(d._g*100)}/yr</span>  <span class="cm">(Historical CAGR × 0.55, hard cap 35%)</span>
DCF Margin-of-Safety = <span class="vl">10%</span>   <span class="cm">(applied to DCF only)</span>

<span class="cm"># ── Model 1: DCF (10Y, 3-Phase) ───────────────────────────</span>
Phase 1 (yr 1-5):  EPS grows at <span class="vl">${pct(d._g*100)}</span> p.a.
Phase 2 (yr 6-10): Growth decays linearly → Terminal g
Terminal Value = EPS_yr10 × (1+g_term) × ExitPE / (1+WACC)^10
Exit PE = <span class="vl">${dcf?dcf.exitPE.toFixed(1)+'x':'N/A'}</span>  <span class="cm">(Sector_PE×0.70, floored 12x, capped 28x)</span>
DCF Fair Value = Σ(Discounted EPS) + Terminal PV − 10% MoS

<span class="cm"># ── Model 2: Graham Number (Benjamin Graham) ──────────────</span>
= √(22.5 × EPS × BVPS)
= √(22.5 × <span class="vl">${(d.eps_ttm||0).toFixed(2)}</span> × <span class="vl">${(d.book_value_per_share||0).toFixed(2)}</span>)
= <span class="vl">${graham?fmtINR(graham,0):'N/A'}</span>  <span class="cm">(Based on P/E≤15 AND P/B≤1.5 → 15×1.5=22.5)</span>

<span class="cm"># ── Model 3: Peter Lynch Fair Value ───────────────────────</span>
= EPS × min(GrowthRate_pct, 40)
= <span class="vl">${(d.eps_ttm||0).toFixed(2)}</span> × <span class="vl">${Math.min((d._g||0)*100,40).toFixed(1)}</span>
= <span class="vl">${lynch?fmtINR(lynch,0):'N/A'}</span>  <span class="cm">(P/E should not exceed growth rate in %)</span>

<span class="cm"># ── Model 4: EV/EBITDA Relative ───────────────────────────</span>
Fair EV = EBITDA × Sector_EV_EBITDA
= <span class="vl">${d.ebitda_cr||'N/A'} Cr</span> × <span class="vl">${d.sector_ev_ebitda_avg||'N/A'}x</span>
Fair Price = (Fair_EV − Debt + Cash) ÷ Shares
= (<span class="vl">${((d.ebitda_cr||0)*(d.sector_ev_ebitda_avg||0)).toFixed(0)} Cr</span> − <span class="vl">${d.total_debt_cr||0} Cr</span> + <span class="vl">${d.cash_cr||0} Cr</span>) ÷ <span class="vl">${d.shares_outstanding_cr||'N/A'} Cr</span>
= <span class="vl">${ev?fmtINR(ev,0):'N/A'}</span>

<span class="cm"># ── PEG Ratio ──────────────────────────────────────────────</span>
= P/E ÷ PAT_CAGR_pct = <span class="vl">${(d.pe_ratio||0).toFixed(1)}</span> ÷ <span class="vl">${(d.profit_cagr_3yr_pct||0).toFixed(1)}</span> = <span class="vl">${peg?peg.toFixed(2):'N/A'}</span>
<span class="cm">  PEG&lt;1 = bargain · PEG 1-1.5 = fair · PEG&gt;2 = expensive</span>
          </div>
        </details>

        <!-- DCF TABLE -->
        ${dcf?`<details style="margin-top:9px">
          <summary><i class="fas fa-chevron-right"></i> View DCF Year-by-Year Breakdown</summary>
          <div style="overflow-x:auto;margin-top:8px">
            <table class="dcf-t">
              <thead><tr><th>Period</th><th>Growth</th><th>EPS</th><th>PV Factor</th><th>Disc. EPS</th><th>Cumul. PV</th></tr></thead>
              <tbody>
                ${dcfRows}
                <tr class="tvrow"><td colspan="4">Terminal Value (Exit PE: ${dcf.exitPE.toFixed(1)}x) — ${(dcf.termPV/dcf.cumPV*100).toFixed(0)}% of Total</td><td colspan="2">${fmtINR(dcf.termPV,0)}</td></tr>
                <tr class="totrow"><td colspan="4">Intrinsic Value (pre-MoS)</td><td colspan="2">${fmtINR(dcf.cumPV,0)}</td></tr>
                <tr class="totrow"><td colspan="4">DCF Fair Value (10% Margin of Safety)</td><td colspan="2">${fmtINR(dcf.fairVal,0)}</td></tr>
              </tbody>
            </table>
          </div>
        </details>`:''}
      </div>
    </div>

    <!-- COMPOSITE SCORES + CHECKLIST -->
    <div class="g2 rs">
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-gauge-high" style="color:var(--g)"></i> Composite Quality Score</div></div>
        <div class="cb">
          <div class="g3" style="margin-bottom:14px">
            ${[{l:'Financial Strength (30%)',v:sc.fScore,c:'var(--g)'},{l:'Future Growth (25%)',v:sc.gScore,c:'#00e5ff'},{l:'Valuation (20%)',v:sc.vScore,c:'var(--bl)'},{l:'Quality & Market (10%)',v:sc.qScore,c:'var(--a)'},{l:'Management (10%)',v:sc.mScore,c:'var(--p)'},{l:'Policy & Geo (5%)',v:sc.pScore,c:'var(--m)'}]
              .map(s=>`<div class="cs-box"><div class="cs-lbl">${s.l}</div><div class="cs-val" style="color:${s.c}">${s.v.toFixed(0)}</div><div class="ks">/100</div></div>`).join('')}
          </div>
          <div style="border-top:1px solid var(--b);padding-top:12px">
            <div class="qs-row"><div class="qs-lbl" style="font-weight:800;color:var(--g)">Composite (weighted)</div><div class="qs-bg"><div class="qs-fill" style="width:${sc.composite}%;background:linear-gradient(90deg,var(--g2),#00acc1)"></div></div><div class="qs-val" style="color:var(--g)">${sc.composite.toFixed(0)}</div></div>
            <div style="font-size:0.6rem;color:var(--m);margin-top:5px;line-height:1.6">Financial×30% + Future&nbsp;Growth×25% + Valuation×20% + Quality&nbsp;&amp;&nbsp;Market×10% + Management×10% + Policy&nbsp;&amp;&nbsp;Geo×5%<br>Score &gt;74 = HIGH confidence · 57-74 = MEDIUM · &lt;57 = LOW</div>
          </div>
          <details style="margin-top:12px">
            <summary><i class="fas fa-chevron-right"></i> Score Sub-Components</summary>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
              ${[
                {l:'Revenue CAGR (3Y)',v:d.revenue_cagr_3yr_pct,s:'%',lo:5,hi:40,inv:false},
                {l:'PAT CAGR (3Y)',v:d.profit_cagr_3yr_pct,s:'%',lo:5,hi:50,inv:false},
                {l:'ROE',v:d.roe_pct,s:'%',lo:10,hi:35,inv:false},
                {l:'ROCE',v:d.roce_pct,s:'%',lo:12,hi:40,inv:false},
                {l:'Net Margin',v:d.net_margin_pct,s:'%',lo:5,hi:20,inv:false},
                {l:'D/E Ratio (lower=better)',v:d.debt_to_equity,s:'x',lo:0,hi:2,inv:true},
                {l:'Interest Coverage',v:d.interest_coverage,s:'x',lo:1,hi:20,inv:false}
              ].map(s=>{
                if(s.v==null) return `<div class="qs-row"><div class="qs-lbl" style="font-size:0.63rem">${s.l}</div><div class="qs-val" style="color:var(--m)">N/A</div></div>`;
                const score = s.inv
                  ? Math.max(0,Math.min(100,(s.hi-s.v)/(s.hi-s.lo)*100))
                  : Math.max(0,Math.min(100,(s.v-s.lo)/(s.hi-s.lo)*100));
                const bc = score>70?'var(--g)':score>45?'var(--a)':'var(--r)';
                return `<div class="qs-row"><div class="qs-lbl" style="font-size:0.63rem">${s.l} <span style="color:var(--bl)">(${s.v.toFixed(1)}${s.s})</span></div><div class="qs-bg"><div class="qs-fill" style="width:${score.toFixed(0)}%;background:${bc}"></div></div><div class="qs-val" style="color:${bc};font-size:0.65rem">${score.toFixed(0)}</div></div>`;
              }).join('')}
            </div>
          </details>
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-list-check" style="color:var(--g)"></i> Multibagger Checklist — Threshold-Based</div><span class="ap ${passCount>=8?'aU':passCount>=6?'aF':'aO'}">${passCount}/10</span></div>
        <div class="cb">
          <div class="clgrid">
            ${cl.map(x=>`<div class="ci ${x.pass?'pass':'fail'}"><i class="fas ${x.pass?'fa-circle-check':'fa-circle-xmark'} cico"></i><div><div>${x.lbl}</div><span class="ci-sub">${x.sub}</span></div></div>`).join('')}
          </div>
          <div class="cscore">Passed <span>${passCount}</span>/10 — ${passCount>=8?'Strong Multibagger Profile':passCount>=6?'Good Candidate':passCount>=4?'Moderate Potential':'Weak Profile'}</div>
        </div>
      </div>
    </div>

    <!-- FINANCIALS + QUARTERLY -->
    <div class="g2 rs">
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-chart-pie" style="color:var(--p)"></i> Financial Health</div></div>
        <div class="cb">
          <div class="g3" style="margin-bottom:11px">
            <div class="kbox"><div class="kl">Revenue CAGR (3Y)</div><div class="kv g">${pct(d.revenue_cagr_3yr_pct)}</div></div>
            <div class="kbox"><div class="kl">PAT CAGR (3Y)</div><div class="kv g">${pct(d.profit_cagr_3yr_pct)}</div></div>
            <div class="kbox"><div class="kl">EPS CAGR (3Y)</div><div class="kv g">${pct(d.eps_cagr_3yr_pct)}</div></div>
            <div class="kbox"><div class="kl">Op. Margin</div><div class="kv">${pct(d.operating_margin_pct)}</div></div>
            <div class="kbox"><div class="kl">Net Margin</div><div class="kv">${pct(d.net_margin_pct)}</div></div>
            <div class="kbox"><div class="kl">Int. Coverage</div><div class="kv ${(d.interest_coverage||0)>5?'g':'r'}">${d.interest_coverage!=null?d.interest_coverage.toFixed(1)+'x':'N/A'}</div></div>
            <div class="kbox"><div class="kl">ROE</div><div class="kv b">${pct(d.roe_pct)}</div></div>
            <div class="kbox"><div class="kl">ROCE</div><div class="kv b">${pct(d.roce_pct)}</div></div>
            <div class="kbox"><div class="kl">Debt / Equity</div><div class="kv ${(d.debt_to_equity||1)<0.5?'g':(d.debt_to_equity||1)<1?'a':'r'}">${d.debt_to_equity!=null?d.debt_to_equity.toFixed(2)+'x':'N/A'}</div></div>
          </div>
          <div class="g4">
            <div class="kbox"><div class="kl">P/E</div><div class="kv">${d.pe_ratio?.toFixed(1)||'N/A'}</div><div class="ks">Sector: ${d.sector_pe_avg?.toFixed(1)||'N/A'}</div></div>
            <div class="kbox"><div class="kl">P/B</div><div class="kv">${d.pb_ratio?.toFixed(2)||'N/A'}</div><div class="ks">Sector: ${d.sector_pb_avg?.toFixed(2)||'N/A'}</div></div>
            <div class="kbox"><div class="kl">EV/EBITDA</div><div class="kv">${d.ev_ebitda?.toFixed(1)||'N/A'}</div><div class="ks">Sector: ${d.sector_ev_ebitda_avg?.toFixed(1)||'N/A'}</div></div>
            <div class="kbox" style="background:var(--gb);border-color:rgba(0,230,118,0.15)"><div class="kl" style="color:var(--g)">PEG Ratio</div><div class="kv ${peg&&peg<1.5?'g':peg&&peg<2?'a':'r'}" style="font-size:1.1rem">${peg?peg.toFixed(2):'N/A'}</div><div class="ks">&lt;1.0 = buy signal</div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-calendar-check" style="color:var(--a)"></i> Recent Quarterly Results</div></div>
        <div style="overflow-x:auto">
          <table class="qtbl">
            <thead><tr><th>Quarter</th><th>Revenue (Cr)</th><th>PAT (Cr)</th><th>YoY</th><th>PAT Margin</th><th>Highlight</th></tr></thead>
            <tbody>
              ${(d.quarterly_results||[]).map(q=>{
                const mg = q.revenue_cr&&q.profit_cr?(q.profit_cr/q.revenue_cr*100).toFixed(1)+'%':'N/A';
                const up = (q.yoy_growth_pct||0)>0;
                return `<tr>
                  <td style="font-weight:700;color:white;font-family:'JetBrains Mono',monospace">${esc(q.quarter)}</td>
                  <td style="font-family:'JetBrains Mono',monospace">&#8377;${q.revenue_cr?.toLocaleString()||'N/A'}</td>
                  <td style="font-family:'JetBrains Mono',monospace">&#8377;${q.profit_cr?.toLocaleString()||'N/A'}</td>
                  <td class="${up?'up':'dn'}">${q.yoy_growth_pct!=null?(up?'+':'')+q.yoy_growth_pct.toFixed(1)+'%':'N/A'}</td>
                  <td style="color:var(--m);font-family:'JetBrains Mono',monospace">${mg}</td>
                  <td style="font-size:0.67rem;color:var(--m)">${esc(q.highlights)||'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MANAGEMENT + GOVT -->
    <div class="g2 rs">
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-users" style="color:var(--bl)"></i> Management &amp; Governance</div></div>
        <div class="cb">
          <div class="g4" style="margin-bottom:12px">
            <div class="kbox" style="background:var(--gb);border-color:rgba(0,230,118,0.15)"><div class="kl">Promoter Hold.</div><div class="kv g" style="font-size:1.3rem">${pct(d.promoter_holding_pct)}</div></div>
            <div class="kbox" style="${(d.promoter_pledge_pct||0)>10?'background:var(--rb);border-color:rgba(255,82,82,0.15)':''}"><div class="kl">Pledge %</div><div class="kv ${(d.promoter_pledge_pct||0)>10?'r':'g'}" style="font-size:1.3rem">${pct(d.promoter_pledge_pct)}</div></div>
            <div class="kbox"><div class="kl">FII Hold.</div><div class="kv b" style="font-size:1rem">${pct(d.fii_holding_pct)}</div></div>
            <div class="kbox"><div class="kl">DII Hold.</div><div class="kv" style="font-size:1rem">${pct(d.dii_holding_pct)}</div></div>
          </div>
          <div style="margin-bottom:11px">
            <div class="kl" style="margin-bottom:5px">Management Track Record Score</div>
            <div class="qs-row" style="margin:0"><div class="qs-bg"><div class="qs-fill" style="width:${d.management_track_record_score||50}%;background:${(d.management_track_record_score||50)>70?'var(--g)':'var(--a)'}"></div></div><div class="qs-val" style="color:${(d.management_track_record_score||50)>70?'var(--g)':'var(--a)'}">${d.management_track_record_score||'N/A'}</div></div>
          </div>
          ${d.management_profile?.trust_score!=null?`
          <div style="margin-bottom:11px">
            <div class="kl" style="margin-bottom:5px">Trust &amp; Reliability Score <span style="text-transform:none;letter-spacing:0;color:var(--m2)">(governance, promises kept, integrity)</span></div>
            <div class="qs-row" style="margin:0"><div class="qs-bg"><div class="qs-fill" style="width:${d.management_profile.trust_score}%;background:${d.management_profile.trust_score>70?'var(--g)':d.management_profile.trust_score>45?'var(--a)':'var(--r)'}"></div></div><div class="qs-val" style="color:${d.management_profile.trust_score>70?'var(--g)':d.management_profile.trust_score>45?'var(--a)':'var(--r)'}">${d.management_profile.trust_score}</div></div>
          </div>`:''}
          ${(d.management_profile?.governance_flags||[]).length?`
          <div style="margin-bottom:11px">
            <div class="kl" style="margin-bottom:5px">Governance Flags</div>
            ${d.management_profile.governance_flags.map(f=>{const clean=/^\s*none/i.test(f);return `<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px"><i class="fas ${clean?'fa-circle-check':'fa-triangle-exclamation'}" style="color:${clean?'var(--g)':'var(--r)'};font-size:0.62rem;margin-top:3px;flex-shrink:0"></i><span style="font-size:0.68rem;color:${clean?'var(--m)':'var(--t)'}">${esc(f)}</span></div>`;}).join('')}
          </div>`:''}
          ${(d.management_profile?.key_persons||[]).map(p=>`<div style="font-size:0.73rem;color:var(--t);margin-bottom:4px"><i class="fas fa-user-tie" style="color:var(--m);margin-right:5px;font-size:0.58rem"></i>${esc(p)}</div>`).join('')}
          ${d.management_profile?.recent_moves?.length?`<div style="margin-top:10px"><div class="kl" style="margin-bottom:5px">Recent Moves</div>${d.management_profile.recent_moves.map(m=>`<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px"><i class="fas fa-circle" style="color:var(--bl);font-size:0.32rem;margin-top:5px;flex-shrink:0"></i><span style="font-size:0.7rem;color:var(--m)">${esc(m)}</span></div>`).join('')}</div>`:''}
          ${d.management_profile?.commentary?`<div class="comm">${esc(d.management_profile.commentary)}</div>`:''}
        </div>
      </div>
      <div class="card">
        <div class="ch">
          <div class="ct"><i class="fas fa-landmark" style="color:var(--g)"></i> Government Policy &amp; Tailwinds</div>
          <div class="tw-segs">${[1,2,3,4,5].map(i=>`<div class="tw-s ${i<=twFill?(twFill>=4?'ag':'aa'):''}"></div>`).join('')}</div>
        </div>
        <div class="cb">
          ${d.government_support_detail?.budget_allocation?`<div class="kbox" style="margin-bottom:11px;background:var(--gb);border-color:rgba(0,230,118,0.15)"><div class="kl" style="color:var(--g)">Budget / Policy Target</div><div style="font-size:0.76rem;font-weight:700;color:var(--g);margin-top:3px">${esc(d.government_support_detail.budget_allocation)}</div></div>`:''}
          ${(d.government_support_detail?.schemes||[]).map(s=>`<div class="sci"><i class="fas fa-file-invoice" style="color:var(--g);font-size:0.8rem;margin-top:2px;flex-shrink:0"></i><div><div style="font-size:0.75rem;font-weight:700;color:white;margin-bottom:2px">${esc(s.name)}</div><div style="font-size:0.68rem;color:var(--m)">${esc(s.benefit)}</div><div style="font-size:0.58rem;font-weight:700;margin-top:2px;color:${s.impact==='High'?'var(--g)':s.impact==='Medium'?'var(--a)':'var(--m)'}">Impact: ${esc(s.impact)}</div></div></div>`).join('')}
          ${d.government_support_detail?.policy_commentary?`<div class="comm">${esc(d.government_support_detail.policy_commentary)}</div>`:''}
        </div>
      </div>
    </div>

    <!-- SECTOR + MOAT -->
    <div class="g2 rs">
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-industry" style="color:var(--p)"></i> Sector Analysis</div></div>
        <div class="cb">
          <div class="g4" style="margin-bottom:11px">
            <div class="kbox"><div class="kl">Market Now</div><div class="kv b" style="font-size:0.78rem">${esc(d.sector_detail?.market_size_current)||'N/A'}</div></div>
            <div class="kbox"><div class="kl">Market 2030</div><div class="kv g" style="font-size:0.78rem">${esc(d.sector_detail?.market_size_2030)||'N/A'}</div></div>
            <div class="kbox"><div class="kl">Sector CAGR</div><div class="kv g" style="font-size:0.78rem">${esc(d.sector_detail?.cagr_forecast_text)||'N/A'}</div></div>
            <div class="kbox"><div class="kl">Stage</div><div class="kv a" style="font-size:0.78rem">${esc(d.sector_detail?.sector_stage)||'N/A'}</div></div>
          </div>
          <div style="margin-bottom:9px">
            <div class="kl" style="margin-bottom:5px">Sector Stage Progression</div>
            <div class="stage-bar">${['Nascent','Growth','Mature','Declining'].map((_,i)=>`<div class="sb-s ${i<stageIdx?'on':''}"></div>`).join('')}</div>
            <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:0.48rem;color:var(--m);font-weight:600;text-transform:uppercase"><span>Nascent</span><span>Growth</span><span>Mature</span><span>Declining</span></div>
          </div>
          <div class="pills">${(d.sector_detail?.mega_trends||[]).map(t=>`<span class="pp">${esc(t)}</span>`).join('')}</div>
          ${d.sector_detail?.commentary?`<div class="comm">${esc(d.sector_detail.commentary)}</div>`:''}
        </div>
      </div>
      <div class="card">
        <div class="ch"><div class="ct"><i class="fas fa-shield-halved" style="color:var(--a)"></i> Competitive Moat</div></div>
        <div class="cb">
          <div class="kbox" style="margin-bottom:12px"><div class="kl">Moat Type</div><div style="font-size:0.85rem;font-weight:700;color:white;margin-top:4px">${esc(d.moat_type)||'N/A'}</div></div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px"><div class="kl">Competitive Position Score</div><span style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--g)">${d.competitive_position_score||'N/A'}/100</span></div>
            <div style="display:flex;align-items:center;gap:8px"><div class="moat-bg"><div class="moat-fill" style="width:${d.competitive_position_score||0}%"></div></div></div>
          </div>
          <div class="kbox" style="margin-bottom:12px"><div class="kl">Business Scalability Score</div><div class="kv g">${d.business_scalability_score||'N/A'}/100</div></div>
          ${d.competitive_moat_text?`<div class="comm">${esc(d.competitive_moat_text)}</div>`:''}
        </div>
      </div>
    </div>

    <!-- BUSINESS OVERVIEW -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-building" style="color:var(--bl)"></i> Business Overview &amp; Future Plans</div></div>
      <div class="cb">
        <p style="font-size:0.76rem;line-height:1.7;color:var(--m);margin-bottom:12px">${esc(d.business_overview?.description)||'—'}</p>
        <div class="g2" style="margin-bottom:12px">
          <div class="kbox"><div class="kl">Revenue Model</div><div style="font-size:0.73rem;font-weight:500;color:var(--t);margin-top:4px">${esc(d.business_overview?.revenue_model)||'—'}</div></div>
          ${d.business_overview?.order_book?`<div class="kbox" style="background:var(--gb);border-color:rgba(0,230,118,0.15)"><div class="kl" style="color:var(--g)">Order Book / Backlog</div><div style="font-size:0.82rem;font-weight:700;color:var(--g);margin-top:4px">${esc(d.business_overview.order_book)}</div></div>`:'<div></div>'}
        </div>
        <div class="g2">
          <div>
            <div class="kl" style="margin-bottom:7px">Future Plans</div>
            ${(d.business_overview?.future_plans||[]).map(p=>`<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px"><i class="fas fa-arrow-right" style="color:var(--g);font-size:0.58rem;margin-top:4px;flex-shrink:0"></i><span style="font-size:0.73rem;color:var(--t)">${esc(p)}</span></div>`).join('')}
          </div>
          <div>
            <div class="kl" style="margin-bottom:7px">Key Products / Services</div>
            <div class="pills">${(d.business_overview?.key_products||[]).map(p=>`<span class="pb2">${esc(p)}</span>`).join('')}</div>
            ${d.business_overview?.capacity_expansion?`<div class="kbox" style="margin-top:9px"><div class="kl">Capacity Expansion</div><div style="font-size:0.73rem;color:var(--t);margin-top:4px">${esc(d.business_overview.capacity_expansion)}</div></div>`:''}
          </div>
        </div>
      </div>
    </div>

    <!-- COMPETITORS -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-chess" style="color:var(--bl)"></i> Competitive Landscape</div></div>
      <div style="overflow-x:auto">
        <table class="ctbl">
          <thead><tr><th>Company</th><th>Ticker</th><th>Mkt Cap (Cr)</th><th>P/E</th><th>Rev. Growth</th><th>Key Strength</th></tr></thead>
          <tbody>
            ${(d.competitors||[]).map(c=>`<tr class="${c.is_target?'self':''}">
              <td style="font-weight:700;color:white">${esc(c.name)}${c.is_target?'<span style="background:var(--g);color:#000;font-size:0.48rem;font-weight:900;padding:2px 5px;border-radius:3px;margin-left:5px;vertical-align:middle">TARGET</span>':''}</td>
              <td style="font-family:\'JetBrains Mono\',monospace;font-size:0.66rem;color:var(--m)">${esc(c.ticker)||'—'}</td>
              <td style="font-family:\'JetBrains Mono\',monospace">&#8377;${c.market_cap_cr?.toLocaleString()||'N/A'}</td>
              <td style="font-family:\'JetBrains Mono\',monospace">${c.pe?.toFixed(1)||'N/A'}x</td>
              <td class="${(c.revenue_growth_pct||0)>0?'up':'dn'}">${c.revenue_growth_pct!=null?(c.revenue_growth_pct>0?'+':'')+c.revenue_growth_pct.toFixed(1)+'%':'N/A'}</td>
              <td style="font-size:0.68rem;color:var(--m)">${esc(c.strength)||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- RISKS -->
    <div class="card rs">
      <div class="ch"><div class="ct"><i class="fas fa-triangle-exclamation" style="color:var(--r)"></i> Risk Factors</div></div>
      <div class="cb">
        ${(d.risks||[]).map(r=>`<div class="ri"><span class="rsev s${r.severity[0]}">${esc(r.severity)}</span><div><div class="rf">${esc(r.factor)}</div><div class="rm"><i class="fas fa-shield" style="color:var(--g);margin-right:4px;font-size:0.58rem"></i>${esc(r.mitigation)}</div></div></div>`).join('')}
      </div>
    </div>

    <div class="disc rs">
      <strong>&#9888;&#65039; Disclaimer:</strong> This tool is for <strong>educational and research purposes only</strong>. All calculations use regressed growth rates and standard academic valuation models (DCF, Graham Number, Peter Lynch, EV/EBITDA). Target prices are probability-weighted projections under stated assumptions — not guarantees. Indian equity markets carry significant risk. Past performance does not predict future returns. Consult a SEBI-registered investment advisor before making investment decisions.
    </div>
  </div>`;

  const el = document.getElementById('report');
  el.innerHTML = html;
  el.style.display = 'block';
}
