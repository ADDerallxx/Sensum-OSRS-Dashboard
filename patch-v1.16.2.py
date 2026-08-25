from pathlib import Path
p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")

h=h.replace("V1.16.1","V1.16.2",1)

start=h.find("function rewardSummaryHtml(r)")
end=h.find("function rewardLinesHtml(r)",start)
if start<0 or end<0:
    raise SystemExit("V1.16.1 reward summary helper not found.")

new="""function parseXpTotal(text){
  const s=String(text||'');
  let total=0,matched=false;
  const rx=/([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)\\s*([kKmM]?)\\s*(?:XP|experience)/g;
  let m;
  while((m=rx.exec(s))!==null){
    let n=Number(String(m[1]).replace(/,/g,''));
    const suf=String(m[2]||'').toLowerCase();
    if(suf==='k')n*=1000;
    else if(suf==='m')n*=1000000;
    if(Number.isFinite(n)){total+=n;matched=true;}
  }
  return matched?total:0;
}
function compactNumber(n){
  n=Number(n||0);
  if(n>=1000000)return (Math.round(n/100000)/10).toFixed(n%1000000===0?0:1)+'m';
  if(n>=1000)return (Math.round(n/100)/10).toFixed(n%1000===0?0:1)+'k';
  return String(Math.round(n));
}
function rewardSummaryHtml(r){
  if(!r)return '';
  const pills=[];
  const qp=Number(r.qp||0);
  if(qp>0)pills.push('<span class="rewardPill">+'+esc(qp)+' QP</span>');
  const xp=cleanRewardText(r.xp);
  if(xp){
    const total=parseXpTotal(xp);
    pills.push('<span class="rewardPill">'+esc(total>0?compactNumber(total)+' XP':'XP reward')+'</span>');
  }
  const items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);
  let major=0;
  if(items)major+=items.split(/[;,•]/).map(x=>x.trim()).filter(Boolean).length||1;
  if(unlocks)major+=unlocks.split(/[;,•]/).map(x=>x.trim()).filter(Boolean).length||1;
  if(major>0)pills.push('<span class="rewardPill">'+esc(major)+' major reward'+(major===1?'':'s')+'</span>');
  return pills.length?'<div class="questRewardSummary">'+pills.join('')+'</div>':'';
}
"""
h=h[:start]+new+h[end:]

p.write_text(h,encoding="utf-8",newline="\n")

check=p.read_text(encoding="utf-8")
for needle in ["function parseXpTotal","function compactNumber","function rewardSummaryHtml","function rewardLinesHtml"]:
    if needle not in check:
        raise SystemExit("Verification failed: "+needle)

print("V1.16.2 XP totals installed and verified.")
