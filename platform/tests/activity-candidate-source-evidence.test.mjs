import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  auditActivityCandidateSourceEvidence,
  buildActivityCandidateSourceEvidence,
  collectLexicalReviewCandidates,
  parseLeadParagraphEvidence,
  parseSourceHeadings,
  parseSupportedActivityInfobox
} from '../ingestion/activity-candidate-source-evidence-lib.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const source = `{{External|x=y}}
{{Infobox Activity
|name = Example activity
|skills = {{SCP|Agility|40}}
|requirements = [[Example Quest]]
|image = [[File:Example.png|300px|A pipe stays nested]]
}}
'''Example activity''' is an [[Agility]] activity which requires level 40 Agility.

Players can start another game after completing each run and gain 100 experience.
==Getting there==
Travel takes 30 seconds.
===Route A===
Use the fastest route.
`;
const policy = {
  lexicalSignals: [
    { signalKey: 'activity', family: 'subject_scope', pattern: '\\bis an? .*activity\\b', flags: 'i' },
    { signalKey: 'repeat', family: 'repeatability', pattern: '\\bstart another|each run\\b', flags: 'i' },
    { signalKey: 'xp', family: 'rewards_and_xp', pattern: '\\bexperience\\b', flags: 'i' }
  ]
};
const infobox = parseSupportedActivityInfobox(source);
assert.equal(infobox.template, 'Infobox Activity');
assert.equal(infobox.balanced, true);
assert.deepEqual(infobox.parameters.map(row => row.parameterKey), ['name', 'skills', 'requirements', 'image']);
assert.equal(infobox.parameters.find(row => row.parameterKey === 'image').rawValue, '[[File:Example.png|300px|A pipe stays nested]]');
assert.deepEqual(parseSourceHeadings(source).map(row => [row.level, row.normalizedTitle]), [[2, 'Getting there'], [3, 'Route A']]);
assert.equal(parseLeadParagraphEvidence(source, infobox).length, 2);
assert.equal(collectLexicalReviewCandidates(source, policy).filter(row => row.family === 'repeatability').length, 1);

const candidate = {
  contract: 'sensum.cross-source-entity-activity-candidate.v1',
  candidateKey: 'osrs-wiki-pageid:10',
  candidateKind: 'activity_page_identity_candidate',
  contentHash: 'candidate-hash',
  pageIdentity: { sourcePageId: 10, resolvedTitle: 'Example activity', unlockSourceRevision: '100' },
  skillKeys: ['agility'],
  statementKeys: ['agility:members40:1'],
  sourceContexts: { unlockEvidence: { entityTypes: ['activity_page'] } }
};
const signature = {
  contract: 'sensum.unlock-linked-page-source-signature.v1',
  targetKey: 'wiki-title:example activity',
  sourcePageId: 10,
  resolvedTitle: 'Example activity',
  sourceRevision: '100',
  sourceTimestamp: '2026-09-03T00:00:00Z',
  sourceUrl: 'https://oldschool.runescape.wiki/w/Example_activity',
  sourceContentHash: hash(source),
  rootTemplates: [{ template: 'Infobox Activity', templateKey: 'infobox activity', line: 2 }],
  directCategories: []
};
const page = { pageid: 10, title: 'Example activity', revisions: [{ revid: 100, timestamp: '2026-09-03T00:00:00Z', slots: { main: { content: source } } }] };
const built = buildActivityCandidateSourceEvidence({ candidates: [candidate], signatures: [signature], fetchedPages: [page], policy, contentHash: hash });
assert.equal(built.records.length, 1);
assert.equal(built.audit.sourceEvidenceCoverageComplete, true);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceAlignment.allPageIdsRevisionsAndContentHashesAligned, true);
assert.equal(built.audit.semanticPromotionCoverage.reviewReadyCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityIdentityCount, 0);
assert.equal(built.audit.semanticReviewComplete, false);
assert.equal(built.audit.completeActivityUniverse, false);
assert.equal(built.records[0].optimizerEligible, false);

const aliasSignature = {
  ...signature,
  targetKey: 'wiki-title:example alias',
  requestedTitle: 'Example alias',
  redirected: true,
  referencedBy: { skillKeys: ['strength'], statementKeys: ['strength:members40:1'] }
};
const aliases = buildActivityCandidateSourceEvidence({ candidates: [candidate], signatures: [signature, aliasSignature], fetchedPages: [page], policy, contentHash: hash });
assert.equal(aliases.audit.publishable, true);
assert.deepEqual(aliases.audit.inputCoverage.multiContextSignaturePageIds, ['10']);
assert.deepEqual(aliases.audit.inputCoverage.conflictingSignaturePageIds, []);
assert.equal(aliases.records[0].sourceSignatureContexts.length, 2);
assert.equal(aliases.audit.inputCoverage.preservedSourceSignatureContextCount, 2);

const lostAliasRecords = structuredClone(aliases.records);
lostAliasRecords[0].sourceSignatureContexts.pop();
const lostAlias = auditActivityCandidateSourceEvidence(lostAliasRecords, { candidates: [candidate], signatures: [signature, aliasSignature], fetchedPages: [page], policy });
assert.equal(lostAlias.publishable, false);
assert.ok(lostAlias.blockers.includes('activity_source_signature_context_preservation_failed'));

const conflictingSignature = { ...aliasSignature, sourceRevision: '101' };
const conflicting = buildActivityCandidateSourceEvidence({ candidates: [candidate], signatures: [signature, conflictingSignature], fetchedPages: [page], policy, contentHash: hash });
assert.equal(conflicting.audit.publishable, false);
assert.ok(conflicting.audit.blockers.includes('same_page_source_signature_contexts_conflict'));

const mismatched = structuredClone(page);
mismatched.revisions[0].slots.main.content += 'changed';
const drifted = buildActivityCandidateSourceEvidence({ candidates: [candidate], signatures: [signature], fetchedPages: [mismatched], policy, contentHash: hash });
assert.equal(drifted.audit.publishable, false);
assert.ok(drifted.audit.blockers.includes('one_or_more_source_records_failed_page_revision_or_hash_alignment'));

const noInfoboxSource = "'''Minigames''' are small games. Minigames can be repeated.\n==List==\n";
const noInfoboxSignature = { ...signature, sourceContentHash: hash(noInfoboxSource) };
const noInfoboxPage = { ...page, revisions: [{ ...page.revisions[0], slots: { main: { content: noInfoboxSource } } }] };
const noInfobox = buildActivityCandidateSourceEvidence({ candidates: [candidate], signatures: [noInfoboxSignature], fetchedPages: [noInfoboxPage], policy, contentHash: hash });
assert.equal(noInfobox.audit.publishable, true);
assert.equal(noInfobox.audit.structuralEvidenceCoverage.supportedInfoboxCount, 0);
assert.ok(noInfobox.audit.blockers.includes('one_or_more_activity_candidates_have_no_supported_infobox'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivityIdentity = { key: 'example' };
const promoted = auditActivityCandidateSourceEvidence(promotedRecords, { candidates: [candidate], signatures: [signature], fetchedPages: [page], policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_semantic_repeatability_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 40 };
const accountInjected = auditActivityCandidateSourceEvidence(accountRecords, { candidates: [candidate], signatures: [signature], fetchedPages: [page], policy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_activity_source_evidence'));

console.log('Activity-candidate revision-pinned source-evidence checks passed.');
