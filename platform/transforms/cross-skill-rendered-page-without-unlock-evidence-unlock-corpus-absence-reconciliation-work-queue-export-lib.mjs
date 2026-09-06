import { hash, json } from '../ingestion/lib.mjs';
import { auditSkillLevelUnlockInventory } from '../ingestion/skill-level-unlock-inventory-lib.mjs';
import { findAccountState } from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const ALLOWED_DISPOSITIONS = [
  'confirm_corpus_absence_finding',
  'reject_corpus_absence_finding',
  'additional_level_requirement_source_reconciliation_required'
];
const NON_CLAIMS = [
  'no_level_requirement_exists',
  'no_unlock_requirement_exists_outside_the_level_up_table_link_corpus',
  'rendered_target_is_semantically_relevant_to_a_skill',
  'rendered_target_is_a_canonical_game_entity_or_activity',
  'rendered_target_is_repeatable',
  'requirements_variants_xp_timing_or_mechanics_are_complete',
  'rendered_target_is_optimizer_eligible'
];
const REQUIRED_RULES = [
  'everySourceQueueRecordRequiringTheChannelMustEnterExactlyOnce',
  'sourceQueueCrosswalkInventoryAndEquivalenceSnapshotsMustRevalidate',
  'sourceQueueAndCrosswalkMustBindTheSameStableRenderedTarget',
  'inventoryMustCoverEveryOfficialSkillAndEverySourceBulletExactlyOnce',
  'everyInventoryStatementTargetRelationMustAppearExactlyOnceInTheEquivalenceCorpus',
  'everyEquivalenceStatementAndSkillReferenceMustBindTheInventory',
  'absenceMatchingUsesOnlyExactStableOfficialWikiPageId',
  'titleAliasFragmentNamespaceAndSemanticMatchingAreForbidden',
  'everyQueuedTargetMustHaveZeroMatchesInTheCompleteEquivalencePageIdSet',
  'machineObservedAbsenceDoesNotCompleteHumanReconciliation',
  'blankDecisionTemplatesCannotApplyAReviewDecision',
  'queueExportCannotEstablishNoRequirementSemanticIdentityRepeatabilityMechanicsOrOptimizerState',
  'currentAccountStateIsForbidden'
];
const SOURCE_CONTRACT = 'sensum.cross-skill-rendered-page-without-unlock-evidence-reconciliation-work-queue-entry.v1';
const CROSSWALK_CONTRACT = 'sensum.skill-training-guide-unlock-page-crosswalk.v1';
const INVENTORY_CONTRACT = 'sensum.skill-level-unlock-inventory.v1';
const EQUIVALENCE_CONTRACT = 'sensum.unlock-linked-page-wiki-equivalence.v1';

const unique = values => [...new Set(values)];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const normalizeTitle = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const relationKey = (statementKey, title) => `${statementKey}|${normalizeTitle(title)}`;
const stableIdentity = row => row?.renderedEvidence?.targetPageIdentity || null;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:titleOverrides|aliasOverrides|fragmentOverrides|namespaceOverrides|pageIdOverrides|skillOverrides|semanticOverrides|exceptions|overrides)$/i;
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
  return unique(findings).sort();
}

export function compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(policy = {}, contentHash = hash) {
  const contractsValid = policy.policy === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-policy.v1' &&
    policy.inputWorkQueueContract === SOURCE_CONTRACT && policy.inputCrosswalkContract === CROSSWALK_CONTRACT &&
    policy.inputInventoryContract === INVENTORY_CONTRACT && policy.inputEquivalenceContract === EQUIVALENCE_CONTRACT &&
    policy.outputContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-entry.v1' &&
    policy.decisionTemplateContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-decision-template.v1' &&
    policy.auditContract === 'sensum.cross-skill-rendered-page-without-unlock-evidence-unlock-corpus-absence-reconciliation-work-queue-export-audit.v1';
  const vocabularyValid = policy.requiredEvidenceChannel === 'level_unlock_corpus_absence_reconciliation' &&
    policy.matchBasis === 'exact_stable_official_wiki_page_id' &&
    policy.machineFinding === 'zero_exact_stable_page_id_matches_in_revision_pinned_level_up_table_link_corpus' &&
    same(policy.allowedReviewDispositions || [], ALLOWED_DISPOSITIONS, contentHash) && same(policy.nonClaims || [], NON_CLAIMS, contentHash);
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const forbidden = forbiddenPolicyPaths(policy);
  return {
    valid: contractsValid && vocabularyValid && invalidRules.length === 0 && forbidden.length === 0,
    contractsValid, vocabularyValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden
  };
}

function outerHashValid(record, contentHash = hash) {
  return validHash(record?.contentHash) && record.contentHash === contentHash(without(record, 'contentHash'));
}

function sourceQueueIntrinsicHashValid(record, contentHash = hash) {
  return validHash(record?.recordContentHash) && record.recordContentHash === contentHash(without(record, 'contentHash', 'recordContentHash'));
}

function sourceQueueGatesClosed(record = {}) {
  const evidence = record.evidenceCollection || {};
  return record.unlockEvidencePresent === false && record.semanticDisposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false &&
    record.accountIndependent === true && evidence.levelUnlockCorpusAbsenceReconciliation === null;
}

function crosswalkGatesClosed(record = {}) {
  return record.unlockEvidence === null && record.crossSourcePageIdentityEstablished === false &&
    record.revisionRelationship === 'no_unlock_page_match' &&
    record.semanticRoutingState === 'rendered_stable_page_without_unlock_evidence' &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatableTrainingActivity === null && record.optimizerEligible === false &&
    record.accountIndependent === true;
}

function equivalenceGatesClosed(record = {}) {
  return record.wikiPageEquivalenceEstablished === true && record.canonicalGameEntityIdentity === null &&
    record.canonicalActivityIdentity === null && record.repeatableTrainingActivity === null &&
    record.optimizerEligible === false && record.accountIndependent === true;
}

function expectedSourceAuditGates(source = {}, kind) {
  const audit = source?.audit || {};
  if (kind === 'workQueue') return audit.queueExportComplete === true && audit.publishable === true &&
    audit.reconciliationComplete === false && audit.completeActivityUniverse === false &&
    audit.queueCoverage?.outputRecordCount > 0 && !audit.queueCoverage?.duplicateOutputPartitionKeys?.length &&
    !audit.queueCoverage?.missingOutputPartitionKeys?.length && !audit.queueCoverage?.unexpectedOutputPartitionKeys?.length &&
    !audit.queueCoverage?.recordMismatchPartitionKeys?.length && !audit.semanticPreservationCoverage?.unsupportedPromotionPartitionKeys?.length;
  if (kind === 'crosswalk') return audit.crosswalkCoverageComplete === true && audit.publishable === true &&
    audit.completeActivityUniverse === false && audit.renderedTargetCoverage?.exactRenderedTargetSetAndContextMatch === true &&
    !audit.crossSourceIdentityCoverage?.matchLogicMismatchKeys?.length && !audit.semanticRoutingCoverage?.unsupportedPromotionTargetKeys?.length;
  if (kind === 'inventory') return audit.rawInventoryComplete === true && audit.publishable === true &&
    audit.completeActivityUniverse === false && audit.officialSkillDomain?.missingSkillKeys?.length === 0 &&
    audit.officialSkillDomain?.unexpectedSkillKeys?.length === 0 && audit.officialSkillDomain?.duplicateSkillKeys?.length === 0 &&
    audit.statementCoverage?.countsMatch === true;
  if (kind === 'equivalence') return audit.wikiPageEquivalenceComplete === true && audit.publishable === true &&
    audit.completeActivityUniverse === false && audit.inputTargetCoverage?.exactTargetSetMatch === true &&
    !audit.pageIdentityCoverage?.duplicateCanonicalWikiPageKeys?.length && !audit.pageIdentityCoverage?.invalidRecordKeys?.length &&
    !audit.pageIdentityCoverage?.inconsistentGroupKeys?.length;
  return false;
}

function inventoryRelations(inventoryRecords = []) {
  const relations = [], statements = new Map();
  for (const skill of inventoryRecords) for (const parameter of skill.parameters || []) for (const entry of parameter.entries || []) {
    statements.set(entry.entryKey, { skillKey: skill.skillKey, entry });
    for (const title of entry.linkedTargets || []) relations.push({ key: relationKey(entry.entryKey, title), statementKey: entry.entryKey, skillKey: skill.skillKey, requestedTitle: title });
  }
  return { relations, statements };
}

function equivalenceRelations(equivalenceRecords = []) {
  const relations = [];
  for (const page of equivalenceRecords) for (const reference of page.targetReferences || []) for (const statementKey of reference.referencedBy?.statementKeys || []) {
    relations.push({ key: relationKey(statementKey, reference.requestedTitle), statementKey, requestedTitle: reference.requestedTitle, targetKey: reference.targetKey, sourcePageId: page.sourcePageId });
  }
  return { relations };
}

function buildCorpusEvidence({ inventoryRecords = [], equivalenceRecords = [], inventorySource = {}, snapshots = {}, contentHash = hash } = {}) {
  const inventory = inventoryRelations(inventoryRecords);
  const equivalence = equivalenceRelations(equivalenceRecords);
  const pageIds = sorted(equivalenceRecords.map(row => row.sourcePageId));
  const tableSources = [...inventoryRecords].sort((a, b) => a.skillKey.localeCompare(b.skillKey)).map(row => ({
    skillKey: row.skillKey, skill: row.skill, minimumBaseLevel: row.minimumBaseLevel, maximumBaseLevel: row.maximumBaseLevel,
    sourceRevision: row.sourceRevision, sourceTimestamp: row.sourceTimestamp, sourceUrl: row.sourceUrl,
    sourceContentHash: row.sourceContentHash, sourceLocator: row.sourceLocator,
    parameterCount: row.parameterCount, capturedStatementCount: row.capturedStatementCount
  }));
  return {
    contract: 'sensum.level-unlock-corpus-evidence.v1',
    definition: 'resolved stable Wiki page IDs referenced by the complete revision-pinned level-up tables for every official skill',
    matchBasis: 'exact_stable_official_wiki_page_id',
    inventorySnapshotContentHash: snapshots.inventory,
    equivalenceSnapshotContentHash: snapshots.equivalence,
    skillDomain: {
      page: inventorySource?.skillDomain?.page || null,
      revision: inventorySource?.skillDomain?.revision || null,
      timestamp: inventorySource?.skillDomain?.timestamp || null,
      officialSkillCount: inventoryRecords.length,
      officialSkillKeys: inventoryRecords.map(row => row.skillKey)
    },
    levelUpTableSources: tableSources,
    levelUpTableSourceSetContentHash: contentHash(tableSources),
    parameterCount: inventoryRecords.reduce((sum, row) => sum + Number(row.parameterCount || 0), 0),
    emptyParameterCount: inventoryRecords.reduce((sum, row) => sum + (row.parameters || []).filter(parameter => parameter.declaredEmpty).length, 0),
    capturedStatementCount: inventoryRecords.reduce((sum, row) => sum + Number(row.capturedStatementCount || 0), 0),
    statementTargetRelationCount: inventory.relations.length,
    statementTargetRelationSetContentHash: contentHash(sorted(inventory.relations.map(row => row.key))),
    equivalenceTargetReferenceCount: equivalenceRecords.reduce((sum, row) => sum + Number(row.targetReferenceCount || 0), 0),
    equivalenceStatementReferenceCount: equivalence.relations.length,
    stableWikiPageIdCount: pageIds.length,
    stableWikiPageIdSetContentHash: contentHash(pageIds),
    accountIndependent: true,
    nonClaims: NON_CLAIMS
  };
}

function analyzeInputs({ workQueueRecords = [], crosswalkRecords = [], inventoryRecords = [], equivalenceRecords = [], policy = {}, snapshots = {}, sources = {}, contentHash = hash } = {}) {
  const compiled = compileUnlockCorpusAbsenceReconciliationWorkQueuePolicy(policy, contentHash);
  const snapshotValidity = Object.fromEntries(['workQueue', 'crosswalk', 'inventory', 'equivalence'].map(key => [key, validHash(snapshots[key])]));
  const sourceAuditValidity = Object.fromEntries(['workQueue', 'crosswalk', 'inventory', 'equivalence'].map(key => [key, expectedSourceAuditGates(sources[key], key)]));
  const workQueueOuterHashMismatchKeys = workQueueRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.workQueueEntryKey);
  const workQueueIntrinsicHashMismatchKeys = workQueueRecords.filter(row => !sourceQueueIntrinsicHashValid(row, contentHash)).map(row => row.workQueueEntryKey);
  const workQueueContractMismatchKeys = workQueueRecords.filter(row => row.contract !== SOURCE_CONTRACT).map(row => row.workQueueEntryKey);
  const workQueueChannelMismatchKeys = workQueueRecords.filter(row => !row.requiredEvidenceChannels?.includes(policy.requiredEvidenceChannel)).map(row => row.workQueueEntryKey);
  const workQueuePromotionKeys = workQueueRecords.filter(row => !sourceQueueGatesClosed(row)).map(row => row.workQueueEntryKey);
  const workQueueKeys = workQueueRecords.map(row => row.workQueueEntryKey);
  const duplicateWorkQueueKeys = duplicates(workQueueKeys);
  const invalidQueueOrdinals = workQueueRecords.filter((row, index) => row.queueOrdinal !== index + 1).map(row => row.workQueueEntryKey);

  const crosswalkOuterHashMismatchKeys = crosswalkRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.renderedTargetKey);
  const crosswalkContractMismatchKeys = crosswalkRecords.filter(row => row.contract !== CROSSWALK_CONTRACT).map(row => row.renderedTargetKey);
  const stableNoMatchRecords = crosswalkRecords.filter(row => Number.isInteger(row.sourcePageId) && row.sourcePageId > 0 && crosswalkGatesClosed(row));
  const stableNoMatchKeys = stableNoMatchRecords.map(row => row.renderedTargetKey);
  const duplicateStableNoMatchKeys = duplicates(stableNoMatchKeys);
  const workTargetKeys = workQueueRecords.map(row => row.renderedTargetKey);
  const duplicateWorkTargetKeys = duplicates(workTargetKeys);
  const missingWorkTargets = stableNoMatchKeys.filter(key => !workTargetKeys.includes(key));
  const unexpectedWorkTargets = workTargetKeys.filter(key => !stableNoMatchKeys.includes(key));
  const crosswalkByKey = new Map(stableNoMatchRecords.map(row => [row.renderedTargetKey, row]));
  const sourceCrosswalkBindingMismatchKeys = workQueueRecords.filter(row => {
    const crosswalk = crosswalkByKey.get(row.renderedTargetKey);
    return !crosswalk || row.stableWikiPageIdentity?.sourcePageId !== crosswalk.sourcePageId ||
      !same(row.stableWikiPageIdentity, stableIdentity(crosswalk), contentHash) ||
      row.guideObservationCount !== crosswalk.renderedEvidence?.guideObservationCount;
  }).map(row => row.workQueueEntryKey);

  const inventoryOuterHashMismatchKeys = inventoryRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.skillKey);
  const inventoryContractMismatchKeys = inventoryRecords.filter(row => row.contract !== INVENTORY_CONTRACT).map(row => row.skillKey);
  const expectedDomains = sources.inventory?.skillDomain?.skills || [];
  const inventoryAudit = auditSkillLevelUnlockInventory(inventoryRecords.map(row => without(row, 'contentHash')), expectedDomains);
  const tableMetadataBySkill = new Map((sources.inventory?.levelUpTables || []).map(row => [row.skillKey, row]));
  const inventoryManifestBindingMismatchKeys = inventoryRecords.filter(row => {
    const source = tableMetadataBySkill.get(row.skillKey);
    return !source || String(source.revision) !== String(row.sourceRevision) || source.timestamp !== row.sourceTimestamp ||
      source.sourceContentHash !== row.sourceContentHash || source.parameterCount !== row.parameterCount || source.statementCount !== row.capturedStatementCount;
  }).map(row => row.skillKey);
  const unexpectedInventoryManifestSkillKeys = [...tableMetadataBySkill.keys()].filter(key => !inventoryRecords.some(row => row.skillKey === key));

  const equivalenceOuterHashMismatchKeys = equivalenceRecords.filter(row => !outerHashValid(row, contentHash)).map(row => row.canonicalWikiPageKey);
  const equivalenceContractMismatchKeys = equivalenceRecords.filter(row => row.contract !== EQUIVALENCE_CONTRACT).map(row => row.canonicalWikiPageKey);
  const equivalenceInvalidKeys = equivalenceRecords.filter(row => !Number.isInteger(row.sourcePageId) || row.sourcePageId <= 0 ||
    row.canonicalWikiPageKey !== `osrs-wiki-pageid:${row.sourcePageId}` || row.targetReferenceCount !== row.targetReferences?.length ||
    !equivalenceGatesClosed(row)).map(row => row.canonicalWikiPageKey || String(row.sourcePageId));
  const equivalencePageIds = equivalenceRecords.map(row => row.sourcePageId);
  const duplicateEquivalencePageIds = duplicates(equivalencePageIds);
  const equivalenceTargetKeys = equivalenceRecords.flatMap(row => (row.targetReferences || []).map(reference => reference.targetKey));
  const duplicateEquivalenceTargetKeys = duplicates(equivalenceTargetKeys);

  const inventory = inventoryRelations(inventoryRecords);
  const equivalence = equivalenceRelations(equivalenceRecords);
  const inventoryRelationKeys = inventory.relations.map(row => row.key);
  const equivalenceRelationKeys = equivalence.relations.map(row => row.key);
  const duplicateInventoryRelationKeys = duplicates(inventoryRelationKeys);
  const duplicateEquivalenceRelationKeys = duplicates(equivalenceRelationKeys);
  const missingEquivalenceRelations = inventoryRelationKeys.filter(key => !equivalenceRelationKeys.includes(key));
  const unexpectedEquivalenceRelations = equivalenceRelationKeys.filter(key => !inventoryRelationKeys.includes(key));
  const invalidStatementReferenceKeys = equivalence.relations.filter(row => !inventory.statements.has(row.statementKey)).map(row => row.key);
  const equivalenceSkillReferenceMismatchKeys = [];
  for (const page of equivalenceRecords) for (const reference of page.targetReferences || []) {
    const expectedSkills = sorted(unique((reference.referencedBy?.statementKeys || []).map(key => inventory.statements.get(key)?.skillKey).filter(Boolean)));
    const actualSkills = sorted(reference.referencedBy?.skillKeys || []);
    if (!same(expectedSkills, actualSkills, contentHash)) equivalenceSkillReferenceMismatchKeys.push(reference.targetKey);
  }

  const equivalencePageIdSet = new Set(equivalencePageIds);
  const targetPageIdMatchCounts = Object.fromEntries(workQueueRecords.map(row => [row.renderedTargetKey, equivalencePageIdSet.has(row.stableWikiPageIdentity?.sourcePageId) ? 1 : 0]));
  const nonZeroMatchWorkQueueKeys = workQueueRecords.filter(row => targetPageIdMatchCounts[row.renderedTargetKey] !== 0).map(row => row.workQueueEntryKey);
  const corpusEvidence = buildCorpusEvidence({ inventoryRecords, equivalenceRecords, inventorySource: sources.inventory, snapshots, contentHash });
  const corpusEvidenceContentHash = contentHash(corpusEvidence);
  const accountStateFindings = findAccountState([...workQueueRecords, ...crosswalkRecords, ...inventoryRecords, ...equivalenceRecords]);
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('unlock_corpus_absence_queue_policy_invalid_or_specific');
  if (Object.values(snapshotValidity).some(value => !value)) structuralBlockers.push('one_or_more_input_snapshot_hashes_missing_or_invalid');
  if (Object.values(sourceAuditValidity).some(value => !value)) structuralBlockers.push('one_or_more_input_snapshot_audit_gates_invalid');
  if (!workQueueRecords.length || workQueueOuterHashMismatchKeys.length || workQueueIntrinsicHashMismatchKeys.length || workQueueContractMismatchKeys.length || workQueueChannelMismatchKeys.length || workQueuePromotionKeys.length || duplicateWorkQueueKeys.length || invalidQueueOrdinals.length) structuralBlockers.push('source_reconciliation_work_queue_failed_exact_revalidation');
  if (!crosswalkRecords.length || crosswalkOuterHashMismatchKeys.length || crosswalkContractMismatchKeys.length || duplicateStableNoMatchKeys.length) structuralBlockers.push('source_crosswalk_failed_exact_revalidation');
  if (duplicateWorkTargetKeys.length || missingWorkTargets.length || unexpectedWorkTargets.length || sourceCrosswalkBindingMismatchKeys.length) structuralBlockers.push('source_queue_and_stable_no_match_crosswalk_sets_or_bindings_differ');
  if (inventoryOuterHashMismatchKeys.length || inventoryContractMismatchKeys.length || inventoryAudit.publishable !== true || inventoryManifestBindingMismatchKeys.length || unexpectedInventoryManifestSkillKeys.length) structuralBlockers.push('revision_pinned_level_up_table_inventory_failed_exact_revalidation');
  if (!equivalenceRecords.length || equivalenceOuterHashMismatchKeys.length || equivalenceContractMismatchKeys.length || equivalenceInvalidKeys.length || duplicateEquivalencePageIds.length || duplicateEquivalenceTargetKeys.length) structuralBlockers.push('unlock_page_equivalence_corpus_failed_exact_revalidation');
  if (duplicateInventoryRelationKeys.length || duplicateEquivalenceRelationKeys.length || missingEquivalenceRelations.length || unexpectedEquivalenceRelations.length || invalidStatementReferenceKeys.length || equivalenceSkillReferenceMismatchKeys.length) structuralBlockers.push('inventory_and_equivalence_statement_target_relations_do_not_match_exactly');
  if (nonZeroMatchWorkQueueKeys.length) structuralBlockers.push('one_or_more_queued_targets_exist_in_unlock_equivalence_page_id_set');
  if (accountStateFindings.length) structuralBlockers.push('current_account_state_present');
  return {
    valid: structuralBlockers.length === 0, compiled, snapshotValidity, sourceAuditValidity,
    workQueueOuterHashMismatchKeys, workQueueIntrinsicHashMismatchKeys, workQueueContractMismatchKeys,
    workQueueChannelMismatchKeys, workQueuePromotionKeys, duplicateWorkQueueKeys, invalidQueueOrdinals,
    crosswalkOuterHashMismatchKeys, crosswalkContractMismatchKeys, stableNoMatchRecords, duplicateStableNoMatchKeys,
    duplicateWorkTargetKeys, missingWorkTargets, unexpectedWorkTargets, sourceCrosswalkBindingMismatchKeys,
    inventoryAudit, inventoryOuterHashMismatchKeys, inventoryContractMismatchKeys, inventoryManifestBindingMismatchKeys,
    unexpectedInventoryManifestSkillKeys, equivalenceOuterHashMismatchKeys, equivalenceContractMismatchKeys,
    equivalenceInvalidKeys, duplicateEquivalencePageIds, duplicateEquivalenceTargetKeys,
    duplicateInventoryRelationKeys, duplicateEquivalenceRelationKeys, missingEquivalenceRelations,
    unexpectedEquivalenceRelations, invalidStatementReferenceKeys, equivalenceSkillReferenceMismatchKeys,
    targetPageIdMatchCounts, nonZeroMatchWorkQueueKeys, corpusEvidence, corpusEvidenceContentHash,
    accountStateFindings, structuralBlockers
  };
}

function corpusSummary(corpus = {}) {
  return {
    definition: corpus.definition, matchBasis: corpus.matchBasis,
    inventorySnapshotContentHash: corpus.inventorySnapshotContentHash,
    equivalenceSnapshotContentHash: corpus.equivalenceSnapshotContentHash,
    officialSkillCount: corpus.skillDomain?.officialSkillCount,
    skillDomainRevision: corpus.skillDomain?.revision,
    levelUpTableSourceSetContentHash: corpus.levelUpTableSourceSetContentHash,
    parameterCount: corpus.parameterCount, emptyParameterCount: corpus.emptyParameterCount,
    capturedStatementCount: corpus.capturedStatementCount,
    statementTargetRelationCount: corpus.statementTargetRelationCount,
    statementTargetRelationSetContentHash: corpus.statementTargetRelationSetContentHash,
    equivalenceTargetReferenceCount: corpus.equivalenceTargetReferenceCount,
    equivalenceStatementReferenceCount: corpus.equivalenceStatementReferenceCount,
    stableWikiPageIdCount: corpus.stableWikiPageIdCount,
    stableWikiPageIdSetContentHash: corpus.stableWikiPageIdSetContentHash
  };
}

function expectedRecord(source, crosswalk, analysis, policy, snapshots, contentHash = hash) {
  const base = {
    contract: policy.outputContract,
    absenceWorkEntryKey: `${source.workQueueEntryKey}|unlock-corpus-absence-reconciliation-work`,
    queueOrdinal: source.queueOrdinal,
    sourceWorkQueueEntryKey: source.workQueueEntryKey,
    sourceWorkQueueRecordContentHash: source.contentHash,
    sourceWorkQueueIntrinsicRecordContentHash: source.recordContentHash,
    sourceWorkQueueSnapshotContentHash: snapshots.workQueue,
    sourceCrosswalkRecordContentHash: crosswalk.contentHash,
    sourceCrosswalkSnapshotContentHash: snapshots.crosswalk,
    renderedTargetKey: source.renderedTargetKey,
    stableWikiPageIdentity: source.stableWikiPageIdentity,
    corpusEvidenceContentHash: analysis.corpusEvidenceContentHash,
    corpusEvidence: corpusSummary(analysis.corpusEvidence),
    matchEvidence: {
      targetSourcePageId: source.stableWikiPageIdentity.sourcePageId,
      matchBasis: policy.matchBasis,
      corpusStableWikiPageIdCount: analysis.corpusEvidence.stableWikiPageIdCount,
      matchingCanonicalWikiPageKeys: [],
      exactStablePageIdMatchCount: 0,
      titleAliasFragmentNamespaceOrSemanticMatchingUsed: false,
      machineObservedZeroMatch: true
    },
    findingScope: {
      machineFinding: policy.machineFinding,
      statement: 'The rendered target stable Wiki page ID does not occur in the resolved stable page-ID set referenced by the complete pinned level-up-table corpus.',
      nonClaims: policy.nonClaims
    },
    reviewDecision: null,
    reviewer: null,
    reviewedAt: null,
    reviewEvidenceKeys: [],
    reviewNotes: null,
    unlockEvidencePresent: false,
    semanticDisposition: null,
    canonicalGameEntityIdentity: null,
    canonicalActivityIdentity: null,
    repeatabilityClassification: null,
    mechanicsReviewComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    blockers: [
      'level_unlock_corpus_absence_reconciliation_review_pending',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'optimizer_eligibility_blocked'
    ],
    state: 'blocked_pending_human_unlock_corpus_absence_reconciliation'
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function expectedRecords(workQueueRecords, analysis, policy, snapshots, contentHash = hash) {
  const crosswalkByKey = new Map(analysis.stableNoMatchRecords.map(row => [row.renderedTargetKey, row]));
  return workQueueRecords.map(source => expectedRecord(source, crosswalkByKey.get(source.renderedTargetKey), analysis, policy, snapshots, contentHash));
}

function blankDecision(record, policy) {
  return {
    contract: policy.decisionTemplateContract,
    absenceWorkEntryKey: record.absenceWorkEntryKey,
    sourceWorkQueueEntryKey: record.sourceWorkQueueEntryKey,
    renderedTargetKey: record.renderedTargetKey,
    targetSourcePageId: record.stableWikiPageIdentity.sourcePageId,
    sourceWorkQueueRecordContentHash: record.sourceWorkQueueRecordContentHash,
    sourceCrosswalkRecordContentHash: record.sourceCrosswalkRecordContentHash,
    corpusEvidenceContentHash: record.corpusEvidenceContentHash,
    disposition: null, reviewer: null, reviewedAt: null, evidenceKeys: [], notes: null
  };
}

function tsv(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

export function renderUnlockCorpusAbsenceReconciliationQueueTsv(records = []) {
  const rows = [['ordinal', 'title', 'page_id', 'source_revision', 'rendered_target_key', 'source_work_queue_entry_key', 'exact_page_id_match_count', 'machine_finding', 'corpus_evidence_hash', 'review_disposition', 'reviewer', 'reviewed_at', 'evidence_keys', 'notes']];
  for (const record of records) rows.push([
    record.queueOrdinal, record.stableWikiPageIdentity?.resolvedTitle, record.stableWikiPageIdentity?.sourcePageId,
    record.stableWikiPageIdentity?.sourceRevision, record.renderedTargetKey, record.sourceWorkQueueEntryKey,
    record.matchEvidence?.exactStablePageIdMatchCount, record.findingScope?.machineFinding,
    record.corpusEvidenceContentHash, '', '', '', '', ''
  ]);
  return rows.map(row => row.map(tsv).join('\t')).join('\n') + '\n';
}

export function renderUnlockCorpusAbsenceReconciliationBlankDecisions(records = [], policy = {}) {
  return records.map(record => json(blankDecision(record, policy))).join('\n') + (records.length ? '\n' : '');
}

export function renderUnlockCorpusEvidenceJson(corpusEvidence = {}) {
  return JSON.stringify(corpusEvidence, null, 2) + '\n';
}

function outputGatesClosed(record = {}) {
  return record.reviewDecision === null && record.reviewer === null && record.reviewedAt === null &&
    Array.isArray(record.reviewEvidenceKeys) && record.reviewEvidenceKeys.length === 0 && record.reviewNotes === null &&
    record.unlockEvidencePresent === false && record.semanticDisposition === null &&
    record.canonicalGameEntityIdentity === null && record.canonicalActivityIdentity === null &&
    record.repeatabilityClassification === null && record.mechanicsReviewComplete === false &&
    record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true;
}

export function buildUnlockCorpusAbsenceReconciliationWorkQueue(input = {}) {
  const analysis = analyzeInputs(input);
  const proposed = analysis.valid ? expectedRecords(input.workQueueRecords, analysis, input.policy, input.snapshots, input.contentHash || hash) : [];
  const artifacts = {
    queueTsv: renderUnlockCorpusAbsenceReconciliationQueueTsv(proposed),
    blankDecisions: renderUnlockCorpusAbsenceReconciliationBlankDecisions(proposed, input.policy),
    corpusEvidenceJson: renderUnlockCorpusEvidenceJson(analysis.corpusEvidence)
  };
  const firstAudit = auditUnlockCorpusAbsenceReconciliationWorkQueue(proposed, { ...input, artifacts });
  if (firstAudit.publishable) return { records: proposed, artifacts, corpusEvidence: analysis.corpusEvidence, audit: firstAudit };
  const emptyArtifacts = {
    queueTsv: renderUnlockCorpusAbsenceReconciliationQueueTsv([]),
    blankDecisions: '',
    corpusEvidenceJson: renderUnlockCorpusEvidenceJson(analysis.corpusEvidence)
  };
  return { records: [], artifacts: emptyArtifacts, corpusEvidence: analysis.corpusEvidence, audit: auditUnlockCorpusAbsenceReconciliationWorkQueue([], { ...input, artifacts: emptyArtifacts }) };
}

export function auditUnlockCorpusAbsenceReconciliationWorkQueue(records = [], input = {}) {
  const contentHash = input.contentHash || hash;
  const analysis = analyzeInputs({ ...input, contentHash });
  const expected = analysis.valid ? expectedRecords(input.workQueueRecords, analysis, input.policy, input.snapshots, contentHash) : [];
  const expectedByKey = new Map(expected.map(row => [row.absenceWorkEntryKey, row]));
  const outputKeys = records.map(row => row.absenceWorkEntryKey);
  const expectedKeys = expected.map(row => row.absenceWorkEntryKey);
  const duplicateOutputKeys = duplicates(outputKeys);
  const missingOutputKeys = expectedKeys.filter(key => !outputKeys.includes(key));
  const unexpectedOutputKeys = outputKeys.filter(key => !expectedKeys.includes(key));
  const recordMismatchKeys = records.filter(row => !same(row, expectedByKey.get(row.absenceWorkEntryKey), contentHash) ||
    !validHash(row.recordContentHash) || row.recordContentHash !== contentHash(without(row, 'recordContentHash'))).map(row => row.absenceWorkEntryKey);
  const nonZeroMatchKeys = records.filter(row => row.matchEvidence?.exactStablePageIdMatchCount !== 0 ||
    row.matchEvidence?.machineObservedZeroMatch !== true || row.matchEvidence?.matchingCanonicalWikiPageKeys?.length ||
    row.matchEvidence?.titleAliasFragmentNamespaceOrSemanticMatchingUsed !== false).map(row => row.absenceWorkEntryKey);
  const reviewStartedKeys = records.filter(row => row.reviewDecision !== null || row.reviewer !== null || row.reviewedAt !== null ||
    row.reviewEvidenceKeys?.length || row.reviewNotes !== null).map(row => row.absenceWorkEntryKey);
  const promotionKeys = records.filter(row => !outputGatesClosed(row)).map(row => row.absenceWorkEntryKey);
  const artifacts = input.artifacts || {};
  const expectedQueueTsv = renderUnlockCorpusAbsenceReconciliationQueueTsv(records);
  const expectedBlankDecisions = renderUnlockCorpusAbsenceReconciliationBlankDecisions(records, input.policy);
  const expectedCorpusJson = renderUnlockCorpusEvidenceJson(analysis.corpusEvidence);
  const artifactMismatches = [];
  if (artifacts.queueTsv !== expectedQueueTsv) artifactMismatches.push('queue.tsv');
  if (artifacts.blankDecisions !== expectedBlankDecisions) artifactMismatches.push('blank-decisions.ndjson');
  if (artifacts.corpusEvidenceJson !== expectedCorpusJson) artifactMismatches.push('corpus-evidence.json');
  const outputAccountStateFindings = findAccountState(records);
  const structuralBlockers = [...analysis.structuralBlockers];
  if (duplicateOutputKeys.length || missingOutputKeys.length || unexpectedOutputKeys.length) structuralBlockers.push('absence_queue_target_set_not_exact');
  if (recordMismatchKeys.length) structuralBlockers.push('one_or_more_absence_queue_records_mismatch_generic_output');
  if (nonZeroMatchKeys.length) structuralBlockers.push('one_or_more_output_records_do_not_preserve_zero_exact_page_id_match');
  if (reviewStartedKeys.length) structuralBlockers.push('review_fields_not_blank_at_queue_export');
  if (promotionKeys.length) structuralBlockers.push('queue_applied_requirement_semantic_mechanical_or_optimizer_promotion');
  if (artifactMismatches.length) structuralBlockers.push('one_or_more_review_artifacts_mismatch_machine_queue');
  if (outputAccountStateFindings.length) structuralBlockers.push('current_account_state_present_in_output');
  const queueExportComplete = input.workQueueRecords?.length > 0 && structuralBlockers.length === 0;
  return {
    contract: input.policy?.auditContract,
    inputCoverage: {
      sourceWorkQueueRecordCount: input.workQueueRecords?.length || 0,
      crosswalkRecordCount: input.crosswalkRecords?.length || 0,
      stableNoMatchCrosswalkRecordCount: analysis.stableNoMatchRecords.length,
      inventorySkillRecordCount: input.inventoryRecords?.length || 0,
      equivalenceRecordCount: input.equivalenceRecords?.length || 0
    },
    policyCoverage: {
      policyValid: analysis.compiled.valid, contractsValid: analysis.compiled.contractsValid,
      vocabularyValid: analysis.compiled.vocabularyValid, invalidRules: analysis.compiled.invalidRules,
      forbiddenPolicyPaths: analysis.compiled.forbiddenPolicyPaths
    },
    snapshotCoverage: { snapshotContentHashValid: analysis.snapshotValidity, sourceAuditGatesValid: analysis.sourceAuditValidity },
    sourceQueueCoverage: {
      invalidOuterHashKeys: analysis.workQueueOuterHashMismatchKeys,
      invalidIntrinsicHashKeys: analysis.workQueueIntrinsicHashMismatchKeys,
      contractMismatchKeys: analysis.workQueueContractMismatchKeys,
      requiredChannelMismatchKeys: analysis.workQueueChannelMismatchKeys,
      unsupportedPromotionKeys: analysis.workQueuePromotionKeys,
      duplicateWorkQueueKeys: analysis.duplicateWorkQueueKeys,
      invalidQueueOrdinalKeys: analysis.invalidQueueOrdinals
    },
    crosswalkCoverage: {
      invalidOuterHashKeys: analysis.crosswalkOuterHashMismatchKeys,
      contractMismatchKeys: analysis.crosswalkContractMismatchKeys,
      duplicateStableNoMatchKeys: analysis.duplicateStableNoMatchKeys,
      duplicateWorkTargetKeys: analysis.duplicateWorkTargetKeys,
      missingWorkTargets: analysis.missingWorkTargets,
      unexpectedWorkTargets: analysis.unexpectedWorkTargets,
      sourceCrosswalkBindingMismatchKeys: analysis.sourceCrosswalkBindingMismatchKeys,
      exactStableNoMatchTargetSetAndBindings: !analysis.duplicateStableNoMatchKeys.length && !analysis.duplicateWorkTargetKeys.length && !analysis.missingWorkTargets.length && !analysis.unexpectedWorkTargets.length && !analysis.sourceCrosswalkBindingMismatchKeys.length
    },
    inventoryCoverage: {
      invalidOuterHashSkillKeys: analysis.inventoryOuterHashMismatchKeys,
      contractMismatchSkillKeys: analysis.inventoryContractMismatchKeys,
      manifestBindingMismatchSkillKeys: analysis.inventoryManifestBindingMismatchKeys,
      unexpectedManifestSkillKeys: analysis.unexpectedInventoryManifestSkillKeys,
      officialSkillCount: analysis.inventoryAudit.officialSkillDomain?.inventorySkillCount || 0,
      revisionPinnedPageCount: analysis.inventoryAudit.sourcePageCoverage?.revisionPinnedPages || 0,
      parameterCount: analysis.inventoryAudit.statementCoverage?.parameterCount || 0,
      emptyParameterCount: analysis.inventoryAudit.statementCoverage?.emptyParameterCount || 0,
      capturedStatementCount: analysis.inventoryAudit.statementCoverage?.capturedStatementCount || 0,
      rawInventoryComplete: analysis.inventoryAudit.rawInventoryComplete === true
    },
    equivalenceCoverage: {
      invalidOuterHashKeys: analysis.equivalenceOuterHashMismatchKeys,
      contractMismatchKeys: analysis.equivalenceContractMismatchKeys,
      invalidRecordKeys: analysis.equivalenceInvalidKeys,
      duplicateStablePageIds: analysis.duplicateEquivalencePageIds,
      duplicateTargetKeys: analysis.duplicateEquivalenceTargetKeys,
      targetReferenceCount: analysis.corpusEvidence.equivalenceTargetReferenceCount,
      statementReferenceCount: analysis.corpusEvidence.equivalenceStatementReferenceCount,
      stableWikiPageIdCount: analysis.corpusEvidence.stableWikiPageIdCount
    },
    corpusBindingCoverage: {
      duplicateInventoryRelationKeys: analysis.duplicateInventoryRelationKeys,
      duplicateEquivalenceRelationKeys: analysis.duplicateEquivalenceRelationKeys,
      missingEquivalenceRelations: analysis.missingEquivalenceRelations,
      unexpectedEquivalenceRelations: analysis.unexpectedEquivalenceRelations,
      invalidStatementReferenceKeys: analysis.invalidStatementReferenceKeys,
      equivalenceSkillReferenceMismatchKeys: analysis.equivalenceSkillReferenceMismatchKeys,
      exactInventoryToEquivalenceStatementTargetRelationSet: !analysis.duplicateInventoryRelationKeys.length && !analysis.duplicateEquivalenceRelationKeys.length && !analysis.missingEquivalenceRelations.length && !analysis.unexpectedEquivalenceRelations.length && !analysis.invalidStatementReferenceKeys.length && !analysis.equivalenceSkillReferenceMismatchKeys.length,
      corpusEvidenceContentHash: analysis.corpusEvidenceContentHash
    },
    absenceCoverage: {
      outputRecordCount: records.length,
      duplicateOutputKeys, missingOutputKeys, unexpectedOutputKeys, recordMismatchKeys,
      nonZeroMatchSourceWorkQueueKeys: analysis.nonZeroMatchWorkQueueKeys,
      nonZeroMatchOutputKeys: nonZeroMatchKeys,
      zeroExactStablePageIdMatchCount: records.filter(row => row.matchEvidence?.exactStablePageIdMatchCount === 0).length,
      orderMatchesSourceQueue: same(records.map(row => row.sourceWorkQueueEntryKey), input.workQueueRecords?.map(row => row.workQueueEntryKey) || [], contentHash)
    },
    artifactCoverage: {
      queueTsvContentHash: contentHash(artifacts.queueTsv || ''),
      blankDecisionsContentHash: contentHash(artifacts.blankDecisions || ''),
      corpusEvidenceJsonContentHash: contentHash(artifacts.corpusEvidenceJson || ''),
      artifactMismatchFiles: artifactMismatches
    },
    reviewCoverage: {
      blankDecisionTemplateCount: records.length,
      reviewStartedCount: reviewStartedKeys.length,
      reviewStartedKeys,
      completedReconciliationCount: 0
    },
    semanticPreservationCoverage: {
      noRequirementClaimCount: 0,
      semanticDispositionCount: records.filter(row => row.semanticDisposition !== null).length,
      canonicalGameEntityIdentityCount: records.filter(row => row.canonicalGameEntityIdentity !== null).length,
      canonicalActivityIdentityCount: records.filter(row => row.canonicalActivityIdentity !== null).length,
      repeatabilityClassifiedCount: records.filter(row => row.repeatabilityClassification !== null).length,
      mechanicsReviewCompleteCount: records.filter(row => row.mechanicsReviewComplete === true).length,
      optimizerEligibleCount: records.filter(row => row.optimizerEligible === true).length,
      automaticVerificationCount: records.filter(row => row.automaticVerificationApplied === true).length,
      unsupportedPromotionKeys: promotionKeys
    },
    accountStateFindings: unique([...analysis.accountStateFindings, ...outputAccountStateFindings].map(value => json(value))).map(value => JSON.parse(value)),
    queueExportComplete,
    absenceReconciliationComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      'level_unlock_corpus_absence_reconciliation_human_review_pending',
      'absence_from_level_up_table_link_corpus_does_not_prove_no_requirement',
      'source_scoped_semantic_relevance_disposition_pending',
      'canonical_game_entity_and_activity_identity_not_established',
      'repeatability_requirements_variants_xp_timing_and_mechanics_not_proven',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable: queueExportComplete
  };
}
