// ════════════════════════════════════════════════════════
// SHARED UTILITIES — escaping, formatting, scaling
// Loaded first; used by every other module.
// ════════════════════════════════════════════════════════
// Escape untrusted text (stock names, news, AI/web-sourced strings) before
// it is placed into innerHTML, to prevent stored/reflected XSS from
// adversarial or malformed web content the AI may reproduce verbatim.
function esc(s){
  if(s==null) return '';
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// Formatters
function fmtINR(n,d=0){ if(n==null||isNaN(n)) return 'N/A'; return '&#8377;'+n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fmtP(n){ if(n==null||isNaN(n)) return 'N/A'; return (n>=0?'+':'')+n.toFixed(1)+'%'; }
function fmtX(n){ if(n==null||isNaN(n)) return 'N/A'; return n.toFixed(2)+'x'; }
function pct(n){ return n==null?'N/A':n.toFixed(1)+'%'; }

// Scale a raw value onto 0–100 between lo and hi (clamped); null → neutral 50.
// scaleUp: higher is better · scaleDown: lower is better.
function scaleUp(v,l,h){ return v==null?50:Math.max(0,Math.min(100,(v-l)/(h-l)*100)); }
function scaleDown(v,l,h){ return v==null?50:Math.max(0,Math.min(100,(h-v)/(h-l)*100)); }

// Extract the first complete, parseable JSON object from an AI reply.
// Models often wrap the JSON in ```fences``` or append commentary after it;
// a greedy first-{-to-last-} regex breaks on any trailing text, so instead
// scan with a brace-depth counter (string/escape aware) and try each
// balanced candidate until one parses.
function extractJSON(txt){
  const s = txt.replace(/```json|```/g, '');
  let start = s.indexOf('{');
  while(start !== -1){
    let depth = 0, inStr = false, escaped = false;
    for(let i = start; i < s.length; i++){
      const ch = s[i];
      if(escaped){ escaped = false; continue; }
      if(inStr){
        if(ch === '\\') escaped = true;
        else if(ch === '"') inStr = false;
        continue;
      }
      if(ch === '"') inStr = true;
      else if(ch === '{') depth++;
      else if(ch === '}'){
        depth--;
        if(depth === 0){
          try{ return JSON.parse(s.slice(start, i+1)); }
          catch(_){ break; }   // malformed candidate — try the next '{'
        }
      }
    }
    start = s.indexOf('{', start + 1);
  }
  return null;
}
