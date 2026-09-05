import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditIndependentScopedActivityRepeatabilityEvidenceDispositions,
  buildIndependentScopedActivityRepeatabilityEvidenceDispositions,
  compileIndependentScopedActivityRepeatabilityEvidenceDispositionPolicy,
  selectIndependentScopedActivityRepeatabilityEvidenceDispositionInputs
} from '../transforms/independent-scoped-activity-repeatability-evidence-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/independent-scoped-activity-repeatability-evidence-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/independent-scoped-activity-repeatability-evidence-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/independent-scoped-activity-repeatability-evidence-disposition-audit-v1.json', 'utf8'));
const domains = policy.requiredEvidenceDomains;

function retainedSource({ key, channel, pageId, title, revision, text, reciprocal = false }) {
  const sourceContentHash = hash(text);
  return {
    sourceKey: key,
    discoveryChannel: channel,
    sourcePageId: pageId,
    sourceTitle: title,
    sourceRevision: revision,
    sourceTimestamp: '2026-01-01T00:00:00Z',
    sourceUrl: `https://oldschool.runescape.wiki/w/${title.replace(/ /g, '_')}`,
    sourceContentHash,
    sourceContentBytes: Buffer.byteLength(text),
    sourceAuthoredPrimaryBacklinks: reciprocal ? [{ occurrence: 1, requestedTitle: 'Activity Alpha', rawLink: '[[Activity Alpha]]', sourceLocator: { lineStart: 1, lineEnd: 1 } }] : [],
    exactRevisionSourceText: text,
    sourceLines: text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line, lineContentHash: hash({ sourceContentHash, line: index + 1, text: line }) })),
    completeSourceRetained: true
  };
}

function signal({ key, domain, source, exact = false }) {
  const exactLine = source.sourceLines[0].text;
  return {
    evidenceKey: key,
    definitionKey: `definition:${key}`,
    evidenceDomain: domain,
    signalKind: 'general_recurrence_wording_candidate_not_post_completion_proof',
    matchedText: 'repeated',
    sourceLocator: { absoluteOffsetStart: 0, absoluteOffsetEnd: 8, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 9 },
    exactLine,
    exactLineContentHash: hash(exactLine),
    exactSubjectEvidence: { exactPrimaryLinkOccurrences: exact ? [{ requestedTitle: 'Activity Alpha', rawLink: '[[Activity Alpha]]' }] : [], exactCanonicalLabelOccurrence: exact, subjectBoundaryComplete: exact },
    exactPredicateEvidence: { matchedText: 'repeated', predicateBoundaryComplete: true },
    exactSubjectPredicateScopeComplete: exact,
    semanticVerdict: null,
    sourcePageId: source.sourcePageId,
    sourceTitle: source.sourceTitle,
    sourceRevision: source.sourceRevision,
    sourceTimestamp: source.sourceTimestamp,
    sourceUrl: source.sourceUrl,
    sourceContentHash: source.sourceContentHash
  };
}

function input({ key = 'alpha', label = 'Activity Alpha' } = {}) {
  const collection = retainedSource({ key: 'collection:200:2000', channel: 'exact_revision_canonical_collection_anchor', pageId: 200, title: 'Collection', revision: '2000', text: 'Minigames can be repeated.\n' });
  const reciprocal = retainedSource({ key: 'reciprocal:300:3000', channel: 'source_authored_reciprocal_main_namespace_link', pageId: 300, title: 'Independent source', revision: '3000', text: '[[Activity Alpha]] can be repeated.\n', reciprocal: true });
  const signals = [
    signal({ key: 'signal:collection', domain: domains[0], source: collection, exact: false }),
    signal({ key: 'signal:exact', domain: domains[0], source: reciprocal, exact: true })
  ];
  return {
    contract: policy.inputContract,
    memberCandidateKey: `member:${key}`,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: label },
    canonicalActivityScopeDisposition: { state: 'source_supported_composite_assigned_task_activity_scope' },
    canonicalActivityRepeatabilityGapEvidenceWorkRouting: { routeKey: 'route', routeState: 'blocked' },
    independentScopedActivityRepeatabilityEvidence: {
      evidenceState: policy.requiredEvidenceState,
      sourceDiscovery: { definedDiscoveryScopeComplete: true, completeIndependentSourceUniverse: false },
      independentSources: [collection, reciprocal],
      sourceLocatedCandidateSignals: signals,
      evidenceDomainPackets: domains.map(domainKey => {
        const matches = signals.filter(item => item.evidenceDomain === domainKey);
        return {
          domainKey,
          candidateSignalEvidenceKeys: matches.map(item => item.evidenceKey),
          candidateSignalCount: matches.length,
          exactSubjectPredicateCandidateCount: matches.filter(item => item.exactSubjectPredicateScopeComplete).length,
          evidenceWorkComplete: false,
          resolved: false,
          domainVerdict: null,
          parentActivityRepeatabilityVerdict: null,
          memberTaskRepeatabilityVerdict: null,
          state: 'unreviewed'
        };
      }),
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      automaticVerificationApplied: false
    },
    independentScopedActivityRepeatabilityEvidenceReview: {
      state: policy.requiredReviewState,
      reviewedDomainCount: 0,
      resolvedDomainCount: 0,
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    memberExpansionReview: { state: 'unreviewed', evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['independent_scoped_activity_repeatability_evidence_requires_semantic_disposition'],
    state: policy.inputState,
    contentHash: `input-${key}`
  };
}

const source = input();
assert.equal(selectIndependentScopedActivityRepeatabilityEvidenceDispositionInputs([source], policy).length, 1);
const built = buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [source], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.repeatabilityReviewComplete, false);
assert.equal(built.audit.packetIntegrityCoverage.completePacketCount, 1);
assert.equal(built.audit.signalDispositionCoverage.inputCandidateSignalCount, 2);
assert.equal(built.audit.signalDispositionCoverage.exactScopedClaimCandidateCount, 1);
assert.equal(built.audit.signalDispositionCoverage.unscopedCollectionCandidateCount, 1);
assert.equal(built.audit.domainDispositionCoverage.dispositionedDomainCount, 6);
assert.equal(built.audit.domainDispositionCoverage.resolvedDomainCount, 0);
const output = built.records[0];
assert.equal(output.independentScopedActivityRepeatabilityDispositionSignals[0].dispositionClass, policy.dispositionClasses.unscopedCollectionCandidate);
assert.equal(output.independentScopedActivityRepeatabilityDispositionSignals[1].dispositionClass, policy.dispositionClasses.exactScopedCandidate);
assert.equal(output.independentScopedActivityRepeatabilityDispositionSignals[1].usableClaimCandidate, true);
assert.equal(output.independentScopedActivityRepeatabilityDispositionSignals[1].canResolveDomainAutomatically, false);
assert.equal(output.independentScopedActivityRepeatabilityDisposition.repeatabilityVerdict, null);
assert.equal(output.independentScopedActivityRepeatabilityReview.resolvedDomainCount, 0);
assert.equal(output.independentScopedActivityRepeatabilityNextEvidenceWork.crossLineCrossPageAndCrossSourceJoinAllowed, false);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const multiple = buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [source, input({ key: 'beta' })], policy });
assert.equal(multiple.audit.publishable, true);
assert.equal(multiple.audit.domainDispositionCoverage.dispositionedDomainCount, 12);

const renamed = buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [input({ key: 'gamma', label: 'Renamed display label' })], policy });
assert.deepEqual(renamed.records[0].independentScopedActivityRepeatabilityDispositionSignals.map(item => item.dispositionClass), output.independentScopedActivityRepeatabilityDispositionSignals.map(item => item.dispositionClass));

const badLine = structuredClone(source);
badLine.independentScopedActivityRepeatabilityEvidence.independentSources[0].sourceLines[0].text = 'changed';
assert.equal(buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [badLine], policy }).audit.publishable, false);

const badSignal = structuredClone(source);
badSignal.independentScopedActivityRepeatabilityEvidence.sourceLocatedCandidateSignals[0].exactSubjectPredicateScopeComplete = true;
assert.equal(buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [badSignal], policy }).audit.publishable, false);

const specificPolicy = structuredClone(policy);
specificPolicy.overrides = { 'member:alpha': 'resolved' };
assert.equal(buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [source], policy: specificPolicy }).audit.publishable, false);

const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(compileIndependentScopedActivityRepeatabilityEvidenceDispositionPolicy(automaticPolicy).valid, false);

const mutated = structuredClone(built.records);
mutated[0].canonicalActivityIdentity.canonicalLabel = 'Changed';
assert.equal(auditIndependentScopedActivityRepeatabilityEvidenceDispositions(mutated, { evidenceRecords: [source], policy }).publishable, false);

const joined = structuredClone(built.records);
joined[0].independentScopedActivityRepeatabilityDisposition.evidenceDomainAssessments[0].resolved = true;
joined[0].independentScopedActivityRepeatabilityDisposition.evidenceDomainAssessments[0].domainVerdict = 'repeatable';
assert.equal(auditIndependentScopedActivityRepeatabilityEvidenceDispositions(joined, { evidenceRecords: [source], policy }).publishable, false);

const promoted = structuredClone(built.records);
promoted[0].independentScopedActivityRepeatabilityDisposition.repeatabilityVerdict = 'repeatable';
promoted[0].independentScopedActivityRepeatabilityReview.evidenceWorkComplete = true;
promoted[0].optimizerEligible = true;
const promotedAudit = auditIndependentScopedActivityRepeatabilityEvidenceDispositions(promoted, { evidenceRecords: [source], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditIndependentScopedActivityRepeatabilityEvidenceDispositions(accountScoped, { evidenceRecords: [source], policy }).publishable, false);

assert.equal(buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [source, structuredClone(source)], policy }).audit.publishable, false);

const deterministic = buildIndependentScopedActivityRepeatabilityEvidenceDispositions({ evidenceRecords: [structuredClone(source)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

console.log('Generic independent scoped-activity repeatability evidence disposition checks passed.');
