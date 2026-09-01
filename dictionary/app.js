const WORKER="https://bn-dict-searcher.lotfor1515.workers.dev";
const TOKEN="LUT2025";
const qEl=document.getElementById('q');
const resultsEl=document.getElementById('results');
const suggestEl=document.getElementById('suggest');
const statusEl=document.getElementById('status');
let timer=null;

// auto-detect pair: Bangla unicode -> bn-en/bn-bn, else en-bn
function detectPair(v){
  const hasBangla = /[\u0980-\u09FF]/.test(v);
  if(!hasBangla) return "en-bn";
  // if Bangla word, try bn-en first, fallback to bn-bn on worker side
  return "bn-en";
}

qEl.addEventListener('input',()=>{
  clearTimeout(timer);
  const v=qEl.value.trim();
  if(v.length<1){suggestEl.innerHTML="";return;}
  timer=setTimeout(()=>autocomplete(v),180);
});
qEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'){suggestEl.innerHTML="";search(qEl.value.trim());}
  if(e.key==='Escape')suggestEl.innerHTML="";
});
const initQ=new URLSearchParams(location.search).get('q');
if(initQ){qEl.value=initQ;search(initQ);}

async function autocomplete(v){
  const pair=detectPair(v);
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pair}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) return;
    const rows=await r.json();
    if(qEl.value.trim()!==v) return;
    suggestEl.innerHTML=rows.slice(0,8).map(x=>`<button class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-sm" onclick="pick('${x.word.replace(/'/g,"\\'")}')">${x.word}</button>`).join("");
  }catch{}
}
function pick(w){qEl.value=w;suggestEl.innerHTML="";search(w);}

async function search(v){
  v=v.slice(0,30);
  if(!v) return;
  const pair=detectPair(v);
  history.replaceState(null,"",`?q=${encodeURIComponent(v)}`);
  resultsEl.innerHTML="";
  statusEl.textContent="Searching...";
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pair}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) throw new Error();
    let rows=await r.json();
    // if bn-en empty, try bn-bn
    if(!rows.length && pair==="bn-en"){
      const r2=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=bn-bn`,{headers:{"X-Site-Token":TOKEN}});
      if(r2.ok) rows=await r2.json();
    }
    statusEl.textContent="";
    if(!rows.length){statusEl.textContent="No results.";return;}
    resultsEl.innerHTML=rows.map(x=>`<div class="bg-white border rounded-2xl p-5" style="box-shadow:0 0 40px rgba(124,58,237,0.15)"><div class="font-medium">${x.word}</div><div class="text-xs text-zinc-500 mt-1">${x.pos||""}</div><div class="text-sm leading-6 mt-3">${(x.meaning_text||x.definition||"").replace(/\n/g,"<br>")}</div>${x.meaning_html?`<div class="text-sm leading-6 mt-3">${x.meaning_html}</div>`:""}</div>`).join("");
  }catch{
    statusEl.textContent="";
    resultsEl.innerHTML=`<div class="bg-white border rounded-2xl p-5 text-sm">Error - try again</div>`;
  }
}
