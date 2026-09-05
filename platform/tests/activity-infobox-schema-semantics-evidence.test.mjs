import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  auditActivityInfoboxSchemaSemanticsEvidence,
  buildActivityInfoboxSchemaSemanticsEvidence,
  compileActivityInfoboxSchemaSemanticsEvidencePolicy
} from '../ingestion/activity-infobox-schema-semantics-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-infobox-schema-semantics-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-infobox-schema-semantics-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-infobox-schema-semantics-evidence-audit-v1.json', 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function routingRecord({ key = '1' } = {}) {
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: `Activity ${key}` },
    canonicalActivitySubjectDeclarationStructuralDisposition: {
      state: 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics',
      structurallyQualifiedCandidateCount: 1,
      candidatePageKeys: ['100|200'],
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectBinding: null,
    canonicalActivitySubjectDeclarationReview: {
      state: 'structural_context_disposed_additional_evidence_required',
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    routingDecision: {
      policyRuleKind: 'canonical_activity_subject_declaration_structural_disposition_state',
      sourceState: 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics',
      routeKey: policy.inputRouteKey,
      routeState: policy.inputRouteState,
      requiredEvidenceDomains: ['activity_infobox_template_documentation_revision']
    },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['routed_canonical_activity_subject_declaration_semantic_evidence_work_not_completed'],
    state: 'canonical_activity_subject_declaration_semantic_evidence_work_routed_gates_closed',
    contentHash: `routing-${key}`
  };
}

const sourceByTitle = {
  'Template:Infobox Activity': '{{#invoke:Infobox Activity|main}}<noinclude>{{/doc}}</noinclude>',
  'Template:Infobox Activity/doc': '{{Documentation}}\n==Parameters==\n===name===\nName of the activity.\n',
  'Module:Infobox Activity': "local p = {}\n{ name = 'name', func = 'name' },\nret:defineName('Infobox Activity')\n{ tag = 'argh', content = 'name', class='infobox-header', colspan = '20' }\nreturn p"
};

function resolutions(overrides = {}) {
  return policy.requiredSources.map((source, index) => {
    const content = Object.hasOwn(overrides, source.requestedTitle) ? overrides[source.requestedTitle] : sourceByTitle[source.requestedTitle];
    return {
      requestedTitle: source.requestedTitle,
      normalizedTitle: source.requestedTitle,
      resolvedTitle: source.requestedTitle,
      redirected: false,
      page: {
        pageid: 1000 + index,
        ns: source.namespace,
        title: source.requestedTitle,
        revisions: [{ revid: 2000 + index, timestamp: '2026-09-05T00:00:00Z', slots: { main: { content } } }]
      }
    };
  });
}

const input = routingRecord();
const fetched = resolutions();
const built = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: fetched, policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.activityInfoboxSchemaSemanticsEvidenceCoverageComplete, true);
assert.equal(built.audit.sourceRevisionCoverage.completeSourceEvidenceCount, 3);
assert.equal(built.audit.observationCoverage.exactSingleObservationCount, 7);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivitySubjectBindingCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
const output = built.records[0];
assert.equal(output.activityInfoboxSchemaSemanticsEvidence.evidenceState, 'complete_revision_pinned_activity_infobox_schema_semantics_evidence_packet');
assert.equal(output.activityInfoboxSchemaSemanticsReview.state, 'unreviewed_complete_schema_evidence_semantic_disposition_required');
assert.equal(output.canonicalActivitySubjectBinding, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const missingMeaning = resolutions({ 'Template:Infobox Activity/doc': '{{Documentation}}\n==Parameters==\n===name===\nUndocumented.\n' });
const missingBuilt = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: missingMeaning, policy, contentHash: hash });
assert.equal(missingBuilt.audit.publishable, true);
assert.equal(missingBuilt.audit.activityInfoboxSchemaSemanticsEvidenceCoverageComplete, false);
assert.ok(missingBuilt.audit.blockers.includes('one_or_more_required_schema_observations_missing_or_duplicated'));
assert.equal(missingBuilt.records[0].canonicalActivitySubjectBinding, null);

const duplicateMeaning = resolutions({ 'Template:Infobox Activity/doc': '{{Documentation}}\n===name===\nName of the activity.\nName of the activity.\n' });
const duplicateBuilt = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: duplicateMeaning, policy, contentHash: hash });
assert.equal(duplicateBuilt.audit.activityInfoboxSchemaSemanticsEvidenceCoverageComplete, false);

const missingSource = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: fetched.slice(0, 2), policy, contentHash: hash });
assert.equal(missingSource.audit.publishable, false);
assert.ok(missingSource.audit.blockers.includes('required_schema_source_fetch_set_does_not_match_exactly'));

const unexpectedSource = structuredClone(fetched);
unexpectedSource.push({ requestedTitle: 'Template:Unexpected', page: { pageid: 999, ns: 10, title: 'Template:Unexpected', revisions: [] } });
const unexpectedBuilt = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: unexpectedSource, policy, contentHash: hash });
assert.equal(unexpectedBuilt.audit.publishable, false);

const activitySpecificPolicy = structuredClone(policy);
activitySpecificPolicy.overrides = { 'Activity 1': 'verified' };
const activitySpecific = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: fetched, policy: activitySpecificPolicy, contentHash: hash });
assert.equal(activitySpecific.audit.publishable, false);

const autoVerificationPolicy = structuredClone(policy);
autoVerificationPolicy.rules.automaticVerificationAllowed = true;
const autoVerification = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: fetched, policy: autoVerificationPolicy, contentHash: hash });
assert.equal(autoVerification.audit.publishable, false);

const alteredEvidence = structuredClone(built.records);
alteredEvidence[0].schemaEvidenceSources[0].sourceRevision = '999999';
const alteredAudit = auditActivityInfoboxSchemaSemanticsEvidence(alteredEvidence, { routingRecords: [input], fetchedResolutions: fetched, policy, contentHash: hash });
assert.equal(alteredAudit.publishable, false);
assert.ok(alteredAudit.blockers.includes('one_or_more_schema_evidence_packets_do_not_match_inputs_and_fetched_revisions'));

const promoted = structuredClone(built.records);
promoted[0].activityInfoboxSchemaSemanticsReview.canonicalActivitySubjectDeclarationVerdict = 'verified';
promoted[0].canonicalActivitySubjectBinding = { pageId: 1 };
promoted[0].optimizerEligible = true;
const promotedAudit = auditActivityInfoboxSchemaSemanticsEvidence(promoted, { routingRecords: [input], fetchedResolutions: fetched, policy, contentHash: hash });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('schema_evidence_changed_subject_disposition_binding_or_review'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
const accountAudit = auditActivityInfoboxSchemaSemanticsEvidence(accountScoped, { routingRecords: [input], fetchedResolutions: fetched, policy, contentHash: hash });
assert.equal(accountAudit.publishable, false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_activity_infobox_schema_semantics_evidence'));

const nonMatchingRoute = routingRecord({ key: '2' });
nonMatchingRoute.routingDecision.routeKey = 'discover_independent_canonical_activity_subject_page';
const selected = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input, nonMatchingRoute], fetchedResolutions: fetched, policy, contentHash: hash });
assert.equal(selected.records.length, 1);

const deterministicA = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [input], fetchedResolutions: fetched, policy, contentHash: hash });
const deterministicB = buildActivityInfoboxSchemaSemanticsEvidence({ routingRecords: [structuredClone(input)], fetchedResolutions: structuredClone(fetched), policy: structuredClone(policy), contentHash: hash });
assert.deepEqual(deterministicA, deterministicB);

const compiled = compileActivityInfoboxSchemaSemanticsEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.duplicateSourceKeys, []);
assert.deepEqual(compiled.duplicateSourceTitles, []);
assert.deepEqual(compiled.duplicateObservationKeys, []);
assert.deepEqual(compiled.invalidSources, []);
assert.deepEqual(compiled.invalidObservations, []);

console.log('Revision-pinned activity-infobox schema-semantics evidence checks passed.');
