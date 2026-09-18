/* Drop scan page: native BarcodeDetector first, jsQR fallback, upload + manual fallback. */
const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const upload = document.getElementById('upload');
const manual = document.getElementById('manual');
const joinBtn = document.getElementById('joinBtn');
const canvas = document.getElementById('canvas');
const toastEl = document.getElementById('toast');
let stream = null, raf = 0, done = false, jsQR = null;

try {
  const t = localStorage.getItem('drop.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch {}

function toast(m){ toastEl.textContent=m; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),2600); }
function setStatus(m){ statusEl.textContent=m; }

function extractRoom(text){
  if(!text) return null;
  const s = String(text).trim();
  const norm = (v)=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8);
  const h = s.match(/#r=([A-Za-z0-9]{3,8})/); // legacy links
  if(h){ const c=norm(h[1]); if(c.length>=3) return c; }
  const hb = s.match(/#([A-Za-z0-9]{3,8})\s*$/); // clean #abc links
  if(hb){ const c=norm(hb[1]); if(c.length>=3) return c; }
  const c = s.match(/^([A-Za-z0-9]{3,8})$/);
  if(c){ const v=norm(c[1]); if(v.length>=3) return v; }
  const q = s.match(/[?&]r=([A-Za-z0-9]{3,8})/);
  if(q){ const v=norm(q[1]); if(v.length>=3) return v; }
  return null;
}
function goRoom(code){
  if(done) return; done = true;
  stop();
  setStatus('Found room ' + code + ' — joining…');
  location.href = './#' + encodeURIComponent(code);
}

async function loadJsQR(){
  if(jsQR) return jsQR;
  setStatus('Loading fallback decoder…');
  await new Promise((res, rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  jsQR = window.jsQR;
  if(!jsQR) throw new Error('decoder failed');
  return jsQR;
}

async function start(){
  done = false;
  if(!window.isSecureContext && location.hostname!=='localhost'){
    setStatus('Camera needs HTTPS. Upload a QR image or paste the link instead.');
    return;
  }
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
  }catch(err){
    console.warn(err);
    setStatus('Camera blocked. You can still upload a QR screenshot or paste the invite link below.');
    return;
  }
  video.srcObject = stream;
  await video.play().catch(()=>{});
  startBtn.disabled = true; stopBtn.disabled = false;

  const hasNative = 'BarcodeDetector' in window;
  let detector = null;
  if(hasNative){
    try{ detector = new window.BarcodeDetector({formats:['qr_code']}); }catch{ detector=null; }
  }
  if(detector){
    setStatus('Scanning… hold the QR inside the frame.');
    const loop = async ()=>{
      if(done) return;
      try{
        if(video.readyState===video.HAVE_ENOUGH_DATA){
          const codes = await detector.detect(video);
          if(codes && codes.length){
            const code = extractRoom(codes[0].rawValue);
            if(code){ goRoom(code); return; }
            setStatus('QR found but no room code in it. Try the other device’s invite QR.');
          }
        }
      }catch(e){ /* keep scanning */ }
      raf = requestAnimationFrame(()=>setTimeout(loop, 180));
    };
    loop();
  } else {
    try{ await loadJsQR(); }
    catch{ setStatus('Live scan unavailable here. Upload a QR image or paste the link.'); stop(); return; }
    setStatus('Scanning… hold the QR inside the frame.');
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    const loop = ()=>{
      if(done) return;
      if(video.readyState===video.HAVE_ENOUGH_DATA){
        const w = video.videoWidth, h = video.videoHeight;
        if(w && h){
          canvas.width=w; canvas.height=h;
          ctx.drawImage(video,0,0,w,h);
          try{
            const data = ctx.getImageData(0,0,w,h);
            const r = jsQR(data.data, w, h, {inversionAttempts:'attemptBoth'});
            if(r && r.data){
              const code = extractRoom(r.data);
              if(code){ goRoom(code); return; }
            }
          }catch{}
        }
      }
      raf = requestAnimationFrame(()=>setTimeout(loop, 220));
    };
    loop();
  }
}
function stop(){
  cancelAnimationFrame(raf);
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  try{ video.pause(); }catch{}
  video.srcObject=null;
  startBtn.disabled=false; stopBtn.disabled=true;
}

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', ()=>{ stop(); setStatus('Stopped. Tap Start camera to scan again.'); });

upload.addEventListener('change', async ()=>{
  const f = upload.files && upload.files[0];
  if(!f) return;
  setStatus('Reading image…');
  try{
    await loadJsQR();
    const bmp = await createImageBitmap(f);
    canvas.width=bmp.width; canvas.height=bmp.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bmp,0,0);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height);
    const r=jsQR(data.data,canvas.width,canvas.height);
    if(r && r.data){
      const code=extractRoom(r.data);
      if(code){ goRoom(code); return; }
    }
    setStatus('No QR found in that image. Try a clearer screenshot or paste the link.');
  }catch(err){ console.warn(err); setStatus('Could not read that image. Paste the invite link instead.'); }
  upload.value='';
});

joinBtn.addEventListener('click', ()=>{
  const code=extractRoom(manual.value);
  if(!code){ toast('Enter a valid link or 3-letter code'); manual.focus(); return; }
  goRoom(code);
});
manual.addEventListener('keydown', e=>{ if(e.key==='Enter') joinBtn.click(); });
window.addEventListener('pagehide', stop);
