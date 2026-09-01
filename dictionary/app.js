const WORKER = "https://dict-api.lutfor183.workers.dev";
const TOKEN = "LUT2025";
const qEl = document.getElementById('q');
const pairEl = document.getElementById('pair');
const resultsEl = document.getElementById('results');
const suggestEl = document.getElementById('suggest');
const emptyEl = document.getElementById('empty');

let timer = null;
let lastQ = "";

qEl.addEventListener('input', () => {
  clearTimeout(timer);
  const v = qEl.value.trim();
  if (v.length < 1) { suggestEl.innerHTML = ""; return; }
  timer = setTimeout(() => autocomplete(v), 150);
});
qEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { suggestEl.innerHTML=""; search(qEl.value.trim()); }
  if (e.key === 'Escape') suggestEl.innerHTML="";
});
pairEl.addEventListener('change', () => { suggestEl.innerHTML=""; if(qEl.value.trim()) search(qEl.value.trim()); });

// init from ?q=
const initQ = new URLSearchParams(location.search).get('q');
if(initQ){ qEl.value = initQ; const p=new URLSearchParams(location.search).get('pair'); if(p) pairEl.value=p; search(initQ); }

async function autocomplete(v){
  if(v===lastQ) return;
  lastQ=v;
  const pair=pairEl.value;
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pair}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) return;
    const rows=await r.json();
    if(qEl.value.trim()!==v) return;
    suggestEl.innerHTML = rows.slice(0,8).map(x=>`
      <button class="w-full text-left px-4 py-2 hover:bg-zinc-50 text-sm flex justify-between" onclick="pick('${x.word.replace(/'/g,"\\'")}')">
        <span>${x.word}</span><span class="text-zinc-500">${x.pos||""}</span>
      </button>
    `).join("");
  }catch{}
}
function pick(w){ qEl.value=w; suggestEl.innerHTML=""; search(w); }

async function search(v){
  v=v.slice(0,30);
  if(!v) return;
  history.replaceState(null,"",`?q=${encodeURIComponent(v)}&pair=${pairEl.value}`);
  resultsEl.innerHTML=`<div class="text-sm text-zinc-500">Searching...</div>`;
  emptyEl.classList.add("hidden");
  try{
    const r=await fetch(`${WORKER}/search?q=${encodeURIComponent(v)}&pair=${pairEl.value}`,{headers:{"X-Site-Token":TOKEN}});
    if(!r.ok) throw new Error(await r.text());
    const rows=await r.json();
    if(!rows.length){ resultsEl.innerHTML=""; emptyEl.classList.remove("hidden"); return; }
    resultsEl.innerHTML = rows.map(x=>`
      <div class="border rounded-xl p-4 hover:bg-zinc-50">
        <div class="flex justify-between gap-4">
          <div class="font-medium">${x.word}</div>
          <div class="text-xs text-zinc-500">${x.pos||""} ${x.lang_pair||""}</div>
        </div>
        <div class="text-sm text-zinc-700 mt-2 leading-6">${(x.meaning_text||x.definition||"").replace(/\n/g,"<br>")}</div>
        ${x.meaning_html?`<details class="mt-2"><summary class="text-xs text-zinc-600 cursor-pointer">Details</summary><div class="text-sm mt-2 leading-6">${x.meaning_html}</div></details>`:""}
        ${x.mnemonic?`<div class="mt-3 border-t pt-3 text-sm"><span class="font-medium">Mnemonic</span> <span class="text-zinc-500">${Number(x.avgRating).toFixed(1)} · ${x.numberOfRatings}</span><div class="mt-1">${x.mnemonic}</div><div class="text-xs text-zinc-500 mt-1">${x.uname||""}</div></div>`:""}
      </div>
    `).join("");
  }catch(e){
    resultsEl.innerHTML=`<div class="border rounded-xl p-4 text-sm">Error: ${e.message}</div>`;
  }
}
