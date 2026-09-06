import test from 'node:test';
import assert from 'node:assert/strict';

import {hash} from '../ingestion/lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND,
  buildActivityReferenceMemberSignalScopeExistingSourceCountQuery,
  buildActivityReferenceMemberSignalScopeMaterializationSql,
  validateActivityReferenceMemberSignalScopeMaterializationInput,
  verifyActivityReferenceMemberSignalScopeReconciliation
} from '../db/activity-reference-member-independent-repeatability-signal-scope-evidence-materialization-lib.mjs';

const POLICY_ID='sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-policy.v1';
const POLICY_FILE='platform/policies/activity-reference-collection-member-independent-repeatability-signal-scope-evidence-v1.json';
const POLICY_HASH='d67ac681770347a59dfb8c72bc246b359978e1c55c5362869fd626364381b8a1';
const requiredAuditBlockers=['independent_repeatability_signal_scope_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','independent_complete_activity_universe_not_established'];
const requiredRecordBlockers=['independent_repeatability_signal_scope_evidence_requires_semantic_disposition','canonical_activity_scope_review_incomplete','repeatability_classification_unresolved','member_expansion_not_reviewed','requirements_xp_timing_and_mechanics_not_structured','optimizer_eligibility_blocked'];
const without=(value,key)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!==key));

function fixture() {
  const memberCandidateKey='member:1',canonicalActivityKey='activity:example';
  const sourceContent='Repeat [[Target page]].';
  const source={sourcePageId:42,resolvedTitle:'Example activity',sourceRevision:'123',sourceTimestamp:'2026-09-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Example_activity',sourceContentHash:hash(sourceContent)};
  const target={sourcePageId:84,resolvedTitle:'Target page',sourceRevision:'456',sourceTimestamp:'2026-09-02T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Target_page',sourceContentHash:'a'.repeat(64)};
  const signalEvidenceKey=`${memberCandidateKey}:repeatability:1`,linkOccurrenceKey='guide-pageid:42:link:1',sourceLocator={columnStart:1,columnEnd:6,lineStart:1,lineEnd:1},linkLocator={excerpt:sourceContent,line:1};
  const located={contextText:sourceContent,definitionKey:'explicit_positive_repeatable_adjective',evidenceKey:signalEvidenceKey,matchedText:'Repeat',reviewState:'candidate_only_not_a_repeatability_verdict',scannedTextHash:source.sourceContentHash,signalKind:'explicit_positive_repeatability_declaration_candidate',sourceContentHash:source.sourceContentHash,sourceLocator,sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceScope:'fixture'};
  const link={channels:['independent_repeatability_source_discovery'],displayText:null,guideContentHash:source.sourceContentHash,guidePageId:source.sourcePageId,guideRevision:source.sourceRevision,guideTimestamp:source.sourceTimestamp,guideTitle:source.resolvedTitle,guideUrl:source.sourceUrl,namespaceClass:'main',occurrenceKey:linkOccurrenceKey,requestedFragment:null,requestedTitle:'Target page',skillKeys:[],sourceLocator:linkLocator,sourceTarget:'Target page'};
  const assessment={canonicalActivityScopeVerdict:null,displayText:null,linkOccurrenceKey,normalizedTitle:'Target page',redirected:false,repeatabilityVerdict:null,requestedFragment:null,requestedTitle:'Target page',resolutionState:'revision_pinned_official_wiki_main_namespace_page',resolvedTitle:target.resolvedTitle,signalEvidenceKey,sourceLocator:linkLocator,stableIdentityComparisons:{targetMatchesCollectionAnchor:false,targetMatchesLinkedSubjectAnchor:false,targetMatchesSignalSourcePage:false},targetPageIdentity:target};
  const targetGroup={linkOccurrenceContexts:[{displayText:null,linkOccurrenceKey,requestedFragment:null,requestedTitle:'Target page',signalEvidenceKey,sourceLocator:linkLocator}],requestedTitles:['Target page'],targetPageIdentity:target};
  const packet={canonicalActivityScopeVerdict:null,deficiencies:[],exactLineSourceAuthoredMainNamespaceLinks:[link],limitations:[],linkResolutionAssessments:[assessment],repeatabilityVerdict:null,resolvedTargetPages:[targetGroup],signalEvidenceKey,sourceCandidate:source,sourceLocatedSignal:located,stableIdentityComparisons:{collectionAnchorTargetOccurrenceKeys:[],linkedSubjectAnchorTargetOccurrenceKeys:[],signalSourcePageMatchesCollectionAnchor:false,signalSourcePageMatchesLinkedSubjectAnchor:false,signalSourceTargetOccurrenceKeys:[]},state:'complete_revision_pinned_exact_line_link_scope_evidence'};
  const candidatePage={...source,sourceContent,sourceLocatedSignals:[located]};
  const record={accountIndependent:true,blockers:requiredRecordBlockers,canonicalActivityIdentity:{canonicalActivityKey},canonicalGameEntityIdentity:null,contract:'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence.v1',independentRepeatabilitySourceEvidence:{candidatePages:[candidatePage],evidenceState:'complete_revision_pinned_independent_repeatability_source_evidence_packet'},independentRepeatabilitySignalScopeEvidence:{evidenceState:'complete_revision_pinned_independent_repeatability_signal_scope_evidence_packet',resolvedTargetPages:[targetGroup],scopeEvidenceChannel:'source_authored_main_namespace_links_on_exact_signal_lines',signalScopeEvidencePackets:[packet]},independentRepeatabilitySignalScopeObservations:{canonicalActivityScopeVerdict:null,deficiencies:[],distinctRequestedTitleCount:1,exactLineMainNamespaceLinkOccurrenceCount:1,repeatabilityVerdict:null,revisionPinnedResolutionAssessmentCount:1,signalScopeEvidencePacketCount:1,signalSourcePageMatchesLinkedSubjectAnchorCount:0,signalsWithExactLineMainNamespaceLinks:1,signalsWithoutExactLineMainNamespaceLinks:0,sourceLocatedSignalCount:1,targetOccurrenceMatchesLinkedSubjectAnchorCount:0,uniqueResolvedTargetPageCount:1},mechanicsReview:{evidenceKeys:[],state:'unreviewed'},memberCandidateKey,memberExpansionReview:{atomicSubject:null,evidenceKeys:[],memberKeys:[],state:'unreviewed'},optimizerEligible:false,repeatabilityReview:{classification:null,evidenceKeys:['blocked:1'],state:'reviewed_blocked'},resolvedTitle:source.resolvedTitle,sourceContentHash:source.sourceContentHash,sourceIndependentRepeatabilitySourceEvidenceContentHash:'b'.repeat(64),sourcePageId:source.sourcePageId,sourceRevision:source.sourceRevision,sourceTimestamp:source.sourceTimestamp,sourceUrl:source.sourceUrl,state:'independent_repeatability_signal_scope_evidence_ready_for_semantic_disposition'};
  record.contentHash=hash(record);
  const raw=JSON.stringify(record)+'\n',directory='2026-09-05T00-21-56-860Z',inputSnapshot={directory:'upstream',contentHash:'c'.repeat(64),rejections:[]};
  const context={memberCandidateKey,canonicalActivityKey,signalEvidenceKey,signalKind:located.signalKind,definitionKey:located.definitionKey,signalSourcePageId:source.sourcePageId,signalSourceRevision:source.sourceRevision,signalSourceContentHash:source.sourceContentHash,signalSourceLocator:sourceLocator,linkOccurrenceKey,requestedFragment:null,displayText:null,linkSourceLocator:linkLocator,semanticUse:'stable_page_identity_evidence_only_not_canonical_activity_scope_or_repeatability_verdict'};
  const coreAudit={contract:'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audit.v1',accountIndependent:true,inputCoverage:{expectedRecordCount:1,outputRecordCount:1,duplicateInputMemberCandidateKeys:[],duplicateOutputMemberCandidateKeys:[],missingMemberCandidateKeys:[],unexpectedMemberCandidateKeys:[],contextMismatchMemberCandidateKeys:[],structurallyInvalidInputMemberCandidateKeys:[],exactInputOutputSetAndContextMatch:true},policyCoverage:{policy:POLICY_ID,invalidRules:[],forbiddenPolicyPaths:[]},signalCoverage:{sourceLocatedSignalCount:1,signalScopeEvidencePacketCount:1,missingSignalEvidenceKeys:[],unexpectedSignalEvidenceKeys:[],duplicateSignalEvidenceKeys:[],signalsWithExactLineMainNamespaceLinks:1,signalsWithoutExactLineMainNamespaceLinks:0,exactSignalSetMatch:true},exactLineLinkCoverage:{expectedLinkOccurrenceCount:1,preservedLinkOccurrenceCount:1,missingLinkOccurrenceKeys:[],unexpectedLinkOccurrenceKeys:[],duplicateLinkOccurrenceKeys:[],exactLinkOccurrenceSetMatch:true},resolutionCoverage:{distinctRequestedTitleCount:1,attemptedRequestedTitleCount:1,unattemptedRequestedTitles:[],unexpectedAttemptedRequestedTitles:[],revisionPinnedResolutionAssessmentCount:1,unresolvedResolutionAssessmentCount:0,uniqueResolvedTargetPageCount:1,redirectedResolutionAssessmentCount:0,allRequestedTitlesAttemptedExactly:true},stableIdentityComparisonCoverage:{signalSourcePageMatchesLinkedSubjectAnchorCount:0,signalSourcePageMatchesCollectionAnchorCount:0,targetOccurrenceMatchesLinkedSubjectAnchorCount:0,targetOccurrenceMatchesCollectionAnchorCount:0,targetOccurrenceMatchesSignalSourcePageCount:0,canonicalActivityScopeVerdictCount:0,comparisonsAreObservationsOnly:true},semanticPromotionCoverage:{upstreamMutationMemberCandidateKeys:[],unsupportedPromotionMemberCandidateKeys:[],repeatabilityVerdictCount:0,memberExpansionReviewedCount:0,mechanicsReviewedCount:0,optimizerEligibleCount:0},evidenceMismatchMemberCandidateKeys:[],incompleteRecordMemberCandidateKeys:[],accountStateFindings:[],signalScopeEvidenceAttemptCoverageComplete:true,independentSignalScopeEvidenceCoverageComplete:true,canonicalActivityScopeReviewComplete:false,repeatabilityReviewComplete:false,memberExpansionReviewComplete:false,mechanicsReviewComplete:false,completeActivityUniverse:false,absoluteBestGate:'blocked_incomplete_activity_universe',blockers:requiredAuditBlockers,publishable:true};
  const audit={...structuredClone(coreAudit),generatedAt:'2026-09-05T00:21:57.011Z',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,outputSnapshot:{directory,contentHash:hash(raw)}};
  audit.contentHash=hash(audit);
  const manifest={contract:'sensum.ingestion-manifest.v1',domain:'activity-reference-collection-member-independent-repeatability-signal-scope-evidence',createdAt:'2026-09-05T00:21:56.860Z',records:1,contentHash:hash(raw),snapshotDirectory:directory,source:{kind:'revision_pinned_exact_signal_line_source_authored_main_namespace_link_scope_evidence_without_scope_or_repeatability_verdict',api:'https://oldschool.runescape.wiki/api.php',policy:{id:POLICY_ID,file:POLICY_FILE,contentHash:POLICY_HASH},inputSnapshot,requestedTitles:['Target page'],requestContexts:[{requestedTitle:'Target page',linkOccurrenceContexts:[context]}],fetchedTargetRevisions:[{requestedTitle:'Target page',normalizedTitle:'Target page',resolvedTitle:'Target page',redirected:false,namespace:0,pageId:target.sourcePageId,revision:target.sourceRevision,timestamp:target.sourceTimestamp,contentHash:target.sourceContentHash}],audit:coreAudit}};
  return {raw,manifest,audit,record};
}

function rehash(input) {
  input.record.contentHash=hash(without(input.record,'contentHash'));
  input.raw=JSON.stringify(input.record)+'\n';
  input.manifest.contentHash=hash(input.raw);
  input.audit.outputSnapshot.contentHash=input.manifest.contentHash;
  input.audit.contentHash=hash(without(input.audit,'contentHash'));
}

test('signal-scope evidence remains lossless, fully source-linked, candidate-only, and deterministic',()=>{
  const input=fixture(),first=validateActivityReferenceMemberSignalScopeMaterializationInput(input),second=validateActivityReferenceMemberSignalScopeMaterializationInput(input);
  assert.equal(first.materializationHash,second.materializationHash);
  assert.deepEqual(first.counts,{sources:2,records:1,statements:1,signals:1,signalsWithLinks:1,signalsWithoutLinks:0,linkOccurrences:1,resolutionAssessments:1,requestedTitles:1,resolvedTargetPages:1,redirectedResolutions:0});
  assert.equal(first.records[0].contentHash,input.record.contentHash);
  assert.equal(first.statements[0].payload.canonicalActivityScopeVerdict,null);
  assert.equal(first.statements[0].payload.repeatabilityVerdict,null);
  assert.equal(first.statements[0].payload.optimizerEligible,false);
});

test('signal, source, account, and semantic tampering fail closed',()=>{
  const source=fixture(); source.record.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].sourceCandidate.sourceContentHash='d'.repeat(64); rehash(source);
  assert.throws(()=>validateActivityReferenceMemberSignalScopeMaterializationInput(source),/signal_source_not_preserved_from_upstream/);
  const target=fixture(); target.record.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].linkResolutionAssessments[0].targetPageIdentity.sourceRevision='999'; rehash(target);
  assert.throws(()=>validateActivityReferenceMemberSignalScopeMaterializationInput(target),/resolution_assessment_target_mismatch/);
  const account=fixture(); account.record.currentBaseLevel=34; rehash(account);
  assert.throws(()=>validateActivityReferenceMemberSignalScopeMaterializationInput(account),/record_account_state_present/);
  const promoted=fixture(); promoted.record.independentRepeatabilitySignalScopeEvidence.signalScopeEvidencePackets[0].repeatabilityVerdict='repeatable'; rehash(promoted);
  assert.throws(()=>validateActivityReferenceMemberSignalScopeMaterializationInput(promoted),/signal_packet_semantic_gate_weakened/);
});

test('signal-scope SQL is transactional, insert-only, idempotent, and preserves semantic gates',()=>{
  const model=validateActivityReferenceMemberSignalScopeMaterializationInput(fixture()),sql=buildActivityReferenceMemberSignalScopeMaterializationSql(model);
  assert.match(sql,/^\\set ON_ERROR_STOP on\nBEGIN;/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,new RegExp(ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND));
  assert.match(sql,/'candidate'/);
  assert.match(sql,/'review'/);
  assert.match(sql,/ON CONFLICT .* DO NOTHING/);
  assert.match(sql,/INSERT INTO activity_evidence_ingestion_lineage/);
  assert.match(sql,/COMMIT;\n$/);
  assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  assert.doesNotMatch(sql,/d\.fetched_at=e\.fetched_at/);
  assert.match(sql,/d\.fetched_at IS NOT NULL/);
  assert.match(buildActivityReferenceMemberSignalScopeExistingSourceCountQuery(model),/published_at=e\.published_at/);
});

test('signal-scope reconciliation rejects count, lineage, completeness, hash, and semantic drift',()=>{
  const model=validateActivityReferenceMemberSignalScopeMaterializationInput(fixture()),actual={runId:model.runId,status:'published',records:1,sources:2,statements:1,lineage:1,snapshotComplete:false,metrics:{recordHashAggregate:model.recordHashAggregate,sourceHashAggregate:model.sourceHashAggregate,statementHashAggregate:model.statementHashAggregate,materializationHash:model.materializationHash,...model.gates}};
  assert.equal(verifyActivityReferenceMemberSignalScopeReconciliation(model,actual),true);
  assert.throws(()=>verifyActivityReferenceMemberSignalScopeReconciliation(model,{...actual,sources:1}),/sources_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSignalScopeReconciliation(model,{...actual,lineage:0}),/lineage_count_mismatch/);
  assert.throws(()=>verifyActivityReferenceMemberSignalScopeReconciliation(model,{...actual,snapshotComplete:true}),/must_not_claim_complete/);
  assert.throws(()=>verifyActivityReferenceMemberSignalScopeReconciliation(model,{...actual,metrics:{...actual.metrics,repeatabilityReviewComplete:true}}),/semantic_gate_weakened/);
});
