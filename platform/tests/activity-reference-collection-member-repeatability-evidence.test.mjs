import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityReferenceCollectionMemberRepeatabilityEvidence,
  buildActivityReferenceCollectionMemberRepeatabilityEvidence,
  compileRepeatabilityEvidencePolicy,
  maskRepeatabilityIgnoredRegions
} from '../ingestion/activity-reference-collection-member-repeatability-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-repeatability-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-repeatability-evidence-audit-v1.json', 'utf8'));

const wikiUrl = title => `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

function fixture({ key, pageId, title, revision, content, rowText = 'Players perform the activity for a reward.' }) {
  const sourceContentHash = hash(content);
  const collectionRevision = '15327496';
  return {
    input: {
      contract: policy.inputContract,
      memberCandidateKey: `collection-row:${key}`,
      sourcePageId: pageId,
      resolvedTitle: title,
      sourceRevision: String(revision),
      sourceTimestamp: '2026-09-04T00:00:00Z',
      sourceUrl: wikiUrl(title),
      sourceContentHash,
      canonicalActivityIdentityEvidence: {
        collectionDefinition: {
          collectionSource: {
            pageId: 2078,
            title: 'Minigames',
            revision: collectionRevision,
            timestamp: '2026-09-01T17:56:27Z',
            url: wikiUrl('Minigames'),
            contentHash: 'collection-source-hash'
          },
          rowEvidence: {
            sourceRowOrdinal: 1,
            rawText: rowText,
            sourceLocator: { lineStart: 40, lineEnd: 40 + rowText.split(/\r?\n/).length - 1 }
          }
        }
      },
      canonicalActivityIdentityReview: { state: 'reviewed_source_supported' },
      canonicalActivityIdentity: {
        canonicalActivityKey: `activity:test:${key}`,
        identityClass: 'collection_defined_activity_with_descriptive_page_anchor',
        canonicalLabel: `Activity ${key}`,
        evidenceRevisionBoundary: { collectionRevision, linkedSourceRevision: String(revision) },
        linkedSubjectIsCanonicalActivity: false,
        evidenceKeys: [`identity:${key}`]
      },
      canonicalGameEntityIdentity: null,
      repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
      memberExpansionReview: { state: 'unreviewed', atomicSubject: null, memberKeys: [], evidenceKeys: [] },
      mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
      optimizerEligible: false,
      accountIndependent: true,
      blockers: ['repeatability-pending'],
      contentHash: `canonical-identity-${key}`
    },
    page: {
      pageid: pageId,
      title,
      revisions: [{ revid: Number(revision), timestamp: '2026-09-04T00:00:00Z', slots: { main: { content } } }]
    }
  };
}

const fixtures = [
  fixture({ key: 'positive', pageId: 1001, title: 'Positive source', revision: 2001, content: 'The task can be repeated.' }),
  fixture({ key: 'negative', pageId: 1002, title: 'Negative source', revision: 2002, content: 'The task cannot be repeated. It is a one-time task.' }),
  fixture({
    key: 'recurrence', pageId: 1003, title: 'Recurrence source', revision: 2003,
    content: 'The character can assign various tasks. There are 59 tasks in total that can be assigned.',
    rowText: 'Players receive rewards at the end of the game.'
  }),
  fixture({
    key: 'masked', pageId: 1004, title: 'Masked source', revision: 2004,
    content: '<!-- The task can be repeated. -->\n<nowiki>repeatable activity</nowiki>\nNo repeatability declaration appears here.'
  })
];
const inputs = fixtures.map(fixture => fixture.input);
const pages = fixtures.map(fixture => fixture.page);
const built = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: inputs, fetchedPages: pages, policy, contentHash: hash });

assert.equal(built.audit.publishable, true);
assert.equal(built.audit.evidencePacketAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityEvidencePacketCoverageComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.repeatabilityEvidenceCoverage.completePacketCount, 4);
assert.equal(built.audit.repeatabilityEvidenceCoverage.completeLinkedSourceScanCount, 4);
assert.equal(built.audit.repeatabilityEvidenceCoverage.exactCollectionRowScanCount, 4);
assert.equal(built.audit.candidateObservationCoverage.explicitPositiveDeclarationCandidateCount, 1);
assert.equal(built.audit.candidateObservationCoverage.explicitNegativeDeclarationCandidateCount, 2);
assert.equal(built.audit.candidateObservationCoverage.recurrenceStructureCandidateCount, 2);
assert.equal(built.audit.candidateObservationCoverage.sessionBoundaryCandidateCount, 1);
assert.equal(built.audit.candidateObservationCoverage.zeroSignalPacketCount, 1);
assert.equal(built.audit.candidateObservationCoverage.repeatabilityVerdictCount, 0);
assert.equal(built.records[3].repeatabilityCandidateObservations.noLexicalSignalObserved, true);
assert.equal(built.records[3].repeatabilityCandidateObservations.absenceSemantics, 'no_lexical_signal_does_not_establish_non_repeatability');
assert.ok(built.records.every(record =>
  record.repeatabilityCandidateObservations.repeatabilityVerdict === null
  && record.repeatabilityReview.state === 'unreviewed'
  && record.memberExpansionReview.state === 'unreviewed'
  && record.mechanicsReview.state === 'unreviewed'
  && record.optimizerEligible === false
));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const conflictFixture = fixture({ key: 'conflict', pageId: 1010, title: 'Conflict source', revision: 2010, content: 'The task can be repeated, but this task cannot be repeated.' });
const conflict = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: [conflictFixture.input], fetchedPages: [conflictFixture.page], policy, contentHash: hash });
assert.equal(conflict.audit.publishable, true);
assert.equal(conflict.records[0].repeatabilityCandidateObservations.positiveNegativeConflictCandidate, true);
assert.equal(conflict.records[0].repeatabilityCandidateObservations.repeatabilityVerdict, null);

const renamedFixture = fixture({ key: 'renamed', pageId: 1011, title: 'Completely renamed source', revision: 2011, content: 'The activity is repeatable.' });
const renamed = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: [renamedFixture.input], fetchedPages: [renamedFixture.page], policy, contentHash: hash });
assert.equal(renamed.audit.publishable, true);
assert.equal(renamed.audit.candidateObservationCoverage.explicitPositiveDeclarationCandidateCount, 1);

const mismatchedPages = structuredClone(pages);
mismatchedPages[0].revisions[0].slots.main.content = 'Changed source text.';
const mismatched = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: inputs, fetchedPages: mismatchedPages, policy, contentHash: hash });
assert.equal(mismatched.audit.publishable, false);
assert.ok(mismatched.audit.blockers.includes('one_or_more_linked_sources_failed_page_title_revision_timestamp_url_or_hash_alignment'));

const missingFetch = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: inputs, fetchedPages: pages.slice(1), policy, contentHash: hash });
assert.equal(missingFetch.audit.publishable, false);
assert.ok(missingFetch.audit.blockers.includes('exact_linked_source_revision_fetch_set_incomplete'));

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 1001: 'repeatable' };
const forbidden = buildActivityReferenceCollectionMemberRepeatabilityEvidence({ identityDispositionRecords: inputs, fetchedPages: pages, policy: forbiddenPolicy, contentHash: hash });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_specific_repeatability_evidence_policy_forbidden'));

const alteredRecords = structuredClone(built.records);
alteredRecords[0].repeatabilityEvidence.sourceLocatedSignals = [];
const altered = auditActivityReferenceCollectionMemberRepeatabilityEvidence(alteredRecords, { identityDispositionRecords: inputs, fetchedPages: pages, policy, contentHash: hash });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_repeatability_evidence_packets_or_signals_do_not_match_exact_revision_sources'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].repeatabilityCandidateObservations.repeatabilityVerdict = 'repeatable';
promotedRecords[0].repeatabilityReview = { state: 'reviewed_source_supported', classification: 'repeatable', evidenceKeys: [] };
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberRepeatabilityEvidence(promotedRecords, { identityDispositionRecords: inputs, fetchedPages: pages, policy, contentHash: hash });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const accountScoped = auditActivityReferenceCollectionMemberRepeatabilityEvidence(accountRecords, { identityDispositionRecords: inputs, fetchedPages: pages, policy, contentHash: hash });
assert.equal(accountScoped.publishable, false);
assert.ok(accountScoped.blockers.includes('account_query_state_baked_into_repeatability_evidence'));

const compiled = compileRepeatabilityEvidencePolicy(policy);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
assert.deepEqual(compiled.duplicateDefinitionKeys, []);
assert.deepEqual(compiled.invalidDefinitionKeys, []);
assert.deepEqual(compiled.requiredDefinitionKindsMissing, []);
assert.equal(maskRepeatabilityIgnoredRegions('<!-- repeatable -->\nvisible').includes('repeatable'), false);

console.log('Revision-pinned collection-activity repeatability-evidence packet checks passed.');
