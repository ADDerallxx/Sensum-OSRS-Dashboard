import fs from 'node:fs/promises';import crypto from 'node:crypto';
const files=['GameDataPlatformV285.js','EquipmentKnowledgeV287.js','TrainingIntelligenceV281.js','LoadoutOptimizerV288.js','CombatEffectsV289.js','SetEffectsV290.js'];
const rows=[];for(const file of files){const text=await fs.readFile(file,'utf8');rows.push({file,bytes:Buffer.byteLength(text),sha256:crypto.createHash('sha256').update(text).digest('hex'),formulaReferences:(text.match(/formula/gi)||[]).length,sourceReferences:(text.match(/https:\/\//g)||[]).length,reviewMarkers:(text.match(/REVIEW|BLOCKED|fallback/gi)||[]).length})}
const summary={contract:'sensum.legacy-catalog-audit.v1',generatedAt:new Date().toISOString(),files:rows,totalBytes:rows.reduce((s,x)=>s+x.bytes,0),blockers:[]};
if(!rows.every(x=>x.sourceReferences>0))summary.blockers.push('Every migrated catalog must retain at least one source reference.');
if(rows.some(x=>x.reviewMarkers>0))summary.blockers.push('Legacy REVIEW/BLOCKED/fallback records must be resolved or quarantined before absolute-best claims.');
console.log(JSON.stringify(summary,null,2));

