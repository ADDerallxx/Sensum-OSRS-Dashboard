from pathlib import Path

p = Path("DashboardV1.js")
s = p.read_text(encoding="utf-8-sig")
needle = "function getV1DashboardState() {\n"
if needle not in s:
    raise SystemExit("Could not find getV1DashboardState() in DashboardV1.js")
replacement = "function getV1DashboardState() {\n  if (typeof qhMaybeSyncRoute_ === 'function') qhMaybeSyncRoute_();\n"
if replacement not in s:
    s = s.replace(needle, replacement, 1)
p.write_text(s, encoding="utf-8", newline="\n")
print("DashboardV1.js wired to the Quest Helper prototype cache.")
