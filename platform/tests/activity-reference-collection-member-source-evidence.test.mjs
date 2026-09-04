import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityReferenceCollectionMemberSourceEvidence,
  buildActivityReferenceCollectionMemberSourceEvidence
} from '../ingestion/activity-reference-collection-member-source-evidence-lib.mjs';

const evidencePolicy = JSON.parse(fs.readFileSync('platform/policies/activity-candidate-semantic-evidence-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-source-evidence-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-source-evidence-audit-v1.json', 'utf8'));
const sourceA = `{{Infobox Minigame
|name = Example minigame
|skills = [[Agility]]
|requirements = [[Example quest]]
}}
'''Example minigame''' is a minigame. It can be repeated and awards experience.
==Gameplay==
Each game takes five minutes.
`;
const sourceB = `'''Example activity''' is an activity.
==Activity==
Players gain experience for each run.
`;
const identity = ({ pageId, title, revision, content, occurrence = 1, displayTitle = title }) => ({
  occurrence,
  requestedTitle: title,
  requestedFragment: null,
  normalizedTitle: title,
  resolvedTitle: title,
  observedSourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`,
  redirected: displayTitle !== title,
  state: 'resolved_current_wiki_page_identity',
  pageId,
  observedRevision: String(revision),
  observedTimestamp: '2026-09-04T00:00:00Z',
  observedContentHash: hash(content)
});
const candidate = ({ key, pageId, title, revision, content, classification = 'official_minigame', identities = null, displayTitle = title }) => {
  const value = {
    contract: 'sensum.activity-reference-collection-member-candidate.v1',
    memberCandidateKey: key,
    collectionCandidateKey: 'osrs-wiki-pageid:2078',
    collectionSource: { candidateKey: 'osrs-wiki-pageid:2078', pageId: 2078, title: 'Minigames', revision: '100', timestamp: '2026-09-01T00:00:00Z', url: 'https://oldschool.runescape.wiki/w/Minigames', contentHash: 'collection', routingContentHash: 'route', sourceDispositionContentHash: 'disposition' },
    membershipClassification: classification,
    sectionEvidence: { heading: 'Combat minigames', level: 2, sourceLocator: { lineStart: 10, lineEnd: 10 } },
    tableEvidence: { sourceTableOrdinal: 1, sourceLocator: { lineStart: 11, lineEnd: 20 }, memberHeader: 'Minigame', logicalHeaders: ['Region', 'Minigame', 'Minigame'] },
    rowEvidence: { sourceRowOrdinal: 1, sourceLocator: { lineStart: 15, lineEnd: 18 }, rawText: `[[${title}]]`, cells: [] },
    memberCellEvidence: { physicalIndex: 2, logicalIndex: 2, selection: 'logical_header_column', rawValue: `[[${title}|${displayTitle}]]`, plainText: displayTitle, sourceLocator: { lineStart: 17, lineEnd: 17 } },
    memberLinks: [{ occurrence: 1, requestedTitle: title, requestedFragment: null, displayText: displayTitle, rawLink: `[[${title}|${displayTitle}]]`, sourceLocator: { lineStart: 17, lineEnd: 17 } }],
    currentWikiIdentityResolutions: identities || [identity({ pageId, title, revision, content })],
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityReview: { state: 'unreviewed', classification: null, evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_identity_not_established'],
    state: 'explicit_collection_member_candidate'
  };
  value.contentHash = hash(value);
  return value;
};
const candidateAIdentity = identity({ pageId: 10, title: 'Example minigame', revision: 200, content: sourceA });
const candidates = [
  candidate({ key: 'member:1', pageId: 10, title: 'Example minigame', revision: 200, content: sourceA, identities: [candidateAIdentity, { ...candidateAIdentity, occurrence: 2, requestedTitle: 'Example alias' }] }),
  candidate({ key: 'member:2', pageId: 11, title: 'Example activity', revision: 201, content: sourceB, classification: 'minigame_like_activity', displayTitle: 'Activity display' })
];
const fetchedPages = [
  { pageid: 10, title: 'Example minigame', revisions: [{ revid: 200, timestamp: '2026-09-04T00:00:00Z', slots: { main: { content: sourceA } } }] },
  { pageid: 11, title: 'Example activity', revisions: [{ revid: 201, timestamp: '2026-09-04T00:00:00Z', slots: { main: { content: sourceB } } }] }
];

const built = buildActivityReferenceCollectionMemberSourceEvidence({ candidates, fetchedPages, evidencePolicy, contentHash: hash });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.sourceEvidenceCoverageComplete, true);
assert.equal(built.records.length, 2);
assert.equal(built.audit.inputCoverage.exactCandidateAndContextSetMatch, true);
assert.equal(built.audit.sourceAlignment.fullyAlignedCount, 2);
assert.equal(built.audit.sourceAlignment.collectionDisplayResolvedTitleDifferenceCount, 1);
assert.equal(built.audit.sourceAlignment.collectionDisplayResolvedTitleDifferences[0].collectionDisplayLabel, 'Activity display');
assert.equal(built.audit.structuralEvidenceCoverage.supportedInfoboxCount, 1);
assert.equal(built.audit.structuralEvidenceCoverage.missingSupportedInfoboxMemberCandidateKeys.length, 1);
assert.ok(built.audit.lexicalCandidateCoverage.matchedStatementCount > 0);
assert.equal(built.audit.semanticPromotionCoverage.canonicalActivityIdentityCount, 0);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
assert.equal(built.audit.semanticReviewComplete, false);
assert.equal(built.audit.completeActivityUniverse, false);
assert.equal(built.records[0].memberIdentityContexts.length, 2);
assert.equal(built.records[0].sourceRevision, '200');
assert.equal(built.records[0].infoboxEvidence.template, 'Infobox Minigame');
assert.ok(built.records[1].blockers.includes('supported_activity_infobox_not_present'));
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const driftedPages = structuredClone(fetchedPages);
driftedPages[0].revisions[0].slots.main.content += 'changed';
const drifted = buildActivityReferenceCollectionMemberSourceEvidence({ candidates, fetchedPages: driftedPages, evidencePolicy, contentHash: hash });
assert.equal(drifted.audit.publishable, false);
assert.ok(drifted.audit.blockers.includes('one_or_more_member_sources_failed_page_title_revision_timestamp_or_hash_alignment'));

const conflictingCandidates = structuredClone(candidates);
conflictingCandidates[0].currentWikiIdentityResolutions[1].pageId = 99;
const conflicting = buildActivityReferenceCollectionMemberSourceEvidence({ candidates: conflictingCandidates, fetchedPages, evidencePolicy, contentHash: hash });
assert.equal(conflicting.audit.publishable, false);
assert.ok(conflicting.audit.blockers.includes('one_or_more_member_candidates_lack_one_equivalent_resolved_wiki_identity'));

const lostContextRecords = structuredClone(built.records);
lostContextRecords[0].memberIdentityContexts.pop();
const lostContext = auditActivityReferenceCollectionMemberSourceEvidence(lostContextRecords, { candidates, fetchedPages, evidencePolicy });
assert.equal(lostContext.publishable, false);
assert.ok(lostContext.blockers.includes('one_or_more_input_collection_or_identity_contexts_were_not_preserved'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].optimizerEligible = true;
const promoted = auditActivityReferenceCollectionMemberSourceEvidence(promotedRecords, { candidates, fetchedPages, evidencePolicy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('unsupported_semantic_repeatability_or_optimizer_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].accountState = { level: 34 };
const accountInjected = auditActivityReferenceCollectionMemberSourceEvidence(accountRecords, { candidates, fetchedPages, evidencePolicy });
assert.equal(accountInjected.publishable, false);
assert.ok(accountInjected.blockers.includes('account_query_state_baked_into_member_source_evidence'));

console.log('Reference-collection member revision-pinned source-evidence checks passed.');
