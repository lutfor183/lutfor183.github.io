/* Drop — static P2P sharing. Trystero (Nostr) signalling + WebRTC data. No build. */
const $ = (s) => document.querySelector(s);
const peersEl = $('#peers'), emptyState = $('#emptyState'), statusText = $('#statusText'),
  statusDot = $('#statusDot'), myNameEl = $('#myName'), roomCodeEl = $('#roomCode'),
  roomLinkEl = $('#roomLink'), qrEl = $('#qr'), transfersEl = $('#transfers'),
  recvListEl = $('#recvList'), recvEmpty = $('#recvEmpty'), toastEl = $('#toast'),
  fileInput = $('#fileInput'), autoSaveEl = $('#autoSave'), netInfoEl = $('#netInfo');

const APP_ID = 'drop-lutfor-share-v1';
const TRYSTERO_URL = 'https://esm.run/trystero@0.25.4';
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz'; // lowercase letters only, no i/l/o — 3-letter codes
const CODE_LEN = 3;
const PALETTE = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#4338ca'];
const ADJ = ['Calm','Bright','Swift','Quiet','Clever','Kind','Bold','Gentle','Sunny','Rapid'];
const ANIMAL = ['Otter','Falcon','Fox','Heron','Badger','Wren','Seal','Lynx','Dove','Newt'];

let myId = rid(8), myName = load('drop.name') || `${pick(ADJ)} ${pick(ANIMAL)}`;
save('drop.name', myName);
// device icon for peer cards (SHAREit-style): phone vs laptop, exchanged in hello
const myDevice = (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent||'') || ((navigator.maxTouchPoints||0)>0 && Math.min(screen.width||999,screen.height||999)<768)) ? 'phone' : 'laptop';
const helloMsg = ()=>({name:myName,id:myId,device:myDevice});
const DEV_ICON = {
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  laptop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="11" rx="1.5"/><path d="M2 19.5h20"/></svg>'
};
// Room codes are always exactly 3 lowercase letters (case-insensitive input).
// Old stored values from other lengths are discarded so both devices land together.
// Invite links (#r=) still accept 3–8 chars so old QR codes keep working.
let roomCode = parseRoom();
if(!roomCode){
  roomCode = normCode(load('drop.room'));
  if(!/^[a-z]{3}$/.test(roomCode)) roomCode = genCode();
}
save('drop.room', roomCode);

let room = null, peers = new Map(); // peerId -> {name, color}
let connecting = false, connected = false, getSockets = null; // getSockets filled after signalling lib loads
let wakeLock = null;

function rid(n){ const c = crypto.getRandomValues(new Uint8Array(n)); return [...c].map(b=>(b%36).toString(36)).join(''); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function genCode(){ let s=''; const b=crypto.getRandomValues(new Uint8Array(CODE_LEN)); for(let i=0;i<CODE_LEN;i++) s+=CODE_ALPHABET[b[i]%CODE_ALPHABET.length]; return s; }
function normCode(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8); }
function parseRoom(){
  const h = location.hash || '';
  // legacy links #r=abc + clean links #abc (also tolerates full URLs pasted anywhere)
  let m = h.match(/#r=([A-Za-z0-9]{3,8})/) || h.match(/^#([A-Za-z0-9]{3,8})/);
  if(!m){ const u = h.match(/#.*?([A-Za-z0-9]{3,8})\s*$/); m = u; }
  const c = m ? normCode(m[1]) : '';
  return c.length>=3 ? c : null;
}
function joinRoomCode(raw){
  const c = normCode(raw);
  if(c.length!==3){ toast('Type the 3-letter code'); return false; }
  roomCode=c; save('drop.room',c); renderRoom(); drawQR(); reconnect();
  return true;
}
function load(k){ try{return localStorage.getItem(k);}catch{return null;} }
function save(k,v){ try{localStorage.setItem(k,v);}catch{} }
function roomUrl(){ const u = new URL(location.href); u.hash = '#' + roomCode; return u.toString(); }
function fmtSize(b){ if(b>=1e9) return (Math.round(b/1e8)/10)+' GB'; if(b>=1e6) return (Math.round(b/1e5)/10)+' MB'; if(b>1000) return Math.round(b/1000)+' KB'; return b+' B'; }
function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t = setTimeout(()=>toastEl.classList.remove('show'), 2800); }
function colorFor(peerId){ let h=0; for(const c of peerId) h=(h*31+c.charCodeAt(0))>>>0; return PALETTE[h%PALETTE.length]; }

/* ---------- theme ---------- */
const themeBtn = $('#themeBtn');
function applyTheme(t){ document.documentElement.dataset.theme = t; try{localStorage.setItem('drop.theme',t);}catch{} }
applyTheme(load('drop.theme') || 'auto');
themeBtn.addEventListener('click', ()=>{
  const cur = document.documentElement.dataset.theme;
  applyTheme(cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark');
  toast('Theme: ' + document.documentElement.dataset.theme);
});

/* ---------- static UI ---------- */
myNameEl.textContent = myName;
function renderRoom(){
  roomCodeEl.textContent = roomCode;
  roomLinkEl.textContent = roomUrl();
  history.replaceState(null,'','#'+roomCode);
}
renderRoom();
window.addEventListener('hashchange', ()=>{
  const c = parseRoom();
  if(c && c!==roomCode){ roomCode=c; save('drop.room',c); renderRoom(); drawQR(); reconnect(); }
});

async function copyText(t, label){
  try{ await navigator.clipboard.writeText(t); toast(label+' copied'); }
  catch{
    const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta);
    ta.select(); try{document.execCommand('copy'); toast(label+' copied');}catch{toast('Copy failed — long-press the text');}
    ta.remove();
  }
}
$('#copyCodeBtn').addEventListener('click', ()=>copyText(roomCode,'Room code'));
$('#copyLinkBtn').addEventListener('click', ()=>copyText(roomUrl(),'Invite link'));
$('#newRoomBtn').addEventListener('click', ()=>{ roomCode=genCode(); save('drop.room',roomCode); renderRoom(); drawQR(); reconnect(); toast('New room created'); });
$('#joinForm').addEventListener('submit', (e)=>{ e.preventDefault(); const v=$('#joinInput').value; if(joinRoomCode(v)){ $('#joinInput').value=''; $('#joinInput').blur(); } });
// codes are lowercase-only: mirror that while typing so ABC shows as abc
$('#joinInput').addEventListener('input', (e)=>{ const el=e.target, v=el.value.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8); if(v!==el.value) el.value=v; });

/* QR: lazy-load tiny generator, no cost until needed */
let qrLibPromise = null;
function loadQRlib(){
  if(qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.onload=()=>res(window.qrcode); s.onerror=rej; document.head.appendChild(s);
  });
  return qrLibPromise;
}
async function drawQR(){
  qrEl.innerHTML='<span class="muted" style="font-size:12px;padding:8px;text-align:center">Loading QR…</span>';
  try{
    const qrcode = await loadQRlib();
    const qr = qrcode(0,'M'); qr.addData(roomUrl()); qr.make();
    qrEl.innerHTML = qr.createSvgTag({cellSize:4, margin:0, scalable:true});
    const svg = qrEl.querySelector('svg'); if(svg){svg.setAttribute('width','140');svg.setAttribute('height','140');}
  }catch{ qrEl.innerHTML='<span class="muted" style="font-size:12px;padding:10px;text-align:center">'+roomCode+'</span>'; }
}
/* QR lib (~15KB) loads only when the invite card scrolls into view — keeps first paint fast */
if('IntersectionObserver' in window){
  const qrIO = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting){ drawQR(); qrIO.disconnect(); } }); }, {rootMargin:'300px'});
  qrIO.observe(qrEl);
}else drawQR();

/* ---------- peers UI ---------- */
function renderPeers(){
  peersEl.innerHTML='';
  const list=[...peers.entries()];
  emptyState.style.display = list.length ? 'none' : '';
  statusDot.classList.toggle('waiting', !list.length);
  statusText.textContent = list.length ? `Connected to ${list.length} device${list.length>1?'s':''}` : 'Waiting for the other device…';
  netInfoEl.textContent = list.length ? `${list.length} peer(s) · WebRTC direct` : ('room '+roomCode+' · '+relayStatus());
  list.forEach(([id,p],i)=>{
    const b=document.createElement('button');
    b.type='button'; b.className='peer enter'; b.setAttribute('role','listitem');
    b.setAttribute('aria-label',`Send to ${p.name} (${p.device||'laptop'})`);
    b.innerHTML=`<span class="avatar" style="background:${p.color}">${DEV_ICON[p.device]||DEV_ICON.laptop}</span><span class="pname"></span><span class="psub">${p.device==='phone'?'Phone':'Computer'} · tap to send</span>`;
    b.querySelector('.pname').textContent=p.name;
    setTimeout(()=>b.classList.remove('enter'),600);
    b.addEventListener('click', ()=>peerMenu(id));
    b.addEventListener('dragover', e=>{e.preventDefault();b.classList.add('dragover');});
    b.addEventListener('dragleave', ()=>b.classList.remove('dragover'));
    b.addEventListener('drop', async e=>{e.preventDefault();b.classList.remove('dragover');handleFiles(await entriesFromDrop(e.dataTransfer),id);});
    peersEl.appendChild(b);
  });
}
renderPeers();

function peerMenu(peerId){
  const p=peers.get(peerId); if(!p){toast('That device left');return;}
  fileInput.dataset.to = peerId;
  // open file picker by default; long-press alternative is text via dialog button state
  // Use small confirm-free flow: show peer picker dialog with two actions
  openPeerAction(peerId);
}
function openPeerAction(peerId){
  const dlg=$('#peerDlg'), pick=$('#peerPick');
  const p=peers.get(peerId);
  $('#peerDlgH').textContent = p ? `Send to ${p.name}` : 'Choose device';
  pick.innerHTML='';
  const bf=document.createElement('button'); bf.className='btn primary'; bf.type='button'; bf.textContent='Send files';
  bf.addEventListener('click', ()=>{dlg.close(); fileInput.dataset.to=peerId; fileInput.click();});
  const bt=document.createElement('button'); bt.className='btn'; bt.type='button'; bt.textContent='Send text';
  bt.addEventListener('click', ()=>{dlg.close(); openTextDlg(peerId);});
  pick.append(bf,bt);
  if(!dlg.open) dlg.showModal();
}
$('#peerDlgClose').addEventListener('click', ()=>$('#peerDlg').close());

$('#sendFilesBtn').addEventListener('click', ()=>{
  if(!peers.size){toast('No devices yet — invite one first');return;}
  if(peers.size===1){ fileInput.dataset.to=[...peers.keys()][0]; fileInput.click(); }
  else{
    const dlg=$('#peerDlg'), pick=$('#peerPick');
    $('#peerDlgH').textContent='Choose device'; pick.innerHTML='';
    [...peers.entries()].forEach(([id,p])=>{
      const b=document.createElement('button'); b.className='btn small'; b.type='button'; b.textContent=p.name;
      b.addEventListener('click', ()=>{dlg.close(); fileInput.dataset.to=id; fileInput.click();});
      pick.appendChild(b);
    });
    if(!dlg.open) dlg.showModal();
  }
});
fileInput.addEventListener('change', ()=>{ handleFiles(filesToEntries(fileInput.files), fileInput.dataset.to||null); fileInput.value=''; });

/* text dialog */
let textTarget=null;
function openTextDlg(peerId){ textTarget=peerId; const p=peers.get(peerId); $('#textTo').textContent=p?p.name:'device'; $('#textInput').value=''; const d=$('#textDlg'); if(!d.open) d.showModal(); setTimeout(()=>$('#textInput').focus(),50); }
/* shared "which device?" picker; cb(peerId) runs after choice */
function choosePeer(title, cb){
  if(peers.size===1){ cb([...peers.keys()][0]); return; }
  const dlg=$('#peerDlg'), pick=$('#peerPick');
  $('#peerDlgH').textContent=title; pick.innerHTML='';
  [...peers.entries()].forEach(([id,p])=>{
    const b=document.createElement('button'); b.className='btn small'; b.type='button'; b.textContent=p.name;
    b.addEventListener('click', ()=>{dlg.close(); cb(id);});
    pick.appendChild(b);
  });
  if(!dlg.open) dlg.showModal();
}
$('#sendTextBtn').addEventListener('click', ()=>{
  if(!peers.size){toast('No devices yet — invite one first');return;}
  if(peers.size===1){ openTextDlg([...peers.keys()][0]); return; }
  // if no explicit target, let user pick via peer dialog first
  try{ $('#textDlg').close(); }catch{}
  choosePeer('Choose device for text', openTextDlg);
});
/* one-tap clipboard push */
$('#clipBtn').addEventListener('click', async ()=>{
  if(!peers.size){toast('No devices yet — invite one first');return;}
  let txt='';
  try{ txt=await navigator.clipboard.readText(); }
  catch{ toast('Clipboard blocked — tap the page first, then retry'); return; }
  txt=(txt||'').trim();
  if(!txt){ toast('Clipboard is empty — copy something first'); return; }
  choosePeer('Push clipboard to…', (id)=>{ sendText(txt,id); toast('Clipboard sent'); });
});
$('#textForm').addEventListener('submit', e=>{
  if(e.submitter && e.submitter.value==='send'){
    const v=$('#textInput').value.trim();
    if(v && textTarget){ sendText(v,textTarget); toast('Message sent'); }
    else if(v && !textTarget && peers.size===1){ sendText(v,[...peers.keys()][0]); toast('Message sent'); }
    else if(!v){ e.preventDefault(); return; }
  }
});

/* drag-drop + paste anywhere — folders traversed, structure preserved in `path` */
['dragover','dragenter'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();}));
async function entriesFromDrop(dt){
  const items=[...(dt.items||[])].filter(i=>i.kind==='file');
  if(items.length && items[0].webkitGetAsEntry){
    const out=[];
    const walk=(entry,dir)=>new Promise(res=>{
      if(entry.isFile) entry.file(f=>{ out.push({file:f,path:dir+entry.name}); res(); },()=>res());
      else if(entry.isDirectory){
        const r=entry.createReader();
        const read=()=>r.readEntries(es=>{ if(!es.length) return res(); Promise.all(es.map(e=>walk(e,dir+entry.name+'/'))).then(read); },()=>res());
        read();
      } else res();
    });
    await Promise.all(items.map(i=>{ const e=i.webkitGetAsEntry(); return e?walk(e,''):Promise.resolve(); }));
    if(out.length) return out;
  }
  return [...(dt.files||[])].map(f=>({file:f,path:f.webkitRelativePath||f.name}));
}
const filesToEntries = (files)=>[...(files||[])].map(f=>({file:f,path:f.webkitRelativePath||f.name}));
document.addEventListener('drop',async e=>{
  e.preventDefault();
  if(!e.dataTransfer) return;
  const entries=await entriesFromDrop(e.dataTransfer);
  if(!entries.length) return;
  if(peers.size===1) handleFiles(entries,[...peers.keys()][0]);
  else if(peers.size>1){ pendingDropFiles=entries; const dlg=$('#peerDlg'),pick=$('#peerPick'); $('#peerDlgH').textContent='Drop: choose device'; pick.innerHTML=''; [...peers.entries()].forEach(([id,p])=>{const b=document.createElement('button');b.className='btn small';b.type='button';b.textContent=p.name;b.addEventListener('click',()=>{dlg.close();handleFiles(pendingDropFiles,id);});pick.appendChild(b);}); dlg.showModal(); }
  else toast('No devices yet — invite one first');
});
let pendingDropFiles=null;
document.addEventListener('paste',e=>{
  const files=[...(e.clipboardData?.files||[])];
  if(!files.length) return;
  const entries=filesToEntries(files);
  if(peers.size===1) handleFiles(entries,[...peers.keys()][0]);
  else if(peers.size) toast('File pasted — tap a device to choose where to send');
});

/* ---------- transfers ---------- */
function handleFiles(entries, toPeer){
  const list=[...(entries||[])].filter(e=>e && e.file);
  if(!list.length) return;
  if(!peers.size){toast('No devices yet — invite one first');return;}
  const target = toPeer && peers.has(toPeer) ? toPeer : (peers.size===1?[...peers.keys()][0]:null);
  if(!target){ // ask
    pendingDropFiles=list;
    const dlg=$('#peerDlg'),pick=$('#peerPick'); $('#peerDlgH').textContent=list.length>1?`Send ${list.length} files to…`:'Choose device'; pick.innerHTML='';
    [...peers.entries()].forEach(([id,p])=>{const b=document.createElement('button');b.className='btn small';b.type='button';b.textContent=p.name;b.addEventListener('click',()=>{dlg.close();handleFiles(pendingDropFiles,id);});pick.appendChild(b);});
    dlg.showModal(); return;
  }
  list.forEach(({file,path})=>enqueueSend(file,target,path||file.webkitRelativePath||file.name));
}

function progressCard(id,name,size,dir,onCancel){
  const d=document.createElement('div'); d.className='t'; d.id='t-'+id;
  d.innerHTML=`<div class="t-top"><span class="t-name"></span><span class="t-meta"></span></div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>`;
  d.querySelector('.t-name').textContent=(dir==='up'?'Sending ':'Receiving ')+name;
  if(onCancel){
    const x=document.createElement('button'); x.className='btn small'; x.type='button'; x.textContent='✕';
    x.setAttribute('aria-label', dir==='up' ? 'Cancel transfer' : 'Dismiss');
    x.addEventListener('click', onCancel);
    d.querySelector('.t-top').appendChild(x);
  }
  transfersEl.prepend(d); return d;
}
const speedMap = {}; // transferId -> {t0, lastT, lastFrac} for live KB/s
function speedText(id, frac, size){
  const now = performance.now();
  let s = speedMap[id];
  if(!s) s = speedMap[id] = {t0:now, lastT:now, lastFrac:0};
  const dt = (now - s.lastT)/1000;
  let inst = 0;
  if(size && dt > 0.25){ inst = (frac - s.lastFrac)*size/dt; s.lastT = now; s.lastFrac = frac; }
  const avg = size ? (frac*size)/Math.max((now - s.t0)/1000, 0.1) : 0;
  const v = inst > 0 ? inst*0.7 + avg*0.3 : avg;
  return Math.round(frac*100)+'% · '+fmtSize(v)+'/s';
}
function setProgress(id,frac,size){
  const d=document.getElementById('t-'+id); if(!d) return;
  const pct=Math.round(frac*100);
  d.querySelector('.bar > i').style.width=pct+'%';
  d.querySelector('.bar').setAttribute('aria-valuenow',pct);
  d.querySelector('.t-meta').textContent = size ? speedText(id,frac,size) : pct+'%';
  if(pct>=100){d.classList.add('done'); delete speedMap[id]; setTimeout(()=>d.remove(),8000);}
}

/* ---------- send queue: one file at a time (kind to mobile radios), cancellable ---------- */
const sendQueue = [];
let activeSend = null;
function enqueueSend(file, peerId, relPath){
  const path = String(relPath||file.webkitRelativePath||file.name||'file').slice(0,260);
  const job = {id:(crypto.randomUUID?crypto.randomUUID():rid(12)), file, peerId, path, ctrl:new AbortController()};
  sendQueue.push(job);
  if(activeSend || sendQueue.length>1) toast('Queued · '+sendQueue.length+' waiting');
  pumpQueue();
}
async function pumpQueue(){
  if(activeSend || !sendQueue.length) return;
  const job = sendQueue.shift();
  if(!peers.has(job.peerId)){ toast('Skipped — that device left'); pumpQueue(); return; }
  if(!fileA || !connected){ toast('Not connected yet — wait a moment, then Retry'); sendQueue.unshift(job); return; }
  activeSend = job;
  const {file, peerId, id, path} = job;
  const card = progressCard(id, path, fmtSize(file.size), 'up', ()=>job.ctrl.abort());
  card.querySelector('.t-meta').textContent='0% · '+fmtSize(file.size);
  keepAwake(true);
  try{
    await fileA.send(file, {
      target: peerId,
      metadata: {transferId:id, name:file.name.slice(0,180), path, type:file.type||'application/octet-stream', size:file.size},
      signal: job.ctrl.signal,
      onProgress: (frac)=>setProgress(id, frac, file.size)
    });
    setProgress(id,1,file.size);
    toast('Sent '+file.name);
  }catch(err){
    document.getElementById('t-'+id)?.remove();
    delete speedMap[id];
    if(job.ctrl.signal.aborted) toast('Cancelled '+file.name);
    else{ console.warn('send failed',err); toast('Send failed — peer may have left. Tap Retry.'); }
  }
  activeSend = null;
  keepAwake(sendQueue.length>0);
  pumpQueue();
}
function sendText(text, peerId){
  if(!msgA || !connected){ toast('Not connected yet — wait a moment, then Retry'); return; }
  const target = peerId && peers.has(peerId) ? peerId : (peers.size===1?[...peers.keys()][0]:null);
  if(!target){ toast('No devices yet — invite one first'); return; }
  const id=rid(6);
  msgA.send({id,text:text.slice(0,20000),from:myName},{target}).then(()=>{
    addRecvText(text, myName+' → '+(peers.get(target)?.name||'device'), true);
  }).catch(()=>toast('Send failed — peer may have left. Tap Retry.'));
}

function addRecvFile(url,name,size,type,path){
  recvEmpty.style.display='none';
  const d=document.createElement('div'); d.className='recv';
  const isImg=type.startsWith('image/');
  d.innerHTML=`<span class="file-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg></span><div class="grow"><div class="fname"></div><div class="fmeta"></div></div>`;
  d.querySelector('.fname').textContent=name;
  d.querySelector('.fmeta').textContent=fmtSize(size)+(path&&path!==name?' · '+path:' · just now');
  const btn=document.createElement('a'); btn.className='btn small primary'; btn.textContent='Save'; btn.href=url; btn.download=name;
  // iOS fallback: open in new tab if download attr ignored
  btn.addEventListener('click', ()=>setTimeout(()=>toast('Saved '+name),300));
  const open=document.createElement('a'); open.className='btn small'; open.textContent='Open'; open.href=url; open.target='_blank'; open.rel='noopener';
  d.append(btn,open);
  if(isImg){ const img=document.createElement('img'); img.src=url; img.alt=name; img.style.cssText='width:100%;border-radius:8px;margin-top:4px;cursor:zoom-in'; img.loading='lazy'; img.addEventListener('click',()=>openLightbox(url,name)); d.querySelector('.grow').appendChild(img); }
  recvListEl.prepend(d);
}
/* fullscreen image preview */
function openLightbox(url,name){
  const dlg=$('#imgDlg'); if(!dlg) return;
  const full=$('#imgFull'); full.src=url; full.alt=name;
  const save=$('#imgSave'); if(save){ save.href=url; save.download=name; }
  if(!dlg.open) dlg.showModal();
}
function addRecvText(text, who, outgoingMsg){
  recvEmpty.style.display='none';
  const d=document.createElement('div'); d.className='recv';
  d.innerHTML=`<span class="file-ic" aria-hidden="true" style="background:var(--accent)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg></span><div class="grow"><div class="fname" style="font-weight:500"></div><div class="fmeta"></div></div>`;
  const body=d.querySelector('.fname');
  if(/^https?:\/\/\S+$/i.test(text.trim())){ const a=document.createElement('a'); a.href=text.trim(); a.target='_blank'; a.rel='noopener'; a.textContent=text.trim(); body.appendChild(a); }
  else body.textContent=text;
  d.querySelector('.fmeta').textContent=who+(outgoingMsg?' · sent':' · received');
  const cp=document.createElement('button'); cp.className='btn small'; cp.type='button'; cp.textContent='Copy';
  cp.addEventListener('click',()=>copyText(text,'Message'));
  d.appendChild(cp);
  recvListEl.prepend(d);
}

/* wake lock during transfers */
async function keepAwake(on){
  try{
    if(on && 'wakeLock' in navigator && !wakeLock){ wakeLock=await navigator.wakeLock.request('screen'); }
    if(!on && wakeLock){ await wakeLock.release().catch(()=>{}); wakeLock=null; }
  }catch{}
}

/* ---------- networking (Trystero current API: makeAction returns {send, onMessage}) ---------- */
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.ditto.pub'
];
// Free public TURN (Open Relay Project) for phone↔laptop NATs where direct
// WebRTC fails (mobile data ↔ Wi-Fi). Only used as fallback; media stays E2E-encrypted.
// See https://www.metered.ca/tools/openrelay/ and Trystero `turnConfig` docs.
const TURN = [
  {urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username:'openrelayproject', credential:'openrelayproject'}
];
let joinTimer=null, retryCount=0, connectGen=0, helloTimer=null;
let helloA=null, msgA=null, fileA=null;
function relayStatus(){
  try{
    if(!getSockets) return 'signalling…';
    const entries = Object.entries(getSockets()||{});
    if(!entries.length) return 'no relays yet';
    const open = entries.filter(([,s])=>s && s.readyState===1).length;
    return open+'/'+entries.length+' relays';
  }catch{ return 'signalling…'; }
}
function refreshNetInfo(){
  if(peers.size) return; // renderPeers owns the text once connected
  netInfoEl.textContent = 'room '+roomCode+' · '+relayStatus();
}
function stopHeartbeat(){ if(helloTimer){ clearInterval(helloTimer); helloTimer=null; } }
function startHeartbeat(gen){
  stopHeartbeat();
  const beat = ()=>{ if(gen===connectGen && helloA && !peers.size) helloA.send(helloMsg()).catch(()=>{}); };
  helloTimer = setInterval(beat, 3000);
}
async function connect(){
  // No `if(connecting) return` — a stuck attempt must never strand later ones.
  // The generation counter cancels stale attempts instead.
  connecting = true; connected = false;
  const gen = ++connectGen;
  stopHeartbeat();
  statusText.textContent='Loading signalling…';
  try{
  let joinRoom;
  try{ ({joinRoom, getRelaySockets: getSockets} = await import(TRYSTERO_URL)); }
  catch(err){ if(gen!==connectGen) return; throw new Error('Could not load signalling library — check network/ad-blocker, then Retry'); }
  if(gen !== connectGen) return;
  statusText.textContent='Connecting…';
  if(room) { try{room.leave();}catch{} peers.clear(); renderPeers(); }
  room = joinRoom(
    {appId:APP_ID, relayConfig:{urls:RELAYS}, turnConfig:TURN},
    'room-'+roomCode,
    {onJoinError:(d)=>{ console.warn('peer join failed', d); toast('Direct connection failed — trying relay. Keep both pages open.'); }}
  );
  helloA = room.makeAction('hello');
  msgA = room.makeAction('msg');
  fileA = room.makeAction('file');
  connected = true;
  pumpQueue(); // resume anything queued while offline

  room.onPeerJoin = (id)=>{
    helloA.send(helloMsg(),{target:id}).catch(()=>{});
    setStatusWaiting();
  };
  room.onPeerLeave = (id)=>{ peers.delete(id); renderPeers(); if(!peers.size && gen===connectGen) startHeartbeat(gen); };
  helloA.onMessage = (data,{peerId})=>{
    const isNew = !peers.has(peerId);
    peers.set(peerId,{name:String(data?.name||'Device').slice(0,40),color:colorFor(peerId+String(data?.id||'')),device:String(data?.device)==='phone'?'phone':'laptop'});
    renderPeers();
    if(peers.size) stopHeartbeat();
    // reply only once per new peer — otherwise two devices ping-pong hellos forever
    if(isNew) helloA.send(helloMsg(),{target:peerId}).catch(()=>{});
  };
  msgA.onMessage = (d,{peerId})=>{ const p=peers.get(peerId); addRecvText(String(d.text||''), (p?.name||'Device')+' · received', false); toast('Message received'); try{ navigator.vibrate && navigator.vibrate(40); }catch{} };
  fileA.onReceiveProgress = (frac,{peerId,metadata})=>{
    const tid = metadata?.transferId; if(!tid) return;
    if(!document.getElementById('t-'+tid)){
      progressCard(tid, String(metadata?.path||metadata?.name||'file'), '', 'down', ()=>{
        document.getElementById('t-'+tid)?.remove();
        delete speedMap[tid];
      });
      keepAwake(true);
    }
    setProgress(tid, frac, metadata?.size||0);
  };
  fileA.onMessage = (data,{peerId,metadata})=>{
    const name = String(metadata?.name||'file').slice(0,180);
    const type = String(metadata?.type||'application/octet-stream');
    const transferId = String(metadata?.transferId||rid(8));
    const blob = data instanceof Blob ? data : new Blob([data],{type});
    const url = URL.createObjectURL(blob);
    addRecvFile(url,name,blob.size,type,String(metadata?.path||''));
    setProgress(transferId,1,blob.size);
    toast('Received '+name);
    try{ navigator.vibrate && navigator.vibrate([60,40,60]); }catch{}
    if(autoSaveEl.checked){ const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
    keepAwake(false);
  };

  // announce self to anyone already in the room. One broadcast races a late
  // joiner, so keep a 3s heartbeat until the first peer appears (cleared on
  // peer join / room change). This is what fixes "phone joins later, sees
  // nothing" — the old code stopped announcing after 4s.
  helloA.send(helloMsg()).catch(()=>{});
  startHeartbeat(gen);
  refreshNetInfo();
  setTimeout(()=>{ if(gen===connectGen) refreshNetInfo(); }, 3000);
  clearTimeout(joinTimer);
  joinTimer=setTimeout(()=>{
    if(gen!==connectGen || peers.size) return;
    statusText.textContent='Still waiting — check both links show "'+roomCode+'", disable VPN, then tap Retry';
    netInfoEl.textContent='room '+roomCode+' · '+relayStatus()+' · if this page is old, hard-refresh (Ctrl+Shift+R)';
  },12000);
  }finally{
    if(gen===connectGen) connecting = false;
  }
}
function setStatusWaiting(){ if(!peers.size) statusText.textContent='Connecting…'; }
async function reconnect(){
  retryCount++;
  try{ await connect(); if(connected && peers.size) toast('Reconnected'); }
  catch(err){ console.warn(err); connected=false; statusText.textContent=String(err?.message||'Connection failed — tap Retry'); toast(String(err?.message||'Signalling unreachable. Check network, then Retry.')); }
}
$('#retryBtn').addEventListener('click', reconnect);
// Phone sleep / network switch kills signalling: re-announce when back.
window.addEventListener('online', ()=>{ if(helloA && !peers.size){ helloA.send(helloMsg()).catch(()=>{}); reconnect(); } });
/* folder picker (webkitdirectory keeps relative paths) */
const dirInput = $('#dirInput');
$('#folderBtn').addEventListener('click', ()=>{
  if(!peers.size){toast('No devices yet — invite one first');return;}
  if(!('webkitdirectory' in (document.createElement('input')))){ toast('Folder pick not supported here — drag a folder instead'); return; }
  choosePeer('Send folder to…', (id)=>{ dirInput.dataset.to=id; dirInput.click(); });
});
if(dirInput) dirInput.addEventListener('change', ()=>{ handleFiles(filesToEntries(dirInput.files), dirInput.dataset.to||null); dirInput.value=''; });
/* PWA install prompt */
let deferredInstall=null;
const installBtn=$('#installBtn');
window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredInstall=e; if(installBtn) installBtn.hidden=false; });
if(installBtn) installBtn.addEventListener('click', async ()=>{
  if(!deferredInstall) return;
  deferredInstall.prompt();
  try{ await deferredInstall.userChoice; }catch{}
  deferredInstall=null; installBtn.hidden=true;
});
window.addEventListener('appinstalled',()=>{ deferredInstall=null; if(installBtn) installBtn.hidden=true; toast('App installed'); });
/* lightbox close */
const imgDlg=$('#imgDlg');
if(imgDlg){
  const close=()=>{ try{imgDlg.close();}catch{} $('#imgFull').removeAttribute('src'); };
  $('#imgClose').addEventListener('click', close);
  imgDlg.addEventListener('click', (e)=>{ if(e.target===imgDlg) close(); });
}
try{
  if('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
}catch{}
connect().catch(err=>{ console.warn(err); connected=false; statusText.textContent=String(err?.message||'Connection failed — tap Retry'); });

document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ keepAwake(false); return; }
  // coming back from phone lock: re-announce in case the other side gave up
  if(helloA && connected && !peers.size) helloA.send(helloMsg()).catch(()=>{});
});
