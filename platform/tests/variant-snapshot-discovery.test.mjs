import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {hash,json} from '../ingestion/lib.mjs';import {discoverVariantSnapshots,latestVariantParents} from '../transforms/variant-snapshot-lib.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'sensum-variant-test-')),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
try{
  const write=async(name,domain,row,publishable=true)=>{const dir=path.join(root,name),raw=json(row)+'\n';await fs.mkdir(dir);await fs.writeFile(path.join(dir,`${domain}.ndjson`),raw);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({domain,records:1,contentHash:hash(raw),source:{audit:{publishable}}}))};
  await write('2026-01-01T00-00-00-000Z','alpha-variants',{parent_name:'Current parent',variant_key:'valid'});
  await write('2026-01-02T00-00-00-000Z','beta-variants',{parent_name:'Second parent',variant_key:'only'});
  await write('2026-01-03T00-00-00-000Z','alpha-variants',{parent_name:'Rejected parent',variant_key:'invalid'},false);
  const state=await discoverVariantSnapshots(root),snapshots=state.snapshots,parentState=await latestVariantParents(root),parents=parentState.parents;
  check(snapshots.length===2,'Discovery must select one latest snapshot per variant domain.');
  check(parents.has('Current parent')&&parents.has('Second parent')&&!parents.has('Rejected parent'),'A failed newer snapshot must not replace the last valid immutable snapshot.');
  check(state.rejections.some(x=>x.domain==='alpha-variants'&&x.reasons.includes('source_audit_not_publishable')),'Rejected snapshots must remain explicit in discovery output.');
}finally{await fs.rm(root,{recursive:true,force:true})}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Variant snapshot discovery checks passed.');
