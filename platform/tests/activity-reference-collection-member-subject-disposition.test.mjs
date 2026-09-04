import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityReferenceCollectionMemberSubjectDispositions,
  buildActivityReferenceCollectionMemberSubjectDispositions
} from '../transforms/activity-reference-collection-member-subject-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-subject-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-subject-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-subject-disposition-audit-v1.json', 'utf8'));

const evidence = ({ key, type = 'Minigame', lead = "'''Example''' is a minigame.", infobox = true, classification = 'official_minigame', extraLeads = [] }) => {
  const value = {
    contract: 'sensum.activity-reference-collection-member-source-evidence.v1',
    memberCandidateKey: `member:${key}`,
    sourceMemberCandidateContentHash: `member-candidate-${key}`,
    collectionContext: {
      collectionCandidateKey: 'osrs-wiki-pageid:2078',
      collectionSource: { pageId: 2078, revision: '15327496' },
      membershipClassification: classification,
      sectionEvidence: { heading: 'Example section' },
      tableEvidence: { sourceTableOrdinal: 1 },
      rowEvidence: { sourceRowOrdinal: Number(key) || 1 },
      memberCellEvidence: { plainText: `Display ${key}` },
      memberLinks: [{ occurrence: 1, requestedTitle: `Example ${key}` }]
    },
    memberIdentityContexts: [{ pageId: Number(key) || 1, resolvedTitle: `Example ${key}`, observedRevision: `10${key}`, state: 'resolved_current_wiki_page_identity' }],
    sourcePageId: Number(key) || 1,
    resolvedTitle: `Example ${key}`,
    sourceRevision: `10${key}`,
    sourceTimestamp: '2026-09-04T00:00:00Z',
    sourceUrl: `https://example.test/${key}`,
    sourceContentHash: `source-${key}`,
    membershipClassification: classification,
    infoboxEvidence: infobox ? { template: 'Infobox Activity', balanced: true, parameters: type === null ? [] : [{ parameterKind: 'named', parameterKey: 'type', rawValue: type, sourceLocator: { lineStart: 2, lineEnd: 2 } }] } : null,
    leadParagraphEvidence: [{ rawText: lead, sourceLocator: { lineStart: 5, lineEnd: 5 } }, ...extraLeads],
    semanticIdentityReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['source_evidence_requires_semantic_review'],
    state: 'review_ready'
  };
  value.contentHash = hash(value);
  return value;
};

const inputs = [
  evidence({ key: '1' }),
  evidence({ key: '2', lead: "'''Example''' is an Agility activity." }),
  evidence({ key: '3', infobox: false, lead: "'''Example''' is a large building used for training." }),
  evidence({ key: '4', infobox: false, lead: '[[File:Example.png|left]]', extraLeads: [{ rawText: "'''Example''' is a solo activity.", sourceLocator: { lineStart: 6, lineEnd: 6 } }] }),
  evidence({ key: '5', infobox: false, lead: "'''Example''' is a cooperative minigame-style boss that is fought using skills." }),
  evidence({ key: '6', infobox: false, lead: 'No supported source declaration.', classification: 'official_minigame' })
];

const built = buildActivityReferenceCollectionMemberSubjectDispositions({ evidenceRecords: inputs, policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.records.length, inputs.length);
assert.equal(built.audit.inputCoverage.exactInputOutputSetAndContextMatch, true);
assert.equal(built.records[0].subjectDisposition.disposition, 'minigame_subject');
assert.equal(built.records[1].subjectDisposition.state, 'blocked_conflicting_source_declarations');
assert.deepEqual(built.records[1].subjectDisposition.conflictingDispositions, ['activity_subject', 'minigame_subject']);
assert.equal(built.records[2].subjectDisposition.disposition, 'facility_subject');
assert.equal(built.records[3].leadParagraphSelection.sourceParagraphIndex, 1);
assert.equal(built.records[3].subjectDisposition.disposition, 'activity_subject');
assert.equal(built.records[4].subjectDisposition.disposition, 'boss_encounter_subject');
assert.deepEqual(built.records[4].dispositionSignals.map(signal => signal.disposition), ['boss_encounter_subject']);
assert.equal(built.records[5].subjectDisposition.state, 'unresolved_no_supported_source_declaration');
assert.equal(built.records[5].dispositionSignals.length, 0);
assert.equal(built.audit.dispositionCoverage.unresolvedCount, 1);
assert.equal(built.audit.dispositionCoverage.conflictingCount, 1);
assert.equal(built.audit.subjectDispositionComplete, false);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityIdentityCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const pageSpecificPolicy = structuredClone(policy);
pageSpecificPolicy.membershipClassifications = ['official_minigame'];
const forbidden = buildActivityReferenceCollectionMemberSubjectDispositions({ evidenceRecords: inputs, policy: pageSpecificPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_or_collection_class_subject_disposition_policy_forbidden'));

const lostContextRecords = structuredClone(built.records);
lostContextRecords[0].memberIdentityContexts = [];
const lostContext = auditActivityReferenceCollectionMemberSubjectDispositions(lostContextRecords, { evidenceRecords: inputs, policy });
assert.equal(lostContext.publishable, false);
assert.ok(lostContext.blockers.includes('one_or_more_identity_revision_hash_collection_or_alias_context_values_changed'));

const collectionSignalRecords = structuredClone(built.records);
collectionSignalRecords[0].dispositionSignals[0].membershipClassification = 'official_minigame';
const collectionSignal = auditActivityReferenceCollectionMemberSubjectDispositions(collectionSignalRecords, { evidenceRecords: inputs, policy });
assert.equal(collectionSignal.publishable, false);
assert.ok(collectionSignal.blockers.includes('collection_context_used_as_subject_disposition_evidence'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberSubjectDispositions(promotedRecords, { evidenceRecords: inputs, policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_repeatability_member_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 34 };
const accountInjected = auditActivityReferenceCollectionMemberSubjectDispositions(accountRecords, { evidenceRecords: inputs, policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_member_subject_dispositions'));

console.log('Generic collection-member subject-disposition checks passed.');
