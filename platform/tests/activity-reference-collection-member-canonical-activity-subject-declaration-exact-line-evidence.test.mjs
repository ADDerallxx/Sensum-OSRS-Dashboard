import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditCanonicalActivitySubjectDeclarationExactLineEvidence,
  buildCanonicalActivitySubjectDeclarationExactLineEvidence,
  compileCanonicalActivitySubjectDeclarationExactLineEvidencePolicy,
  discoverCanonicalActivitySubjectDeclarationExactRevisionRequests,
  exactPhraseFromSearch
} from '../ingestion/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audit-v1.json', 'utf8'));
const title = 'Candidate source';
const url = 'https://oldschool.runescape.wiki/w/Candidate_source';
const sourceText = [
  '<!-- Example activity -->',
  "'''Guide''' for [[Example activity]].",
  '<nowiki>Example activity</nowiki>',
  '{{Citation|text=Example activity}}'
].join('\n');

function candidate(content = sourceText, revision = '3000') {
  return {
    observedPageId: 300,
    observedTitle: title,
    rank: 1,
    resultTimestamp: '2026-01-03T00:00:00Z',
    resultSize: content.length,
    resultWordCount: 20,
    resultSnippet: 'Example activity',
    resolution: { requestedTitle: title, resolvedPageId: 300, resolvedTitle: title, redirected: false, state: 'eligible_revision_pinned_candidate' },
    revisionEvidence: { sourcePageId: 300, resolvedTitle: title, sourceRevision: revision, sourceTimestamp: '2026-01-03T00:00:00Z', sourceUrl: url, sourceContentHash: hash(content), sourceContentBytes: Buffer.byteLength(content), completeRevisionContentScanned: true },
    subjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    semanticUse: 'candidate_source_discovery_only_requires_exact_declaration_extraction_and_review',
    deficiencies: [],
    state: 'revision_pinned_subject_declaration_candidate_source'
  };
}

function input(key = 'member:a', label = 'Example activity', sourceCandidate = candidate()) {
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label, stableIdentityAnchor: { collectionPageId: 100, linkedSubjectPageId: 200, relationshipClass: 'describes' } },
    canonicalActivitySubjectDeclarationDiscovery: {
      evidenceState: 'complete_revision_pinned_canonical_activity_subject_declaration_discovery_packet',
      exactSourcePhraseSearch: { query: `insource:"${label}"`, namespace: 0, totalHits: 1, returnedCount: 1, continuationExhausted: true, truncated: false },
      candidateSources: [sourceCandidate],
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
    state: policy.inputState,
    contentHash: `input-hash-${key}`
  };
}

function fetched(content = sourceText, revision = '3000') {
  return [{ pageid: 300, ns: 0, title, revisions: [{ revid: Number(revision), timestamp: '2026-01-03T00:00:00Z', slots: { main: { content } } }] }];
}

const source = input();
assert.equal(exactPhraseFromSearch(source), 'Example activity');
const requests = discoverCanonicalActivitySubjectDeclarationExactRevisionRequests([source], policy);
assert.equal(requests.length, 1);
assert.equal(requests[0].candidateContexts.length, 1);

const built = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [source], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.exactLineEvidenceAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivitySubjectDeclarationExactLineEvidenceCoverageComplete, true);
assert.equal(built.audit.revisionCoverage.requestedExactRevisionCount, 1);
assert.equal(built.audit.candidateCoverage.inputCandidatePairCount, 1);
assert.equal(built.audit.occurrenceCoverage.rawExactPhraseOccurrenceCount, 4);
assert.equal(built.audit.occurrenceCoverage.activeSourceOccurrenceCount, 2);
assert.equal(built.audit.occurrenceCoverage.protectedOrMixedOccurrenceCount, 2);
const output = built.records[0];
const packet = output.canonicalActivitySubjectDeclarationExactLineEvidence.candidateEvidencePackets[0];
assert.equal(packet.exactPhraseOccurrences[0].sourceRegionState, 'protected_or_ignored_source_region');
assert.equal(packet.exactPhraseOccurrences[1].sourceRegionState, 'active_source_text');
assert.equal(packet.exactPhraseOccurrences[1].sourceLocator.lineStart, 2);
assert.equal(packet.exactPhraseOccurrences[1].sourceLocator.columnStart, 19);
assert.equal(packet.exactPhraseOccurrences[1].structuralObservations.sourceAuthoredLinkOccurrenceKeysOnExactLines.length, 1);
assert.equal(packet.canonicalActivitySubjectDeclarationVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);

const sharedRevision = input('member:b');
const sharedRequests = discoverCanonicalActivitySubjectDeclarationExactRevisionRequests([source, sharedRevision], policy);
assert.equal(sharedRequests.length, 1);
assert.equal(sharedRequests[0].candidateContexts.length, 2);
const sharedBuilt = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [source, sharedRevision], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(sharedBuilt.audit.publishable, true);
assert.deepEqual(sharedBuilt.audit.occurrenceCoverage.duplicateOccurrenceKeys, []);

const missingRevision = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [source], fetchedPages: [], policy, contentHash: hash });
assert.equal(missingRevision.audit.publishable, false);
assert.ok(missingRevision.audit.blockers.includes('exact_candidate_revision_fetch_set_mismatch'));

const absentText = 'This source does not contain the requested literal phrase.';
const absentInput = input('member:absent', 'Example activity', candidate(absentText));
const absentBuilt = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [absentInput], fetchedPages: fetched(absentText), policy, contentHash: hash });
assert.equal(absentBuilt.audit.publishable, false);
assert.ok(absentBuilt.audit.blockers.includes('one_or_more_subject_declaration_exact_line_evidence_records_incomplete'));

const protectedOnlyText = '<!-- Example activity -->\n<nowiki>Example activity</nowiki>';
const protectedOnlyInput = input('member:protected', 'Example activity', candidate(protectedOnlyText));
const protectedOnlyBuilt = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [protectedOnlyInput], fetchedPages: fetched(protectedOnlyText), policy, contentHash: hash });
assert.equal(protectedOnlyBuilt.audit.publishable, true);
assert.equal(protectedOnlyBuilt.audit.occurrenceCoverage.activeSourceOccurrenceCount, 0);
assert.equal(protectedOnlyBuilt.audit.occurrenceCoverage.protectedOrMixedOccurrenceCount, 2);
assert.equal(protectedOnlyBuilt.records[0].canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict, null);

const hashMismatchInput = input('member:hash');
hashMismatchInput.canonicalActivitySubjectDeclarationDiscovery.candidateSources[0].revisionEvidence.sourceContentHash = 'incorrect-source-hash';
hashMismatchInput.contentHash = 'hash-mismatch-input';
const hashMismatchBuilt = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [hashMismatchInput], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(hashMismatchBuilt.audit.publishable, false);
assert.ok(hashMismatchBuilt.audit.blockers.includes('one_or_more_subject_declaration_exact_line_evidence_records_incomplete'));

const mismatchedQuery = input('member:mismatch');
mismatchedQuery.canonicalActivitySubjectDeclarationDiscovery.exactSourcePhraseSearch.query = 'insource:"Different activity"';
mismatchedQuery.contentHash = 'mismatched-query-hash';
const mismatchedBuilt = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [mismatchedQuery], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(mismatchedBuilt.audit.publishable, false);

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'activity:member:a': 'supported' };
const forbidden = buildCanonicalActivitySubjectDeclarationExactLineEvidence({ discoveryRecords: [source], fetchedPages: fetched(), policy: forbiddenPolicy, contentHash: hash });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('canonical_activity_subject_declaration_exact_line_evidence_policy_invalid_or_activity_specific'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict = 'supported';
promotedRecords[0].optimizerEligible = true;
const promoted = auditCanonicalActivitySubjectDeclarationExactLineEvidence(promotedRecords, { discoveryRecords: [source], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('exact_line_evidence_created_unsupported_semantic_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const account = auditCanonicalActivitySubjectDeclarationExactLineEvidence(accountRecords, { discoveryRecords: [source], fetchedPages: fetched(), policy, contentHash: hash });
assert.equal(account.publishable, false);
assert.ok(account.blockers.includes('account_query_state_baked_into_subject_declaration_exact_line_evidence'));

const compiled = compileCanonicalActivitySubjectDeclarationExactLineEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
console.log('Canonical activity subject-declaration exact-line evidence checks passed.');
