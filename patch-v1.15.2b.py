from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

# Bump version if present.
if "V1.15.2a" in h:
    h = h.replace("V1.15.2a", "V1.15.2b", 1)
elif "V1.15.1" in h:
    h = h.replace("V1.15.1", "V1.15.2b", 1)

old = """<div class="metric"><div class="k">Quest Points</div><div class="v" id="qp">—</div></div>"""

new = """<div class="metric"><div class="k">Quest Points</div><div class="v" id="qp">—</div><button id="v115Report" class="v115Report" title="Report Completed Quest" aria-label="Report Completed Quest" onclick="openV115QuestModal('Dashboard Manual')"><img src="https://oldschool.runescape.wiki/images/Quest_point_icon.png" alt=""><span>Report Quest</span></button></div>"""

if 'id="v115Report"' not in h:
    if old not in h:
        raise SystemExit("Could not find the actual Quest Points card; no changes made.")
    h = h.replace(old, new, 1)

# Remove any old dynamic injection block if still present.
start_marker = "document.addEventListener('DOMContentLoaded',()=>{"
start = h.find(start_marker)
if start >= 0:
    probe = h[start:start+1200]
    if "document.getElementById('v115Report')" in probe and "metric.appendChild(b)" in probe:
        end = h.find("});", start)
        if end >= 0:
            h = h[:start] + "document.addEventListener('DOMContentLoaded',()=>{loadV115();});" + h[end+3:]

p.write_text(h, encoding="utf-8", newline="\n")
print("V1.15.2b installed successfully.")
