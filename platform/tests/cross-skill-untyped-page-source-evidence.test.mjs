import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { parseDirectCategorySignatures, parseRootTemplateSignatures } from '../ingestion/unlock-linked-page-source-signature-lib.mjs';
import {
  auditCrossSkillUntypedPageSourceEvidence,
  buildCrossSkillUntypedPageSourceEvidence,
  compileCrossSkillUntypedPageEvidencePolicy,
  findCrossSkillUntypedPageEvidenceAccountState
} from '../ingestion/cross-skill-untyped-page-source-evidence-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-untyped-page-source-evidence-v1.json', 'utf8'));
const withHash = record => ({ ...record, contentHash: hash(record) });
const contentA = `{{Infobox Item\n|name=Example set\n}}\n'''Example set''' is a collection used by players.\n\nSecond lead paragraph.\n==Components==\nEvidence.\n[[Category:Equipment]]`;
const contentB = `{{Information\n|description=An image\n}}\n'''Hammer.png''' is a file page.\n==File history==\nEvidence.\n[[Category:Item images]]`;

function candidate({ pageId, revision, title, sourceHash, key, kind = 'untyped_page_identity_candidate' }) {
  return withHash({
    contract: 'sensum.cross-source-entity-activity-candidate.v1',
    candidateKey: key,
    candidateKind: kind,
    pageIdentity: { sourcePageId: pageId, resolvedTitle: title, unlockSourceRevision: revision, renderedSourceRevision: revision, revisionRelationship: 'same_revision' },
    sourceContexts: { unlockEvidence: { source: { sourceContentHash: sourceHash } } },
    skillKeys: ['smithing'],
    statementKeys: [`smithing:${pageId}`],
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false
  });
}

function signature({ pageId, revision, title, content, targetKey, requestedTitle = title, redirected = false }) {
  const timestamp = pageId === 100 ? '2026-09-01T00:00:00Z' : '2026-09-02T00:00:00Z';
  return withHash({
    contract: 'sensum.unlock-linked-page-source-signature.v1',
    targetKey,
    requestedTitle,
    requestedFragment: null,
    resolvedTitle: title,
    redirected,
    referencedBy: { skillKeys: ['smithing'], statementKeys: [`smithing:${pageId}`] },
    sourcePageId: pageId,
    identitySourceRevision: revision,
    sourceRevision: revision,
    sourceTimestamp: timestamp,
    sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    sourceContentHash: hash(content),
    sourceContentBytes: Buffer.byteLength(content, 'utf8'),
    revisionAlignedWithIdentity: true,
    rootTemplates: parseRootTemplateSignatures(content),
    directCategories: parseDirectCategorySignatures(content),
    entityTypes: [],
    canonicalEntityIdentity: false,
    repeatableTrainingActivity: null,
    mechanicsEvidence: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['entity_type_not_classified'],
    state: 'blocked'
  });
}

function page({ pageId, revision, title, content, ns = 0 }) {
  return { pageid: pageId, ns, title, revisions: [{ revid: Number(revision), timestamp: pageId === 100 ? '2026-09-01T00:00:00Z' : '2026-09-02T00:00:00Z', slots: { main: { content } } }] };
}

const signatures = [
  signature({ pageId: 100, revision: '9001', title: 'Example set', content: contentA, targetKey: 'wiki-title:example set' }),
  signature({ pageId: 100, revision: '9001', title: 'Example set', content: contentA, targetKey: 'wiki-title:example equipment', requestedTitle: 'Example equipment', redirected: true }),
  signature({ pageId: 101, revision: '9002', title: 'File:Hammer.png', content: contentB, targetKey: 'wiki-title:file:hammer.png' })
];
const candidates = [
  candidate({ pageId: 100, revision: '9001', title: 'Example set', sourceHash: hash(contentA), key: 'osrs-wiki-pageid:100' }),
  candidate({ pageId: 101, revision: '9002', title: 'File:Hammer.png', sourceHash: hash(contentB), key: 'osrs-wiki-pageid:101' }),
  candidate({ pageId: 102, revision: '9003', title: 'Already typed', sourceHash: 'unused', key: 'osrs-wiki-pageid:102', kind: 'typed_page_identity_candidate' })
];
const pages = [
  page({ pageId: 100, revision: '9001', title: 'Example set', content: contentA }),
  page({ pageId: 101, revision: '9002', title: 'File:Hammer.png', content: contentB, ns: 6 })
];

test('policy is fail-closed and forbids automatic page typing', () => {
  assert.deepEqual(compileCrossSkillUntypedPageEvidencePolicy(policy), { valid: true, invalidRules: [] });
  assert.equal(compileCrossSkillUntypedPageEvidencePolicy({ ...policy, rules: { ...policy.rules, automaticVerificationAllowed: true } }).valid, false);
  assert.equal(compileCrossSkillUntypedPageEvidencePolicy({ ...policy, candidateKind: 'activity_page_identity_candidate' }).valid, false);
});

test('builds one exact-revision packet per untyped candidate and preserves every source context', () => {
  const built = buildCrossSkillUntypedPageSourceEvidence({ candidates, signatures, fetchedPages: pages, policy, contentHash: hash });
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.sourceEvidenceCoverageComplete, true);
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.inputCoverage.preservedSourceSignatureContextCount, 3);
  assert.equal(built.audit.sourceAlignment.fullyAlignedCount, 2);
  assert.deepEqual(built.audit.structuralEvidenceCoverage.namespaceCounts, { '0': 1, '6': 1 });
  assert.equal(built.records[0].sourceSignatureContexts.length, 2);
  assert.equal(built.records[0].rootTemplateEvidence[0].template, 'Infobox Item');
  assert.equal(built.records[0].directCategoryEvidence[0].category, 'Equipment');
  assert.equal(built.records[0].leadParagraphEvidence.length, 2);
  assert.equal(built.records[0].headingEvidence[0].normalizedTitle, 'Components');
  assert.equal(built.records[1].sourceNamespaceId, 6);
  assert.deepEqual(built.records[1].pageTypeReview, { state: 'unreviewed', disposition: null, evidenceKeys: [] });
  assert.equal(built.records[1].canonicalGameEntityIdentity, null);
  assert.equal(built.records[1].canonicalActivityIdentity, null);
  assert.equal(built.records[1].optimizerEligible, false);
  assert.equal(built.audit.semanticPromotionCoverage.optimizerEligibleCount, 0);
  assert.equal(built.audit.pageTypeReviewComplete, false);
});

test('output is deterministic for identical exact-revision inputs', () => {
  const first = buildCrossSkillUntypedPageSourceEvidence({ candidates, signatures, fetchedPages: pages, policy, contentHash: hash });
  const second = buildCrossSkillUntypedPageSourceEvidence({ candidates, signatures, fetchedPages: pages, policy, contentHash: hash });
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

for (const [name, mutate, blocker] of [
  ['candidate intrinsic hash drift', ({ candidates }) => { candidates[0] = { ...candidates[0], contentHash: 'bad' }; }, 'one_or_more_untyped_sources_failed_exact_alignment'],
  ['source-signature intrinsic hash drift', ({ signatures }) => { signatures[0] = { ...signatures[0], contentHash: 'bad' }; }, 'one_or_more_untyped_sources_failed_exact_alignment'],
  ['fetched source content drift', ({ pages }) => { pages[0].revisions[0].slots.main.content += '\nchanged'; }, 'one_or_more_untyped_sources_failed_exact_alignment'],
  ['fetched revision drift', ({ pages }) => { pages[0].revisions[0].revid = 9999; }, 'untyped_exact_revision_fetch_set_incomplete'],
  ['fetched timestamp drift', ({ pages }) => { pages[0].revisions[0].timestamp = '2026-09-03T00:00:00Z'; }, 'one_or_more_untyped_sources_failed_exact_alignment'],
  ['fetched namespace missing', ({ pages }) => { pages[0].ns = null; }, 'one_or_more_untyped_sources_missing_namespace'],
  ['retained template inventory drift', ({ signatures }) => { signatures[0] = withHash({ ...signatures[0], contentHash: undefined, rootTemplates: [] }); }, 'one_or_more_untyped_sources_failed_exact_alignment'],
  ['missing source signature page', ({ signatures }) => { signatures.splice(2, 1); }, 'untyped_candidate_source_signature_join_incomplete'],
  ['missing exact revision source', ({ pages }) => { pages.splice(1, 1); }, 'untyped_exact_revision_fetch_set_incomplete']
]) test(`fails closed on ${name}`, () => {
  const input = { candidates: structuredClone(candidates), signatures: structuredClone(signatures), pages: structuredClone(pages) };
  mutate(input);
  const built = buildCrossSkillUntypedPageSourceEvidence({ candidates: input.candidates, signatures: input.signatures, fetchedPages: input.pages, policy, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes(blocker), JSON.stringify(built.audit.blockers));
});

test('audit rejects dropped contexts, semantic promotion, and account state', () => {
  const built = buildCrossSkillUntypedPageSourceEvidence({ candidates, signatures, fetchedPages: pages, policy, contentHash: hash });
  const dropped = structuredClone(built.records);
  dropped[0].sourceSignatureContexts.pop();
  assert.equal(auditCrossSkillUntypedPageSourceEvidence(dropped, { candidates, signatures, fetchedPages: pages, policy, contentHash: hash }).publishable, false);
  const promoted = structuredClone(built.records);
  promoted[0].pageTypeReview = { state: 'reviewed', disposition: 'item_group', evidenceKeys: ['title'] };
  promoted[0].canonicalGameEntityIdentity = { key: 'invented' };
  promoted[0].optimizerEligible = true;
  const promotionAudit = auditCrossSkillUntypedPageSourceEvidence(promoted, { candidates, signatures, fetchedPages: pages, policy, contentHash: hash });
  assert.equal(promotionAudit.publishable, false);
  assert.equal(promotionAudit.semanticPromotionCoverage.unsupportedPromotionCandidateKeys.length, 1);
  const accountScoped = structuredClone(built.records);
  accountScoped[0].accountState = { currentBaseLevel: 50 };
  assert.equal(findCrossSkillUntypedPageEvidenceAccountState(accountScoped).length, 2);
  assert.equal(auditCrossSkillUntypedPageSourceEvidence(accountScoped, { candidates, signatures, fetchedPages: pages, policy, contentHash: hash }).publishable, false);
});

test('CLI rejects a tampered upstream snapshot before fetching or writing output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-untyped-evidence-'));
  try {
    const directory = path.join(root, '2026-09-05T00-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'cross-source-entity-activity-candidate.ndjson'), `${JSON.stringify(candidates[0])}\n`);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1',
      domain: 'cross-source-entity-activity-candidate',
      records: 1,
      contentHash: 'tampered',
      source: { audit: { candidateInventoryComplete: true, publishable: true, candidateCoverage: { kindCounts: { untyped_page_identity_candidate: 68 } } } }
    }));
    const result = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-cross-skill-untyped-page-source-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('cross-skill-untyped-page-source-evidence')).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill untyped-page revision-pinned source-evidence checks passed.');
