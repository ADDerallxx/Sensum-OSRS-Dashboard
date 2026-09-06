import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash, json } from '../ingestion/lib.mjs';
import { auditAgilityTargetConditionGapDiscoveryReviewPackets, buildAgilityTargetConditionGapDiscoveryReviewPackets, compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy, findAgilityTargetConditionGapDiscoveryReviewPacketAccountState } from '../transforms/agility-target-condition-gap-discovery-review-packet-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/agility-target-condition-gap-discovery-review-packet-v1.json', 'utf8'));
const inputPolicy = JSON.parse(fs.readFileSync(policy.inputPolicyFile, 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/agility-target-condition-gap-discovery-review-packet-v1.json', 'utf8'));
const decisionContract = JSON.parse(fs.readFileSync('platform/contracts/agility-target-condition-gap-discovery-review-decision-template-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/agility-target-condition-gap-discovery-review-packet-audit-v1.json', 'utf8'));
const materializerSource = fs.readFileSync('platform/transforms/materialize-agility-target-condition-gap-discovery-review-packets.mjs', 'utf8');
assert.match(materializerSource, /--discovery-snapshot=<exact snapshot directory>/);
assert.match(materializerSource, /revids:\s*batch\.join\('\|'\)/);
assert.doesNotMatch(materializerSource, /rvlimit/);
const sourceText = 'Lead.\n== Changes ==\n* The [[experience]] per hour gained at the basic course has been increased from 8,750 to 10,000.\nEnd.';
const exactLine = sourceText.split('\n')[2];

function sourceRecord() {
  const base = {
    contract: policy.inputRecordContract,
    candidateKey: 'vector:agility_course:agility-variant:Shayzien Agility Course:basic:level-1',
    candidateName: 'Shayzien Agility Course — Basic',
    targetBaseAgility: 34,
    coverageAuditContentHash: 'a'.repeat(64),
    sourceSufficiencyAuditContentHash: 'b'.repeat(64),
    existingBlockers: ['expected_xp_per_hour_at_base_level_34_not_published', 'supporting_rate_matches_superseded_pre_update_value'],
    searchQueries: [{ queryKey: 'shayzien-rate-alignment', blocker: 'supporting_rate_matches_superseded_pre_update_value', diagnosticKind: 'shayzien_rate_alignment', searchText: 'query', namespaces: [0], maxResults: 50, reportedTotalHits: 1, fetchedResultCount: 1, resultPageIds: [317073], paginationComplete: true, truncated: false, resultSetHash: hash([317073]) }],
    discoveredPages: [{ pageId: 317073, title: 'Shayzien Agility Course', sourceRevision: '15168110', sourceTimestamp: '2026-04-07T04:48:43Z', sourceUrl: 'https://oldschool.runescape.wiki/w/Shayzien_Agility_Course', matchedQueryKeys: ['shayzien-rate-alignment'], exactSearchIdentityResolved: true, contentHash: hash(sourceText), contentBytes: Buffer.byteLength(sourceText, 'utf8') }],
    contextSignals: [],
    evidenceDomains: [{ blocker: 'expected_xp_per_hour_at_base_level_34_not_published', queryKeys: [], diagnosticKinds: ['exact_target_rate'], discoveredPageCount: 0, potentialEvidenceSignals: [], disposition: 'unresolved_not_found_by_declared_bounded_queries' }, { blocker: 'supporting_rate_matches_superseded_pre_update_value', queryKeys: ['shayzien-rate-alignment'], diagnosticKinds: ['shayzien_rate_alignment'], discoveredPageCount: 1, potentialEvidenceSignals: [{ signalKind: 'shayzien_rate_alignment', pageId: 317073, title: 'Shayzien Agility Course', sourceRevision: '15168110', sourceUrl: 'https://oldschool.runescape.wiki/w/Shayzien_Agility_Course', line: 3, excerpt: exactLine }], disposition: 'potential_evidence_requires_manual_semantic_reaudit' }],
    disposition: 'blocked_pending_manual_semantic_reaudit',
    manualReauditRequired: true,
    blockersClosed: 0,
    semanticFactsCreated: 0,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    completeWikiUniverseClaimed: false
  };
  const withRecordHash = { ...base, recordContentHash: hash(base) };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
}

function inputs() {
  const record = sourceRecord();
  const discoveryRaw = `${json(record)}\n`;
  const audit = { contract: policy.inputAuditContract, evidenceDomainCoverage: { potentialEvidenceSignalCount: 1, manualReauditCandidateCount: 1 }, blockerPreservation: { preserved: true, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, accountStateFindingCount: 0, completeWikiUniverseClaimCount: 0 }, queryBoundedDiscoveryComplete: true, sourceDiscoveryDispositionStable: false, completeWikiUniverse: false, publishable: true };
  const discoveryManifest = { contract: policy.inputManifestContract, domain: policy.inputDomain, createdAt: '2026-09-06T09:50:52.344Z', records: 1, contentHash: hash(discoveryRaw), source: { policy: { id: inputPolicy.policy, contentHash: hash(inputPolicy) }, audit } };
  const revisionPages = [{ pageid: 317073, title: 'Shayzien Agility Course', revisions: [{ revid: 15168110, timestamp: '2026-04-07T04:48:43Z', slots: { main: { content: sourceText } } }] }];
  return { discoveryRecords: [record], discoveryManifest, discoveryRaw, revisionPages, inputPolicy, policy, contentHash: hash };
}

const compiled = compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(policy);
assert.equal(compiled.valid, true);
assert.deepEqual(compiled.invalidBindings, []);
assert.deepEqual(compiled.invalidRules, []);
assert.equal(compiled.decisionsValid, true);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);

const baseline = inputs();
const built = buildAgilityTargetConditionGapDiscoveryReviewPackets(baseline);
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.reviewPacketMaterializationComplete, true);
assert.equal(built.audit.humanReviewComplete, false);
assert.equal(built.audit.signalCoverage.inputSignalCount, 1);
assert.equal(built.audit.sourceIntegrityCoverage.exactRevisionLineCoverageComplete, true);
assert.equal(built.audit.packetCoverage.outputPacketCount, 1);
assert.equal(built.audit.packetCoverage.completePacketCount, 1);
assert.equal(built.audit.artifactCoverage.allDecisionTemplatesBlank, true);
assert.deepEqual(built.audit.semanticPreservationCoverage, { decisionCount: 0, selectedEvidenceCount: 0, blockersClosed: 0, semanticFactsCreated: 0, optimizerEligibleCount: 0, automaticVerificationCount: 0, completeWikiUniverseClaimCount: 0 });

const packet = built.records[0];
assert.equal(packet.namedBlocker, 'supporting_rate_matches_superseded_pre_update_value');
assert.equal(packet.sourceEvidence.sourceRevision, '15168110');
assert.equal(packet.sourceEvidence.sourceLine, 3);
assert.equal(packet.sourceEvidence.exactSourceLine, exactLine);
assert.equal(packet.sourceEvidence.exactRevisionLineRevalidated, true);
assert.equal(packet.queryBindings[0].resultContainsSourcePage, true);
assert.equal(packet.decision, null);
assert.deepEqual(packet.selectedEvidenceKeys, []);
assert.equal(packet.reviewer, null);
assert.equal(packet.blockersClosed, 0);
assert.equal(packet.optimizerEligible, false);
assert.ok(packet.reviewScope.confirmationDoesNotProve.includes('verified_best_is_not_authorized'));
assert.ok(packet.relatedOpenBlockers.includes('expected_xp_per_hour_at_base_level_34_not_published'));
assert.match(built.artifacts.reviewMarkdown, /revision 15168110/);
assert.equal(built.artifacts.decisions[0].decision, null);
assert.deepEqual(built.artifacts.decisions[0].selectedEvidenceKeys, []);
for (const field of recordContract.required) assert.ok(Object.hasOwn(packet, field), `Missing packet field ${field}`);
for (const field of decisionContract.required) assert.ok(Object.hasOwn(built.artifacts.decisions[0], field), `Missing decision-template field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `Missing audit field ${field}`);

const namedPolicy = structuredClone(policy);
namedPolicy.candidateKey = packet.candidateKey;
assert.equal(compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(namedPolicy).valid, false);
const automaticPolicy = structuredClone(policy);
automaticPolicy.rules.automaticVerificationAllowed = true;
assert.equal(compileAgilityTargetConditionGapDiscoveryReviewPacketPolicy(automaticPolicy).valid, false);

const staleManifest = inputs();
staleManifest.discoveryManifest.contentHash = '0'.repeat(64);
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(staleManifest).audit.publishable, false);
const tamperedRecord = inputs();
tamperedRecord.discoveryRecords[0].candidateName = 'Changed';
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(tamperedRecord).audit.publishable, false);
const badAudit = inputs();
badAudit.discoveryManifest.source.audit.publishable = false;
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(badAudit).audit.publishable, false);
const changedSource = inputs();
changedSource.revisionPages[0].revisions[0].slots.main.content += ' changed';
assert.ok(buildAgilityTargetConditionGapDiscoveryReviewPackets(changedSource).audit.blockers.includes('one_or_more_exact_revision_signal_lines_failed_revalidation'));
const wrongRevision = inputs();
wrongRevision.revisionPages[0].revisions[0].revid = 15168111;
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(wrongRevision).audit.publishable, false);
const wrongTitle = inputs();
wrongTitle.revisionPages[0].title = 'Agility';
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(wrongTitle).audit.publishable, false);
const wrongLine = inputs();
wrongLine.discoveryRecords[0].evidenceDomains[1].potentialEvidenceSignals[0].line = 2;
assert.equal(buildAgilityTargetConditionGapDiscoveryReviewPackets(wrongLine).audit.publishable, false);

const decided = structuredClone(built.records);
decided[0].decision = policy.allowedDecisions[0];
decided[0].selectedEvidenceKeys = [decided[0].sourceEvidence.evidenceKey];
decided[0].reviewer = 'automation';
let auditResult = auditAgilityTargetConditionGapDiscoveryReviewPackets(decided, built.artifacts, baseline);
assert.equal(auditResult.publishable, false);
assert.ok(auditResult.blockers.includes('packet_generation_created_unsupported_decision_fact_promotion_or_account_state'));
const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
auditResult = auditAgilityTargetConditionGapDiscoveryReviewPackets(promoted, built.artifacts, baseline);
assert.equal(auditResult.publishable, false);
const accountScoped = structuredClone(built.records);
accountScoped[0].currentBaseLevel = 34;
assert.equal(findAgilityTargetConditionGapDiscoveryReviewPacketAccountState(accountScoped).length, 1);
assert.equal(auditAgilityTargetConditionGapDiscoveryReviewPackets(accountScoped, built.artifacts, baseline).publishable, false);
const alteredArtifacts = structuredClone(built.artifacts);
alteredArtifacts.decisionNdjson += '{}\n';
assert.equal(auditAgilityTargetConditionGapDiscoveryReviewPackets(built.records, alteredArtifacts, baseline).publishable, false);

const deterministic = buildAgilityTargetConditionGapDiscoveryReviewPackets(inputs());
assert.deepEqual(deterministic, built);
console.log('Agility target-condition discovery review-packet checks passed.');
