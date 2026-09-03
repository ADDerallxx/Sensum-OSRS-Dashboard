import path from 'node:path';
import {audit,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityTrainingGuideSectionInventory} from './agility-training-guide-section-inventory-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data'),title='Agility training';
const pages=await wikiRevisions([title]),page=pages.find(candidate=>candidate.title===title),revision=page?.revisions?.[0];
const parsed=parseAgilityTrainingGuideSectionInventory({title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'});
const structural=audit(parsed.records,{minimum:1,required:['sectionKey','title','depth','sectionRole','materialToCandidateUniverse','sourceRevision','sourceTimestamp','sourceUrl','sourceLocator'],maximumUnknownRatio:0}),sourceAudit={...parsed.audit,findings:structural.findings,publishable:parsed.audit.publishable&&structural.publishable};
const snapshot=await writeSnapshot(root,'agility-training-guide-sections',parsed.records,{kind:'osrs_wiki_agility_training_guide_complete_heading_inventory',api:WIKI_API,pages:[title],coverageScope:'every_wiki_heading_in_source_order',audit:sourceAudit});
console.log(JSON.stringify({manifest:snapshot.manifest,headingCount:parsed.records.length,materialSectionCount:parsed.records.filter(record=>record.materialToCandidateUniverse).length,roles:Object.fromEntries([...new Set(parsed.records.map(record=>record.sectionRole))].map(role=>[role,parsed.records.filter(record=>record.sectionRole===role).length])),findings:structural.findings},null,2));
