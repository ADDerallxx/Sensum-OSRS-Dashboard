from pathlib import Path
p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")
h=h.replace("V1.16.4","V1.17",1)

# Wider, structured reward dashboard.
css="""
.rewardBox{grid-column:1/-1!important;padding:12px!important}
.rewardDashboard{display:grid;gap:10px}
.rewardStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.rewardStat{background:#fffaf0;border:1px solid #dfc89d;border-radius:10px;padding:10px 12px}
.rewardStat .rsK{font-size:9px;font-weight:900;text-transform:uppercase;color:#8a642d}
.rewardStat .rsV{font-size:18px;font-weight:950;color:#3d2514;margin-top:3px}
.rewardDetailGrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(220px,.8fr);gap:9px}
.rewardPanel{background:#fffaf3;border:1px solid #dfcfb3;border-radius:10px;padding:10px}
.rewardPanelTitle{font-size:10px;font-weight:950;text-transform:uppercase;color:#725333;margin-bottom:8px}
.xpGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:6px}
.xpCard{background:#f7f8fb;border:1px solid #d9dde7;border-radius:8px;padding:7px 8px}
.xpAmt{font-weight:950;font-size:13px;color:#33281f}.xpSkill{font-size:9px;color:#6e6257;margin-top:2px}
.rewardBullets{margin:0;padding-left:17px;display:grid;gap:6px}
.rewardBullets li{font-size:10px;line-height:1.35;color:#4f4337}
.rewardBullets b{color:#33281f}
.rewardEmpty{font-size:10px;color:#8b7a67;font-style:italic}
@media(max-width:950px){.rewardDetailGrid{grid-template-columns:1fr}.rewardStats{grid-template-columns:1fr 1fr 1fr}}
"""
if ".rewardDashboard{" not in h:
    h=h.replace("</style>",css+"</style>",1)

start=h.find("function rewardLinesHtml(r)")
end=h.find("function render(s){",start)
if start<0 or end<0: raise SystemExit("Could not find V1.16 reward renderer.")

fn="""function splitRewardEntries(text){
  return String(text||'').split(/[;\\n|]+/).map(x=>x.trim()).filter(Boolean);
}
function xpRewardCards(text){
  const parts=splitRewardEntries(text),cards=[];
  parts.forEach(part=>{
    if(!/(?:\\bXP\\b|experience)/i.test(part))return;
    const m=part.match(/([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)\\s*([kKmM]?)\\s+(.+?)\\s+(?:XP|experience)/i);
    if(!m)return;
    let n=Number(m[1].replace(/,/g,'')); const suf=(m[2]||'').toLowerCase();
    if(suf==='k')n*=1000; else if(suf==='m')n*=1000000;
    const skill=m[3].trim();
    cards.push('<div class="xpCard"><div class="xpAmt">'+esc(Math.round(n).toLocaleString())+'</div><div class="xpSkill">'+esc(skill)+'</div></div>');
  });
  return cards.join('')||'<div class="rewardEmpty">No XP reward listed.</div>';
}
function rewardBulletHtml(text){
  const parts=splitRewardEntries(text);
  if(!parts.length)return '<div class="rewardEmpty">None listed.</div>';
  return '<ul class="rewardBullets">'+parts.map(x=>{
    const dash=x.match(/^([^—–-]{2,60})\\s*[—–-]\\s*(.+)$/);
    return '<li>'+(dash?'<b>'+esc(dash[1].trim())+'</b> — '+esc(dash[2].trim()):esc(x))+'</li>';
  }).join('')+'</ul>';
}
function countRewardEntries(text){return splitRewardEntries(text).length}
function rewardLinesHtml(r){
  if(!r)return '<div class="rewardEmpty">No reward data cached.</div>';
  const qp=Number(r.qp||0);
  const xp=cleanRewardText(r.xp),items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);
  const total=parseXpTotal(xp);
  const unlockCount=countRewardEntries(unlocks);
  const major=unlockCount+countRewardEntries(items);
  return '<div class="rewardDashboard">'+
    '<div class="rewardStats">'+
      '<div class="rewardStat"><div class="rsK">Quest Points</div><div class="rsV">+'+esc(qp||0)+' QP</div></div>'+
      '<div class="rewardStat"><div class="rsK">Total XP</div><div class="rsV">'+esc(total?compactNumber(total):'—')+(total?' XP':'')+'</div></div>'+
      '<div class="rewardStat"><div class="rsK">Major Rewards</div><div class="rsV">'+esc(major)+'</div></div>'+
    '</div>'+
    '<div class="rewardDetailGrid">'+
      '<div class="rewardPanel"><div class="rewardPanelTitle">XP Rewards</div><div class="xpGrid">'+xpRewardCards(xp)+'</div></div>'+
      '<div class="rewardPanel"><div class="rewardPanelTitle">Unlocks & Benefits</div>'+rewardBulletHtml(unlocks)+'</div>'+
      '<div class="rewardPanel"><div class="rewardPanelTitle">Items & Coins</div>'+rewardBulletHtml(items)+'</div>'+
    '</div>'+
  '</div>';
}

"""
h=h[:start]+fn+h[end:]

p.write_text(h,encoding="utf-8",newline="\n")
c=p.read_text(encoding="utf-8")
for x in [".rewardDashboard{","function xpRewardCards","function rewardBulletHtml","Unlocks & Benefits","Items & Coins","id=\"nextRewards\""]:
    if x not in c: raise SystemExit("V1.17 verification failed: "+x)
print("V1.17 reward dashboard installed and verified.")
