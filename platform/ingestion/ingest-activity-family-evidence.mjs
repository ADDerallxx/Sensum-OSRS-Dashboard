import path from 'node:path';
import {audit,hash,writeSnapshot} from './lib.mjs';
import {evidenceFragments,evidencePatterns,WIKI_API,wikiCategoryMembers,wikiRevisions} from './activity-evidence-lib.mjs';

const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const family=process.argv.find(x=>x.startsWith('--family='))?.slice(9)||'';
const configs={agility_course:{category:'Agility courses',skill:'Agility'}};
if(!configs[family])throw new Error(`Unsupported family ${family||'(missing)'}. Available: ${Object.keys(configs).join(', ')}`);
const cfg=configs[family],members=await wikiCategoryMembers(cfg.category),pages=await wikiRevisions(members.map(x=>x.title));
const records=pages.filter(x=>!x.missing).map(page=>{const revision=page.revisions?.[0]||{},content=revision.slots?.main?.content||'',evidence=evidenceFragments(content,{limit:120});return {record_key:`activity-family-evidence:${family}:${page.pageid}`,name:page.title,page_id:page.pageid,family_hint:family,skills:[cfg.skill],source_url:`https://oldschool.runescape.wiki/w/${encodeURIComponent(String(page.title).replace(/ /g,'_'))}`,source_revision:String(revision.revid||''),source_timestamp:revision.timestamp||null,state:'candidate',evidence_kinds:[...new Set(evidence.map(x=>x.kind))],evidence_fragments:evidence,content_hash:hash(content)}});
const report=audit(records,{minimum:members.length,required:['name','family_hint','source_revision','source_timestamp','content_hash'],maximumUnknownRatio:0}),snapshot=await writeSnapshot(root,'activity-evidence',records,{kind:'osrs_wiki_category_family_evidence',api:WIKI_API,family,category:cfg.category,categoryMembers:members.length,audit:report});
console.log(JSON.stringify({manifest:snapshot.manifest,publishable:report.publishable,categoryMembers:members.length,pagesCaptured:records.length,evidenceKinds:Object.fromEntries(Object.keys(evidencePatterns).map(kind=>[kind,records.filter(x=>x.evidence_kinds.includes(kind)).length])),findings:report.findings},null,2));
