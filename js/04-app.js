// ════════════════════════════════════════════════════════
// APP LOGIC
// ════════════════════════════════════════════════════════
let rawData = null;
const recent = JSON.parse(localStorage.getItem('mb2_rec') || '[]');

// ════════════════════════════════════════════════════════
// PIN GATE — a light access lock on token-spending actions.
// Only SHA-256 fingerprints of the PINs live in this file, so the
// PINs cannot be read from the (public) source. NOTE: this is a
// convenience lock, not real security — a static page runs entirely
// in the visitor's browser, so a determined user can bypass any
// client-side check. It reliably stops casual/accidental use of
// your API quota, which is its job.
// ════════════════════════════════════════════════════════
const PIN_HASHES = [
  '06dfa0f3bcd7db70e0f2484f81e747aa55318ba9a806716049d4c5f5255ff9ea',
  '5143a5c96a812010a75cd08ce5f533db36add60dbec9c6511fea8ec17e1659d9'
];
async function sha256Hex(s){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
let _pinModal = null;
function requirePin(){
  if(sessionStorage.getItem('mb_unlocked')==='1') return Promise.resolve(true);
  if(_pinModal) return Promise.resolve(false);          // already open
  return new Promise(resolve=>{
    const ov = document.createElement('div');
    _pinModal = ov;
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(8,12,16,0.9);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `
      <div style="background:var(--sf);border:1px solid var(--b2);border-radius:16px;padding:28px 30px;max-width:340px;width:92%;text-align:center">
        <div style="width:44px;height:44px;margin:0 auto 12px;border-radius:12px;background:linear-gradient(135deg,#00c853,#00897b);display:flex;align-items:center;justify-content:center"><i class="fas fa-lock" style="color:#000;font-size:1.1rem"></i></div>
        <div style="font-size:0.95rem;font-weight:700;color:white;margin-bottom:4px">Enter access PIN</div>
        <div style="font-size:0.66rem;color:var(--m);margin-bottom:16px">Running an analysis spends API tokens, so it's PIN-protected.</div>
        <input id="pin-input" type="password" autocomplete="off" placeholder="PIN"
          style="width:100%;background:var(--s2);border:1px solid var(--b2);color:white;padding:11px 14px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:0.9rem;text-align:center;outline:none;letter-spacing:0.2em">
        <div id="pin-err" style="font-size:0.62rem;color:var(--r);height:16px;margin:7px 0 5px"></div>
        <div style="display:flex;gap:8px">
          <button id="pin-cancel" class="ebtn" style="flex:1;justify-content:center">Cancel</button>
          <button id="pin-go" class="abtn" style="flex:2;padding:10px"><i class="fas fa-unlock"></i> Unlock</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('#pin-input'), err = ov.querySelector('#pin-err');
    const cleanup = ok => { ov.remove(); _pinModal = null; resolve(ok); };
    const submit = async () => {
      const v = inp.value.trim();
      if(!v) return;
      let h = '';
      try{ h = await sha256Hex(v); }
      catch(_){ err.textContent = 'This browser blocks the crypto API here — open the page via https or localhost.'; return; }
      if(PIN_HASHES.includes(h)){
        sessionStorage.setItem('mb_unlocked','1');
        cleanup(true);
      } else {
        err.textContent = 'Incorrect PIN — try again.';
        inp.value = ''; inp.focus();
      }
    };
    ov.querySelector('#pin-go').onclick = submit;
    inp.onkeydown = e => { if(e.key==='Enter') submit(); };
    ov.querySelector('#pin-cancel').onclick = () => cleanup(false);
    setTimeout(()=>inp.focus(), 60);
  });
}

// ════════════════════════════════════════════════════════
// ANALYSIS LIBRARY — persistence in localStorage
// Every completed analysis is auto-kept (last AUTO_KEEP) so a page
// refresh never costs tokens again; the ones you explicitly Save are
// pinned and never auto-evicted. Reopening renders instantly from
// storage — zero AI calls.
// ════════════════════════════════════════════════════════
const MB_STORE='mb_store_v1', AUTO_KEEP=8, PIN_KEEP=20;
function mbLoadStore(){ try{ return JSON.parse(localStorage.getItem(MB_STORE)) || {entries:{}}; }catch(_){ return {entries:{}}; } }
function mbSaveStore(s){
  try{ localStorage.setItem(MB_STORE, JSON.stringify(s)); }
  catch(e){ alert('Browser storage is full — delete some saved analyses from the library and try again.'); }
}
function mbKey(d){ return ((d && (d.ticker||d.stock_name))||'').toUpperCase().replace(/\s+/g,'_').replace(/[^A-Z0-9_.-]/g,'').slice(0,40); }

function storeAnalysis(d, pin){
  if(!d) return;
  const key = mbKey(d); if(!key) return;
  const s = mbLoadStore();
  const prev = s.entries[key];
  s.entries[key] = {
    t: Date.now(),
    pinned: pin!=null ? pin : (prev ? prev.pinned : false),
    name: d.stock_name || key, ticker: d.ticker || '',
    rating: d._lastRating || null, price: d.current_price ?? null,
    data: d
  };
  const pinnedN = Object.values(s.entries).filter(e=>e.pinned).length;
  if(pinnedN > PIN_KEEP) alert(`You have ${pinnedN} saved analyses — browser storage is limited, consider deleting old ones.`);
  // evict oldest UNPINNED entries beyond the auto-keep window
  Object.entries(s.entries)
    .filter(([,e])=>!e.pinned).sort((a,b)=>b[1].t-a[1].t)
    .slice(AUTO_KEEP).forEach(([k])=>delete s.entries[k]);
  mbSaveStore(s); renderShelf();
}
function openAnalysis(key){
  const e = mbLoadStore().entries[key]; if(!e) return;
  rawData = e.data;
  rawData._storedAt = e.t;
  document.getElementById('loading').style.display='none';
  document.getElementById('err-panel').style.display='none';
  renderReport(rawData);
  document.getElementById('report').style.display='block';
  window.scrollTo({top:0, behavior:'smooth'});
}
function togglePinKey(key){
  const s = mbLoadStore(); const e = s.entries[key]; if(!e) return;
  e.pinned = !e.pinned; mbSaveStore(s); renderShelf();
  if(rawData && mbKey(rawData)===key) renderReport(rawData);
}
// Deleting always confirms; deleting a SAVED analysis confirms twice.
function deleteAnalysis(key){
  const s = mbLoadStore(); const e = s.entries[key]; if(!e) return;
  if(e.pinned){
    if(!confirm(`"${e.name}" is a SAVED analysis you chose to keep.\n\nDelete it anyway?`)) return;
    if(!confirm(`Final confirmation — permanently delete the saved analysis for ${e.name}?\n\nThis cannot be undone (consider Export backup first).`)) return;
  } else {
    if(!confirm(`Delete the stored analysis for ${e.name}?`)) return;
  }
  delete s.entries[key]; mbSaveStore(s); renderShelf();
}

// ── Quarterly-results reminder ────────────────────────────
// Indian quarters end Mar/Jun/Sep/Dec; results land within ~45 days.
// If such a checkpoint has passed since an analysis was stored, its
// fundamentals may be a quarter stale — remind the user to re-run.
function lastResultsCheckpoint(now = Date.now()){
  const y = new Date(now).getFullYear();
  let latest = 0;
  for(const yy of [y-1, y]){
    for(const [m, day] of [[2,31],[5,30],[8,30],[11,31]]){
      const cp = new Date(yy, m, day).getTime() + 45*86400000;
      if(cp <= now && cp > latest) latest = cp;
    }
  }
  return latest;
}
function needsRerun(storedAt){ return storedAt != null && storedAt < lastResultsCheckpoint(); }

// ── Backup: export / import the whole library as a JSON file ──
// localStorage can be wiped by browser cleanups — a downloaded backup
// can't. Import merges (newer entry wins) and never deletes anything.
function exportLibrary(){
  const s = mbLoadStore();
  if(!Object.keys(s.entries).length){ alert('Nothing to export yet.'); return; }
  const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), ...s }, null, 1)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'multibagger_library_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
function importLibrary(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const j = JSON.parse(rd.result);
        if(!j || typeof j.entries !== 'object') throw new Error('not a library backup file');
        const s = mbLoadStore();
        let added = 0, updated = 0;
        for(const [k, e] of Object.entries(j.entries)){
          if(!e || !e.data) continue;
          if(!s.entries[k]){ s.entries[k] = e; added++; }
          else if((e.t||0) > (s.entries[k].t||0)){ s.entries[k] = { ...e, pinned: s.entries[k].pinned || e.pinned }; updated++; }
        }
        mbSaveStore(s); renderShelf();
        alert(`Import complete: ${added} added, ${updated} updated, nothing deleted.`);
      }catch(err){ alert('Import failed: ' + err.message); }
    };
    rd.readAsText(f);
  };
  inp.click();
}
function saveCurrent(){
  if(!rawData){ alert('Run or open an analysis first.'); return; }
  const cur = mbLoadStore().entries[mbKey(rawData)];
  storeAnalysis(rawData, !(cur && cur.pinned));
  renderReport(rawData);   // refresh the Save button label
}
function mbAge(t){
  const m = Math.floor((Date.now()-t)/60000);
  if(m<1) return 'just now';
  if(m<60) return m+' min ago';
  const h = Math.floor(m/60);
  if(h<24) return h+' hr ago';
  return new Date(t).toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
}
function renderShelf(){
  const el = document.getElementById('shelf'); if(!el) return;
  const entries = Object.entries(mbLoadStore().entries)
    .sort((a,b)=> (b[1].pinned-a[1].pinned) || (b[1].t-a[1].t));
  if(!entries.length){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div style="font-size:0.58rem;font-weight:700;color:var(--m);letter-spacing:0.1em;text-transform:uppercase"><i class="fas fa-box-archive"></i> Analysis Library — reopen without spending tokens</div>
      <div style="display:flex;gap:6px">
        <button class="rtag" onclick="exportLibrary()"><i class="fas fa-download"></i> Export backup</button>
        <button class="rtag" onclick="importLibrary()"><i class="fas fa-upload"></i> Import</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${entries.map(([k,e])=>{
        const rc = e.rating==='STRONG BUY'||e.rating==='BUY' ? 'var(--g)' : e.rating==='HOLD' ? 'var(--a)' : e.rating ? 'var(--r)' : 'var(--m)';
        const stale = needsRerun(e.t);
        return `
        <div style="background:var(--sf);border:1px solid ${stale?'rgba(255,171,64,0.45)':e.pinned?'rgba(0,230,118,0.3)':'var(--b2)'};border-radius:10px;padding:9px 12px;min-width:170px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-size:0.7rem;font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${e.pinned?'📌 ':''}${esc(e.name)}</span>
            <span style="font-size:0.55rem;font-weight:800;color:${rc}">${esc(e.rating)||''}</span>
          </div>
          <div style="font-size:0.55rem;color:var(--m);font-family:'JetBrains Mono',monospace;margin:2px 0 6px">${esc(e.ticker)} · ${e.price!=null?'&#8377;'+(+e.price).toLocaleString('en-IN'):''} · ${mbAge(e.t)}</div>
          ${stale?`<div style="font-size:0.54rem;font-weight:700;color:var(--a);margin-bottom:6px"><i class="fas fa-clock"></i> Quarterly results since — re-run advised</div>`:''}
          <div style="display:flex;gap:5px">
            <button class="rtag" onclick="openAnalysis('${k}')" style="color:var(--g);border-color:rgba(0,230,118,0.3)">Open</button>
            <button class="rtag" onclick="togglePinKey('${k}')">${e.pinned?'Unsave':'Save'}</button>
            <button class="rtag" onclick="deleteAnalysis('${k}')" style="color:var(--r)">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function init(){ populateProviders(); onProviderChange(); renderRec(); renderShelf(); }
function renderRec(){
  const r = document.getElementById('rec-row');
  if(!recent.length){ r.style.display='none'; return; }
  r.style.display = 'flex';
  r.innerHTML = '<span class="rec-lbl">Recent:</span>' +
    recent.slice(0,6).map(s=>`<span class="rtag" onclick="useRec(this.textContent)">${esc(s)}</span>`).join('');
}
function useRec(s){ document.getElementById('stock-input').value=s; analyze(); }
function saveRec(s){
  const i = recent.indexOf(s);
  if(i>-1) recent.splice(i,1);
  recent.unshift(s);
  if(recent.length>8) recent.pop();
  localStorage.setItem('mb2_rec', JSON.stringify(recent));
  renderRec();
}
function copyJSON(){
  if(!rawData) return;
  navigator.clipboard.writeText(JSON.stringify(rawData,null,2));
  const b = event.target.closest('.ebtn');
  const orig = b.innerHTML;
  b.innerHTML = '<i class="fas fa-check"></i> Copied!';
  b.style.color = 'var(--g)';
  setTimeout(()=>{ b.innerHTML=orig; b.style.color=''; }, 2200);
}

// ── Loading / error panels (used by the analyze flow) ──
function showLoading(name){
  document.getElementById('report').style.display = 'none';
  document.getElementById('err-panel').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('ld-name').textContent = name;
  document.getElementById('abtn').disabled = true;
  document.getElementById('abtn').innerHTML = '<div class="spin"></div> Analyzing…';
  for(let i=1;i<=6;i++){
    const el = document.getElementById('s'+i);
    if(el) el.classList.remove('active','done');
  }
}

function showErr(msg){
  document.getElementById('loading').style.display = 'none';
  document.getElementById('report').style.display = 'none';
  document.getElementById('err-panel').style.display = 'block';
  document.getElementById('err-msg').textContent = msg;
  document.getElementById('abtn').disabled = false;
  document.getElementById('abtn').innerHTML = '<i class="fas fa-calculator"></i> Run Analysis';
}
