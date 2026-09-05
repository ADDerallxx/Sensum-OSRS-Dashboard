import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditExactScopedIndependentRepeatabilityEvidenceDispositions,
  buildExactScopedIndependentRepeatabilityEvidenceDispositions,
  compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy
} from '../transforms/exact-scoped-independent-repeatability-evidence-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/exact-scoped-independent-repeatability-evidence-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/exact-scoped-independent-repeatability-evidence-disposition-audit-v1.json', 'utf8'));
const domains = policy.requiredEvidenceDomains;
const text = 'The [[Activity Alpha]] can be repeated.\nNo claim here.';
const lines = text.split('\n').map((value, index) => ({ line: index + 1, text: value, contentHash: hash(value) }));

function evidenceRecord() {
  return {
    contract: policy.inputContract,
    memberCandidateKey: 'member:alpha',
    canonicalActivityIdentity: { canonicalActivityKey: 'activity:alpha', canonicalLabel: 'Activity Alpha' },
    exactScopedIndependentRepeatabilityEvidence: {
      evidenceState: policy.requiredEvidenceState,
      parentSubject: { subjectKey: 'activity:alpha', label: 'Activity Alpha', title: 'Activity Alpha' },
      reviewedMemberSubjects: [],
      discovery: { definedDiscoveryChannelsComplete: true, completeIndependentSourceUniverse: false },
      independentSources: [{
        sourceKey: 'wiki:300:3000',
        discoveryChannels: ['complete_main_namespace_backlinks_to_exact_parent_title'],
        sourcePageId: 300,
        sourceTitle: 'Independent evidence',
        sourceRevision: '3000',
        sourceTimestamp: '2026-01-01T00:00:00Z',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Independent_evidence',
        sourceContentHash: hash(text),
        sourceContentBytes: Buffer.byteLength(text),
        exactRevisionSourceText: text,
        sourceLines: structuredClone(lines),
        completeSourceRetained: true
      }],
      exactSameLineSubjectPredicateCandidateSignals: [],
      evidenceDomainPackets: domains.map(domainKey => ({
        domainKey,
        reviewedMemberSubjectCount: 0,
        candidateSignalEvidenceKeys: [],
        sourceDiscoveryCompleteForDefinedChannels: true,
        evidenceWorkComplete: false,
        resolved: false,
        parentActivityRepeatabilityVerdict: null,
        memberTaskRepeatabilityVerdict: null,
        domainVerdict: null
      })),
      parentActivityRepeatabilityVerdict: null,
      memberTaskRepeatabilityVerdict: null,
      repeatabilityVerdict: null,
      automaticVerificationApplied: false
    },
    exactScopedIndependentRepeatabilityEvidenceReview: {
      state: policy.requiredReviewState,
      resolvedDomainCount: 0,
      repeatabilityVerdict: null,
      evidenceWorkComplete: false
    },
    memberExpansionReview: { state: 'unreviewed' },
    mechanicsReview: { state: 'unreviewed' },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['exact_scoped_independent_repeatability_evidence_requires_semantic_disposition'],
    state: policy.inputState,
    contentHash: 'evidence-alpha'
  };
}

const input = evidenceRecord();
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(policy).valid, true);
const built = buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords: [input], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.dispositionAttemptCoverageComplete, true);
assert.equal(built.audit.packetIntegrityCoverage.completePacketCount, 1);
assert.equal(built.audit.domainDispositionCoverage.dispositionedDomainCount, 6);
assert.equal(built.audit.domainDispositionCoverage.noCandidateInCompletedChannelsCount, 5);
assert.equal(built.audit.domainDispositionCoverage.missingReviewedMemberSubjectCount, 1);
assert.equal(built.audit.domainDispositionCoverage.negativeGameFactsEstablishedCount, 0);
assert.equal(built.audit.domainDispositionCoverage.memberIdentityExpansionWorkItemCount, 1);
assert.equal(built.audit.domainDispositionCoverage.sourceChannelExpansionWorkItemCount, 5);
assert.equal(built.audit.domainDispositionCoverage.manualCandidateReviewWorkItemCount, 0);
const output = built.records[0];
assert.equal(output.exactScopedIndependentRepeatabilityDisposition.repeatabilityVerdict, null);
assert.equal(output.exactScopedIndependentRepeatabilityReview.evidenceWorkComplete, false);
assert.ok(output.exactScopedIndependentRepeatabilityDisposition.evidenceDomainAssessments.every(assessment => assessment.resolved === false && assessment.negativeGameFactEstablished === false));
assert.ok(output.exactScopedIndependentRepeatabilityNextEvidenceWork.domainWorkItems.every(item => item.requireExactSameLineSubjectPredicateScope && !item.crossLineCrossSectionCrossPageAndCrossSourceJoinAllowed));
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `Missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const withCandidate = evidenceRecord();
const signal = {
  evidenceKey: 'wiki:300:3000:line-1:independent_source_corroboration_or_conflict:claim:activity:alpha',
  evidenceDomain: 'independent_source_corroboration_or_conflict',
  exactSubject: { subjectKey: 'activity:alpha', sourceAuthoredLink: { rawLink: '[[Activity Alpha]]' } },
  exactPredicate: { matchedText: 'can be repeated' },
  sourceLocator: { lineStart: 1, lineEnd: 1 },
  exactLine: lines[0].text,
  exactLineContentHash: hash(lines[0].text),
  exactSubjectPredicateScopeComplete: true,
  semanticVerdict: null,
  sourcePageId: 300,
  sourceRevision: '3000',
  sourceContentHash: hash(text)
};
withCandidate.exactScopedIndependentRepeatabilityEvidence.exactSameLineSubjectPredicateCandidateSignals.push(signal);
withCandidate.exactScopedIndependentRepeatabilityEvidence.evidenceDomainPackets[5].candidateSignalEvidenceKeys.push(signal.evidenceKey);
const candidateBuilt = buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords: [withCandidate], policy });
assert.equal(candidateBuilt.audit.publishable, true);
assert.equal(candidateBuilt.audit.domainDispositionCoverage.manualCandidateReviewWorkItemCount, 1);
assert.equal(candidateBuilt.records[0].exactScopedIndependentRepeatabilityDisposition.evidenceDomainAssessments[5].dispositionClass, policy.dispositionClasses.exactCandidate);
assert.equal(candidateBuilt.records[0].exactScopedIndependentRepeatabilityDisposition.evidenceDomainAssessments[5].resolved, false);

const badHash = evidenceRecord();
badHash.exactScopedIndependentRepeatabilityEvidence.independentSources[0].sourceLines[0].contentHash = 'bad';
const badHashBuilt = buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords: [badHash], policy });
assert.equal(badHashBuilt.audit.publishable, false);
assert.ok(badHashBuilt.audit.blockers.includes('one_or_more_input_evidence_packets_fail_revision_or_locator_integrity'));

const missingDefinition = structuredClone(policy);
delete missingDefinition.dispositionClasses.noCandidateInCompleteChannels;
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(missingDefinition).valid, false);

const activitySpecific = structuredClone(policy);
activitySpecific.overrides = { 'member:alpha': true };
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(activitySpecific).valid, false);

const automatic = structuredClone(policy);
automatic.rules.automaticVerificationAllowed = true;
assert.equal(compileExactScopedIndependentRepeatabilityEvidenceDispositionPolicy(automatic).valid, false);

const mutated = structuredClone(built.records);
mutated[0].exactScopedIndependentRepeatabilityDisposition.evidenceDomainAssessments[0].negativeGameFactEstablished = true;
assert.equal(auditExactScopedIndependentRepeatabilityEvidenceDispositions(mutated, { evidenceRecords: [input], policy }).publishable, false);

const promoted = structuredClone(built.records);
promoted[0].exactScopedIndependentRepeatabilityDisposition.repeatabilityVerdict = 'repeatable';
promoted[0].exactScopedIndependentRepeatabilityReview.evidenceWorkComplete = true;
promoted[0].optimizerEligible = true;
const promotedAudit = auditExactScopedIndependentRepeatabilityEvidenceDispositions(promoted, { evidenceRecords: [input], policy });
assert.equal(promotedAudit.publishable, false);
assert.ok(promotedAudit.blockers.includes('unsupported_repeatability_member_mechanics_or_optimizer_promotion'));

const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(auditExactScopedIndependentRepeatabilityEvidenceDispositions(accountScoped, { evidenceRecords: [input], policy }).publishable, false);

const deterministic = buildExactScopedIndependentRepeatabilityEvidenceDispositions({ evidenceRecords: [structuredClone(input)], policy: structuredClone(policy) });
assert.deepEqual(deterministic, built);

console.log('Generic exact-scoped independent repeatability evidence disposition checks passed.');
