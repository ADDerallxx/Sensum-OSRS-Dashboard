import path from 'node:path';
import {hash,writeSnapshot} from './lib.mjs';
import {wikiRevisions,WIKI_API} from './activity-evidence-lib.mjs';
import {parseSkillLevelDomains} from './skill-level-domain-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data');
const page=(await wikiRevisions(['Skills']))[0],revision=page?.revisions?.[0];
if(!revision)throw new Error('The official Skills page did not return a revision.');
const sourceUrl='https://oldschool.runescape.wiki/w/Skills';
const parsed=parseSkillLevelDomains({title:page.title,content:revision.slots?.main?.content||'',sourceRevision:revision.revid,sourceTimestamp:revision.timestamp,sourceUrl});
const records=parsed.records.map(record=>({...record,contentHash:hash(record)}));
const source={kind:'osrs_wiki_skill_level_domains',api:WIKI_API,page:'Skills',revision:String(revision.revid),timestamp:revision.timestamp,audit:parsed.audit};
const snapshot=await writeSnapshot(root,'skill-level-domains',records,source);
console.log(JSON.stringify({manifest:snapshot.manifest,audit:parsed.audit},null,2));
if(!parsed.audit.publishable)process.exitCode=2;
