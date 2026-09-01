const WORKER = "https://bn-dict-searcher.lotfor1515.workers.dev";
const TOKEN = "LUT2025";
const qEl = document.getElementById('q');
const pairEl = document.getElementById('pair');
const resultsEl = document.getElementById('results');
const suggestEl = document.getElementById('suggest');
const statusEl = document.getElementById('status');

let timer=null;
qEl.addEventListener('input',()=>{
  clearTimeout(timer);
  const v=qEl.value.trim();
  if(v.length<1){suggestEl.innerHTML="";return;}
  timer=setTimeout(()=>autocomplete(v),180);
});
qEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'){suggestEl.innerHTML=""; search(qEl.value.trim());}
  if(e.key==='Escape') suggestEl.innerHTML="";
});
pairEl.addEventListener('change',()=>{suggestEl.innerHTML=""; if(qEl.value.trim()) search(qEl.value.trim());});

const initQ=new URLSearchParams(location.search).get('q');
if(initQ){qEl.value=initQ; const p=new URLSearchParams(location.search).get('pair'); if(p) pairEl.value=p; search(initQ);}

async function autocomplete(v){
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pairEl.value}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) return;
    const rows=await r.json();
    if(qEl.value.trim()!==v) return;
    suggestEl.innerHTML=rows.slice(0,8).map(x=>`
      <button class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-sm" onclick="pick('${x.word.replace(/'/g,"\\'")}')">${x.word}</button>
    `).join("");
  }catch{}
}
function pick(w){qEl.value=w; suggestEl.innerHTML=""; search(w);}

async function search(v){
  v=v.slice(0,30);
  if(!v) return;
  history.replaceState(null,"",`?q=${encodeURIComponent(v)}&pair=${pairEl.value}`);
  resultsEl.innerHTML="";
  statusEl.textContent="Searching...";
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pairEl.value}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) throw new Error();
    const rows=await r.json();
    statusEl.textContent="";
    if(!rows.length){statusEl.textContent="No results.";return;}
    // limit is server-side to prevent bulk dump, not shown to user
    resultsEl.innerHTML=rows.map(x=>`
      <div class="bg-white border rounded-2xl p-5 glow">
        <div class="font-medium">${x.word}</div>
        <div class="text-xs text-zinc-500 mt-1">${x.pos||""}</div>
        <div class="text-sm leading-6 mt-3 whitespace-pre-wrap">${(x.meaning_text||x.definition||"")}</div>
        ${x.meaning_html?`<div class="text-sm leading-6 mt-3">${x.meaning_html}</div>`:""}
        ${x.mnemonic?`<div class="mt-4 pt-4 border-t text-sm"><div class="font-medium">Mnemonic</div><div class="mt-1">${x.mnemonic}</div></div>`:""}
      </div>
    `).join("");
  }catch{
    statusEl.textContent="";
    resultsEl.innerHTML=`<div class="bg-white border rounded-2xl p-5 text-sm">Worker not deployed yet. Deploy with: wrangler d1 create unified_dict && wrangler d1 execute --file=unified.db --remote && wrangler deploy</div>`;
  }
}
