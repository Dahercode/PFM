"""Assemble index.html (racine du dépôt) à partir de src/ui.html et src/core.js."""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "src" / "ui.html").read_text(encoding="utf-8")
core = (root / "src" / "core.js").read_text(encoding="utf-8")
assert "/*__CORE__*/" in html
(root / "index.html").write_text(html.replace("/*__CORE__*/", core), encoding="utf-8")
print("index.html généré")
