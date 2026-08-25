from pathlib import Path
def rd(p): return Path(p).read_text(encoding="utf-8-sig")
def wr(p,s): Path(p).write_text(s,encoding="utf-8",newline="\n")

p="DashboardV1.js"; s=rd(p)
if "function readV1QuestRewards_" not in s:
    a="  const reconciledSheet = ss.getSheetByName('Quest Prep Reconciled');"
    if a not in s: raise SystemExit("Verified reconciledSheet line not found.")
    s=s.replace(a,a+"\n  const questDependencySheet = ss.getSheetByName('Quest Dependency');\n  const rewardMap = readV1QuestRewards_(questDependencySheet);",1)
    a="topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5]}))"
    if a not in s: raise SystemExit("Verified topQuests line not found.")
    s=s.replace(a,"topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null}))",1)
    fn="""function readV1QuestRewards_(sh) {
  const out={}; if(!sh||sh.getLastRow()<1)return out;
  const v=sh.getDataRange().getDisplayValues(); let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){const r=v[i].map(x=>String(x||'').trim());if(r.some(x=>/^quest name$/i.test(x))&&r.some(x=>/quest points reward/i.test(x))){hr=i;h=r;break}}
  if(hr<0)return out; const c=n=>h.findIndex(x=>String(x||'').trim().toLowerCase()===n);
  const q=c('quest name'),qp=c('quest points reward'),xp=c('xp rewards'),it=c('item / coin rewards'),un=c('unlocks / other rewards');
  v.slice(hr+1).forEach(r=>{const n=q>=0?String(r[q]||'').trim():'';if(n)out[n.toLowerCase()]={qp:qp>=0?String(r[qp]||'').trim():'',xp:xp>=0?String(r[xp]||'').trim():'',items:it>=0?String(r[it]||'').trim():'',unlocks:un>=0?String(r[un]||'').trim():''}});
  return out;
}

"""
    a="function readV1WikiHealth_(dash) {"
    if a not in s: raise SystemExit("readV1WikiHealth_ not found.")
    s=s.replace(a,fn+a,1)
wr(p,s)

p="V1.html"; h=rd(p)
if ".questReward{" not in h:
    css=".questReward{margin-top:5px;font-size:10px;line-height:1.4;color:#705d48}.questReward b{color:#4d3218}.rewardBox{background:#fff7df!important;border-color:#d8b267!important}.rewardLines{display:grid;gap:5px}.rewardLine{font-size:11px;line-height:1.4}.rewardLabel{font-size:9px;font-weight:900;text-transform:uppercase;color:#8a642d;margin-right:5px}\n"
    h=h.replace("</style>",css+"</style>",1)
if 'id="nextRewards"' not in h:
    a='<div class="actionStep"><div class="n">Route impact</div><div id="nextImpact" class="v">—</div></div>'
    if a not in h: raise SystemExit("Route impact box not found.")
    h=h.replace(a,a+'\n<div class="actionStep rewardBox"><div class="n">Quest rewards</div><div id="nextRewards" class="v rewardLines">—</div></div>',1)
if "function shortRewardText" not in h:
    f="""function cleanRewardText(v){const s=String(v||'').trim();return(!s||/^none listed$/i.test(s))?'':s}
function shortRewardText(r){if(!r)return '';const b=[];if(Number(r.qp||0)>0)b.push('+'+Number(r.qp)+' QP');for(const x of [r.xp,r.items,r.unlocks]){const y=cleanRewardText(x);if(y)b.push(y)}return b.join(' · ')}
function rewardLinesHtml(r){if(!r)return 'No reward data cached.';const a=[];if(Number(r.qp||0)>0)a.push('<div class="rewardLine"><span class="rewardLabel">Quest Points</span>+'+esc(Number(r.qp))+' QP</div>');for(const z of [['XP',r.xp],['Items',r.items],['Unlocks',r.unlocks]]){const y=cleanRewardText(z[1]);if(y)a.push('<div class="rewardLine"><span class="rewardLabel">'+z[0]+'</span>'+esc(y)+'</div>')}return a.join('')||'No listed rewards in cached quest data.'}
"""
    h=h.replace("function render(s){",f+"function render(s){",1)
if "shortRewardText(q.rewards)?" not in h:
    a='<td class="why">${esc(q.why)}</td>'
    if a not in h: raise SystemExit("Top 5 Why cell not found.")
    h=h.replace(a,'<td class="why">${esc(q.why)}${shortRewardText(q.rewards)?`<div class="questReward"><b>Rewards:</b> ${esc(shortRewardText(q.rewards))}</div>`:\'\'}</td>',1)
if "$('nextRewards').innerHTML" not in h:
    a="$('nextCurrentQp').textContent="
    pos=h.find(a)
    if pos<0: raise SystemExit("nextCurrentQp render not found.")
    ls=h.rfind("\n",0,pos)+1
    h=h[:ls]+"  $('nextRewards').innerHTML=rewardLinesHtml(top&&top.rewards?top.rewards:null);\n"+h[ls:]
h=h.replace("V1.15.4","V1.16",1)
wr(p,h)
if not all(["function readV1QuestRewards_" in rd("DashboardV1.js"),"rewards:rewardMap" in rd("DashboardV1.js"),'id="nextRewards"' in rd("V1.html"),"shortRewardText(q.rewards)" in rd("V1.html"),"$('nextRewards').innerHTML" in rd("V1.html")]): raise SystemExit("Verification failed.")
print("V1.16B Quest Rewards installed and verified.")
