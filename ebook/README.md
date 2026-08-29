# eBanglaLibrary Downloader — GitHub Pages

Single-file, no-build downloader for https://www.ebanglalibrary.com

Paste a **book URL** (e.g. `https://www.ebanglalibrary.com/books/আজব-ও-জবর-আজব-অর্থনীতি-আক/`) or an **author URL** (`https://www.ebanglalibrary.com/authors/আকবর-আলি-খান/`).

### Features
- Fetches cover, title, author, genre, publisher info, intro + all chapters
- Chapters are **public** — no login needed (uses the `/lessons/` pages). If a book ever becomes gated, it shows `Login required` clearly.
- Builds **with proper metadata + cover**:
  - `EPUB` — standards-compliant, TOC, cover-image, `dc:creator` etc. — works in Apple Books, Calibre, Moon Reader
  - `PDF` — via print engine (best Bengali rendering with Noto Serif Bengali)
  - `MOBI` / `AZW3` — EPUB-based Kindle-compatible (Amazon now accepts EPUB via Send to Kindle; for legacy Kindle use Calibre 1-click convert)
  - `HTML` single-file + `TXT` + `JSON` metadata
- **Errors are shown** in a red log (HTTP status, CORS, 404, 429, Cloudflare) — never silent failure.
- Pure static — no server, no secrets — perfect for **GitHub Pages**.

### Deploy to GitHub Pages
1. Create repo, add `index.html` to root (or `docs/`).
2. Settings → Pages → Source: `Deploy from branch` → `main` / `(root)` → Save.
3. Wait ~1 min, open `https://<you>.github.io/<repo>/`.

No build step. All logic runs in the browser. Uses CORS proxies (`corsproxy.io → allorigins → codetabs`) because `ebanglalibrary.com` does not send `Access-Control-Allow-Origin`. The UI tries them in order and shows which one succeeded/failed.

### Local use
Just open `index.html` directly — but `file://` may block fetch. Prefer `python3 -m http.server 8000` and open `http://localhost:8000`.

### Python CLI mirror
See `ebangla_downloader.py` in same folder:

```bash
pip install requests beautifulsoup4
python ebangla_downloader.py "https://www.ebanglalibrary.com/books/আজব-ও-জবর-আজব-অর্থনীতি-আক/" --format epub
```

### Notes
- Respects public content only. Does not bypass logins/paywalls.
- Be gentle: 300ms delay between chapter fetches, with progress bar.
- Cover is fetched as binary and embedded in EPUB; if CDN blocks it, book still builds (text-only).

