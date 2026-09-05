import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditActivityInfoboxSchemaSemanticsDispositions,
  buildActivityInfoboxSchemaSemanticsDispositions,
  compileActivityInfoboxSchemaSemanticsDispositionPolicy
} from '../transforms/activity-infobox-schema-semantics-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-infobox-schema-semantics-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-infobox-schema-semantics-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-infobox-schema-semantics-disposition-audit-v1.json', 'utf8'));

function evidenceRecord({ key = '1', label = `Activity ${key}` } = {}) {
  const checks = Object.fromEntries(policy.subjectBindingRule.requiredCandidateChecks.map(check => [check, true]));
  const observations = policy.subjectBindingRule.requiredSchemaObservations.map((observationKey, index) => ({
    observationKey,
    exactSingleOccurrence: true,
    sourceKey: `source-${index % 3}`,
    sourcePageId: 500 + (index % 3),
    sourceRevision: String(600 + (index % 3)),
    sourceTimestamp: '2026-09-05T00:00:00Z',
    sourceUrl: `https://example.test/schema-${index % 3}`,
    sourceContentHash: `schema-hash-${index % 3}`
  }));
  const sourcePageIdentity = {
    sourcePageId: 100,
    resolvedTitle: label,
    sourceRevision: '200',
    sourceTimestamp: '2026-09-05T00:00:00Z',
    sourceUrl: 'https://example.test/activity',
    sourceContentHash: 'activity-hash'
  };
  const evidenceKey = `subject-candidate:${key}`;
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectDeclarationStructuralDispositionSignals: [{
      evidenceKey,
      evidenceUseClass: 'structurally_qualified_page_subject_declaration_candidate',
      subjectCandidate: true,
      candidateChecks: checks,
      sourcePageIdentity,
      sourceOccurrenceEvidence: { matchedText: label, exactSourceLines: `|name = ${label}`, exactSourceLinesContentHash: 'line-hash' },
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    }],
    canonicalActivitySubjectDeclarationStructuralDisposition: {
      state: policy.subjectBindingRule.requiredStructuralDispositionState,
      structurallyQualifiedCandidateCount: 1,
      candidatePageKeys: ['100|200'],
      candidateEvidenceKeys: [evidenceKey],
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: []
    },
    canonicalActivitySubjectBinding: null,
    canonicalActivitySubjectDeclarationReview: {
      state: 'structural_context_disposed_additional_evidence_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: [evidenceKey]
    },
    schemaEvidenceSources: [0, 1, 2].map(index => ({
      sourceKey: `source-${index}`,
      sourcePageId: 500 + index,
      sourceRevision: String(600 + index),
      sourceTimestamp: '2026-09-05T00:00:00Z',
      sourceUrl: `https://example.test/schema-${index}`,
      sourceContentHash: `schema-hash-${index}`,
      state: 'complete_revision_pinned_schema_source_evidence'
    })),
    activityInfoboxSchemaSemanticsEvidence: {
      evidenceState: policy.requiredEvidenceState,
      observations,
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivitySubjectBinding: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    activityInfoboxSchemaSemanticsReview: {
      state: 'unreviewed_complete_schema_evidence_semantic_disposition_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivitySubjectBinding: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: observations.map(observation => `${observation.sourceKey}:${observation.sourcePageId}:${observation.sourceRevision}:${observation.observationKey}`)
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: [
      'activity_infobox_schema_evidence_requires_semantic_disposition',
      'schema_evidence_does_not_independently_bind_canonical_activity_subject',
      'activity_infobox_name_schema_semantics_not_revision_pinned',
      'source_subject_disposition_still_unresolved',
      'no_stable_canonical_activity_subject_anchor_observed',
      'canonical_activity_subject_binding_unresolved'
    ],
    state: policy.inputState,
    contentHash: `schema-evidence-${key}`
  };
}

const input = evidenceRecord();
const built = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivitySubjectBindingReviewComplete, true);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.bindingCoverage.sourceSupportedBindingCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivitySubjectBindingCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityScopeClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivitySubjectBinding.bindingClass, policy.subjectBindingRule.bindingClass);
assert.equal(output.canonicalActivitySubjectDeclarationDisposition.verdict, policy.subjectBindingRule.verdict);
assert.equal(output.canonicalActivitySubjectDeclarationReview.canonicalActivityScopeVerdict, null);
assert.equal(output.activityInfoboxSchemaSemanticsReview.repeatabilityVerdict, null);
assert.equal(output.memberExpansionReview.state, 'unreviewed');
assert.equal(output.mechanicsReview.state, 'unreviewed');
assert.equal(output.optimizerEligible, false);
assert.ok(!output.blockers.includes('canonical_activity_subject_binding_unresolved'));
assert.ok(!output.blockers.includes('activity_infobox_name_schema_semantics_not_revision_pinned'));
assert.ok(!output.blockers.includes('source_subject_disposition_still_unresolved'));
assert.ok(!output.blockers.includes('no_stable_canonical_activity_subject_anchor_observed'));
assert.deepEqual(built.audit.bindingCoverage.resolvedSubjectBlockerLeakMemberCandidateKeys, []);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = evidenceRecord({ key: '2', label: 'Completely renamed activity' });
const renamedBuilt = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [renamed], policy });
assert.equal(renamedBuilt.audit.publishable, true);
assert.equal(renamedBuilt.records[0].canonicalActivitySubjectBinding.bindingClass, output.canonicalActivitySubjectBinding.bindingClass);

const failedCheck = evidenceRecord({ key: '3' });
failedCheck.canonicalActivitySubjectDeclarationStructuralDispositionSignals[0].candidateChecks.beforeFirstHeading = false;
const failedCheckBuilt = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [failedCheck], policy });
assert.equal(failedCheckBuilt.audit.publishable, false);
assert.equal(failedCheckBuilt.records[0].canonicalActivitySubjectBinding, null);

const titleMismatch = evidenceRecord({ key: '4' });
titleMismatch.canonicalActivitySubjectDeclarationStructuralDispositionSignals[0].sourcePageIdentity.resolvedTitle = 'Different activity';
const titleMismatchBuilt = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [titleMismatch], policy });
assert.equal(titleMismatchBuilt.audit.publishable, false);
assert.equal(titleMismatchBuilt.records[0].canonicalActivitySubjectBinding, null);

const missingObservation = evidenceRecord({ key: '5' });
missingObservation.activityInfoboxSchemaSemanticsEvidence.observations.pop();
const missingObservationBuilt = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [missingObservation], policy });
assert.equal(missingObservationBuilt.audit.publishable, false);

const duplicateCandidate = evidenceRecord({ key: '6' });
duplicateCandidate.canonicalActivitySubjectDeclarationStructuralDispositionSignals.push(structuredClone(duplicateCandidate.canonicalActivitySubjectDeclarationStructuralDispositionSignals[0]));
const duplicateCandidateBuilt = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [duplicateCandidate], policy });
assert.equal(duplicateCandidateBuilt.audit.publishable, false);

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'Activity 1': 'verified' };
const specific = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [input], policy: specificPolicy });
assert.equal(specific.audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
const automatic = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [input], policy: automaticPolicy });
assert.equal(automatic.audit.publishable, false);

const altered = structuredClone(built.records);
altered[0].canonicalActivitySubjectBinding.sourcePageIdentity.sourceRevision = '999';
const alteredAudit = auditActivityInfoboxSchemaSemanticsDispositions(altered, { evidenceRecords: [input], policy });
assert.equal(alteredAudit.publishable, false);

const staleBlocker = structuredClone(built.records);
staleBlocker[0].blockers.push('activity_infobox_name_schema_semantics_not_revision_pinned');
const staleBlockerAudit = auditActivityInfoboxSchemaSemanticsDispositions(staleBlocker, { evidenceRecords: [input], policy });
assert.equal(staleBlockerAudit.publishable, false);
assert.ok(staleBlockerAudit.blockers.includes('source_supported_subject_binding_retains_resolved_subject_or_schema_blocker'));
assert.ok(alteredAudit.blockers.includes('one_or_more_subject_binding_dispositions_do_not_match_policy'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivitySubjectDeclarationReview.repeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditActivityInfoboxSchemaSemanticsDispositions(promoted, { evidenceRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditActivityInfoboxSchemaSemanticsDispositions(accountScoped, { evidenceRecords: [input], policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_activity_infobox_schema_semantics_disposition'));

const deterministicA = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [input], policy });
const deterministicB = buildActivityInfoboxSchemaSemanticsDispositions({ evidenceRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileActivityInfoboxSchemaSemanticsDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidBindingRule, []);

console.log('Generic activity-infobox schema-semantics disposition checks passed.');
