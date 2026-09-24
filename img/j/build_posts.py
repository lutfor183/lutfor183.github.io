#!/usr/bin/env python3
"""Build posts.json from Blogger sitemap + ld+json (no feed/dashboard needed).
Run: python3 build_posts.py [--max 400]
Output: posts.json next to this script, sorted newest-first (chronological).
Incremental: reuses entries whose <lastmod> is unchanged.
"""
import re, json, html, os, sys, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = os.environ.get("JC_BASE", "https://jobcircular.jobalertbd.com").rstrip("/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "posts.json")
ENC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "posts.enc.json")
MAX_POSTS = int(sys.argv[sys.argv.index("--max")+1]) if "--max" in sys.argv else int(os.environ.get("JC_MAX", "400"))

def get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (job-portal-builder)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ct = r.headers.get("Content-Type", "")
        raw = r.read()
    # detect charset
    m = re.search(r"charset=([\w-]+)", ct)
    enc = m.group(1) if m else "utf-8"
    try:
        return raw.decode(enc, errors="ignore")
    except Exception:
        return raw.decode("utf-8", errors="ignore")

def sitemap_entries():
    idx = get(BASE + "/sitemap.xml")
    pages = re.findall(r"<loc>([^<]*sitemap\.xml\?page=\d+[^<]*)</loc>", idx)
    if not pages:
        pages = [BASE + "/sitemap.xml?page=1"]
    entries = []
    for p in pages:
        xml = get(p)
        locs = re.findall(r"<loc>([^<]+)</loc>", xml)
        mods = re.findall(r"<lastmod>([^<]+)</lastmod>", xml)
        for i, loc in enumerate(locs):
            loc = loc.split("?")[0].strip()
            if not re.search(r"/\d{4}/\d{2}/", loc):
                continue
            mod = mods[i].strip() if i < len(mods) else ""
            entries.append({"loc": loc, "mod": mod})
    # dedupe, keep newest mod
    best = {}
    for e in entries:
        o = best.get(e["loc"])
        if not o or (e["mod"] > o["mod"]):
            best[e["loc"]] = e
    entries = sorted(best.values(), key=lambda e: e["mod"], reverse=True)
    return entries

def parse_post(url, mod):
    try:
        data = get(url)
    except Exception as e:
        return {"title": "(could not load)", "link": url, "date": mod[:10], "mod": mod[:10],
                "labels": [], "type": "JOB", "img": ""}
    # ld+json block
    m = re.search(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', data, re.S | re.I)
    title, pub, img = "", "", ""
    if m:
        js = m.group(1)
        t = re.search(r'"headline"\s*:\s*"((?:[^"\\]|\\.)*)"', js)
        if t:
            title = html.unescape(t.group(1)).strip()
        d = re.search(r'"datePublished"\s*:\s*"([^"]+)"', js)
        if d:
            pub = d.group(1).strip()
        im = re.search(r'"url"\s*:\s*"(https://blogger[^"]+)"', js)
        if im:
            img = im.group(1).replace("\\/", "/")
    if not title:
        t = re.search(r"<title>(.*?)</title>", data, re.S | re.I)
        if t:
            title = html.unescape(re.sub(r"<[^>]+>", "", t.group(1))).strip()
    # strip promo junk sometimes inside headline
    title = re.sub(r"\s+", " ", title)[:300] or "(untitled)"
    # labels from /search/label/ links
    labs = re.findall(r"/search/label/([^\"'?\s>]+)", data)
    labels = []
    for l in labs:
        try:
            l = urllib.parse.unquote(l)
        except Exception:
            pass
        l = html.unescape(l).strip()
        if l and l not in labels and len(l) < 60:
            labels.append(l)
    date = (pub[:10] if pub else mod[:10])
    # guard against blog typos like year 5050: fall back to sitemap lastmod
    try:
        y = int(date[:4])
        import datetime as _dt
        if y < 2000 or y > _dt.datetime.now().year + 1:
            date = mod[:10]
    except Exception:
        date = mod[:10]
    return {"title": title, "link": url, "date": date, "mod": mod[:10],
            "labels": labels[:10], "type": "JOB", "img": img}

def encrypt_file(src, dst, password):
    """AES-256-GCM + PBKDF2-SHA256(100k), WebCrypto-compatible. No plaintext URLs leak."""
    import base64
    from Crypto.Cipher import AES
    from Crypto.Protocol.KDF import PBKDF2
    from Crypto.Hash import SHA256
    from Crypto.Random import get_random_bytes
    inner = open(src, encoding="utf-8").read()
    salt = get_random_bytes(16)
    iv = get_random_bytes(12)
    key = PBKDF2(password, salt, dkLen=32, count=100000, hmac_hash_module=SHA256)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ct, tag = cipher.encrypt_and_digest(inner.encode("utf-8"))
    out = {"v": 1, "iter": 100000,
           "salt": base64.b64encode(salt).decode(),
           "iv": base64.b64encode(iv).decode(),
           "data": base64.b64encode(ct + tag).decode()}
    json.dump(out, open(dst, "w"))
    print(f"encrypted -> {dst} ({os.path.getsize(dst)} bytes)")


def main():
    print(f"base={BASE} max={MAX_POSTS}")
    entries = sitemap_entries()
    print(f"sitemap urls: {len(entries)}")
    entries = entries[:MAX_POSTS]
    old = {}
    if os.path.exists(OUT):
        try:
            oj = json.load(open(OUT, encoding="utf-8"))
            for p in oj.get("posts", []):
                old[p["link"]] = p
        except Exception as e:
            print("old cache unreadable:", e)
    todo, reused = [], []
    for e in entries:
        o = old.get(e["loc"])
        if o and o.get("mod") == e["mod"][:10] and o.get("title"):
            reused.append(o)
        else:
            todo.append(e)
    print(f"reuse={len(reused)} fetch={len(todo)}")
    fresh = []
    def work(e):
        return parse_post(e["loc"], e["mod"])
    with ThreadPoolExecutor(max_workers=10) as ex:
        for i, p in enumerate(ex.map(work, todo)):
            fresh.append(p)
            if (i+1) % 25 == 0:
                print(f"  {i+1}/{len(todo)}")
    posts = reused + fresh
    # chronological: newest date first, tie-break by mod/link
    posts.sort(key=lambda p: (p.get("date") or "", p.get("mod") or "", p.get("link") or ""), reverse=True)
    import datetime
    out = {"updated": datetime.datetime.utcnow().isoformat() + "Z", "base": BASE,
           "count": len(posts), "posts": posts}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"wrote {OUT} ({len(posts)} posts)")
    try:
        encrypt_file(OUT, ENC, os.environ.get("JC_PASS") or "8880")
    except Exception as e:
        print("encryption skipped (need pycryptodome):", e)
    for p in posts[:5]:
        print(" ", p["date"], p["title"][:70])

if __name__ == "__main__":
    main()
