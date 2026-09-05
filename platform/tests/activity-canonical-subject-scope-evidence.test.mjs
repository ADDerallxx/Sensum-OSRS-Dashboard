import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
  auditActivityCanonicalSubjectScopeEvidence,
  buildActivityCanonicalSubjectScopeEvidence,
  compileActivityCanonicalSubjectScopeEvidencePolicy,
  discoverActivityCanonicalSubjectScopeExactRevisionRequests
} from '../ingestion/activity-canonical-subject-scope-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-canonical-subject-scope-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-canonical-subject-scope-evidence-audit-v1.json', 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

const sourceText = `{{Infobox Activity
|name = Activity 1
|skills = [[Prayer]]
}}
Activity 1 is assigned by an NPC and gives small rewards.

==Tasks==
* Bring an item.
* Deliver a message.

==Rewards==
Rewards vary by task.

[[Category:Activities]]`;

function routingRecord({ key = '1', label = `Activity ${key}`, content = sourceText } = {}) {
  const revision = `20${key}`;
  const pageId = 100 + Number(key);
  const verdict = 'source_supported_canonical_activity_subject_declaration';
  const binding = {
    ruleKey: 'generic_subject_binding_rule',
    canonicalActivityKey: `activity:${key}`,
    canonicalActivityLabel: label,
    sourcePageIdentity: {
      sourcePageId: pageId,
      resolvedTitle: label,
      sourceRevision: revision,
      sourceTimestamp: '2026-01-01T00:00:00Z',
      sourceUrl: `https://oldschool.runescape.wiki/w/${label.replaceAll(' ', '_')}`,
      sourceContentHash: hash(content)
    },
    sourceOccurrenceEvidence: { matchedText: label },
    structuralEvidenceKey: `structural:${key}`,
    schemaEvidenceKeys: [`schema:${key}`],
    evidenceRevisionBoundary: {
      subjectSourceRevision: revision,
      schemaSources: [{ sourcePageId: 900, sourceRevision: '300', sourceContentHash: 'schema-source' }]
    },
    bindingClass: 'generic_revision_pinned_subject_binding',
    verdict,
    accountIndependent: true
  };
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivitySubjectDeclarationDisposition: {
      state: 'source_supported_canonical_activity_subject_binding',
      verdict,
      bindingClass: binding.bindingClass,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectBinding: binding,
    canonicalActivitySubjectDeclarationReview: {
      state: 'reviewed_source_supported_canonical_activity_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: verdict,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    activityInfoboxSchemaSemanticsReview: {
      state: 'reviewed_schema_semantics_support_exact_structural_subject_binding',
      canonicalActivitySubjectDeclarationVerdict: verdict,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    routingDecision: {
      policyRuleKind: 'audited_source_supported_canonical_activity_subject_binding_state',
      sourceState: 'canonical_activity_subject_declaration_source_supported_scope_and_repeatability_unresolved',
      routeKey: policy.inputRouteKey,
      routeState: policy.inputRouteState,
      requiredEvidenceDomains: policy.requiredEvidenceDomains
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_scope_review_incomplete', 'repeatability_classification_unresolved'],
    state: policy.inputState,
    contentHash: `scope-routing-${key}`
  };
}

function fetchedPage(record, { content = sourceText, pageId, title, revision, timestamp } = {}) {
  const identity = record.canonicalActivitySubjectBinding.sourcePageIdentity;
  return {
    pageid: pageId ?? identity.sourcePageId,
    ns: 0,
    title: title ?? identity.resolvedTitle,
    revisions: [{
      revid: revision ?? Number(identity.sourceRevision),
      timestamp: timestamp ?? identity.sourceTimestamp,
      slots: { main: { content } }
    }]
  };
}

const input = routingRecord();
const fetched = [fetchedPage(input)];
const requests = discoverActivityCanonicalSubjectScopeExactRevisionRequests([input], policy);
assert.equal(requests.length, 1);
assert.equal(requests[0].sourceRevision, '201');

const built = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivityScopeEvidenceCoverageComplete, true);
assert.equal(built.audit.revisionCoverage.exactRevisionFetchSetMatch, true);
assert.equal(built.audit.captureCoverage.retainedExactRevisionSourceCount, 1);
assert.equal(built.audit.captureCoverage.requiredEvidenceDomainCountPerRecord, 6);
assert.equal(built.audit.captureCoverage.requiredCaptureChannelCountPerRecord, 8);
assert.equal(built.audit.captureCoverage.incompleteCaptureChannels.length, 0);
assert.equal(built.audit.semanticPromotionCoverage.preservedCanonicalActivitySubjectBindingCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityScopeClassificationCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.repeatabilityClassificationCount, 0);
const output = built.records[0];
assert.equal(output.canonicalActivityScopeEvidence.evidenceState, 'complete_revision_pinned_canonical_activity_scope_evidence_packet');
assert.equal(output.canonicalActivityScopeReview.state, 'unreviewed_complete_revision_pinned_scope_evidence_semantic_disposition_required');
assert.equal(output.canonicalActivityScopeEvidenceSources[0].exactRevisionSourceText, sourceText);
assert.equal(output.canonicalActivityScopeEvidenceSources[0].structuralInventory.activityInfobox.balanced, true);
assert.equal(output.canonicalActivityScopeEvidenceSources[0].structuralInventory.leadParagraphs.length, 1);
assert.equal(output.canonicalActivityScopeEvidenceSources[0].structuralInventory.headings.length, 2);
assert.equal(output.canonicalActivityScopeEvidenceSources[0].structuralInventory.directCategories.length, 1);
assert.equal(output.canonicalActivityScopeReview.canonicalActivityScopeVerdict, null);
assert.equal(output.canonicalActivityScopeReview.repeatabilityVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const wrongPage = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: [fetchedPage(input, { pageId: 999 })], policy, contentHash: hash });
assert.equal(wrongPage.audit.publishable, true);
assert.equal(wrongPage.audit.canonicalActivityScopeEvidenceCoverageComplete, false);
assert.ok(wrongPage.audit.blockers.includes('one_or_more_revision_pinned_scope_sources_incomplete'));

const missingFetch = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: [], policy, contentHash: hash });
assert.equal(missingFetch.audit.publishable, false);
assert.ok(missingFetch.audit.blockers.includes('exact_bound_subject_revision_fetch_set_mismatch'));

const unexpectedFetch = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: [...fetched, fetchedPage(routingRecord({ key: '2', label: 'Activity 2', content: sourceText }), { revision: 202, title: 'Activity 2', pageId: 102 })], policy, contentHash: hash });
assert.equal(unexpectedFetch.audit.publishable, false);

const unbalancedSource = sourceText.replace('}}', '}');
const unbalancedInput = routingRecord({ content: unbalancedSource });
const unbalanced = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [unbalancedInput], fetchedPages: [fetchedPage(unbalancedInput, { content: unbalancedSource })], policy, contentHash: hash });
assert.equal(unbalanced.audit.canonicalActivityScopeEvidenceCoverageComplete, false);

const activitySpecificPolicy = structuredClone(policy);
activitySpecificPolicy.overrides = { 'Activity 1': 'training_activity' };
assert.equal(buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: fetched, policy: activitySpecificPolicy, contentHash: hash }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: fetched, policy: automaticPolicy, contentHash: hash }).audit.publishable, false);

const alteredEvidence = structuredClone(built.records);
alteredEvidence[0].canonicalActivityScopeEvidenceSources[0].sourcePageIdentity.sourceRevision = '999';
const alteredAudit = auditActivityCanonicalSubjectScopeEvidence(alteredEvidence, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(alteredAudit.publishable, false);
assert.ok(alteredAudit.blockers.includes('one_or_more_scope_evidence_packets_do_not_match_inputs_and_fetched_revisions'));

const alteredLine = structuredClone(built.records);
alteredLine[0].canonicalActivityScopeEvidenceSources[0].structuralInventory.sourceLines[0].rawText = 'changed';
const alteredLineAudit = auditActivityCanonicalSubjectScopeEvidence(alteredLine, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(alteredLineAudit.publishable, false);
assert.ok(alteredLineAudit.blockers.includes('one_or_more_exact_revision_source_line_inventories_incomplete_or_changed'));

const mutatedSubject = structuredClone(built.records);
mutatedSubject[0].canonicalActivitySubjectBinding.canonicalActivityLabel = 'Mutated';
const mutatedSubjectAudit = auditActivityCanonicalSubjectScopeEvidence(mutatedSubject, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(mutatedSubjectAudit.publishable, false);
assert.ok(mutatedSubjectAudit.blockers.includes('scope_evidence_changed_subject_binding_identity_disposition_or_review'));

const promoted = structuredClone(built.records);
promoted[0].canonicalActivityScopeReview.canonicalActivityScopeVerdict = 'repeatable_training_activity';
promoted[0].canonicalActivityScopeEvidenceSources[0].repeatabilityVerdict = true;
promoted[0].memberExpansionReview.state = 'reviewed';
promoted[0].optimizerEligible = true;
const promotedAudit = auditActivityCanonicalSubjectScopeEvidence(promoted, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('scope_evidence_created_unsupported_scope_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditActivityCanonicalSubjectScopeEvidence(accountScoped, { routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_canonical_activity_scope_evidence'));

const deterministicA = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [input], fetchedPages: fetched, policy, contentHash: hash });
const deterministicB = buildActivityCanonicalSubjectScopeEvidence({ routingRecords: [structuredClone(input)], fetchedPages: structuredClone(fetched), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileActivityCanonicalSubjectScopeEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

console.log('Revision-pinned canonical-activity scope evidence checks passed.');
