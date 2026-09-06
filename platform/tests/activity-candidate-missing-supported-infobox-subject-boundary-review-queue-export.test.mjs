import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport,
  buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport,
  compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy,
  renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown,
  serializeActivityCandidateMissingSupportedInfoboxSubjectBoundaryDecisionTemplates
} from '../transforms/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-lib.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('platform/policies/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-v1.json');
const routingPolicy = read('platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json');
const oneHopPolicy = read('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const recursivePolicy = read('platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const queueContract = read('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-entry-v1.json');
const decisionContract = read('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-decision-template-v1.json');
const auditContract = read('platform/contracts/activity-candidate-missing-supported-infobox-subject-boundary-review-queue-export-audit-v1.json');
const timestamp = '2026-09-01T00:00:00Z';

function seal(base) {
  const intrinsic = { ...base, recordContentHash: hash(base) };
  return { ...intrinsic, contentHash: hash(intrinsic) };
}

function snapshot(records, sourcePolicy, audit, createdAt) {
  const raw = `${records.map(JSON.stringify).join('\n')}\n`;
  const manifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: sourcePolicy.outputDomain, createdAt,
    records: records.length, contentHash: hash(raw), source: { policy: { id: sourcePolicy.policy, contentHash: hash(sourcePolicy) }, audit }
  };
  return { raw, manifest, snapshot: { directory: sourcePolicy.outputDomain, contentHash: manifest.contentHash, createdAt, explicit: true } };
}

function semanticBase() {
  return {
    humanDecisionRecorded: false, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null,
    repeatabilityClassification: null, membershipOrVariantApplication: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true
  };
}

function historical(title, pageId, revision) {
  return {
    requestedTitle: title, normalizedTitle: title, resolvedTitle: title, namespace: title.startsWith('Module:') ? 828 : 10,
    sourcePageId: pageId, sourceRevision: String(revision), sourceTimestamp: '2026-08-31T00:00:00Z', asOfTimestamp: timestamp,
    timestampAtOrBeforeBoundary: true, sourceUrl: `https://oldschool.runescape.wiki/w/${encodeURIComponent(title)}`,
    sourceExactRevisionUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision}`,
    sourceContentHash: hash(title), sourceContentBytes: title.length, explicitMissing: false, redirectTarget: null
  };
}

function fixture() {
  const routingBase = {
    contract: routingPolicy.recordContract, workRouteKey: 'candidate:1|route', workRouteOrdinal: 1, candidateKey: 'candidate:1', reviewPacketKey: 'packet:1',
    sourcePageIdentity: { sourcePageId: 1, resolvedTitle: 'Example activities', sourceRevision: '101', sourceTimestamp: timestamp, sourceUrl: 'https://oldschool.runescape.wiki/w/Example_activities', sourceContentHash: hash('candidate-source'), sourceContentBytes: 16 },
    sourceBindings: {}, sourceSignatureContexts: [{ requestedTitle: 'example', referencedBy: { skillKeys: ['agility'] } }],
    retainedStructuralEvidence: {
      pageEntityTypes: ['activity_page'], supportedInfoboxEvidence: null,
      rootTemplates: [{ template: 'Root', templateKey: 'root', line: 1 }], directCategories: [{ category: 'Activities', categoryKey: 'activities', line: 4 }],
      leadParagraphs: [{ ordinal: 1, rawText: 'Example activities are repeatable tasks.', sourceLocator: { lineStart: 2, lineEnd: 2 } }],
      headings: [{ ordinal: 1, level: 2, rawTitle: 'Tasks', normalizedTitle: 'Tasks', line: 6 }], lexicalReviewCandidates: []
    },
    structuralConditionAssessment: { compositeOrContainerCondition: { verdict: null, state: 'unresolved' } },
    packetReviewObligations: { atomicityAndMembership: 'review' }, requiredEvidenceChannels: ['source_page_subject_boundary_human_review'],
    workRoute: { routeKey: 'missing_supported_infobox_structural_evidence_reconciliation', completionRequires: ['explicit_composite_or_container_subject_boundary_decision'] },
    explicitNonClaims: [], blockers: [], state: 'blocked_missing_supported_infobox_structural_cause_and_subject_boundary_review_pending', ...semanticBase()
  };
  const routingRecord = seal(routingBase);
  const routing = snapshot([routingRecord], routingPolicy, {
    contract: routingPolicy.auditContract, evidenceWorkRoutingComplete: true, humanReviewComplete: false, completeActivityUniverse: false, publishable: true
  }, '2026-09-01T01:00:00Z');

  const rootSource = historical('Template:Root', 10, 201);
  const oneHopBase = {
    contract: oneHopPolicy.recordContract, evidencePacketKey: 'candidate:1|one-hop', evidencePacketOrdinal: 1, candidateKey: 'candidate:1', workRouteKey: routingRecord.workRouteKey,
    sourceBindings: { routingSnapshotContentHash: routing.manifest.contentHash, routingRecordContentHash: routingRecord.recordContentHash, routingOuterContentHash: routingRecord.contentHash, candidateSourceContentHash: routingRecord.sourcePageIdentity.sourceContentHash },
    candidateRevisionRevalidation: { boundSource: { ...routingRecord.sourcePageIdentity }, exactMatch: true },
    rootTemplateInvocationEvidence: [{
      invocationOrdinal: 1, retainedInvocation: { template: 'Root', templateKey: 'root', line: 1 }, requestedTemplateTitle: 'Template:Root',
      historicalResolution: { requestedTitle: 'Template:Root', asOfTimestamp: timestamp, state: 'complete_historical_terminal_source', completeAssessment: true, redirectCount: 0, chain: [rootSource], terminalSource: rootSource },
      wrapperBehavior: { hasWrapperBehavior: true, balanced: true, wrappers: [] },
      sourceInvocationInventory: [{ occurrenceKey: 'root:1', sourceName: 'Child', pageTitle: 'Template:Child', dependencyClass: 'template_transclusion' }],
      pageBackedOneHopDependencyAssessments: [], rootTemplateSemanticVerdict: null, blockers: [], state: 'one_hop_complete'
    }],
    coverage: { recursiveHistoricalExpansionClosureComplete: false }, explicitNonClaims: [], blockers: [], state: 'one_hop_complete', ...semanticBase()
  };
  const oneHopRecord = seal(oneHopBase);
  const oneHop = snapshot([oneHopRecord], oneHopPolicy, {
    contract: oneHopPolicy.auditContract, evidencePacketCoverageComplete: true, recursiveHistoricalExpansionClosureComplete: false,
    humanReviewComplete: false, completeActivityUniverse: false, publishable: true
  }, '2026-09-01T02:00:00Z');

  const childSource = historical('Template:Child', 11, 202);
  const rootNodeKey = 'wiki-pageid:10|revision:201';
  const childNodeKey = 'wiki-pageid:11|revision:202';
  const recursiveBase = {
    contract: recursivePolicy.recordContract, closurePacketKey: 'candidate:1|recursive', closurePacketOrdinal: 1, candidateKey: 'candidate:1',
    sourceBindings: {
      routingSnapshotContentHash: routing.manifest.contentHash, oneHopSnapshotContentHash: oneHop.manifest.contentHash,
      oneHopRecordContentHash: oneHopRecord.recordContentHash, oneHopOuterContentHash: oneHopRecord.contentHash,
      candidateSourceContentHash: routingRecord.sourcePageIdentity.sourceContentHash
    },
    entryPoints: [{ invocationOrdinal: 1, retainedInvocation: { template: 'Root', line: 1 }, requestedTemplateTitle: 'Template:Root', historicalResolution: { requestedTitle: 'Template:Root', asOfTimestamp: timestamp, state: 'complete_historical_terminal_source', completeAssessment: true, redirectCount: 0, chain: [rootSource] } }],
    historicalDependencyGraph: {
      nodes: [
        { nodeKey: rootNodeKey, minimumDepth: 0, sourceIdentity: rootSource, effectiveSource: { kind: 'wikitext_transclusion_view', wrapperState: 'complete_standard_transclusion_view', wrapperStructure: { hasNoinclude: true, balanced: true } }, dependencyObservations: [{ occurrenceKey: 'root:child', sourceName: 'Child', pageTitle: 'Template:Child', dependencyClass: 'template_transclusion', argumentCount: 0, rawSource: '{{Child}}', sourceLocator: { line: 1 } }, { occurrenceKey: 'root:dynamic', sourceName: '{{{name}}}', pageTitle: null, dependencyClass: 'dynamic_name', argumentCount: 0, rawSource: '{{{{{name}}}}}', sourceLocator: { line: 2 } }], staticPageBackedDependencyCount: 1, dynamicOrEngineBoundaryCount: 1 },
        { nodeKey: childNodeKey, minimumDepth: 1, sourceIdentity: childSource, effectiveSource: { kind: 'wikitext_transclusion_view', wrapperState: 'complete_standard_transclusion_view', wrapperStructure: { hasNoinclude: false, balanced: true } }, dependencyObservations: [{ occurrenceKey: 'child:root', sourceName: 'Root', pageTitle: 'Template:Root', dependencyClass: 'template_transclusion', argumentCount: 0, rawSource: '{{Root}}', sourceLocator: { line: 1 } }], staticPageBackedDependencyCount: 1, dynamicOrEngineBoundaryCount: 0 }
      ],
      edges: [
        { edgeKey: 'edge:1', fromNodeKey: rootNodeKey, targetNodeKey: childNodeKey, sourceDepth: 0, cycleEdge: true, dependency: { occurrenceKey: 'root:child', sourceName: 'Child', pageTitle: 'Template:Child', dependencyClass: 'template_transclusion' }, historicalResolution: { requestedTitle: 'Template:Child', asOfTimestamp: timestamp, state: 'complete_historical_terminal_source', completeAssessment: true, redirectCount: 0, chain: [childSource] } },
        { edgeKey: 'edge:2', fromNodeKey: childNodeKey, targetNodeKey: rootNodeKey, sourceDepth: 1, cycleEdge: true, dependency: { occurrenceKey: 'child:root', sourceName: 'Root', pageTitle: 'Template:Root', dependencyClass: 'template_transclusion' }, historicalResolution: { requestedTitle: 'Template:Root', asOfTimestamp: timestamp, state: 'complete_historical_terminal_source', completeAssessment: true, redirectCount: 0, chain: [rootSource] } }
      ],
      cycles: [{ cycleKey: 'cycle:1', nodeKeys: [rootNodeKey, childNodeKey], selfLoop: false }], depthLimitSources: [], unresolvedStaticEdgeKeys: [], unbalancedWrapperNodeKeys: []
    },
    coverage: { entryPointCount: 1, historicalNodeCount: 2, staticPageBackedEdgeCount: 2, completeStaticEdgeAssessmentCount: 2, explicitHistoricalAbsenceEdgeCount: 0, redirectHopCount: 0, maximumObservedDepth: 1, cycleCount: 1, cycleEdgeCount: 2, wikitextNodeCount: 2, luaModuleNodeCount: 0, onlyincludeNodeCount: 0, noincludeNodeCount: 1, dynamicOrEngineBoundaryCount: 1, staticRecursiveHistoricalTransclusionClosureComplete: true, completeRenderedOutputAttribution: false },
    explicitNonClaims: [], blockers: [], state: 'recursive_complete', ...semanticBase()
  };
  const recursiveRecord = seal(recursiveBase);
  const recursive = snapshot([recursiveRecord], recursivePolicy, {
    contract: recursivePolicy.auditContract, staticRecursiveHistoricalTransclusionClosureComplete: true, completeRenderedOutputAttribution: false,
    humanReviewComplete: false, completeActivityUniverse: false, publishable: true
  }, '2026-09-01T03:00:00Z');

  return {
    routingRecords: [routingRecord], routingRaw: routing.raw, routingManifest: routing.manifest, routingSnapshot: routing.snapshot,
    oneHopRecords: [oneHopRecord], oneHopRaw: oneHop.raw, oneHopManifest: oneHop.manifest, oneHopSnapshot: oneHop.snapshot,
    recursiveRecords: [recursiveRecord], recursiveRaw: recursive.raw, recursiveManifest: recursive.manifest, recursiveSnapshot: recursive.snapshot,
    policy, routingPolicy, oneHopPolicy, recursivePolicy, contentHash: hash
  };
}

test('policy is generic, source-bound, and fail closed', () => {
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(policy, routingPolicy, oneHopPolicy, recursivePolicy).valid, true);
  const specific = structuredClone(policy);
  specific.candidateOverrides = { 'candidate:1': 'single' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExportPolicy(specific, routingPolicy, oneHopPolicy, recursivePolicy).valid, false);
});

test('exports one fully bound blank review entry with every evidence class exposed', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.queueExportComplete, true);
  assert.equal(built.audit.subjectBoundaryReviewComplete, false);
  assert.equal(built.records.length, 1);
  assert.equal(built.decisionTemplates.length, 1);
  assert.deepEqual(built.audit.evidenceExposureCoverage.actual, { rootInvocationCount: 1, staticNodeCount: 2, staticEdgeCount: 2, cycleCount: 1, wrapperObservationCount: 2, dynamicOrEngineBoundaryCount: 1 });
  const entry = built.records[0];
  assert.equal(entry.subjectDisposition, null);
  assert.equal(entry.recursiveGraphEvidence.completeRenderedOutputAttribution, false);
  assert.equal(entry.optimizerEligible, false);
  assert.equal(built.decisionTemplates[0].queueSnapshotContentHash, built.queueSnapshotContentHash);
  assert.match(built.artifacts.reviewMarkdown, /Example activities/);
  assert.match(built.artifacts.reviewMarkdown, /dynamic-boundary/);
  assert.equal(renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown(built.records), built.artifacts.reviewMarkdown);
  assert.equal(serializeActivityCandidateMissingSupportedInfoboxSubjectBoundaryDecisionTemplates(built.decisionTemplates), built.artifacts.decisionTemplateNdjson);
  for (const field of queueContract.required) assert.ok(Object.hasOwn(entry, field), `Missing queue field ${field}`);
  for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.decisionTemplates[0], field), `Missing decision field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('output, blank templates, and artifacts are deterministic', () => {
  const first = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(fixture());
  const second = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(fixture());
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.decisionTemplates), hash(second.decisionTemplates));
  assert.equal(hash(first.artifacts), hash(second.artifacts));
});

test('cross-snapshot binding drift and source revision drift fail closed', () => {
  const binding = fixture();
  binding.recursiveRecords[0].sourceBindings.oneHopRecordContentHash = '0'.repeat(64);
  binding.recursiveRecords[0] = seal(Object.fromEntries(Object.entries(binding.recursiveRecords[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
  binding.recursiveRaw = `${JSON.stringify(binding.recursiveRecords[0])}\n`;
  binding.recursiveManifest.contentHash = hash(binding.recursiveRaw);
  binding.recursiveManifest.records = 1;
  binding.recursiveSnapshot.contentHash = binding.recursiveManifest.contentHash;
  assert.equal(buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(binding).audit.publishable, false);

  const revision = fixture();
  revision.oneHopRecords[0].candidateRevisionRevalidation.boundSource.sourceRevision = '999';
  revision.oneHopRecords[0] = seal(Object.fromEntries(Object.entries(revision.oneHopRecords[0]).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))));
  revision.oneHopRaw = `${JSON.stringify(revision.oneHopRecords[0])}\n`;
  revision.oneHopManifest.contentHash = hash(revision.oneHopRaw);
  revision.oneHopSnapshot.contentHash = revision.oneHopManifest.contentHash;
  assert.equal(buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(revision).audit.publishable, false);
});

test('a decision or account state introduced during export is rejected', () => {
  const context = fixture();
  const built = buildActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(context);
  const decided = structuredClone(built.records);
  decided[0].subjectDisposition = policy.allowedSubjectDispositions[0];
  const auditContext = {
    ...context,
    compiled: built.audit.policyCoverage,
    assessments: { routing: built.audit.inputCoverage.routingSnapshot, oneHop: built.audit.inputCoverage.oneHopSnapshot, recursive: built.audit.inputCoverage.recursiveSnapshot },
    expectedRecords: built.records,
    decisionTemplates: built.decisionTemplates,
    queueSnapshotContentHash: built.queueSnapshotContentHash,
    artifacts: { ...built.artifacts, reviewMarkdown: renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown(decided) }
  };
  let audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(decided, auditContext);
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('queue_export_created_or_inherited_semantic_decision_or_promotion'));

  const accountScoped = structuredClone(built.records);
  accountScoped[0].currentBaseLevel = 34;
  audit = auditActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueExport(accountScoped, { ...auditContext, artifacts: { ...built.artifacts, reviewMarkdown: renderActivityCandidateMissingSupportedInfoboxSubjectBoundaryReviewQueueMarkdown(accountScoped) } });
  assert.equal(audit.publishable, false);
  assert.ok(audit.blockers.includes('current_account_state_present'));
});

test('CLI refuses implicit snapshots without writing output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-subject-boundary-queue-'));
  try {
    const command = spawnSync(process.execPath, ['platform/transforms/export-activity-candidate-missing-supported-infobox-subject-boundary-review-queue.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate missing supported-infobox subject-boundary review queue export checks passed.');
