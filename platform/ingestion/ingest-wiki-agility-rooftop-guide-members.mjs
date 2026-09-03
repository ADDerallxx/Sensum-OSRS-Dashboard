import path from 'node:path';
import {audit,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityRooftopGuideMembers} from './agility-rooftop-guide-member-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data'),title='Agility training',pages=await wikiRevisions([title]),page=pages.find(candidate=>candidate.title===title),revision=page?.revisions?.[0],parsed=parseAgilityRooftopGuideMembers({title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'}),structural=audit(parsed.records,{minimum:9,required:['memberKey','courseName','sourceOrder','guideLevelScopeLabel','sourceRevision','sourceTimestamp','sourceUrl','sourceLocator'],maximumUnknownRatio:0}),sourceAudit={...parsed.audit,findings:structural.findings,publishable:parsed.audit.publishable&&structural.publishable};
const snapshot=await writeSnapshot(root,'agility-rooftop-guide-members',parsed.records,{kind:'osrs_wiki_agility_training_guide_rooftop_member_inventory',api:WIKI_API,pages:[title],coverageScope:'every_rooftop_table_member_in_source_order',audit:sourceAudit});
console.log(JSON.stringify({manifest:snapshot.manifest,members:parsed.records.map(record=>({memberKey:record.memberKey,courseName:record.courseName,guideLevelScopeLabel:record.guideLevelScopeLabel})),findings:[...parsed.audit.blockers,...structural.findings]},null,2));
