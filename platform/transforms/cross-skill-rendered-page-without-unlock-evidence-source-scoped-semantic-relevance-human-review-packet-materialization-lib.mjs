import { hash, json, stable } from '../ingestion/lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';
import { compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy } from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue-export-lib.mjs';
import {
  buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport,
  compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy
} from './cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-review-decision-import-lib.mjs';

const INPUT_DOMAIN = 'cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-work-queue';
const REQUIRED_RULES = [
  'queueManifestPolicySnapshotEveryRecordAndBlankTemplateMustRevalidate',
  'onePacketPerQueueEntryInAuthoritativeReviewOrder',
  'packetsMustBindQueueSnapshotOuterIntrinsicSourceAndEvidenceHashes',
  'exactRevisionLinksMustBeDerivedOnlyFromPinnedRevisionIdentities',
  'everyGuideObservationAndStructuralEvidenceItemMustHaveAStableEvidenceKey',
  'everyRetainedGuideObservationAndStructuralEvidenceItemMustBePreserved',
  'allDecisionEvidenceRequirementsMustMatchTheGuardedImporter',
  'decisionTemplatesMustExactlyMatchTheGuardedImporterAndRemainBlank',
  'batchesMustBeContiguousCompleteNonOverlappingAndAtMostTheConfiguredSize',
  'markdownAndDecisionArtifactsMustReproduceExactlyFromPackets',
  'packetGenerationDoesNotRecordOrApplyAReviewDecision',
  'packetGenerationCannotEstablishSemanticDispositionIdentityRepeatabilityMechanicsOrOptimizerState',
  'namesTitlesPageIdsRevisionsTemplatesCategoriesAliasesAndOverridesCannotAlterPolicyBehavior',
  'currentAccountStateIsForbidden'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((left, right) => left.localeCompare(right));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const byteLength = value => Buffer.byteLength(value, 'utf8');

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|signatureKey|signatureKeys|template|templates|category|categories|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|signaturekey|template|category|alias).*(?:override|exception)s?$/i;
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

export function compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const queuePolicyCoverage = compileRenderedPageWithoutUnlockSemanticRelevanceWorkQueuePolicy(queuePolicy, contentHash);
  const decisionPolicyCoverage = compileRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImportPolicy(decisionPolicy, queuePolicy, contentHash);
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-policy.v1' &&
    policy.queueContract === decisionPolicy.queueContract &&
    policy.packetContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-packet-materialization-audit.v1' &&
    policy.submissionContract === decisionPolicy.submissionContract &&
    policy.inputQueuePolicy === queuePolicy.policy && policy.inputQueuePolicyContentHash === contentHash(queuePolicy) &&
    policy.inputDecisionImportPolicy === decisionPolicy.policy && policy.inputDecisionImportPolicyContentHash === contentHash(decisionPolicy) &&
    policy.queueState === decisionPolicy.queueState &&
    policy.packetState === 'materialized_human_review_packet_pending_explicit_source_scoped_semantic_relevance_decision';
  const batchSizeValid = Number.isInteger(policy.batchSize) && policy.batchSize > 0 && policy.batchSize <= 100;
  const dispositionsValid = same(policy.allowedDispositions || [], decisionPolicy.allowedDecisions || [], contentHash) &&
    same(policy.allowedDispositions || [], queuePolicy.allowedDispositions || [], contentHash);
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && batchSizeValid && dispositionsValid && queuePolicyCoverage.valid && decisionPolicyCoverage.valid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid, batchSizeValid, dispositionsValid, queuePolicyCoverage, decisionPolicyCoverage,
    invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function expectedBlankTemplate(queue, policy, contentHash = hash) {
  const base = {
    contract: policy.submissionContract,
    workQueueEntryKey: queue.workQueueEntryKey,
    evidenceFingerprint: queue.evidenceFingerprint,
    sourcePageId: queue.sourcePageIdentity?.sourcePageId,
    sourceRevision: queue.sourcePageIdentity?.sourceRevision,
    sourceContentHash: queue.sourcePageIdentity?.sourceContentHash,
    reviewRoute: queue.reviewRoute,
    allowedDispositions: queue.allowedDispositions,
    decision: null, reviewer: null, reviewedAt: null, reviewNotes: null, evidenceKeys: [],
    state: 'blank_source_scoped_semantic_relevance_review_decision'
  };
  return { ...base, templateContentHash: contentHash(base) };
}

function exactRevisionUrl(identity = {}) {
  try {
    const parsed = new URL(identity.sourceUrl);
    if (parsed.hostname !== 'oldschool.runescape.wiki' || !/^\d+$/.test(String(identity.sourceRevision))) return null;
    const origin = parsed.origin;
    return `${origin}/w/Special:Redirect/revision/${encodeURIComponent(String(identity.sourceRevision))}`;
  } catch {
    return null;
  }
}

function guideRevisionUrl(queue, observation = {}) {
  return exactRevisionUrl({ sourceUrl: queue.sourcePageIdentity?.sourceUrl, sourceRevision: observation.guideRevision });
}

function structuralCatalog(structuralEvidence = {}, contentHash = hash) {
  return Object.fromEntries(['rootTemplates', 'directCategories', 'leadParagraphs', 'headings'].map(kind => [kind,
    (structuralEvidence[kind] || []).map(evidence => ({ evidenceKey: contentHash(evidence), evidence }))
  ]));
}

function packetFor(queue, queueSnapshotContentHash, policy, contentHash = hash) {
  const guideEvidence = (queue.retainedGuideContexts?.observations || []).map(observation => ({
    evidenceKey: contentHash(observation),
    guideContentEvidenceKey: observation.guideContentHash,
    exactRevisionUrl: guideRevisionUrl(queue, observation),
    observation
  }));
  const structuralEvidenceCatalog = structuralCatalog(queue.structuralEvidence, contentHash);
  const structuralKeys = Object.values(structuralEvidenceCatalog).flat().map(item => item.evidenceKey);
  const guideKeys = unique(guideEvidence.map(item => item.evidenceKey));
  const decisionTemplate = expectedBlankTemplate(queue, policy, contentHash);
  const base = {
    contract: policy.packetContract,
    reviewPacketKey: `${queue.workQueueEntryKey}|human-review-packet`,
    packetOrdinal: queue.reviewQueueOrdinal,
    batchOrdinal: Math.ceil(queue.reviewQueueOrdinal / policy.batchSize),
    batchItemOrdinal: ((queue.reviewQueueOrdinal - 1) % policy.batchSize) + 1,
    workQueueEntryKey: queue.workQueueEntryKey,
    sourceQueueSnapshotContentHash: queueSnapshotContentHash,
    sourceQueueRecordContentHash: queue.contentHash,
    sourceQueueRecordIntrinsicContentHash: queue.recordContentHash,
    packetPolicyContentHash: contentHash(policy),
    inputDecisionImportPolicyContentHash: policy.inputDecisionImportPolicyContentHash,
    sourcePageIdentity: queue.sourcePageIdentity,
    sourceExactRevisionUrl: exactRevisionUrl(queue.sourcePageIdentity),
    provenancePartition: queue.provenancePartition,
    reviewPriority: queue.reviewPriority,
    reviewRoute: queue.reviewRoute,
    reviewQuestion: queue.reviewQuestion,
    requestedTitles: queue.requestedTitles,
    sourceEvidence: {
      completeEvidenceFingerprint: queue.evidenceFingerprint,
      pinnedSourceContentEvidenceKey: queue.sourcePageIdentity?.sourceContentHash,
      upstreamBindings: {
        sourceSignatureSnapshotContentHash: queue.sourceSignatureSnapshotContentHash,
        sourceSignatureRecordContentHash: queue.sourceSignatureRecordContentHash,
        sourceWorkQueueSnapshotContentHash: queue.sourceWorkQueueSnapshotContentHash,
        sourceWorkQueueRecordContentHash: queue.sourceWorkQueueRecordContentHash,
        sourceCandidateSnapshotContentHash: queue.sourceCandidateSnapshotContentHash,
        sourceCandidateRecordContentHash: queue.sourceCandidateRecordContentHash
      }
    },
    guideEvidence,
    structuralEvidenceCatalog,
    evidenceRequirements: {
      everyDecisionMustCite: [queue.evidenceFingerprint, queue.sourcePageIdentity?.sourceContentHash],
      relevantOrAmbiguousMustCiteAtLeastOneOf: guideKeys,
      notRelevantToAnyMustCiteEveryOneOf: guideKeys,
      additionalBoundEvidenceKeys: unique([
        queue.contentHash,
        queue.sourceSignatureSnapshotContentHash, queue.sourceSignatureRecordContentHash,
        queue.sourceWorkQueueSnapshotContentHash, queue.sourceWorkQueueRecordContentHash,
        queue.sourceCandidateSnapshotContentHash, queue.sourceCandidateRecordContentHash,
        ...guideEvidence.map(item => item.guideContentEvidenceKey), ...structuralKeys
      ].filter(validHash))
    },
    decisionTemplate,
    decisionRecorded: false,
    semanticDispositionApplied: false,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: unique([
      ...(queue.blockers || []),
      'explicit_human_source_scoped_semantic_relevance_decision_pending',
      'human_review_packet_materialization_does_not_apply_semantic_disposition'
    ]),
    state: policy.packetState
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function markdownText(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function renderStructuralItems(packet) {
  const labels = { rootTemplates: 'Root templates', directCategories: 'Direct categories', leadParagraphs: 'Lead paragraphs', headings: 'Headings' };
  const lines = [];
  for (const [kind, items] of Object.entries(packet.structuralEvidenceCatalog)) {
    lines.push(`#### ${labels[kind]} (${items.length})`);
    if (!items.length) lines.push('- None retained.');
    for (const item of items) lines.push(`- Evidence key \`${item.evidenceKey}\` — \`${markdownText(json(item.evidence))}\``);
  }
  return lines.join('\n');
}

export function renderRenderedPageWithoutUnlockSemanticRelevanceReviewBatchMarkdown(packets = [], batchOrdinal = 1, batchCount = 1) {
  const lines = [
    `# Source-scoped semantic-relevance review — batch ${batchOrdinal} of ${batchCount}`,
    '',
    '> Human review aid only. Every source and guide link is pinned to an exact Wiki revision. This packet records no decision and establishes no canonical identity, repeatability, mechanics, or optimizer eligibility.',
    '',
    `Packets in this batch: ${packets.length}`,
    ''
  ];
  for (const packet of packets) {
    const title = packet.sourcePageIdentity?.resolvedTitle || 'Untitled source';
    lines.push(`## ${packet.packetOrdinal}. ${markdownText(title)}`, '');
    lines.push(`- Queue entry: \`${packet.workQueueEntryKey}\``);
    lines.push(`- Priority: band ${packet.reviewPriority?.band} · route \`${packet.reviewRoute}\` · provenance \`${packet.provenancePartition}\``);
    lines.push(`- Exact source: [${markdownText(title)} — revision ${markdownText(packet.sourcePageIdentity?.sourceRevision)}](${packet.sourceExactRevisionUrl})`);
    lines.push(`- Source page ID: ${packet.sourcePageIdentity?.sourcePageId} · namespace: ${packet.sourcePageIdentity?.sourceNamespaceId}`);
    lines.push(`- Requested titles: ${packet.requestedTitles.map(value => `\`${markdownText(value)}\``).join(', ')}`);
    lines.push(`- Review question: ${markdownText(packet.reviewQuestion)}`, '');
    lines.push('### Required evidence citations', '');
    lines.push(`- Every decision: fingerprint \`${packet.sourceEvidence.completeEvidenceFingerprint}\` and pinned source \`${packet.sourceEvidence.pinnedSourceContentEvidenceKey}\`.`);
    lines.push(`- Relevant or ambiguous: cite at least one exact guide-observation key (${packet.evidenceRequirements.relevantOrAmbiguousMustCiteAtLeastOneOf.length} available).`);
    lines.push(`- Not relevant to any retained context: cite all ${packet.evidenceRequirements.notRelevantToAnyMustCiteEveryOneOf.length} exact guide-observation keys.`, '');
    lines.push(`### Retained guide observations (${packet.guideEvidence.length})`, '');
    packet.guideEvidence.forEach((item, index) => {
      const observation = item.observation;
      lines.push(`${index + 1}. [${markdownText(observation.guideTitle)} — revision ${markdownText(observation.guideRevision)}](${item.exactRevisionUrl})`);
      lines.push(`   - Evidence key: \`${item.evidenceKey}\``);
      lines.push(`   - Guide content key: \`${item.guideContentEvidenceKey}\``);
      lines.push(`   - Requested title: \`${markdownText(observation.requestedTitle)}\` · parser channel: \`${markdownText(observation.parserChannel)}\` · source presence: \`${markdownText(observation.sourcePresence)}\``);
      lines.push(`   - Exact retained observation: \`${markdownText(json(observation))}\``);
    });
    lines.push('', '<details>', '<summary>Structural source evidence</summary>', '', renderStructuralItems(packet), '', '</details>', '');
    lines.push('### Blank decision row', '', '```json', json(packet.decisionTemplate), '```', '', '---', '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionBatch(packets = []) {
  return packets.map(packet => json(packet.decisionTemplate)).join('\n') + (packets.length ? '\n' : '');
}

function batchArtifactsFor(packets, batchSize, contentHash = hash) {
  const batchCount = Math.ceil(packets.length / batchSize);
  const artifacts = [];
  for (let index = 0; index < batchCount; index++) {
    const rows = packets.slice(index * batchSize, (index + 1) * batchSize);
    const batchOrdinal = index + 1;
    const stem = `batch-${String(batchOrdinal).padStart(4, '0')}`;
    const markdown = renderRenderedPageWithoutUnlockSemanticRelevanceReviewBatchMarkdown(rows, batchOrdinal, batchCount);
    const decisionNdjson = serializeRenderedPageWithoutUnlockSemanticRelevanceDecisionBatch(rows);
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
    contract: 'sensum.cross-skill-rendered-page-without-unlock-evidence-source-scoped-semantic-relevance-human-review-artifact-manifest.v1',
    packetCount, batchSize, batchCount: artifacts.length,
    batchIndex: { file: 'batch-index.tsv', contentHash: contentHash(batchIndexTsv), bytes: byteLength(batchIndexTsv) },
    batches
  };
  return JSON.stringify(stable({ ...base, manifestContentHash: contentHash(base) }), null, 2) + '\n';
}

function manifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, contentHash = hash) {
  const audit = queueManifest?.source?.audit || {};
  const queueCoverage = audit.queueCoverage || {};
  const semantic = audit.semanticPreservationCoverage || {};
  const checks = {
    manifestContractAndDomainMatch: queueManifest?.contract === 'sensum.ingestion-manifest.v1' && queueManifest?.domain === INPUT_DOMAIN,
    manifestRecordCountMatches: queueManifest?.records === queueRecords.length,
    rawSnapshotHashMatches: typeof queueRaw === 'string' && queueRaw.length > 0 && contentHash(queueRaw) === queueSnapshotContentHash && queueManifest?.contentHash === queueSnapshotContentHash,
    manifestPolicyBindingMatches: queueManifest?.source?.policy?.id === policy.inputQueuePolicy && queueManifest?.source?.policy?.contentHash === policy.inputQueuePolicyContentHash,
    queueExportGatesMatch: audit.queueExportComplete === true && audit.semanticRelevanceReviewComplete === false && audit.reconciliationComplete === false && audit.completeActivityUniverse === false && audit.publishable === true,
    queueCoverageMatches: queueCoverage.reviewQueueEntryCount === queueRecords.length && queueCoverage.blankDecisionTemplateCount === queueRecords.length &&
      queueCoverage.duplicateOutputKeys?.length === 0 && queueCoverage.missingOutputKeys?.length === 0 && queueCoverage.unexpectedOutputKeys?.length === 0 && queueCoverage.mismatchKeys?.length === 0 && queueCoverage.priorityOrderMatches === true,
    semanticGatesClosed: semantic.semanticDispositionCount === 0 && semantic.canonicalGameEntityIdentityCount === 0 && semantic.canonicalActivityIdentityCount === 0 && semantic.repeatabilityClassifiedCount === 0 && semantic.mechanicsReviewCompleteCount === 0 && semantic.optimizerEligibleCount === 0 && semantic.automaticVerificationCount === 0 && semantic.decidedTemplateCount === 0
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function inputAssessment({ queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash }) {
  const compiled = compileRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPacketPolicy(policy, queuePolicy, decisionPolicy, contentHash);
  const templates = queueRecords.map(queue => expectedBlankTemplate(queue, policy, contentHash));
  const importer = buildRenderedPageWithoutUnlockSemanticRelevanceReviewDecisionImport({ queueRecords, submissions: templates, policy: decisionPolicy, queuePolicy, queueSnapshotContentHash, contentHash }).audit;
  const manifest = manifestAssessment(queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, contentHash);
  const ordinals = queueRecords.map(row => row.reviewQueueOrdinal);
  const keys = queueRecords.map(row => row.workQueueEntryKey);
  const authoritativeOrder = ordinals.every((ordinal, index) => ordinal === index + 1);
  const duplicateQueueKeys = duplicates(keys);
  const duplicateOrdinals = duplicates(ordinals);
  const importerComplete = importer.policyCoverage?.valid === true && importer.queueCoverage?.queueRecordCount === queueRecords.length &&
    importer.queueCoverage?.completeQueueRecordCount === queueRecords.length && importer.queueCoverage?.duplicateQueueKeys?.length === 0 &&
    importer.submissionCoverage?.submissionRowCount === queueRecords.length && importer.submissionCoverage?.blankSubmissionCount === queueRecords.length &&
    importer.submissionCoverage?.completedSubmissionCount === 0 && importer.submissionCoverage?.invalidSubmissionCount === 0 &&
    importer.accountStateFindings?.length === 0 && importer.recordCoverage?.recordedDecisionCount === 0;
  const complete = compiled.valid && queueRecords.length > 0 && validHash(queueSnapshotContentHash) && manifest.complete && importerComplete && authoritativeOrder && !duplicateQueueKeys.length && !duplicateOrdinals.length;
  return { compiled, templates, importer, manifest, authoritativeOrder, duplicateQueueKeys, duplicateOrdinals, complete };
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
  const unsupportedPromotions = records.filter(record => record.decisionRecorded !== false || record.semanticDispositionApplied !== false ||
    record.decisionTemplate?.decision !== null || record.decisionTemplate?.reviewer !== null || record.decisionTemplate?.reviewedAt !== null ||
    record.decisionTemplate?.reviewNotes !== null || record.decisionTemplate?.evidenceKeys?.length !== 0 ||
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
  const artifactsExact = batchArtifacts.length === expected.batchArtifacts.length && !artifactMismatchBatches.length && !duplicateBatchOrdinals.length && !missingBatchOrdinals.length && !unexpectedBatchOrdinals.length && batchIndexTsv === expected.batchIndexTsv && artifactManifestJson === expected.artifactManifestJson;
  const batchPartitionExact = allPacketOrdinals.length === records.length && allPacketOrdinals.every((ordinal, index) => ordinal === index + 1) && batchArtifacts.every(item => item.packetCount <= policy.batchSize && item.packetCount === item.lastPacketOrdinal - item.firstPacketOrdinal + 1);
  const exactRevisionLinksComplete = records.every(row => typeof row.sourceExactRevisionUrl === 'string' && row.sourceExactRevisionUrl.length > 0 && row.guideEvidence.every(item => typeof item.exactRevisionUrl === 'string' && item.exactRevisionUrl.length > 0));
  const blockers = [];
  if (!expected.input.compiled.valid) blockers.push('human_review_packet_materialization_policy_invalid_or_specific');
  if (!expected.input.manifest.complete) blockers.push('queue_manifest_policy_snapshot_or_gate_binding_invalid');
  if (!expected.input.importer || !expected.input.complete) blockers.push('one_or_more_queue_records_or_blank_templates_failed_guarded_importer_revalidation');
  if (!expected.input.authoritativeOrder || expected.input.duplicateQueueKeys.length || expected.input.duplicateOrdinals.length) blockers.push('queue_order_keys_or_ordinals_not_exact_complete_and_unique');
  if (!packetExact) blockers.push('human_review_packet_set_does_not_exactly_match_queue');
  if (!exactRevisionLinksComplete) blockers.push('one_or_more_source_or_guide_exact_revision_links_invalid');
  if (!batchPartitionExact) blockers.push('review_batches_are_not_contiguous_complete_nonoverlapping_and_bounded');
  if (!artifactsExact) blockers.push('human_review_markdown_or_decision_artifacts_do_not_match_deterministic_reconstruction');
  if (unsupportedPromotions.length) blockers.push('packet_materialization_created_unsupported_review_semantic_or_optimizer_promotion');
  if (accountStateFindings.length) blockers.push('current_account_state_present');
  const publishable = expected.input.complete && packetExact && exactRevisionLinksComplete && batchPartitionExact && artifactsExact && !unsupportedPromotions.length && !accountStateFindings.length;
  const guideObservationCount = queueRecords.reduce((sum, row) => sum + (row.retainedGuideContexts?.observations?.length || 0), 0);
  const structuralCounts = Object.fromEntries(['rootTemplates', 'directCategories', 'leadParagraphs', 'headings'].map(kind => [kind, queueRecords.reduce((sum, row) => sum + (row.structuralEvidence?.[kind]?.length || 0), 0)]));
  return {
    contract: policy.auditContract,
    policyCoverage: expected.input.compiled,
    inputCoverage: {
      queueRecordCount: queueRecords.length,
      importerCompleteQueueRecordCount: expected.input.importer.queueCoverage?.completeQueueRecordCount || 0,
      importerBlankTemplateCount: expected.input.importer.submissionCoverage?.blankSubmissionCount || 0,
      importerInvalidTemplateCount: expected.input.importer.submissionCoverage?.invalidSubmissionCount || 0,
      queueSnapshotContentHash,
      manifestChecks: expected.input.manifest.checks,
      authoritativeReviewOrder: expected.input.authoritativeOrder,
      duplicateQueueKeys: expected.input.duplicateQueueKeys,
      duplicateReviewQueueOrdinals: expected.input.duplicateOrdinals
    },
    packetCoverage: {
      expectedPacketCount: expected.packets.length, packetCount: records.length, duplicatePacketKeys, missingPacketKeys, unexpectedPacketKeys,
      packetMismatchKeys, packetHashFailures, packetPolicyContentHash: contentHash(policy)
    },
    evidenceCoverage: {
      retainedGuideObservationCount: guideObservationCount,
      packetGuideEvidenceCount: records.reduce((sum, row) => sum + (row.guideEvidence?.length || 0), 0),
      retainedStructuralEvidenceCounts: structuralCounts,
      packetStructuralEvidenceCounts: Object.fromEntries(Object.keys(structuralCounts).map(kind => [kind, records.reduce((sum, row) => sum + (row.structuralEvidenceCatalog?.[kind]?.length || 0), 0)])),
      exactRevisionSourceLinkCount: records.filter(row => typeof row.sourceExactRevisionUrl === 'string').length,
      exactRevisionGuideLinkCount: records.reduce((sum, row) => sum + row.guideEvidence.filter(item => typeof item.exactRevisionUrl === 'string').length, 0),
      completeEvidenceRequirementsCount: records.filter(row => {
        const uniqueGuideKeys = unique((row.guideEvidence || []).map(item => item.evidenceKey));
        return row.evidenceRequirements?.everyDecisionMustCite?.length === 2 &&
          same(row.evidenceRequirements?.relevantOrAmbiguousMustCiteAtLeastOneOf || [], uniqueGuideKeys, contentHash) &&
          same(row.evidenceRequirements?.notRelevantToAnyMustCiteEveryOneOf || [], uniqueGuideKeys, contentHash);
      }).length,
      exactRevisionLinksComplete
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
      semanticDispositionAppliedCount: records.filter(row => row.semanticDispositionApplied === true).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length
    },
    accountStateFindings,
    packetMaterializationComplete: publishable,
    semanticRelevanceReviewComplete: false,
    reconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...blockers, 'source_scoped_semantic_relevance_review_pending', 'level_unlock_corpus_absence_reconciliation_pending', 'historical_rendered_expansion_dependency_attribution_incomplete', 'canonical_game_entity_and_activity_identity_not_established', 'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven', 'independent_complete_activity_universe_not_established']),
    publishable
  };
}

export function buildRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets({ queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshotContentHash = '', policy = {}, queuePolicy = {}, decisionPolicy = {}, contentHash = hash } = {}) {
  const options = { queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash };
  const expected = expectedMaterialization(options);
  const records = expected.input.complete ? expected.packets : [];
  const batchArtifacts = expected.input.complete ? expected.batchArtifacts : [];
  const batchIndexTsv = expected.input.complete ? expected.batchIndexTsv : '';
  const artifactManifestJson = expected.input.complete ? expected.artifactManifestJson : '';
  const audit = auditFromExpected(records, batchArtifacts, batchIndexTsv, artifactManifestJson, expected, options);
  return { records, batchArtifacts, batchIndexTsv, artifactManifestJson, audit };
}

export function auditRenderedPageWithoutUnlockSemanticRelevanceHumanReviewPackets(records = [], { queueRecords = [], queueRaw = '', queueManifest = {}, queueSnapshotContentHash = '', policy = {}, queuePolicy = {}, decisionPolicy = {}, batchArtifacts = [], batchIndexTsv = '', artifactManifestJson = '', contentHash = hash } = {}) {
  const options = { queueRecords, queueRaw, queueManifest, queueSnapshotContentHash, policy, queuePolicy, decisionPolicy, contentHash };
  const expected = expectedMaterialization(options);
  return auditFromExpected(records, batchArtifacts, batchIndexTsv, artifactManifestJson, expected, options);
}
