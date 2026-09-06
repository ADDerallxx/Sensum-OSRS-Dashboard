import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting,
  buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting,
  compileActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingPolicy
} from '../transforms/activity-candidate-missing-supported-infobox-evidence-work-routing-lib.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const sourcePolicy = read('platform/policies/activity-candidate-semantic-evidence-v1.json');
const packetPolicy = read('platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json');
const recordContract = read('platform/contracts/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const auditContract = read('platform/contracts/activity-candidate-missing-supported-infobox-evidence-work-routing-audit-v1.json');
const times = { source: '2026-09-04T13:04:53.902Z', packet: '2026-09-06T04:06:25.989Z' };

function sourceRecord(ordinal, infoboxMode = 'missing') {
  const base = {
    contract: sourcePolicy.recordContract,
    candidateKey: `osrs-wiki-pageid:${100 + ordinal}`,
    sourcePageId: 100 + ordinal,
    resolvedTitle: `Candidate ${ordinal}`,
    sourceRevision: String(900 + ordinal),
    sourceTimestamp: '2026-09-03T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/Candidate_${ordinal}`,
    sourceContentHash: hash(`source-${ordinal}`),
    sourceContentBytes: 100 + ordinal,
    sourceCandidateContentHash: hash(`candidate-${ordinal}`),
    sourceSignatureContexts: [{ targetKey: `wiki-title:candidate-${ordinal}`, identitySourceRevision: String(900 + ordinal), requestedTitle: `Candidate ${ordinal}`, redirected: false, requestedFragment: null, referencedBy: { skillKeys: ['agility'], statementKeys: [`agility:${ordinal}`] } }],
    pageTypeEvidence: {
      entityTypes: ['activity_page'],
      rootTemplates: infoboxMode === 'supported'
        ? [{ template: 'Infobox Activity', templateKey: 'infobox activity', line: 1 }]
        : infoboxMode === 'unsupported'
          ? [{ template: 'Infobox Something Else', templateKey: 'infobox something else', line: 1 }]
          : [{ template: 'External', templateKey: 'external', line: 1 }],
      directCategories: [{ category: 'Activities', categoryKey: 'activities', line: 20 }]
    },
    infoboxEvidence: infoboxMode === 'supported' ? { template: 'Infobox Activity', balanced: true, sourceLocator: { lineStart: 1, lineEnd: 5 }, parameters: [] } : null,
    leadParagraphEvidence: [{ ordinal: 1, rawText: `Candidate ${ordinal} lead.`, sourceLocator: { lineStart: 2, lineEnd: 2 } }],
    headingEvidence: [{ ordinal: 1, level: 2, line: 10, rawTitle: 'Methods', normalizedTitle: 'Methods' }],
    lexicalReviewCandidates: [{ family: 'subject_scope', interpretationState: 'review_candidate_only', line: 2, rawText: `Candidate ${ordinal} lead.`, signalKey: 'activity_subject_language' }],
    skillKeys: ['agility'],
    statementKeys: [`agility:${ordinal}`],
    revisionAlignment: { allSignatureContextsEquivalent: true, candidateAndSignaturePageIdMatch: true, candidateAndSignatureRevisionMatch: true, fetchedAndSignatureContentHashMatch: true, fetchedAndSignaturePageIdMatch: true, fetchedAndSignatureRevisionMatch: true },
    semanticIdentityReview: { disposition: null, evidenceKeys: [], state: 'unreviewed' },
    repeatabilityReview: { classification: null, evidenceKeys: [], state: 'unreviewed' },
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    optimizerEligible: false,
    accountIndependent: true,
    blockers: infoboxMode === 'supported' ? ['source_evidence_requires_semantic_review'] : ['supported_activity_infobox_not_present', 'source_evidence_requires_semantic_review'],
    state: 'review_ready'
  };
  return { ...base, contentHash: hash(base) };
}

function packetRecord(source, ordinal) {
  const base = {
    contract: packetPolicy.packetContract,
    reviewPacketKey: `${source.candidateKey}|priority-activity-human-review-packet`,
    packetOrdinal: ordinal,
    batchOrdinal: 1,
    batchItemOrdinal: ordinal,
    candidateKey: source.candidateKey,
    sourcePageIdentity: { sourcePageId: source.sourcePageId, resolvedTitle: source.resolvedTitle, sourceRevision: source.sourceRevision, sourceTimestamp: source.sourceTimestamp, sourceUrl: source.sourceUrl, sourceContentHash: source.sourceContentHash, sourceContentBytes: source.sourceContentBytes },
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${source.sourceRevision}`,
    pipelineBindings: { candidateContentHash: source.sourceCandidateContentHash, sourceEvidenceContentHash: source.contentHash, subjectDispositionContentHash: hash(`subject-${ordinal}`), workRoutingContentHash: hash(`route-${ordinal}`) },
    discoveryEvidence: { contentHash: source.sourceCandidateContentHash },
    sourceEvidence: structuredClone(source),
    subjectAssessment: { contentHash: hash(`subject-${ordinal}`) },
    workRoute: { contentHash: hash(`route-${ordinal}`) },
    reviewPriority: { band: 2, reason: 'priority_activity_candidate_evidence_review' },
    reviewObligations: { expansionAxes: ['members'], requiredEvidenceDomains: ['identity', 'repeatability', 'mechanics'] },
    decisionTemplate: { reviewer: null, reviewedAt: null },
    explicitNonClaims: ['optimizer_eligibility_is_not_established'],
    decisionRecorded: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    atomicityClassification: null,
    memberExpansionReviewed: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: ['explicit_human_activity_candidate_review_pending'],
    state: 'priority_activity_review_packet_materialized_human_decision_pending'
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function manifest(domain, createdAt, records, source) {
  const raw = records.map(JSON.stringify).join('\n') + '\n';
  return { raw, manifest: { contract: 'sensum.ingestion-manifest.v1', domain, createdAt, records: records.length, contentHash: hash(raw), source } };
}

function context(modes = ['missing', 'unsupported', 'supported']) {
  const sourceRecords = modes.map((mode, index) => sourceRecord(index + 1, mode));
  const missingKeys = sourceRecords.filter(record => record.infoboxEvidence == null).map(record => record.candidateKey);
  const source = manifest(policy.inputSourceEvidenceDomain, times.source, sourceRecords, {
    policy: sourcePolicy.policy,
    audit: {
      contract: sourcePolicy.auditContract,
      publishable: true,
      sourceEvidenceCoverageComplete: true,
      semanticReviewComplete: false,
      completeActivityUniverse: false,
      sourceAlignment: { allPageIdsRevisionsAndContentHashesAligned: true },
      structuralEvidenceCoverage: { missingSupportedInfoboxCandidateKeys: missingKeys },
      semanticPromotionCoverage: { unsupportedPromotionCandidateKeys: [] }
    }
  });
  const packetRecords = sourceRecords.map(packetRecord);
  const packets = manifest(policy.inputPacketDomain, times.packet, packetRecords, {
    policy: { id: packetPolicy.policy, contentHash: hash(packetPolicy) },
    audit: {
      contract: packetPolicy.auditContract,
      publishable: true,
      packetConsolidationComplete: true,
      humanReviewComplete: false,
      completeActivityUniverse: false,
      packetCoverage: { packetCount: packetRecords.length, completePacketCount: packetRecords.length },
      semanticPreservationCoverage: { optimizerEligibleCount: 0, automaticVerificationCount: 0 }
    }
  });
  return {
    sourceEvidenceRecords: sourceRecords,
    sourceEvidenceRaw: source.raw,
    sourceEvidenceManifest: source.manifest,
    sourceEvidenceSnapshot: { directory: 'source', contentHash: source.manifest.contentHash, createdAt: times.source, explicit: true },
    packetRecords,
    packetRaw: packets.raw,
    packetManifest: packets.manifest,
    packetSnapshot: { directory: 'packets', contentHash: packets.manifest.contentHash, createdAt: times.packet, explicit: true },
    policy,
    sourceEvidencePolicy: sourcePolicy,
    packetPolicy,
    contentHash: hash
  };
}

test('policy is generic, source-bound, and fail closed', () => {
  const compiled = compileActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingPolicy(policy, sourcePolicy, packetPolicy, hash);
  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.invalidRules, []);
  assert.deepEqual(compiled.forbiddenPolicyPaths, []);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Example: 'approved' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxEvidenceWorkRoutingPolicy(specific, sourcePolicy, packetPolicy, hash).valid, false);
});

test('selects only missing supported infobox candidates and keeps every structural cause distinct', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(context());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.evidenceWorkRoutingComplete, true);
  assert.equal(built.records.length, 2);
  assert.equal(built.audit.structuralConditionCoverage.directSupportedInfoboxAbsentCount, 2);
  assert.equal(built.audit.structuralConditionCoverage.unsupportedInfoboxLikeInvocationObservedCount, 1);
  assert.equal(built.audit.structuralConditionCoverage.aliasEquivalenceUnresolvedCount, 2);
  assert.equal(built.audit.structuralConditionCoverage.transclusionExpansionUnresolvedCount, 2);
  assert.equal(built.audit.structuralConditionCoverage.compositeContainerUnresolvedCount, 2);
  assert.equal(built.records.some(record => record.candidateKey === 'osrs-wiki-pageid:103'), false);
  assert.match(built.artifacts.markdown, /not activity classifications or optimizer candidates/);
  for (const record of built.records) for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('identical selected snapshots produce deterministic work routes and artifacts', () => {
  const first = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(context());
  const second = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(context());
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.artifacts), hash(second.artifacts));
  assert.equal(hash(first.audit), hash(second.audit));
});

test('rejects packet/source drift, policy drift, unsupported promotion, and account state', () => {
  const ctx = context();
  const driftedPackets = structuredClone(ctx.packetRecords);
  driftedPackets[0].sourceEvidence.leadParagraphEvidence[0].rawText = 'changed';
  assert.equal(buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting({ ...ctx, packetRecords: driftedPackets }).audit.publishable, false);
  const implicit = { ...ctx, sourceEvidenceSnapshot: { ...ctx.sourceEvidenceSnapshot, explicit: false } };
  assert.equal(buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(implicit).audit.publishable, false);
  const built = buildActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(ctx);
  const changed = structuredClone(built.records);
  changed[0].canonicalActivityIdentity = { forbidden: true };
  changed[0].optimizerEligible = true;
  changed[0].username = 'forbidden';
  const audit = auditActivityCandidateMissingSupportedInfoboxEvidenceWorkRouting(changed, ctx, built.artifacts);
  assert.equal(audit.publishable, false);
  assert.equal(audit.semanticPreservationCoverage.unsupportedPromotions.length, 1);
  assert.deepEqual(audit.accountStateFindings, ['[0].username']);
});

test('CLI refuses implicit snapshots before reading or writing output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-missing-infobox-route-'));
  try {
    const command = spawnSync(process.execPath, ['platform/transforms/build-activity-candidate-missing-supported-infobox-evidence-work-routing.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate missing supported infobox evidence-work routing checks passed.');
