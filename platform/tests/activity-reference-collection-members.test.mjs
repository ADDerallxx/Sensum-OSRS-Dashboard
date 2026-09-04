import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  activityReferenceCollectionRequestedTitles,
  auditActivityReferenceCollectionMembers,
  buildActivityReferenceCollectionMembers,
  parseActivityReferenceCollection
} from '../ingestion/activity-reference-collection-member-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-expansion-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-candidate-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-expansion-audit-v1.json', 'utf8'));
const table = (heading, level, memberHeader, member, classification = 'Safe') => `${'='.repeat(level)}${heading}${'='.repeat(level)}
{| class="wikitable"
! Region
! colspan="2"|${memberHeader}
! Classification
|-
| Test region
| [[File:Test.png]]
| ${member}
| ${classification}
|}`;
const content = [
  "'''Minigames''' are a source-declared collection.",
  table('Combat minigames', 2, 'Minigame', '[[Castle Wars]]'),
  table('Skilling minigames', 2, 'Minigame', '[[Tempoross]]'),
  table('Combat and skilling minigames', 2, 'Minigame', '[[Pest Control]]'),
  table('Miscellaneous', 2, 'Minigame', '[[Temple Trekking]] /<br/>[[Temple Trekking|Burgh de Rott Ramble]]'),
  '==Minigame-like content==',
  table('Minigame-like Bosses', 3, 'Activity', '[[Wintertodt]]', 'Boss'),
  table('Minigame-like activities', 3, 'Activity', '[[Tithe Farm]]', 'Activity'),
  '{{Minigames}}',
  '[[Category:Minigames]]'
].join('\n');
const route = {
  contract: 'sensum.activity-candidate-evidence-work-routing.v1',
  candidateKey: 'osrs-wiki-pageid:2078',
  sourcePageId: 2078,
  resolvedTitle: 'Minigames',
  sourceRevision: '100',
  sourceTimestamp: '2026-09-01T00:00:00Z',
  sourceUrl: 'https://oldschool.runescape.wiki/w/Minigames',
  sourceContentHash: hash(content),
  sourceDispositionContentHash: 'disposition-hash',
  contentHash: 'routing-hash',
  routingDecision: { routeKey: 'collection_member_expansion_review', routeState: 'queued' }
};
const page = {
  candidateKey: route.candidateKey,
  pageId: route.sourcePageId,
  title: route.resolvedTitle,
  revision: route.sourceRevision,
  timestamp: route.sourceTimestamp,
  content,
  contentHash: hash(content)
};
const titles = ['Castle Wars', 'Tempoross', 'Pest Control', 'Temple Trekking', 'Wintertodt', 'Tithe Farm'];
const resolutions = titles.map((requestedTitle, index) => ({
  requestedTitle,
  normalizedTitle: requestedTitle,
  resolvedTitle: requestedTitle,
  redirected: false,
  page: {
    pageid: index + 1,
    title: requestedTitle,
    revisions: [{ revid: 200 + index, timestamp: '2026-09-02T00:00:00Z', slots: { main: { content: `source ${requestedTitle}` } } }]
  }
}));

assert.deepEqual(activityReferenceCollectionRequestedTitles({ routes: [route], pages: [page], policy }), titles.sort());
const built = buildActivityReferenceCollectionMembers({ routes: [route], pages: [page], policy, memberResolutions: resolutions });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.explicitTableMemberExtractionComplete, true);
assert.equal(built.records.length, 6);
assert.equal(built.audit.sectionAndTableCoverage.policySectionRuleCount, 6);
assert.equal(built.audit.sectionAndTableCoverage.mappedMemberTableCount, 6);
assert.equal(built.audit.sectionAndTableCoverage.sourceDataRowCount, 6);
assert.equal(built.audit.memberIdentityCoverage.memberLinkOccurrenceCount, 7);
assert.equal(built.audit.memberIdentityCoverage.distinctRequestedTitleCount, 6);
assert.equal(built.audit.memberIdentityCoverage.distinctResolvedWikiPageIdCount, 6);
assert.equal(built.audit.membershipClassificationCoverage.officialMinigameCount, 4);
assert.equal(built.audit.membershipClassificationCoverage.minigameLikeBossCount, 1);
assert.equal(built.audit.membershipClassificationCoverage.minigameLikeActivityCount, 1);
assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
assert.equal(built.audit.canonicalMemberExpansionComplete, false);
for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing required record field: ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing required audit field: ${field}`);

const temple = built.records.find(record => record.memberCellEvidence.plainText.includes('Burgh de Rott Ramble'));
assert.equal(temple.memberLinks.length, 2);
assert.deepEqual(temple.memberLinks.map(link => link.displayText), ['Temple Trekking', 'Burgh de Rott Ramble']);
assert.deepEqual(temple.currentWikiIdentityResolutions.map(value => value.pageId), [4, 4]);
assert.ok(!temple.blockers.includes('source_row_resolves_to_multiple_distinct_wiki_pages'));

const mismatchedPage = { ...page, contentHash: 'wrong' };
const mismatch = buildActivityReferenceCollectionMembers({ routes: [route], pages: [mismatchedPage], policy, memberResolutions: resolutions });
assert.equal(mismatch.audit.publishable, false);
assert.ok(mismatch.audit.blockers.includes('one_or_more_fetched_collection_revisions_do_not_match_the_routed_source'));

const missingSectionPolicy = structuredClone(policy);
missingSectionPolicy.sectionRules.push({ sectionHeading: 'Absent section', headingLevel: 2, memberHeader: 'Minigame', membershipClassification: 'official_minigame' });
const missingSection = buildActivityReferenceCollectionMembers({ routes: [route], pages: [page], policy: missingSectionPolicy, memberResolutions: resolutions });
assert.equal(missingSection.audit.publishable, false);
assert.ok(missingSection.audit.blockers.includes('one_or_more_policy_mapped_sections_are_missing_or_duplicated'));

const multipleContent = content.replace('[[Castle Wars]]', '[[Castle Wars]] / [[Tempoross]]');
const multiplePage = { ...page, content: multipleContent, contentHash: hash(multipleContent) };
const multipleRoute = { ...route, sourceContentHash: hash(multipleContent) };
const multiple = buildActivityReferenceCollectionMembers({ routes: [multipleRoute], pages: [multiplePage], policy, memberResolutions: resolutions });
assert.equal(multiple.audit.publishable, false);
assert.ok(multiple.audit.blockers.includes('one_or_more_source_rows_resolve_to_multiple_distinct_wiki_pages'));

const injectedRecords = structuredClone(built.records);
injectedRecords[0].accountState = { level: 34 };
const injected = auditActivityReferenceCollectionMembers(injectedRecords, { routes: [route], pages: [page], policy, parseAudits: built.parseAudits });
assert.equal(injected.publishable, false);
assert.ok(injected.blockers.includes('account_query_state_baked_into_collection_member_candidates'));

const rawParse = parseActivityReferenceCollection({ route, page, policy, memberResolutionByRequestedTitle: new Map(resolutions.map(value => [value.requestedTitle, value])) });
assert.equal(rawParse.records.length, 6);
assert.equal(rawParse.parseAudit.balancedTables, true);

const rowspanPolicy = { ...policy, sectionRules: [policy.sectionRules[1]] };
const rowspanContent = `==Skilling minigames==
{| class="wikitable"
! Region
! colspan="2"|Minigame
! Classification
|-
| rowspan="2"|Test region
| [[File:First.png]]
| [[Tempoross]]
| Non-combat
|-
| [[File:Second.png]]
| [[Golem crafting]]
| Non-combat
|}`;
const rowspanRoute = { ...route, sourceContentHash: hash(rowspanContent) };
const rowspanPage = { ...page, content: rowspanContent, contentHash: hash(rowspanContent) };
const rowspanParse = parseActivityReferenceCollection({ route: rowspanRoute, page: rowspanPage, policy: rowspanPolicy });
assert.equal(rowspanParse.records.length, 2);
assert.equal(rowspanParse.records[1].memberCellEvidence.plainText, 'Golem crafting');
assert.equal(rowspanParse.records[1].memberCellEvidence.logicalIndex, 2);

const irregularContent = `==Skilling minigames==
{| class="wikitable"
! Region
! colspan="2"|Minigame
! Classification
! Skill(s)
! Description
|-
! class="leagues-global-flag"|Test region
| [[File:First.png]]
| [[Tempoross]]
| Non-combat
| [[Fishing]]
| First row
|-
| [[File:Second.png]]
| [[Golem crafting]]
| Non-combat
| [[Crafting]]
| Source row omits its leading region cell
|}`;
const irregularRoute = { ...route, sourceContentHash: hash(irregularContent) };
const irregularPage = { ...page, content: irregularContent, contentHash: hash(irregularContent) };
const irregularParse = parseActivityReferenceCollection({ route: irregularRoute, page: irregularPage, policy: rowspanPolicy });
assert.equal(irregularParse.records.length, 2);
assert.equal(irregularParse.records[0].memberCellEvidence.plainText, 'Tempoross');
assert.equal(irregularParse.records[1].memberCellEvidence.plainText, 'Golem crafting');
assert.equal(irregularParse.records[1].memberCellEvidence.selection, 'source_image_adjacent_text_cell_within_spanning_member_header');

console.log('Revision-pinned activity reference-collection member expansion checks passed.');
