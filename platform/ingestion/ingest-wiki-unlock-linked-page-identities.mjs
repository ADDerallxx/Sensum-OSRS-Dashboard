import fs from 'node:fs/promises';
import path from 'node:path';
import {hash,writeSnapshot} from './lib.mjs';
import {wikiRevisionMetadataResolutions,WIKI_API} from './activity-evidence-lib.mjs';
import {buildUnlockLinkedPageIdentities,collectUnlockLinkedTargetReferences} from './unlock-linked-page-identity-lib.mjs';

const root=path.resolve(process.argv.find(argument=>argument.startsWith('--root='))?.slice(7)||process.argv.find(argument=>argument.startsWith('--out='))?.slice(6)||'.platform-data');
const directories=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map(entry=>entry.name).sort().reverse();
let input=null;const rejections=[];
for(const directory of directories){const file=path.join(root,directory,'skill-level-unlock-inventory.ndjson');try{const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,directory,'manifest.json'),'utf8')),reasons=[];if(manifest.domain!=='skill-level-unlock-inventory')reasons.push('manifest_domain_mismatch');if(manifest.records!==rows.length)reasons.push('record_count_mismatch');if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');if(manifest.source?.audit?.publishable!==true||!rows.every(row=>row.rawInventoryComplete===true))reasons.push('raw_inventory_not_publishable');if(reasons.length){rejections.push({directory,reasons});continue}input={directory,rows,manifest};break}catch(error){if(error.code!=='ENOENT')rejections.push({directory,reasons:['snapshot_validation_error'],message:error.message})}}
if(!input)throw new Error('No validated cross-skill level-up-table inventory snapshot exists.');
const references=collectUnlockLinkedTargetReferences(input.rows),resolutions=await wikiRevisionMetadataResolutions(references.map(reference=>reference.requestedTitle)),built=buildUnlockLinkedPageIdentities({unlockRecords:input.rows,resolutions}),source={kind:'osrs_wiki_unlock_linked_page_identity_crosswalk',api:WIKI_API,inputSnapshot:{directory:input.directory,contentHash:input.manifest.contentHash,skillsRevision:input.manifest.source.skillDomain.revision,rejections},audit:built.audit},snapshot=await writeSnapshot(root,'unlock-linked-page-identity',built.records.map(record=>({...record,contentHash:hash(record)})),source);
console.log(JSON.stringify({manifest:{...snapshot.manifest,source:{...source,audit:undefined}},coverage:built.audit},null,2));if(!built.audit.publishable)process.exitCode=2;
