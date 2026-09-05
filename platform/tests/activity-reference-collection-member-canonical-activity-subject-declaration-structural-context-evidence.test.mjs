import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import { buildCanonicalActivitySubjectDeclarationExactLineEvidence } from '../ingestion/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-lib.mjs';
import {
  auditCanonicalActivitySubjectDeclarationStructuralContextEvidence,
  buildCanonicalActivitySubjectDeclarationStructuralContextEvidence,
  compileCanonicalActivitySubjectDeclarationStructuralContextEvidencePolicy,
  discoverCanonicalActivitySubjectDeclarationStructuralContextRevisionRequests
} from '../ingestion/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-lib.mjs';

const exactPolicy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audit-v1.json', 'utf8'));
const title = 'Candidate source';
const url = 'https://oldschool.runescape.wiki/w/Candidate_source';
const sourceText = [
  '{{redirect|Example activity|another use}}',
  '== Overview ==',
  '{| class="wikitable"',
  '|-',
  '| [[Example activity|Competition]]',
  '|}',
  '* [[Example activity]]',
  '{{Infobox Activity',
  '|name = Example activity',
  '}}',
  'A paragraph describes Example activity in passing.',
  '<!-- Example activity -->'
].join('\n');

function candidate(content = sourceText, revision = '4000') {
  return {
    observedPageId: 400,
    observedTitle: title,
    rank: 1,
    resultTimestamp: '2026-01-04T00:00:00Z',
    resultSize: content.length,
    resultWordCount: 30,
    resultSnippet: 'Example activity',
    resolution: { requestedTitle: title, resolvedPageId: 400, resolvedTitle: title, redirected: false, state: 'eligible_revision_pinned_candidate' },
    revisionEvidence: { sourcePageId: 400, resolvedTitle: title, sourceRevision: revision, sourceTimestamp: '2026-01-04T00:00:00Z', sourceUrl: url, sourceContentHash: hash(content), sourceContentBytes: Buffer.byteLength(content), completeRevisionContentScanned: true },
    subjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    semanticUse: 'candidate_source_discovery_only_requires_exact_declaration_extraction_and_review',
    deficiencies: [],
    state: 'revision_pinned_subject_declaration_candidate_source'
  };
}

function discovery(content = sourceText, key = 'member:a') {
  return {
    contract: exactPolicy.inputContract,
    memberCandidateKey: key,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: 'Example activity', stableIdentityAnchor: { collectionPageId: 100, linkedSubjectPageId: 200, relationshipClass: 'describes' } },
    canonicalActivitySubjectDeclarationDiscovery: {
      evidenceState: 'complete_revision_pinned_canonical_activity_subject_declaration_discovery_packet',
      exactSourcePhraseSearch: { query: 'insource:"Example activity"', namespace: 0, totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false },
      candidateSources: [candidate(content)],
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectDeclarationReview: { state: 'unreviewed_exact_declaration_extraction_required', canonicalActivitySubjectDeclarationVerdict: null, canonicalActivityScopeVerdict: null, repeatabilityVerdict: null, requiredEvidence: ['exact_revision_source_line_canonical_activity_subject_declaration'] },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_subject_binding_unresolved'],
    state: exactPolicy.inputState,
    contentHash: `discovery-${key}`
  };
}

function fetched(content = sourceText, revision = '4000') {
  return [{ pageid: 400, ns: 0, title, revisions: [{ revid: Number(revision), timestamp: '2026-01-04T00:00:00Z', slots: { main: { content } } }] }];
}

function exactRecord(content = sourceText, key = 'member:a') {
  const built = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [discovery(content, key)], fetchedPages: fetched(content), policy: exactPolicy, contentHash: hash });
  assert.equal(built.audit.publishable, true);
  return { ...built.records[0], contentHash: `exact-${key}` };
}

const input = exactRecord();
for (const packet of input.canonicalActivitySubjectDeclarationExactLineEvidence.candidateEvidencePackets) {
  for (const occurrence of packet.exactPhraseOccurrences) {
    const value = occurrence.sourceLocator;
    occurrence.sourceLocator = { lineEnd: value.lineEnd, columnEnd: value.columnEnd, absoluteOffsetEnd: value.absoluteOffsetEnd, lineStart: value.lineStart, columnStart: value.columnStart, absoluteOffsetStart: value.absoluteOffsetStart };
  }
}
const requests = discoverCanonicalActivitySubjectDeclarationStructuralContextRevisionRequests([input], policy);
assert.equal(requests.length, 1);
assert.equal(requests[0].occurrenceContexts.length, 6);

const built = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [input], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.structuralContextEvidenceAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivitySubjectDeclarationStructuralContextEvidenceCoverageComplete, true);
assert.equal(built.audit.occurrenceCoverage.inputExactLineOccurrenceCount, 6);
assert.equal(built.audit.occurrenceCoverage.exactOccurrenceRevalidatedCount, 6);
assert.equal(built.audit.structuralCoverage.activeSourceOccurrenceCount, 5);
assert.equal(built.audit.structuralCoverage.protectedOrMixedOccurrenceCount, 1);
assert.equal(built.audit.structuralCoverage.beforeFirstHeadingCount, 1);
assert.equal(built.audit.structuralCoverage.headingScopedCount, 5);
assert.equal(built.audit.structuralCoverage.templateContainedCount, 2);
assert.equal(built.audit.structuralCoverage.linkContainedCount, 2);
assert.equal(built.audit.structuralCoverage.tableContainedCount, 1);
assert.equal(built.audit.structuralCoverage.listMarkedCount, 1);
const output = built.records[0];
const contexts = output.canonicalActivitySubjectDeclarationStructuralContextEvidence.occurrenceStructuralContextPackets;
const redirect = contexts.find(context => context.sourceExactLineOccurrence.sourceLocator.lineStart === 1);
const table = contexts.find(context => context.sourceExactLineOccurrence.sourceLocator.lineStart === 5);
const infobox = contexts.find(context => context.sourceExactLineOccurrence.sourceLocator.lineStart === 9);
assert.equal(redirect.structuralContext.enclosingTemplates[0].templateName, 'redirect');
assert.equal(redirect.structuralContext.enclosingTemplates[0].occurrenceRole.role, 'positional_parameter');
assert.equal(table.structuralContext.enclosingLinks[0].occurrenceRole.role, 'link_target');
assert.equal(table.structuralContext.enclosingTable.occurrenceLineCellMarker, '|');
assert.equal(infobox.structuralContext.enclosingTemplates[0].templateName, 'Infobox Activity');
assert.equal(infobox.structuralContext.enclosingTemplates[0].occurrenceRole.parameterName, 'name');
assert.equal(output.canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);

const repeated = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [input], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(hash(built.records), hash(repeated.records));

const missingRevision = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [input], fetchedPages: [], policy, contentHash: hash });
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('exact_candidate_revision_fetch_set_mismatch'));

const tamperedInput = structuredClone(input);
tamperedInput.canonicalActivitySubjectDeclarationExactLineEvidence.candidateEvidencePackets[0].exactPhraseOccurrences[0].sourceLocator.absoluteOffsetStart += 1;
tamperedInput.contentHash = 'tampered-exact-input';
const tampered = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [tamperedInput], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(tampered.audit.publishable, false);
assert.ok(tampered.audit.blockers.includes('one_or_more_exact_line_occurrences_failed_revision_revalidation'));

const unbalancedText = '{{Example activity';
const unbalancedInput = exactRecord(unbalancedText, 'member:unbalanced');
const unbalanced = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [unbalancedInput], fetchedPages: fetched(unbalancedText), policy, contentHash: hash });
assert.equal(unbalanced.audit.publishable, false);
assert.ok(unbalanced.audit.blockers.includes('one_or_more_structural_sources_have_unbalanced_delimiters'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'activity:member:a': 'subject' };
const forbidden = buildCanonicalActivitySubjectDeclarationStructuralContextEvidence({ exactLineRecords: [input], fetchedPages: fetched(), policy: forbiddenPolicy, contentHash: hash });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('canonical_activity_subject_declaration_structural_context_policy_invalid_or_activity_specific'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict = 'supported';
promotedRecords[0].optimizerEligible = true;
const promoted = auditCanonicalActivitySubjectDeclarationStructuralContextEvidence(promotedRecords, { exactLineRecords: [input], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('structural_context_evidence_created_unsupported_semantic_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const account = auditCanonicalActivitySubjectDeclarationStructuralContextEvidence(accountRecords, { exactLineRecords: [input], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(account.publishable, false);
assert.ok(account.blockers.includes('account_query_state_baked_into_subject_declaration_structural_context_evidence'));

const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
console.log('Canonical activity subject-declaration structural-context evidence checks passed.');
