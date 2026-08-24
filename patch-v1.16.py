from pathlib import Path

p=Path("DashboardV1.js")
js=p.read_text(encoding="utf-8-sig")
needle="  const reconciledSheet = ss.getSheetByName(\'Quest Prep Reconciled\');\\n\\n  const topRows"
repl="  const reconciledSheet = ss.getSheetByName(\'Quest Prep Reconciled\');\\n  const questDependencySheet = ss.getSheetByName(\'Quest Dependency\');\\n  const rewardMap = readV1QuestRewards_(questDependencySheet);\\n\\n  const topRows"
if needle not in js: raise SystemExit("DashboardV1.js insertion point not found.")
js=js.replace(needle,repl,1)
needle="    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5]})),"
repl="    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||\'\').trim().toLowerCase()]||null})),"
if needle not in js: raise SystemExit("topQuests mapping not found.")
js=js.replace(needle,repl,1)
reward_fn="function readV1QuestRewards_(sh) {\n  const out = {};\n  if (!sh || sh.getLastRow() < 5) return out;\n  const vals = sh.getDataRange().getDisplayValues();\n  let headerRow = -1, headers = [];\n  for (let i = 0; i < Math.min(vals.length, 12); i++) {\n    const row = vals[i].map(x => String(x || '').trim());\n    if (row.some(x => /^quest name$/i.test(x)) && row.some(x => /quest points reward/i.test(x))) { headerRow = i; headers = row; break; }\n  }\n  if (headerRow < 0) return out;\n  const col = rx => headers.findIndex(x => rx.test(x));\n  const q=col(/^quest name$/i), qp=col(/^quest points reward$/i), xp=col(/^xp rewards$/i), item=col(/^item \\/ coin rewards$/i), unlock=col(/^unlocks \\/ other rewards$/i);\n  vals.slice(headerRow + 1).forEach(r => {\n    const quest = q >= 0 ? String(r[q] || '').trim() : '';\n    if (!quest) return;\n    out[quest.toLowerCase()] = {qp:qp>=0?String(r[qp]||'').trim():'',xp:xp>=0?String(r[xp]||'').trim():'',items:item>=0?String(r[item]||'').trim():'',unlocks:unlock>=0?String(r[unlock]||'').trim():''};\n  });\n  return out;\n}\n\n"
anchor="function readV1WikiHealth_(dash) {"
if anchor not in js: raise SystemExit("reward function insertion point not found.")
js=js.replace(anchor,reward_fn+anchor,1)
p.write_text(js,encoding="utf-8",newline="\\n")

p=Path("V1.html")
h=p.read_text(encoding="utf-8-sig")
h=h.replace("V1.15.4","V1.16",1)
style_anchor=".targetLine{font-size:9px;color:#8a6a3d;font-weight:800;margin-top:3px}"
style_new=style_anchor+"\\n.questReward{margin-top:5px;font-size:10px;line-height:1.35;color:#705d48}.questReward b{color:#4d3218}.rewardBox{background:#fff7df!important;border-color:#d8b267!important}.rewardLines{display:grid;gap:5px}.rewardLine{font-size:11px;line-height:1.35}.rewardLabel{font-size:9px;font-weight:900;text-transform:uppercase;color:#8a642d;margin-right:5px}"
if style_anchor not in h: raise SystemExit("style anchor not found.")
h=h.replace(style_anchor,style_new,1)
old='        <div class="actionStep"><div class="n">Route impact</div><div id="nextImpact" class="v">—</div></div>'
new=old+'\\n        <div class="actionStep rewardBox"><div class="n">Quest rewards</div><div id="nextRewards" class="v rewardLines">—</div></div>'
if old not in h: raise SystemExit("Route impact box not found.")
h=h.replace(old,new,1)
helpers='function cleanRewardText(v){const s=String(v||\'\').trim();return(!s||/^none listed$/i.test(s))?\'\':s}\nfunction shortRewardText(r){\n  if(!r)return \'\';\n  const bits=[];\n  if(Number(r.qp||0)>0)bits.push(\'+\'+Number(r.qp)+\' QP\');\n  const xp=cleanRewardText(r.xp),items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);\n  if(xp)bits.push(xp);if(items)bits.push(items);if(unlocks)bits.push(unlocks);\n  return bits.join(\' · \');\n}\nfunction rewardLinesHtml(r){\n  if(!r)return \'<span>No reward data cached.</span>\';\n  const rows=[];\n  if(Number(r.qp||0)>0)rows.push(\'<div class="rewardLine"><span class="rewardLabel">Quest Points</span>+\'+esc(Number(r.qp))+\' QP</div>\');\n  const xp=cleanRewardText(r.xp),items=cleanRewardText(r.items),unlocks=cleanRewardText(r.unlocks);\n  if(xp)rows.push(\'<div class="rewardLine"><span class="rewardLabel">XP</span>\'+esc(xp)+\'</div>\');\n  if(items)rows.push(\'<div class="rewardLine"><span class="rewardLabel">Items</span>\'+esc(items)+\'</div>\');\n  if(unlocks)rows.push(\'<div class="rewardLine"><span class="rewardLabel">Unlocks</span>\'+esc(unlocks)+\'</div>\');\n  return rows.join(\'\')||\'<span>No listed rewards in the cached quest data.</span>\';\n}\n\n'
anchor="function render(s){"
if anchor not in h: raise SystemExit("render anchor not found.")
h=h.replace(anchor,helpers+anchor,1)
old='<td class="why">${esc(q.why)}</td></tr>`).join(\'\');'
new='<td class="why">${esc(q.why)}${shortRewardText(q.rewards)?`<div class="questReward"><b>Rewards:</b> ${esc(shortRewardText(q.rewards))}</div>`:\'\'}</td></tr>`).join(\'\');'
if old not in h: raise SystemExit("Top 5 Why cell not found.")
h=h.replace(old,new,1)
needle="  $(\'nextCurrentQp\').textContent=n[\'Current Quest Points\']||s.questPoints||\'—\';"
repl="  $(\'nextRewards\').innerHTML=rewardLinesHtml(top&&top.rewards?top.rewards:null);\\n"+needle
if needle not in h: raise SystemExit("Next reward render insertion point not found.")
h=h.replace(needle,repl,1)
p.write_text(h,encoding="utf-8",newline="\\n")
print("V1.16 Quest Rewards patch applied.")