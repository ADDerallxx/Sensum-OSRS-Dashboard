import fs from 'node:fs/promises';import path from 'node:path';
import {hash} from '../ingestion/lib.mjs';

export async function discoverVariantSnapshots(root){
  const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse(),seen=new Set(),snapshots=[],rejections=[];
  for(const dir of dirs){let files=[];try{files=(await fs.readdir(path.join(root,dir),{withFileTypes:true})).filter(x=>x.isFile()&&/-variants\.ndjson$/.test(x.name))}catch{}
    for(const entry of files){if(seen.has(entry.name))continue;const file=path.join(root,dir,entry.name),domain=entry.name.replace(/\.ndjson$/,'');try{const raw=await fs.readFile(file,'utf8'),rows=raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse),manifest=JSON.parse(await fs.readFile(path.join(root,dir,'manifest.json'),'utf8')),reasons=[];if(manifest.domain!==domain)reasons.push('manifest_domain_mismatch');if(manifest.source?.audit?.publishable!==true)reasons.push('source_audit_not_publishable');if(manifest.records!==rows.length)reasons.push('record_count_mismatch');if(manifest.contentHash!==hash(raw))reasons.push('content_hash_mismatch');if(reasons.length){rejections.push({domain,dir,reasons});continue}seen.add(entry.name);snapshots.push({domain,dir,file,rows,manifest})}catch(error){rejections.push({domain,dir,reasons:['snapshot_validation_error'],message:error.message})}}
  }
  return {snapshots,rejections};
}

export async function latestVariantSnapshots(root){return (await discoverVariantSnapshots(root)).snapshots}
export async function latestVariantParents(root){const state=await discoverVariantSnapshots(root);return {parents:new Set(state.snapshots.flatMap(snapshot=>snapshot.rows.map(row=>row.parent_name)).filter(Boolean)),rejections:state.rejections}}
