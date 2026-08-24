from pathlib import Path

p=Path("DashboardV1.js")
s=p.read_text(encoding="utf-8-sig")
start=s.find("// V1.15 quest completion reporting")
if start < 0:
    raise SystemExit("V1.15 backend block not found.")
s=s[:start]+"// V1.15.1 quest completion reporting\nfunction v115QuestTable_(ss) {\n  const sh=ss.getSheetByName('Quest Dependency');\n  if(!sh) throw new Error('Quest Dependency sheet not found.');\n\n  const vals=sh.getDataRange().getDisplayValues();\n  let headerRow=-1, headers=null;\n\n  for(let i=0;i<Math.min(vals.length,12);i++){\n    const row=vals[i].map(x=>String(x||'').trim());\n    const hasCompleted=row.some(x=>/^completed$/i.test(x));\n    const hasQuest=row.some(x=>/^quest name$/i.test(x));\n    if(hasCompleted && hasQuest){\n      headerRow=i;\n      headers=row;\n      break;\n    }\n  }\n\n  if(headerRow<0) throw new Error('Could not locate Quest Dependency header row.');\n\n  const qCol=headers.findIndex(x=>/^quest name$/i.test(x));\n  const cCol=headers.findIndex(x=>/^completed$/i.test(x));\n  const qpCol=headers.findIndex(x=>/quest points reward|quest points|qp reward/i.test(x));\n\n  if(qCol<0||cCol<0) throw new Error('Quest Dependency needs Quest Name and Completed columns.');\n\n  return {sh, vals, headerRow, headers, qCol, cCol, qpCol};\n}\n\nfunction v115CurrentTrackerQp_(ss) {\n  const sh=ss.getSheetByName('Your Stats');\n  if(!sh) return 0;\n  const found=sh.createTextFinder('Quest Points').matchEntireCell(true).findNext();\n  return found ? Number(found.offset(0,1).getValue()||0) : 0;\n}\n\nfunction getV115QuestCompletionState_() {\n  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);\n  const t=v115QuestTable_(ss);\n\n  const incomplete=[];\n  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{\n    const quest=String(r[t.qCol]||'').trim();\n    if(!quest)return;\n    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());\n    if(!done){\n      incomplete.push({\n        quest,\n        qp:t.qpCol>=0 ? Number(r[t.qpCol]||0) : 0,\n        row:t.headerRow+2+idx\n      });\n    }\n  });\n  incomplete.sort((a,b)=>a.quest.localeCompare(b.quest));\n\n  const props=PropertiesService.getScriptProperties();\n  const current=v115CurrentTrackerQp_(ss);\n  let previous=Number(props.getProperty('V115_LAST_RECONCILED_QP')||current);\n  if(!props.getProperty('V115_LAST_RECONCILED_QP')){\n    props.setProperty('V115_LAST_RECONCILED_QP',String(current));\n    previous=current;\n  }\n  const gain=Math.max(0,current-previous);\n\n  const dash=ss.getSheetByName('Dashboard');\n  const route=dash.getRange('A60:B69').getDisplayValues().map(r=>r[1]).filter(Boolean);\n  const next=dash.getRange('A73:B80').getDisplayValues();\n  const nextObj={}; next.forEach(r=>{if(r[0])nextObj[r[0]]=r[1]});\n  const nextQuest=nextObj['Quest']||nextObj['Next Quest']||'';\n\n  const likely=incomplete.map(q=>{\n    let score=0,reasons=[];\n    if(String(q.quest).toLowerCase()===String(nextQuest).toLowerCase()){\n      score+=100; reasons.push('Next Session');\n    }\n    const ri=route.findIndex(x=>String(x).toLowerCase()===q.quest.toLowerCase());\n    if(ri>=0){\n      score+=50-ri; reasons.push('Current route');\n    }\n    if(gain>0&&q.qp===gain){\n      score+=80; reasons.push('Exact QP match');\n    }else if(gain>0&&q.qp>0&&q.qp<=gain){\n      score+=20; reasons.push('Fits QP gain');\n    }\n    return {...q,score,reasons};\n  }).filter(q=>q.score>0).sort((a,b)=>b.score-a.score||a.quest.localeCompare(b.quest));\n\n  return {\n    currentQp:current,\n    previousQp:previous,\n    detectedGain:gain,\n    incomplete,\n    likely,\n    qpDetectionSource:'tracker'\n  };\n}\n\nfunction getV115QuestCompletionState(){return getV115QuestCompletionState_();}\n\nfunction completeV115Quests(quests,source){\n  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one quest.');\n\n  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);\n  const t=v115QuestTable_(ss);\n  const wanted=new Set(quests.map(x=>String(x).toLowerCase()));\n  const changed=[];\n\n  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{\n    const quest=String(r[t.qCol]||'').trim();\n    if(wanted.has(quest.toLowerCase())&&!/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||''))){\n      t.sh.getRange(t.headerRow+2+idx,t.cCol+1).setValue('Yes');\n      changed.push(quest);\n    }\n  });\n\n  if(!changed.length)throw new Error('No incomplete quests matched the selection.');\n\n  let log=ss.getSheetByName('Quest Completion Log');\n  if(!log){\n    log=ss.insertSheet('Quest Completion Log');\n    log.appendRow(['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']);\n  }\n\n  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Manual';\n  changed.forEach(q=>log.appendRow([now,q,'No','Yes',src,tx]));\n\n  SpreadsheetApp.flush();\n  Utilities.sleep(200);\n\n  PropertiesService.getScriptProperties().setProperty(\n    'V115_LAST_RECONCILED_QP',\n    String(v115CurrentTrackerQp_(ss))\n  );\n\n  return {ok:true,changed,transactionId:tx,state:getV115QuestCompletionState_()};\n}\n\nfunction undoV115QuestCompletion(transactionId){\n  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),log=ss.getSheetByName('Quest Completion Log');\n  if(!log)throw new Error('No quest completion log exists.');\n\n  const lv=log.getDataRange().getDisplayValues();\n  const quests=lv.slice(1).filter(r=>r[5]===transactionId).map(r=>r[1]);\n  if(!quests.length)throw new Error('Transaction not found.');\n\n  const t=v115QuestTable_(ss);\n  const set=new Set(quests.map(x=>x.toLowerCase()));\n  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{\n    if(set.has(String(r[t.qCol]||'').trim().toLowerCase())){\n      t.sh.getRange(t.headerRow+2+idx,t.cCol+1).setValue('No');\n    }\n  });\n\n  const tx=Utilities.getUuid(),now=new Date();\n  quests.forEach(q=>log.appendRow([now,q,'Yes','No','Dashboard Undo',tx]));\n  SpreadsheetApp.flush();\n  return {ok:true,changed:quests,state:getV115QuestCompletionState_()};\n}\n"+"\n"
p.write_text(s,encoding="utf-8",newline="\n")

p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")
h=h.replace("V1.15", "V1.15.1", 1)

h=h.replace(
".v115Report{background:#f0b83d;color:#321b0c;border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer}",
".v115Report{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:7px;background:#f0b83d;color:#321b0c;border:1px solid #d99b29;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}\n.v115Report img{width:22px;height:23px;image-rendering:auto;flex:0 0 auto}",
1)

old="""document.addEventListener('DOMContentLoaded',()=>{const controls=document.querySelector('.controls');if(controls&&!document.getElementById('v115Report')){const b=document.createElement('button');b.id='v115Report';b.className='v115Report';b.textContent='Report Completed Quest';b.onclick=()=>openV115QuestModal('Dashboard Manual');controls.appendChild(b)}loadV115()});"""
new="""document.addEventListener('DOMContentLoaded',()=>{
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
if old not in h:
    raise SystemExit("Could not find V1.15 DOMContentLoaded button block.")
h=h.replace(old,new,1)

p.write_text(h,encoding="utf-8",newline="\n")
print("V1.15.1 quest selector + report button fix installed.")
