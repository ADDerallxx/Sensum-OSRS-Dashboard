from pathlib import Path
import re

def read(path):
    return Path(path).read_text(encoding="utf-8-sig")
def write(path,text):
    Path(path).write_text(text,encoding="utf-8",newline="\\n")

p="DashboardV1.js"
js=read(p)

if "function readV1QuestRewards_" not in js:
    pat=r"(?m)^(\\s*)const\\s+reconciledSheet\\s*=\\s*ss\\.getSheetByName\\(['\\\"]Quest Prep Reconciled['\\\"]\\);\\s*$"
    m=re.search(pat,js)
    if not m: raise SystemExit("Could not locate Quest Prep Reconciled declaration.")
    indent=m.group(1)
    addition=m.group(0)+"\\n"+indent+"const questDependencySheet = ss.getSheetByName('Quest Dependency');\\n"+indent+"const rewardMap = readV1QuestRewards_(questDependencySheet);"
    js=js[:m.start()]+addition+js[m.end():]

    old="topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5]}))"
    if old not in js: raise SystemExit("Could not locate topQuests mapping.")
    new="topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null}))"
    js=js.replace(old,new,1)

    fn = '''function readV1QuestRewards_(sh) {
  const out = {};
  if (!sh || sh.getLastRow() < 1) return out;
  const vals = sh.getDataRange().getDisplayValues();
  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(vals.length, 15); i++) {
    const row = vals[i].map(x => String(x || '').trim());
    if (row.some(x => /^quest name$/i.test(x)) && row.some(x => /quest points reward/i.test(x))) {
      headerRow = i; headers = row; break;
    }
  }
  if (headerRow < 0) return out;
  const col = rx => headers.findIndex(x => rx.test(x));
  const q=col(/^quest name$/i), qp=col(/^quest points reward$/i), xp=col(/^xp rewards$/i);
  const item=col(/^item \/ coin rewards$/i), unlock=col(/^unlocks \/ other rewards$/i);
  vals.slice(headerRow+1).forEach(r => {
    const quest=q>=0 ? String(r[q]||'').trim() : '';
    if (!quest) return;
    out[quest.toLowerCase()]={qp:qp>=0?String(r[qp]||'').trim():'',xp:xp>=0?String(r[xp]||'').trim():'',items:item>=0?String(r[item]||'').trim():'',unlocks:unlock>=0?String(r[unlock]||'').trim():''};
  });
  return out;
}

'''
    pos=js.find("function readV1WikiHealth_")
    if pos<0: raise SystemExit("Could not locate readV1WikiHealth_.")
    js=js[:pos]+fn+js[pos:]
write(p,js)

p="V1.html"
h=read(p)
h=h.replace("V1.15.4","V1.16",1)

if ".questReward{" not in h:
    css='''    .questReward{margin-top:5px;font-size:10px;line-height:1.4;color:#705d48}
    .questReward b{color:#4d3218}
    .rewardBox{background:#fff7df!important;border-color:#d8b267!important}
    .rewardLines{display:grid;gap:5px}
    .rewardLine{font-size:11px;line-height:1.4}
    .rewardLabel{font-size:9px;font-weight:900;text-transform:uppercase;color:#8a642d;margin-right:5px}
'''
    pos=h.find("</style>")
    if pos<0: raise SystemExit("Could not locate style end.")
    h=h[:pos]+css+h[pos:]

if 'id="nextRewards"' not in h:
    marker='<div class="actionStep"><div class="n">Route impact</div><div id="nextImpact" class="v">—</div></div>'
    if marker not in h: raise SystemExit("Could not locate Route impact box.")
    h=h.replace(marker,marker+'\\n        <div class="actionStep rewardBox"><div class="n">Quest rewards</div><div id="nextRewards" class="v rewardLines">—</div></div>',1)

if "function shortRewardText" not in h:
    helpers='''function cleanRewardText(v){const s=String(v||'').trim();return(!s||/^none listed$/i.test(s))?'':s}
function shortRewardText(r){
  if(!r)return '';
  const bits=[];
  if(Number(r.qp||0)>0)bits.push('+'+Number(r.qp)+' QP');
  const xp=cleanRewardText(r.xp),items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);
  if(xp)bits.push(xp);if(items)bits.push(items);if(unlocks)bits.push(unlocks);
  return bits.join(' · ');
}
function rewardLinesHtml(r){
  if(!r)return '<span>No reward data cached.</span>';
  const rows=[];
  if(Number(r.qp||0)>0)rows.push('<div class="rewardLine"><span class="rewardLabel">Quest Points</span>+'+esc(Number(r.qp))+' QP</div>');
  const xp=cleanRewardText(r.xp),items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);
  if(xp)rows.push('<div class="rewardLine"><span class="rewardLabel">XP</span>'+esc(xp)+'</div>');
  if(items)rows.push('<div class="rewardLine"><span class="rewardLabel">Items</span>'+esc(items)+'</div>');
  if(unlocks)rows.push('<div class="rewardLine"><span class="rewardLabel">Unlocks</span>'+esc(unlocks)+'</div>');
  return rows.join('')||'<span>No listed rewards in cached quest data.</span>';
}

'''
    pos=h.find("function render(s)")
    if pos<0: raise SystemExit("Could not locate render(s).")
    h=h[:pos]+helpers+h[pos:]

if "shortRewardText(q.rewards)?" not in h:
    old='<td class="why">${esc(q.why)}</td>'
    if old not in h: raise SystemExit("Could not locate Top 5 Why cell.")
    new='<td class="why">${esc(q.why)}${shortRewardText(q.rewards)?`<div class="questReward"><b>Rewards:</b> ${esc(shortRewardText(q.rewards))}</div>`:\'\'}</td>'
    h=h.replace(old,new,1)

if "$('nextRewards').innerHTML" not in h:
    m=re.search(r"(?m)^(\\s*\\$\\('nextImpact'\\)\\.textContent\\s*=.*;\\s*)$",h)
    if not m: raise SystemExit("Could not locate nextImpact render assignment.")
    line=m.group(1)
    indent=re.match(r"\\s*",line).group(0)
    h=h[:m.start()]+line+"\\n"+indent+"$('nextRewards').innerHTML=rewardLinesHtml(top&&top.rewards?top.rewards:null);"+h[m.end():]

write(p,h)

js2=read("DashboardV1.js"); h2=read("V1.html")
checks=[("backend reader","function readV1QuestRewards_" in js2),("reward map","rewards:rewardMap" in js2),("Top 5 rewards","shortRewardText(q.rewards)" in h2),("reward box",'id="nextRewards"' in h2),("reward render","$('nextRewards').innerHTML" in h2)]
bad=[n for n,ok in checks if not ok]
if bad: raise SystemExit("Verification failed: "+", ".join(bad))
print("V1.16 Quest Rewards installed and verified.")
