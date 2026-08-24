from pathlib import Path

p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")

# Bump version label.
h=h.replace("V1.15.1", "V1.15.2", 1)

# Ensure metric card button styles are present.
style_old = ".v115Report{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:7px;background:#f0b83d;color:#321b0c;border:1px solid #d99b29;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}\n.v115Report img{width:22px;height:23px;image-rendering:auto;flex:0 0 auto}"
style_new = """.v115Report{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:7px;background:#f0b83d;color:#321b0c;border:1px solid #d99b29;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}
.v115Report:hover{filter:brightness(1.05)}
.v115Report img{width:22px;height:23px;object-fit:contain;flex:0 0 auto}
.v115LoadError{padding:10px;border:1px solid #9c2d24;background:#f6d8d4;color:#681810;border-radius:8px;font-size:11px;font-weight:800}
"""
if style_old in h:
    h=h.replace(style_old,style_new,1)

# Replace JS-driven button injection with deterministic HTML insertion in Quest Points card.
marker = """<div class="metric"><div class="k">Quest Points</div><div class="v" id="questPoints"></div></div>"""
replacement = """<div class="metric"><div class="k">Quest Points</div><div class="v" id="questPoints"></div><button id="v115Report" class="v115Report" title="Report Completed Quest" aria-label="Report Completed Quest" onclick="openV115QuestModal('Dashboard Manual')"><img src="https://oldschool.runescape.wiki/images/Quest_point_icon.png" alt=""><span>Report Quest</span></button></div>"""
if marker not in h:
    raise SystemExit("Could not find Quest Points metric markup.")
h=h.replace(marker,replacement,1)

# Remove old dynamic button injection block, keep loadV115().
old_dom = """document.addEventListener('DOMContentLoaded',()=>{
  if(!document.getElementById('v115Report')){
    const metric=[...document.querySelectorAll('.metric')].find(m=>{
      const k=m.querySelector('.k');
      return k && String(k.textContent||'').trim().toUpperCase()==='QUEST POINTS';
    });
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
new_dom = """document.addEventListener('DOMContentLoaded',()=>{loadV115();});"""
if old_dom in h:
    h=h.replace(old_dom,new_dom,1)

# Add robust error handling + visible loading state in modal.
old_open = """function openV115QuestModal(src){v115Source=src||'Dashboard Manual';v115Selected.clear();document.getElementById('v115Modal').classList.add('show');google.script.run.withSuccessHandler(s=>{v115State=s;renderV115Quests()}).getV115QuestCompletionState()}"""
new_open = """function openV115QuestModal(src){
  v115Source=src||'Dashboard Manual';
  v115Selected.clear();
  document.getElementById('v115Modal').classList.add('show');
  document.getElementById('v115Likely').innerHTML='<small>Loading quests...</small>';
  document.getElementById('v115All').innerHTML='<small>Loading quests...</small>';
  google.script.run
    .withFailureHandler(e=>{
      const msg=(e&&e.message)?e.message:String(e||'Unknown error');
      document.getElementById('v115Likely').innerHTML='<div class="v115LoadError">Quest list failed to load: '+msg+'</div>';
      document.getElementById('v115All').innerHTML='';
      document.getElementById('v115Qp').textContent='';
    })
    .withSuccessHandler(s=>{
      v115State=s;
      renderV115Quests();
    })
    .getV115QuestCompletionState();
}"""
if old_open not in h:
    raise SystemExit("Could not find openV115QuestModal function.")
h=h.replace(old_open,new_open,1)

# Make initial background load failure visible in console only, but safe.
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
    h=h.replace(old_load,new_load,1)

p.write_text(h,encoding="utf-8",newline="\n")
print("V1.15.2 deterministic Report Quest button + selector error handling applied.")
