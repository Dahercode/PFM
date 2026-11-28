"""Assemble index.html (racine du dépôt) à partir de src/ui.html, src/core.js et src/bookmarklet.js."""
import json, pathlib, re, urllib.parse
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
html = (src / "ui.html").read_text(encoding="utf-8")
core = (src / "core.js").read_text(encoding="utf-8")
# version minifiée (terser) si elle est à jour, sinon la source sans son en-tête
full, mini = src / "bookmarklet.js", src / "bookmarklet.min.js"
if mini.exists() and mini.stat().st_mtime >= full.stat().st_mtime:
    bm = mini.read_text(encoding="utf-8").strip()
else:
    bm = re.sub(r"^/\*.*?\*/\s*", "", full.read_text(encoding="utf-8"), flags=re.S)
href = "javascript:" + urllib.parse.quote(bm, safe="")
assert "/*__CORE__*/" in html and '"__BOOKMARKLET_HREF__"' in html
html = html.replace("/*__CORE__*/", core).replace('"__BOOKMARKLET_HREF__"', json.dumps(href))
(root / "index.html").write_text(html, encoding="utf-8")
print(f"index.html généré (favori : {len(href)} caractères)")
