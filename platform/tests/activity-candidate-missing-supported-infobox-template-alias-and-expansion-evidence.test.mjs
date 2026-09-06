import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import { buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting } from '../transforms/activity-candidate-missing-supported-infobox-evidence-work-routing-lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence,
  buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence,
  compileActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidencePolicy,
  requiredHistoricalSourceRequests
} from '../ingestion/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-lib.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const routingPolicy = read('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const sourcePolicy = read('platform/policies/activity-candidate-semantic-evidence-v1.json');
const packetPolicy = read('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json');
const recordContract = read('platform/contracts/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const auditContract = read('platform/contracts/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-audit-v1.json');
const timestamp = '2026-09-01T00:00:00Z';
const candidateText = '{{Wrapper}}\nCandidate lead.';

function manifest(domain, createdAt, records, source) {
  const raw = records.map(JSON.stringify).join('\n') + '\n';
  return { raw, manifest: { contract: 'sensum.ingestion-manifest.v1', domain, createdAt, records: records.length, contentHash: hash(raw), source } };
}

function sourceRecord() {
  const base = {
    contract: sourcePolicy.recordContract,
    candidateKey: 'osrs-wiki-pageid:101', sourcePageId: 101, resolvedTitle: 'Candidate', sourceRevision: '901', sourceTimestamp: timestamp,
    sourceUrl: 'https://oldschool.runescape.wiki/w/Candidate', sourceContentHash: hash(candidateText), sourceContentBytes: Buffer.byteLength(candidateText),
    sourceCandidateContentHash: hash('candidate'),
    sourceSignatureContexts: [{ targetKey: 'wiki-title:candidate', identitySourceRevision: '901', requestedTitle: 'Candidate', redirected: false, requestedFragment: null, referencedBy: { skillKeys: ['agility'], statementKeys: ['agility:1'] } }],
    pageTypeEvidence: { entityTypes: ['activity_page'], rootTemplates: [{ template: 'Wrapper', templateKey: 'wrapper', line: 1 }], directCategories: [] },
    infoboxEvidence: null,
    leadParagraphEvidence: [{ ordinal: 1, rawText: 'Candidate lead.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [], lexicalReviewCandidates: [], skillKeys: ['agility'], statementKeys: ['agility:1'],
    revisionAlignment: { allSignatureContextsEquivalent: true, candidateAndSignaturePageIdMatch: true, candidateAndSignatureRevisionMatch: true, fetchedAndSignatureContentHashMatch: true, fetchedAndSignaturePageIdMatch: true, fetchedAndSignatureRevisionMatch: true },
    semanticIdentityReview: { disposition: null, evidenceKeys: [], state: 'unreviewed' }, repeatabilityReview: { classification: null, evidenceKeys: [], state: 'unreviewed' },
    canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, optimizerEligible: false, accountIndependent: true,
    blockers: ['supported_activity_infobox_not_present', 'source_evidence_requires_semantic_review'], state: 'review_ready'
  };
  return { ...base, contentHash: hash(base) };
}

function packetRecord(source) {
  const base = {
    contract: packetPolicy.packetContract, reviewPacketKey: `${source.candidateKey}|priority-activity-human-review-packet`, packetOrdinal: 1, batchOrdinal: 1, batchItemOrdinal: 1,
    candidateKey: source.candidateKey,
    sourcePageIdentity: { sourcePageId: source.sourcePageId, resolvedTitle: source.resolvedTitle, sourceRevision: source.sourceRevision, sourceTimestamp: source.sourceTimestamp, sourceUrl: source.sourceUrl, sourceContentHash: source.sourceContentHash, sourceContentBytes: source.sourceContentBytes },
    sourceExactRevisionUrl: 'https://oldschool.runescape.wiki/w/Special:Redirect/revision/901',
    pipelineBindings: { candidateContentHash: source.sourceCandidateContentHash, sourceEvidenceContentHash: source.contentHash, subjectDispositionContentHash: hash('subject'), workRoutingContentHash: hash('route') },
    discoveryEvidence: { contentHash: source.sourceCandidateContentHash }, sourceEvidence: structuredClone(source), subjectAssessment: { contentHash: hash('subject') }, workRoute: { contentHash: hash('route') },
    reviewPriority: { band: 2, reason: 'test' }, reviewObligations: { expansionAxes: ['members'], requiredEvidenceDomains: ['identity', 'mechanics'] }, decisionTemplate: { reviewer: null, reviewedAt: null },
    explicitNonClaims: ['optimizer_eligibility_is_not_established'], decisionRecorded: false, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatabilityClassification: null, atomicityClassification: null, memberExpansionReviewed: false, requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false, automaticVerificationApplied: false, accountIndependent: true, blockers: ['explicit_human_activity_candidate_review_pending'], state: 'priority_activity_review_packet_materialized_human_decision_pending'
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function historical(requestedTitle, pageid, revision, content, asOfTimestamp = timestamp, title = requestedTitle) {
  return { requestedTitle, normalizedTitle: requestedTitle, asOfTimestamp, page: { pageid, ns: requestedTitle.startsWith('Module:') ? 828 : 10, title, revisions: [{ revid: revision, timestamp: '2026-08-31T00:00:00Z', slots: { main: { content } } }] } };
}

function fixture({ omitChild = false, missingChild = false } = {}) {
  const source = sourceRecord();
  const packet = packetRecord(source);
  const sourceSnapshotBase = manifest(routingPolicy.inputSourceEvidenceDomain, '2026-09-01T01:00:00Z', [source], {
    policy: sourcePolicy.policy,
    audit: { contract: sourcePolicy.auditContract, publishable: true, sourceEvidenceCoverageComplete: true, semanticReviewComplete: false, completeActivityUniverse: false, sourceAlignment: { allPageIdsRevisionsAndContentHashesAligned: true }, structuralEvidenceCoverage: { missingSupportedInfoboxCandidateKeys: [source.candidateKey] }, semanticPromotionCoverage: { unsupportedPromotionCandidateKeys: [] } }
  });
  const packetSnapshotBase = manifest(routingPolicy.inputPacketDomain, '2026-09-01T02:00:00Z', [packet], {
    policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
    audit: { contract: packetPolicy.auditContract, publishable: true, packetConsolidationComplete: true, humanReviewComplete: false, completeActivityUniverse: false, packetCoverage: { packetCount: 1, completePacketCount: 1 }, semanticPreservationCoverage: { optimizerEligibleCount: 0, automaticVerificationCount: 0 } }
  });
  const upstream = {
    sourceEvidenceRecords: [source], sourceEvidenceRaw: sourceSnapshotBase.raw, sourceEvidenceManifest: sourceSnapshotBase.manifest,
    sourceEvidenceSnapshot: { directory: 'source', contentHash: sourceSnapshotBase.manifest.contentHash, createdAt: sourceSnapshotBase.manifest.createdAt, explicit: true },
    packetRecords: [packet], packetRaw: packetSnapshotBase.raw, packetManifest: packetSnapshotBase.manifest,
    packetSnapshot: { directory: 'packet', contentHash: packetSnapshotBase.manifest.contentHash, createdAt: packetSnapshotBase.manifest.createdAt, explicit: true }
  };
  const routesBuilt = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting({ ...upstream, policy: routingPolicy, sourceEvidencePolicy: sourcePolicy, packetPolicy, contentHash: hash });
  const routingRecords = routesBuilt.records.map(record => ({ ...record, contentHash: hash(record) }));
  const routingBase = manifest(policy.inputRoutingDomain, '2026-09-01T03:00:00Z', routingRecords, { policy: { id: routingPolicy.policy, contentHash: hash(routingPolicy) }, audit: routesBuilt.audit });
  const historicalSources = [
    historical('Template:Wrapper', 201, 1001, '#REDIRECT [[Template:Target]]'),
    historical('Template:Target', 202, 1002, '<includeonly>{{#invoke:Example|main}}{{Child}}</includeonly><noinclude>{{/doc}}</noinclude>'),
    historical('Module:Example', 203, 1003, 'return {}'),
    historical('Template:Target/doc', 205, 1005, 'documentation')
  ];
  if (!omitChild) historicalSources.push(missingChild
    ? { requestedTitle: 'Template:Child', normalizedTitle: 'Template:Child', asOfTimestamp: timestamp, page: { ns: 10, title: 'Template:Child', missing: true } }
    : historical('Template:Child', 204, 1004, 'child'));
  return {
    ...upstream,
    routingRecords, routingRaw: routingBase.raw, routingManifest: routingBase.manifest,
    routingSnapshot: { directory: 'routing', contentHash: routingBase.manifest.contentHash, createdAt: routingBase.manifest.createdAt, explicit: true },
    candidatePages: [{ pageid: 101, ns: 0, title: 'Candidate', revisions: [{ revid: 901, timestamp, slots: { main: { content: candidateText } } }] }],
    historicalSources, magicWordAliases: [], policy, routingPolicy, sourceEvidencePolicy: sourcePolicy, packetPolicy, contentHash: hash
  };
}

test('policy is generic, source-bound, and fail closed', () => {
  assert.equal(compileActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidencePolicy(policy, routingPolicy).valid, true);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Wrapper: 'Target' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidencePolicy(specific, routingPolicy).valid, false);
});

test('captures as-of redirect, wrapper, module, and template dependency evidence without semantic promotion', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.evidencePacketCoverageComplete, true);
  assert.equal(built.records.length, 1);
  const packet = built.records[0];
  const root = packet.rootTemplateInvocationEvidence[0];
  assert.equal(root.historicalResolution.redirectCount, 1);
  assert.equal(root.historicalResolution.terminalSource.resolvedTitle, 'Template:Target');
  assert.equal(root.wrapperBehavior.hasWrapperBehavior, true);
  assert.equal(root.wrapperBehavior.balanced, true);
  assert.deepEqual(root.sourceInvocationInventory.map(row => row.dependencyClass).sort(), ['module_transclusion', 'template_transclusion', 'template_transclusion']);
  assert.equal(root.sourceInvocationInventory.find(row => row.sourceName === '/doc').pageTitle, 'Template:Target/doc');
  assert.equal(root.pageBackedOneHopDependencyAssessments.length, 3);
  assert.equal(root.pageBackedOneHopDependencyAssessments.every(row => row.historicalResolution.completeAssessment), true);
  assert.equal(packet.canonicalActivityIdentity, null);
  assert.equal(packet.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(packet, field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('explicit historical dependency absence is preserved as evidence and a blocker', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(fixture({ missingChild: true }));
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.wrapperAndDependencyCoverage.explicitHistoricalDependencyAbsenceCount, 1);
  assert.ok(built.records[0].blockers.includes('one_or_more_page_backed_dependencies_historically_absent'));
});

test('missing source observation fails closed and remains discoverable', () => {
  const ctx = fixture({ omitChild: true });
  assert.deepEqual(requiredHistoricalSourceRequests(ctx.routingRecords, ctx.historicalSources, []), [{ requestedTitle: 'Template:Child', asOfTimestamp: timestamp }]);
  const built = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(ctx);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.wrapperAndDependencyCoverage.incompletePageBackedOneHopDependencyAssessmentCount, undefined);
  assert.equal(built.audit.wrapperAndDependencyCoverage.incompletePageBackedOneHopDependencyKeys.length, 1);
});

test('deterministic evidence packets reject route drift and later semantic promotion', () => {
  const ctx = fixture();
  const first = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(ctx);
  const second = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(ctx);
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.artifacts), hash(second.artifacts));
  const driftedRecords = structuredClone(ctx.routingRecords);
  driftedRecords[0].retainedStructuralEvidence.rootTemplates[0].line = 99;
  const drifted = { ...ctx, routingRecords: driftedRecords };
  assert.equal(buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(drifted).audit.publishable, false);
  const promoted = structuredClone(first.records);
  promoted[0].optimizerEligible = true;
  promoted[0].username = 'forbidden';
  const audit = auditActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence(promoted, { ...ctx, compiled: first.audit.policyCoverage, routingAssessment: first.audit.inputCoverage.routingSnapshot, exactRebuild: true, artifacts: first.artifacts, contentHash: hash });
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotionCandidateKeys.length, 1);
  assert.deepEqual(audit.accountStateFindings, ['[0].username']);
});

test('CLI refuses implicit snapshots before network access or output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-template-evidence-'));
  try {
    const command = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate missing supported-infobox template alias and expansion evidence checks passed.');
