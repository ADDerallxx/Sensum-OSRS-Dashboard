import assert from 'node:assert/strict';
import test from 'node:test';

import {hash} from '../ingestion/lib.mjs';
import {
  buildSkillUnlockMaterializationSql,
  deterministicUuid,
  validateSkillUnlockMaterializationInput,
  verifyReconciliation
} from '../db/skill-unlock-materialization-lib.mjs';

function fixture() {
  const record = {
    contract:'sensum.skill-level-unlock-inventory.v1',skillKey:'agility',skill:'Agility',category:'gathering',minimumBaseLevel:1,maximumBaseLevel:99,accountIndependent:true,
    sourceRevision:'123',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Agility%2FLevel_up_table',sourceContentHash:'a'.repeat(64),sourceLocator:{lineStart:1,lineEnd:3,template:'Level up table'},
    parameters:[{parameterName:'members1',availability:'members',level:1,declaredEmpty:false,entryCount:1,sourceLocator:{lineStart:1,lineEnd:2},entries:[{entryKey:'agility:members1:1',sequence:1,availability:'members',level:1,sourceText:'* Use an obstacle',sourceLeadingVerb:'Use',linkedTargets:['Obstacle'],classificationState:'pending_semantic_activity_classification',repeatableTrainingActivity:null,optimizerEligible:false,blockers:['semantic_identity_and_repeatability_not_classified'],sourceLocator:{lineStart:2,lineEnd:2,parameter:'members1'}}]}],
    parameterCount:1,sourceBulletCount:1,capturedStatementCount:1,rawInventoryComplete:true,blockers:[],state:'candidate'
  };
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n';
  const directory='2026-09-01T00-00-00-000Z';
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'skill-level-unlock-inventory',createdAt:'2026-09-01T00:00:00Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'osrs_wiki_cross_skill_level_up_table_raw_discovery_inventory',api:'https://oldschool.runescape.wiki/api.php',skillDomain:{revision:'456',skills:[{skillKey:'agility',minimumBaseLevel:1,maximumBaseLevel:99}]},levelUpTables:[{skillKey:'agility',title:'Agility/Level up table',revision:'123',timestamp:'2026-09-01T00:00:00Z',sourceContentHash:'a'.repeat(64),parameterCount:1,statementCount:1}]}};
  const audit={contract:'sensum.skill-level-unlock-inventory-audit.v1',accountIndependent:true,officialSkillDomain:{inventorySkillCount:1},statementCoverage:{capturedStatementCount:1,sourceBulletCount:1,countsMatch:true},embeddedAccountQueryState:[],rawInventoryComplete:true,semanticallyClassifiedActivityCount:0,optimizerEligibleActivityCount:0,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',publishable:true,inputSnapshot:{directory,contentHash:manifest.contentHash},contentHash:'b'.repeat(64)};
  manifest.source.audit={publishable:true,rawInventoryComplete:true,optimizerEligibleActivityCount:0,completeActivityUniverse:false};
  audit.contentHash=hash(Object.fromEntries(Object.entries(audit).filter(([name])=>name!=='contentHash')));
  return {raw,manifest,audit,record};
}

test('accepted raw evidence produces deterministic, optimizer-ineligible materialization',()=>{
  const input=fixture(),first=validateSkillUnlockMaterializationInput(input),second=validateSkillUnlockMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.equal(first.runId,second.runId);
  assert.deepEqual(first.counts,{skills:1,sources:1,records:1,statements:1});
  assert.deepEqual(first.gates,{rawInventoryComplete:true,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false});
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('tampered snapshots and weakened semantic gates fail before SQL exists',()=>{
  const tampered=fixture(); tampered.raw=tampered.raw.replace('Use an obstacle','Use any obstacle');
  assert.throws(()=>validateSkillUnlockMaterializationInput(tampered),/snapshot_content_hash_mismatch/);
  const promoted=fixture(); promoted.audit.optimizerEligibleActivityCount=1;
  assert.throws(()=>validateSkillUnlockMaterializationInput(promoted),/audit_semantic_gate_weakened/);
  const accountBound=fixture(); accountBound.record.currentBaseLevel=34; accountBound.record.contentHash=hash(Object.fromEntries(Object.entries(accountBound.record).filter(([name])=>name!=='contentHash'))); accountBound.raw=JSON.stringify(accountBound.record)+'\n'; accountBound.manifest.contentHash=hash(accountBound.raw); accountBound.audit.inputSnapshot.contentHash=accountBound.manifest.contentHash; accountBound.audit.contentHash=hash(Object.fromEntries(Object.entries(accountBound.audit).filter(([name])=>name!=='contentHash')));
  assert.throws(()=>validateSkillUnlockMaterializationInput(accountBound),/record_account_state_present/);
});

test('SQL is transactional, insert-only, candidate-preserving, and idempotent by conflict keys',()=>{
  const model=validateSkillUnlockMaterializationInput(fixture()),sql=buildSkillUnlockMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/activity_evidence/);
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
});

test('reconciliation rejects count, hash, state, and completeness drift',()=>{
  const model=validateSkillUnlockMaterializationInput(fixture()),actual={runId:model.runId,status:'published',records:1,sources:1,statements:1,lineage:1,skills:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,completeActivityUniverse:false,optimizerEligibleRecords:0,automaticVerification:false}};
  assert.equal(verifyReconciliation(model,actual),true);
  assert.throws(()=>verifyReconciliation(model,{...actual,statements:0}),/statements_count_mismatch/);
  assert.throws(()=>verifyReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyReconciliation(model,{...actual,metrics:{...actual.metrics,optimizerEligibleRecords:1}}),/semantic_gate_weakened/);
});

test('deterministic UUIDs are stable and namespace separated',()=>{
  assert.equal(deterministicUuid('a','b'),deterministicUuid('a','b'));
  assert.notEqual(deterministicUuid('a','b'),deterministicUuid('b','a'));
  assert.match(deterministicUuid('a','b'),/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
