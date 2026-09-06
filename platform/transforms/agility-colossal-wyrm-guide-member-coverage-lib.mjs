import { hash } from '../ingestion/lib.mjs';

const unique = values => [...new Set(values)];
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));

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

export function auditAgilityColossalWyrmGuideMemberCoverage({ members = [], guideCandidates = [], reconciliation = [] }) {
  const reconciliationProvided = reconciliation.length > 0;
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
