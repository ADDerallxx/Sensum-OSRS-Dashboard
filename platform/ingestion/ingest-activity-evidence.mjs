import fs from 'node:fs/promises';
import path from 'node:path';
import {audit,fetchJson,hash,writeSnapshot} from './lib.mjs';
import {evidenceFragments,evidencePatterns,WIKI_API,wikiRevisions} from './activity-evidence-lib.mjs';

const API=WIKI_API;
const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const limit=Math.max(1,Math.min(500,Number(process.argv.find(x=>x.startsWith('--limit='))?.slice(8)||100)));
const preferred=(process.argv.find(x=>x.startsWith('--skills='))?.slice(9)||'Prayer,Agility,Thieving,Firemaking,Mining,Woodcutting,Fishing,Hunter').split(',').map(x=>x.trim()).filter(Boolean);

async function latestQueue(){
  const base=path.join(root,'activity'),dirs=(await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  for(const dir of dirs){const file=path.join(base,dir,'enrichment-queue.ndjson');try{return {dir,file,rows:(await fs.readFile(file,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)}}catch{}}
  throw new Error('No activity enrichment queue found. Run activity-readiness.mjs first.');
}

const queue=await latestQueue(),weight=new Map(preferred.map((x,i)=>[x,preferred.length-i]));
const pages=new Map();
for(const row of queue.rows){
  if(!row.sourceUrl)continue;
  const score=Math.max(0,...(row.skills||[]).map(x=>weight.get(x)||0));
  const current=pages.get(row.sourceUrl)||{sourceUrl:row.sourceUrl,title:decodeURIComponent(row.sourceUrl.split('/w/')[1]||'').replace(/_/g,' '),score:0,skills:new Set(),recordKeys:[]};
  current.score=Math.max(current.score,score);for(const skill of row.skills||[])current.skills.add(skill);if(current.recordKeys.length<25)current.recordKeys.push(row.recordKey);pages.set(row.sourceUrl,current);
}
const ranked=[...pages.values()].sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
const selected=[],selectedUrls=new Set(),perSkill=new Map(preferred.map(skill=>[skill,ranked.filter(page=>page.skills.has(skill))]));
let cursor=0;
while(selected.length<limit){
  let added=false;
  for(const skill of preferred){
    const candidates=perSkill.get(skill)||[];
    while(cursor<candidates.length&&selectedUrls.has(candidates[cursor].sourceUrl))candidates.splice(cursor,1);
    const candidate=candidates[cursor];
    if(candidate&&!selectedUrls.has(candidate.sourceUrl)){selected.push(candidate);selectedUrls.add(candidate.sourceUrl);added=true;if(selected.length===limit)break}
  }
  if(!added)break;
  cursor++;
}
for(const page of ranked)if(selected.length<limit&&!selectedUrls.has(page.sourceUrl)){selected.push(page);selectedUrls.add(page.sourceUrl)}

const raw=await wikiRevisions(selected.map(x=>x.title)),byTitle=new Map(selected.map(x=>[x.title.toLowerCase(),x]));
const records=raw.filter(x=>!x.missing).map(page=>{
  const revision=page.revisions?.[0]||{},content=revision.slots?.main?.content||'',selection=byTitle.get(String(page.title||'').toLowerCase())||selected.find(x=>x.title.toLowerCase()===String(page.title||'').toLowerCase())||{};
  const evidence=evidenceFragments(content),kinds=[...new Set(evidence.map(x=>x.kind))];
  const row={record_key:`activity-evidence:${page.pageid}`,name:page.title,page_id:page.pageid,skills:[...(selection.skills||[])],activity_record_keys:selection.recordKeys||[],source_url:selection.sourceUrl||`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(page.title).replace(/ /g,'_'))}`,source_revision:String(revision.revid||''),source_timestamp:revision.timestamp||null,state:'candidate',evidence_kinds:kinds,evidence_fragments:evidence,content_hash:hash(content)};
  return row;
});
const report=audit(records,{minimum:Math.min(limit,Math.max(1,selected.length)),required:['name','source_revision','source_timestamp','content_hash'],maximumUnknownRatio:0});
const snapshot=await writeSnapshot(root,'activity-evidence',records,{kind:'osrs_wiki_revision_evidence',api:API,queue:queue.dir,requested:limit,selection:'skill_round_robin',preferredSkills:preferred,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,pagesRequested:selected.length,pagesCaptured:records.length,skillCoverage:Object.fromEntries(preferred.map(skill=>[skill,records.filter(x=>x.skills.includes(skill)).length])),evidenceKinds:Object.fromEntries(Object.keys(evidencePatterns).map(kind=>[kind,records.filter(x=>x.evidence_kinds.includes(kind)).length])),findingCount:report.findings.length},null,2));
