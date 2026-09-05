import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions } from '../transforms/cross-skill-untyped-page-source-evidence-sufficiency-disposition-lib.mjs';
import {
  auditCrossSkillUntypedPageSourceBoundReviewQueueExport,
  buildCrossSkillUntypedPageSourceBoundReviewQueueExport,
  compileCrossSkillUntypedPageReviewQueueExportPolicy,
  renderCrossSkillUntypedPageReviewQueueMarkdown,
  serializeCrossSkillUntypedPageReviewDecisionTemplates
} from '../transforms/cross-skill-untyped-page-source-bound-review-queue-export-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-untyped-page-source-bound-review-queue-export-v1.json', 'utf8'));
const pageTypePolicy = JSON.parse(fs.readFileSync('platform/policies/unlock-linked-page-entity-type-v1.json', 'utf8'));
const dispositionPolicy = JSON.parse(fs.readFileSync('platform/policies/cross-skill-untyped-page-source-evidence-sufficiency-disposition-v1.json', 'utf8'));
const queueContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-bound-review-queue-entry-v1.json', 'utf8'));
const templateContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-bound-review-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/cross-skill-untyped-page-source-bound-review-queue-export-audit-v1.json', 'utf8'));
const evidenceSnapshotContentHash = 'a'.repeat(64);
const dispositionSnapshotContentHash = 'b'.repeat(64);
const snapshotRecord = record => ({ ...record, contentHash: hash(record) });

function evidence({ candidateKey, pageId, title, namespaceId }) {
  const record = {
    contract: policy.evidenceContract,
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
    sourceContentBytes: 256,
    sourceLineCount: 12,
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
    rootTemplateEvidence: [{ template: 'Example', templateKey: 'example', line: 1 }],
    directCategoryEvidence: [{ category: 'Examples', categoryKey: 'examples', line: 12 }],
    leadParagraphEvidence: [{ ordinal: 1, rawText: `${title} is retained evidence, not a verdict.`, sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [{ ordinal: 1, level: 2, rawTitle: 'Uses', normalizedTitle: 'Uses', line: 5 }],
    pageTypeReview: { state: 'unreviewed', disposition: null, evidenceKeys: [] },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['page_type_semantic_review_pending'],
    state: 'review_ready'
  };
  return snapshotRecord(record);
}

const evidenceRecords = [
  evidence({ candidateKey: 'osrs-wiki-pageid:100', pageId: 100, title: 'Example page', namespaceId: 0 }),
  evidence({ candidateKey: 'osrs-wiki-pageid:101', pageId: 101, title: 'File:Example.png', namespaceId: 6 })
];
const dispositionBuild = buildCrossSkillUntypedPageSourceEvidenceSufficiencyDispositions({ evidenceRecords, inputSnapshotContentHash: evidenceSnapshotContentHash, policy: dispositionPolicy, contentHash: hash });
assert.equal(dispositionBuild.audit.publishable, true);
const dispositionRecords = dispositionBuild.records.map(snapshotRecord);

function build(overrides = {}) {
  return buildCrossSkillUntypedPageSourceBoundReviewQueueExport({
    dispositionRecords,
    evidenceRecords,
    policy,
    pageTypePolicy,
    dispositionSnapshotContentHash,
    evidenceSnapshotContentHash,
    contentHash: hash,
    ...overrides
  });
}

test('policy is generic and uses exactly the existing reviewed page-type vocabulary', () => {
  const compiled = compileCrossSkillUntypedPageReviewQueueExportPolicy(policy, pageTypePolicy);
  assert.equal(compiled.valid, true);
  assert.equal(compiled.allowedPageTypeCount, 22);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.overrides = { 'osrs-wiki-pageid:100': 'item_page' };
  assert.equal(compileCrossSkillUntypedPageReviewQueueExportPolicy(specific, pageTypePolicy).valid, false);
  const expandedVocabulary = structuredClone(policy);
  expandedVocabulary.allowedPageTypes.push('invented_page_type');
  assert.equal(compileCrossSkillUntypedPageReviewQueueExportPolicy(expandedVocabulary, pageTypePolicy).valid, false);
});

test('exports one ordered source-bound queue entry and one blank template per disposition', () => {
  const built = build();
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.records.length, 2);
  assert.equal(built.decisionTemplates.length, 2);
  assert.equal(built.audit.queueCoverage.mainNamespaceReviewEntryCount, 1);
  assert.equal(built.audit.queueCoverage.nonMainNamespaceReviewEntryCount, 1);
  assert.equal(built.audit.sourceIntegrityCoverage.retainedSourceSignatureContextCount, 2);
  assert.equal(built.records[0].sourcePageIdentity.sourceRevision, evidenceRecords[0].sourceRevision);
  assert.deepEqual(built.records[0].structuralEvidence.leadParagraphs, evidenceRecords[0].leadParagraphEvidence);
  assert.equal(built.records[0].reviewDecision, null);
  assert.deepEqual(built.records[0].reviewedPageTypes, []);
  assert.equal(built.records[0].optimizerEligible, false);
  assert.equal(built.decisionTemplates[0].decision, null);
  assert.deepEqual(built.decisionTemplates[0].selectedPageTypes, []);
  assert.match(built.reviewMarkdown, /revision 9100/);
  assert.match(built.reviewMarkdown, /retained evidence, not a verdict/);
  assert.equal(renderCrossSkillUntypedPageReviewQueueMarkdown(built.records), built.reviewMarkdown);
  assert.equal(serializeCrossSkillUntypedPageReviewDecisionTemplates(built.decisionTemplates), built.decisionTemplateNdjson);
  for (const field of queueContract.required) assert.ok(Object.hasOwn(built.records[0], field), `Missing queue field ${field}`);
  for (const field of templateContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing template field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('identical inputs produce deterministic queue records and artifacts', () => {
  const first = build();
  const second = build({ dispositionRecords: structuredClone(dispositionRecords), evidenceRecords: structuredClone(evidenceRecords), policy: structuredClone(policy), pageTypePolicy: structuredClone(pageTypePolicy) });
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.decisionTemplates), hash(second.decisionTemplates));
  assert.equal(hash(first.reviewMarkdown), hash(second.reviewMarkdown));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('fails atomically on altered evidence, disposition, snapshots, and candidate sets', () => {
  const badEvidence = structuredClone(evidenceRecords);
  badEvidence[0].contentHash = '0'.repeat(64);
  assert.equal(build({ evidenceRecords: badEvidence }).records.length, 0);
  assert.equal(build({ evidenceRecords: badEvidence }).audit.publishable, false);
  const badDisposition = structuredClone(dispositionRecords);
  badDisposition[0].sourceRevision = '1';
  badDisposition[0] = snapshotRecord(Object.fromEntries(Object.entries(badDisposition[0]).filter(([key]) => key !== 'contentHash')));
  assert.equal(build({ dispositionRecords: badDisposition }).audit.publishable, false);
  assert.equal(build({ evidenceSnapshotContentHash: '' }).audit.publishable, false);
  assert.equal(build({ dispositionRecords: dispositionRecords.slice(0, 1) }).audit.publishable, false);
});

test('audit rejects changed queue records, decided templates, rendered artifacts, and account state', () => {
  const built = build();
  const base = {
    dispositionRecords, evidenceRecords, policy, pageTypePolicy, dispositionSnapshotContentHash, evidenceSnapshotContentHash,
    decisionTemplates: built.decisionTemplates, reviewMarkdown: built.reviewMarkdown, decisionTemplateNdjson: built.decisionTemplateNdjson, contentHash: hash
  };
  const changedRecords = structuredClone(built.records);
  changedRecords[0].structuralEvidence.headings[0].rawTitle = 'Changed';
  assert.equal(auditCrossSkillUntypedPageSourceBoundReviewQueueExport(changedRecords, base).publishable, false);
  const decidedTemplates = structuredClone(built.decisionTemplates);
  decidedTemplates[0].decision = policy.allowedDecisions[0];
  assert.equal(auditCrossSkillUntypedPageSourceBoundReviewQueueExport(built.records, { ...base, decisionTemplates: decidedTemplates, decisionTemplateNdjson: serializeCrossSkillUntypedPageReviewDecisionTemplates(decidedTemplates) }).publishable, false);
  assert.equal(auditCrossSkillUntypedPageSourceBoundReviewQueueExport(built.records, { ...base, reviewMarkdown: `${built.reviewMarkdown}changed` }).publishable, false);
  const accountScoped = structuredClone(built.records);
  accountScoped[0].accountState = { currentBaseLevel: 50 };
  const accountAudit = auditCrossSkillUntypedPageSourceBoundReviewQueueExport(accountScoped, { ...base, reviewMarkdown: renderCrossSkillUntypedPageReviewQueueMarkdown(accountScoped) });
  assert.equal(accountAudit.publishable, false);
  assert.ok(accountAudit.blockers.includes('current_account_state_present'));
});

test('CLI rejects a corrupted disposition manifest without writing review artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-untyped-review-export-'));
  try {
    const directory = path.join(root, '2026-09-05T00-00-00-000Z');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'cross-skill-untyped-page-source-evidence-sufficiency-disposition.ndjson'), `${JSON.stringify(dispositionRecords[0])}\n`);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      contract: 'sensum.ingestion-manifest.v1',
      domain: 'cross-skill-untyped-page-source-evidence-sufficiency-disposition',
      records: 1,
      contentHash: 'tampered',
      source: { audit: { dispositionCoverageComplete: true, pageTypeReviewComplete: false, canonicalIdentityComplete: false, repeatabilityAndMechanicsComplete: false, completeActivityUniverse: false, publishable: true, semanticPreservationCoverage: { pageTypeReviewedCount: 0, optimizerEligibleCount: 0 } } }
    }));
    const result = spawnSync(process.execPath, ['platform/transforms/export-cross-skill-untyped-page-source-bound-review-queue.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readdirSync(root).filter(name => name.includes('source-bound-review-queue')).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Cross-skill untyped-page source-bound review queue export checks passed.');
