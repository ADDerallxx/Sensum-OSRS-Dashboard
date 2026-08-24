from pathlib import Path
p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")

# Works whether failed 1.15.2 was attempted or not.
h=h.replace("V1.15.1", "V1.15.2a", 1)
h=h.replace("V1.15.2", "V1.15.2a", 1) if "V1.15.2a" not in h else h

# Actual current source uses id="qp", not id="questPoints".
old='<div class="metric"><div class="k">Quest Points</div><div class="v" id="qp">—</div></div>'
new='<div class="metric"><div class="k">Quest Points</div><div class="v" id="qp">—</div><button id="v115Report" class="v115Report" title="Report Completed Quest" aria-label="Report Completed Quest" onclick="openV115QuestModal(\\'Dashboard Manual\\')"><img src="https://oldschool.runescape.wiki/images/Quest_point_icon.png" alt=""><span>Report Quest</span></button></div>'
if old not in h:
    if 'id="v115Report"' not in h:
        raise SystemExit('Actual Quest Points card was not found; no changes made.')
else:
    h=h.replace(old,new,1)

# Remove failed dynamic injection if it still exists.
start="document.addEventListener('DOMContentLoaded',()=>{\n  if(!document.getElementById('v115Report')){"
if start in h:
    a=h.index(start)
    b=h.index("});",a)+3
    h=h[:a]+"document.addEventListener('DOMContentLoaded',()=>{loadV115();});"+h[b:]

p.write_text(h,encoding="utf-8",newline="\n")
print("V1.15.2a installed against actual V1.html markup (Quest Points id=qp).")
