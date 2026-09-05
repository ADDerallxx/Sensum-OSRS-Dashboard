import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions,
  buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions,
  compileCrossSkillUntypedPageSufficiencyPolicy,
  findCrossSkillUntypedPageSufficiencyAccountState
} from '../transforms/cross-skill-untyped-page-source-evidence-sufficiency-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-untyped-page-source-evidence-sufficiency-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-evidence-sufficiency-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-evidence-sufficiency-disposition-audit-v1.json', 'utf8'));
const inputSnapshotContentHash = 'a'.repeat(64);
const withHash = record => ({ ...record, contentHash: hash(record) });

function evidence({ candidateKey, pageId, title, namespaceId }) {
  return withHash({
    contract: policy.inputContract,
    candidateKey,
    sourceCandidateContentHash: hash(`candidate:${candidateKey}`),
    sourceSignatureContexts: [{
      targetKey: `wiki-title:${title.toLowerCase()}`,
      requestedTitle: title,
      requestedFragment: null,
      redirected: false,
      pageId,
      identitySourceRevision: String(9000 + pageId),
      sourceSignatureContentHash: hash(`signature:${candidateKey}`),
      referencedBy: { skillKeys: ['smithing'], statementKeys: [`smithing:${pageId}`] }
    }],
    sourcePageId: pageId,
    resolvedTitle: title,
    sourceNamespaceId: namespaceId,
    skillKeys: ['smithing'],
    statementKeys: [`smithing:${pageId}`],
    sourceRevision: String(9000 + pageId),
    sourceTimestamp: '2026-09-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    sourceContentHash: hash(`source:${candidateKey}`),
    sourceContentBytes: 128,
    sourceLineCount: 8,
    revisionAlignment: {
      policyValid: true,
      candidateIntrinsicHashValid: true,
      signatureIntrinsicHashesValid: true,
      allSignatureContextsEquivalent: true,
      candidateAndSignaturePageIdMatch: true,
      candidateAndSignatureRevisionMatch: true,
      candidateAndSignatureContentHashMatch: true,
      fetchedAndSignaturePageIdMatch: true,
      fetchedAndSignatureRevisionMatch: true,
      fetchedAndSignatureTimestampMatch: true,
      fetchedAndSignatureTitleMatch: true,
      fetchedAndSignatureContentHashMatch: true,
      fetchedAndSignatureContentBytesMatch: true,
      fetchedRootTemplatesMatchSignatures: true,
      fetchedDirectCategoriesMatchSignatures: true
    },
    rootTemplateEvidence: [{ template: 'Infobox Item', templateKey: 'infobox item', line: 1 }],
    directCategoryEvidence: [{ category: 'Equipment', categoryKey: 'equipment', line: 8 }],
    leadParagraphEvidence: [{ ordinal: 1, rawText: `${title} evidence.`, sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 4 }],
    pageTypeReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['page_type_semantic_review_pending'],
    state: 'review_ready'
  });
}

const inputs = [
  evidence({ candidateKey: 'osrs-wiki-pageid:100', pageId: 100, title: 'Example item', namespaceId: 0 }),
  evidence({ candidateKey: 'osrs-wiki-pageid:101', pageId: 101, title: 'File:Example.png', namespaceId: 6 })
];

test('policy is generic, fail-closed, and contains no page-specific selectors', () => {
  assert.deepEqual(compileCrossSkillUntypedPageSufficiencyPolicy(policy), { valid: true, invalidRules: [], forbiddenPolicyPaths: [] });
  const automatic = structuredClone(policy);
  automatic.rules.automaticVerificationAllowed = true;
  assert.equal(compileCrossSkillUntypedPageSufficiencyPolicy(automatic).valid, false);
  const specific = structuredClone(policy);
  specific.candidateOverrides = { 'osrs-wiki-pageid:100': 'item' };
  assert.equal(compileCrossSkillUntypedPageSufficiencyPolicy(specific).valid, false);
});

test('routes complete packets only by exact namespace while preserving semantic closure', () => {
  const built = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.dispositionCoverageComplete, true);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.dispositionCoverage.sourceEvidenceSufficientForReviewCount, 2);
  assert.equal(built.audit.dispositionCoverage.mainNamespaceReviewRouteCount, 1);
  assert.equal(built.audit.dispositionCoverage.nonMainNamespaceReviewRouteCount, 1);
  assert.equal(built.records[0].reviewRoute, 'explicit_main_namespace_page_type_review');
  assert.equal(built.records[1].reviewRoute, 'explicit_non_main_namespace_scope_review');
  assert.equal(built.audit.semanticPreservationCoverage.pageTypeReviewedCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.canonicalGameEntityIdentityCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.canonicalActivityIdentityCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.repeatabilityClassifiedCount, 0);
  assert.equal(built.audit.semanticPreservationCoverage.optimizerEligibleCount, 0);
  for (const row of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(row, field), `Missing disposition field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('identical source-bound inputs produce deterministic records and audit', () => {
  const first = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
  const second = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: structuredClone(inputs), inputSnapshotContentHash, policy: structuredClone(policy), contentHash: hash });
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.audit), hash(second.audit));
});

for (const [name, mutate] of [
  ['intrinsic record hash drift', rows => { rows[0].contentHash = '0'.repeat(64); }],
  ['missing exact namespace', rows => { rows[0] = withHash({ ...rows[0], contentHash: undefined, sourceNamespaceId: null }); }],
  ['failed revision alignment', rows => { rows[0].revisionAlignment.fetchedAndSignatureRevisionMatch = false; rows[0] = withHash({ ...rows[0], contentHash: undefined }); }],
  ['missing source signature context', rows => { rows[0].sourceSignatureContexts = []; rows[0] = withHash({ ...rows[0], contentHash: undefined }); }],
  ['missing source byte count', rows => { delete rows[0].sourceContentBytes; rows[0] = withHash({ ...rows[0], contentHash: undefined }); }]
]) test(`fails closed on ${name}`, () => {
  const rows = structuredClone(inputs);
  mutate(rows);
  const built = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: rows, inputSnapshotContentHash, policy, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('one_or_more_input_evidence_records_invalid_or_unaligned'));
});

test('fails closed when the source snapshot binding is absent', () => {
  const built = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash: '', policy, contentHash: hash });
  assert.equal(built.audit.publishable, false);
  assert.ok(built.audit.blockers.includes('source_evidence_snapshot_hash_missing'));
});

test('audit rejects altered bindings, summaries, routes, and semantic promotion', () => {
  const built = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
  for (const [mutate, blocker] of [
    [rows => { rows[0].evidenceFingerprint = '0'.repeat(64); }, 'one_or_more_input_snapshot_identity_or_evidence_bindings_changed'],
    [rows => { rows[0].evidenceSummary.headingCount += 1; }, 'one_or_more_structural_evidence_summaries_changed'],
    [rows => { rows[0].reviewRoute = 'explicit_non_main_namespace_scope_review'; }, 'one_or_more_namespace_scoped_review_routes_invalid'],
    [rows => { rows[0].pageTypeReview = { state: 'reviewed', disposition: 'item', evidenceKeys: ['title'] }; }, 'unsupported_page_type_identity_repeatability_or_optimizer_promotion'],
    [rows => { rows[0].canonicalActivityIdentity = { key: 'invented' }; rows[0].repeatabilityClassification = 'repeatable'; rows[0].optimizerEligible = true; }, 'unsupported_page_type_identity_repeatability_or_optimizer_promotion']
  ]) {
    const rows = structuredClone(built.records);
    mutate(rows);
    const audit = auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(rows, { evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
    assert.equal(audit.publishable, false);
    assert.ok(audit.blockers.includes(blocker), JSON.stringify(audit.blockers));
  }
});

test('audit rejects account state and incomplete or duplicate output sets', () => {
  const built = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash });
  const accountScoped = structuredClone(built.records);
  accountScoped[0].accountState = { currentBaseLevel: 50 };
  assert.equal(findCrossSkillUntypedPageSufficiencyAccountState(accountScoped).length, 2);
  assert.equal(auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(accountScoped, { evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash }).publishable, false);
  const missing = structuredClone(built.records).slice(0, 1);
  assert.equal(auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(missing, { evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash }).publishable, false);
  const duplicate = [...structuredClone(built.records), structuredClone(built.records[0])];
  assert.equal(auditCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions(duplicate, { evidenceRecords: inputs, inputSnapshotContentHash, policy, contentHash: hash }).publishable, false);
});

test('CLI rejects a tampered upstream manifest without writing an output snapshot', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-untyped-sufficiency-'));
  try {
    const directory = path.join(root, '2026-09-05T00-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    const raw = `${JSON.stringify(inputs[0])}\n`;
    fs.writeFileSync(path.join(directory, 'cross-skill-untyped-page-source-evidence.ndjson'), raw);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1',
      domain: 'cross-skill-untyped-page-source-evidence',
      records: 1,
      contentHash: 'tampered',
      source: { audit: { sourceEvidenceCoverageComplete: true, pageTypeReviewComplete: false, canonicalIdentityComplete: false, repeatabilityAndMechanicsComplete: false, completeActivityUniverse: false, publishable: true } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/build-cross-skill-untyped-page-source-evidence-sufficiency-dispositions.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('sufficiency-disposition')).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill untyped-page source-evidence sufficiency disposition checks passed.');
