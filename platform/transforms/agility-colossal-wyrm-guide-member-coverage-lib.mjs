import { hash, json } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const EXPECTED_OBSTACLE_VARIANT_KEYS = [
  'colossal-wyrm:ladder:1', 'colossal-wyrm:ladder:2', 'colossal-wyrm:ladder:3',
  'colossal-wyrm:tightrope:1', 'colossal-wyrm:tightrope:2', 'colossal-wyrm:tightrope:3',
  'colossal-wyrm:edge:1', 'colossal-wyrm:edge:2', 'colossal-wyrm:edge:3',
  'colossal-wyrm:rope:1', 'colossal-wyrm:rope:2',
  'colossal-wyrm:zipline:basic', 'colossal-wyrm:zipline:advanced'
];
const BASIC_LAP_XP_SUPERSEDED_BLOCKER = 'basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6';
const BASIC_LAP_XP_REFINED_BLOCKER = 'basic_lap_xp_633_prose_conflicts_with_601_6_eight_row_sum_at_current_revision_15331454';
const recordsHash = records => hash(`${records.map(record => json(record)).join('\n')}\n`);

function reconciliationRecordHashesValid(record) {
  return record.recordContentHash === hash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === hash(without(record, ['contentHash']));
}

function reconciliationBlockers(record) {
  const blockers = [];
  if (record.contract !== 'sensum.agility-colossal-wyrm-post-update-mechanics-reconciliation.v1') blockers.push('post_update_reconciliation_contract_mismatch');
  if (record.updateDate !== '2026-08-12') blockers.push('post_update_reconciliation_date_mismatch');
  if (!reconciliationRecordHashesValid(record)) blockers.push('post_update_reconciliation_record_hash_invalid');
  if (record.temporalAssignmentComplete !== true) blockers.push('post_update_temporal_assignment_incomplete');
  if (record.mechanicalAuthorityComplete !== false) blockers.push('post_update_reconciliation_invalid_mechanical_authority_state');
  if (record.optimizerEligible !== false || record.verifiedBestAuthorized !== false || record.automaticVerificationApplied !== false) blockers.push('post_update_reconciliation_invalid_optimizer_or_verification_promotion');
  if (record.accountIndependent !== true) blockers.push('post_update_reconciliation_not_account_independent');
  if (!Array.isArray(record.remainingBlockers) || !record.remainingBlockers.length) blockers.push('post_update_reconciliation_did_not_preserve_mechanical_blockers');
  return blockers;
}

function obstacleVariantRecordHashesValid(record) {
  return record.recordContentHash === hash(without(record, ['recordContentHash', 'contentHash']))
    && record.contentHash === hash(without(record, ['contentHash']));
}

function obstacleVariantSetBlockers(records, reconciliation) {
  const blockers = [];
  const keys = records.map(record => record.variantKey);
  const routeOccurrences = records.flatMap(record => record.courseOccurrences || []);
  const preUpdateOccurrences = records.flatMap(record => record.preUpdateCourseOccurrences || []);
  const allowedRouteKeys = new Set(['basic_route', 'advanced_route']);
  if (records.length !== EXPECTED_OBSTACLE_VARIANT_KEYS.length
    || new Set(keys).size !== EXPECTED_OBSTACLE_VARIANT_KEYS.length
    || EXPECTED_OBSTACLE_VARIANT_KEYS.some(key => !keys.includes(key))) blockers.push('obstacle_variant_expected_identity_set_incomplete');
  if (records.some(record => record.contract !== 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation.v1')) blockers.push('obstacle_variant_contract_mismatch');
  if (records.some(record => !obstacleVariantRecordHashesValid(record))) blockers.push('obstacle_variant_record_hash_invalid');
  if (records.some(record => record.identityReconciliationComplete !== true
    || record.currentPageFieldsMatchPinnedPreUpdateRevision !== true)) blockers.push('obstacle_variant_identity_reconciliation_incomplete');
  if (records.some(record => record.mechanicalAuthorityComplete !== false
    || record.optimizerEligible !== false
    || record.verifiedBestAuthorized !== false
    || record.automaticVerificationApplied !== false
    || record.accountIndependent !== true)) blockers.push('obstacle_variant_invalid_authority_or_account_state');
  if (records.some(record => !record.remainingBlockersByRoute
    || Object.entries(record.remainingBlockersByRoute).some(([route, values]) => !allowedRouteKeys.has(route) || !Array.isArray(values)))) blockers.push('obstacle_variant_precise_blocker_shape_invalid');
  if (routeOccurrences.length !== 16
    || routeOccurrences.filter(row => row.routePolicy === 'basic_route').length !== 8
    || routeOccurrences.filter(row => row.routePolicy === 'advanced_route').length !== 8
    || preUpdateOccurrences.length !== 16
    || preUpdateOccurrences.filter(row => row.routePolicy === 'basic_route').length !== 8
    || preUpdateOccurrences.filter(row => row.routePolicy === 'advanced_route').length !== 8) blockers.push('obstacle_variant_route_occurrence_coverage_incomplete');
  const temporalCourseRevisions = unique(reconciliation.map(record => record.sourceRevisions?.currentCourse?.revision).filter(Boolean));
  const obstacleCourseRevisions = unique(records.map(record => record.sourceRevisions?.currentCourse?.revision).filter(Boolean));
  const temporalSnapshotHashes = unique(records.map(record => record.sourceRevisions?.inputTemporalReconciliation?.contentHash).filter(Boolean));
  if (temporalCourseRevisions.length !== 1 || obstacleCourseRevisions.length !== 1 || obstacleCourseRevisions[0] !== temporalCourseRevisions[0]) blockers.push('obstacle_variant_current_course_revision_mismatch');
  if (temporalSnapshotHashes.length !== 1 || !/^[a-f0-9]{64}$/.test(temporalSnapshotHashes[0] || '')) blockers.push('obstacle_variant_temporal_snapshot_binding_invalid');
  return unique(blockers);
}

function basicLapXpConflictSetBlockers(records, reconciliation, obstacleVariants) {
  const blockers = [];
  const record = records[0];
  if (records.length !== 1) blockers.push('basic_lap_xp_expected_single_record');
  if (!record || record.contract !== 'sensum.agility-colossal-wyrm-basic-lap-xp-conflict-reconciliation.v1') blockers.push('basic_lap_xp_conflict_contract_mismatch');
  if (record && !reconciliationRecordHashesValid(record)) blockers.push('basic_lap_xp_conflict_record_hash_invalid');
  if (record?.memberKey !== 'colossal-wyrm:basic-route' || record?.routePolicy !== 'basic_route') blockers.push('basic_lap_xp_conflict_route_identity_mismatch');
  if (record?.timelineReconciliationComplete !== true || record?.conflictResolved !== false
    || record?.mechanicalAuthorityComplete !== false || record?.optimizerEligible !== false
    || record?.verifiedBestAuthorized !== false || record?.automaticVerificationApplied !== false
    || record?.accountIndependent !== true) blockers.push('basic_lap_xp_conflict_invalid_authority_or_account_state');
  if (record?.supersededBlocker !== BASIC_LAP_XP_SUPERSEDED_BLOCKER
    || record?.remainingBlockers?.length !== 1
    || record?.remainingBlockers?.[0] !== BASIC_LAP_XP_REFINED_BLOCKER) blockers.push('basic_lap_xp_conflict_blocker_replacement_invalid');
  if (record?.inputSnapshots?.temporalReconciliation?.records !== reconciliation.length
    || record?.inputSnapshots?.temporalReconciliation?.contentHash !== recordsHash(reconciliation)) blockers.push('basic_lap_xp_temporal_snapshot_binding_invalid');
  if (record?.inputSnapshots?.obstacleVariantReconciliation?.records !== obstacleVariants.length
    || record?.inputSnapshots?.obstacleVariantReconciliation?.contentHash !== recordsHash(obstacleVariants)) blockers.push('basic_lap_xp_obstacle_snapshot_binding_invalid');
  const temporalCourseRevisions = unique(reconciliation.map(row => row.sourceRevisions?.currentCourse?.revision).filter(Boolean));
  if (temporalCourseRevisions.length !== 1 || record?.sourceRevisions?.currentCourse?.revision !== temporalCourseRevisions[0]) blockers.push('basic_lap_xp_current_course_revision_mismatch');
  return unique(blockers);
}

export function auditAgilityColossalWyrmGuideMemberCoverage({ members = [], guideCandidates = [], reconciliation = [], obstacleVariants = [], basicLapXpConflict = [] }) {
  const reconciliationProvided = reconciliation.length > 0;
  const obstacleVariantsProvided = obstacleVariants.length > 0;
  const obstacleVariantSetValidationBlockers = obstacleVariantsProvided ? obstacleVariantSetBlockers(obstacleVariants, reconciliation) : [];
  const obstacleVariantSetValid = obstacleVariantsProvided && obstacleVariantSetValidationBlockers.length === 0;
  const basicLapXpConflictProvided = basicLapXpConflict.length > 0;
  const basicLapXpConflictSetValidationBlockers = basicLapXpConflictProvided
    ? basicLapXpConflictSetBlockers(basicLapXpConflict, reconciliation, obstacleVariants)
    : [];
  const basicLapXpConflictSetValid = basicLapXpConflictProvided && basicLapXpConflictSetValidationBlockers.length === 0;
  const guideRevisions = unique(members.map(member => member.guideSourceRevision).filter(Boolean));
  const sectionKeys = unique(members.map(member => member.sectionKey).filter(Boolean));
  const sectionKey = sectionKeys[0] || null;
  const sectionCandidates = guideCandidates.filter(candidate => candidate.source_section_key === sectionKey);

  const memberDetails = members.map(member => {
    const candidates = sectionCandidates.filter(candidate => candidate.candidate_key === member.candidateKey);
    const reconciliations = reconciliation.filter(record => record.memberKey === member.memberKey);
    const identityBlockers = [];
    if (candidates.length !== 1) identityBlockers.push(candidates.length ? 'duplicate_same_revision_guide_candidates' : 'same_revision_guide_candidate_missing');
    if (candidates.some(candidate => candidate.source_revision !== member.guideSourceRevision)) identityBlockers.push('guide_candidate_revision_mismatch');
    if (candidates.some(candidate => candidate.minimum_agility !== member.minimumAgility)) identityBlockers.push('guide_candidate_minimum_agility_mismatch');
    if (member.corroboratingMinimumAgility?.some(level => level !== member.minimumAgility)) identityBlockers.push('cross_source_minimum_agility_mismatch');

    let postUpdateReconciliation = null;
    let obstacleVariantReconciliation = null;
    let basicLapXpConflictReconciliation = null;
    let mechanicalBlockers = member.mechanicalBlockers || [];
    if (reconciliationProvided) {
      if (reconciliations.length !== 1) {
        identityBlockers.push(reconciliations.length ? 'duplicate_post_update_reconciliation_records' : 'post_update_reconciliation_record_missing');
        mechanicalBlockers = unique([...mechanicalBlockers, 'post_update_reconciliation_unavailable']);
      } else {
        const record = reconciliations[0];
        if (record.routePolicy !== member.routePolicy) identityBlockers.push('post_update_reconciliation_route_policy_mismatch');
        if (record.minimumAgility !== member.minimumAgility) identityBlockers.push('post_update_reconciliation_minimum_agility_mismatch');
        const recordBlockers = reconciliationBlockers(record);
        identityBlockers.push(...recordBlockers);
        mechanicalBlockers = recordBlockers.length ? unique([...mechanicalBlockers, ...recordBlockers]) : [...record.remainingBlockers];
        postUpdateReconciliation = {
          contract: record.contract,
          updateDate: record.updateDate,
          routePolicy: record.routePolicy,
          sourceRevisions: record.sourceRevisions,
          temporalAssignmentComplete: record.temporalAssignmentComplete,
          mechanicalAuthorityComplete: record.mechanicalAuthorityComplete,
          courseObstacleTable: record.courseObstacleTable,
          claimDispositions: record.claimDispositions,
          recordContentHash: record.recordContentHash,
          contentHash: record.contentHash
        };
      }
    }

    if (obstacleVariantsProvided) {
      if (!obstacleVariantSetValid) {
        identityBlockers.push(...obstacleVariantSetValidationBlockers);
        mechanicalBlockers = unique([...mechanicalBlockers, 'obstacle_page_variant_reconciliation_unavailable']);
      } else if (reconciliations.length !== 1
        || reconciliationBlockers(reconciliations[0]).length
        || reconciliations[0].routePolicy !== member.routePolicy
        || reconciliations[0].minimumAgility !== member.minimumAgility) {
        identityBlockers.push('obstacle_variant_reconciliation_requires_valid_route_temporal_reconciliation');
        mechanicalBlockers = unique([...mechanicalBlockers, 'obstacle_page_variant_reconciliation_unavailable']);
      } else {
        const genericBlocker = `${member.routePolicy.replace('_route', '')}_current_obstacle_pages_not_reconciled_with_course_table`;
        const routeBlockers = unique(obstacleVariants.flatMap(record => record.remainingBlockersByRoute?.[member.routePolicy] || []));
        mechanicalBlockers = unique([...mechanicalBlockers.filter(blocker => blocker !== genericBlocker), ...routeBlockers]);
        obstacleVariantReconciliation = {
          contract: 'sensum.agility-colossal-wyrm-obstacle-page-variant-reconciliation.v1',
          variantCount: obstacleVariants.length,
          routeOccurrenceCount: obstacleVariants.flatMap(record => record.courseOccurrences || []).filter(row => row.routePolicy === member.routePolicy).length,
          genericBlockerReplaced: !mechanicalBlockers.includes(genericBlocker),
          preciseRemainingBlockers: routeBlockers,
          mechanicalAuthorityComplete: false
        };
      }
    }

    if (basicLapXpConflictProvided && member.routePolicy === 'basic_route') {
      if (!basicLapXpConflictSetValid) {
        identityBlockers.push(...basicLapXpConflictSetValidationBlockers);
        mechanicalBlockers = unique([...mechanicalBlockers, 'basic_lap_xp_conflict_reconciliation_unavailable']);
      } else if (!obstacleVariantSetValid || reconciliations.length !== 1 || reconciliationBlockers(reconciliations[0]).length) {
        identityBlockers.push('basic_lap_xp_conflict_requires_valid_temporal_and_obstacle_reconciliations');
        mechanicalBlockers = unique([...mechanicalBlockers, 'basic_lap_xp_conflict_reconciliation_unavailable']);
      } else {
        const record = basicLapXpConflict[0];
        mechanicalBlockers = unique([
          ...mechanicalBlockers.filter(blocker => blocker !== record.supersededBlocker),
          ...record.remainingBlockers
        ]);
        basicLapXpConflictReconciliation = {
          contract: record.contract,
          revisionCount: record.revisionChain.revisionCount,
          firstDivergenceRevision: record.firstDivergenceState.revision,
          firstCurrentConflictRevision: record.firstCurrentConflictState.revision,
          currentProseLapXp: record.currentState.proseLapXp,
          currentTableSumXp: record.currentState.tableSumXp,
          conflictResolved: false,
          supersededBlockerReplaced: !mechanicalBlockers.includes(record.supersededBlocker),
          preciseRemainingBlockers: record.remainingBlockers,
          contentHash: record.contentHash
        };
      }
    }

    return {
      memberKey: member.memberKey,
      candidateKey: member.candidateKey,
      name: member.name,
      sourceOrder: member.sourceOrder,
      routePolicy: member.routePolicy,
      minimumAgility: member.minimumAgility,
      guideCandidateKeys: candidates.map(candidate => candidate.candidate_key),
      sourceRevisions: member.sourceRevisions,
      coursePageMarkedObsolete: member.coursePageMarkedObsolete,
      rateClaims: member.rateClaims,
      lapXpClaims: member.lapXpClaims,
      timingClaims: member.timingClaims,
      priorMechanicalBlockers: reconciliationProvided ? member.mechanicalBlockers || [] : undefined,
      mechanicalBlockers,
      postUpdateReconciliation,
      obstacleVariantReconciliation,
      basicLapXpConflictReconciliation,
      sourceLocators: member.sourceLocators,
      status: identityBlockers.length ? 'route_identity_blocked' : 'route_identity_covered',
      identityBlockers
    };
  });

  const expected = new Set(members.map(member => member.candidateKey));
  const unexpectedSectionCandidateKeys = unique(sectionCandidates.filter(candidate => !expected.has(candidate.candidate_key)).map(candidate => candidate.candidate_key));
  const unexpectedReconciliationMemberKeys = reconciliationProvided ? unique(reconciliation.filter(record => !members.some(member => member.memberKey === record.memberKey)).map(record => record.memberKey)) : [];
  const uncovered = memberDetails.filter(member => member.identityBlockers.length);
  const identityBlockers = [];
  if (guideRevisions.length !== 1) identityBlockers.push('guide_member_revision_scope_invalid');
  if (sectionKeys.length !== 1) identityBlockers.push('guide_member_section_scope_invalid');
  if (members.length !== 2) identityBlockers.push('expected_two_colossal_wyrm_route_members');
  if (uncovered.length) identityBlockers.push('one_or_more_colossal_wyrm_routes_lack_exact_same_revision_candidate');
  if (unexpectedSectionCandidateKeys.length) identityBlockers.push('guide_section_candidate_not_present_in_route_inventory');
  if (unexpectedReconciliationMemberKeys.length) identityBlockers.push('post_update_reconciliation_member_not_present_in_route_inventory');

  const internalMemberAuditSatisfied = identityBlockers.length === 0;
  const mechanicalBlockers = unique(memberDetails.flatMap(member => member.mechanicalBlockers));
  const postUpdateTemporalReconciliationApplied = reconciliationProvided
    && reconciliation.length === members.length
    && memberDetails.every(member => member.postUpdateReconciliation?.temporalAssignmentComplete === true);
  const obstacleVariantReconciliationApplied = obstacleVariantSetValid
    && memberDetails.every(member => member.obstacleVariantReconciliation?.genericBlockerReplaced === true);
  const basicLapXpConflictReconciliationApplied = basicLapXpConflictSetValid
    && memberDetails.filter(member => member.routePolicy === 'basic_route')
      .every(member => member.basicLapXpConflictReconciliation?.supersededBlockerReplaced === true);
  const mechanicalCompletenessProven = internalMemberAuditSatisfied && mechanicalBlockers.length === 0;

  return {
    contract: 'sensum.agility-colossal-wyrm-guide-member-coverage-audit.v1',
    sectionKey,
    guideSourceRevision: guideRevisions.length === 1 ? guideRevisions[0] : null,
    memberCount: members.length,
    coveredMemberCount: memberDetails.length - uncovered.length,
    uncoveredMemberCount: uncovered.length,
    routeIdentityCoverageOnly: !reconciliationProvided,
    postUpdateTemporalReconciliationApplied,
    reconciliationRecordCount: reconciliation.length,
    obstacleVariantReconciliationApplied,
    obstacleVariantRecordCount: obstacleVariants.length,
    obstacleVariantSetValidationBlockers,
    basicLapXpConflictReconciliationApplied,
    basicLapXpConflictRecordCount: basicLapXpConflict.length,
    basicLapXpConflictSetValidationBlockers,
    internalMemberAuditSatisfied,
    mechanicalCompletenessProven,
    memberDetails,
    unexpectedSectionCandidateKeys,
    unexpectedReconciliationMemberKeys,
    identityBlockers,
    mechanicalBlockers,
    blockers: [...identityBlockers, ...mechanicalBlockers],
    absoluteBestGate: mechanicalCompletenessProven ? 'eligible_for_performance_review' : 'blocked_conflicting_or_obsolete_colossal_wyrm_mechanics'
  };
}
