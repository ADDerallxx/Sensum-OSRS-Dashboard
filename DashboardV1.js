const V1_TRACKER_ID = '18cUN2RTytdinH9kpgqQhz9OZsKRpHrVAB2hiUotznKU';

function saveV133ManualAchievement(title,note){return addV133ManualAchievement(title,note)}
function deleteV133ManualAchievement(id){return removeV133ManualAchievement(id)}

const V239_WIKI_ACK_KEY='V239_ACKNOWLEDGED_WIKI_REVISIONS';
function v239WikiAcknowledgements_(){try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(V239_WIKI_ACK_KEY)||'{}')}catch(e){return {}}}
function acknowledgeV239WikiRevision(quest,revision){
  quest=String(quest||'').trim();revision=String(revision||'').trim();if(!quest)throw new Error('Choose a quest alert.');
  const ack=v239WikiAcknowledgements_();ack[quest.toLowerCase()]={revision:revision,acknowledgedAt:new Date().toISOString()};
  PropertiesService.getScriptProperties().setProperty(V239_WIKI_ACK_KEY,JSON.stringify(ack));
  return getV1DashboardState({allowQuestHelperSync:false});
}
function acknowledgeAllV239WikiRevisions(items){
  items=(items||[]).slice(0,250);if(!items.length)return getV1DashboardState({allowQuestHelperSync:false});
  const ack=v239WikiAcknowledgements_(),now=new Date().toISOString();
  items.forEach(item=>{const quest=String(item.quest||item.name||'').trim(),revision=String(item.revision||item.latestRevision||'').trim();if(quest&&revision)ack[quest.toLowerCase()]={revision:revision,acknowledgedAt:now};});
  PropertiesService.getScriptProperties().setProperty(V239_WIKI_ACK_KEY,JSON.stringify(ack));
  return getV1DashboardState({allowQuestHelperSync:false});
}

function v239WikiSections_(text){
  const sections={},source=String(text||''),rx=/^(={2,6})\s*(.*?)\s*\1\s*$/gm;let last=0,key='Overview',match;
  while((match=rx.exec(source))){sections[key]=(sections[key]||'')+source.slice(last,match.index);key=String(match[2]||'').replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g,'$1').replace(/[{}\[\]]/g,'').trim()||'Other';last=rx.lastIndex;}
  sections[key]=(sections[key]||'')+source.slice(last);return sections;
}
function v239RevisionSummary_(oldText,newText){
  const before=v239WikiSections_(oldText),after=v239WikiSections_(newText),keys=[...new Set(Object.keys(before).concat(Object.keys(after)))],changed=[];
  keys.forEach(key=>{const clean=v=>String(v||'').replace(/\s+/g,' ').trim();if(clean(before[key])!==clean(after[key]))changed.push(key)});
  const categories=[];changed.forEach(section=>{
    if(/requirement|start point|items? required|recommended/i.test(section))categories.push('Requirements');
    else if(/reward/i.test(section))categories.push('Rewards');
    else if(/walkthrough|combat|fight|strategy|mechanic/i.test(section))categories.push('Walkthrough / mechanics');
    else if(/transcript|dialogue/i.test(section))categories.push('Dialogue');
    else if(/music/i.test(section))categories.push('Music');
    else if(/trivia/i.test(section))categories.push('Trivia');
    else if(/change|update history/i.test(section))categories.push('Wiki update history');
    else categories.push(section==='Overview'?'Page overview':section);
  });
  return {changedSections:changed,categories:[...new Set(categories)],summary:changed.length?('Changed: '+[...new Set(categories)].join(', ')+'.'):'No text difference was returned for these revisions.'};
}
function getV239WikiRevisionSummaries(requests){
  requests=(requests||[]).slice(0,25).map(x=>({name:String(x.name||''),stored:String(x.storedRevision||''),latest:String(x.latestRevision||'')}));
  const valid=requests.filter(x=>/^\d+$/.test(x.stored)&&/^\d+$/.test(x.latest)&&x.stored!==x.latest),results={};
  valid.forEach(x=>results[x.name]={name:x.name,status:'loading'});
  const calls=valid.map(x=>({url:'https://oldschool.runescape.wiki/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=ids%7Ccontent&rvslots=main&revids='+encodeURIComponent(x.stored+'|'+x.latest),headers:{'User-Agent':'SensumOSRSDashboard/2.39a'},muteHttpExceptions:true}));
  if(calls.length){
    UrlFetchApp.fetchAll(calls).forEach((response,index)=>{const item=valid[index];try{if(response.getResponseCode()<200||response.getResponseCode()>=300)throw new Error('Wiki HTTP '+response.getResponseCode());const data=JSON.parse(response.getContentText()),pages=(data.query&&data.query.pages)||[],revisions=[];pages.forEach(p=>(p.revisions||[]).forEach(r=>revisions.push(r)));const oldRev=revisions.find(r=>String(r.revid)===item.stored),newRev=revisions.find(r=>String(r.revid)===item.latest);if(!oldRev||!newRev)throw new Error('One of the Wiki revisions is unavailable.');const content=r=>r.slots&&r.slots.main?String(r.slots.main.content||''):'';results[item.name]=Object.assign({name:item.name,status:'ok'},v239RevisionSummary_(content(oldRev),content(newRev)));}catch(e){results[item.name]={name:item.name,status:'unavailable',summary:'The Wiki comparison could not be loaded: '+e.message,changedSections:[],categories:[]};}});
  }
  requests.filter(x=>!results[x.name]).forEach(x=>results[x.name]={name:x.name,status:'unavailable',summary:'Stored and latest revision IDs are not both available for comparison.',changedSections:[],categories:[]});
  return results;
}

function getV240MoneyMakingData(options){
  options=options||{};const runeBasis=Math.max(0,Number(options.runeCost)||0),capital=Math.max(0,Number(options.capital)||0),minVolume=Math.max(0,Number(options.minVolume)||0),members=String(options.members||'all');
  const cache=CacheService.getScriptCache(),cacheKey='V240_'+[runeBasis,capital,minVolume,members].join('_'),cached=cache.get(cacheKey);if(cached)return JSON.parse(cached);
  const root='https://prices.runescape.wiki/api/v1/osrs/',headers={'User-Agent':'SensumOSRSDashboard/2.40'};
  const responses=UrlFetchApp.fetchAll(['mapping','latest','5m','1h'].map(path=>({url:root+path,headers:headers,muteHttpExceptions:true})));
  responses.forEach((r,i)=>{if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('OSRS Wiki price feed returned HTTP '+r.getResponseCode()+' for '+['mapping','latest','5m','1h'][i]+'.')});
  const mapping=JSON.parse(responses[0].getContentText()),latest=JSON.parse(responses[1].getContentText()).data||{},five=JSON.parse(responses[2].getContentText()),hour=JSON.parse(responses[3].getContentText()),fiveData=five.data||{},hourData=hour.data||{};
  const nature=mapping.find(x=>String(x.name||'').toLowerCase()==='nature rune')||{},naturePrice=Number((latest[nature.id]||{}).high||(fiveData[nature.id]||{}).avgHighPrice||0),effectiveRuneCost=runeBasis||naturePrice;
  const eligible=item=>members==='all'||members==='members'&&item.members||members==='f2p'&&!item.members;
  const rows=mapping.filter(eligible).map(item=>{const id=String(item.id),p=latest[id]||{},f=fiveData[id]||{},h=hourData[id]||{},buy=Number(p.high||f.avgHighPrice||0),sell=Number(p.low||f.avgLowPrice||0),volume=Number(h.highPriceVolume||0)+Number(h.lowPriceVolume||0),recentVolume=Number(f.highPriceVolume||0)+Number(f.lowPriceVolume||0),limit=Math.max(0,Number(item.limit)||0),highalch=Math.max(0,Number(item.highalch)||0),highTime=Number(p.highTime||0),lowTime=Number(p.lowTime||0),fresh=Math.max(highTime,lowTime),trend=h.avgHighPrice?((Number(f.avgHighPrice||h.avgHighPrice)-Number(h.avgHighPrice))/Number(h.avgHighPrice)*100):0;return {id:Number(item.id),name:item.name,members:!!item.members,icon:item.icon||'',limit:limit,highalch:highalch,buy:buy,sell:sell,volume:volume,recentVolume:recentVolume,highTime:highTime,lowTime:lowTime,fresh:fresh,trend:trend}}).filter(x=>x.buy>0&&x.volume>=minVolume);
  const alchs=rows.filter(x=>x.highalch>0).map(x=>{const profit=Math.floor(x.highalch-x.buy-effectiveRuneCost),roi=x.buy+effectiveRuneCost>0?profit/(x.buy+effectiveRuneCost)*100:0,maxQty=x.limit||0,affordable=capital?Math.min(maxQty||Infinity,Math.floor(capital/(x.buy+effectiveRuneCost))):(maxQty||0),cycleProfit=profit*Math.max(0,Number.isFinite(affordable)?affordable:0),practicalScore=profit>0?profit*Math.log10(x.volume+10)*Math.log10((x.limit||1)+10):profit;return Object.assign({},x,{profit:profit,roi:roi,capitalEach:x.buy+effectiveRuneCost,affordable:Math.max(0,affordable||0),cycleProfit:cycleProfit,practicalScore:practicalScore})});
  const merch=rows.filter(x=>x.sell>0&&x.buy>x.sell).map(x=>{const tax=Math.min(5000000,Math.floor(x.buy*.02)),margin=x.buy-tax-x.sell,roi=x.sell?margin/x.sell*100:0,maxQty=x.limit||0,affordable=capital?Math.min(maxQty||Infinity,Math.floor(capital/x.sell)):(maxQty||0),cycleProfit=margin*Math.max(0,Number.isFinite(affordable)?affordable:0),score=margin>0?margin*Math.log10(x.volume+10)*Math.log10((x.limit||1)+10)/(1+Math.abs(x.trend)/10):margin;return Object.assign({},x,{entry:x.sell,exit:x.buy,tax:tax,margin:margin,roi:roi,affordable:Math.max(0,affordable||0),cycleProfit:cycleProfit,practicalScore:score})}).filter(x=>x.margin>0);
  const top=(list,key,n)=>list.slice().sort((a,b)=>b[key]-a[key]||b.volume-a.volume).slice(0,n);
  const trackedIds=new Set(getV240Purchases().map(x=>Number(x.itemId||0)).filter(Boolean)),tracked=rows.filter(x=>trackedIds.has(Number(x.id))).map(x=>{const alch=alchs.find(a=>a.id===x.id),flip=merch.find(m=>m.id===x.id);return Object.assign({},x,alch||{},flip||{})});
  const result={generatedAt:new Date().toISOString(),feedTimestamp:Math.max(Number(five.timestamp||0),Number(hour.timestamp||0))*1000,natureRune:{id:nature.id||561,livePrice:naturePrice,costBasis:effectiveRuneCost,manualBasis:!!runeBasis},highAlch:{highest:top(alchs,'profit',40),practical:top(alchs.filter(x=>x.profit>0&&x.volume>=Math.max(20,minVolume)),'practicalScore',40)},merch:{practical:top(merch,'practicalScore',40)},tracked:tracked,assumptions:{taxRate:.02,taxCap:5000000,magicXpPerCast:65,castsPerHour:1200,source:'OSRS Wiki real-time prices'}};
  try{cache.put(cacheKey,JSON.stringify(result),120)}catch(e){}return result;
}

function v240PurchaseSheet_(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);let sh=ss.getSheetByName('Money Making Journal');
  if(!sh){sh=ss.insertSheet('Money Making Journal');sh.getRange(1,1,1,9).setValues([['Purchase ID','Purchase Date','Item ID','Item','Quantity','Unit Price','Purpose','Source','Updated At']]);sh.setFrozenRows(1);}
  return sh;
}
function getV240Purchases(){
  const sh=v240PurchaseSheet_();if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,9).getValues().map(r=>({id:String(r[0]||''),date:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'):String(r[1]||''),itemId:Number(r[2]||0),item:String(r[3]||''),quantity:Number(r[4]||0),unitPrice:Number(r[5]||0),purpose:String(r[6]||''),source:String(r[7]||''),updatedAt:r[8] instanceof Date?r[8].toISOString():String(r[8]||'')})).filter(x=>x.id&&x.item).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
}
function saveV240Purchase(entry){
  entry=entry||{};const item=String(entry.item||'').trim(),date=String(entry.date||'').trim(),quantity=Math.floor(Number(entry.quantity)||0),unitPrice=Math.floor(Number(entry.unitPrice)||0);if(!item)throw new Error('Choose an item.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid purchase date.');if(quantity<1)throw new Error('Quantity must be at least 1.');if(unitPrice<0)throw new Error('Unit price cannot be negative.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v240PurchaseSheet_(),id=String(entry.id||Utilities.getUuid()),itemId=Number(entry.itemId||0),same=x=>itemId?x.itemId===itemId:x.item.toLowerCase()===item.toLowerCase(),otherQty=getV240Purchases().filter(x=>x.id!==id&&same(x)).reduce((s,x)=>s+x.quantity,0),disposed=v240RawActions_().filter(same).reduce((s,x)=>s+x.quantity,0);if(otherQty+quantity<disposed)throw new Error('This edit would leave fewer purchased items than the '+disposed+' already sold or alched.');const row=[id,new Date(date+'T12:00:00'),itemId,item,quantity,unitPrice,String(entry.purpose||'Other'),String(entry.source||'Dashboard'),new Date()],values=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues():[],index=values.findIndex(r=>String(r[0])===id);if(index>=0)sh.getRange(index+2,1,1,9).setValues([row]);else sh.appendRow(row);return {ok:true,id:id,purchases:getV240Purchases()};}finally{lock.releaseLock();}
}
function deleteV240Purchase(id){
  id=String(id||'');if(!id)throw new Error('Choose a purchase.');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v240PurchaseSheet_(),purchases=getV240Purchases(),target=purchases.find(x=>x.id===id);if(target){const same=x=>target.itemId?x.itemId===target.itemId:x.item.toLowerCase()===target.item.toLowerCase(),remainingPurchased=purchases.filter(x=>x.id!==id&&same(x)).reduce((s,x)=>s+x.quantity,0),disposed=v240RawActions_().filter(same).reduce((s,x)=>s+x.quantity,0);if(remainingPurchased<disposed)throw new Error('Delete recorded sales or alchs first; this purchase supports '+disposed+' disposed items.');}if(sh.getLastRow()>1){const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues(),index=ids.findIndex(r=>String(r[0])===id);if(index>=0)sh.deleteRow(index+2);}return {ok:true,purchases:getV240Purchases()};}finally{lock.releaseLock();}
}

function v240ActionSheet_(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);let sh=ss.getSheetByName('Money Making Actions');
  if(!sh){sh=ss.insertSheet('Money Making Actions');sh.getRange(1,1,1,13).setValues([['Action ID','Action Date','Item ID','Item','Quantity','Action','Unit Return','Unit Tax','Nature Cost','Unit Cost Basis','Source','Updated At','Notes']]);sh.setFrozenRows(1);}
  return sh;
}
function v240RawActions_(){
  const sh=v240ActionSheet_();if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,13).getValues().map(r=>({id:String(r[0]||''),date:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'):String(r[1]||''),itemId:Number(r[2]||0),item:String(r[3]||''),quantity:Number(r[4]||0),action:String(r[5]||''),unitReturn:Number(r[6]||0),unitTax:Number(r[7]||0),natureCost:Number(r[8]||0),costBasis:Number(r[9]||0),source:String(r[10]||''),updatedAt:r[11] instanceof Date?r[11].toISOString():String(r[11]||''),notes:String(r[12]||'')})).filter(x=>x.id&&x.item&&x.quantity>0);
}
function v243FifoAllocations_(purchases,actions){
  const key=x=>x.itemId?'id:'+x.itemId:'name:'+String(x.item||'').toLowerCase(),lots={};purchases.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.updatedAt.localeCompare(b.updatedAt)).forEach(p=>{const k=key(p);(lots[k]||(lots[k]=[])).push({id:p.id,date:p.date,quantity:p.quantity,remaining:p.quantity,unitPrice:p.unitPrice})});const result={};actions.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.updatedAt.localeCompare(b.updatedAt)).forEach(a=>{let need=a.quantity,total=0,used=0,alloc=[];(lots[key(a)]||[]).forEach(l=>{if(need<=0||l.remaining<=0)return;const qty=Math.min(need,l.remaining);l.remaining-=qty;need-=qty;used+=qty;total+=qty*l.unitPrice;alloc.push({purchaseId:l.id,purchaseDate:l.date,quantity:qty,unitCost:l.unitPrice})});result[a.id]={costBasis:used?total/used:Number(a.costBasis||0),allocations:alloc,unallocated:need}});return result;
}
function getV240Portfolio(){
  const purchases=getV240Purchases(),actions=v240RawActions_(),positions={};
  const key=x=>x.itemId?'id:'+x.itemId:'name:'+String(x.item||'').toLowerCase();
  purchases.forEach(p=>{const k=key(p),row=positions[k]||(positions[k]={itemId:p.itemId,item:p.item,bought:0,purchaseCost:0,disposed:0,purposeMap:{},purposeQty:{},actionQty:{Sale:0,Alch:0}}),purpose=p.purpose||'Other';row.bought+=p.quantity;row.purchaseCost+=p.quantity*p.unitPrice;row.purposeMap[purpose]=true;row.purposeQty[purpose]=(row.purposeQty[purpose]||0)+p.quantity;});
  actions.forEach(a=>{const k=key(a),row=positions[k]||(positions[k]={itemId:a.itemId,item:a.item,bought:0,purchaseCost:0,disposed:0,purposeMap:{},purposeQty:{},actionQty:{Sale:0,Alch:0}});row.disposed+=a.quantity;row.actionQty[a.action]=(row.actionQty[a.action]||0)+a.quantity;});
  const list=Object.keys(positions).map(k=>{const x=positions[k],averageCost=x.bought?x.purchaseCost/x.bought:0,alchBought=Number(x.purposeQty['High Alch']||0),merchBought=Number(x.purposeQty.Merch||0),otherBought=Math.max(0,x.bought-alchBought-merchBought),alchRemaining=Math.max(0,alchBought-Number(x.actionQty.Alch||0)),merchRemaining=Math.max(0,merchBought-Number(x.actionQty.Sale||0)),otherDisposed=Math.max(0,x.disposed-(alchBought-alchRemaining)-(merchBought-merchRemaining));return Object.assign(x,{averageCost:averageCost,remaining:Math.max(0,x.bought-x.disposed),purposes:Object.keys(x.purposeMap||{}),alchRemaining:alchRemaining,merchRemaining:merchRemaining,otherRemaining:Math.max(0,otherBought-otherDisposed)})});
  const costByKey={};list.forEach(x=>costByKey[key(x)]=x.averageCost);
  const fifo=v243FifoAllocations_(purchases,actions),enriched=actions.map(a=>{const allocation=fifo[a.id]||{},avg=Number(allocation.costBasis||a.costBasis||costByKey[key(a)]||0),extra=/^alch$/i.test(a.action)?a.natureCost:a.unitTax,profit=(a.unitReturn-avg-extra)*a.quantity;return Object.assign({},a,{averageCost:avg,totalReturn:a.unitReturn*a.quantity,totalCost:avg*a.quantity,realizedProfit:profit,magicXp:/^alch$/i.test(a.action)?a.quantity*65:0,lotAllocations:allocation.allocations||[],unallocated:Number(allocation.unallocated||0)})}).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
  const now=new Date(),today=Utilities.formatDate(now,Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'),weekAgo=Utilities.formatDate(new Date(now.getTime()-6*86400000),Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'),month=today.slice(0,7);
  const sum=rows=>rows.reduce((s,x)=>s+x.realizedProfit,0),open=list.filter(x=>x.remaining>0).sort((a,b)=>b.remaining*b.averageCost-a.remaining*a.averageCost);
  return {positions:open,actions:enriched,summary:{inventoryValue:open.reduce((s,x)=>s+x.remaining*x.averageCost,0),realizedProfit:sum(enriched),todayProfit:sum(enriched.filter(x=>x.date===today)),weekProfit:sum(enriched.filter(x=>x.date>=weekAgo)),monthProfit:sum(enriched.filter(x=>x.date.slice(0,7)===month)),magicXp:enriched.reduce((s,x)=>s+x.magicXp,0)}};
}
function saveV240Action(entry){
  entry=entry||{};const item=String(entry.item||'').trim(),date=String(entry.date||'').trim(),quantity=Math.floor(Number(entry.quantity)||0),action=/^alch$/i.test(String(entry.action||''))?'Alch':'Sale',unitReturn=Math.floor(Number(entry.unitReturn)||0),natureCost=action==='Alch'?Math.max(0,Math.floor(Number(entry.natureCost)||0)):0,unitTax=action==='Sale'?Math.min(5000000,Math.max(0,Math.floor(entry.unitTax==null?unitReturn*.02:Number(entry.unitTax)||0))):0;if(!item)throw new Error('Choose an item.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid action date.');if(quantity<1)throw new Error('Quantity must be at least 1.');if(unitReturn<0)throw new Error('Unit return cannot be negative.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v240ActionSheet_(),id=String(entry.id||Utilities.getUuid()),existing=v240RawActions_().find(x=>x.id===id),portfolio=getV240Portfolio(),position=portfolio.positions.find(x=>Number(entry.itemId||0)&&x.itemId===Number(entry.itemId)||!Number(entry.itemId||0)&&x.item.toLowerCase()===item.toLowerCase()),available=Number(position?position.remaining:0)+Number(existing?existing.quantity:0);if(quantity>available)throw new Error('Only '+available+' '+item+' remain available.');const costBasis=Number(existing&&existing.costBasis||position&&position.averageCost||0),row=[id,new Date(date+'T12:00:00'),Number(entry.itemId||0),item,quantity,action,unitReturn,unitTax,natureCost,costBasis,String(entry.source||'Dashboard'),new Date(),String(entry.notes||'')],ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues():[],index=ids.findIndex(r=>String(r[0])===id);if(index>=0)sh.getRange(index+2,1,1,13).setValues([row]);else sh.appendRow(row);return {ok:true,id:id,portfolio:getV240Portfolio()};}finally{lock.releaseLock();}
}
function deleteV240Action(id){
  id=String(id||'');if(!id)throw new Error('Choose an action.');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v240ActionSheet_();if(sh.getLastRow()>1){const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues(),index=ids.findIndex(r=>String(r[0])===id);if(index>=0)sh.deleteRow(index+2);}return {ok:true,portfolio:getV240Portfolio()};}finally{lock.releaseLock();}
}

function v244WikiItems_(query,tracked){
  query=String(query||'').trim().toLowerCase();tracked=tracked||[];if(!query&&!tracked.length)return [];
  const cache=CacheService.getScriptCache(),key='V244_ITEMS_'+Utilities.base64EncodeWebSafe(JSON.stringify([query,tracked])).slice(0,180),cached=cache.get(key);if(cached)return JSON.parse(cached);
  const root='https://prices.runescape.wiki/api/v1/osrs/',headers={'User-Agent':'SensumOSRSDashboard/2.44'},responses=UrlFetchApp.fetchAll(['mapping','latest'].map(path=>({url:root+path,headers:headers,muteHttpExceptions:true})));responses.forEach((r,i)=>{if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('OSRS Wiki item service returned HTTP '+r.getResponseCode()+'.')});
  const mapping=JSON.parse(responses[0].getContentText()),latest=JSON.parse(responses[1].getContentText()).data||{},ids=new Set(tracked.map(x=>Number(x.itemId||x.id||0)).filter(Boolean)),names=new Set(tracked.map(x=>String(x.item||x.name||'').toLowerCase()).filter(Boolean));let rows=mapping.filter(x=>query?String(x.name||'').toLowerCase().includes(query):ids.has(Number(x.id))||names.has(String(x.name||'').toLowerCase()));if(query)rows.sort((a,b)=>{const an=String(a.name).toLowerCase(),bn=String(b.name).toLowerCase();return Number(!an.startsWith(query))-Number(!bn.startsWith(query))||an.length-bn.length||an.localeCompare(bn)}),rows=rows.slice(0,15);
  const result=rows.map(item=>{const p=latest[String(item.id)]||{};return {id:Number(item.id),name:String(item.name||''),members:!!item.members,icon:String(item.icon||''),limit:Number(item.limit||0),high:Number(p.high||0),low:Number(p.low||0),highTime:Number(p.highTime||0),lowTime:Number(p.lowTime||0)}});try{cache.put(key,JSON.stringify(result),query?600:60)}catch(e){}return result;
}
function searchV244Items(query){return v244WikiItems_(query,[])}
function getV244TrackedItemPrices(items){return {generatedAt:new Date().toISOString(),items:v244WikiItems_('',(items||[]).slice(0,100))}}
function getV253TrackedOutputPrices(outputs){const finished=(outputs||[]).slice(0,100).map(x=>({id:Number(x&&x.outputItemId||0),name:String(x&&x.outputItem||'').trim()})).filter(x=>x.id||x.name);return {generatedAt:new Date().toISOString(),scope:'finished outputs only',items:v244WikiItems_('',finished)}}
function getV245VerifiedRecipe(item){
  const name=String(item&&item.name||item||'').trim().toLowerCase(),recipes={
    'amulet of chemistry':{recipe:'Lvl-2 Enchant — Amulet of chemistry',output:'Amulet of chemistry',skill:'Magic',level:27,xpEach:37,inputs:[{item:'Jade amulet',quantity:1},{item:'Cosmic rune',quantity:1},{item:'Air rune',quantity:3}],source:'https://oldschool.runescape.wiki/w/Amulet_of_chemistry',verified:'2026-08-27',modifierGroups:[{type:'Input replacement',description:'Supplies or replaces a consumed ingredient',icon:'Staff of air',options:[{item:'Staff of air',supplies:['Air rune']},{item:'Air battlestaff',supplies:['Air rune']},{item:'Mystic air staff',supplies:['Air rune']},{item:'Mist battlestaff',supplies:['Air rune','Water rune']},{item:'Dust battlestaff',supplies:['Air rune','Earth rune']},{item:'Smoke battlestaff',supplies:['Air rune','Fire rune']}]}]},
    'prayer potion (3)':{recipe:'Herblore — Prayer potion(3)',output:'Prayer potion(3)',skill:'Herblore',level:38,xpEach:87.5,inputs:[{item:'Ranarr potion (unf)',quantity:1},{item:'Snape grass',quantity:1}],source:'https://oldschool.runescape.wiki/w/Prayer_potion',verified:'2026-08-29',modifierGroups:[]},
    'prayer potion(3)':{recipe:'Herblore — Prayer potion(3)',output:'Prayer potion(3)',skill:'Herblore',level:38,xpEach:87.5,inputs:[{item:'Ranarr potion (unf)',quantity:1},{item:'Snape grass',quantity:1}],source:'https://oldschool.runescape.wiki/w/Prayer_potion',verified:'2026-08-29',modifierGroups:[]}
  },recipe=recipes[name]||v270ResolveWikiRecipe_(item);if(!recipe)return null;recipe.modifierGroups=recipe.modifierGroups||[];const wanted=recipe.inputs.map(x=>({name:x.item})).concat(recipe.modifierGroups.flatMap(g=>[{name:g.icon}].concat(g.options.map(o=>({name:o.item}))))).concat([{name:recipe.output}]),prices=v244WikiItems_('',wanted),byName={};prices.forEach(x=>byName[x.name.toLowerCase()]=x);recipe.outputItem=byName[recipe.output.toLowerCase()]||{name:recipe.output};recipe.inputs=recipe.inputs.map(x=>Object.assign({},x,{market:byName[x.item.toLowerCase()]||null}));recipe.modifierGroups=recipe.modifierGroups.map(g=>Object.assign({},g,{iconItem:byName[g.icon.toLowerCase()]||{name:g.icon},options:g.options.map(o=>Object.assign({},o,{market:byName[o.item.toLowerCase()]||null}))}));return recipe;
}

function getV279DecantToFourRecipe(item){
  const selectedName=String(item&&item.name||item||'').trim(),match=selectedName.match(/^(.*?)\s*\(([123])\)$/i);
  if(!match)throw new Error('Choose a tradeable 1-, 2-, or 3-dose potion to decant.');
  const base=match[1].trim(),sourceDose=Number(match[2]),outputName=base+'(4)',prices=v244WikiItems_('',[{name:selectedName},{name:outputName}]),byName={};
  prices.forEach(x=>byName[String(x.name||'').toLowerCase()]=x);
  const source=byName[selectedName.toLowerCase()],output=byName[outputName.toLowerCase()];
  if(!source)throw new Error('The selected source potion is not available in the current GE mapping.');
  if(!output)throw new Error('No tradeable 4-dose GE item was found for '+base+'.');
  return {mode:'DECANT_4',recipe:'Decant to 4-dose — '+base,output:output.name,outputItem:output,outputQuantity:1,skill:'Processing',level:0,xpEach:0,inputs:[{item:source.name,quantity:4/sourceDose,market:source}],source:'https://oldschool.runescape.wiki/w/Decanting',verified:Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'),verification:'Dose-preserving decant conversion',sourceDose:sourceDose,dosesPerOutput:4,modifierGroups:[]};
}

function v243ProcessingSheet_(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);let sh=ss.getSheetByName('Money Making Processing');
  if(!sh){sh=ss.insertSheet('Money Making Processing');sh.getRange(1,1,1,19).setValues([['Batch ID','Start Date','Recipe','Inputs JSON','Output Item ID','Output Item','Planned','Processed','Sold','Sell Price','XP Each','Notes','Source','Updated At','Waste','Status','Modifiers JSON','Sales JSON','Leftover Doses']]);sh.setFrozenRows(1);}else{if(sh.getLastColumn()<17)sh.getRange(1,17).setValue('Modifiers JSON');if(sh.getLastColumn()<18)sh.getRange(1,18).setValue('Sales JSON');if(sh.getLastColumn()<19)sh.getRange(1,19).setValue('Leftover Doses');}
  return sh;
}
function getV243ProcessingBatches(){
  const sh=v243ProcessingSheet_();if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,19).getValues().map(r=>{let inputs=[],modifiers=[],sales=[];try{inputs=JSON.parse(String(r[3]||'[]'))}catch(e){}try{modifiers=JSON.parse(String(r[16]||'[]'))}catch(e){}try{sales=JSON.parse(String(r[17]||'[]'))}catch(e){}const supplied=new Set(modifiers.flatMap(m=>m.supplies||[]).map(x=>String(x).toLowerCase())),effectiveInputs=inputs.map(x=>Object.assign({},x,{effectiveQuantity:supplied.has(String(x.item).toLowerCase())?0:Number(x.quantity||0)})),planned=Number(r[6]||0),processed=Number(r[7]||0),legacySold=Number(r[8]||0),waste=Number(r[14]||0),unitCost=effectiveInputs.reduce((s,x)=>s+Number(x.effectiveQuantity||0)*Number(x.unitCost||0),0);if(!sales.length&&legacySold>0)sales=[{id:'legacy',date:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'):String(r[1]||''),quantity:legacySold,unitPrice:Number(r[9]||0),legacy:true}];const sold=sales.reduce((s,x)=>s+Number(x.quantity||0),0),realized=sales.reduce((s,x)=>{const price=Number(x.unitPrice||0),tax=Math.min(5000000,Math.floor(price*.02));return s+Number(x.quantity||0)*(price-tax-unitCost)},0),tax=Math.min(5000000,Math.floor(Number(r[9]||0)*.02)),ready=Math.max(0,processed-sold-waste),potential=ready*(Number(r[9]||0)-tax-unitCost),status=sold+waste>=planned&&processed>=planned?'Completed':sold>0?'Partially sold':ready>0?'Ready to sell':processed>0?'Processing':'Planned';return {id:String(r[0]||''),date:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'):String(r[1]||''),recipe:String(r[2]||''),inputs:inputs,effectiveInputs:effectiveInputs,modifiers:modifiers,sales:sales,outputItemId:Number(r[4]||0),outputItem:String(r[5]||''),planned:planned,processed:processed,sold:sold,sellPrice:Number(r[9]||0),xpEach:Number(r[10]||0),notes:String(r[11]||''),updatedAt:r[13] instanceof Date?r[13].toISOString():String(r[13]||''),waste:waste,leftoverDoses:Number(r[18]||0),status:status,unitCost:unitCost,ready:ready,inputSetsRemaining:Math.max(0,planned-processed),realizedProfit:realized,potentialProfit:potential,xp:processed*Number(r[10]||0)}}).filter(x=>x.id&&x.outputItem).sort((a,b)=>(a.status==='Completed')-(b.status==='Completed')||b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
}
function saveV243ProcessingBatch(entry){
  entry=entry||{};const date=String(entry.date||''),recipe=String(entry.recipe||'').trim(),output=String(entry.outputItem||'').trim(),planned=Math.floor(Number(entry.planned)||0),processed=Math.floor(Number(entry.processed)||0),sold=Math.floor(Number(entry.sold)||0),waste=Math.floor(Number(entry.waste)||0),sellPrice=Math.floor(Number(entry.sellPrice)||0),xpEach=Number(entry.xpEach)||0,inputs=(entry.inputs||[]).map(x=>({item:String(x.item||'').trim(),quantity:Number(x.quantity)||0,unitCost:Math.max(0,Number(x.unitCost)||0)})).filter(x=>x.item&&x.quantity>0),modifiers=(entry.modifiers||[]).map(m=>({type:String(m.type||''),item:String(m.item||''),supplies:(m.supplies||[]).map(String),description:String(m.description||'')})).filter(m=>m.type&&m.item);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid batch date.');if(!recipe||!output)throw new Error('Enter a recipe and output item.');if(!inputs.length)throw new Error('Add at least one valid input.');if(planned<1||processed<0||processed>planned)throw new Error('Processed quantity must be between zero and the planned quantity.');if(sold<0||waste<0||sold+waste>processed)throw new Error('Sold plus waste cannot exceed processed output.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v243ProcessingSheet_(),id=String(entry.id||Utilities.getUuid()),ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues():[],index=ids.findIndex(r=>String(r[0])===id),old=index>=0?sh.getRange(index+2,1,1,19).getValues()[0]:[],sales=String(old[17]||'[]'),leftover=Math.max(0,Number(entry.leftoverDoses!=null?entry.leftoverDoses:old[18])||0),row=[id,new Date(date+'T12:00:00'),recipe,JSON.stringify(inputs),Number(entry.outputItemId||0),output,planned,processed,sold,sellPrice,xpEach,String(entry.notes||''),String(entry.source||'Dashboard processing journal'),new Date(),waste,String(entry.status||''),JSON.stringify(modifiers),sales,leftover];if(index>=0)sh.getRange(index+2,1,1,19).setValues([row]);else sh.appendRow(row);return {ok:true,id:id,batches:getV243ProcessingBatches()};}finally{lock.releaseLock();}
}
function saveV280ProcessingSale(entry){entry=entry||{};const batchId=String(entry.batchId||''),date=String(entry.date||''),quantity=Math.floor(Number(entry.quantity)||0),unitPrice=Math.floor(Number(entry.unitPrice)||0);if(!batchId)throw new Error('Choose a processing batch.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid sale date.');if(quantity<1||unitPrice<0)throw new Error('Enter a valid quantity and sale price.');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v243ProcessingSheet_(),ids=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),1).getDisplayValues(),index=ids.findIndex(r=>String(r[0])===batchId);if(index<0)throw new Error('Processing batch was not found.');const row=index+2,r=sh.getRange(row,1,1,19).getValues()[0];let sales=[];try{sales=JSON.parse(String(r[17]||'[]'))}catch(e){}const legacy=Number(r[8]||0);if(!sales.length&&legacy>0)sales.push({id:'legacy',date:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'):String(r[1]||''),quantity:legacy,unitPrice:Number(r[9]||0),legacy:true});const saleId=String(entry.id||Utilities.getUuid()),existing=sales.findIndex(x=>String(x.id)===saleId),sale={id:saleId,date:date,quantity:quantity,unitPrice:unitPrice,updatedAt:new Date().toISOString()};if(existing>=0)sales[existing]=sale;else sales.push(sale);const total=sales.reduce((s,x)=>s+Number(x.quantity||0),0),available=Math.max(0,Number(r[7]||0)-Number(r[14]||0));if(total>available)throw new Error('Sold quantity cannot exceed finished inventory available to sell.');sh.getRange(row,9).setValue(total);sh.getRange(row,18).setValue(JSON.stringify(sales));sh.getRange(row,14).setValue(new Date());return {ok:true,batches:getV243ProcessingBatches()};}finally{lock.releaseLock();}}
function deleteV280ProcessingSale(batchId,saleId){const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v243ProcessingSheet_(),ids=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),1).getDisplayValues(),index=ids.findIndex(r=>String(r[0])===String(batchId||''));if(index<0)throw new Error('Processing batch was not found.');const row=index+2;let sales=[];try{sales=JSON.parse(String(sh.getRange(row,18).getValue()||'[]'))}catch(e){}sales=sales.filter(x=>String(x.id)!==String(saleId||''));sh.getRange(row,9).setValue(sales.reduce((s,x)=>s+Number(x.quantity||0),0));sh.getRange(row,18).setValue(JSON.stringify(sales));sh.getRange(row,14).setValue(new Date());return {ok:true,batches:getV243ProcessingBatches()};}finally{lock.releaseLock();}}
function deleteV243ProcessingBatch(id){
  id=String(id||'');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=v243ProcessingSheet_();if(sh.getLastRow()>1){const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues(),index=ids.findIndex(r=>String(r[0])===id);if(index>=0)sh.deleteRow(index+2);}return {ok:true,batches:getV243ProcessingBatches()};}finally{lock.releaseLock();}
}

function forceV134WiseOldManUpdate() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('A Wise Old Man update is already running.');
  try {
    const ss = SpreadsheetApp.openById(V1_TRACKER_ID), sh = ss.getSheetByName('Your Stats');
    if (!sh) throw new Error('Your Stats sheet was not found.');
    const values = sh.getDataRange().getDisplayValues();
    let username = 'Sensum';
    values.forEach(r => { if (/^username$/i.test(String(r[0] || '').trim()) && r[1]) username = String(r[1]).trim(); });
    const url = 'https://api.wiseoldman.net/v2/players/' + encodeURIComponent(username);
    const response = UrlFetchApp.fetch(url, {method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/1.34'}});
    const code = response.getResponseCode(), body = response.getContentText();
    if (code < 200 || code >= 300) {
      let message = 'Wise Old Man returned HTTP ' + code;
      try { const parsed = JSON.parse(body); message = parsed.message || parsed.error || message; } catch (e) {}
      if (code === 429) message = 'Wise Old Man update cooldown is active. Wait about a minute and try again.';
      throw new Error(message);
    }
    const player = JSON.parse(body), snapshot = player.latestSnapshot;
    if (!snapshot || !snapshot.data || !snapshot.data.skills) throw new Error('Wise Old Man did not return a current skill snapshot.');
    const skills = snapshot.data.skills;
    const aliases = {runecraft:'runecrafting',runecrafting:'runecrafting'};
    const skillRows = sh.getRange(3,1,24,8).getDisplayValues();
    skillRows.forEach((r,i) => {
      const display = String(r[0] || '').trim(), key = aliases[display.toLowerCase()] || display.toLowerCase().replace(/\s+/g,'_');
      const stat = skills[key];
      if (!stat) return;
      sh.getRange(i+3,2).setValue(Number(stat.level || 1));
      sh.getRange(i+3,8).setValue(Math.max(0,Number(stat.experience || 0)));
    });
    const account = sh.getRange(30,1,Math.max(1,sh.getLastRow()-29),2).getDisplayValues();
    let snapshotRow = -1, syncRow = -1;
    account.forEach((r,i) => { if (/^last wom snapshot$/i.test(String(r[0] || '').trim())) snapshotRow=i+30; if (/^last sheet sync$/i.test(String(r[0] || '').trim())) syncRow=i+30; });
    if (snapshotRow > 0) sh.getRange(snapshotRow,2).setValue(new Date(snapshot.createdAt || new Date()));
    if (syncRow > 0) sh.getRange(syncRow,2).setValue(new Date());
    SpreadsheetApp.flush();
    return {ok:true,message:'Wise Old Man updated for '+username+'.',snapshotAt:snapshot.createdAt||'',state:getV300DashboardShellState()};
  } finally { lock.releaseLock(); }
}

function v22XpFloorForLevel_(level) {
  level = Math.max(1, Math.min(99, Number(level) || 1));
  let points = 0;
  for (let current = 1; current < level; current++) points += Math.floor(current + 300 * Math.pow(2, current / 7));
  return Math.floor(points / 4);
}

function v22WikiSyncMeta_() {
  const p = PropertiesService.getScriptProperties();
  return {
    lastSync: p.getProperty('V22_WIKISYNC_LAST_SYNC') || '',
    sourceTimestamp: p.getProperty('V22_WIKISYNC_SOURCE_TIMESTAMP') || '',
    lastError: p.getProperty('V22_WIKISYNC_LAST_ERROR') || '',
    updatedLevels: Number(p.getProperty('V22_WIKISYNC_UPDATED_LEVELS') || 0),
    completedQuests: Number(p.getProperty('V22_WIKISYNC_COMPLETED_QUESTS') || 0)
  };
}

function acknowledgeV237QuestDetection(currentQp,quests,disposition){
  const props=PropertiesService.getScriptProperties(),qp=Math.max(0,Number(currentQp)||0);
  props.setProperty('V115_LAST_RECONCILED_QP',String(qp));
  props.setProperty('V237_LAST_DETECTION_ACK',JSON.stringify({quests:Array.isArray(quests)?quests:[],disposition:String(disposition||'dismissed'),qp:qp,at:new Date().toISOString()}));
  return {ok:true,currentQp:qp};
}

function refreshV22WikiSync(clientPayload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {ok:true, skipped:true, message:'Live sync is already running.', state:getV300DashboardShellState()};
  const props = PropertiesService.getScriptProperties();
  try {
    const lastAttempt = Number(props.getProperty('V22_WIKISYNC_LAST_ATTEMPT_MS') || 0);
    if (Date.now() - lastAttempt < 20000) return {ok:true, skipped:true, message:'Live data is already current.', state:getV300DashboardShellState()};
    props.setProperty('V22_WIKISYNC_LAST_ATTEMPT_MS', String(Date.now()));
    const ss = SpreadsheetApp.openById(V1_TRACKER_ID), statsSheet = ss.getSheetByName('Your Stats');
    if (!statsSheet) throw new Error('Your Stats sheet was not found.');
    const allStats = statsSheet.getDataRange().getDisplayValues();
    let username = 'Sensum';
    allStats.forEach(r => { if (/^username$/i.test(String(r[0] || '').trim()) && r[1]) username = String(r[1]).trim(); });
    let payload = clientPayload;
    if (!payload) {
      const url = 'https://sync.runescape.wiki/runelite/player/' + encodeURIComponent(username) + '/STANDARD';
      let response = UrlFetchApp.fetch(url, {muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/2.2'}});
      if (response.getResponseCode() !== 200) {
        const relay = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        response = UrlFetchApp.fetch(relay, {muteHttpExceptions:true,headers:{'User-Agent':'SensumOSRSDashboard/2.2'}});
      }
      if (response.getResponseCode() !== 200) throw new Error('WikiSync relay returned HTTP ' + response.getResponseCode() + '.');
      payload = JSON.parse(response.getContentText());
    }
    if (String(payload.username || '').trim().toLowerCase() !== username.toLowerCase()) throw new Error('WikiSync username did not match this dashboard.');
    if (!payload.levels || !payload.quests) throw new Error('WikiSync did not return levels and quests.');

    const levelMap = {};
    Object.keys(payload.levels).forEach(k => levelMap[String(k).toLowerCase()] = Number(payload.levels[k]));
    const rows = statsSheet.getRange(3,1,24,8).getValues(), liveLevelValues = [];
    let changedLevels = 0;
    rows.forEach(r => {
      const key = String(r[0] || '').trim().toLowerCase().replace(/^runecrafting$/,'runecraft');
      if (!Object.prototype.hasOwnProperty.call(levelMap,key)) return;
      const liveLevel = Math.max(1, levelMap[key] || 1);
      if (Number(r[1]) !== liveLevel) changedLevels++;
      r[1] = liveLevel;
    });
    rows.forEach(r => liveLevelValues.push([r[1]]));
    statsSheet.getRange(3,2,24,1).setValues(liveLevelValues);

    let newlyCompleted = 0, newlyCompletedNames = [];
    const table = v115QuestTable_(ss), questRows = table.vals.slice(table.headerRow + 1), firstDataRow = table.headerRow + 2;
    const liveQuests = {};
    Object.keys(payload.quests).forEach(k => liveQuests[String(k).trim().toLowerCase()] = Number(payload.quests[k]));
    questRows.forEach(r => {
      const name = String(r[table.qCol] || '').trim(), status = String(r[table.cCol] || '').trim();
      if (name && liveQuests[name.toLowerCase()] === 2 && !/^(yes|true|complete|completed)$/i.test(status)) {
        r[table.cCol] = 'Yes'; newlyCompleted++; newlyCompletedNames.push(name);
      }
    });
    if (newlyCompleted) table.sh.getRange(firstDataRow,table.cCol+1,questRows.length,1).setValues(questRows.map(r => [r[table.cCol]]));
    const now = new Date().toISOString();
    props.setProperties({
      V22_WIKISYNC_LAST_SYNC: now,
      V22_WIKISYNC_SOURCE_TIMESTAMP: String(payload.timestamp || now),
      V22_WIKISYNC_LAST_ERROR: '',
      V22_WIKISYNC_UPDATED_LEVELS: String(changedLevels),
      V22_WIKISYNC_COMPLETED_QUESTS: String(newlyCompleted)
    });
    SpreadsheetApp.flush();
    return {ok:true,message:'Live levels and quest states updated.',updatedLevels:changedLevels,completedQuests:newlyCompleted,newlyCompletedQuests:newlyCompletedNames,state:getV300DashboardShellState()};
  } catch (e) {
    props.setProperty('V22_WIKISYNC_LAST_ERROR', String(e && e.message ? e.message : e));
    return {ok:false,message:String(e && e.message ? e.message : e),state:getV300DashboardShellState()};
  } finally { lock.releaseLock(); }
}

function v274CanonicalGoalName_(name) {
  return String(name || '').trim() === 'Transportation' ? 'Core Transportation Network' : String(name || '').trim();
}
function v274StoredGoalName_(name) {
  return String(name || '').trim() === 'Core Transportation Network' ? 'Transportation' : String(name || '').trim();
}

function getV1DashboardState(options) {
  options = options || {};
  try{ensureV285GameDataPlatform_()}catch(e){console.warn('V2.80 game-data bootstrap deferred: '+e.message)}
  try{ensureV286AccuracyMonitor_()}catch(e){console.warn('V2.86 accuracy monitor bootstrap deferred: '+e.message)}
  try{ensureV287EquipmentKnowledge_()}catch(e){console.warn('V2.87 equipment knowledge bootstrap deferred: '+e.message)}
  // V1.22: interactive reads never block on a Quest Helper network sync.
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const statsSheet = ss.getSheetByName('Your Stats');
  const goalsSheet = ss.getSheetByName('Goal Registry');
  const shoppingSheet = ss.getSheetByName('Route Shopping');
  const reconciledSheet = ss.getSheetByName('Quest Prep Reconciled');
  const questDependencySheet = ss.getSheetByName('Quest Dependency');
  const questDisplayMeta = readV129QuestDisplayMeta_(ss.getSheetByName('Wiki Cache'));
  const questMeta = readV122QuestMeta_(questDependencySheet);
  const rewardMap = questMeta.rewards;
  const requirementIntel = questMeta.requirements;
  const goalRows = goalsSheet.getRange('A5:P200').getDisplayValues().filter(r => r[0]);
  const activeGoalName = v274CanonicalGoalName_(dash.getRange('B3').getDisplayValue());
  const activeGoalRow = goalRows.find(r => v274CanonicalGoalName_(r[0]).toLowerCase() === activeGoalName.toLowerCase());

  const topRows = dash.getRange('A5:F10').getDisplayValues().slice(1).filter(r => r[1]);
  const blockedRows = dash.getRange('A13:F21').getDisplayValues().slice(1).filter(r => r[0]);
  const allOrderedBlockedQuests = readV134OrderedBlockedQuests_(blockedRows, questDependencySheet);
  const goalBlockerScope = readV281GoalScopedBlockers_(allOrderedBlockedQuests, questDependencySheet, activeGoalName, activeGoalRow && activeGoalRow[2]);
  let orderedBlockedQuests = goalBlockerScope.blockers;
  let grindRows = dash.getRange('A36:I44').getDisplayValues().slice(1).filter(r => r[0]).filter(r => !goalBlockerScope.scoped || goalBlockerScope.questKeys[v281QuestScopeKey_(r[0])]);
  const routeRows = dash.getRange('A60:H69').getDisplayValues().filter(r => r[1]);
  const nextRows = dash.getRange('A73:B80').getDisplayValues();

  const statsRows = statsSheet.getRange('A3:H26').getDisplayValues().filter(r => r[0]);
  const accountRows = statsSheet.getRange('A30:D35').getDisplayValues().filter(r => r[0]);
  let blockerSkillTargets = readV134BlockerSkillTargets_(orderedBlockedQuests, requirementIntel, statsRows);
  const questLibrary = readV134QuestLibrary_(questDependencySheet, questDisplayMeta);
  const relevantHealthQuests = new Set([].concat(
    topRows.map(r=>String(r[1]||'').toLowerCase()),
    orderedBlockedQuests.map(r=>String(r.quest||'').toLowerCase()),
    routeRows.map(r=>String(r[1]||'').toLowerCase())
  ));
  const wikiReviewQueue = (questLibrary.quests||[]).filter(q=>q.needsReview).map(q=>({name:q.name,status:q.wikiStatus,reason:q.reviewReason,lastVerified:q.lastVerified,wikiUrl:q.wikiUrl,relevant:relevantHealthQuests.has(q.name.toLowerCase()),storedRevision:q.storedRevision,latestRevision:q.latestRevision,acknowledged:q.alertAcknowledged}));
  const account = {};
  accountRows.forEach(r => account[r[0]] = r[1]);

  const allGoals = goalRows.map(r => ({name:v274CanonicalGoalName_(r[0]), type:r[1], anchor:r[2], line:r[3], notes:r[14], status:r[15]||'ACTIVE'}));
  const goals = allGoals.filter(g => g.name === 'Balanced' || !/^accomplished$/i.test(g.status));
  const accomplishedGoals = allGoals.filter(g => g.name !== 'Balanced' && /^accomplished$/i.test(g.status));
  const computedGoalProgress = readV131GoalProgress_(ss, allGoals, statsRows, account, requirementIntel, routeRows, questDisplayMeta, options.mapGoal);
  if(goalBlockerScope.scoped&&!orderedBlockedQuests.length){
    orderedBlockedQuests=readV281ActionPlanBlockers_(computedGoalProgress[activeGoalName.toLowerCase()],requirementIntel,statsRows);
    blockerSkillTargets=readV134BlockerSkillTargets_(orderedBlockedQuests,requirementIntel,statsRows);
  }

  const summary = {
    objective: dash.getRange('J3').getDisplayValue() || dash.getRange('B3').getDisplayValue(),
    status: dash.getRange('J4').getDisplayValue(),
    missingSkills: dash.getRange('J5').getDisplayValue(),
    prerequisites: dash.getRange('J6').getDisplayValue(),
    effect: dash.getRange('J7').getDisplayValue()
  };

  const nextSession = {};
  nextRows.forEach(r => { if (r[0]) nextSession[r[0]] = r[1]; });
  const bosses=readV128BossPlanner_(ss,statsRows),bossProgress=readV132BossProgress_();

  const wikiSync = v22WikiSyncMeta_();
  return {
    username: account.Username || 'Sensum',
    combatLevel: account['Combat Level'] || '',
    questPoints: account['Quest Points'] || '',
    lastWomSnapshot: account['Last WOM Snapshot'] || '',
    lastSheetSync: account['Last Sheet Sync'] || '',
    goal: v274CanonicalGoalName_(dash.getRange('B3').getDisplayValue()),
    routeDepth: Number(getRouteDepthValue_(dash) || 10),
    goals,
    accomplishedGoals,
    goalProgress: computedGoalProgress,
    bosses: bosses,
    bossGuides: v132BossGuides_(),
    bossLoadouts: V132B_WIKI_LOADOUTS,
    bossItemImages: V132B_ITEM_IMAGES,
    bossProgress: bossProgress,
    achievements: readV133Achievements_(ss,statsRows,account,allGoals,bosses,bossProgress),
    goalSummary: summary,
    topQuests: topRows.map(r => ({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null})),
    blockedQuests: orderedBlockedQuests,
    blockerSkillTargets: blockerSkillTargets,
    questLibrary: questLibrary,
    dataHealthContext:{reviewQueue:wikiReviewQueue,relevantReviews:wikiReviewQueue.filter(q=>q.relevant).length,totalReviews:wikiReviewQueue.length},
    skillGrinds: grindRows.map(r => ({quest:r[0],missingSkills:r[1],xp:r[2],fast:r[3],value:r[4],afk:r[5],downstream:r[6],score:r[7],efficiency:r[8]})),
    route: routeRows.map(r => ({step:r[0],quest:r[1],score:r[2],blocker:r[3],currentHours:r[4],xpCredit:r[5],afterHours:r[6],projectedQp:r[7]})),
    nextSession,
    stats: statsRows.map(r => {
      const level = Number(r[1] || 1), womXp = Math.max(0, Number(String(r[7] || 0).replace(/,/g,'')) || 0), floorXp = v22XpFloorForLevel_(level);
      const floorActive = floorXp > womXp;
      return {skill:r[0],level:r[1],xp:floorActive?floorXp:womXp,womXp:womXp,nextXp:r[5],xpExact:!floorActive,xpSource:floorActive?'Level floor':'WOM verified'};
    }),
    shopping: readV1Shopping_(shoppingSheet, reconciledSheet),
    requirementIntel,
    questDisplayMeta,
    planningMode:'Base levels only',
    wikiHealth: readV1WikiHealth_(dash),
    wikiSync: wikiSync,
    gameDataStatus:getV285GameDataStatus(),
    trainingIntelligence:null
  };
}

function getV300DashboardShellState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),dash=ss.getSheetByName('Dashboard'),statsSheet=ss.getSheetByName('Your Stats'),goalsSheet=ss.getSheetByName('Goal Registry');
  const dashboard=dash.getRange('A1:J80').getDisplayValues(),statsBlock=statsSheet.getRange('A3:H35').getDisplayValues(),goalRows=goalsSheet.getRange('A5:P200').getDisplayValues().filter(r=>r[0]);
  const statsRows=statsBlock.slice(0,24).filter(r=>r[0]),account={};statsBlock.slice(27).filter(r=>r[0]).forEach(r=>account[r[0]]=r[1]);
  const activeGoal=v274CanonicalGoalName_(dashboard[2][1]),allGoals=goalRows.map(r=>({name:v274CanonicalGoalName_(r[0]),type:r[1],anchor:r[2],line:r[3],notes:r[14],status:r[15]||'ACTIVE'}));
  const goals=allGoals.filter(g=>g.name==='Balanced'||!/^accomplished$/i.test(g.status)),accomplishedGoals=allGoals.filter(g=>g.name!=='Balanced'&&/^accomplished$/i.test(g.status));
  const shell={module:'shell',shellVersion:'V3.00',deferredAudit:true,username:account.Username||'Sensum',combatLevel:account['Combat Level']||'',questPoints:account['Quest Points']||'',lastWomSnapshot:account['Last WOM Snapshot']||'',lastSheetSync:account['Last Sheet Sync']||'',goal:activeGoal,routeDepth:Number(getRouteDepthValue_(dash)||10),goals:goals,accomplishedGoals:accomplishedGoals,goalProgress:{},bosses:[],bossGuides:[],bossLoadouts:{},bossItemImages:{},bossProgress:{},achievements:{summary:{},upcoming:[],timeline:[]},goalSummary:{objective:dashboard[2][9]||activeGoal,status:dashboard[3][9]||'',missingSkills:dashboard[4][9]||'',prerequisites:dashboard[5][9]||'',effect:dashboard[6][9]||''},topQuests:[],blockedQuests:[],blockerSkillTargets:{targets:[],met:[]},questLibrary:{quests:[]},dataHealthContext:{reviewQueue:[],relevantReviews:0,totalReviews:0},skillGrinds:[],route:[],nextSession:{},stats:statsRows.map(r=>{const level=Number(r[1]||1),womXp=Math.max(0,Number(String(r[7]||0).replace(/,/g,''))||0),floorXp=v22XpFloorForLevel_(level),floorActive=floorXp>womXp;return {skill:r[0],level:r[1],xp:floorActive?floorXp:womXp,womXp:womXp,nextXp:r[5],xpExact:!floorActive,xpSource:floorActive?'Level floor':'WOM verified'}}),shopping:[],requirementIntel:{},questDisplayMeta:{},planningMode:'Base levels only',wikiHealth:{deferred:true},wikiSync:v22WikiSyncMeta_(),gameDataStatus:{deferred:true},trainingIntelligence:null};
  const cached=v302ReadPlanningSnapshot_(activeGoal);return cached?Object.assign(shell,cached,{module:'shell',__planningLoaded:true}):shell;
}

function v302PlanningCacheKey_(goal){return 'V302_PLAN_'+String(goal||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60)}
function v302ReadPlanningSnapshot_(goal){try{const raw=CacheService.getScriptCache().get(v302PlanningCacheKey_(goal));return raw?JSON.parse(raw):null}catch(e){return null}}
function v302WritePlanningSnapshot_(data){try{const keep={goal:data.goal,goalSummary:data.goalSummary,topQuests:data.topQuests,blockedQuests:data.blockedQuests,blockerSkillTargets:data.blockerSkillTargets,skillGrinds:data.skillGrinds,route:data.route,nextSession:data.nextSession,shopping:data.shopping,planningMode:data.planningMode};CacheService.getScriptCache().put(v302PlanningCacheKey_(data.goal),JSON.stringify(keep),21600)}catch(e){console.warn('Planning snapshot cache deferred: '+e.message)}}

// V3.01: tab modules load their own data after the fast account shell renders.
// Keep this endpoint deliberately small; the Wiki review queue will become its
// own paged module rather than forcing the complete quest library into startup.
function getV301HealthState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),dash=ss.getSheetByName('Dashboard'),statsSheet=ss.getSheetByName('Your Stats');
  const accountRows=statsSheet.getRange('A30:D35').getDisplayValues().filter(r=>r[0]),account={};
  accountRows.forEach(r=>account[r[0]]=r[1]);
  return {module:'health',loadedAt:new Date().toISOString(),lastWomSnapshot:account['Last WOM Snapshot']||'',lastSheetSync:account['Last Sheet Sync']||'',wikiHealth:readV1WikiHealth_(dash),wikiSync:v22WikiSyncMeta_(),dataHealthContext:{reviewQueue:[],relevantReviews:0,totalReviews:0,queueDeferred:true}};
}

// V3.02: planning data for Overview and Tonight. This intentionally excludes
// quest-library cards, bosses, achievements, money, and training intelligence.
function getV302PlanningState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),dash=ss.getSheetByName('Dashboard'),statsSheet=ss.getSheetByName('Your Stats'),goalsSheet=ss.getSheetByName('Goal Registry'),shoppingSheet=ss.getSheetByName('Route Shopping'),reconciledSheet=ss.getSheetByName('Quest Prep Reconciled'),questDependencySheet=ss.getSheetByName('Quest Dependency');
  const dashboard=dash.getRange('A1:J80').getDisplayValues(),statsBlock=statsSheet.getRange('A3:H35').getDisplayValues(),goalRows=goalsSheet.getRange('A5:P200').getDisplayValues().filter(r=>r[0]);
  const statsRows=statsBlock.slice(0,24).filter(r=>r[0]),account={};statsBlock.slice(27).filter(r=>r[0]).forEach(r=>account[r[0]]=r[1]);
  const questDisplayMeta=readV129QuestDisplayMeta_(ss.getSheetByName('Wiki Cache')),questMeta=readV122QuestMeta_(questDependencySheet),rewardMap=questMeta.rewards,requirementIntel=questMeta.requirements;
  const activeGoalName=v274CanonicalGoalName_(dashboard[2][1]),activeGoalRow=goalRows.find(r=>v274CanonicalGoalName_(r[0]).toLowerCase()===activeGoalName.toLowerCase());
  const topRows=dashboard.slice(4,10).slice(1).filter(r=>r[1]),blockedRows=dashboard.slice(12,21).slice(1).filter(r=>r[0]),allOrderedBlockedQuests=readV134OrderedBlockedQuests_(blockedRows,questDependencySheet),goalBlockerScope=readV281GoalScopedBlockers_(allOrderedBlockedQuests,questDependencySheet,activeGoalName,activeGoalRow&&activeGoalRow[2]);
  let orderedBlockedQuests=goalBlockerScope.blockers,grindRows=dashboard.slice(35,44).slice(1).filter(r=>r[0]).filter(r=>!goalBlockerScope.scoped||goalBlockerScope.questKeys[v281QuestScopeKey_(r[0])]);
  const routeRows=dashboard.slice(59,69).filter(r=>r[1]),nextRows=dashboard.slice(72,80),allGoals=goalRows.map(r=>({name:v274CanonicalGoalName_(r[0]),type:r[1],anchor:r[2],line:r[3],notes:r[14],status:r[15]||'ACTIVE'}));
  const computedGoalProgress=readV131GoalProgress_(ss,allGoals,statsRows,account,requirementIntel,routeRows,questDisplayMeta);
  let blockerSkillTargets=readV134BlockerSkillTargets_(orderedBlockedQuests,requirementIntel,statsRows);
  if(goalBlockerScope.scoped&&!orderedBlockedQuests.length){orderedBlockedQuests=readV281ActionPlanBlockers_(computedGoalProgress[activeGoalName.toLowerCase()],requirementIntel,statsRows);blockerSkillTargets=readV134BlockerSkillTargets_(orderedBlockedQuests,requirementIntel,statsRows)}
  const nextSession={};nextRows.forEach(r=>{if(r[0])nextSession[r[0]]=r[1]});
  const result={module:'planning',loadedAt:new Date().toISOString(),goal:activeGoalName,goalProgress:computedGoalProgress,goalSummary:{objective:dashboard[2][9]||activeGoalName,status:dashboard[3][9]||'',missingSkills:dashboard[4][9]||'',prerequisites:dashboard[5][9]||'',effect:dashboard[6][9]||''},topQuests:topRows.map(r=>({rank:r[0],quest:r[1],score:r[2],tier:r[3],downstream:r[4],why:r[5],rewards:rewardMap[String(r[1]||'').trim().toLowerCase()]||null})),blockedQuests:orderedBlockedQuests,blockerSkillTargets:blockerSkillTargets,skillGrinds:grindRows.map(r=>({quest:r[0],missingSkills:r[1],xp:r[2],fast:r[3],value:r[4],afk:r[5],downstream:r[6],score:r[7],efficiency:r[8]})),route:routeRows.map(r=>({step:r[0],quest:r[1],score:r[2],blocker:r[3],currentHours:r[4],xpCredit:r[5],afterHours:r[6],projectedQp:r[7]})),nextSession:nextSession,shopping:readV1Shopping_(shoppingSheet,reconciledSheet),requirementIntel:requirementIntel,questDisplayMeta:questDisplayMeta,planningMode:'Base levels only'};v302WritePlanningSnapshot_(result);return result;
}

function getV303QuestState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),dependency=ss.getSheetByName('Quest Dependency'),displayMeta=readV129QuestDisplayMeta_(ss.getSheetByName('Wiki Cache')),meta=readV122QuestMeta_(dependency),library=readV134QuestLibrary_(dependency,displayMeta);
  const queue=(library.quests||[]).filter(q=>q.needsReview).map(q=>({name:q.name,status:q.wikiStatus,reason:q.reviewReason,lastVerified:q.lastVerified,wikiUrl:q.wikiUrl,relevant:false,storedRevision:q.storedRevision,latestRevision:q.latestRevision,acknowledged:q.alertAcknowledged}));
  return {module:'quests',loadedAt:new Date().toISOString(),questLibrary:library,requirementIntel:meta.requirements,questDisplayMeta:displayMeta,dataHealthContext:{reviewQueue:queue,relevantReviews:0,totalReviews:queue.length}};
}

// V3.04: Achievements and the complete goal catalog are an on-demand module.
// Nothing here runs during shell startup, and the response deliberately omits
// planning tables, quest-library cards, money journals, and training data.
function getV304ProgressState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),statsSheet=ss.getSheetByName('Your Stats'),goalsSheet=ss.getSheetByName('Goal Registry'),dependency=ss.getSheetByName('Quest Dependency'),dash=ss.getSheetByName('Dashboard');
  const statsBlock=statsSheet.getRange('A3:H35').getDisplayValues(),statsRows=statsBlock.slice(0,24).filter(r=>r[0]),account={};
  statsBlock.slice(27).filter(r=>r[0]).forEach(r=>account[r[0]]=r[1]);
  const goalRows=goalsSheet.getRange('A5:P200').getDisplayValues().filter(r=>r[0]),allGoals=goalRows.map(r=>({name:v274CanonicalGoalName_(r[0]),type:r[1],anchor:r[2],line:r[3],notes:r[14],status:r[15]||'ACTIVE'}));
  const goals=allGoals.filter(g=>g.name==='Balanced'||!/^accomplished$/i.test(g.status)),accomplishedGoals=allGoals.filter(g=>g.name!=='Balanced'&&/^accomplished$/i.test(g.status));
  const questDisplayMeta=readV129QuestDisplayMeta_(ss.getSheetByName('Wiki Cache')),requirementIntel=readV122QuestMeta_(dependency).requirements,routeRows=dash.getRange('A60:H69').getDisplayValues().filter(r=>r[1]);
  const bosses=readV128BossPlanner_(ss,statsRows),bossProgress=readV132BossProgress_();
  return {module:'progress',loadedAt:new Date().toISOString(),goals:goals,accomplishedGoals:accomplishedGoals,goalProgress:readV131GoalProgress_(ss,allGoals,statsRows,account,requirementIntel,routeRows,questDisplayMeta),achievements:readV133Achievements_(ss,statsRows,account,allGoals,bosses,bossProgress)};
}

// V3.05: Boss readiness, guides, equipment tables, images, and checklist
// progress load only when the Bosses workspace is opened.
function getV305BossState(){
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),statsSheet=ss.getSheetByName('Your Stats');
  const statsRows=statsSheet.getRange('A3:H26').getDisplayValues().filter(r=>r[0]);
  return {module:'bosses',loadedAt:new Date().toISOString(),bosses:readV128BossPlanner_(ss,statsRows),bossGuides:v132BossGuides_(),bossLoadouts:V132B_WIKI_LOADOUTS,bossItemImages:V132B_ITEM_IMAGES,bossProgress:readV132BossProgress_()};
}

// V3.06: Interactive training uses the verified local catalogs. Network and
// catalog maintenance are intentionally excluded from the user request path.
function getV306TrainingState(skill,objective){
  skill=String(skill||'Strength');objective=String(objective||'overall');
  if(['Strength','Attack','Defence'].indexOf(skill)<0)throw new Error('Unsupported training skill.');
  if(['overall','fastest','afk','cheapest'].indexOf(objective)<0)throw new Error('Unsupported training priority.');
  return {module:'training',loadedAt:new Date().toISOString(),trainingIntelligence:getV296TrainingRecommendations(skill,objective)};
}

function getV300EmergencyState(){return {shellVersion:'V3.00b',recoveryMode:true,username:'Sensum',combatLevel:'',questPoints:'',lastWomSnapshot:'',lastSheetSync:'',goal:'',routeDepth:3,goals:[],accomplishedGoals:[],goalProgress:{},bosses:[],bossGuides:[],bossLoadouts:{},bossItemImages:{},bossProgress:{},achievements:{summary:{},upcoming:[],timeline:[]},goalSummary:{objective:'Data temporarily unavailable',status:'Recovery mode',missingSkills:'',prerequisites:'',effect:''},topQuests:[],blockedQuests:[],blockerSkillTargets:{targets:[],met:[]},questLibrary:{quests:[]},dataHealthContext:{reviewQueue:[],relevantReviews:0,totalReviews:0},skillGrinds:[],route:[],nextSession:{},stats:[],shopping:[],requirementIntel:{},questDisplayMeta:{},planningMode:'Base levels only',wikiHealth:{error:'Spreadsheet service recovery in progress'},wikiSync:{lastError:'Spreadsheet service recovery in progress'},gameDataStatus:{deferred:true},trainingIntelligence:null}}

// V2.81: quest-anchored goals own their blocker scope. The selected anchor and
// its complete prerequisite ancestry are the only quests allowed into the
// blocker table and its training-detour companion. Roadmap modes remain broad.
function v281QuestScopeKey_(name){return String(name||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'')}
function readV281ActionPlanBlockers_(progress,requirementIntel,statsRows){
  const levels={};(statsRows||[]).forEach(r=>levels[String(r[0]||'').trim().toLowerCase()]=Number(r[1]||0));
  const grouped={};(progress&&progress.actionPlan||[]).filter(step=>step.kind==='TRAIN'&&step.quest).forEach(step=>{const quest=String(step.quest||'').trim(),key=quest.toLowerCase();if(!grouped[key])grouped[key]={quest:quest,trains:[]};grouped[key].trains.push(step)});
  return Object.keys(grouped).map(key=>{const row=grouped[key],req=(requirementIntel||{})[key],requirements=(req&&req.requiredSkills)||[],missing=requirements.filter(x=>Number(levels[String(x.skill||'').toLowerCase()]||0)<Number(x.level||0)).map(x=>{const current=Number(levels[String(x.skill||'').toLowerCase()]||0),target=Number(x.level||0);return `${x.skill} ${current} to ${target} (+${target-current})`});if(!missing.length)missing=row.trains.map(x=>`${x.skill} ${x.current} to ${x.target} (+${Number(x.target||0)-Number(x.current||0)})`);return {quest:row.quest,score:'—',downstream:'—',blockedBy:'Skills',missingSkills:missing.join('; ')||'Review required training step',hours:''}});
}
function readV281GoalScopedBlockers_(blockers, dependencySheet, goalName, goalAnchor) {
  const name=String(goalName||'').trim(),fallbackAnchors={'fairy rings':'Fairytale II - Cure a Queen','fossil island access':'Bone Voyage','barrows gloves / rfd':'Recipe for Disaster','ancient magicks':'Desert Treasure I','lunar spellbook':'Lunar Diplomacy','darkmeyer access':'Sins of the Father','tombs of amascut access':'Beneath Cursed Sands','dragon slayer ii':'Dragon Slayer II','prifddinas':'Song of the Elves'},anchor=String(fallbackAnchors[name.toLowerCase()]||goalAnchor||'').trim();
  if(!anchor||/^balanced$/i.test(name)||!dependencySheet)return {blockers:blockers||[],questKeys:{},scoped:false};
  const values=dependencySheet.getDataRange().getDisplayValues();let header=-1,headers=[];
  for(let i=0;i<Math.min(values.length,12);i++){const row=values[i].map(x=>String(x||'').trim());if(row.some(x=>/^quest name$/i.test(x))&&row.some(x=>/^direct prior quest requirement\(s\)$/i.test(x))){header=i;headers=row;break}}
  if(header<0)return {blockers:blockers||[],questKeys:{},scoped:false};
  const column=rx=>headers.findIndex(x=>rx.test(x)),qCol=column(/^quest name$/i),pCol=column(/^direct prior quest requirement\(s\)$/i),completedCol=column(/^completed$/i),readyCol=column(/^ready now\?$/i),scoreCol=column(/^goal profile score$/i),balancedCol=column(/^balanced priority score$/i),downstreamCol=column(/^total downstream unlocks$/i),gapCol=column(/^skill gap summary$/i),hoursCol=column(/^best value hours$/i);
  if(qCol<0||pCol<0)return {blockers:blockers||[],questKeys:{},scoped:false};
  const rows=values.slice(header+1).filter(r=>String(r[qCol]||'').trim()),names=rows.map(r=>String(r[qCol]||'').trim()).sort((a,b)=>b.length-a.length),byName={};
  rows.forEach(r=>{const quest=String(r[qCol]||'').trim(),raw=String(r[pCol]||'').toLowerCase();byName[v281QuestScopeKey_(quest)]={quest:quest,prereqs:names.filter(x=>x.toLowerCase()!==quest.toLowerCase()&&raw.indexOf(x.toLowerCase())>=0),complete:completedCol>=0&&/^(yes|true|complete|completed)$/i.test(String(r[completedCol]||'').trim()),ready:readyCol>=0&&/^(yes|true|ready)$/i.test(String(r[readyCol]||'').trim()),score:String((scoreCol>=0?r[scoreCol]:'')||(balancedCol>=0?r[balancedCol]:'')||''),downstream:String(downstreamCol>=0?r[downstreamCol]:''),missingSkills:String(gapCol>=0?r[gapCol]:'').trim()||'None',hours:String(hoursCol>=0?r[hoursCol]:'')}});
  const allowed={},ordered=[],visit=quest=>{const scopeKey=v281QuestScopeKey_(quest),rec=byName[scopeKey];if(!scopeKey||allowed[scopeKey])return;allowed[scopeKey]=true;((rec&&rec.prereqs)||[]).forEach(visit);ordered.push(scopeKey)};visit(anchor);
  const scoped=ordered.map(key=>byName[key]).filter(Boolean).filter(rec=>{const missingPrereqs=rec.prereqs.filter(q=>{const p=byName[v281QuestScopeKey_(q)];return p&&!p.complete});const skillBlocked=rec.missingSkills&&!/^(?:none|ready|none\s*[—-]\s*ready now)$/i.test(rec.missingSkills);rec.blockedBy=missingPrereqs.length?missingPrereqs.map(q=>(byName[v281QuestScopeKey_(q)]||{}).quest||q).join('; '):skillBlocked?'Skills':'Ready now';return !rec.complete&&rec.blockedBy!=='Ready now'}).map(rec=>({quest:rec.quest,score:rec.score,downstream:rec.downstream,blockedBy:rec.blockedBy,missingSkills:rec.missingSkills,hours:rec.hours}));
  return {blockers:scoped.slice(0,20),questKeys:allowed,scoped:true,anchor:anchor};
}

// V1.34: preserve the dashboard ranking wherever possible, but never place a
// blocked quest before one of its displayed prerequisites. The Blocked By
// value also names the actual unfinished prerequisite quests.
function readV134OrderedBlockedQuests_(blockedRows, dependencySheet) {
  const base = (blockedRows || []).map((r, index) => ({
    quest:r[0], score:r[1], downstream:r[2], blockedBy:r[3],
    missingSkills:r[4], hours:r[5], _index:index
  }));
  if (!dependencySheet || !base.length) return base.map(v134PublicBlocker_);

  const values = dependencySheet.getDataRange().getDisplayValues();
  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(values.length, 12); i++) {
    const row = values[i].map(x => String(x || '').trim());
    if (row.some(x => /^quest name$/i.test(x)) && row.some(x => /^direct prior quest requirement\(s\)$/i.test(x))) {
      headerRow = i; headers = row; break;
    }
  }
  if (headerRow < 0) return base.map(v134PublicBlocker_);

  const column = rx => headers.findIndex(x => rx.test(x));
  const questCol = column(/^quest name$/i);
  const prereqCol = column(/^direct prior quest requirement\(s\)$/i);
  const completedCol = column(/^completed$/i);
  const readyCol = column(/^ready now\?$/i);
  const downstreamCol = column(/^total downstream unlocks$/i);
  const balancedScoreCol = column(/^balanced priority score$/i);
  const goalScoreCol = column(/^goal profile score$/i);
  const gapCol = column(/^skill gap summary$/i);
  const hoursCol = column(/^best value hours$/i);
  if (questCol < 0 || prereqCol < 0) return base.map(v134PublicBlocker_);

  const records = values.slice(headerRow + 1).filter(r => String(r[questCol] || '').trim());
  const names = records.map(r => String(r[questCol] || '').trim()).sort((a,b) => b.length - a.length);
  const byName = {};
  records.forEach(r => {
    const quest = String(r[questCol] || '').trim();
    const source = String(r[prereqCol] || '').trim();
    const prereqs = names.filter(name => name.toLowerCase() !== quest.toLowerCase() &&
      source.toLowerCase().indexOf(name.toLowerCase()) >= 0);
    byName[quest.toLowerCase()] = {
      quest:quest,
      prereqs:prereqs,
      complete:completedCol >= 0 && /^(yes|true|complete|completed)$/i.test(String(r[completedCol] || '').trim()),
      ready:readyCol >= 0 && /^(yes|true|ready)$/i.test(String(r[readyCol] || '').trim()),
      score:String((goalScoreCol >= 0 ? r[goalScoreCol] : '') || (balancedScoreCol >= 0 ? r[balancedScoreCol] : '') || '').trim(),
      downstream:String(r[downstreamCol] || '').trim(),
      missingSkills:String(r[gapCol] || '').trim() || 'None',
      hours:String(r[hoursCol] || '').trim()
    };
  });

  // The Dashboard range can contain high-scoring quests that are ready now.
  // Supplement it from the complete dependency dataset so removing ready rows
  // never leaves real goal blockers hidden. Only positive-score, unfinished,
  // genuinely blocked quests qualify for the 20-quest working set.
  const initiallyIncluded = {};
  base.forEach(item=>initiallyIncluded[String(item.quest||'').toLowerCase()]=true);
  Object.values(byName).filter(rec=>{
    const missingPrereq=rec.prereqs.some(name=>!(byName[name.toLowerCase()]||{}).complete);
    const skillBlocked=rec.missingSkills&&!/^(?:none|ready|none\s*[—-]\s*ready now)$/i.test(String(rec.missingSkills).trim());
    return !rec.complete&&(readyCol>=0?!rec.ready:(missingPrereq||skillBlocked))&&!initiallyIncluded[rec.quest.toLowerCase()];
  }).sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.downstream||0)-Number(a.downstream||0)||a.quest.localeCompare(b.quest)).slice(0,20).forEach(rec=>{
    base.push({quest:rec.quest,score:rec.score,downstream:rec.downstream,blockedBy:'',missingSkills:rec.missingSkills,hours:rec.hours,_index:base.length});
    initiallyIncluded[rec.quest.toLowerCase()]=true;
  });

  // The Dashboard sheet only supplies its eight highest-ranked blockers. Add
  // every unfinished ancestor needed by those quests so the table can show a
  // complete, actionable quest chain instead of merely naming hidden rows.
  const included = {};
  base.forEach(item => included[String(item.quest || '').toLowerCase()] = true);
  let nextIndex = base.length;
  function includeMissingAncestors(questKey, visiting) {
    const rec = byName[questKey];
    if (!rec || visiting[questKey]) return;
    const path = Object.assign({}, visiting); path[questKey] = true;
    rec.prereqs.forEach(name => {
      const key = name.toLowerCase(), prereq = byName[key];
      if (!prereq || prereq.complete) return;
      includeMissingAncestors(key, path);
      if (!included[key]) {
        base.push({
          quest:prereq.quest, score:prereq.score, downstream:prereq.downstream,
          blockedBy:'Quest prerequisite', missingSkills:prereq.missingSkills,
          hours:prereq.hours, _index:nextIndex++
        });
        included[key] = true;
      }
    });
  }
  base.slice().forEach(item => includeMissingAncestors(String(item.quest || '').toLowerCase(), {}));

  base.forEach(item => {
    const rec = byName[String(item.quest || '').toLowerCase()];
    if (!rec) return;
    const missing = rec.prereqs.filter(name => !(byName[name.toLowerCase()] || {}).complete);
    if (missing.length) item.blockedBy = missing.join('; ');
    else if (item.missingSkills && !/^(?:none|ready|none\s*[—-]\s*ready now)$/i.test(String(item.missingSkills).trim())) item.blockedBy = 'Skills';
    else if (readyCol >= 0 && !rec.ready) { item.blockedBy = 'Requirements'; item.missingSkills = 'Review unmet quest requirements'; }
    else item.blockedBy = 'Ready now';
  });

  // Stable topological sort: dependency constraints win; unrelated quests
  // retain their existing score-based dashboard order.
  const displayed = {};
  base.forEach((item, i) => displayed[String(item.quest || '').toLowerCase()] = i);
  const indegree = base.map(() => 0), outgoing = base.map(() => []);
  base.forEach((item, i) => {
    const rec = byName[String(item.quest || '').toLowerCase()];
    (rec ? rec.prereqs : []).forEach(name => {
      const parent = displayed[name.toLowerCase()];
      if (parent === undefined || parent === i) return;
      indegree[i]++;
      outgoing[parent].push(i);
    });
  });
  const ready = base.map((_, i) => i).filter(i => indegree[i] === 0).sort((a,b) => base[a]._index - base[b]._index);
  const ordered = [];
  while (ready.length) {
    const current = ready.shift();
    ordered.push(base[current]);
    outgoing[current].forEach(next => {
      indegree[next]--;
      if (indegree[next] === 0) {
        ready.push(next);
        ready.sort((a,b) => base[a]._index - base[b]._index);
      }
    });
  }
  if (ordered.length !== base.length) return base.filter(item=>item.blockedBy!=='Ready now').slice(0,20).map(v134PublicBlocker_);
  return ordered.filter(item=>item.blockedBy!=='Ready now').slice(0,20).map(v134PublicBlocker_);
}

function v134PublicBlocker_(item) {
  return {quest:item.quest,score:item.score,downstream:item.downstream,blockedBy:item.blockedBy,missingSkills:item.missingSkills,hours:item.hours};
}

function readV134BlockerSkillTargets_(blockedQuests, requirementIntel, statsRows) {
  const levels = {};
  (statsRows || []).forEach(r => levels[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  const targets = {};
  (blockedQuests || []).forEach(q => {
    const quest = String(q.quest || '').trim();
    const req = (requirementIntel || {})[quest.toLowerCase()];
    (req && req.requiredSkills ? req.requiredSkills : []).forEach(skillReq => {
      const skill = String(skillReq.skill || '').trim(), key = skill.toLowerCase(), target = Number(skillReq.level || 0);
      if (!skill || !target) return;
      if (!targets[key] || target > targets[key].target) targets[key] = {skill:skill,target:target,quests:[quest]};
      else if (target === targets[key].target && targets[key].quests.indexOf(quest) < 0) targets[key].quests.push(quest);
    });
  });
  const all = Object.keys(targets).map(key => {
    const item = targets[key], current = Number(levels[key] || 0);
    return {skill:item.skill,current:current,target:item.target,gap:Math.max(0,item.target-current),quests:item.quests};
  });
  all.sort((a,b) => (b.gap-a.gap) || (b.target-a.target) || a.skill.localeCompare(b.skill));
  const unmet = all.filter(x => x.gap > 0), met = all.filter(x => x.gap <= 0);
  return {
    unmet:unmet,
    met:met,
    totalSkills:all.length,
    unmetCount:unmet.length,
    largestGap:unmet.length ? {skill:unmet[0].skill,gap:unmet[0].gap,target:unmet[0].target} : null,
    planningMode:'Base levels only'
  };
}

function readV134QuestLibrary_(sh, displayMeta) {
  if (!sh || sh.getLastRow() < 2) return {quests:[],audit:{current:0,review:0,total:0}};
  const values = sh.getDataRange().getDisplayValues();
  let hr = -1, headers = [];
  for (let i=0;i<Math.min(values.length,12);i++) {
    const row=values[i].map(x=>String(x||'').trim());
    if (row.some(x=>/^quest name$/i.test(x))) {hr=i;headers=row;break;}
  }
  if (hr < 0) return {quests:[],audit:{current:0,review:0,total:0}};
  const col = rx => headers.findIndex(x => rx.test(x));
  const q=col(/^quest name$/i),completed=col(/^completed$/i),qp=col(/^quest points reward$/i),xp=col(/^xp rewards$/i),items=col(/^item \/ coin rewards$/i),unlocks=col(/^unlocks \/ other rewards$/i);
  const ready=col(/^ready now\?$/i),downstream=col(/^total downstream unlocks$/i),score=col(/^goal profile score$/i),why=col(/^goal profile why$/i),gap=col(/^skill gap summary$/i);
  const url=col(/^wiki url$/i),stored=col(/^wiki stored revision$/i),latest=col(/^wiki latest revision$/i),checked=col(/^wiki last checked$/i),status=col(/^wiki status$/i),recon=col(/^wiki reconciliation$/i);
  const clean = v => { const s=String(v||'').trim(); return (!s||/^none listed$/i.test(s))?'':s; };
  const quests = [],acknowledgements=v239WikiAcknowledgements_();
  values.slice(hr+1).forEach(r => {
    const name=q>=0?String(r[q]||'').trim():''; if(!name)return;
    const xpText=clean(r[xp]), itemText=clean(r[items]), unlockText=clean(r[unlocks]), combined=(xpText+' '+itemText+' '+unlockText).toLowerCase();
    const xpParts=xpText?xpText.split(/\s*;\s*/).filter(Boolean):[],rewardXp={guaranteed:[],selectable:[],during:[],postQuest:[]};
    xpParts.forEach(part=>{
      if(/during (?:the )?quest|additional .* during/i.test(part))rewardXp.during.push(part);
      else if(/claim from|historian|minas|first chromium|after (?:the )?quest|post[- ]quest/i.test(part))rewardXp.postQuest.push(part);
      else if(/selectable|choice|choosing|any skill|random combat/i.test(part))rewardXp.selectable.push(part);
      else rewardXp.guaranteed.push(part);
    });
    const categories=[];
    if(xpText)categories.push('xp');
    if(rewardXp.guaranteed.length)categories.push('guaranteed');
    if(rewardXp.selectable.length||/\blamp\b|\btome\b/i.test(itemText))categories.push('selectable');
    if(rewardXp.during.length)categories.push('during');
    if(rewardXp.postQuest.length)categories.push('postquest');
    if(itemText)categories.push('items');
    if(Number(r[qp]||0)>0)categories.push('qp');
    if(/teleport|transport|boat|glider|fairy ring|spirit tree|minecart|passage|shortcut|travel/i.test(unlockText))categories.push('transport');
    if(/spellbook|spell|magick|magic/i.test(unlockText))categories.push('spellbooks');
    if(itemText||/armour|armor|weapon|staff|sword|shield|helm|glove|cape|bow/i.test(unlockText))categories.push('equipment');
    if(/access|area|guild|dungeon|island|city|camp|mine|zone/i.test(unlockText))categories.push('areas');
    if(/nightmare zone|boss|vorkath|zulrah|barrelchest|fight/i.test(unlockText))categories.push('bosses');
    const wikiStatus=status>=0?String(r[status]||'').trim():'';
    const reconciliation=recon>=0?String(r[recon]||'').trim():'';
    const needsReview=!!((stored>=0&&latest>=0&&String(r[stored]||'')!==String(r[latest]||''))||!/^current$/i.test(wikiStatus)||!/^ok$/i.test(reconciliation));
    if(needsReview)categories.push('audit');
    const meta=(displayMeta||{})[name.toLowerCase()]||{};
    const storedRevision=stored>=0?String(r[stored]||'').trim():'',latestRevision=latest>=0?String(r[latest]||'').trim():'',ack=acknowledgements[name.toLowerCase()]||{};
    const alertAcknowledged=needsReview&&String(ack.revision||'')===latestRevision;
    const reviewReason=storedRevision&&latestRevision&&storedRevision!==latestRevision?'Wiki page revision changed':(!/^ok$/i.test(reconciliation)?'Stored quest data needs reconciliation':(!/^current$/i.test(wikiStatus)?'Wiki cache is not current':'Review requested'));
    quests.push({
      name:name,completed:completed>=0&&/^(yes|true|complete|completed)$/i.test(String(r[completed]||'')),ready:ready>=0&&/^true$/i.test(String(r[ready]||'')),
      qp:Number(r[qp]||0),xp:xpText,items:itemText,unlocks:unlockText,rewardXp:rewardXp,categories:[...new Set(categories)],rewardBreadth:[...new Set(categories.filter(x=>!/^audit$/.test(x)))].length,
      difficulty:meta.difficulty||'',length:meta.length||'',downstream:Number(r[downstream]||0),accountScore:Number(r[score]||0),why:String(r[why]||''),missingSkills:clean(r[gap]),
      wikiUrl:url>=0?String(r[url]||''):'',lastVerified:checked>=0?String(r[checked]||''):'',wikiStatus:wikiStatus||'UNKNOWN',reconciliation:reconciliation||'UNKNOWN',storedRevision:storedRevision,latestRevision:latestRevision,needsReview:needsReview,reviewReason:reviewReason,alertAcknowledged:alertAcknowledged
    });
  });
  quests.sort((a,b)=>b.accountScore-a.accountScore||a.name.localeCompare(b.name));
  const review=quests.filter(x=>x.needsReview).length,pendingAlerts=quests.filter(x=>x.needsReview&&!x.alertAcknowledged).length;
  return {quests:quests,audit:{current:quests.length-review,review:review,pendingAlerts:pendingAlerts,acknowledgedAlerts:review-pendingAlerts,total:quests.length},generatedAt:new Date().toISOString()};
}

function readV131GoalProgress_(ss, goals, statsRows, account, requirementIntel, routeRows, questDisplayMeta, mapGoal) {
  const out = {}, stats = {}, completed = new Set();
  (statsRows || []).forEach(r => stats[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  let table = null;
  try {
    table = v115QuestTable_(ss);
    table.vals.slice(table.headerRow + 1).forEach(r => {
      if (/^(yes|true|complete|completed)$/i.test(String(r[table.cCol] || ''))) completed.add(String(r[table.qCol] || '').trim().toLowerCase());
    });
  } catch (e) {}

  const depSheet = ss.getSheetByName('Quest Dependency'), depRows = depSheet ? depSheet.getDataRange().getDisplayValues() : [];
  let headerRow = -1, headers = [];
  for (let i = 0; i < Math.min(depRows.length, 10); i++) {
    if (depRows[i].some(x => /^quest name$/i.test(String(x || '').trim()))) { headerRow = i; headers = depRows[i]; break; }
  }
  const col = name => headers.findIndex(x => String(x || '').trim().toLowerCase() === name);
  const qCol = col('quest name'), prereqCol = col('direct prior quest requirement(s)'), otherCol = col('other requirements');
  const questInfo = {}, questNames = [];
  if (headerRow >= 0 && qCol >= 0) depRows.slice(headerRow + 1).forEach(r => {
    const name = String(r[qCol] || '').trim();
    if (name) { questNames.push(name); questInfo[name.toLowerCase()] = {prereq:String(r[prereqCol] || ''), other:String(r[otherCol] || '')}; }
  });
  Object.keys(questInfo).forEach(key => {
    const raw = String(questInfo[key].prereq || '').toLowerCase();
    questInfo[key].prereqs = questNames.filter(name => raw.indexOf(name.toLowerCase()) >= 0);
  });
  const questChain = (anchor, includeAnchor) => {
    const ordered = [], seen = new Set();
    const visit = name => {
      const key = String(name || '').toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      ((questInfo[key] && questInfo[key].prereqs) || []).forEach(visit);
      ordered.push(name);
    };
    visit(anchor);
    return includeAnchor === false ? ordered.filter(x => String(x).toLowerCase() !== String(anchor).toLowerCase()) : ordered;
  };
  const pathForQuests = names => {
    const ordered = [], seen = new Set(), skillTargets = {};
    (names || []).forEach(name => questChain(name, true).forEach(q => {
      const key = String(q || '').toLowerCase();
      if (!seen.has(key)) { seen.add(key); ordered.push(q); }
      const req = (requirementIntel || {})[key];
      ((req && req.requiredSkills) || []).forEach(x => {
        const skill = String(x.skill || '').trim(), level = Number(x.level || 0), skillKey = skill.toLowerCase();
        if (skill && level > Number(skillTargets[skillKey] && skillTargets[skillKey].level || 0)) skillTargets[skillKey] = {skill:skill,level:level};
      });
    }));
    const questsDone = ordered.filter(name => completed.has(String(name).toLowerCase())).length;
    const skills = Object.keys(skillTargets).map(key => {
      const target = skillTargets[key], current = Number(stats[key] || 0);
      return {skill:target.skill,current:current,target:target.level,fraction:target.level ? Math.min(1,current/target.level) : 1,met:current >= target.level};
    });
    const skillsMet = skills.filter(x => x.met).length;
    const earned = questsDone + skills.reduce((sum,x)=>sum+x.fraction,0), total = ordered.length + skills.length;
    return {
      percent:total ? Math.round(earned/total*100) : 100,
      questPath:{current:questsDone,target:ordered.length,percent:ordered.length?Math.round(questsDone/ordered.length*100):100,detail:ordered.length?`${questsDone} of ${ordered.length} prerequisite quests complete`:'No prerequisite quests'},
      skillPath:{current:skillsMet,target:skills.length,percent:skills.length?Math.round(skills.reduce((sum,x)=>sum+x.fraction,0)/skills.length*100):100,detail:skills.length?`${skillsMet} of ${skills.length} base-skill targets met`:'No base-skill targets'},
      quests:ordered,skills:skills
    };
  };
  const questActionPlan = (anchor, partialUnlock) => {
    const steps=[],plannedLevels={};
    const chain=questChain(anchor,true);
    chain.forEach(q=>{
      const qKey=String(q||'').toLowerCase(),isAnchor=qKey===String(anchor||'').toLowerCase(),req=(requirementIntel||{})[qKey];
      ((req&&req.requiredSkills)||[]).forEach(x=>{
        const skill=String(x.skill||'').trim(),skillKey=skill.toLowerCase(),target=Number(x.level||0),current=Math.max(Number(stats[skillKey]||0),Number(plannedLevels[skillKey]||0));
        if(skill&&target>current){steps.push({kind:'TRAIN',status:'Train first',title:`Train ${skill}: ${current} → ${target}`,detail:`Mandatory base level for ${q}.`,outcome:`Meets the ${skill} requirement for ${q}.`,current:current,target:target,skill:skill,quest:q,estimate:'Calculated from the active-route training model when available'});plannedLevels[skillKey]=target;}
      });
      if(!completed.has(qKey)&&!(partialUnlock&&isAnchor)){
        const meta=(questDisplayMeta||{})[qKey]||{};
        steps.push({kind:'QUEST',status:'Complete quest',title:`Complete ${q}`,detail:isAnchor?'Final quest for this goal.':'Required before the next quest in this path.',outcome:isAnchor?'Completes the goal and triggers a dashboard recalculation.':'Unlocks the next prerequisite step.',quest:q,length:meta.length||'Unknown length'});
      }
    });
    if(partialUnlock&&!completed.has(String(anchor||'').toLowerCase()))steps.push({kind:'CONFIRM',status:'Manual confirmation',title:'Confirm the partial-quest unlock',detail:'Continue the anchor quest until the documented unlock is received.',outcome:'Marks the finish line only after you confirm it in the dashboard.',quest:anchor,estimate:'Player-confirmed quest stage'});
    return steps;
  };
  const goalDependencyMap = (def, goal, actionPlan, completionPercent) => {
    const nodes=[],edges=[],nodeIds=new Set(),qId=q=>`quest:${String(q||'').toLowerCase()}`,sId=(skill,target,q)=>`skill:${String(skill||'').toLowerCase()}:${target}:${String(q||'').toLowerCase()}`,goalId=`goal:${String(goal.name||'').toLowerCase()}`;
    const addNode=n=>{if(!nodeIds.has(n.id)){nodeIds.add(n.id);nodes.push(n)}};
    const addEdge=(from,to)=>{if(from&&to&&!edges.some(e=>e.from===from&&e.to===to))edges.push({from:from,to:to})};
    let anchors=[];
    if(def.type==='QUEST_COMPLETE'||def.type==='QUEST_PARTIAL_UNLOCK')anchors=[def.anchor];
    else if(def.type==='ALL_CURRENT_QUESTS')anchors=questNames.slice();
    if(anchors.length){
      const included=[],seen=new Set();anchors.forEach(anchor=>questChain(anchor,true).forEach(q=>{const k=String(q).toLowerCase();if(!seen.has(k)){seen.add(k);included.push(q)}}));
      const depthMemo={};
      const qDepth=(q,stack)=>{const k=String(q||'').toLowerCase();if(depthMemo[k]!=null)return depthMemo[k];stack=stack||new Set();if(stack.has(k))return 0;stack.add(k);const ps=((questInfo[k]&&questInfo[k].prereqs)||[]).filter(x=>seen.has(String(x).toLowerCase()));const d=ps.length?Math.max.apply(null,ps.map(x=>qDepth(x,new Set(stack))))+1:1;depthMemo[k]=d;return d};
      included.forEach(q=>{
        const k=String(q).toLowerCase(),info=questInfo[k]||{prereqs:[]},req=(requirementIntel||{})[k],skills=(req&&req.requiredSkills)||[],prereqs=(info.prereqs||[]).filter(x=>seen.has(String(x).toLowerCase())),prereqsDone=prereqs.every(x=>completed.has(String(x).toLowerCase())),skillsMet=skills.every(x=>Number(stats[String(x.skill||'').toLowerCase()]||0)>=Number(x.level||0)),done=completed.has(k),depth=qDepth(q);
        addNode({id:qId(q),kind:'QUEST',label:q,state:done?'completed':prereqsDone&&skillsMet?'ready':'blocked',depth:depth*2,detail:done?'Quest complete':prereqsDone&&skillsMet?'All detected requirements met':'Prerequisites or mandatory skills remain',source:`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(q).replace(/ /g,'_'))}`,estimate:((questDisplayMeta||{})[k]||{}).length||'Unknown length',requires:prereqs.slice()});
        prereqs.forEach(p=>addEdge(qId(p),qId(q)));
        skills.forEach(x=>{const skill=String(x.skill||''),target=Number(x.level||0),current=Number(stats[skill.toLowerCase()]||0),id=sId(skill,target,q);addNode({id:id,kind:'SKILL',label:`${skill} ${target}`,state:current>=target?'completed':'training',depth:Math.max(1,depth*2-1),detail:`Base level ${current} → ${target}`,source:'https://oldschool.runescape.wiki/w/Skills',estimate:current>=target?'Requirement met':'Rate-dependent training',requires:[]});addEdge(id,qId(q))});
      });
      anchors.forEach(anchor=>addEdge(qId(anchor),goalId));
      addNode({id:goalId,kind:def.type==='QUEST_PARTIAL_UNLOCK'?'CONFIRM':'GOAL',label:def.display||goal.name,state:completionPercent===100?'completed':def.type==='QUEST_PARTIAL_UNLOCK'?'confirmation':'blocked',depth:(Math.max.apply(null,nodes.map(n=>n.depth).concat([0]))+1),detail:def.finish,source:def.source,estimate:def.type==='QUEST_PARTIAL_UNLOCK'?'Manual confirmation':'Finish-line outcome',requires:anchors.slice()});
      const longest=(q,stack)=>{const k=String(q||'').toLowerCase();if(completed.has(k))return[];stack=stack||new Set();if(stack.has(k))return[];stack.add(k);const ps=((questInfo[k]&&questInfo[k].prereqs)||[]).filter(x=>!completed.has(String(x).toLowerCase())),branches=ps.map(x=>longest(x,new Set(stack))).sort((a,b)=>b.length-a.length);return (branches[0]||[]).concat([q])};
      const criticalQuestPath=anchors.map(longest).sort((a,b)=>b.length-a.length)[0]||[],criticalIds=new Set([goalId]);criticalQuestPath.forEach(q=>{criticalIds.add(qId(q));const req=(requirementIntel||{})[String(q).toLowerCase()];((req&&req.requiredSkills)||[]).forEach(x=>{if(Number(stats[String(x.skill||'').toLowerCase()]||0)<Number(x.level||0))criticalIds.add(sId(x.skill,Number(x.level||0),q))})});
      let nextActionId='';const first=actionPlan[0];if(first){if(first.kind==='QUEST')nextActionId=qId(first.quest);else if(first.kind==='TRAIN')nextActionId=sId(first.skill,Number(first.target||0),first.quest);else if(first.kind==='CONFIRM')nextActionId=goalId}nodes.forEach(n=>{n.critical=criticalIds.has(n.id);n.nextAction=n.id===nextActionId});
      return {nodes:nodes,edges:edges,nextActionId:nextActionId};
    }
    let prior='';(actionPlan||[]).forEach((step,i)=>{const id=`step:${i}`;addNode({id:id,kind:step.kind||'CHECK',label:step.title,state:step.kind==='TRAIN'?'training':step.kind==='CONFIRM'?'confirmation':step.kind==='READY'?'ready':'blocked',depth:i+1,detail:step.detail||'',source:def.source,estimate:step.estimate||'',requires:prior?[prior]:[],critical:true,nextAction:i===0});if(prior)addEdge(prior,id);prior=id});
    addNode({id:goalId,kind:'GOAL',label:def.display||goal.name,state:completionPercent===100?'completed':'blocked',depth:(actionPlan||[]).length+1,detail:def.finish,source:def.source,estimate:'Finish-line outcome',requires:prior?[prior]:[],critical:true,nextAction:false});if(prior)addEdge(prior,goalId);
    return {nodes:nodes,edges:edges,nextActionId:(actionPlan||[]).length?'step:0':goalId};
  };
  const totalQuests = questNames.length || 1;
  const trackedCompleted = questNames.filter(name => completed.has(name.toLowerCase())).length;
  const accomplishedGoals = new Set((goals||[]).filter(g=>/^accomplished$/i.test(String(g.status||''))).map(g=>String(g.name||'').toLowerCase()));
  const dim = (label,current,target,detail,group) => ({label:label,current:current,target:target,percent:target ? Math.min(100,Math.round(current/target*100)) : 100,detail:detail,group:group||'progress'});
  const definitions = {
    'balanced':{type:'ROADMAP_MODE',finish:'Ongoing planning mode; it balances useful unlocks, quests, skills, and account development.',tracked:'Dashboard configuration',source:'https://oldschool.runescape.wiki/w/Optimal_quest_guide'},
    'fairy rings':{type:'QUEST_PARTIAL_UNLOCK',anchor:'Fairytale II - Cure a Queen',finish:'Receive permission from the Fairy Godfather during Fairytale II and use the fairy-ring network.',tracked:'Manual confirmation or full quest completion',source:'https://oldschool.runescape.wiki/w/Fairy_rings'},
    'combat growth':{type:'SKILL_THRESHOLD',display:'Combat Growth',targetCombat:126,finish:'Advance through combat-level milestones at 70, 85, 100, 110, 120, and finally 126.',tracked:'Account combat level',source:'https://oldschool.runescape.wiki/w/Combat_level'},
    'core transportation network':{type:'CHECKLIST_TRANSPORT',display:'Core Transportation Network',finish:'Unlock fairy rings, spirit trees, and gnome gliders.',tracked:'Quest completion plus fairy-ring confirmation',source:'https://oldschool.runescape.wiki/w/Transportation'},
    'fossil island access':{type:'QUEST_COMPLETE',anchor:'Bone Voyage',finish:'Complete Bone Voyage and unlock Fossil Island.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Fossil_Island'},
    'fire cape prep':{type:'CHECKLIST_FIRE_CAPE',display:'Fire Cape',finish:'Prepare for the Fight Caves, defeat TzTok-Jad, and obtain a Fire cape.',tracked:'Base stats and quest completion; cape ownership is confirmed manually',source:'https://oldschool.runescape.wiki/w/TzHaar_Fight_Cave/Strategies'},
    'barrows gloves / rfd':{type:'QUEST_COMPLETE',display:'Barrows Gloves Unlocked',anchor:'Recipe for Disaster',finish:'Complete Recipe for Disaster and unlock Barrows gloves in the Culinaromancer\'s Chest.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Recipe_for_Disaster'},
    'ancient magicks':{type:'QUEST_COMPLETE',anchor:'Desert Treasure I',finish:'Complete Desert Treasure I and unlock the Ancient Magicks spellbook.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Ancient_Magicks'},
    'piety':{type:'CHECKLIST_PIETY',finish:'Reach 70 Prayer and 70 Defence, complete King\'s Ransom, and complete Knight Waves Training Grounds.',tracked:'Stats and quest completion; Knight Waves needs confirmation',source:'https://oldschool.runescape.wiki/w/Piety'},
    'lunar spellbook':{type:'QUEST_COMPLETE',anchor:'Lunar Diplomacy',finish:'Complete Lunar Diplomacy and unlock the Lunar spellbook.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Lunar_spellbook'},
    'darkmeyer access':{type:'QUEST_COMPLETE',anchor:'Sins of the Father',finish:'Complete Sins of the Father and unlock full access to Darkmeyer.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Darkmeyer'},
    'tombs of amascut access':{type:'QUEST_COMPLETE',anchor:'Beneath Cursed Sands',finish:'Complete Beneath Cursed Sands and unlock Tombs of Amascut.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Tombs_of_Amascut'},
    'dragon slayer ii':{type:'QUEST_COMPLETE',anchor:'Dragon Slayer II',finish:'Complete Dragon Slayer II.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Dragon_Slayer_II'},
    'prifddinas':{type:'QUEST_COMPLETE',anchor:'Song of the Elves',finish:'Complete Song of the Elves and unlock Prifddinas.',tracked:'Quest completion',source:'https://oldschool.runescape.wiki/w/Prifddinas'},
    'quest cape':{type:'ALL_CURRENT_QUESTS',finish:'Complete every currently released quest; new quest releases reopen this goal.',tracked:'Verified quest completion dataset',source:'https://oldschool.runescape.wiki/w/Quest_point_cape'},
    'inferno / infernal cape':{type:'CHECKLIST_INFERNO',display:'Infernal Cape',finish:'Prepare for the Inferno, complete all 69 waves, defeat TzKal-Zuk, and obtain an Infernal cape.',tracked:'Base stats plus the completed Fire Cape goal; Infernal cape ownership is confirmed manually',source:'https://oldschool.runescape.wiki/w/Inferno/Strategies'}
  };

  (goals || []).forEach(goal => {
    const dimensions = [], readiness = [], key=String(goal.name||'').toLowerCase(), def=definitions[key]||null;
    if (/^accomplished$/i.test(goal.status || '')) {
      out[key] = {percent:100,status:'Accomplished',displayName:def&&def.display||goal.name,completionType:def&&def.type||'MANUAL',finishLine:def&&def.finish||'Marked accomplished.',trackedBy:def&&def.tracked||'Manual confirmation',source:def&&def.source||'',lastVerified:'2026-08-29',dimensions:[dim('Goal status',1,1,'Marked accomplished')],ranking:{eligible:false,pathReadinessPercent:100,remainingQuestSteps:0,unmetSkillTargets:0,needsConfirmation:false,dataConfidence:'VERIFIED'}};
      return;
    }
    if (!def) { out[key]={percent:null,status:'Definition required',displayName:goal.name,completionType:'REVIEW',finishLine:'This goal needs an audited finish line before progress can be calculated.',trackedBy:'Not configured',source:'',lastVerified:'',dimensions:[],ranking:{eligible:true,pathReadinessPercent:null,remainingQuestSteps:999,unmetSkillTargets:999,needsConfirmation:false,dataConfidence:'REVIEW'}}; return; }
    let percent=null,status='In progress',milestone=null;
    if(def.type==='ROADMAP_MODE'){status='Ongoing';}
    else if(def.type==='ALL_CURRENT_QUESTS'){
      percent=Math.round(trackedCompleted/totalQuests*100);dimensions.push(dim('Quests completed',trackedCompleted,totalQuests,`${trackedCompleted} of ${totalQuests} quests complete`));status=trackedCompleted>=totalQuests?'Accomplished':`${totalQuests-trackedCompleted} quests remaining`;
    } else if(def.type==='SKILL_THRESHOLD'){
      const current=Number(account['Combat Level']||0),target=Number(def.targetCombat||0),checkpoints=[70,85,100,110,120,126],next=checkpoints.find(x=>current<x)||target,previous=[0].concat(checkpoints).filter(x=>x<=current).pop()||0,milestoneSpan=Math.max(1,next-previous),milestonePct=current>=target?100:Math.max(0,Math.min(100,Math.round((current-previous)/milestoneSpan*100)));percent=target?Math.min(100,Math.round(current/target*100)):null;milestone={current:current,next:next,previous:previous,percent:milestonePct,remaining:Math.max(0,next-current),checkpoints:checkpoints};dimensions.push(dim('Current combat level',current,next,`${current} → ${next}`));status=current>=target?'Accomplished':`${Math.max(0,next-current)} levels to milestone ${next}`;
    } else if(def.type==='CHECKLIST_TRANSPORT'){
      const spirit=completed.has('tree gnome village'),glider=completed.has('the grand tree'),fairyFull=completed.has('fairytale ii - cure a queen');const done=Number(spirit)+Number(glider)+Number(fairyFull);percent=Math.round(done/3*100);dimensions.push(dim('Spirit trees',Number(spirit),1,spirit?'Tree Gnome Village complete':'Complete Tree Gnome Village'));dimensions.push(dim('Gnome gliders',Number(glider),1,glider?'The Grand Tree complete':'Complete The Grand Tree'));dimensions.push(dim('Fairy rings',Number(fairyFull),1,fairyFull?'Confirmed by full Fairytale II completion':'Partial-quest unlock needs confirmation'));status=fairyFull&&spirit&&glider?'Ready to complete':'Fairy-ring state may need confirmation';
    } else if(def.type==='CHECKLIST_FIRE_CAPE'){
      const checks=[['75 Ranged',Number(stats.ranged||0)>=75],['60 Prayer',Number(stats.prayer||0)>=60],['70 Defence',Number(stats.defence||0)>=70],['70 Hitpoints',Number(stats.hitpoints||0)>=70],['Animal Magnetism',completed.has('animal magnetism')]],done=checks.filter(x=>x[1]).length,total=checks.length+1;percent=Math.round(done/total*100);checks.forEach(x=>readiness.push(dim(x[0],Number(x[1]),1,x[1]?'Preparation checkpoint met':'Preparation checkpoint not met','readiness')));dimensions.push(dim('Fire cape obtained',0,1,'Confirm after defeating TzTok-Jad and receiving the cape'));status=done===checks.length?'Prepared — obtain and confirm the Fire cape':'Preparation in progress';
    } else if(def.type==='CHECKLIST_PIETY'){
      const checks=[['70 Prayer',Number(stats.prayer||0)>=70],['70 Defence',Number(stats.defence||0)>=70],["King's Ransom",completed.has("king's ransom")]],done=checks.filter(x=>x[1]).length;percent=Math.round(done/4*100);checks.forEach(x=>dimensions.push(dim(x[0],Number(x[1]),1,x[1]?'Met':'Not met')));dimensions.push(dim('Knight Waves',0,1,'Completion needs confirmation'));status='Knight Waves completion needs confirmation';
    } else if(def.type==='QUEST_PARTIAL_UNLOCK'){
      const full=completed.has(String(def.anchor).toLowerCase());percent=full?100:null;dimensions.push(dim('Fairy-ring permission',Number(full),1,full?'Confirmed by full quest completion':'Unlock occurs partway through the quest; confirm when obtained'));status=full?'Accomplished':'Needs confirmation';
    } else if(def.type==='CHECKLIST_INFERNO'){
      const fireCape=accomplishedGoals.has('fire cape prep'),checks=[['90 Ranged',Number(stats.ranged||0)>=90],['90 Defence',Number(stats.defence||0)>=90],['80 Prayer',Number(stats.prayer||0)>=80],['94 Magic',Number(stats.magic||0)>=94],['90 Hitpoints',Number(stats.hitpoints||0)>=90],['Fire Cape goal',fireCape]],done=checks.filter(x=>x[1]).length,total=checks.length+1;percent=Math.round(done/total*100);checks.forEach(x=>readiness.push(dim(x[0],Number(x[1]),1,x[1]?'Preparation checkpoint met':'Preparation checkpoint not met','readiness')));dimensions.push(dim('Infernal cape obtained',0,1,'Confirm after defeating TzKal-Zuk and receiving the cape'));status=done===checks.length?'Prepared — obtain and confirm the Infernal cape':'Preparation in progress';
    } else if(def.type==='QUEST_COMPLETE'){
      const anchor=String(def.anchor||goal.anchor||''),anchorKey=anchor.toLowerCase(),anchorDone=completed.has(anchorKey);percent=anchorDone?100:0;dimensions.push(dim('Finish quest',Number(anchorDone),1,anchorDone?`${anchor} complete`:`Complete ${anchor}`));status=anchorDone?'Accomplished':`${anchor} incomplete`;
    }
    let path = null;
    if (def.type === 'QUEST_COMPLETE') path = pathForQuests(questChain(def.anchor, false));
    else if (def.type === 'QUEST_PARTIAL_UNLOCK') path = pathForQuests(questChain(def.anchor, false));
    else if (def.type === 'ALL_CURRENT_QUESTS') path = pathForQuests(questNames.filter(name=>!completed.has(name.toLowerCase())));
    else if (def.type === 'ROADMAP_MODE') {
      const routeQuests=(routeRows||[]).map(r=>String(r.quest||r[1]||'').trim()).filter(Boolean);
      path=pathForQuests(routeQuests);
    }
    if (!path) {
      const pathDims = readiness.length ? readiness : dimensions;
      const total = pathDims.length, earned = pathDims.reduce((sum,d)=>sum+Math.min(1,Number(d.current||0)/Math.max(1,Number(d.target||1))),0);
      path={percent:total?Math.round(earned/total*100):(percent===null?null:percent),questPath:null,skillPath:null};
    }
    const remainingQuestSteps=path.questPath?Math.max(0,Number(path.questPath.target||0)-Number(path.questPath.current||0)):0;
    const unmetSkillTargets=path.skillPath?Math.max(0,Number(path.skillPath.target||0)-Number(path.skillPath.current||0)):[].concat(dimensions,readiness).filter(d=>Number(d.percent||0)<100).length;
    const needsConfirmation=/confirm/i.test(String(status||''))||/manual confirmation/i.test(String(def.tracked||''));
    const ranking={eligible:def.type!=='ROADMAP_MODE',pathReadinessPercent:Number.isFinite(Number(path.percent))?Number(path.percent):null,remainingQuestSteps:remainingQuestSteps,unmetSkillTargets:unmetSkillTargets,needsConfirmation:needsConfirmation,dataConfidence:def.source?'VERIFIED':'REVIEW'};
    let actionPlan=[];
    if(def.type==='QUEST_COMPLETE')actionPlan=questActionPlan(def.anchor,false);
    else if(def.type==='QUEST_PARTIAL_UNLOCK')actionPlan=questActionPlan(def.anchor,true);
    else if(def.type==='SKILL_THRESHOLD'&&milestone)actionPlan=[{kind:'TRAIN',status:'Train first',title:`Reach combat level ${milestone.next}`,detail:`Current combat level: ${milestone.current}.`,outcome:`Advances Combat Growth to its next milestone.`,current:milestone.current,target:milestone.next,estimate:'Updates automatically from synced combat level'}];
    else if(def.type!=='ROADMAP_MODE')actionPlan=[].concat(readiness,dimensions).filter(d=>Number(d.percent||0)<100).map(d=>({kind:/confirm/i.test(String(d.detail||''))?'CONFIRM':'CHECK',status:/confirm/i.test(String(d.detail||''))?'Manual confirmation':'Ready next',title:d.label,detail:d.detail||`${d.current} of ${d.target}`,outcome:'Advances this goal when the requirement is satisfied.',estimate:'No stable universal time estimate'}));
    if(!actionPlan.length&&def.type!=='ROADMAP_MODE'&&percent!==100)actionPlan=[{kind:'READY',status:'Ready now',title:'Complete the finish-line action',detail:def.finish,outcome:'Completes this goal.',estimate:'Ready now'}];
    const dependencyMap=def.type!=='ROADMAP_MODE'&&String(mapGoal||'').toLowerCase()===key?goalDependencyMap(def,goal,actionPlan,percent):null;
    out[key]={percent:percent,status:status,displayName:def.display||goal.name,completionType:def.type,finishLine:def.finish,trackedBy:def.tracked,source:def.source,lastVerified:'2026-08-29',dimensions:dimensions,readiness:readiness,pathReadinessPercent:path.percent,questPath:path.questPath,skillPath:path.skillPath,milestone:milestone,ranking:ranking,actionPlan:actionPlan,dependencyMap:dependencyMap};
  });
  return out;
}

function getV277GoalDependencyMap(goalName) {
  goalName=v274CanonicalGoalName_(goalName);
  const state=getV1DashboardState({allowQuestHelperSync:false,mapGoal:goalName});
  const progress=(state.goalProgress||{})[String(goalName||'').toLowerCase()];
  if(!progress||!progress.dependencyMap)throw new Error('Dependency map unavailable for '+goalName+'.');
  return progress.dependencyMap;
}

function readV129QuestDisplayMeta_(sh) {
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, Math.min(199, sh.getLastRow() - 1), 6).getDisplayValues().forEach(r => {
    const quest = String(r[0] || '').trim();
    if (quest) out[quest.toLowerCase()] = {difficulty:String(r[4] || '').trim(), length:String(r[5] || '').trim()};
  });
  return out;
}

function readV128BossPlanner_(ss, statsRows) {
  const stats = {};
  (statsRows || []).forEach(r => stats[String(r[0] || '').trim().toLowerCase()] = Number(r[1] || 0));
  const completed = new Set();
  try {
    const t = v115QuestTable_(ss);
    t.vals.slice(t.headerRow + 1).forEach(r => {
      if (/^(yes|true|complete|completed)$/i.test(String(r[t.cCol] || ''))) completed.add(String(r[t.qCol] || '').trim().toLowerCase());
    });
  } catch (e) {}

  const definitions = [
    {name:'Scurrius',stage:'Beginning',access:'None',goal:'Combat Growth',stats:{Attack:45,Strength:45,Defence:40,Hitpoints:50,Prayer:43},style:'Melee',gear:'Rune weapon and armour or better',prep:'Protection prayers, food, combat potion',notes:'Excellent mechanics practice with forgiving deaths and strong combat XP.'},
    {name:'Barrows',stage:'Beginning',access:'Priest in Peril',goal:'Combat Growth',stats:{Magic:50,Prayer:43,Defence:50,Hitpoints:60},style:'Magic',gear:'Iban\'s staff or a powered staff; tank armour',prep:'Prayer potions, food, emergency teleport',notes:'Prayer management and efficient brother routing matter more than perfect gear.'},
    {name:'Giant Mole',stage:'Beginning',access:'None',goal:'Combat Growth',stats:{Attack:60,Strength:60,Defence:50,Hitpoints:60,Prayer:43},style:'Melee',gear:'Dragon weapon or better; Falador shield helps track it',prep:'Protection prayers, stamina and food',notes:'A straightforward introduction to repeatable boss trips.'},
    {name:'Moons of Peril',stage:'Mid-game',access:'Children of the Sun',goal:'Combat Growth',stats:{Attack:65,Strength:65,Defence:65,Hitpoints:65,Prayer:43},style:'Melee',gear:'Three melee setups that cover stab, slash and crush',prep:'Supplies can be gathered inside the dungeon',notes:'Defence and weapon-style coverage are especially valuable here.'},
    {name:'Sarachnis',stage:'Mid-game',access:'Priest in Peril',goal:'Combat Growth',stats:{Attack:65,Strength:65,Defence:60,Hitpoints:65,Prayer:43},style:'Crush',gear:'Dragon mace or stronger crush weapon',prep:'Prayer potions, food, antipoison',notes:'Good practice for prayer switching, add control and movement.'},
    {name:'Zulrah',stage:'Mid-game',access:'Regicide',goal:'Combat Growth',stats:{Ranged:75,Magic:75,Defence:70,Hitpoints:75,Prayer:45},style:'Ranged + Magic',gear:'Two compact combat switches; anti-venom protection',prep:'Food, prayer, recoil effect and emergency teleport',notes:'Rotation learning is a separate skill from stat readiness.'},
    {name:'Vorkath',stage:'Advanced',access:'Dragon Slayer II',goal:'Dragon Slayer II',stats:{Ranged:80,Defence:75,Hitpoints:80,Prayer:74},style:'Ranged',gear:'Dragon hunter or strong crossbow setup; salve amulet',prep:'Antifire, anti-venom, prayer and crumble undead',notes:'Access is a hard quest gate; movement and special-attack handling still require practice.'},
    {name:'Phantom Muspah',stage:'Advanced',access:'Secrets of the North',goal:'Combat Growth',stats:{Ranged:85,Magic:80,Defence:75,Hitpoints:80,Prayer:70},style:'Ranged + Magic',gear:'Strong ranged setup with an optional magic switch',prep:'Prayer, stamina, food and emergency teleport',notes:'Consistent movement and prayer switching are core readiness factors.'},
    {name:'Corrupted Gauntlet',stage:'Advanced',access:'Song of the Elves',goal:'Prifddinas',stats:{Attack:80,Strength:80,Defence:80,Ranged:80,Magic:80,Hitpoints:80,Prayer:70},style:'All combat styles',gear:'No bank gear required; prep occurs inside',prep:'Learn resource routing, Hunllef prayers and floor patterns',notes:'Stats help, but preparation speed and mechanics determine success.'},
    {name:'Tombs of Amascut (Entry)',stage:'Raids',access:'Beneath Cursed Sands',goal:'Tombs of Amascut Access',stats:{Attack:75,Strength:75,Defence:70,Ranged:75,Magic:75,Hitpoints:75,Prayer:70},style:'All combat styles',gear:'Melee, ranged and magic setups with modest switches',prep:'Food, prayer, potions and an invocation level suited to practice',notes:'Entry Mode scales down well; raise invocations as mechanics become consistent.'}
  ];

  return definitions.map(b => {
    const skillRows = Object.keys(b.stats).map(skill => ({skill:skill,current:Number(stats[skill.toLowerCase()] || 0),recommended:b.stats[skill]}));
    const statsReady = skillRows.every(x => x.current >= x.recommended);
    const accessReady = b.access === 'None' || completed.has(b.access.toLowerCase());
    return Object.assign({}, b, {skillRows:skillRows,statsReady:statsReady,accessReady:accessReady,status:accessReady?(statsReady?'Recommended stats met':'Stat preparation'):'Access quest needed'});
  });
}

function v122SkillPairs_(text) {
  const skills=[
    'Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft',
    'Construction','Hitpoints','Agility','Herblore','Thieving','Crafting',
    'Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking',
    'Firemaking','Woodcutting','Farming','Sailing'
  ];
  const s=String(text||'');
  const out=[];
  skills.forEach(skill=>{
    const escSkill=skill.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let m=new RegExp('\\b'+escSkill+'\\s+(\\d+)\\*?','i').exec(s);
    if(!m) m=new RegExp('\\b(\\d+)\\s+'+escSkill+'\\b','i').exec(s);
    if(m) out.push({skill:skill,level:Number(m[1])});
  });
  return out;
}

function v122OptionalKind_(text) {
  const s=String(text||'').toLowerCase();
  if(s.indexOf('recommended')>=0) return 'Recommended';
  if(/alternative|avoidable|avoid|route|only needed|if you|if mining|if crafting|if making/.test(s)) return 'Alternative route';
  return 'Optional';
}

function readV122QuestMeta_(sh) {
  const result={rewards:{},requirements:{}};
  if(!sh||sh.getLastRow()<1)return result;

  const v=sh.getDataRange().getDisplayValues();
  let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){
    const r=v[i].map(x=>String(x||'').trim());
    if(r.some(x=>/^quest name$/i.test(x))){hr=i;h=r;break}
  }
  if(hr<0)return result;

  const first=res=>{for(let i=0;i<h.length;i++)if(res.some(r=>r.test(String(h[i]||'').trim())))return i;return -1};
  const q=first([/^quest name$/i]);
  const qp=first([/^quest points reward$/i,/^quest points$/i]);
  const xp=first([/^xp rewards?$/i]);
  const it=first([/^item \/ coin rewards?$/i]);
  const un=first([/^unlocks \/ other rewards?$/i]);
  const hard=first([/^skill level requirements?$/i,/^skill requirements?$/i]);
  const boost=first([/^boostable skill requirements?$/i]);
  const optional=first([/^conditional \/ alternative requirements$/i]);

  v.slice(hr+1).forEach(r=>{
    const name=q>=0?String(r[q]||'').trim():'';
    if(!name)return;
    const key=name.toLowerCase();

    result.rewards[key]={
      qp:qp>=0?String(r[qp]||'').trim():'',
      xp:xp>=0?String(r[xp]||'').trim():'',
      items:it>=0?String(r[it]||'').trim():'',
      unlocks:un>=0?String(r[un]||'').trim():''
    };

    const hardText=hard>=0?String(r[hard]||'').trim():'';
    const boostText=boost>=0?String(r[boost]||'').trim():'';
    const optionalText=optional>=0?String(r[optional]||'').trim():'';
    const boostPairs=v122SkillPairs_(boostText);
    const boostSkills=new Set(boostPairs.map(x=>x.skill.toLowerCase()));

    result.requirements[key]={
      quest:name,
      hardText:hardText,
      boostableText:boostText,
      optionalText:optionalText,
      requiredSkills:v122SkillPairs_(hardText).map(x=>({
        skill:x.skill,
        level:x.level,
        boostable:boostSkills.has(x.skill.toLowerCase()),
        planning:'Base level'
      })),
      optionalSkills:v122SkillPairs_(optionalText).map(x=>({
        skill:x.skill,
        level:x.level,
        kind:v122OptionalKind_(optionalText),
        why:optionalText
      })),
      planningMode:'Base levels only'
    };
  });

  return result;
}

function refreshQuestHelperIfStaleV122() {
  if(typeof syncQuestHelperRouteRequirements!=='function')return {ok:true,refreshed:false,reason:'Quest Helper sync unavailable'};
  const props=PropertiesService.getScriptProperties();
  const last=Number(props.getProperty('QH_ROUTE_SYNC_MS_V2')||0);
  if(last && Date.now()-last<=6*60*60*1000)return {ok:true,refreshed:false,reason:'Quest Helper cache is fresh'};
  const result=syncQuestHelperRouteRequirements();
  return {ok:true,refreshed:true,result:result};
}

function v122ColLetter_(n) {
  let s='';
  while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);}
  return s;
}

function completeV122QuestsFast(quests,source,reconciledQp,completionDate) {
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).toLowerCase()));
  const changed=[],addresses=[];
  const col=v122ColLetter_(t.cCol+1);

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(wanted.has(quest.toLowerCase())&&!/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||''))){
      changed.push(quest);
      addresses.push(col+String(t.headerRow+2+idx));
    }
  });

  if(!changed.length)throw new Error('No incomplete quests matched the selection.');
  t.sh.getRangeList(addresses).setValue('Yes');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']]);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Manual';
  const logRows=changed.map(q=>[now,q,'No','Yes',src,tx]);
  log.getRange(log.getLastRow()+1,1,logRows.length,6).setValues(logRows);

  if(completionDate&&/^\d{4}-\d{2}-\d{2}$/.test(String(completionDate))){
    const dates=v235ReadQuestDates_();
    changed.forEach(q=>dates[v235QuestDateKey_(q)]={date:String(completionDate),source:'Detected completion confirmed',confidence:'manual'});
    PropertiesService.getScriptProperties().setProperty(V235_QUEST_DATE_KEY,JSON.stringify(dates));
  }

  SpreadsheetApp.flush();

  const observedQp=v115CurrentTrackerQp_(ss), acknowledgedQp=Math.max(observedQp,Number(reconciledQp)||0);
  PropertiesService.getScriptProperties().setProperty('V115_LAST_RECONCILED_QP',String(acknowledgedQp));

  const dashboard=getV1DashboardState({allowQuestHelperSync:false});
  return {ok:true,changed:changed,transactionId:tx,dashboard:dashboard};
}

function readV1QuestRewards_(sh) {
  const out={}; if(!sh||sh.getLastRow()<1)return out;
  const v=sh.getDataRange().getDisplayValues(); let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){const r=v[i].map(x=>String(x||'').trim());if(r.some(x=>/^quest name$/i.test(x))&&r.some(x=>/quest points reward/i.test(x))){hr=i;h=r;break}}
  if(hr<0)return out; const c=n=>h.findIndex(x=>String(x||'').trim().toLowerCase()===n);
  const q=c('quest name'),qp=c('quest points reward'),xp=c('xp rewards'),it=c('item / coin rewards'),un=c('unlocks / other rewards');
  v.slice(hr+1).forEach(r=>{const n=q>=0?String(r[q]||'').trim():'';if(n)out[n.toLowerCase()]={qp:qp>=0?String(r[qp]||'').trim():'',xp:xp>=0?String(r[xp]||'').trim():'',items:it>=0?String(r[it]||'').trim():'',unlocks:un>=0?String(r[un]||'').trim():''}});
  return out;
}

function readV1WikiHealth_(dash) {
  function valueNextTo_(label) {
    const found = dash.createTextFinder(label).matchEntireCell(true).findNext();
    return found ? found.offset(0, 1).getDisplayValue() : '';
  }
  return {
    ok: valueNextTo_('OK'),
    review: valueNextTo_('Needs Review'),
    missing: valueNextTo_('No Cache / Incomplete'),
    lastCheck: valueNextTo_('Last Wiki Check')
  };
}

function setV1Goal(goalName) {
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  goalName = v274StoredGoalName_(goalName);
  const names = ss.getSheetByName('Goal Registry').getRange('A5:A200').getDisplayValues().flat().filter(Boolean);
  if (names.indexOf(goalName) === -1) throw new Error('Unknown goal: ' + goalName);
  ss.getSheetByName('Dashboard').getRange('B3').setValue(goalName);
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState();
}

function setV127GoalStatus_(goalName, newStatus) {
  goalName = String(goalName || '').trim();
  newStatus = String(newStatus || '').toUpperCase();
  if (!goalName) throw new Error('Choose a goal first.');
  if (goalName === 'Balanced') throw new Error('Balanced is the permanent fallback goal and cannot be completed.');
  if (['ACTIVE','ACCOMPLISHED'].indexOf(newStatus) === -1) throw new Error('Unknown goal status.');

  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const sh = ss.getSheetByName('Goal Registry');
  const rows = sh.getRange('A5:P200').getDisplayValues();
  const storedGoalName = v274StoredGoalName_(goalName);
  const index = rows.findIndex(r => String(r[0] || '').trim() === storedGoalName);
  if (index < 0) throw new Error('Unknown goal: ' + goalName);

  const row = index + 5;
  const previous = String(rows[index][15] || 'ACTIVE').toUpperCase();
  if (previous === newStatus) return getV1DashboardState({allowQuestHelperSync:false});
  sh.getRange(row, 16).setValue(newStatus);

  let log = ss.getSheetByName('Goal Completion Log');
  if (!log) {
    log = ss.insertSheet('Goal Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Goal','Previous Status','New Status','Source','Transaction ID']]);
  }
  log.appendRow([new Date(), goalName, previous, newStatus, 'Dashboard Goal Manager', Utilities.getUuid()]);

  const dash = ss.getSheetByName('Dashboard');
  if (newStatus === 'ACCOMPLISHED' && dash.getRange('B3').getDisplayValue() === storedGoalName) {
    dash.getRange('B3').setValue('Balanced');
  }
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState({allowQuestHelperSync:false});
}

function completeV127Goal(goalName) {
  return setV127GoalStatus_(goalName, 'ACCOMPLISHED');
}

function restoreV127Goal(goalName) {
  return setV127GoalStatus_(goalName, 'ACTIVE');
}

function setV1RouteDepth(depth) {
  depth = Number(depth);
  if ([3,5,10].indexOf(depth) === -1) throw new Error('Route depth must be 3, 5, or 10.');
  const ss = SpreadsheetApp.openById(V1_TRACKER_ID);
  const dash = ss.getSheetByName('Dashboard');
  const found = dash.createTextFinder('Route Depth').matchEntireCell(true).findNext();
  if (!found) throw new Error('Route Depth control not found.');
  found.offset(0,1).setValue(depth);
  SpreadsheetApp.flush();
  Utilities.sleep(150);
  return getV1DashboardState();
}

function getRouteDepthValue_(dash) {
  const found = dash.createTextFinder('Route Depth').matchEntireCell(true).findNext();
  return found ? found.offset(0,1).getValue() : 10;
}

function normalizeV1PrepItem_(name) {
  const aliases = {
    "premade blurb' sp.": "Premade blurb' special",
    "bread (unnoted)": "Bread",
    "trout (unnoted)": "Trout",
    "rope, multiple in case you fail an agility check": "Rope",
    "torch": "Lit torch or candle"
  };
  const raw = String(name || '').trim();
  return aliases[raw.toLowerCase()] || raw;
}

function v1PrepKey_(quest, item) {
  return String(quest || '').trim().toLowerCase() + '|' +
    normalizeV1PrepItem_(item).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readV1Shopping_(wikiSheet, reconciledSheet) {
  const out = [];
  const byKey = new Map();

  function addOrMerge_(row) {
    const key = v1PrepKey_(row.quests, row.item);
    if (!byKey.has(key)) {
      byKey.set(key, row);
      out.push(row);
      return;
    }

    const prev = byKey.get(key);
    const a = Number(prev.qty || 0);
    const b = Number(row.qty || 0);
    if (b > a) prev.qty = row.qty;

    if (row.source && String(prev.source || '').indexOf(row.source) < 0) {
      prev.source = [prev.source, row.source].filter(Boolean).join(' + ');
    }
    if (!prev.notes && row.notes) prev.notes = row.notes;

    if (/obtain/i.test(String(row.acquisition || '')) &&
        /created/i.test(String(prev.acquisition || ''))) {
      prev.acquisition = 'Obtain During Quest';
      prev.prepClass = 'Obtain During Quest';
    }
  }

  if (reconciledSheet && reconciledSheet.getLastRow() > 1) {
    const rows = reconciledSheet
      .getRange(2, 1, Math.min(reconciledSheet.getLastRow() - 1, 500), 15)
      .getDisplayValues();

    rows.forEach(r => {
      const quest = r[1];
      const item = normalizeV1PrepItem_(r[2]);
      const qty = r[3] || '1';
      const prepClass = r[4];
      const mandatory = String(r[5]).toUpperCase() === 'TRUE';
      const reusable = String(r[6]).toUpperCase() === 'TRUE';
      const qhStatus = r[7];
      const wikiAcquisition = r[9];
      const sourceAgreement = r[11];
      const notes = r[12];

      if (!quest || !item) return;

      const wikiConfirmedMidQuest =
        prepClass === 'Created / Obtained During Quest' &&
        sourceAgreement !== 'QH only';

      if (!(mandatory || qhStatus === 'RECOMMENDED' || wikiConfirmedMidQuest)) return;

      let acquisition = 'Bring / Buy';
      if (/obtain/i.test(wikiAcquisition) && /Created \/ Obtained/i.test(prepClass)) {
        acquisition = 'Obtain During Quest';
      } else if (/Created/i.test(prepClass)) {
        acquisition = 'Created During Quest';
      } else if (/Obtain/i.test(prepClass)) {
        acquisition = 'Obtain During Quest';
      } else if (/Recommended/i.test(prepClass)) {
        acquisition = prepClass;
      }

      addOrMerge_({
        item, qty, quests: quest, acquisition,
        type: qhStatus === 'RECOMMENDED' ? 'Recommended' :
              (wikiConfirmedMidQuest ? 'Quest Progress Item' : 'Direct'),
        notes, source: sourceAgreement || 'Quest Helper',
        prepClass, mandatory, reusable, qhStatus
      });
    });
  }

  if (wikiSheet && wikiSheet.getLastRow() >= 5) {
    const lastRow = Math.min(wikiSheet.getLastRow(), 500);
    const detail = wikiSheet.getRange(5, 8, lastRow - 4, 8).getDisplayValues();

    detail.forEach(r => {
      const quest = String(r[1] || '').trim();
      const depth = Number(r[3] || 0);
      const item = normalizeV1PrepItem_(r[4]);
      const qty = r[5] || '1';
      const acquisition = r[6] || 'Bring / Buy';
      const type = r[7] || 'Direct';

      if (!quest || !item) return;
      if (depth !== 1) return;
      if (/choice|alternative|component/i.test(type)) return;

      addOrMerge_({
        item, qty, quests: quest,
        acquisition: /obtain/i.test(acquisition) ? 'Obtain During Quest' : acquisition,
        type: 'Direct', source: 'Wiki direct fallback',
        prepClass: /obtain/i.test(acquisition) ? 'Obtain During Quest' : 'Bring / Buy',
        mandatory: true, reusable: false, qhStatus: 'WIKI'
      });
    });
  }

  return out;
}



// V1.15.1 quest completion reporting
function v115QuestTable_(ss) {
  const sh=ss.getSheetByName('Quest Dependency');
  if(!sh) throw new Error('Quest Dependency sheet not found.');

  const vals=sh.getDataRange().getDisplayValues();
  let headerRow=-1, headers=null;

  for(let i=0;i<Math.min(vals.length,12);i++){
    const row=vals[i].map(x=>String(x||'').trim());
    const hasCompleted=row.some(x=>/^completed$/i.test(x));
    const hasQuest=row.some(x=>/^quest name$/i.test(x));
    if(hasCompleted && hasQuest){
      headerRow=i;
      headers=row;
      break;
    }
  }

  if(headerRow<0) throw new Error('Could not locate Quest Dependency header row.');

  const qCol=headers.findIndex(x=>/^quest name$/i.test(x));
  const cCol=headers.findIndex(x=>/^completed$/i.test(x));
  const qpCol=headers.findIndex(x=>/quest points reward|quest points|qp reward/i.test(x));

  if(qCol<0||cCol<0) throw new Error('Quest Dependency needs Quest Name and Completed columns.');

  return {sh, vals, headerRow, headers, qCol, cCol, qpCol};
}

function v115CurrentTrackerQp_(ss) {
  const sh=ss.getSheetByName('Your Stats');
  if(!sh) return 0;
  const found=sh.createTextFinder('Quest Points').matchEntireCell(true).findNext();
  return found ? Number(found.offset(0,1).getValue()||0) : 0;
}

// Quest completion dates are intentionally separate from the completion flag:
// WikiSync/RuneLite can prove that a quest is complete, but not when it happened.
const V235_QUEST_DATE_KEY='V235_QUEST_COMPLETION_DATES';

function v235QuestDateKey_(name){return String(name||'').trim().toLowerCase()}

function v235ReadQuestDates_(){
  try{return JSON.parse(PropertiesService.getScriptProperties().getProperty(V235_QUEST_DATE_KEY)||'{}')||{}}
  catch(e){return {}}
}

function v235SeedQuestDates_(ss,completedNames){
  const dates=v235ReadQuestDates_(), completed=new Set((completedNames||[]).map(v235QuestDateKey_));
  let dirty=false;
  const put=(quest,date,source,confidence)=>{
    const key=v235QuestDateKey_(quest);
    if(!completed.has(key)||dates[key])return;
    dates[key]={date:date,source:source,confidence:confidence};dirty=true;
  };

  // User-directed baseline for every completed free-to-play quest in the
  // screenshot-confirmed initial account snapshot.
  ["Below Ice Mountain","Black Knights' Fortress","Cook's Assistant","The Corsair Curse","Demon Slayer","Doric's Quest","Dragon Slayer I","Ernest the Chicken","Goblin Diplomacy","Imp Catcher","The Knight's Sword","Learning the Ropes","Misthalin Mystery","Pirate's Treasure","Prince Ali Rescue","The Restless Ghost","Romeo & Juliet","Rune Mysteries","Sheep Shearer","Shield of Arrav","Vampyre Slayer","Witch's Potion","X Marks the Spot"]
    .forEach(q=>put(q,'2023-01-01','F2P baseline (user supplied)','assumed'));

  // Earlier project evidence only proves these were complete by this date.
  ['Merlin\'s Crystal','Holy Grail','Fight Arena','Tree Gnome Village','The Grand Tree']
    .forEach(q=>put(q,'2026-08-23','Drive checklist (observed complete)','observed'));
  ['Animal Magnetism','Waterfall Quest']
    .forEach(q=>put(q,'2026-08-20','Project chat (observed complete)','observed'));

  // The dashboard's own append-only log is the strongest available evidence.
  const log=ss.getSheetByName('Quest Completion Log');
  if(log&&log.getLastRow()>1){
    log.getRange(2,1,log.getLastRow()-1,6).getValues().forEach(r=>{
      const quest=String(r[1]||'').trim(),status=String(r[3]||'').trim();
      if(!quest||!/^yes$/i.test(status)||!completed.has(v235QuestDateKey_(quest)))return;
      const d=r[0] instanceof Date?r[0]:new Date(r[0]);
      if(isNaN(d.getTime()))return;
      const date=Utilities.formatDate(d,Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd');
      const key=v235QuestDateKey_(quest),existing=dates[key];
      if(!existing||existing.confidence!=='manual'){
        dates[key]={date:date,source:String(r[4]||'Dashboard completion log'),confidence:'logged'};dirty=true;
      }
    });
  }
  if(dirty)PropertiesService.getScriptProperties().setProperty(V235_QUEST_DATE_KEY,JSON.stringify(dates));
  return dates;
}

function saveV235QuestCompletionDate(quest,date){
  quest=String(quest||'').trim();date=String(date||'').trim();
  if(!quest)throw new Error('Choose a quest.');
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Use a valid completion date.');
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),t=v115QuestTable_(ss);
  const row=t.vals.slice(t.headerRow+1).find(r=>v235QuestDateKey_(r[t.qCol])===v235QuestDateKey_(quest));
  if(!row||!/^(yes|true|complete|completed)$/i.test(String(row[t.cCol]||'').trim()))throw new Error('Only completed quests can have a completion date.');
  const dates=v235ReadQuestDates_(),key=v235QuestDateKey_(quest);
  dates[key]={date:date,source:date?'Dashboard calendar':'Date intentionally cleared',confidence:'manual'};
  PropertiesService.getScriptProperties().setProperty(V235_QUEST_DATE_KEY,JSON.stringify(dates));
  return {ok:true,state:getV115QuestCompletionState_()};
}

function confirmV235DetectedQuestDates(quests,date){
  if(!Array.isArray(quests)||!quests.length)throw new Error('No detected quests were supplied.');
  date=String(date||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Use a valid completion date.');
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),t=v115QuestTable_(ss),wanted=new Set(quests.map(v235QuestDateKey_)),confirmed=[];
  t.vals.slice(t.headerRow+1).forEach(r=>{
    const quest=String(r[t.qCol]||'').trim();
    if(wanted.has(v235QuestDateKey_(quest))&&/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim()))confirmed.push(quest);
  });
  if(!confirmed.length)throw new Error('The detected quest is not marked complete yet.');
  const dates=v235ReadQuestDates_();
  confirmed.forEach(q=>dates[v235QuestDateKey_(q)]={date:date,source:'Live detection confirmed',confidence:'manual'});
  PropertiesService.getScriptProperties().setProperty(V235_QUEST_DATE_KEY,JSON.stringify(dates));
  const currentQp=v115CurrentTrackerQp_(ss);
  PropertiesService.getScriptProperties().setProperties({V115_LAST_RECONCILED_QP:String(currentQp),V237_LAST_DETECTION_ACK:JSON.stringify({quests:confirmed,disposition:'confirmed',qp:currentQp,at:new Date().toISOString()})});
  return {ok:true,confirmed:confirmed,state:getV115QuestCompletionState_()};
}

function v236SaveQuestDateChanges_(changes){
  if(!Array.isArray(changes)||!changes.length)return [];
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),t=v115QuestTable_(ss),completed=new Set();
  t.vals.slice(t.headerRow+1).forEach(r=>{
    if(/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim()))completed.add(v235QuestDateKey_(r[t.qCol]));
  });
  const dates=v235ReadQuestDates_(),saved=[];
  changes.forEach(change=>{
    const quest=String(change&&change.quest||'').trim(),date=String(change&&change.date||'').trim(),key=v235QuestDateKey_(quest);
    if(!quest||!completed.has(key))throw new Error('Only completed quests can have a completion date: '+quest);
    if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Use a valid completion date for '+quest+'.');
    dates[key]={date:date,source:date?'Dashboard calendar':'Date intentionally cleared',confidence:'manual'};
    saved.push(quest);
  });
  PropertiesService.getScriptProperties().setProperty(V235_QUEST_DATE_KEY,JSON.stringify(dates));
  return saved;
}

function commitV236QuestChanges(quests,source,reconciledQp,dateChanges,newQuestDate){
  quests=Array.isArray(quests)?quests:[];dateChanges=Array.isArray(dateChanges)?dateChanges:[];
  if(!quests.length&&!dateChanges.length)throw new Error('No quest or date changes are waiting to be confirmed.');
  let completion=null;
  if(quests.length)completion=completeV122QuestsFast(quests,source,reconciledQp,newQuestDate);
  const savedDates=v236SaveQuestDateChanges_(dateChanges);
  if(savedDates.length&&!completion){
    const qp=Math.max(0,Number(reconciledQp)||0);
    PropertiesService.getScriptProperties().setProperty('V115_LAST_RECONCILED_QP',String(qp));
  }
  return {ok:true,changed:completion?completion.changed:[],transactionId:completion?completion.transactionId:'',dashboard:completion?completion.dashboard:null,savedDates:savedDates,state:getV115QuestCompletionState_()};
}

function getV115QuestCompletionState_() {
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);

  const incomplete=[],completed=[];
  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(!quest)return;
    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());
    const item={
      quest,
      qp:t.qpCol>=0 ? Number(r[t.qpCol]||0) : 0,
      row:t.headerRow+2+idx
    };
    (done?completed:incomplete).push(item);
  });
  incomplete.sort((a,b)=>a.quest.localeCompare(b.quest));
  const completionDates=v235SeedQuestDates_(ss,completed.map(x=>x.quest));
  completed.forEach(item=>{
    const found=completionDates[v235QuestDateKey_(item.quest)]||{};
    item.completionDate=found.date||'';
    item.completionDateSource=found.source||'';
    item.completionDateConfidence=found.confidence||'';
    const source=String(found.source||'');
    item.completionDateBadge=/f2p baseline/i.test(source)?'Assumed':(/observed|checklist|project chat/i.test(source)?'Historical':(/runelite/i.test(source)?'RuneLite':(/wiki|live detection/i.test(source)?'WikiSync':(found.date?'Confirmed':'Needs date'))));
  });
  completed.sort((a,b)=>{
    if(!a.completionDate&&!b.completionDate)return a.quest.localeCompare(b.quest);
    if(!a.completionDate)return -1;
    if(!b.completionDate)return 1;
    return b.completionDate.localeCompare(a.completionDate)||a.quest.localeCompare(b.quest);
  });

  const props=PropertiesService.getScriptProperties();
  const current=v115CurrentTrackerQp_(ss);
  let previous=Number(props.getProperty('V115_LAST_RECONCILED_QP')||current);
  if(!props.getProperty('V115_LAST_RECONCILED_QP')){
    props.setProperty('V115_LAST_RECONCILED_QP',String(current));
    previous=current;
  }
  let gain=Math.max(0,current-previous);
  const historyComplete=completed.length>0&&completed.every(x=>!!x.completionDate);
  if(gain>0&&historyComplete&&!props.getProperty('V237_FULL_HISTORY_RECONCILED')){
    props.setProperties({V115_LAST_RECONCILED_QP:String(current),V237_FULL_HISTORY_RECONCILED:new Date().toISOString()});
    previous=current;gain=0;
  }

  const dash=ss.getSheetByName('Dashboard');
  const route=dash.getRange('A60:B69').getDisplayValues().map(r=>r[1]).filter(Boolean);
  const next=dash.getRange('A73:B80').getDisplayValues();
  const nextObj={}; next.forEach(r=>{if(r[0])nextObj[r[0]]=r[1]});
  const nextQuest=nextObj['Quest']||nextObj['Next Quest']||'';

  const likely=incomplete.map(q=>{
    let score=0,reasons=[];
    if(String(q.quest).toLowerCase()===String(nextQuest).toLowerCase()){
      score+=100; reasons.push('Next Session');
    }
    const ri=route.findIndex(x=>String(x).toLowerCase()===q.quest.toLowerCase());
    if(ri>=0){
      score+=50-ri; reasons.push('Current route');
    }
    if(gain>0&&q.qp===gain){
      score+=80; reasons.push('Exact QP match');
    }else if(gain>0&&q.qp>0&&q.qp<=gain){
      score+=20; reasons.push('Fits QP gain');
    }
    return {...q,score,reasons};
  }).filter(q=>q.score>0).sort((a,b)=>b.score-a.score||a.quest.localeCompare(b.quest));

  const detectedOptions=[];
  if(gain>0){
    const pool=likely.slice(0,12);
    const addOption=indexes=>{
      const rows=indexes.map(i=>pool[i]),qp=rows.reduce((sum,q)=>sum+Number(q.qp||0),0);
      if(qp!==gain)return;
      const score=rows.reduce((sum,q)=>sum+Number(q.score||0),0)+(4-rows.length)*15;
      detectedOptions.push({quests:rows.map(q=>q.quest),score,qp});
    };
    for(let a=0;a<pool.length;a++){
      addOption([a]);
      for(let b=a+1;b<pool.length;b++){
        addOption([a,b]);
        for(let c=b+1;c<pool.length;c++)addOption([a,b,c]);
      }
    }
    detectedOptions.sort((a,b)=>b.score-a.score||a.quests.length-b.quests.length);
  }
  const bestDetection=detectedOptions[0]||null, runnerUp=detectedOptions[1]||null;
  const detectedCompletions=bestDetection&&(!runnerUp||bestDetection.score-runnerUp.score>=40)
    ? {quests:bestDetection.quests,confidence:'high',reason:'Quest-point change and current route agree'}
    : null;

  return {
    currentQp:current,
    previousQp:previous,
    detectedGain:gain,
    incomplete,
    completed,
    completionDateSummary:{needsDate:completed.filter(x=>!x.completionDate).length,dated:completed.filter(x=>!!x.completionDate).length,total:completed.length},
    likely,
    detectedCompletions,
    qpDetectionSource:'tracker'
  };
}

function getV115QuestCompletionState(){return getV115QuestCompletionState_();}

function completeV115Quests(quests,source){
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).toLowerCase()));
  const changed=[];

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    if(wanted.has(quest.toLowerCase())&&!/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||''))){
      t.sh.getRange(t.headerRow+2+idx,t.cCol+1).setValue('Yes');
      changed.push(quest);
    }
  });

  if(!changed.length)throw new Error('No incomplete quests matched the selection.');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.appendRow(['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Manual';
  changed.forEach(q=>log.appendRow([now,q,'No','Yes',src,tx]));

  SpreadsheetApp.flush();
  Utilities.sleep(200);

  PropertiesService.getScriptProperties().setProperty(
    'V115_LAST_RECONCILED_QP',
    String(v115CurrentTrackerQp_(ss))
  );

  return {ok:true,changed,transactionId:tx,state:getV115QuestCompletionState_()};
}

function uncompleteV124QuestsFast(quests,source){
  if(!Array.isArray(quests)||!quests.length)throw new Error('Select at least one completed quest.');

  const ss=SpreadsheetApp.openById(V1_TRACKER_ID);
  const t=v115QuestTable_(ss);
  const wanted=new Set(quests.map(x=>String(x).trim().toLowerCase()).filter(Boolean));
  const changed=[],addresses=[];
  const col=v122ColLetter_(t.cCol+1);

  t.vals.slice(t.headerRow+1).forEach((r,idx)=>{
    const quest=String(r[t.qCol]||'').trim();
    const done=/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'').trim());
    if(wanted.has(quest.toLowerCase())&&done){
      changed.push(quest);
      addresses.push(col+String(t.headerRow+2+idx));
    }
  });

  if(!changed.length)throw new Error('No completed quests matched the selection.');
  t.sh.getRangeList(addresses).setValue('No');

  let log=ss.getSheetByName('Quest Completion Log');
  if(!log){
    log=ss.insertSheet('Quest Completion Log');
    log.getRange(1,1,1,6).setValues([['Timestamp','Quest','Previous Status','New Status','Source','Transaction ID']]);
  }

  const tx=Utilities.getUuid(),now=new Date(),src=source||'Dashboard Correction';
  const logRows=changed.map(q=>[now,q,'Yes','No',src,tx]);
  log.getRange(log.getLastRow()+1,1,logRows.length,6).setValues(logRows);
  SpreadsheetApp.flush();

  PropertiesService.getScriptProperties().setProperty(
    'V115_LAST_RECONCILED_QP',
    String(v115CurrentTrackerQp_(ss))
  );

  const dashboard=getV1DashboardState({allowQuestHelperSync:false});
  return {ok:true,changed,transactionId:tx,state:getV115QuestCompletionState_(),dashboard};
}

function undoV115QuestCompletion(transactionId){
  if(!transactionId)throw new Error('Undo transaction ID is required.');
  const ss=SpreadsheetApp.openById(V1_TRACKER_ID),log=ss.getSheetByName('Quest Completion Log');
  if(!log)throw new Error('No quest completion log exists.');

  const lv=log.getDataRange().getDisplayValues();
  const quests=lv.slice(1).filter(r=>r[5]===transactionId&&String(r[3]).toLowerCase()==='yes').map(r=>r[1]);
  if(!quests.length)throw new Error('Completion transaction not found.');
  return uncompleteV124QuestsFast(quests,'Dashboard Immediate Undo');
}
