#!/usr/bin/env python3
"""Generic page-change probe. All stdlib.
Runtime secrets (env): PROBE_KEY, TG_TOKEN, TG_CHAT.
Repo contains no target URLs and no non-English text.
State file keeps only hashes + dates, never titles or links.
"""
import re, os, sys, json, hashlib, html as H
import urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
BLOB = os.path.join(HERE, "targets.enc.json")
STATE = os.path.join(HERE, "state.json")

KEY = os.environ.get("PROBE_KEY", "")
TG_TOKEN = os.environ.get("TG_TOKEN", "")
TG_CHAT = os.environ.get("TG_CHAT", "")
TEST = os.environ.get("PROBE_TEST") == "1"

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
HOT = []  # filled from encrypted blob at runtime
HOT_EXTRA = ["finalresult", "final", "meritlist", "recommend"]

def norm(s):
    s = H.unescape(s or "")
    s = re.sub(r"<[^>]+>", "", s)
    s = s.translate(BN_DIGITS)
    s = s.replace("।", "").replace(".", "")
    return re.sub(r"\s+", "", s)

CFG = {}
def hot_match(title):
    n = norm(title).lower()
    return any(k in n for k in HOT) or any(k in n for k in HOT_EXTRA)

def decrypt_targets():
    import base64
    from Crypto.Cipher import AES
    from Crypto.Protocol.KDF import PBKDF2
    from Crypto.Hash import SHA256
    j = json.load(open(BLOB, encoding="utf-8"))
    salt = base64.b64decode(j["salt"])
    iv = base64.b64decode(j["iv"])
    data = base64.b64decode(j["data"])
    k = PBKDF2(KEY, salt, dkLen=32, count=j.get("iter", 100000),
               hmac_hash_module=SHA256)
    c = AES.new(k, AES.MODE_GCM, nonce=iv)
    pt = c.decrypt_and_verify(data[:-16], data[-16:])
    return json.loads(pt.decode("utf-8"))

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="ignore")

def parse(page):
    out = []
    for m in re.finditer(r'<tr class="table-tr">(.*?)</tr>', page, re.S):
        row = m.group(1)
        t = re.search(r'data-column="title">\s*(.*?)\s*</td>', row, re.S)
        p = re.search(r'data-column="pdf">.*?href="([^"]+\.pdf)"', row, re.S)
        d = re.search(r'data-column="publish_date">.*?<span>(.*?)</span>', row, re.S)
        v = re.search(r'<a href="(' + re.escape(CFG.get("pat", "/") ) + r'[^"]+)">', row)
        if not (t and v):
            continue
        title = re.sub(r"\s+", " ", H.unescape(
            re.sub(r"<[^>]+>", "", t.group(1)))).strip()
        out.append({
            "h": hashlib.sha256(v.group(1).encode()).hexdigest()[:32],
            "title": title,
            "pdf": p.group(1) if p else "",
            "date": H.unescape(d.group(1)).strip().translate(BN_DIGITS) if d else "",
            "link": CFG["base"] + v.group(1),
        })
    return out

def send(text):
    if not (TG_TOKEN and TG_CHAT):
        if os.environ.get("PROBE_VERBOSE") == "1":
            print("[DRY-RUN]\n" + text + "\n")
        else:
            print(f"[DRY-RUN] message suppressed ({len(text)} chars)")
        return False
    data = urllib.parse.urlencode(
        {"chat_id": TG_CHAT, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage", data=data)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status == 200

def run_url():
    base = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    rid = os.environ.get("GITHUB_RUN_ID", "")
    if repo and rid:
        return f"{base}/{repo}/actions/runs/{rid}"
    return "(local run)"

def main():
    if TEST:
        ok = send("Probe test: monitoring channel is live. "
                  "You will get an alert here on any new item or any failure.")
        print("test sent" if ok else "test dry-run (secrets missing)")
        return
    try:
        global CFG, HOT
        CFG = decrypt_targets()
        HOT = CFG.get("hot", [])
        urls = [CFG["base"] + u for u in CFG["urls"]]
    except Exception as e:
        print("FATAL: cannot unlock target list:", e)
        send(f"PROBE FAILURE: cannot unlock target list ({e}). "
             f"Check secrets. Logs: {run_url()}")
        sys.exit(1)
    items, errors = [], []
    for u in urls:
        try:
            items += parse(get(u))
        except Exception as e:
            errors.append(f"{e}")
    if not items:
        # total blind: both sources failed
        st = {}
        if os.path.exists(STATE):
            try:
                st = json.load(open(STATE, encoding="utf-8"))
            except Exception:
                pass
        if not st.get("_failing"):
            st["_failing"] = True
            json.dump(st, open(STATE, "w"))
            send(f"PROBE FAILURE: all sources unreachable ({'; '.join(errors)[:200]}). "
                 f"You are currently BLIND - retrying every 5 min. Logs: {run_url()}")
            print("failure alert sent")
        else:
            print("still failing, alert already sent")
        return
    st = {}
    first = not os.path.exists(STATE)
    if not first:
        try:
            st = json.load(open(STATE, encoding="utf-8"))
        except Exception:
            first = True
    was_failing = st.pop("_failing", False)
    new = [x for x in items if x["h"] not in st]
    seen_ids = set(st)
    uniq = [x for x in new if x["h"] not in seen_ids
            and not seen_ids.add(x["h"])]
    for x in items:
        st[x["h"]] = x["date"]
    json.dump(st, open(STATE, "w"))
    print(f"total={len(items)} new={len(uniq)}")
    if first:
        send(f"Probe started. Tracking {len(items)} existing items. "
             f"Alerts will arrive here on any new item.")
        return
    if was_failing:
        send("Probe recovered: sources reachable again.")
    for x in uniq:
        flag = ("\n*** FINAL-RESULT keywords matched - CHECK IMMEDIATELY ***"
                if hot_match(x["title"]) else "")
        msg = (f"NEW ITEM ALERT{flag}\n\nTitle: {x['title']}\n"
               f"Published: {x['date']}\nDetails: {x['link']}")
        if x["pdf"]:
            msg += f"\nPDF: {x['pdf']}"
        send(msg)
        print("alerted:", x["h"])

if __name__ == "__main__":
    main()
