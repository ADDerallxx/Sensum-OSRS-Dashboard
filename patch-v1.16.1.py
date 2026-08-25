from pathlib import Path
p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")

# Version.
h=h.replace("V1.16","V1.16.1",1)

# Add compact reward styling without touching full Next Session detail.
if ".questRewardSummary{" not in h:
    css="""
.questRewardSummary{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.rewardPill{display:inline-flex;align-items:center;padding:3px 6px;border-radius:999px;background:#eee1c8;border:1px solid #d4bd94;color:#5d472e;font-size:9px;font-weight:900}
"""
    h=h.replace("</style>",css+"</style>",1)

# Replace shortRewardText with a compact summary generator.
start=h.find("function shortRewardText(r)")
end=h.find("function rewardLinesHtml(r)",start)
if start<0 or end<0: raise SystemExit("V1.16 reward helper functions not found.")
new="""function rewardSummaryHtml(r){
  if(!r)return '';
  const pills=[];
  const qp=Number(r.qp||0);
  if(qp>0)pills.push('<span class="rewardPill">+'+esc(qp)+' QP</span>');
  const xp=cleanRewardText(r.xp);
  if(xp){
    const nums=(xp.match(/[\\d,]+(?=\\s*(?:xp|experience))/gi)||[]).map(x=>Number(x.replace(/,/g,''))).filter(Number.isFinite);
    if(nums.length){
      const total=nums.reduce((a,b)=>a+b,0);
      const label=total>=1000?(Math.round(total/100)/10)+'k XP':total+' XP';
      pills.push('<span class="rewardPill">'+esc(label)+'</span>');
    }else{
      pills.push('<span class="rewardPill">XP reward</span>');
    }
  }
  const items=cleanRewardText(r.items), unlocks=cleanRewardText(r.unlocks);
  let major=0;
  if(items)major++;
  if(unlocks){
    major+=(unlocks.split(/[;,•]/).map(x=>x.trim()).filter(Boolean).length||1);
  }
  if(major>0)pills.push('<span class="rewardPill">'+esc(major)+' major reward'+(major===1?'':'s')+'</span>');
  return pills.length?'<div class="questRewardSummary">'+pills.join('')+'</div>':'';
}
"""
h=h[:start]+new+h[end:]

# Replace Top 5 full reward wall only; preserve detailed Next Session rewardLinesHtml.
old="${shortRewardText(q.rewards)?`<div class=\"questReward\"><b>Rewards:</b> ${esc(shortRewardText(q.rewards))}</div>`:''}"
if old not in h: raise SystemExit("Top 5 V1.16 reward renderer not found.")
h=h.replace(old,"${rewardSummaryHtml(q.rewards)}",1)

p.write_text(h,encoding="utf-8",newline="\n")
check=p.read_text(encoding="utf-8")
if "rewardSummaryHtml(q.rewards)" not in check or "function rewardLinesHtml(r)" not in check or 'id="nextRewards"' not in check:
    raise SystemExit("V1.16.1 verification failed.")
print("V1.16.1 compact Top 5 rewards installed and verified.")
