const V270_RECIPE_USER_AGENT='SensumOSRSDashboard/2.70a (Wiki-backed recipe resolver)';

function v270DecodeHtml_(value){
  const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ndash:'–',mdash:'—',times:'×',middot:'·'};
  return String(value||'').replace(/&#(x?[0-9a-f]+);/gi,(m,n)=>String.fromCharCode(parseInt(n.replace(/^x/i,''),/^x/i.test(n)?16:10))).replace(/&([a-z]+);/gi,(m,n)=>named[n.toLowerCase()]||m);
}
function v270PlainText_(html){return v270DecodeHtml_(String(html||'').replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function v270Norm_(value){return v270PlainText_(value).toLowerCase().replace(/\s+/g,'').replace(/dose/g,'')}
function v270Cells_(row){const cells=[];String(row||'').replace(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi,(m,tag,html)=>{cells.push({html:html,text:v270PlainText_(html),header:tag.toLowerCase()==='th'});return m});return cells}
function v270ItemName_(html){
  const titles=[];String(html||'').replace(/<a\b[^>]*title="([^"]+)"[^>]*>/gi,(m,title)=>{title=v270DecodeHtml_(title).replace(/\s*\(page does not exist\)$/i,'').trim();if(title&&!/^(File|Category|Template|Calculator|Special):/i.test(title))titles.push(title);return m});
  return titles[0]||v270PlainText_(html).replace(/^\d+\s*[×x]\s*/i,'').trim();
}
function v270Number_(value){const match=String(value||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):0}
function v270WikiApi_(params){
  const query=Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&'),response=UrlFetchApp.fetch('https://oldschool.runescape.wiki/api.php?'+query,{headers:{'User-Agent':V270_RECIPE_USER_AGENT},muteHttpExceptions:true});
  if(response.getResponseCode()<200||response.getResponseCode()>=300)throw new Error('OSRS Wiki returned HTTP '+response.getResponseCode()+'.');return JSON.parse(response.getContentText());
}
function v270Skill_(html){
  const rows=[];String(html||'').replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,(m,row)=>{const cells=v270Cells_(row);if(cells.length>=2)rows.push(cells);return m});
  const skills=['Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft','Construction','Hitpoints','Agility','Herblore','Thieving','Crafting','Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking','Firemaking','Woodcutting','Farming'];
  for(const row of rows){const joined=row.map(x=>x.text).join(' '),skill=skills.find(x=>new RegExp('\\b'+x+'\\b','i').test(joined));if(skill){const nums=row.slice(1).map(x=>v270Number_(x.text)).filter(x=>x>0);if(nums.length)return {skill:skill,level:nums[0],xpEach:nums.length>1?nums[nums.length-1]:0}}}return {skill:'Processing',level:0,xpEach:0};
}
function v270RecipeFromHtml_(html,selected,meta){
  const tables=[];String(html||'').replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi,(m,table)=>{tables.push(table);return m});
  const skill=v270Skill_(html),wanted=v270Norm_(selected.name),candidates=[];
  tables.forEach(table=>{
    const rows=[];String(table).replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,(m,row)=>{const cells=v270Cells_(row);if(cells.length)rows.push(cells);return m});
    const headerIndex=rows.findIndex(r=>r.some(c=>/^item$/i.test(c.text))&&r.some(c=>/^quantity$/i.test(c.text)));
    if(headerIndex<0)return;let totalIndex=-1,output=null;const inputs=[];
    for(let i=headerIndex+1;i<rows.length;i++){
      const row=rows[i],joined=row.map(c=>c.text).join(' ').trim();if(!joined)continue;
      if(/^total cost\b/i.test(joined)){totalIndex=i;continue}if(/^profit\b|^loss\b|^profit after/i.test(joined))continue;
      // Wiki recipe rows are: icon, item, quantity, cost. Never scan for the
      // first number: dose-bearing names such as Prayer potion(3) contain a
      // number that is part of the item name, not the produced quantity.
      const itemCell=row.find(c=>/<a\b/i.test(c.html))||row[0],item=v270ItemName_(itemCell.html),quantityCell=row.length>=3?row[row.length-2]:null,quantity=Math.max(0,v270Number_(quantityCell&&quantityCell.text));if(!item||!quantity)continue;
      const entry={item:item,quantity:quantity};if(totalIndex<0)inputs.push(entry);else if(!output)output=entry;
    }
    if(output&&inputs.length&&v270Norm_(output.item)===wanted)candidates.push({inputs:inputs,output:output});
  });
  if(candidates.length!==1)return null;const found=candidates[0];return {recipe:(skill.skill==='Processing'?'Wiki creation':' '+skill.skill).trim()+' — '+selected.name,output:selected.name,outputQuantity:found.output.quantity||1,skill:skill.skill,level:skill.level,xpEach:skill.xpEach,inputs:found.inputs.map(x=>({item:x.item,quantity:x.quantity/(found.output.quantity||1)})),source:meta.source,verified:Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/Denver','yyyy-MM-dd'),revision:String(meta.revision||''),verification:'OSRS Wiki creation table',modifierGroups:[]};
}
function v270ResolveWikiRecipe_(item){
  const selected={id:Number(item&&item.id||0),name:String(item&&item.name||item||'').trim()};if(!selected.name)return null;const cache=CacheService.getScriptCache(),key='V270A_RECIPE_'+Utilities.base64EncodeWebSafe(selected.name.toLowerCase()).slice(0,150),cached=cache.get(key);if(cached)return cached==='null'?null:JSON.parse(cached);
  try{
    const info=v270WikiApi_({action:'parse',format:'json',formatversion:2,page:selected.name,prop:'sections|revid',redirects:1,disabletoc:1}),parsed=info.parse;if(!parsed)throw new Error('Item page was not found.');
    const sections=(parsed.sections||[]).filter(s=>/^creation$/i.test(v270PlainText_(s.line)));if(!sections.length){cache.put(key,'null',21600);return null}
    const recipes=[];sections.slice(0,5).forEach(section=>{const data=v270WikiApi_({action:'parse',format:'json',formatversion:2,page:parsed.title,prop:'text',section:section.index,redirects:1,disabletoc:1}),html=data.parse&&data.parse.text||'',recipe=v270RecipeFromHtml_(html,selected,{revision:parsed.revid,source:'https://oldschool.runescape.wiki/w/'+encodeURIComponent(String(parsed.title||selected.name).replace(/ /g,'_'))});if(recipe)recipes.push(recipe)});
    const recipe=recipes.length===1?recipes[0]:null;cache.put(key,recipe?JSON.stringify(recipe):'null',21600);return recipe;
  }catch(e){console.warn('V2.70 recipe resolution failed for '+selected.name+': '+e.message);return null}
}
