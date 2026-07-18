// ════════════════════════════════════════════════════════
// AI PROVIDER LAYER — Claude (Anthropic) or Gemini (Google)
// Claude fetches raw numbers via web_search; Gemini via google_search
// grounding. Both return text → JSON is extracted the same way.
// ════════════════════════════════════════════════════════
const AI_CONFIG = {
  claude: {
    label:'Claude (Anthropic)',
    keyHint:'Anthropic key — starts with sk-ant-',
    keyLink:'https://console.anthropic.com/settings/keys',
    placeholder:'Anthropic API Key  sk-ant-…',
    defaultModel:'claude-sonnet-4-6',
    models:[
      { id:'claude-opus-4-8',           label:'Claude Opus 4.8 — most capable' },
      { id:'claude-sonnet-4-6',         label:'Claude Sonnet 4.6 — balanced (recommended)' },
      { id:'claude-haiku-4-5-20251001', label:'Claude Haiku 4.5 — fastest / cheapest' }
    ]
  },
  gemini: {
    label:'Gemini (Google)',
    keyHint:'Google AI Studio key — starts with AIza',
    keyLink:'https://aistudio.google.com/apikey',
    placeholder:'Google AI Studio API Key  AIza…',
    defaultModel:'gemini-3.5-flash',
    models:[
      { id:'gemini-3.5-flash',      label:'Gemini 3.5 Flash — near-Pro, fast (recommended)' },
      { id:'gemini-3.1-flash',      label:'Gemini 3.1 Flash — fast' },
      { id:'gemini-3.1-flash-lite', label:'Gemini 3.1 Flash-Lite — cheapest' },
      { id:'gemini-2.5-pro',        label:'Gemini 2.5 Pro — deep reasoning' },
      { id:'gemini-2.5-flash',      label:'Gemini 2.5 Flash — fast' }
    ]
  }
};

function curProvider(){ return document.getElementById('ai-provider').value || 'claude'; }
function curModel(){ return document.getElementById('ai-model').value; }

function populateProviders(){
  const sel = document.getElementById('ai-provider');
  sel.innerHTML = Object.keys(AI_CONFIG).map(k=>`<option value="${k}">${AI_CONFIG[k].label}</option>`).join('');
  const saved = localStorage.getItem('ai_provider');
  if(saved && AI_CONFIG[saved]) sel.value = saved;
}

function populateModels(list){
  const p = curProvider(), cfg = AI_CONFIG[p];
  const models = list || cfg.models;
  const sel = document.getElementById('ai-model');
  sel.innerHTML = models.map(m=>`<option value="${m.id}">${m.label||m.id}</option>`).join('');
  const saved = localStorage.getItem('ai_model_'+p);
  sel.value = (saved && models.some(m=>m.id===saved)) ? saved : cfg.defaultModel;
}

function onProviderChange(){
  const p = curProvider(), cfg = AI_CONFIG[p];
  localStorage.setItem('ai_provider', p);
  document.getElementById('api-key').placeholder   = cfg.placeholder;
  document.getElementById('key-hint').textContent  = cfg.keyHint;
  document.getElementById('get-key-link').href     = cfg.keyLink;
  document.getElementById('model-status').textContent = '';
  populateModels();
}

function saveModelChoice(){ localStorage.setItem('ai_model_'+curProvider(), curModel()); }

// Best-effort: pull the live model list from the provider so the dropdown
// never goes stale. Needs the API key. Falls back silently on failure.
async function loadLiveModels(){
  const p = curProvider();
  const key = document.getElementById('api-key').value.trim();
  const status = document.getElementById('model-status');
  if(!key){ status.textContent = '· enter your API key first'; return; }
  status.textContent = '· loading…';
  try{
    let models = [];
    if(p==='claude'){
      const r = await fetch('https://api.anthropic.com/v1/models',{ headers:{
        'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' }});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error?.message || ('HTTP '+r.status));
      models = (d.data||[]).filter(m=>/claude/i.test(m.id)).map(m=>({ id:m.id, label:m.display_name||m.id }));
    } else {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models',{ headers:{ 'x-goog-api-key':key }});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error?.message || ('HTTP '+r.status));
      models = (d.models||[])
        .filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
        .map(m=>({ id:(m.name||'').replace('models/',''), label:m.displayName||(m.name||'').replace('models/','') }))
        .filter(m=>/gemini/i.test(m.id) && !/embedding|image|vision|aqa|tts|live|native-audio/i.test(m.id));
    }
    if(!models.length) throw new Error('no compatible models returned');
    populateModels(models);
    status.textContent = `· loaded ${models.length} live models`;
  }catch(e){ status.textContent = '· could not load live list ('+e.message+')'; }
}


// ── News-only refresh (prompt lives in js/01-prompt.js) ──

async function refreshNewsOnly(){
  if(!rawData){ alert('Run or open an analysis first.'); return; }
  if(!(await requirePin())) return;                 // token-spending action — PIN-gated
  const provider = curProvider(), model = curModel();
  const key = document.getElementById('api-key').value.trim();
  if(!key){ alert(`Enter your ${AI_CONFIG[provider].label} API key first — the news refresh needs one small AI call.`); return; }
  const btn = document.getElementById('btn-refresh-news');
  const orig = btn ? btn.innerHTML : null;
  if(btn){ btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating news…'; btn.disabled = true; }
  try{
    const nm = `${rawData.stock_name||''}${rawData.ticker?' ('+rawData.ticker+')':''}`.trim();
    const txt = await callAI(provider, key, model,
      `Update ONLY the news for this Indian stock: "${nm}". Search the web for verified news from the last 90 days and return ONLY the JSON object.`, NEWS_SYSTEM);
    const j = extractJSON(txt);
    if(!j || !Array.isArray(j.recent_news)) throw new Error('The model did not return the expected news JSON — try again.');
    // snapshot the previous read so the report can show what actually changed
    const prevImpact = calcNewsImpact(rawData, 'HOLD');
    const norm = s => (s||'').toLowerCase().replace(/\W+/g,' ').trim();
    const prevSet = new Set((rawData.recent_news||[]).map(n=>norm(n.headline)));
    j.recent_news.forEach(n=>{ if(n) n._isNew = !prevSet.has(norm(n.headline)); });
    rawData._newsPrev = prevImpact ? { short: prevImpact.shortScore, long: prevImpact.longScore } : null;
    rawData.recent_news = j.recent_news;
    if(j.news_impact_assessment) rawData.news_impact_assessment = j.news_impact_assessment;
    rawData._newsRefreshedAt = new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    renderReport(rawData);
    storeAnalysis(rawData);
  }catch(e){
    alert('News refresh failed: ' + e.message);
    if(btn){ btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ── Free price/ratio update: hits only Yahoo/Screener (no AI, no
// tokens) and recomputes every valuation at the fresh price.
async function updatePriceFree(){
  if(!rawData){ alert('Run or open an analysis first.'); return; }
  const btn = document.getElementById('btn-price');
  const orig = btn ? btn.innerHTML : null;
  if(btn){ btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching…'; btn.disabled = true; }
  try{
    const q = rawData._query || rawData.ticker || rawData.stock_name;
    const v = await fetchVerifiedData(q, true);
    const applied = applyVerifiedData(rawData, v);
    if(applied.length) rawData._provenance = { sources: v.sources, asOf: v.asOf, fields: applied, symbol: v.symbol||null };
    renderReport(rawData);
    storeAnalysis(rawData);
  }catch(e){
    alert('Could not reach the free data feed ('+e.message+') — prices unchanged.');
    if(btn){ btn.innerHTML = orig; btn.disabled = false; }
  }
}

// Dispatch → returns the raw text reply from the chosen provider
async function callAI(provider, key, model, userMsg, sys){
  return provider==='gemini' ? callGemini(key, model, userMsg, sys) : callClaude(key, model, userMsg, sys);
}

async function callClaude(key, model, userMsg, sys){
  const res = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':key,
              'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({
      model, max_tokens:16000,
      tools:[{ type:'web_search_20250305', name:'web_search' }],
      system: sys || SYSTEM,
      messages:[{ role:'user', content:userMsg }]
    })
  });
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Anthropic API error ${res.status}`); }
  const data = await res.json();
  return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
}

async function callGemini(key, model, userMsg, sys){
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  let res;
  try{
    res = await fetch(url,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        system_instruction:{ parts:[{ text: sys || SYSTEM }] },
        contents:[{ role:'user', parts:[{ text: userMsg }] }],
        tools:[{ google_search:{} }],
        generationConfig:{ maxOutputTokens:32768, temperature:0.2 }
      })
    });
  }catch(netErr){
    throw new Error('Could not reach Gemini ("'+netErr.message+'"). This is usually a browser CORS block when the file is opened directly (file://). Fix: serve it from a local server — e.g. run "python -m http.server" in the file\'s folder and open http://localhost:8000/index.html');
  }
  if(!res.ok){
    const e = await res.json().catch(()=>({}));
    const msg = e.error?.message || ('HTTP '+res.status);
    if(res.status===400 && /api key not valid/i.test(msg))
      throw new Error('Gemini rejected the key. Make sure it is a Google AI Studio key (starts with AIza) — not your Anthropic key — and that the "Generative Language API" is enabled for it.');
    if(res.status===403)
      throw new Error('Gemini access denied (403): '+msg+'. The key may lack permission or the API is not enabled in your Google project.');
    if(res.status===404)
      throw new Error(`Gemini model "${model}" is not available to your key (404). Click "Load live model list" and pick a model your key actually supports.`);
    if(res.status===429)
      throw new Error('Gemini rate/quota limit hit (429). Wait a minute, or check your quota in Google AI Studio.');
    throw new Error('Gemini API error: '+msg);
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  if(!cand){
    const blocked = data.promptFeedback?.blockReason;
    throw new Error(blocked ? `Gemini blocked the prompt (${blocked}).` : 'Gemini returned no output — please try again.');
  }
  const txt = (cand.content?.parts||[]).filter(p=>p.text).map(p=>p.text).join('');
  if(!txt){
    if(cand.finishReason==='MAX_TOKENS')
      throw new Error('Gemini used its entire token budget on internal reasoning before answering. Try Gemini 3.5 Flash or 2.5 Flash (lighter thinking overhead), or just retry.');
    if(cand.finishReason==='SAFETY' || cand.finishReason==='RECITATION')
      throw new Error('Gemini stopped early ('+cand.finishReason+'). Try a different model or rephrase the stock name.');
    throw new Error('Gemini returned an empty response (finishReason: '+(cand.finishReason||'unknown')+'). Please retry.');
  }
  return txt;
}

async function analyze(){
  if(!(await requirePin())) return;                 // token-spending action — PIN-gated
  const provider = curProvider();
  const model    = curModel();
  const cfg      = AI_CONFIG[provider];
  const key   = document.getElementById('api-key').value.trim();
  const stock = document.getElementById('stock-input').value.trim();
  if(!key)   { showErr(`Please enter your ${cfg.label} API key (${cfg.keyHint}).`); return; }
  if(!stock) { showErr('Please enter a stock name or ticker symbol.'); return; }
  saveRec(stock);
  showLoading(stock);

  let si = 0;
  const timer = setInterval(()=>{
    if(si>0) document.getElementById('s'+si)?.classList.replace('active','done');
    if(si<6){ si++; document.getElementById('s'+si)?.classList.add('active'); }
  }, 3200);

  // ── 1. Try the structured data feed first (fails soft to AI-only) ──
  let verified = null;
  try{ verified = await fetchVerifiedData(stock); }catch(_){ /* AI-only fallback */ }
  let vBlock = (verified && Object.keys(verified.fields).length)
    ? `\n\nVERIFIED_MARKET_DATA — exchange/fundamentals data from ${verified.sources.join(' + ')}, as of ${verified.asOf}. Use these EXACT values in your JSON for the matching fields. Do NOT search for them again. Focus your searches on: sector data, news, forensic/quant data, qualitative assessment.\n${JSON.stringify(verified.fields)}`
    : '';
  if(verified && verified.structured && verified.structured.financial_history){
    const H = verified.structured.financial_history;
    vBlock += `\n\nVERIFIED_HISTORY — audited annual figures parsed from the company's statements. Copy these EXACTLY into "financial_history" and derive nothing that contradicts them:\n${JSON.stringify(H)}`;
  }

  const userMsg = `Collect complete financial data for this Indian stock: "${stock}"\n\nSearch the web thoroughly. Return ONLY the JSON object — no other text.` + vBlock;

  try{
    const txt = await callAI(provider, key, model, userMsg);

    clearInterval(timer);
    for(let i=1;i<=6;i++){ const el=document.getElementById('s'+i); if(el){ el.classList.remove('active'); el.classList.add('done'); } }

    rawData = extractJSON(txt);
    if(!rawData) throw new Error('Could not extract JSON from the AI response. The model may have returned an unexpected format — try again, or switch models.');
    rawData._engineLabel = `${cfg.label} · ${model}`;
    rawData._query = stock;                                  // remembered for the free price refresh
    // ── 2. Verified numbers override the AI's — same stock, same result ──
    if(verified){
      const applied = applyVerifiedData(rawData, verified);
      rawData._provenance = { sources: verified.sources, asOf: verified.asOf, fields: applied, symbol: verified.symbol||null };
    }

    renderReport(rawData);                                   // synchronous so render errors hit the catch below
    storeAnalysis(rawData);                                  // auto-kept — a refresh never costs tokens again
    document.getElementById('loading').style.display = 'none';
    document.getElementById('abtn').disabled = false;
    document.getElementById('abtn').innerHTML = '<i class="fas fa-calculator"></i> Run Analysis';
    window.scrollTo({ top: 0, behavior:'smooth' });

  } catch(e){
    clearInterval(timer);
    showErr(e.message || 'Unknown error occurred. Please try again.');
  }
}


init();
