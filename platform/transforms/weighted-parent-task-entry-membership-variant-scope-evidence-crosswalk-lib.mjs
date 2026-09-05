import { hash } from '../ingestion/lib.mjs';

const REQUIRED_RULES = [
  'matchOnlyByExactStructuralCandidateKey',
  'candidateRoleAndPinnedSubjectAndParentIdentitiesMustMatch',
  'exactVariantReviewSourceRevisionSetMustMatchExactly',
  'singleVariantIdentityReviewMustExplicitlyScopeOneRootInfoboxVariant',
  'canonicalSubjectReviewMustContainEveryInputQueueRevision',
  'oneExistingEvidenceChannelAtMostPerCandidate',
  'everyInputQueueEntryProducesExactlyOneCrosswalkRecordInQueueOrder',
  'existingEvidenceMayBeReusedButNeverTreatedAsAReviewDecision',
  'proposedVariantIndexMayBeRetainedOnlyAsUnboundEvidence',
  'noVariantMayBeSelectedOrBound',
  'crosswalkCannotApplyMembershipIdentityMappingCompletenessRepeatabilityRequirementsXpTimingMechanicsOrOptimizerVerdicts',
  'namesTitlesPageIdsRevisionsLabelsAliasesAndOverridesCannotAlterMatchPolicy',
  'currentAccountStateIsForbidden'
];
const CLASSIFICATIONS = [
  'reusable_exact_variant_binding_review_evidence_pending_human_decision',
  'reusable_single_infobox_variant_identity_review_evidence_pending_human_decision',
  'reusable_canonical_subject_scope_evidence_exact_variant_still_unresolved',
  'no_compatible_existing_variant_scope_evidence'
];
const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const without = (value, ...keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:pageId|pageIds|revision|revisions|title|titles|candidateKey|candidateKeys|structuralCandidateKey|structuralCandidateKeys|label|labels|alias|aliases|override|overrides)$/i;
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  walk(policy);
  return unique(findings).sort();
}

export function compileWeightedMembershipVariantScopeEvidenceCrosswalkPolicy(policy = {}) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const contractValid = policy.inputQueueContract === 'sensum.weighted-parent-task-entry-membership-variant-scope-evidence-work-queue-entry.v1'
    && policy.exactVariantReviewContract === 'sensum.multi-variant-binding-review-queue-entry.v1'
    && policy.singleVariantIdentityReviewContract === 'sensum.structural-member-candidate-identity-review-queue-entry.v1'
    && policy.canonicalSubjectReviewContract === 'sensum.multi-variant-binding-canonical-subject-scope-review-queue-entry.v1'
    && policy.outputContract === 'sensum.weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk.v1'
    && policy.auditContract === 'sensum.weighted-parent-task-entry-membership-variant-scope-evidence-crosswalk-audit.v1'
    && policy.inputQueueState === 'blocked_pending_numbered_alias_or_variant_scope_evidence'
    && policy.exactVariantReviewState === 'pending_explicit_source_bound_variant_binding_review'
    && policy.singleVariantIdentityReviewState === 'pending_explicit_source_bound_candidate_identity_review'
    && policy.canonicalSubjectReviewState === 'pending_explicit_source_bound_canonical_subject_scope_review';
  const classificationsValid = same(policy.classifications || [], CLASSIFICATIONS);
  const forbidden = forbiddenPolicyPaths(policy);
  return { valid: contractValid && classificationsValid && !invalidRules.length && !forbidden.length, contractValid, classificationsValid, invalidRules: unique(invalidRules), forbiddenPolicyPaths: forbidden };
}

function accountStateFindings(values = []) {
  const forbidden = /^(?:currentBaseLevel|currentLevel|currentXp|username|accountName|bank|bankItems|ownedEquipment|currentAccount)$/i;
  const findings = [];
  const walk = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => walk(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      walk(child, next);
    }
  };
  values.forEach((value, index) => walk(value, `[${index}]`));
  return findings;
}

function identityKey(identity = {}) {
  return `${identity.sourcePageId}|${identity.sourceRevision}|${identity.sourceContentHash}`;
}

function inputIntegrity(record = {}, policy = {}, contentHash = hash) {
  const identities = record.evidenceSourceIdentities || [];
  const revisions = unique(identities.map(identity => String(identity.sourceRevision))).sort();
  const checks = {
    contractAndState: record.contract === policy.inputQueueContract && record.state === policy.inputQueueState,
    recordHash: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    keyAndOrdinal: typeof record.structuralCandidateKey === 'string' && record.structuralCandidateKey.length > 0 && Number.isInteger(record.queueOrdinal) && record.queueOrdinal > 0,
    sourceIdentities: identities.length >= 2 && identities.every(identity => Number(identity.sourcePageId) > 0 && String(identity.sourceRevision).length > 0 && validHash(identity.sourceContentHash)),
    requiredRoles: identities.some(identity => identity.roles?.includes('candidate_subject_source')) && identities.some(identity => identity.roles?.includes('parent_inventory_source')),
    revisionScope: same(sorted(record.sourceRevisions || []), revisions, contentHash),
    parentOccurrence: record.variantScopeEvidence?.parentOccurrence?.integrity?.complete === true,
    routeAndChannels: record.variantScopeEvidence?.route === 'numbered_alias_or_variant_scope_evidence_required' && (record.requiredEvidenceChannels || []).includes('exact_candidate_name_or_variant_scope_binding'),
    gatesClosed: record.reviewCandidateVariantIndex === null && record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false && record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { complete: Object.values(checks).every(Boolean), checks };
}

function exactReviewIntegrity(record = {}, policy = {}, contentHash = hash) {
  const review = record.variantBindingReviewEvidence || {};
  const base = without(record, 'entryContentHash', 'contentHash');
  const checks = {
    contractAndState: record.contract === policy.exactVariantReviewContract && record.state === policy.exactVariantReviewState,
    entryHash: validHash(record.entryContentHash) && contentHash(base) === record.entryContentHash,
    snapshotHash: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    keyPresent: typeof record.structuralCandidateKey === 'string' && record.structuralCandidateKey.length > 0,
    uniqueProposedIndex: Number.isInteger(review.reviewCandidateVariantIndex) && review.reviewCandidateVariantIndex > 0 && same(review.matchingVariantIndices || [], [review.reviewCandidateVariantIndex], contentHash),
    evidenceState: review.sourceBindingEvidenceState === 'unique_exact_parent_display_to_numbered_name_match_review_pending',
    revisionsPresent: (record.reviewScope?.sourceRevisions || []).length >= 2,
    gatesClosed: record.bindingReviewDecision === null && record.boundVariantIndex === null && review.bindingReviewDecision === null && review.boundVariantIndex === null && record.candidateMemberIdentityVerdict === null && record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false && record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { complete: Object.values(checks).every(Boolean), checks };
}

function singleVariantReviewIntegrity(record = {}, policy = {}, contentHash = hash) {
  const root = record.subjectEvidence?.rootInfobox || {};
  const names = root.sourceAuthoredNameFields || [];
  const base = without(record, 'entryContentHash', 'contentHash');
  const checks = {
    contractAndState: record.contract === policy.singleVariantIdentityReviewContract && record.state === policy.singleVariantIdentityReviewState,
    entryHash: validHash(record.entryContentHash) && contentHash(base) === record.entryContentHash,
    snapshotHash: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    keyPresent: typeof record.structuralCandidateKey === 'string' && record.structuralCandidateKey.length > 0,
    oneRootName: names.length === 1 && names[0].name === 'name' && typeof names[0].value === 'string' && names[0].value.length > 0,
    explicitSingleVariantScope: record.reviewScope?.decisionScope === 'exact_candidate_to_revision_pinned_source_page_subject_identity_and_single_infobox_variant',
    revisionsPresent: (record.reviewScope?.sourceRevisions || []).length >= 2,
    gatesClosed: record.decisionTemplate?.decision === null && record.candidateMemberIdentityVerdict === undefined
      && record.weightedTaskEntryMembershipVerdict === undefined && record.optimizerEligible === undefined
      && record.accountIndependent === true
  };
  return { complete: Object.values(checks).every(Boolean), checks };
}

function canonicalReviewIntegrity(record = {}, policy = {}, contentHash = hash) {
  const checks = {
    contractAndState: record.contract === policy.canonicalSubjectReviewContract && record.state === policy.canonicalSubjectReviewState,
    recordHash: validHash(record.recordContentHash) && contentHash(without(record, 'recordContentHash', 'contentHash')) === record.recordContentHash,
    snapshotHash: validHash(record.contentHash) && contentHash(without(record, 'contentHash')) === record.contentHash,
    keyPresent: typeof record.structuralCandidateKey === 'string' && record.structuralCandidateKey.length > 0,
    revisionsPresent: (record.reviewScope?.sourceRevisions || []).length >= 2,
    canonicalOnly: record.canonicalSubjectContextEvidenceState === 'observed_for_explicit_scope_review'
      && record.exactNumberedVariantAlignmentEvidenceState === 'not_observed',
    gatesClosed: record.reviewDecision === null && record.reviewCandidateVariantIndex === null && record.bindingReviewDecision === null && record.boundVariantIndex === null && record.candidateMemberIdentityVerdict === null && record.weightedTaskEntryMembershipVerdict === null && record.memberUniverseComplete === false && record.optimizerEligible === false && record.automaticVerificationApplied === false && record.accountIndependent === true
  };
  return { complete: Object.values(checks).every(Boolean), checks };
}

function identitiesMatch(input, existing, canonical = false, contentHash = hash) {
  const inputKeys = new Set((input.evidenceSourceIdentities || []).map(identityKey));
  if (canonical) {
    const existingKeys = new Set((existing.evidenceSourceIdentities || []).map(identityKey));
    return [...inputKeys].every(key => existingKeys.has(key)) && (input.sourceRevisions || []).every(revision => existing.reviewScope?.sourceRevisions?.map(String).includes(String(revision)));
  }
  const subject = existing.subjectEvidence?.sourcePageIdentity;
  const parent = existing.parentOccurrenceEvidence?.sourcePageIdentity;
  return subject && parent && inputKeys.has(identityKey(subject)) && inputKeys.has(identityKey(parent))
    && same(sorted(input.sourceRevisions || []), sorted(existing.reviewScope?.sourceRevisions || []), contentHash)
    && existing.candidateRole === input.candidateRole;
}

function evidenceReference(existing, channel) {
  if (!existing) return null;
  if (channel === 'exact_parent_occurrence_to_numbered_variant_review_queue') return {
    queueEntryKey: existing.queueEntryKey,
    queueRecordContentHash: existing.contentHash,
    sourceEvidencePacketContentHash: existing.sourceEvidencePacketContentHash,
    evidenceFingerprint: existing.evidenceFingerprint,
    proposedButUnboundVariantIndex: existing.variantBindingReviewEvidence.reviewCandidateVariantIndex,
    matchingVariantIndices: [...existing.variantBindingReviewEvidence.matchingVariantIndices],
    sourceRevisions: sorted(existing.reviewScope.sourceRevisions),
    state: existing.state
  };
  if (channel === 'single_infobox_variant_identity_review_queue') return {
    queueEntryKey: existing.queueEntryKey,
    queueRecordContentHash: existing.contentHash,
    sourceEvidencePacketContentHash: existing.sourcePacketContentHash,
    evidenceFingerprint: existing.evidenceFingerprint,
    proposedButUnboundVariantIndex: null,
    matchingVariantIndices: [],
    sourceRevisions: sorted(existing.reviewScope.sourceRevisions),
    state: existing.state
  };
  return {
    queueEntryKey: existing.queueEntryKey,
    queueRecordContentHash: existing.contentHash,
    sourceEvidencePacketRecordContentHash: existing.sourceEvidencePacketRecordContentHash,
    evidenceFingerprint: existing.evidenceFingerprint,
    proposedButUnboundVariantIndex: null,
    matchingVariantIndices: [],
    sourceRevisions: sorted(existing.reviewScope.sourceRevisions),
    state: existing.state
  };
}

function derive(inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords, policy, contentHash = hash) {
  const compiled = compileWeightedMembershipVariantScopeEvidenceCrosswalkPolicy(policy);
  const inputAssessments = inputRecords.map(record => ({ key: record.structuralCandidateKey, ...inputIntegrity(record, policy, contentHash) }));
  const exactAssessments = exactReviewRecords.map(record => ({ key: record.structuralCandidateKey, ...exactReviewIntegrity(record, policy, contentHash) }));
  const singleAssessments = singleVariantReviewRecords.map(record => ({ key: record.structuralCandidateKey, ...singleVariantReviewIntegrity(record, policy, contentHash) }));
  const canonicalAssessments = canonicalReviewRecords.map(record => ({ key: record.structuralCandidateKey, ...canonicalReviewIntegrity(record, policy, contentHash) }));
  const duplicateInputKeys = duplicates(inputRecords.map(record => record.structuralCandidateKey));
  const duplicateExactKeys = duplicates(exactReviewRecords.map(record => record.structuralCandidateKey));
  const duplicateSingleKeys = duplicates(singleVariantReviewRecords.map(record => record.structuralCandidateKey));
  const duplicateCanonicalKeys = duplicates(canonicalReviewRecords.map(record => record.structuralCandidateKey));
  const allExistingKeys = [...exactReviewRecords, ...singleVariantReviewRecords, ...canonicalReviewRecords].map(record => record.structuralCandidateKey);
  const crossChannelKeys = duplicates(allExistingKeys);
  const failures = [...inputAssessments, ...exactAssessments, ...singleAssessments, ...canonicalAssessments].filter(item => !item.complete);
  const accountFindings = accountStateFindings([inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords]);
  const structurallyValid = compiled.valid && inputRecords.length > 0 && !failures.length && !duplicateInputKeys.length && !duplicateExactKeys.length && !duplicateSingleKeys.length && !duplicateCanonicalKeys.length && !crossChannelKeys.length && !accountFindings.length;
  const exactByKey = new Map(exactReviewRecords.map(record => [record.structuralCandidateKey, record]));
  const singleByKey = new Map(singleVariantReviewRecords.map(record => [record.structuralCandidateKey, record]));
  const canonicalByKey = new Map(canonicalReviewRecords.map(record => [record.structuralCandidateKey, record]));
  const matchFailures = [];
  const records = structurallyValid ? inputRecords.map(input => {
    const exact = exactByKey.get(input.structuralCandidateKey);
    const single = singleByKey.get(input.structuralCandidateKey);
    const canonical = canonicalByKey.get(input.structuralCandidateKey);
    if (exact && !identitiesMatch(input, exact, false, contentHash)) matchFailures.push(input.structuralCandidateKey);
    if (single && !identitiesMatch(input, single, false, contentHash)) matchFailures.push(input.structuralCandidateKey);
    if (canonical && (canonical.candidateRole !== input.candidateRole || !identitiesMatch(input, canonical, true, contentHash))) matchFailures.push(input.structuralCandidateKey);
    const usableExact = exact && !matchFailures.includes(input.structuralCandidateKey) ? exact : null;
    const usableSingle = single && !matchFailures.includes(input.structuralCandidateKey) ? single : null;
    const usableCanonical = canonical && !matchFailures.includes(input.structuralCandidateKey) ? canonical : null;
    const channel = usableExact ? 'exact_parent_occurrence_to_numbered_variant_review_queue' : usableSingle ? 'single_infobox_variant_identity_review_queue' : usableCanonical ? 'canonical_subject_scope_review_queue' : 'none';
    const classification = usableExact ? CLASSIFICATIONS[0] : usableSingle ? CLASSIFICATIONS[1] : usableCanonical ? CLASSIFICATIONS[2] : CLASSIFICATIONS[3];
    const next = usableExact ? ['explicit_source_bound_human_variant_binding_review']
      : usableSingle ? ['explicit_source_bound_human_single_infobox_subject_identity_review']
        : usableCanonical ? ['explicit_source_bound_human_canonical_subject_scope_review', 'revision_pinned_exact_numbered_variant_binding_evidence']
        : ['revision_pinned_exact_candidate_variant_scope_evidence'];
    const base = {
      contract: policy.outputContract,
      crosswalkKey: `${input.queueEntryKey}|existing-variant-evidence-crosswalk`,
      queueOrdinal: input.queueOrdinal,
      sourceQueueEntryKey: input.queueEntryKey,
      sourceQueueRecordContentHash: input.contentHash,
      structuralCandidateKey: input.structuralCandidateKey,
      candidateRole: input.candidateRole,
      candidateDisplay: input.candidateDisplay,
      inputEvidenceFingerprint: input.evidenceFingerprint,
      inputSourceRevisions: sorted(input.sourceRevisions),
      existingEvidenceChannel: channel,
      existingEvidenceReference: evidenceReference(usableExact || usableSingle || usableCanonical, channel),
      reuseClassification: classification,
      requiredNextEvidence: next,
      reviewDecisionRecorded: false,
      reviewCandidateVariantIndex: null,
      boundVariantIndex: null,
      weightedTaskEntryMembershipVerdict: null,
      candidateMemberIdentityVerdict: null,
      repeatabilityVerdict: null,
      mappingVerdict: null,
      inventoryCompletenessVerdict: null,
      memberUniverseComplete: false,
      mechanicsReviewComplete: false,
      optimizerEligible: false,
      automaticVerificationApplied: false,
      accountIndependent: true,
      blockers: unique([...next, 'weighted_parent_task_entry_membership_not_proven', 'member_universe_completeness_not_proven', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
      state: 'existing_variant_scope_evidence_crosswalked_all_semantic_gates_closed'
    };
    return { ...base, recordContentHash: contentHash(base) };
  }) : [];
  const finalRecords = matchFailures.length ? [] : records;
  return { compiled, inputAssessments, exactAssessments, singleAssessments, canonicalAssessments, duplicateInputKeys, duplicateExactKeys, duplicateSingleKeys, duplicateCanonicalKeys, crossChannelKeys, failures, accountFindings, matchFailures: unique(matchFailures), records: finalRecords };
}

export function auditWeightedMembershipVariantScopeEvidenceCrosswalk(records = [], { inputRecords = [], exactReviewRecords = [], singleVariantReviewRecords = [], canonicalReviewRecords = [], policy = {}, contentHash = hash } = {}) {
  const derived = derive(inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords, policy, contentHash);
  const inputKeys = inputRecords.map(record => record.structuralCandidateKey);
  const recordKeys = records.map(record => record.structuralCandidateKey);
  const missingKeys = inputKeys.filter(key => !recordKeys.includes(key));
  const unexpectedKeys = recordKeys.filter(key => !inputKeys.includes(key));
  const duplicateRecordKeys = duplicates(recordKeys);
  const recordMismatches = records.filter(record => {
    const expected = derived.records.find(item => item.structuralCandidateKey === record.structuralCandidateKey);
    return !expected || !same(record, expected, contentHash);
  }).map(record => record.structuralCandidateKey || 'unknown');
  const hashFailures = records.filter(record => !validHash(record.recordContentHash) || contentHash(without(record, 'recordContentHash')) !== record.recordContentHash).map(record => record.structuralCandidateKey || 'unknown');
  const promotions = records.filter(record => record.reviewDecisionRecorded !== false || record.reviewCandidateVariantIndex !== null || record.boundVariantIndex !== null || record.weightedTaskEntryMembershipVerdict !== null || record.candidateMemberIdentityVerdict !== null || record.repeatabilityVerdict !== null || record.mappingVerdict !== null || record.inventoryCompletenessVerdict !== null || record.memberUniverseComplete !== false || record.mechanicsReviewComplete !== false || record.optimizerEligible !== false || record.automaticVerificationApplied !== false || record.accountIndependent !== true).map(record => record.structuralCandidateKey || 'unknown');
  const accountFindings = unique([...derived.accountFindings, ...accountStateFindings([records])]);
  const exactCount = records.filter(record => record.reuseClassification === CLASSIFICATIONS[0]).length;
  const singleCount = records.filter(record => record.reuseClassification === CLASSIFICATIONS[1]).length;
  const canonicalCount = records.filter(record => record.reuseClassification === CLASSIFICATIONS[2]).length;
  const noMatchCount = records.filter(record => record.reuseClassification === CLASSIFICATIONS[3]).length;
  const structuralBlockers = [];
  if (!derived.compiled.valid) structuralBlockers.push('variant_scope_crosswalk_policy_invalid_or_specific');
  if (derived.failures.length) structuralBlockers.push('one_or_more_input_or_existing_evidence_records_failed_revalidation');
  if (derived.duplicateInputKeys.length || derived.duplicateExactKeys.length || derived.duplicateSingleKeys.length || derived.duplicateCanonicalKeys.length || duplicateRecordKeys.length) structuralBlockers.push('duplicate_structural_candidate_keys');
  if (derived.crossChannelKeys.length) structuralBlockers.push('candidate_present_in_multiple_existing_evidence_channels');
  if (derived.matchFailures.length) structuralBlockers.push('existing_evidence_candidate_role_or_pinned_source_identity_mismatch');
  if (missingKeys.length || unexpectedKeys.length || recordMismatches.length || hashFailures.length) structuralBlockers.push('crosswalk_output_does_not_exactly_match_input_queue');
  if (promotions.length) structuralBlockers.push('crosswalk_created_unsupported_review_variant_membership_or_optimizer_promotion');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const crosswalkComplete = inputRecords.length > 0 && !structuralBlockers.length && records.length === inputRecords.length;
  return {
    contract: policy.auditContract,
    inputQueueCoverage: { inputQueueEntryCount: inputRecords.length, revalidatedInputQueueEntryCount: derived.inputAssessments.filter(item => item.complete).length, duplicateInputKeys: derived.duplicateInputKeys },
    existingEvidenceCoverage: { exactVariantReviewEntryCount: exactReviewRecords.length, revalidatedExactVariantReviewEntryCount: derived.exactAssessments.filter(item => item.complete).length, singleVariantIdentityReviewEntryCount: singleVariantReviewRecords.length, revalidatedSingleVariantIdentityReviewEntryCount: derived.singleAssessments.filter(item => item.complete).length, canonicalSubjectReviewEntryCount: canonicalReviewRecords.length, revalidatedCanonicalSubjectReviewEntryCount: derived.canonicalAssessments.filter(item => item.complete).length, duplicateExactKeys: derived.duplicateExactKeys, duplicateSingleKeys: derived.duplicateSingleKeys, duplicateCanonicalKeys: derived.duplicateCanonicalKeys, crossChannelKeys: derived.crossChannelKeys, candidateRoleOrPinnedIdentityMismatchKeys: derived.matchFailures },
    crosswalkCoverage: { crosswalkRecordCount: records.length, reusableExactVariantEvidenceCount: exactCount, reusableSingleVariantIdentityEvidenceCount: singleCount, reusableCanonicalSubjectEvidenceCount: canonicalCount, noCompatibleExistingEvidenceCount: noMatchCount, missingKeys, unexpectedKeys, duplicateRecordKeys, recordMismatches, recordHashFailures: hashFailures, queueOrderPreserved: same(records.map(record => record.structuralCandidateKey), inputKeys, contentHash) },
    semanticPreservationCoverage: { unsupportedPromotionKeys: promotions, reviewDecisionRecordedCount: records.filter(record => record.reviewDecisionRecorded === true).length, selectedOrBoundVariantCount: records.filter(record => record.reviewCandidateVariantIndex !== null || record.boundVariantIndex !== null).length, weightedMembershipVerdictCount: records.filter(record => record.weightedTaskEntryMembershipVerdict !== null).length, optimizerEligibleCount: records.filter(record => record.optimizerEligible === true).length },
    policyCoverage: derived.compiled,
    accountStateFindings: accountFindings,
    crosswalkComplete,
    variantScopeEvidenceComplete: false,
    weightedMembershipReviewComplete: false,
    optimizerEligibleCount: 0,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([...structuralBlockers, ...(exactCount ? ['exact_variant_binding_human_reviews_pending'] : []), ...(singleCount ? ['single_infobox_subject_identity_human_review_pending'] : []), ...(canonicalCount ? ['canonical_subject_scope_reviews_and_exact_variant_evidence_pending'] : []), ...(noMatchCount ? ['one_or_more_candidates_lack_compatible_existing_variant_scope_evidence'] : []), 'weighted_parent_task_entry_membership_not_proven', 'member_universe_completeness_not_proven', 'requirements_xp_timing_and_mechanics_not_structured', 'independent_complete_activity_universe_not_established']),
    publishable: crosswalkComplete
  };
}

export function buildWeightedMembershipVariantScopeEvidenceCrosswalk({ inputRecords = [], exactReviewRecords = [], singleVariantReviewRecords = [], canonicalReviewRecords = [], policy = {}, contentHash = hash } = {}) {
  const derived = derive(inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords, policy, contentHash);
  return { records: derived.records, audit: auditWeightedMembershipVariantScopeEvidenceCrosswalk(derived.records, { inputRecords, exactReviewRecords, singleVariantReviewRecords, canonicalReviewRecords, policy, contentHash }) };
}
