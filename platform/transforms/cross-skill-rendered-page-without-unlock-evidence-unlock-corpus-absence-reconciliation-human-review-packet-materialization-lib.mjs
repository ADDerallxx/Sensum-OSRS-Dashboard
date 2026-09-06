import { hash, json, stable } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-lib.mjs';
import {
  buildUnlockCorpusAbsenceReconciliationReviewDecisionImport,
  compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy,
  expectedUnlockCorpusAbsenceBlankDecision
} from './cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-review-decision-import-lib.mjs';

const INPUT_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue';
const REQUIRED_RULES = [
  'queueManifestPolicySnapshotEveryRecordAndCorpusBindingMustRevalidate',
  'onePacketPerQueueEntryInAuthoritativeReviewOrder',
  'packetsMustBindQueueSnapshotOuterIntrinsicSourceWorkCrosswalkAndCorpusHashes',
  'exactRevisionLinksMustBeDerivedOnlyFromPinnedTargetIdentities',
  'completeZeroMatchFindingCorpusSummaryAndNonClaimsMustBePreserved',
  'allDecisionEvidenceRequirementsMustMatchTheGuardedImporter',
  'decisionTemplatesMustExactlyMatchTheGuardedImporterAndRemainBlank',
  'batchesMustBeContiguousCompleteNonOverlappingAndAtMostTheConfiguredSize',
  'markdownAndDecisionArtifactsMustReproduceExactlyFromPackets',
  'packetGenerationDoesNotRecordOrApplyAReviewDecision',
  'packetGenerationCannotEstablishCorpusAbsenceNoRequirementUnlockSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsSkillsAliasesFragmentsNamespacesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const byteLength = value => Buffer.byteLength(value, 'utf8');

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === (value.includes('.') ? value : value.replace(/Z$/, '.000Z'));
}

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|alias|aliases|fragment|fragments|namespace|namespaces|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|alias|fragment|namespace).*(?:override|exception)s?$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  visit(policy);
  return sorted(unique(findings));
}

export function compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(queuePolicy, contentHash);
  const decisionPolicyCoverage = compileUnlockCorpusAbsenceReconciliationReviewDecisionImportPolicy(decisionPolicy, queuePolicy, contentHash);
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-materialization-policy.v1' &&
    policy.queueContract === decisionPolicy.queueContract &&
    policy.packetContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-packet-materialization-audit.v1' &&
    policy.submissionContract === decisionPolicy.submissionContract &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.inputDecisionImportPolicy === decisionPolicy.policy && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy) &&
    policy.queueState === decisionPolicy.queueState &&
    policy.packetState === 'materialized_human_review_packet_pending_explicit_unlock_corpus_absence_reconciliation_decision';
  const batchSizeValid = Number.isInteger(policy.batchSize) && policy.batchSize > 0 && policy.batchSize <= 100;
  const dispositionsValid = same(policy.allowedDispositions || [], decisionPolicy.allowedDecisions || [], contentHash) &&
    same(policy.allowedDispositions || [], queuePolicy.allowedReviewDispositions || [], contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && batchSizeValid && dispositionsValid && queuePolicyCoverage.valid && decisionPolicyCoverage.valid && !invalidRules.length && !forbidden.length,
    contractsValid, batchSizeValid, dispositionsValid, queuePolicyCoverage, decisionPolicyCoverage,
    invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function exactRevisionUrl(identity = {}) {
  try {
    const parsed = new URL(identity.sourceUrl);
    if (parsed.hostname !== 'oldschool.runescape.wiki' || !/^\d+$/.test(String(identity.sourceRevision))) return null;
    return `${parsed.origin}/w/Special:Redirect/revision/${encodeURIComponent(String(identity.sourceRevision))}`;
  } catch {
    return null;
  }
}

function evidenceRequirements(queue, queueSnapshotContentHash) {
  return {
    everyDecisionMustCite: [
      queueSnapshotContentHash,
      queue.contentHash,
      queue.recordContentHash,
      queue.sourceWorkQueueRecordContentHash,
      queue.sourceCrosswalkRecordContentHash,
      queue.corpusEvidenceContentHash
    ],
    rejectOrAdditionalReconciliationMustCiteEveryOneOf: [
      queue.corpusEvidence?.stableWikiPageIdSetContentHash,
      queue.corpusEvidence?.statementTargetRelationSetContentHash
    ],
    additionalBoundEvidenceKeys: unique([
      queue.sourceWorkQueueIntrinsicRecordContentHash,
      queue.sourceWorkQueueSnapshotContentHash,
      queue.sourceCrosswalkSnapshotContentHash,
      queue.corpusEvidence?.inventorySnapshotContentHash,
      queue.corpusEvidence?.equivalenceSnapshotContentHash,
      queue.corpusEvidence?.levelUpTableSourceSetContentHash
    ].filter(validHash))
  };
}

function packetFor(queue, queueSnapshotContentHash, policy, contentHash = hash) {
  const decisionTemplate = expectedUnlockCorpusAbsenceBlankDecision(queue, policy);
  const base = {
    contract: policy.packetContract,
    reviewPacketKey: `${queue.absenceWorkEntryKey}|human-review-packet`,
    packetOrdinal: queue.queueOrdinal,
    batchOrdinal: Math.ceil(queue.queueOrdinal / policy.batchSize),
    batchItemOrdinal: ((queue.queueOrdinal - 1) % policy.batchSize) + 1,
    absenceWorkEntryKey: queue.absenceWorkEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueRecordIntrinsicContentHash: queue.recordContentHash,
    packetPolicyContentHash: contentHash(policy),
    inputDecisionImportPolicyContentHash: policy.inputDecisionImportPolicyContentHash,
    sourceWorkQueueBinding: {
      entryKey: queue.sourceWorkQueueEntryKey,
      snapshotContentHash: queue.sourceWorkQueueSnapshotContentHash,
      recordContentHash: queue.sourceWorkQueueRecordContentHash,
      intrinsicRecordContentHash: queue.sourceWorkQueueIntrinsicRecordContentHash
    },
    sourceCrosswalkBinding: {
      snapshotContentHash: queue.sourceCrosswalkSnapshotContentHash,
      recordContentHash: queue.sourceCrosswalkRecordContentHash
    },
    renderedTargetKey: queue.renderedTargetKey,
    stableWikiPageIdentity: queue.stableWikiPageIdentity,
    sourceExactRevisionUrl: exactRevisionUrl(queue.stableWikiPageIdentity),
    findingScope: queue.findingScope,
    matchEvidence: queue.matchEvidence,
    corpusEvidenceContentHash: queue.corpusEvidenceContentHash,
    corpusEvidence: queue.corpusEvidence,
    evidenceRequirements: evidenceRequirements(queue, queueSnapshotContentHash),
    decisionTemplate,
    decisionRecorded: false,
    corpusAbsenceReconciliationApplied: false,
    levelUnlockCorpusAbsenceReconciliation: null,
    noRequirementClaimApplied: false,
    unlockEvidencePresent: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...(queue.blockers || []),
      'explicit_human_unlock_corpus_absence_reconciliation_decision_pending',
      'human_review_packet_materialization_does_not_apply_corpus_absence_or_requirement_state'
    ]),
    state: policy.packetState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function markdownText(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

export function renderUnlockCorpusAbsenceReconciliationReviewBatchMarkdown(packets = [], batchOrdinal = 1, batchCount = 1) {
  const lines = [
    `# Level/unlock-corpus absence review — batch ${batchOrdinal} of ${batchCount}`,
    '',
    '> Human review aid only. A zero page-ID match in this pinned corpus does not prove that no level or unlock requirement exists. This packet records no decision and applies no requirement, identity, mechanics, or optimizer state.',
    '',
    `Packets in this batch: ${packets.length}`,
    ''
  ];
  for (const packet of packets) {
    const title = packet.stableWikiPageIdentity?.resolvedTitle || 'Untitled target';
    lines.push(`## ${packet.packetOrdinal}. ${markdownText(title)}`, '');
    lines.push(`- Absence work entry: \`${packet.absenceWorkEntryKey}\``);
    lines.push(`- Rendered target: \`${packet.renderedTargetKey}\``);
    lines.push(`- Exact target source: [${markdownText(title)} — revision ${markdownText(packet.stableWikiPageIdentity?.sourceRevision)}](${packet.sourceExactRevisionUrl})`);
    lines.push(`- Source page ID: ${packet.stableWikiPageIdentity?.sourcePageId}`);
    lines.push(`- Machine finding: \`${packet.findingScope?.machineFinding}\``);
    lines.push(`- Exact stable page-ID matches: ${packet.matchEvidence?.exactStablePageIdMatchCount} of ${packet.matchEvidence?.corpusStableWikiPageIdCount} corpus pages.`);
    lines.push(`- Finding scope: ${markdownText(packet.findingScope?.statement)}`, '');
    lines.push('### Corpus summary', '');
    lines.push(`- Definition: ${markdownText(packet.corpusEvidence?.definition)}`);
    lines.push(`- Match basis: \`${markdownText(packet.corpusEvidence?.matchBasis)}\``);
    lines.push(`- Skills/tables: ${packet.corpusEvidence?.officialSkillCount} · captured statements: ${packet.corpusEvidence?.capturedStatementCount} · statement/target relations: ${packet.corpusEvidence?.statementTargetRelationCount}`);
    lines.push(`- Stable page IDs: ${packet.corpusEvidence?.stableWikiPageIdCount} · target references: ${packet.corpusEvidence?.equivalenceTargetReferenceCount}`, '');
    lines.push('### Explicit non-claims', '');
    for (const claim of packet.findingScope?.nonClaims || []) lines.push(`- \`${markdownText(claim)}\``);
    lines.push('', '### Allowed decisions', '');
    lines.push('- `confirm_corpus_absence_finding` — confirm only the narrow zero-match observation for this exact corpus.');
    lines.push('- `reject_corpus_absence_finding` — reject the observation because the bound corpus or relationship evidence is wrong.');
    lines.push('- `additional_level_requirement_source_reconciliation_required` — preserve the observation but require additional requirement-source work.', '');
    lines.push('### Required evidence citations', '');
    lines.push(`- Every decision must cite all ${packet.evidenceRequirements.everyDecisionMustCite.length} core keys:`);
    for (const key of packet.evidenceRequirements.everyDecisionMustCite) lines.push(`  - \`${key}\``);
    lines.push(`- Reject or additional-reconciliation decisions must also cite both granular corpus keys:`);
    for (const key of packet.evidenceRequirements.rejectOrAdditionalReconciliationMustCiteEveryOneOf) lines.push(`  - \`${key}\``);
    lines.push('', '<details>', '<summary>Additional bound evidence keys</summary>', '');
    for (const key of packet.evidenceRequirements.additionalBoundEvidenceKeys) lines.push(`- \`${key}\``);
    lines.push('', '</details>', '');
    lines.push('### Blank decision row', '', '```json', json(packet.decisionTemplate), '```', '', '---', '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function serializeUnlockCorpusAbsenceReconciliationDecisionBatch(packets = []) {
  return packets.map(packet => json(packet.decisionTemplate)).join('\n') + (packets.length ? '\n' : '');
}

function batchArtifactsFor(packets, batchSize, contentHash = hash) {
  const batchCount = Math.ceil(packets.length / batchSize);
  const artifacts = [];
  for (let index = 0; index < batchCount; index++) {
    const rows = packets.slice(index * batchSize, (index + 1) * batchSize);
    const batchOrdinal = index + 1;
    const stem = `batch-${String(batchOrdinal).padStart(4, '0')}`;
    const markdown = renderUnlockCorpusAbsenceReconciliationReviewBatchMarkdown(rows, batchOrdinal, batchCount);
    const decisionNdjson = serializeUnlockCorpusAbsenceReconciliationDecisionBatch(rows);
    artifacts.push({
      batchOrdinal,
      firstPacketOrdinal: rows[0]?.packetOrdinal ?? null,
      lastPacketOrdinal: rows.at(-1)?.packetOrdinal ?? null,
      packetCount: rows.length,
      markdownFile: `${stem}-review.md`, markdownContentHash: contentHash(markdown), markdownBytes: byteLength(markdown), markdown,
      decisionFile: `${stem}-decisions.ndjson`, decisionContentHash: contentHash(decisionNdjson), decisionBytes: byteLength(decisionNdjson), decisionNdjson
    });
  }
  return artifacts;
}

function batchIndex(artifacts = []) {
  const header = ['batch_ordinal', 'first_packet_ordinal', 'last_packet_ordinal', 'packet_count', 'markdown_file', 'markdown_sha256', 'markdown_bytes', 'decision_file', 'decision_sha256', 'decision_bytes'];
  const rows = artifacts.map(item => [item.batchOrdinal, item.firstPacketOrdinal, item.lastPacketOrdinal, item.packetCount, item.markdownFile, item.markdownContentHash, item.markdownBytes, item.decisionFile, item.decisionContentHash, item.decisionBytes]);
  return [header, ...rows].map(row => row.join('\t')).join('\n') + '\n';
}

function artifactManifest(artifacts = [], batchIndexTsv = '', packetCount = 0, batchSize = 0, contentHash = hash) {
  const batches = artifacts.map(({ markdown, decisionNdjson, ...metadata }) => metadata);
  const base = {
    contract: 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-human-review-artifact-manifest.v1',
    packetCount, batchSize, batchCount: artifacts.length,
    batchIndex: { file: 'batch-index.tsv', contentHash: contentHash(batchIndexTsv), bytes: byteLength(batchIndexTsv) },
    batches
  };
  return JSON.stringify(stable({ ...base, manifestContentHash: contentHash(base) }), null, 2) + '\n';
}

function manifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, contentHash = hash) {
  const audit = queueManifest?.source?.audit || {};
  const corpus = audit.corpusBindingCoverage || {};
  const absence = audit.absenceCoverage || {};
  const review = audit.reviewCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const manifestCorpusHash = queueManifest?.source?.corpusEvidenceContentHash;
  const checks = {
    manifestContractAndDomainMatch: queueManifest?.contract === 'sensum.ingestion-manifest.v1' && queueManifest?.domain === INPUT_DOMAIN,
    manifestRecordCountMatches: queueManifest?.records === queueRecords.length,
    manifestCreatedAtValid: validIsoTimestamp(queueManifest?.createdAt),
    rawSnapshotHashMatches: typeof queueRaw === 'string' && queueRaw.length > 0 && contentHash(queueRaw) === queueSnapshotContentHash && queueManifest?.contentHash === queueSnapshotContentHash,
    manifestPolicyBindingMatches: queueManifest?.source?.policy?.id === policy.inputQueuePolicy && queueManifest?.source?.policy?.contentHash === policy.inputQueuePolicyContentHash,
    manifestCorpusBindingMatches: validHash(manifestCorpusHash) && corpus.corpusEvidenceContentHash === manifestCorpusHash && corpus.exactInventoryToEquivalenceStatementTargetRelationSet === true,
    queueExportGatesMatch: audit.queueExportComplete === true && audit.absenceReconciliationComplete === false && audit.completeActivityUniverse === false && audit.publishable === true,
    queueCoverageMatches: absence.outputRecordCount === queueRecords.length && absence.zeroExactStablePageIdMatchCount === queueRecords.length &&
      absence.duplicateOutputKeys?.length === 0 && absence.missingOutputKeys?.length === 0 && absence.unexpectedOutputKeys?.length === 0 &&
      absence.recordMismatchKeys?.length === 0 && absence.nonZeroMatchSourceWorkQueueKeys?.length === 0 && absence.nonZeroMatchOutputKeys?.length === 0 && absence.orderMatchesSourceQueue === true,
    reviewFieldsBlank: review.blankDecisionTemplateCount === queueRecords.length && review.reviewStartedCount === 0 && review.completedReconciliationCount === 0,
    semanticGatesClosed: semantic.noRequirementClaimCount === 0 && semantic.semanticDispositionCount === 0 &&
      semantic.canonicalGameEntityIdentityCount === 0 && semantic.canonicalActivityIdentityCount === 0 && semantic.repeatabilityClassifiedCount === 0 &&
      semantic.mechanicsReviewCompleteCount === 0 && semantic.optimizerEligibleCount === 0 && semantic.automaticVerificationCount === 0 && semantic.unsupportedPromotionKeys?.length === 0
  };
  return { checks, manifestCorpusHash, complete: Object.values(checks).every(Boolean) };
}

function inputAssessment({ queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash }) {
  const compiled = compileUnlockCorpusAbsenceReconciliationHumanReviewPacketPolicy(policy, queuePolicy, decisionPolicy, contentHash);
  const templates = queueRecords.map(queue => expectedUnlockCorpusAbsenceBlankDecision(queue, decisionPolicy));
  const manifest = manifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, contentHash);
  const importer = buildUnlockCorpusAbsenceReconciliationReviewDecisionImport({
    queueRecords,
    submissions: templates,
    policy: decisionPolicy,
    queuePolicy,
    queueSnapshotContentHash,
    queueSnapshotCreatedAt: queueManifest?.createdAt,
    queueManifestCorpusEvidenceContentHash: manifest.manifestCorpusHash,
    contentHash
  }).audit;
  const ordinals = queueRecords.map(row => row.queueOrdinal);
  const keys = queueRecords.map(row => row.absenceWorkEntryKey);
  const authoritativeOrder = ordinals.every((ordinal, index) => ordinal === index + 1);
  const duplicateQueueKeys = duplicates(keys);
  const duplicateOrdinals = duplicates(ordinals);
  const importerComplete = importer.policyCoverage?.policyValid === true && importer.queueCoverage?.queueRecordCount === queueRecords.length &&
    importer.queueCoverage?.validQueueRecordCount === queueRecords.length && importer.queueCoverage?.duplicateQueueKeys?.length === 0 &&
    importer.submissionCoverage?.submissionCount === queueRecords.length && importer.submissionCoverage?.blankSubmissionCount === queueRecords.length &&
    importer.submissionCoverage?.completedSubmissionCount === 0 && importer.submissionCoverage?.invalidSubmissionIndexes?.length === 0 &&
    importer.accountStateFindings?.length === 0 && importer.recordCoverage?.recordedDecisionCount === 0;
  const complete = compiled.valid && queueRecords.length > 0 && validHash(queueSnapshotContentHash) && manifest.complete && importerComplete &&
    authoritativeOrder && !duplicateQueueKeys.length && !duplicateOrdinals.length;
  return { compiled, templates, importer, importerComplete, manifest, authoritativeOrder, duplicateQueueKeys, duplicateOrdinals, complete };
}

function expectedMaterialization(options) {
  const input = inputAssessment(options);
  const packets = input.complete ? options.queueRecords.map(queue => packetFor(queue, options.queueSnapshotContentHash, options.policy, options.contentHash)) : [];
  const batchArtifacts = input.complete ? batchArtifactsFor(packets, options.policy.batchSize, options.contentHash) : [];
  const batchIndexTsv = batchIndex(batchArtifacts);
  const artifactManifestJson = artifactManifest(batchArtifacts, batchIndexTsv, packets.length, options.policy.batchSize, options.contentHash);
  return { input, packets, batchArtifacts, batchIndexTsv, artifactManifestJson };
}

function artifactMetadata(item = {}) {
  const { markdown, decisionNdjson, ...metadata } = item;
  return metadata;
}

function auditFromExpected(records, batchArtifacts, batchIndexTsv, artifactManifestJson, expected, options) {
  const { queueRecords, queueSnapshotContentHash, policy, contentHash } = options;
  const packetKeys = records.map(row => row.reviewPacketKey);
  const expectedKeys = expected.packets.map(row => row.reviewPacketKey);
  const duplicatePacketKeys = duplicates(packetKeys);
  const missingPacketKeys = expectedKeys.filter(key => !packetKeys.includes(key));
  const unexpectedPacketKeys = packetKeys.filter(key => !expectedKeys.includes(key));
  const packetMismatchKeys = records.filter(record => {
    const match = expected.packets.find(row => row.reviewPacketKey === record.reviewPacketKey);
    return !match || !same(record, match, contentHash);
  }).map(row => row.reviewPacketKey || 'unknown');
  const packetHashFailures = records.filter(record => !validHash(record.recordContentHash) || record.recordContentHash !== contentHash(without(record, 'recordContentHash'))).map(row => row.reviewPacketKey || 'unknown');
  const unsupportedPromotions = records.filter(record => record.decisionRecorded !== false || record.corpusAbsenceReconciliationApplied !== false ||
    record.levelUnlockCorpusAbsenceReconciliation !== null || record.noRequirementClaimApplied !== false || record.unlockEvidencePresent !== false ||
    record.decisionTemplate?.disposition !== null || record.decisionTemplate?.reviewer !== null || record.decisionTemplate?.reviewedAt !== null ||
    record.decisionTemplate?.notes !== null || record.decisionTemplate?.evidenceKeys?.length !== 0 || record.semanticDisposition !== null ||
    record.canonicalGameEntityIdentity !== null || record.canonicalActivityIdentity !== null || record.repeatabilityClassification !== null ||
    record.mechanicsReviewComplete !== false || record.optimizerEligible !== false || record.automaticVerificationApplied !== false || record.accountIndependent !== true
  ).map(row => row.reviewPacketKey || 'unknown');
  const artifactMismatchBatches = batchArtifacts.filter(item => {
    const match = expected.batchArtifacts.find(row => row.batchOrdinal === item.batchOrdinal);
    return !match || !same(item, match, contentHash);
  }).map(item => item.batchOrdinal);
  const duplicateBatchOrdinals = duplicates(batchArtifacts.map(item => item.batchOrdinal));
  const missingBatchOrdinals = expected.batchArtifacts.map(item => item.batchOrdinal).filter(value => !batchArtifacts.some(item => item.batchOrdinal === value));
  const unexpectedBatchOrdinals = batchArtifacts.map(item => item.batchOrdinal).filter(value => !expected.batchArtifacts.some(item => item.batchOrdinal === value));
  const decisionTemplates = records.map(row => row.decisionTemplate);
  const allPacketOrdinals = batchArtifacts.flatMap(item => {
    const first = Number(item.firstPacketOrdinal), last = Number(item.lastPacketOrdinal);
    return Number.isInteger(first) && Number.isInteger(last) && last >= first ? Array.from({ length: last - first + 1 }, (_, index) => first + index) : [];
  });
  const accountStateFindings = unique([...expected.input.importer.accountStateFindings, ...findAccountState([queueRecords, records, decisionTemplates])]);
  const packetExact = records.length === expected.packets.length && !duplicatePacketKeys.length && !missingPacketKeys.length && !unexpectedPacketKeys.length && !packetMismatchKeys.length && !packetHashFailures.length;
  const artifactsExact = batchArtifacts.length === expected.batchArtifacts.length && !artifactMismatchBatches.length && !duplicateBatchOrdinals.length &&
    !missingBatchOrdinals.length && !unexpectedBatchOrdinals.length && batchIndexTsv === expected.batchIndexTsv && artifactManifestJson === expected.artifactManifestJson;
  const batchPartitionExact = allPacketOrdinals.length === records.length && allPacketOrdinals.every((ordinal, index) => ordinal === index + 1) &&
    batchArtifacts.every(item => item.packetCount <= policy.batchSize && item.packetCount === item.lastPacketOrdinal - item.firstPacketOrdinal + 1);
  const exactRevisionLinksComplete = records.every(row => typeof row.sourceExactRevisionUrl === 'string' && row.sourceExactRevisionUrl.length > 0);
  const completeEvidenceRequirementsCount = records.filter((record, index) => {
    const queue = queueRecords[index];
    return queue && same(record.evidenceRequirements, evidenceRequirements(queue, queueSnapshotContentHash), contentHash);
  }).length;
  const evidenceRequirementsComplete = completeEvidenceRequirementsCount === records.length;
  const blockers = [];
  if (!expected.input.compiled.valid) blockers.push('human_review_packet_materialization_policy_invalid_or_specific');
  if (!expected.input.manifest.complete) blockers.push('queue_manifest_policy_snapshot_corpus_or_gate_binding_invalid');
  if (!expected.input.importerComplete || !expected.input.complete) blockers.push('one_or_more_queue_records_or_blank_templates_failed_guarded_importer_revalidation');
  if (!expected.input.authoritativeOrder || expected.input.duplicateQueueKeys.length || expected.input.duplicateOrdinals.length) blockers.push('queue_order_keys_or_ordinals_not_exact_complete_and_unique');
  if (!packetExact) blockers.push('human_review_packet_set_does_not_exactly_match_queue');
  if (!exactRevisionLinksComplete) blockers.push('one_or_more_target_exact_revision_links_invalid');
  if (!evidenceRequirementsComplete) blockers.push('one_or_more_packet_evidence_requirements_do_not_match_guarded_importer');
  if (!batchPartitionExact) blockers.push('review_batches_are_not_contiguous_complete_nonoverlapping_and_bounded');
  if (!artifactsExact) blockers.push('human_review_markdown_or_decision_artifacts_do_not_match_deterministic_reconstruction');
  if (unsupportedPromotions.length) blockers.push('packet_materialization_created_unsupported_requirement_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const publishable = expected.input.complete && packetExact && exactRevisionLinksComplete && evidenceRequirementsComplete && batchPartitionExact && artifactsExact &&
    !unsupportedPromotions.length && !accountStateFindings.length;
  return {
    contract: policy.auditContract,
    policyCoverage: expected.input.compiled,
    inputCoverage: {
      queueRecordCount: queueRecords.length,
      importerValidQueueRecordCount: expected.input.importer.queueCoverage?.validQueueRecordCount || 0,
      importerBlankTemplateCount: expected.input.importer.submissionCoverage?.blankSubmissionCount || 0,
      importerInvalidTemplateCount: expected.input.importer.submissionCoverage?.invalidSubmissionIndexes?.length || 0,
      queueSnapshotContentHash,
      queueSnapshotCreatedAt: options.queueManifest?.createdAt,
      corpusEvidenceContentHash: expected.input.manifest.manifestCorpusHash,
      manifestChecks: expected.input.manifest.checks,
      authoritativeReviewOrder: expected.input.authoritativeOrder,
      duplicateQueueKeys: expected.input.duplicateQueueKeys,
      duplicateQueueOrdinals: expected.input.duplicateOrdinals
    },
    packetCoverage: {
      expectedPacketCount: expected.packets.length, packetCount: records.length, duplicatePacketKeys, missingPacketKeys, unexpectedPacketKeys,
      packetMismatchKeys, packetHashFailures, packetPolicyContentHash: contentHash(policy)
    },
    evidenceCoverage: {
      completeEvidenceRequirementsCount,
      evidenceRequirementsComplete,
      exactRevisionSourceLinkCount: records.filter(row => typeof row.sourceExactRevisionUrl === 'string').length,
      exactRevisionLinksComplete,
      zeroExactStablePageIdMatchCount: records.filter(row => row.matchEvidence?.exactStablePageIdMatchCount === 0).length,
      corpusEvidenceBoundCount: records.filter(row => row.corpusEvidenceContentHash === expected.input.manifest.manifestCorpusHash).length,
      nonClaimCount: records.reduce((sum, row) => sum + (row.findingScope?.nonClaims?.length || 0), 0)
    },
    batchCoverage: {
      configuredBatchSize: policy.batchSize, expectedBatchCount: expected.batchArtifacts.length, batchCount: batchArtifacts.length,
      duplicateBatchOrdinals, missingBatchOrdinals, unexpectedBatchOrdinals, artifactMismatchBatches,
      packetOrdinalsCovered: allPacketOrdinals.length, partitionExact: batchPartitionExact
    },
    artifactCoverage: {
      artifactsExact,
      batchIndexContentHash: contentHash(batchIndexTsv), batchIndexBytes: byteLength(batchIndexTsv), batchIndexMatches: batchIndexTsv === expected.batchIndexTsv,
      artifactManifestContentHash: contentHash(artifactManifestJson), artifactManifestBytes: byteLength(artifactManifestJson), artifactManifestMatches: artifactManifestJson === expected.artifactManifestJson,
      batchArtifacts: batchArtifacts.map(artifactMetadata)
    },
    semanticPreservationCoverage: {
      unsupportedPromotions,
      decisionRecordedCount: records.filter(row => row.decisionRecorded === true).length,
      corpusAbsenceApplicationCount: records.filter(row => row.corpusAbsenceReconciliationApplied === true).length,
      noRequirementClaimCount: records.filter(row => row.noRequirementClaimApplied === true).length,
      unlockEvidenceApplicationCount: records.filter(row => row.unlockEvidencePresent === true).length,
      semanticDispositionApplicationCount: records.filter(row => row.semanticDisposition !== null).length,
      canonicalIdentityPromotionCount: records.filter(row => row.canonicalGameEntityIdentity !== null || row.canonicalActivityIdentity !== null).length,
      repeatabilityPromotionCount: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsPromotionCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerPromotionCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
    },
    accountStateFindings,
    packetMaterializationComplete: publishable,
    absenceReconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers,
      'level_unlock_corpus_absence_reconciliation_human_review_pending',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}

export function buildUnlockCorpusAbsenceReconciliationHumanReviewPackets({
  queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshotContentHash = '', policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash
} = {}) {
  const options = { queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash };
  const expected = expectedMaterialization(options);
  const records = expected.input.complete ? expected.packets : [];
  const batchArtifacts = expected.input.complete ? expected.batchArtifacts : [];
  const batchIndexTsv = expected.input.complete ? expected.batchIndexTsv : '';
  const artifactManifestJson = expected.input.complete ? expected.artifactManifestJson : '';
  const audit = auditFromExpected(records, batchArtifacts, batchIndexTsv, artifactManifestJson, expected, options);
  return { records, batchArtifacts, batchIndexTsv, artifactManifestJson, audit };
}

export function auditUnlockCorpusAbsenceReconciliationHumanReviewPackets(records = [], {
  queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshotContentHash = '', policy = {}, queuePolicy = {}, decisionPolicy = {},
  batchArtifacts = [], batchIndexTsv = '', artifactManifestJson = '', contentHash = hash
} = {}) {
  const options = { queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash };
  const expected = expectedMaterialization(options);
  return auditFromExpected(records, batchArtifacts, batchIndexTsv, artifactManifestJson, expected, options);
}
