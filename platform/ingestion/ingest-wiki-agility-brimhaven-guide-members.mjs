import path from 'node:path';
import {audit,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseAgilityBrimhavenGuideMembers} from './agility-brimhaven-guide-member-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data'),title='Agility training',pages=await wikiRevisions([title]),page=pages.find(candidate=>candidate.title===title),revision=page?.revisions?.[0],parsed=parseAgilityBrimhavenGuideMembers({title:page?.title,content:revision?.slots?.main?.content||'',sourceRevision:revision?.revid,sourceTimestamp:revision?.timestamp,sourceUrl:'https://oldschool.runescape.wiki/w/Agility_training'}),structural=audit(parsed.records,{minimum:3,required:['memberKey','candidateKey','name','sourceOrder','strategyPolicy','sourceRevision','sourceTimestamp','sourceUrl','sourceLocator'],maximumUnknownRatio:0}),sourceAudit={...parsed.audit,findings:structural.findings,publishable:parsed.audit.publishable&&structural.publishable};
const snapshot=await writeSnapshot(root,'agility-brimhaven-guide-members',parsed.records,{kind:'osrs_wiki_agility_training_guide_brimhaven_fastest_member_inventory',api:WIKI_API,pages:[title],coverageScope:'every_distinct_strategy_in_the_levels_20_to_47_brimhaven_section',audit:sourceAudit});
console.log(JSON.stringify({manifest:snapshot.manifest,members:parsed.records.map(record=>({memberKey:record.memberKey,candidateKey:record.candidateKey,name:record.name})),findings:[...parsed.audit.blockers,...structural.findings]},null,2));
