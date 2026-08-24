from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

# Version bump.
for v in ("V1.15.2B","V1.15.2b","V1.15.2A","V1.15.2a","V1.15.2","V1.15.1"):
    if v in h:
        h = h.replace(v, "V1.15.3", 1)
        break

# Bigger Report Quest text/icon, per user request.
h = h.replace(
    ".v115Report{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:7px;background:#f0b83d;color:#321b0c;border:1px solid #d99b29;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}",
    ".v115Report{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:7px;background:#f0b83d;color:#321b0c;border:1px solid #d99b29;border-radius:8px;padding:8px 10px;font-size:13px;font-weight:900;cursor:pointer}",
    1
)
h = h.replace(
    ".v115Report img{width:22px;height:23px;image-rendering:auto;flex:0 0 auto}",
    ".v115Report img{width:24px;height:24px;object-fit:contain;flex:0 0 auto}",
    1
)

# The previous installer left an orphaned fragment after DOMContentLoaded.
# That fragment is invalid JavaScript and prevents ALL V1.15 click handlers from loading.
bad = """document.addEventListener('DOMContentLoaded',()=>{loadV115();});
    if(metric){
      const b=document.createElement('button');
      b.id='v115Report';
      b.className='v115Report';
      b.title='Report Completed Quest';
      b.setAttribute('aria-label','Report Completed Quest');
      b.innerHTML='<img src="https://oldschool.runescape.wiki/images/Quest_point_icon.png" alt=""> <span>Report Quest</span>';
      b.onclick=()=>openV115QuestModal('Dashboard Manual');
      metric.appendChild(b);
    }
  }
  loadV115();
});"""
good = """document.addEventListener('DOMContentLoaded',()=>{loadV115();});"""
if bad in h:
    h = h.replace(bad, good, 1)
else:
    # Fallback: surgically remove known orphan fragment if whitespace differs.
    anchor = "document.addEventListener('DOMContentLoaded',()=>{loadV115();});"
    a = h.find(anchor)
    if a >= 0:
        tail_start = a + len(anchor)
        orphan_start = h.find("if(metric){", tail_start, tail_start + 800)
        script_end = h.find("</script>", tail_start)
        if orphan_start >= 0 and script_end >= 0 and orphan_start < script_end:
            h = h[:orphan_start] + h[script_end:]

# Replace modal opener with explicit loading/error states.
old_open = """function openV115QuestModal(src){v115Source=src||'Dashboard Manual';v115Selected.clear();document.getElementById('v115Modal').classList.add('show');google.script.run.withSuccessHandler(s=>{v115State=s;renderV115Quests()}).getV115QuestCompletionState()}"""
new_open = """function openV115QuestModal(src){
  v115Source=src||'Dashboard Manual';
  v115Selected.clear();
  document.getElementById('v115Modal').classList.add('show');
  document.getElementById('v115Likely').innerHTML='<small>Loading quests...</small>';
  document.getElementById('v115All').innerHTML='<small>Loading quests...</small>';
  google.script.run
    .withFailureHandler(e=>{
      const msg=(e&&e.message)?e.message:String(e||'Unknown Apps Script error');
      document.getElementById('v115Likely').innerHTML='<div style="padding:10px;border:1px solid #9c2d24;background:#f6d8d4;color:#681810;border-radius:8px;font-weight:800">Quest list failed to load: '+esc(msg)+'</div>';
      document.getElementById('v115All').innerHTML='';
    })
    .withSuccessHandler(s=>{v115State=s;renderV115Quests()})
    .getV115QuestCompletionState();
}"""
if old_open in h:
    h = h.replace(old_open, new_open, 1)

# Background state load should not kill anything if backend errors.
old_load = """function loadV115(){
 google.script.run.withSuccessHandler(s=>{v115State=s;if(s.detectedGain>0){document.getElementById('v115BannerText').textContent=`Detected +${s.detectedGain} QP (${s.previousQp} to ${s.currentQp}).`;setTimeout(()=>document.getElementById('v115Banner').classList.add('show'),250)}}).getV115QuestCompletionState();
}"""
new_load = """function loadV115(){
 google.script.run
  .withFailureHandler(e=>console.error('Quest completion state failed:',e))
  .withSuccessHandler(s=>{v115State=s;if(s.detectedGain>0){document.getElementById('v115BannerText').textContent=`Detected +${s.detectedGain} QP (${s.previousQp} to ${s.currentQp}).`;setTimeout(()=>document.getElementById('v115Banner').classList.add('show'),250)}})
  .getV115QuestCompletionState();
}"""
if old_load in h:
    h = h.replace(old_load, new_load, 1)

# Sanity checks before writing.
if 'id="v115Report"' not in h:
    raise SystemExit("Report Quest button markup is missing.")
if "function openV115QuestModal" not in h:
    raise SystemExit("Report Quest modal handler is missing.")
# Catch the exact orphan corruption pattern.
if "document.addEventListener('DOMContentLoaded',()=>{loadV115();});\n    if(metric){" in h:
    raise SystemExit("Orphaned metric injection code still remains; refusing to write.")

p.write_text(h, encoding="utf-8", newline="\n")
print("V1.15.3 repaired the broken Report Quest JavaScript and increased button font size.")
