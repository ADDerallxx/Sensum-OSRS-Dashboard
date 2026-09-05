import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  auditActivityCanonicalSubjectScopeDispositions,
  buildActivityCanonicalSubjectScopeDispositions,
  compileActivityCanonicalSubjectScopeDispositionPolicy
} from '../transforms/activity-canonical-subject-scope-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-canonical-subject-scope-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-disposition-audit-v1.json', 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function evidenceRecord({ key = '1', label = `Activity ${key}`, mutateLines = lines => lines } = {}) {
  const lines = mutateLines([
    'An NPC can assign various tasks and give small rewards in return.',
    'The most common tasks are to fetch items (this list may not be exhaustive). The NPC will only give tasks that match the player\'s current level.',
    'There are 59 tasks in total that can be assigned. The NPC will not request an item if the [[Player character|player]] lacks the skill to create it themselves.'
  ]);
  const exactRevisionSourceText = lines.join('\n');
  const sourcePageIdentity = {
    sourcePageId: 100 + Number(key),
    resolvedTitle: label,
    sourceRevision: String(200 + Number(key)),
    sourceTimestamp: '2026-09-05T00:00:00Z',
    sourceUrl: `https://example.test/activity-${key}`,
    sourceContentHash: hash(exactRevisionSourceText)
  };
  const sourceEvidenceKey = `scope-source:${key}`;
  const domainKeys = [
    'canonical_subject_page_exact_revision',
    'lead_and_infobox_activity_description',
    'declared_activity_purpose_and_skill_relationship',
    'activity_boundary_and_composite_member_relationships',
    'scope_exclusions_and_condition_boundaries',
    'separate_repeatability_evidence_obligation'
  ];
  const channelKeys = [
    'complete_exact_revision_source_text',
    'activity_infobox_structure',
    'lead_paragraph_inventory',
    'heading_inventory',
    'root_template_inventory',
    'direct_category_inventory',
    'complete_source_line_inventory',
    'repeatability_verdict_separation'
  ];
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectBinding: {
      bindingClass: 'revision_pinned_title_aligned_activity_infobox_name_subject',
      canonicalActivityKey: `activity:${key}`,
      canonicalActivityLabel: label,
      sourcePageIdentity,
      verdict: 'source_supported_canonical_activity_subject_declaration',
      accountIndependent: true
    },
    canonicalActivitySubjectDeclarationReview: {
      state: 'reviewed_source_supported_canonical_activity_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: 'source_supported_canonical_activity_subject_declaration',
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: []
    },
    canonicalActivityScopeEvidence: {
      evidenceState: policy.requiredEvidenceState,
      canonicalActivitySubjectDeclarationVerdict: 'source_supported_canonical_activity_subject_declaration',
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      sourceEvidenceKeys: [sourceEvidenceKey],
      requiredEvidenceDomainCount: domainKeys.length,
      capturedEvidenceDomainCount: domainKeys.length,
      requiredCaptureChannelCount: channelKeys.length,
      completedCaptureChannelCount: channelKeys.length
    },
    canonicalActivityScopeEvidenceSources: [{
      sourceEvidenceKey,
      canonicalActivityKey: `activity:${key}`,
      sourcePageIdentity,
      sourceRevisionVerification: {
        fetchedPagePresent: true,
        fetchedRevisionContentPresent: true,
        fetchedPageIdMatchesBinding: true,
        fetchedTitleMatchesBinding: true,
        fetchedRevisionMatchesBinding: true,
        fetchedTimestampMatchesBinding: true,
        fetchedUrlMatchesBinding: true,
        fetchedContentHashMatchesBinding: true,
        bindingRevisionBoundaryMatchesSource: true
      },
      exactRevisionSourceText,
      structuralInventory: {
        activityInfobox: { template: 'Infobox Activity', balanced: true, parameters: [] },
        leadParagraphs: lines.map((rawText, index) => ({ ordinal: index + 1, rawText, sourceLocator: { lineStart: index + 1, lineEnd: index + 1 } })),
        headings: [],
        rootTemplates: [],
        directCategories: [],
        sourceLines: lines.map((rawText, index) => ({ ordinal: index + 1, rawText, rawTextContentHash: hash(rawText), sourceLocator: { lineStart: index + 1, lineEnd: index + 1 } }))
      },
      domainEvidence: domainKeys.map(domainKey => ({ domainKey, captureState: 'captured_for_semantic_disposition_not_a_scope_verdict', sourceEvidenceKeys: [sourceEvidenceKey], supportingCaptureChannels: [] })),
      captureChannels: channelKeys.map(channelKey => ({ channelKey, complete: true })),
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      deficiencies: [],
      state: 'complete_revision_pinned_canonical_activity_scope_source'
    }],
    canonicalActivityScopeReview: {
      state: 'unreviewed_complete_revision_pinned_scope_evidence_semantic_disposition_required',
      canonicalActivitySubjectDeclarationVerdict: 'source_supported_canonical_activity_subject_declaration',
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null,
      evidenceKeys: [sourceEvidenceKey]
    },
    memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_scope_unresolved', 'canonical_activity_scope_review_incomplete', 'canonical_activity_scope_evidence_requires_semantic_disposition'],
    state: policy.inputState,
    contentHash: `scope-evidence-${key}`
  };
}

const input = evidenceRecord();
const built = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivityScopeReviewComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.scopeClassificationCoverage.sourceSupportedCompositeAssignedTaskScopeCount, 1);
assert.equal(built.audit.scopeClassificationCoverage.blockedScopeCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityScopeClassificationCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivityScopeReview.canonicalActivityScopeVerdict, policy.scopeRule.verdict);
assert.equal(output.canonicalActivityScopeReview.scopeClass, policy.scopeRule.scopeClass);
assert.equal(output.canonicalActivityScopeReview.declaredTaskCount, 59);
assert.equal(output.canonicalActivityScopeDisposition.memberInventoryComplete, false);
assert.equal(output.canonicalActivityScopeReview.repeatabilityVerdict, null);
assert.equal(output.memberExpansionReview.state, 'unreviewed');
assert.equal(output.mechanicsReview.state, 'unreviewed');
assert.equal(output.optimizerEligible, false);
assert.ok(output.blockers.includes('source_declares_member_inventory_may_not_be_exhaustive'));
assert.ok(!output.blockers.includes('canonical_activity_scope_unresolved'));
assert.ok(!output.blockers.includes('canonical_activity_scope_review_incomplete'));
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const renamed = evidenceRecord({ key: '2', label: 'Completely renamed activity' });
const renamedBuilt = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [renamed], policy });
assert.equal(renamedBuilt.audit.publishable, true);
assert.equal(renamedBuilt.records[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict, policy.scopeRule.verdict);

const missingSignal = evidenceRecord({ key: '3', mutateLines: lines => lines.map(line => line.replace('this list may not be exhaustive', 'items follow')) });
const missingBuilt = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [missingSignal], policy });
assert.equal(missingBuilt.audit.publishable, true);
assert.equal(missingBuilt.audit.canonicalActivityScopeReviewComplete, false);
assert.equal(missingBuilt.records[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict, null);
assert.ok(missingBuilt.records[0].blockers.includes('canonical_activity_scope_unresolved'));

const duplicateSignal = evidenceRecord({ key: '4', mutateLines: lines => [lines[0], lines[0], ...lines.slice(1)] });
const duplicateBuilt = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [duplicateSignal], policy });
assert.equal(duplicateBuilt.audit.publishable, true);
assert.equal(duplicateBuilt.audit.canonicalActivityScopeReviewComplete, false);

const badRevision = evidenceRecord({ key: '5' });
badRevision.canonicalActivityScopeEvidenceSources[0].sourceRevisionVerification.fetchedRevisionMatchesBinding = false;
const badRevisionBuilt = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [badRevision], policy });
assert.equal(badRevisionBuilt.audit.publishable, true);
assert.equal(badRevisionBuilt.records[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict, null);

const badLineHash = evidenceRecord({ key: '6' });
badLineHash.canonicalActivityScopeEvidenceSources[0].structuralInventory.sourceLines[0].rawTextContentHash = 'tampered';
const badLineHashBuilt = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [badLineHash], policy });
assert.equal(badLineHashBuilt.audit.publishable, true);
assert.equal(badLineHashBuilt.records[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict, null);
assert.ok(badLineHashBuilt.records[0].canonicalActivityScopeDisposition.deficiencies.includes('sourceLineHashesMatchExactText'));

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'Activity 1': 'verified' };
assert.equal(buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [input], policy: specificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [input], policy: automaticPolicy }).audit.publishable, false);

const altered = structuredClone(built.records);
altered[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict = 'unsupported_scope';
const alteredAudit = auditActivityCanonicalSubjectScopeDispositions(altered, { evidenceRecords: [input], policy });
assert.equal(alteredAudit.publishable, false);
assert.ok(alteredAudit.blockers.includes('one_or_more_scope_dispositions_do_not_match_policy'));

const mutatedSource = structuredClone(built.records);
mutatedSource[0].canonicalActivityScopeEvidenceSources[0].sourcePageIdentity.sourceRevision = '999';
const mutatedSourceAudit = auditActivityCanonicalSubjectScopeDispositions(mutatedSource, { evidenceRecords: [input], policy });
assert.equal(mutatedSourceAudit.publishable, false);
assert.ok(mutatedSourceAudit.blockers.includes('upstream_scope_evidence_context_mutated'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityScopeReview.repeatabilityVerdict = 'repeatable';
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditActivityCanonicalSubjectScopeDispositions(promoted, { evidenceRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditActivityCanonicalSubjectScopeDispositions(accountScoped, { evidenceRecords: [input], policy });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_canonical_activity_scope_disposition'));

const deterministicA = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [input], policy });
const deterministicB = buildActivityCanonicalSubjectScopeDispositions({ evidenceRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileActivityCanonicalSubjectScopeDispositionPolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.invalidScopeRule, []);

console.log('Generic canonical-activity scope disposition checks passed.');
