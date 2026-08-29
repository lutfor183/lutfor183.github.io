#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eBanglaLibrary Downloader — Python CLI mirror
Works without login (chapters are public /lessons/). Shows errors clearly.
Generates EPUB / HTML / TXT / JSON with cover + metadata.

Usage:
  pip install requests beautifulsoup4
  python ebangla_downloader.py "https://www.ebanglalibrary.com/books/আজব-ও-জবর-আজব-অর্থনীতি-আক/" --format epub
  python ebangla_downloader.py "https://www.ebanglalibrary.com/authors/আকবর-আলি-খান/" --list
"""
import re, json, sys, time, argparse, pathlib, zipfile, io
from urllib.parse import urljoin, unquote
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (eBanglaDownloader/1.0)"}
TIMEOUT = 20

def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code} for {url}: {r.text[:300]}")
    if "Accessing this book requires a login" in r.text and "ld-tab-content" not in r.text:
        raise RuntimeError("Login required for this URL")
    return r.text

def parse_book(html, url):
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.select_one("h1.page-header-title") or soup.find("title"))
    title = title.get_text(strip=True) if title else "Unknown"
    cover = ""
    img = soup.select_one(".entry-image-single img")
    if img:
        cover = img.get("data-src") or img.get("src") or ""
    if not cover:
        m = soup.find("meta", property="og:image")
        if m: cover = m.get("content","")
    if cover.startswith("//"): cover="https:"+cover
    author_el = soup.select_one(".entry-terms-authors a")
    author = author_el.get_text(strip=True) if author_el else ""
    author_url = author_el.get("href","") if author_el else ""
    genre_el = soup.select_one(".entry-terms-ld_course_category a")
    genre = genre_el.get_text(strip=True) if genre_el else ""
    info = ""
    entry = soup.select_one(".entry-content")
    if entry:
        p = entry.find("p")
        if p: info = p.get_text(" ", strip=True)
    lessons = []
    for a in soup.select("a.ld-item-name"):
        href = a.get("href","")
        t = a.select_one(".ld-item-title")
        t = t.get_text(strip=True) if t else a.get_text(strip=True)
        if href: lessons.append({"url": href, "title": t})
    return {"title":title,"cover":cover,"author":author,"author_url":author_url,"genre":genre,"info":info,"lessons":lessons,"url":url}

def parse_lesson(html, url):
    soup = BeautifulSoup(html, "html.parser")
    el = soup.select_one(".ld-tab-content") or soup.select_one(".ld-focus-content") or soup.select_one(".entry-content") or soup
    # clone and clean
    for bad in el.select("script, style, .ld-focus-comments, form, .ebang-before-content, .ebang-random-paragraph"):
        bad.decompose()
    title = (soup.find("title").get_text(strip=True) if soup.find("title") else "")
    inner_html = "".join(str(c) for c in el.contents).strip() if el else ""
    # fallback to el.decode_contents()
    if not inner_html and el:
        inner_html = el.decode_contents()
    text = el.get_text("\n", strip=True) if el else ""
    return {"title":title, "html": inner_html or "<p>(empty)</p>", "text": text, "url": url}

def build_epub(book, chapters, out_path):
    # download cover
    cover_data = None
    cover_ext = "jpg"
    if book["cover"]:
        try:
            r = requests.get(book["cover"], headers=HEADERS, timeout=TIMEOUT)
            if r.ok and len(r.content) > 800:
                cover_data = r.content
                cover_ext = book["cover"].split(".")[-1].split("?")[0].lower()[:4]
                if cover_ext not in ("jpg","jpeg","png","webp"): cover_ext="jpg"
                print(f"  cover: {len(cover_data)} bytes")
            else:
                print(f"  cover fetch failed: HTTP {r.status_code}")
        except Exception as e:
            print(f"  cover error: {e}")

    import uuid
    book_id = "urn:uuid:"+str(uuid.uuid4())
    date = time.strftime("%Y-%m-%d")
    slug = re.sub(r"[^a-z0-9\u0980-\u09FF]+","-", book["title"].lower()).strip("-")[:60] or "book"

    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, "w")
    # mimetype must be STORE
    z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")

    manifest=[]; spine=[]
    def esc(s): return (s or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")

    if cover_data:
        mime = "image/jpeg" if cover_ext in ("jpg","jpeg") else "image/png" if cover_ext=="png" else "image/webp"
        z.writestr(f"OEBPS/images/cover.{cover_ext}", cover_data)
        manifest.append(f'<item id="cover-image" href="images/cover.{cover_ext}" media-type="{mime}" properties="cover-image"/>')
        z.writestr("OEBPS/cover.xhtml", f'<?xml version="1.0"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head><body style="margin:0;text-align:center"><img src="images/cover.{cover_ext}" style="max-width:100%;height:100vh" alt="cover"/></body></html>')
        manifest.append('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>')
        spine.append('<itemref idref="cover"/>')

    z.writestr("OEBPS/style.css", "body{font-family:serif;line-height:1.8;margin:1em} h2{border-bottom:1px solid #ddd} p{margin:0 0 .8em;text-align:justify}")
    manifest.append('<item id="css" href="style.css" media-type="text/css"/>')

    nav_items=[]
    for i,ch in enumerate(chapters):
        fname = f"chapter_{i+1:03d}.xhtml"
        err = f'<p style="color:red">[ERROR: {esc(ch.get("error",""))}]</p>' if ch.get("error") else ""
        body = ch.get("html","<p>(empty)</p>")
        xhtml = f'<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="bn"><head><title>{esc(ch["title"])}</title><link rel="stylesheet" href="style.css"/></head><body><h2>{esc(ch["title"])}</h2>{err}<div>{body}</div></body></html>'
        z.writestr("OEBPS/"+fname, xhtml.encode("utf-8"))
        manifest.append(f'<item id="ch{i+1}" href="{fname}" media-type="application/xhtml+xml"/>')
        spine.append(f'<itemref idref="ch{i+1}"/>')
        nav_items.append(f'<li><a href="{fname}">{esc(ch["title"])}</a></li>')

    z.writestr("OEBPS/nav.xhtml", f'<?xml version="1.0"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>TOC</title></head><body><nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><h1>Contents</h1><ol>{"".join(nav_items)}</ol></nav></body></html>')
    manifest.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
    # ncx
    ncx_points=""
    for i,ch in enumerate(chapters):
        ncx_points+=f'<navPoint id="ch{i+1}" playOrder="{i+1}"><navLabel><text>{esc(ch["title"])}</text></navLabel><content src="chapter_{i+1:03d}.xhtml"/></navPoint>'
    z.writestr("OEBPS/toc.ncx", f'<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z39.86/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="{book_id}"/></head><docTitle><text>{esc(book["title"])}</text></docTitle><navMap>{ncx_points}</navMap></ncx>')
    manifest.append('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>')

    opf = f'''<?xml version="1.0"?><package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">{book_id}</dc:identifier><dc:title>{esc(book["title"])}</dc:title><dc:creator>{esc(book["author"])}</dc:creator><dc:language>bn</dc:language><dc:publisher>eBanglaLibrary</dc:publisher><dc:date>{date}</dc:date><dc:description>{esc(book["info"][:500])}</dc:description><dc:source>{esc(book["url"])}</dc:source><meta property="dcterms:modified">{time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}</meta></metadata><manifest>{"".join(f"<item {m}" if m.startswith("id=") else m for m in manifest)}</manifest><spine toc="ncx">{"".join(spine)}</spine></package>'''
    # Fix manifest wrapping: we built strings already with <item .../>, need to reformat
    # Simpler: rebuild
    z.writestr("OEBPS/content.opf", opf)

    z.close()
    pathlib.Path(out_path).write_bytes(buf.getvalue())
    print(f"✓ EPUB saved to {out_path} ({len(buf.getvalue())/1024:.1f} KB)")

def main():
    ap = argparse.ArgumentParser(description="eBanglaLibrary downloader")
    ap.add_argument("url", help="book URL or author URL")
    ap.add_argument("--format", choices=["epub","html","txt","json"], default="epub")
    ap.add_argument("--out", help="output file")
    ap.add_argument("--list", action="store_true", help="just list books if author URL")
    ap.add_argument("--delay", type=float, default=0.3, help="delay between chapter fetches")
    args = ap.parse_args()

    print(f"Fetching {args.url} ...")
    try:
        html = fetch(args.url)
    except Exception as e:
        print(f"✗ Fetch failed: {e}", file=sys.stderr)
        sys.exit(1)

    if "/authors/" in args.url or args.list:
        soup = BeautifulSoup(html, "html.parser")
        books = list({a.get("href") for a in soup.select("a.entry-title-link, a.entry-image-link") if a.get("href") and "/books/" in a.get("href")})
        titles = {a.get("href"):a.get_text(strip=True) for a in soup.select("a.entry-title-link")}
        if not books:
            print("No books found (maybe author has no books or layout changed)")
        else:
            for u in books:
                print(f"- {titles.get(u,'')} :: {u}")
        if args.list: return
        # if author page but not --list, pick first
        if books:
            print(f"\nPicking first book: {books[0]}")
            args.url = books[0]
            html = fetch(args.url)

    book = parse_book(html, args.url)
    print(f"Book: {book['title']}\nAuthor: {book['author']} | Genre: {book['genre']}\nCover: {book['cover']}\nChapters: {len(book['lessons'])}")
    if not book["lessons"]:
        print("✗ No chapters found — aborting")
        sys.exit(1)

    chapters=[]
    for i, ch in enumerate(book["lessons"]):
        print(f"  [{i+1}/{len(book['lessons'])}] {ch['title']} …", end=" ", flush=True)
        try:
            h = fetch(ch["url"])
            parsed = parse_lesson(h, ch["url"])
            parsed["title"] = ch["title"]  # prefer list title
            chapters.append(parsed)
            print(f"OK ({len(parsed['text'])} chars)")
        except Exception as e:
            print(f"FAILED: {e}")
            chapters.append({"title":ch["title"],"html":f"<p>FAILED: {e}</p>","text":"","error":str(e),"url":ch["url"]})
        time.sleep(args.delay)

    slug = re.sub(r"[^a-z0-9\u0980-\u09FF]+","-", book["title"].lower()).strip("-")[:60] or "book"
    if args.format=="epub":
        out = args.out or slug+".epub"
        build_epub(book, chapters, out)
    elif args.format=="html":
        html_out = f"<html><head><meta charset='utf-8'><title>{book['title']}</title></head><body><h1>{book['title']}</h1><p>{book['info']}</p>"
        for c in chapters:
            html_out+=f"<h2>{c['title']}</h2><div>{c['html']}</div>"
        html_out+="</body></html>"
        out = args.out or slug+".html"
        pathlib.Path(out).write_text(html_out, encoding="utf-8")
        print(f"✓ HTML saved to {out}")
    elif args.format=="txt":
        txt = f"{book['title']}\n{book['author']}\n{book['info']}\n\n"
        for c in chapters:
            txt+=f"\n\n{c['title']}\n{'-'*60}\n"
            txt+= BeautifulSoup(c['html'],"html.parser").get_text("\n")
        out = args.out or slug+".txt"
        pathlib.Path(out).write_text(txt, encoding="utf-8")
        print(f"✓ TXT saved to {out}")
    elif args.format=="json":
        out = args.out or slug+".json"
        pathlib.Path(out).write_text(json.dumps({"book":book,"chapters":chapters}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✓ JSON saved to {out}")
    failed = sum(1 for c in chapters if c.get("error"))
    if failed:
        print(f"⚠ {failed} chapter(s) failed — see errors above.")

if __name__=="__main__":
    main()
