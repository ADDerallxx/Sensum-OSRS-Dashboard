import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { hash } from '../ingestion/lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence,
  compileActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidencePolicy,
  discoverRecursiveSourceDependencies,
  requiredRecursiveHistoricalSourceRequests,
  transclusionEffectiveWikitext
} from '../ingestion/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-lib.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const oneHopPolicy = read('platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json');
const recordContract = read('platform/contracts/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json');
const auditContract = read('platform/contracts/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-audit-v1.json');
const timestamp = '2026-09-01T00:00:00Z';

function historical(requestedTitle, pageId, revision, content, options = {}) {
  const sourceTimestamp = options.sourceTimestamp || '2026-08-31T00:00:00Z';
  const resolvedTitle = options.resolvedTitle || requestedTitle;
  const explicitMissing = options.explicitMissing === true;
  return {
    requestedTitle,
    normalizedTitle: requestedTitle,
    resolvedTitle,
    namespace: explicitMissing ? (requestedTitle.startsWith('Module:') ? 828 : 10) : (requestedTitle.startsWith('Module:') ? 828 : 10),
    sourcePageId: explicitMissing ? null : pageId,
    sourceRevision: explicitMissing ? null : String(revision),
    sourceTimestamp: explicitMissing ? null : sourceTimestamp,
    asOfTimestamp: timestamp,
    timestampAtOrBeforeBoundary: true,
    sourceUrl: explicitMissing ? null : `https://oldschool.runescape.wiki/w/${encodeURIComponent(resolvedTitle)}`,
    sourceExactRevisionUrl: explicitMissing ? null : `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision}`,
    sourceContentHash: explicitMissing ? null : hash(content),
    sourceContentBytes: explicitMissing ? 0 : Buffer.byteLength(content, 'utf8'),
    exactRevisionSourceText: explicitMissing ? null : content,
    explicitMissing
  };
}

function fixture({ omitMissing = false, explicitMissing = false, maximumGraphDepth = null } = {}) {
  const rootSource = historical('Template:Root', 201, 1001, '<noinclude>{{Ignored}}</noinclude>{{A}}{{#invoke:Mod|main}}');
  const base = {
    contract: oneHopPolicy.recordContract,
    evidencePacketKey: 'candidate:test|one-hop', evidencePacketOrdinal: 1, candidateKey: 'candidate:test', workRouteKey: 'route:test',
    sourceBindings: { routingSnapshotContentHash: hash('routing'), candidateSourceContentHash: hash('candidate'), routingRecordContentHash: hash('route-record'), routingOuterContentHash: hash('route-outer') },
    candidateRevisionRevalidation: { boundSource: { sourceTimestamp: timestamp }, exactMatch: true },
    rootTemplateInvocationEvidence: [{
      invocationOrdinal: 1, retainedInvocation: { template: 'Root', templateKey: 'root', line: 1 }, requestedTemplateTitle: 'Template:Root',
      historicalResolution: { requestedTitle: 'Template:Root', asOfTimestamp: timestamp, chain: [rootSource], redirectCount: 0, terminalSource: rootSource, state: 'complete_historical_terminal_source', completeAssessment: true },
      wrapperBehavior: { hasWrapperBehavior: true, balanced: true }, sourceInvocationInventory: [], pageBackedOneHopDependencyAssessments: [],
      rootTemplateSemanticVerdict: null, blockers: ['recursive_historical_expansion_closure_not_established'], state: 'one_hop_complete'
    }],
    coverage: { recursiveHistoricalExpansionClosureComplete: false }, explicitNonClaims: ['semantic_identity_not_established'],
    humanDecisionRecorded: false, canonicalGameEntityIdentity: null, canonicalActivityIdentity: null, repeatabilityClassification: null,
    membershipOrVariantApplication: false, requirementsVariantsXpTimingAndMechanicsComplete: false, optimizerEligible: false,
    automaticVerificationApplied: false, accountIndependent: true, blockers: ['recursive_historical_expansion_closure_not_established'], state: 'one_hop_complete'
  };
  const intrinsic = { ...base, recordContentHash: hash(base) };
  const oneHopRecord = { ...intrinsic, contentHash: hash(intrinsic) };
  const oneHopRaw = `${JSON.stringify(oneHopRecord)}\n`;
  const createdAt = '2026-09-01T01:00:00Z';
  const oneHopManifest = {
    contract: 'sensum.ingestion-manifest.v1', domain: oneHopPolicy.outputDomain, createdAt, records: 1, contentHash: hash(oneHopRaw),
    source: {
      policy: { id: oneHopPolicy.policy, contentHash: hash(oneHopPolicy) },
      audit: {
        contract: oneHopPolicy.auditContract, publishable: true, evidencePacketCoverageComplete: true,
        recursiveHistoricalExpansionClosureComplete: false, humanReviewComplete: false, completeActivityUniverse: false,
        semanticPreservationCoverage: { humanDecisionRecordedCount: 0, canonicalIdentityCount: 0, repeatabilityClassificationCount: 0, membershipOrVariantApplicationCount: 0, mechanicsCompletionCount: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0 },
        accountStateFindings: []
      }
    }
  };
  const historicalSources = [
    rootSource,
    historical('Template:A', 202, 1002, '{{B}}'),
    historical('Template:B', 203, 1003, '{{A}}'),
    historical('Module:Mod', 204, 1004, "local helper = require('Module:Helper')\nlocal data = mw.loadData('Module:Data')\nlocal dynamic = require(moduleName)\nframe:preprocess(source)\nreturn helper"),
    historical('Module:Helper', 205, 1005, 'return {}'),
    historical('Module:Data', 206, 1006, 'return {}')
  ];
  if (explicitMissing) {
    historicalSources[1] = historical('Template:A', null, null, null, { explicitMissing: true });
  } else if (omitMissing) {
    historicalSources.splice(1, 1);
  }
  const selectedPolicy = maximumGraphDepth === null ? policy : { ...policy, maximumGraphDepth };
  return {
    oneHopRecords: [oneHopRecord], oneHopRaw, oneHopManifest,
    oneHopSnapshot: { directory: 'one-hop', contentHash: oneHopManifest.contentHash, createdAt, explicit: true },
    historicalSources, magicWordAliases: [], policy: selectedPolicy, oneHopPolicy, contentHash: hash
  };
}

test('policy is generic, source-bound, and fail closed', () => {
  assert.equal(compileActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidencePolicy(policy, oneHopPolicy).valid, true);
  const specific = structuredClone(policy);
  specific.titleOverrides = { Root: 'A' };
  assert.equal(compileActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidencePolicy(specific, oneHopPolicy).valid, false);
});

test('transclusion view excludes noinclude, honors onlyinclude, ignores comments, and preserves UTF-16 offsets', () => {
  assert.match(transclusionEffectiveWikitext('<noinclude>{{Ignored}}</noinclude>{{Kept}}').text, /\{\{Kept\}\}/);
  assert.doesNotMatch(transclusionEffectiveWikitext('<noinclude>{{Ignored}}</noinclude>{{Kept}}').text, /Ignored/);
  const only = transclusionEffectiveWikitext('🐉<!-- <onlyinclude>{{Wrong}}</onlyinclude> --><onlyinclude>{{Only}}</onlyinclude>{{Outside}}');
  assert.match(only.text, /\{\{Only\}\}/);
  assert.doesNotMatch(only.text, /Wrong|Outside/);
});

test('recursive graph follows static template and Lua dependencies, records cycles, and retains runtime boundaries', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(fixture());
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.staticRecursiveHistoricalTransclusionClosureComplete, true);
  assert.equal(built.audit.completeRenderedOutputAttribution, false);
  assert.equal(built.records.length, 1);
  const record = built.records[0];
  assert.equal(record.coverage.historicalNodeCount, 6);
  assert.equal(record.coverage.cycleCount, 1);
  assert.equal(record.coverage.luaModuleNodeCount, 3);
  assert.ok(record.coverage.dynamicOrEngineBoundaryCount >= 2);
  assert.equal(record.historicalDependencyGraph.edges.some(edge => edge.dependency.pageTitle === 'Template:Ignored'), false);
  assert.equal(record.optimizerEligible, false);
  for (const field of recordContract.required) assert.ok(Object.hasOwn(record, field), `Missing record field ${field}`);
  for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);
});

test('Lua comments, strings, and require-prefixed words do not create dependencies while dynamic names remain explicit boundaries', () => {
  const source = historical('Module:Commented', 301, 2001, "-- require('Module:Wrong')\n--[[ mw.loadData('Module:Also wrong') ]]\nlocal requirements = 'text'\nlocal diagnostic = \"require', fake = bucket('\"\nlocal ok = require('Module:Right')\nlocal dynamic = require(target)");
  const dependencies = discoverRecursiveSourceDependencies(source).dependencies;
  assert.deepEqual(dependencies.filter(row => row.pageTitle).map(row => row.pageTitle), ['Module:Right']);
  assert.equal(dependencies.filter(row => row.dependencyClass === 'lua_dynamic_require').length, 1);
});

test('missing observations remain discoverable and fail closed', () => {
  const context = fixture({ omitMissing: true });
  assert.deepEqual(requiredRecursiveHistoricalSourceRequests(context.oneHopRecords, context.historicalSources, [], policy), [{ requestedTitle: 'Template:A', asOfTimestamp: timestamp }]);
  const built = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(context);
  assert.equal(built.audit.publishable, false);
  assert.equal(built.audit.graphCoverage.incompleteStaticEdgeKeys.length, 1);
});

test('explicit historical absence is assessed without inventing a target node', () => {
  const built = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(fixture({ explicitMissing: true }));
  assert.equal(built.audit.publishable, true);
  assert.equal(built.audit.graphCoverage.explicitHistoricalAbsenceEdgeCount, 1);
  assert.ok(built.records[0].blockers.includes('one_or_more_static_dependencies_historically_absent'));
});

test('depth limits fail closed and complete builds are deterministic', () => {
  const first = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(fixture());
  const second = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(fixture());
  assert.equal(hash(first.records), hash(second.records));
  assert.equal(hash(first.artifacts), hash(second.artifacts));
  const limited = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence(fixture({ maximumGraphDepth: 1 }));
  assert.equal(limited.audit.publishable, false);
  assert.ok(limited.audit.graphCoverage.depthLimitSourceKeys.length > 0);
});

test('CLI refuses implicit snapshots before network access or output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sensum-recursive-template-evidence-'));
  try {
    const command = spawnSync(process.execPath, ['platform/ingestion/ingest-wiki-activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence.mjs', `--root=${root}`], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(command.status, 2, command.stderr || command.stdout);
    assert.equal(JSON.parse(command.stdout).outputWritten, false);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log('Activity candidate missing supported-infobox recursive historical transclusion closure evidence checks passed.');
