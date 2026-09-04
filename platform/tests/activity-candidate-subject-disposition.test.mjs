import assert from 'node:assert/strict';
import {
  auditActivityCandidateSubjectDispositions,
  buildActivityCandidateSubjectDispositions,
  compileActivityCandidateSubjectDispositionPolicy,
  plainTextFromWiki
} from '../transforms/activity-candidate-subject-disposition-lib.mjs';

const policy = {
  policy: 'test-policy',
  infoboxTypeDispositions: { Minigame: 'minigame_subject', Boss: 'boss_encounter_subject' },
  leadDeclarationRules: [
    { ruleKey: 'minigame', disposition: 'minigame_subject', pattern: '\\bis an? [^.]{0,80}\\bminigame\\b', flags: 'i', supportedInfobox: 'any' },
    { ruleKey: 'activity', disposition: 'activity_subject', pattern: '\\bis an? [^.]{0,80}\\bactivity\\b', flags: 'i', supportedInfobox: 'any' },
    { ruleKey: 'collection', disposition: 'reference_collection_subject', pattern: '\\bare small games in which players\\b', flags: 'i', supportedInfobox: 'absent' }
  ]
};
const evidence = ({ key = 'one', type = 'Minigame', lead = "'''Example''' is a [[Minigames|minigame]] for players.", infobox = true } = {}) => ({
  contract: 'sensum.activity-candidate-source-evidence.v1',
  candidateKey: `osrs-wiki-pageid:${key}`,
  sourcePageId: Number(key === 'one' ? 1 : key),
  resolvedTitle: `Example ${key}`,
  skillKeys: ['agility'],
  statementKeys: [`agility:${key}`],
  sourceRevision: '100',
  sourceTimestamp: '2026-09-04T00:00:00Z',
  sourceUrl: `https://example.test/${key}`,
  sourceContentHash: `source-${key}`,
  contentHash: `evidence-${key}`,
  sourceSignatureContexts: [{ targetKey: `wiki-title:${key}` }],
  infoboxEvidence: infobox ? { template: 'Infobox Activity', parameters: type === null ? [] : [{ parameterKind: 'named', parameterKey: 'type', rawValue: type, sourceLocator: { lineStart: 2, lineEnd: 2 } }] } : null,
  leadParagraphEvidence: [{ rawText: lead, sourceLocator: { lineStart: 5, lineEnd: 5 } }]
});

assert.equal(plainTextFromWiki("[[File:X.png|left]]\n'''Thing''' is a [[Magic]] [[Minigames|minigame]]."), 'Thing is a Magic minigame.');
assert.deepEqual(compileActivityCandidateSubjectDispositionPolicy(policy).pageSpecificPolicyPaths, []);

const matching = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence()], policy });
assert.equal(matching.audit.publishable, true);
assert.equal(matching.audit.dispositionAttemptCoverageComplete, true);
assert.equal(matching.audit.subjectDispositionComplete, true);
assert.equal(matching.records[0].subjectDisposition.disposition, 'minigame_subject');
assert.equal(matching.records[0].dispositionSignals.length, 2);
assert.equal(matching.records[0].canonicalActivityIdentity, null);
assert.equal(matching.records[0].optimizerEligible, false);

const conflicting = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence({ lead: "'''Example''' is an [[Agility]] activity." })], policy });
assert.equal(conflicting.audit.publishable, true);
assert.equal(conflicting.audit.subjectDispositionComplete, false);
assert.equal(conflicting.audit.dispositionCoverage.conflictingCount, 1);
assert.deepEqual(conflicting.records[0].subjectDisposition.conflictingDispositions, ['activity_subject', 'minigame_subject']);
assert.ok(conflicting.audit.blockers.includes('one_or_more_explicit_source_subject_dispositions_conflict'));

const collection = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence({ key: '2', infobox: false, lead: "'''Things''' are small games in which players complete objectives." })], policy });
assert.equal(collection.records[0].subjectDisposition.disposition, 'reference_collection_subject');

const unresolved = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence({ key: '3', infobox: false, lead: 'No supported declaration.' })], policy });
assert.equal(unresolved.audit.publishable, true);
assert.equal(unresolved.audit.dispositionCoverage.unresolvedCount, 1);
assert.equal(unresolved.audit.subjectDispositionComplete, false);

const unmappedType = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence({ key: '4', type: 'Event', lead: "'''Example''' is an Agility activity." })], policy });
assert.equal(unmappedType.audit.publishable, true);
assert.equal(unmappedType.records[0].subjectDisposition.state, 'blocked_unmapped_infobox_type');
assert.equal(unmappedType.records[0].subjectDisposition.disposition, null);
assert.deepEqual(unmappedType.audit.policyCoverage.unmappedInfoboxTypeValues, ['event']);
assert.ok(unmappedType.audit.blockers.includes('one_or_more_infobox_type_values_unmapped'));

const pageSpecificPolicy = structuredClone(policy);
pageSpecificPolicy.pageIds = [1];
const forbidden = buildActivityCandidateSubjectDispositions({ evidenceRecords: [evidence()], policy: pageSpecificPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('page_specific_subject_disposition_policy_forbidden'));

const promotedRecords = structuredClone(matching.records);
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityCandidateSubjectDispositions(promotedRecords, { evidenceRecords: [evidence()], policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_canonical_repeatability_member_or_optimizer_promotion'));

const alteredRecords = structuredClone(matching.records);
alteredRecords[0].sourceRevision = '999';
const altered = auditActivityCandidateSubjectDispositions(alteredRecords, { evidenceRecords: [evidence()], policy });
assert.equal(altered.publishable, false);
assert.ok(altered.blockers.includes('one_or_more_source_identity_revision_hash_or_context_values_changed'));

const accountRecords = structuredClone(matching.records);
accountRecords[0].accountState = { level: 34 };
const accountInjected = auditActivityCandidateSubjectDispositions(accountRecords, { evidenceRecords: [evidence()], policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_subject_dispositions'));

console.log('Generic activity-candidate subject-disposition checks passed.');
