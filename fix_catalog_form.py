#!/usr/bin/env python3
"""Move the add-catalog-product form block out of the `change` listener into its
own async `submit` listener. Run from the repo root. Writes nothing unless the
expected code is found exactly once."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

path = Path("static/app.js")
text = path.read_text(encoding="utf-8")

START = '  const addCatalogForm = event.target.closest("#add-catalog-product-form");\n  if (addCatalogForm) {\n'
BLOCK_END = '    return;\n  }\n'
AFTER = BLOCK_END + '});\n\nwindow.addEventListener("hashchange", render);'

if 'document.addEventListener("submit", async' in text:
    sys.exit("Already applied: an async submit listener exists. Nothing changed.")
if text.count(START) != 1 or text.count(AFTER) != 1:
    sys.exit(f"ABORT: expected 1 match each, found start={text.count(START)} end={text.count(AFTER)}. Nothing changed.")
i = text.index(START)
k = text.index(AFTER)
if k < i:
    sys.exit("ABORT: block order is not as expected. Nothing changed.")

block = text[i:k + len(BLOCK_END)]
head = text[:i]
rest = text[k + len(BLOCK_END) + len("});\n"):]   # everything after the change listener's closing

new = (
    head + "});\n\n"
    + 'document.addEventListener("submit", async (event) => {\n'
    + block
    + "});\n"
    + rest
)
if shutil.which("node"):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as handle:
        handle.write(new)
    check = subprocess.run(["node", "--check", handle.name], capture_output=True, text=True)
    Path(handle.name).unlink()
    if check.returncode != 0:
        sys.exit("ABORT: the result still has a syntax error (nothing written):\n" + check.stderr[:600])
path.write_text(new, encoding="utf-8")
print("Moved the form handler into an async submit listener.")