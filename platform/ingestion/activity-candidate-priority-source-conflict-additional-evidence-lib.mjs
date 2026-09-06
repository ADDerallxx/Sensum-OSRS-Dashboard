import { hash } from './lib.mjs';
import { buildActivityCandidatePriorityHumanReviewDecisionGuidance } from '../transforms/activity-candidate-priority-human-review-decision-guidance-lib.mjs';

const REQUIRED_RULES = [
  'packetAndGuidanceSnapshotsMustBeExplicitlySelected',
  'packetAndGuidanceManifestsRawRecordsPoliciesAndHashChainsMustRevalidate',
  'onlyGenericSourceDeclarationConflictsMayEnter',
  'candidateCurrentRevisionMustMatchTheBoundPacketRevisionOrRemainBlocked',
  'everyRequiredSupportingSourceMustBeFetchedAtOneCurrentExactRevision',
  'everyRequiredObservationMustRetainExactSourceLocationAndRevision',
  'taxonomyMembershipMustUseAnExactMainNamespaceLinkAndRetainHeadingAndRowContext',
  'schemaFieldMeaningAndTaxonomyMembershipAreEvidenceNotAReviewDecision',
  'missingChangedDuplicateAmbiguousOrContradictoryEvidenceRemainsBlocked',
  'oneAdditionalEvidencePacketPerSourceConflictInPacketOrder',
  'namesTitlesPageIdsRevisionsSkillsRoutesLabelsAliasesAndOverridesCannotAlterPolicyBehavior',
  'humanDecisionSemanticApplicationAndOptimizerPromotionAreForbidden',
  'requirementsVariantsXpTimingAndMechanicsCompletionIsForbidden',
  'currentAccountStateIsForbidden'
];

const unique = values => [...new Set(values)];
const sorted = values => [...values].map(String).sort((a, b) => a.localeCompare(b));
const duplicates = values => unique(values.filter((value, index) => values.indexOf(value) !== index));
const titleKey = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const same = (left, right, contentHash = hash) => contentHash(left) === contentHash(right);
const revisionUrl = revision => revision ? `https://oldschool.runescape.wiki/w/Special:Redirect/revision/${revision}` : null;
const wikiUrl = title => title ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(String(title).replaceAll(' ', '_'))}` : null;

function forbiddenPolicyPaths(policy = {}) {
  const findings = [];
  const forbidden = /^(?:name|names|title|titles|pageId|pageIds|revision|revisions|skill|skills|route|routes|label|labels|alias|aliases|override|overrides|exception|exceptions)$|(?:name|title|pageid|revision|skill|route|label|alias).*(?:override|exception)s?$/i;
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

export function compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(
  policy = {}, packetPolicy = {}, guidancePolicy = {}, decisionPolicy = {}, contentHash = hash
) {
  const invalidRules = REQUIRED_RULES.filter(rule => policy.rules?.[rule] !== true);
  if (policy.rules?.automaticVerificationAllowed !== false) invalidRules.push('automaticVerificationAllowed');
  const sources = policy.requiredSupportingSources || [];
  const observations = policy.requiredObservations || [];
  const sourceKeys = sources.map(source => source.sourceKey);
  const sourceTitles = sources.map(source => titleKey(source.requestedTitle));
  const observationKeys = observations.map(observation => observation.observationKey);
  const invalidSources = sources.filter(source => !source.sourceKey || !source.requestedTitle || !Number.isInteger(source.namespace)).map(source => source.sourceKey || null);
  const invalidObservations = observations.filter(observation => !observation.observationKey
    || !sourceKeys.includes(observation.sourceKey)
    || !['literal_substring', 'exact_trimmed_line'].includes(observation.matchMode)
    || !observation.literal).map(observation => observation.observationKey || null);
  const invalidBindings = [];
  if (policy.policy !== 'sensum.activity-candidate-priority-source-conflict-additional-evidence-policy.v1') invalidBindings.push('policy');
  if (policy.inputPacketPolicy !== packetPolicy.policy || policy.inputPacketPolicyContentHash !== contentHash(packetPolicy)) invalidBindings.push('inputPacketPolicy');
  if (policy.inputGuidancePolicy !== guidancePolicy.policy || policy.inputGuidancePolicyContentHash !== contentHash(guidancePolicy)) invalidBindings.push('inputGuidancePolicy');
  if (policy.inputDecisionImportPolicy !== decisionPolicy.policy || policy.inputDecisionImportPolicyContentHash !== contentHash(decisionPolicy)) invalidBindings.push('inputDecisionImportPolicy');
  if (policy.inputPacketDomain !== guidancePolicy.inputDomain || policy.inputGuidanceDomain !== guidancePolicy.outputDomain) invalidBindings.push('inputDomains');
  if (policy.recordContract !== 'sensum.activity-candidate-priority-source-conflict-additional-evidence.v1'
    || policy.auditContract !== 'sensum.activity-candidate-priority-source-conflict-additional-evidence-audit.v1') invalidBindings.push('contracts');
  if (!policy.outputDomain || policy.sourceConflictState !== 'blocked_conflicting_source_declarations') invalidBindings.push('stateOrOutput');
  if (!same(sorted(policy.requiredConflictingDispositions || []), ['activity_subject', 'minigame_subject'], contentHash)) invalidBindings.push('requiredConflictingDispositions');
  const forbidden = forbiddenPolicyPaths(policy);
  const valid = !invalidRules.length && !invalidBindings.length && !invalidSources.length && !invalidObservations.length
    && !duplicates(sourceKeys).length && !duplicates(sourceTitles).length && !duplicates(observationKeys).length && !forbidden.length;
  return {
    valid,
    invalidRules: unique(invalidRules),
    invalidBindings,
    invalidSources,
    invalidObservations,
    duplicateSourceKeys: duplicates(sourceKeys),
    duplicateSourceTitles: duplicates(sourceTitles),
    duplicateObservationKeys: duplicates(observationKeys),
    forbiddenPolicyPaths: forbidden
  };
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function snapshotAssessment(raw, records, manifest, snapshot, domain, policyId, policyHash, contentHash = hash) {
  const checks = {
    explicitSnapshotSelected: snapshot?.explicit === true && Boolean(snapshot?.directory),
    manifestContractAndDomainMatch: manifest?.contract === 'sensum.ingestion-manifest.v1' && manifest?.domain === domain,
    recordCountAndRawHashMatch: manifest?.records === records.length && manifest?.contentHash === contentHash(raw),
    snapshotBindingMatchesManifest: snapshot?.contentHash === manifest?.contentHash && snapshot?.createdAt === manifest?.createdAt,
    createdAtValid: validIso(manifest?.createdAt),
    policyBindingMatches: manifest?.source?.policy?.id === policyId && manifest?.source?.policy?.contentHash === policyHash
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
}

function withoutOuterContentHash(record = {}) {
  const { contentHash, ...intrinsic } = record;
  return intrinsic;
}

function resolutionMap(resolutions = []) {
  return new Map(resolutions.map(resolution => [titleKey(resolution.requestedTitle), resolution]));
}

function revisionFor(resolution) {
  return resolution?.page?.revisions?.[0] || null;
}

function contentFor(resolution) {
  return revisionFor(resolution)?.slots?.main?.content;
}

function sourceIdentity(resolution, requestedTitle, contentHash = hash) {
  const page = resolution?.page || null;
  const revision = revisionFor(resolution);
  const content = contentFor(resolution);
  return {
    requestedTitle,
    resolvedTitle: page?.title || resolution?.resolvedTitle || null,
    redirected: resolution?.redirected === true,
    namespace: page?.ns ?? null,
    sourcePageId: page?.pageid ? Number(page.pageid) : null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    sourceUrl: wikiUrl(page?.title),
    sourceExactRevisionUrl: revisionUrl(revision?.revid),
    sourceContentHash: typeof content === 'string' ? contentHash(content) : null,
    sourceContentBytes: typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : 0
  };
}

function occurrences(content, observation) {
  const matches = [];
  const lines = String(content || '').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (observation.matchMode === 'exact_trimmed_line' && line.trim() === observation.literal) {
      matches.push({ lineStart: index + 1, lineEnd: index + 1, matchedText: line.trim() });
    } else if (observation.matchMode === 'literal_substring') {
      let offset = 0;
      while (true) {
        const column = line.indexOf(observation.literal, offset);
        if (column < 0) break;
        matches.push({ lineStart: index + 1, lineEnd: index + 1, columnStart: column + 1, columnEnd: column + observation.literal.length, matchedText: observation.literal });
        offset = column + Math.max(1, observation.literal.length);
      }
    }
  }
  return matches;
}

function supportingSourceEvidence(sourceSpec, policy, fetchedByTitle, contentHash = hash) {
  const resolution = fetchedByTitle.get(titleKey(sourceSpec.requestedTitle));
  const identity = sourceIdentity(resolution, sourceSpec.requestedTitle, contentHash);
  const content = contentFor(resolution);
  const observations = (policy.requiredObservations || []).filter(item => item.sourceKey === sourceSpec.sourceKey).map(item => {
    const found = occurrences(content, item);
    return {
      observationKey: item.observationKey,
      matchMode: item.matchMode,
      literal: item.literal,
      occurrenceCount: found.length,
      occurrences: found,
      exactSingleOccurrence: found.length === 1,
      evidenceKey: `${sourceSpec.sourceKey}:${identity.sourcePageId}:${identity.sourceRevision}:${item.observationKey}`
    };
  });
  const deficiencies = [];
  if (!resolution || !resolution.page || Object.hasOwn(resolution.page, 'missing')) deficiencies.push('required_supporting_source_missing');
  if (identity.namespace !== sourceSpec.namespace) deficiencies.push('required_supporting_source_namespace_mismatch');
  if (!identity.sourcePageId || !identity.sourceRevision || !identity.sourceTimestamp || !identity.sourceContentHash || !identity.sourceContentBytes) deficiencies.push('required_supporting_source_revision_provenance_incomplete');
  if (observations.some(item => item.occurrenceCount === 0)) deficiencies.push('one_or_more_required_observations_missing');
  if (observations.some(item => item.occurrenceCount > 1)) deficiencies.push('one_or_more_required_observations_duplicated');
  return {
    sourceKey: sourceSpec.sourceKey,
    ...identity,
    observations,
    deficiencies,
    state: deficiencies.length ? 'blocked_incomplete_revision_pinned_supporting_evidence' : 'complete_revision_pinned_supporting_evidence'
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function headingStackAt(lines, targetIndex) {
  const stack = [];
  for (let index = 0; index < targetIndex; index += 1) {
    const match = lines[index].trim().match(/^(={2,6})\s*([^=].*?)\s*\1$/);
    if (!match) continue;
    const level = match[1].length;
    while (stack.length && stack.at(-1).level >= level) stack.pop();
    stack.push({ level, title: match[2].trim(), sourceLocator: { lineStart: index + 1, lineEnd: index + 1 } });
  }
  return stack;
}

function tableRowAt(lines, targetIndex) {
  let start = targetIndex;
  while (start >= 0 && lines[start].trim() !== '|-') start -= 1;
  let end = targetIndex;
  while (end + 1 < lines.length && !['|-', '|}'].includes(lines[end + 1].trim())) end += 1;
  if (start < 0) return null;
  return {
    sourceLocator: { lineStart: start + 1, lineEnd: end + 1 },
    rawLines: lines.slice(start, end + 1)
  };
}

function taxonomyMembershipEvidence(packet, taxonomySource, fetchedByTitle) {
  const resolution = fetchedByTitle.get(titleKey(taxonomySource.requestedTitle));
  const content = contentFor(resolution);
  const lines = String(content || '').split(/\r?\n/);
  const title = packet.sourcePageIdentity.resolvedTitle;
  const directLink = new RegExp(`\\[\\[\\s*${escapeRegex(title)}\\s*(?:\\||\\]\\])`, 'i');
  const linkOccurrences = [];
  for (const [index, line] of lines.entries()) {
    if (!directLink.test(line)) continue;
    linkOccurrences.push({
      matchedText: line.trim(),
      sourceLocator: { lineStart: index + 1, lineEnd: index + 1 },
      headingPath: headingStackAt(lines, index),
      tableRow: tableRowAt(lines, index)
    });
  }
  const deficiencies = [];
  if (linkOccurrences.length === 0) deficiencies.push('candidate_exact_main_namespace_taxonomy_link_missing');
  if (linkOccurrences.length > 1) deficiencies.push('candidate_exact_main_namespace_taxonomy_link_ambiguous');
  if (linkOccurrences.some(item => !item.headingPath.length || !item.tableRow)) deficiencies.push('taxonomy_heading_or_table_row_context_missing');
  return {
    sourceKey: taxonomySource.sourceKey,
    sourcePageId: taxonomySource.sourcePageId,
    sourceRevision: taxonomySource.sourceRevision,
    sourceTimestamp: taxonomySource.sourceTimestamp,
    sourceUrl: taxonomySource.sourceUrl,
    sourceExactRevisionUrl: taxonomySource.sourceExactRevisionUrl,
    sourceContentHash: taxonomySource.sourceContentHash,
    candidateRequestedTitle: title,
    exactMainNamespaceLinkOccurrenceCount: linkOccurrences.length,
    linkOccurrences,
    deficiencies,
    state: deficiencies.length ? 'blocked_ambiguous_or_missing_taxonomy_membership_evidence' : 'complete_revision_pinned_taxonomy_membership_evidence',
    classificationVerdict: null
  };
}

function candidateRevisionRevalidation(packet, fetchedByTitle, contentHash = hash) {
  const requestedTitle = packet.sourcePageIdentity.resolvedTitle;
  const resolution = fetchedByTitle.get(titleKey(requestedTitle));
  const identity = sourceIdentity(resolution, requestedTitle, contentHash);
  const bound = packet.sourcePageIdentity;
  const checks = {
    resolvedPagePresent: Boolean(identity.sourcePageId && identity.sourceRevision && identity.sourceContentHash),
    stablePageIdMatches: identity.sourcePageId === bound.sourcePageId,
    revisionMatches: identity.sourceRevision === bound.sourceRevision,
    timestampMatches: identity.sourceTimestamp === bound.sourceTimestamp,
    contentHashMatches: identity.sourceContentHash === bound.sourceContentHash
  };
  return {
    boundPacketSource: structuredClone(bound),
    fetchedCurrentSource: identity,
    checks,
    exactMatch: Object.values(checks).every(Boolean),
    classificationVerdict: null
  };
}

function accountStateFindings(values = []) {
  const findings = [];
  const forbidden = /^(?:account|accountState|player|playerState|username|profile|levels|xp|bank|owned|inventory|budget|preferences|completedQuests)$/i;
  const visit = (value, at = '') => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${at}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const next = at ? `${at}.${key}` : key;
      if (forbidden.test(key)) findings.push(next);
      visit(child, next);
    }
  };
  values.forEach((value, index) => visit(value, `[${index}]`));
  return sorted(findings);
}

function expectedRecord(packet, guidance, sharedSources, fetchedByTitle, policy, contentHash = hash, ordinal = 1) {
  const candidateRevision = candidateRevisionRevalidation(packet, fetchedByTitle, contentHash);
  const taxonomySource = sharedSources.find(source => source.sourceKey === 'minigame_taxonomy');
  const taxonomyMembership = taxonomyMembershipEvidence(packet, taxonomySource, fetchedByTitle);
  const schemaSources = sharedSources.filter(source => source.sourceKey !== 'minigame_taxonomy');
  const fieldSemanticsComplete = schemaSources.length === 2 && schemaSources.every(source => source.state === 'complete_revision_pinned_supporting_evidence');
  const taxonomyDefinitionComplete = taxonomySource?.state === 'complete_revision_pinned_supporting_evidence';
  const evidenceComplete = candidateRevision.exactMatch && fieldSemanticsComplete && taxonomyDefinitionComplete
    && taxonomyMembership.state === 'complete_revision_pinned_taxonomy_membership_evidence';
  const evidenceKeys = unique([
    ...sharedSources.flatMap(source => source.observations.filter(item => item.exactSingleOccurrence).map(item => item.evidenceKey)),
    ...taxonomyMembership.linkOccurrences.map((item, index) => `minigame_taxonomy:${taxonomyMembership.sourcePageId}:${taxonomyMembership.sourceRevision}:candidate_membership:${index + 1}`),
    `candidate:${candidateRevision.fetchedCurrentSource.sourcePageId}:${candidateRevision.fetchedCurrentSource.sourceRevision}:revision_revalidation`
  ]);
  const base = {
    contract: policy.recordContract,
    evidencePacketKey: `${packet.reviewPacketKey}|source-conflict-additional-evidence`,
    evidencePacketOrdinal: ordinal,
    candidateKey: packet.candidateKey,
    reviewPacketKey: packet.reviewPacketKey,
    guidanceKey: guidance.guidanceKey,
    sourceBindings: {
      packetSnapshotContentHash: guidance.sourcePacketSnapshotContentHash,
      packetRecordContentHash: packet.recordContentHash,
      packetOuterContentHash: packet.contentHash,
      guidanceSnapshotContentHash: guidance.sourceGuidanceSnapshotContentHash,
      guidanceRecordContentHash: guidance.recordContentHash,
      guidanceOuterContentHash: guidance.contentHash,
      candidateSourceContentHash: packet.sourcePageIdentity.sourceContentHash
    },
    sourceConflict: {
      state: packet.subjectAssessment.subjectDisposition.state,
      conflictingDispositions: structuredClone(packet.subjectAssessment.subjectDisposition.conflictingDispositions),
      dispositionSignals: structuredClone(packet.subjectAssessment.dispositionSignals),
      selectedSourceDisposition: null,
      conflictResolved: false
    },
    candidateRevisionRevalidation: candidateRevision,
    fieldSemanticsEvidence: {
      sources: structuredClone(schemaSources),
      evidenceComplete: fieldSemanticsComplete,
      fieldMeaningVerdict: null
    },
    taxonomyMembershipEvidence: {
      taxonomyDefinitionSource: structuredClone(taxonomySource),
      taxonomyDefinitionComplete,
      candidateMembership: taxonomyMembership,
      taxonomyVerdict: null
    },
    humanReviewBoundary: {
      state: evidenceComplete ? 'additional_evidence_ready_human_decision_still_required' : 'additional_evidence_incomplete_human_decision_blocked',
      reviewEvidenceKeys: evidenceKeys,
      selectedSourceDisposition: null,
      subjectDispositionDecision: null,
      canonicalGameEntityIdentityDecision: null,
      canonicalActivityIdentityDecision: null,
      repeatabilityDecision: null,
      atomicityDecision: null,
      memberExpansionDecision: null,
      reviewedAt: null,
      reviewer: null,
      reviewNotes: null
    },
    explicitNonClaims: [
      'activity_is_a_generic_noun_and_does_not_negate_a_source_taxonomy_classification',
      'infobox_type_field_semantics_do_not_by_themselves_select_a_subject_disposition',
      'taxonomy_membership_does_not_by_itself_establish_the_canonical_activity_boundary',
      'taxonomy_repeatability_language_does_not_by_itself_prove_this_candidate_repeatable',
      'additional_evidence_does_not_resolve_the_source_declaration_conflict',
      'requirements_variants_xp_timing_mechanics_and_complete_universe_are_not_established',
      'account_state_is_not_evaluated',
      'optimizer_eligibility_and_verified_best_are_not_authorized'
    ],
    blockers: unique([
      ...sharedSources.flatMap(source => source.deficiencies),
      ...taxonomyMembership.deficiencies,
      ...(candidateRevision.exactMatch ? [] : ['candidate_current_revision_does_not_match_bound_packet_revision']),
      'source_declaration_conflict_requires_human_review',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    state: evidenceComplete
      ? 'source_conflict_additional_evidence_materialized_human_decision_pending'
      : 'source_conflict_additional_evidence_blocked_incomplete',
    accountIndependent: true,
    humanDecisionSelected: false,
    decisionRecorded: false,
    semanticApplicationApplied: false,
    requirementsVariantsXpTimingAndMechanicsComplete: false,
    optimizerEligible: false,
    automaticVerificationApplied: false
  };
  return { ...base, recordContentHash: contentHash(base) };
}

function validateGuidanceInput({ packetRecords, packetRaw, packetManifest, packetSnapshot, guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot, guidancePolicy, packetPolicy, decisionPolicy, contentHash = hash }) {
  const rebuilt = buildActivityCandidatePriorityHumanReviewDecisionGuidance({
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    policy: guidancePolicy, packetPolicy, decisionPolicy, contentHash
  });
  const manifestAssessment = snapshotAssessment(
    guidanceRaw, guidanceRecords, guidanceManifest, guidanceSnapshot,
    guidancePolicy.outputDomain, guidancePolicy.policy, contentHash(guidancePolicy), contentHash
  );
  const expectedByKey = new Map(rebuilt.records.map(record => [record.guidanceKey, record]));
  const recordMismatches = guidanceRecords.filter(record => {
    const expected = expectedByKey.get(record.guidanceKey);
    return !expected || !same(withoutOuterContentHash(record), expected, contentHash);
  }).map(record => record.guidanceKey || 'unknown');
  const exactSet = guidanceRecords.length === rebuilt.records.length && !recordMismatches.length;
  return {
    complete: rebuilt.audit.publishable && manifestAssessment.complete && exactSet,
    rebuiltAudit: rebuilt.audit,
    manifestAssessment,
    recordMismatches,
    exactSet
  };
}

export function buildActivityCandidatePrioritySourceConflictAdditionalEvidence({
  packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
  guidanceRecords = [], guidanceRaw = '', guidanceManifest = {}, guidanceSnapshot = {},
  fetchedResolutions = [], policy = {}, packetPolicy = {}, guidancePolicy = {}, decisionPolicy = {}, contentHash = hash
} = {}) {
  const compiled = compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash);
  const packetAssessment = snapshotAssessment(packetRaw, packetRecords, packetManifest, packetSnapshot, policy.inputPacketDomain, packetPolicy.policy, policy.inputPacketPolicyContentHash, contentHash);
  const guidanceAssessment = validateGuidanceInput({
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot,
    guidancePolicy, packetPolicy, decisionPolicy, contentHash
  });
  const guidanceByPacketKey = new Map(guidanceRecords.map(record => [record.reviewPacketKey, record]));
  const conflicts = packetRecords.filter(packet => packet.subjectAssessment?.subjectDisposition?.state === policy.sourceConflictState
    && same(sorted(packet.subjectAssessment.subjectDisposition.conflictingDispositions || []), sorted(policy.requiredConflictingDispositions || []), contentHash));
  const requiredTitles = unique([
    ...(policy.requiredSupportingSources || []).map(source => source.requestedTitle),
    ...conflicts.map(packet => packet.sourcePageIdentity.resolvedTitle)
  ]);
  const fetchedTitles = fetchedResolutions.map(resolution => resolution.requestedTitle);
  const fetchedSetValid = !duplicates(fetchedTitles.map(titleKey)).length
    && same(sorted(requiredTitles.map(titleKey)), sorted(fetchedTitles.map(titleKey)), contentHash);
  const fetchedByTitle = resolutionMap(fetchedResolutions);
  const sharedSources = compiled.valid && fetchedSetValid
    ? policy.requiredSupportingSources.map(source => supportingSourceEvidence(source, policy, fetchedByTitle, contentHash)) : [];
  const records = compiled.valid && packetAssessment.complete && guidanceAssessment.complete && fetchedSetValid
    ? conflicts.map((packet, index) => {
      const guidance = guidanceByPacketKey.get(packet.reviewPacketKey);
      const boundGuidance = guidance ? { ...guidance, sourceGuidanceSnapshotContentHash: guidanceSnapshot.contentHash } : null;
      return boundGuidance ? expectedRecord(packet, boundGuidance, sharedSources, fetchedByTitle, policy, contentHash, index + 1) : null;
    }).filter(Boolean) : [];
  const audit = auditActivityCandidatePrioritySourceConflictAdditionalEvidence(records, {
    packetRecords, packetRaw, packetManifest, packetSnapshot,
    guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot,
    fetchedResolutions, policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash
  });
  return { records, audit, requestedTitles: requiredTitles };
}

export function auditActivityCandidatePrioritySourceConflictAdditionalEvidence(records = [], context = {}) {
  const {
    packetRecords = [], packetRaw = '', packetManifest = {}, packetSnapshot = {},
    guidanceRecords = [], guidanceRaw = '', guidanceManifest = {}, guidanceSnapshot = {},
    fetchedResolutions = [], policy = {}, packetPolicy = {}, guidancePolicy = {}, decisionPolicy = {}, contentHash = hash
  } = context;
  const compiled = compileActivityCandidatePrioritySourceConflictAdditionalEvidencePolicy(policy, packetPolicy, guidancePolicy, decisionPolicy, contentHash);
  const packetAssessment = snapshotAssessment(packetRaw, packetRecords, packetManifest, packetSnapshot, policy.inputPacketDomain, packetPolicy.policy, policy.inputPacketPolicyContentHash, contentHash);
  const guidanceAssessment = validateGuidanceInput({ packetRecords, packetRaw, packetManifest, packetSnapshot, guidanceRecords, guidanceRaw, guidanceManifest, guidanceSnapshot, guidancePolicy, packetPolicy, decisionPolicy, contentHash });
  const conflicts = packetRecords.filter(packet => packet.subjectAssessment?.subjectDisposition?.state === policy.sourceConflictState
    && same(sorted(packet.subjectAssessment.subjectDisposition.conflictingDispositions || []), sorted(policy.requiredConflictingDispositions || []), contentHash));
  const requiredTitles = unique([...(policy.requiredSupportingSources || []).map(source => source.requestedTitle), ...conflicts.map(packet => packet.sourcePageIdentity.resolvedTitle)]);
  const fetchedTitles = fetchedResolutions.map(resolution => resolution.requestedTitle);
  const fetchedSetValid = !duplicates(fetchedTitles.map(titleKey)).length && same(sorted(requiredTitles.map(titleKey)), sorted(fetchedTitles.map(titleKey)), contentHash);
  const fetchedByTitle = resolutionMap(fetchedResolutions);
  const sharedSources = compiled.valid && fetchedSetValid ? policy.requiredSupportingSources.map(source => supportingSourceEvidence(source, policy, fetchedByTitle, contentHash)) : [];
  const guidanceByPacketKey = new Map(guidanceRecords.map(record => [record.reviewPacketKey, record]));
  const expected = compiled.valid && packetAssessment.complete && guidanceAssessment.complete && fetchedSetValid
    ? conflicts.map((packet, index) => {
      const guidance = guidanceByPacketKey.get(packet.reviewPacketKey);
      return guidance ? expectedRecord(packet, { ...guidance, sourceGuidanceSnapshotContentHash: guidanceSnapshot.contentHash }, sharedSources, fetchedByTitle, policy, contentHash, index + 1) : null;
    }).filter(Boolean) : [];
  const expectedByKey = new Map(expected.map(record => [record.evidencePacketKey, record]));
  const actualKeys = records.map(record => record.evidencePacketKey);
  const expectedKeys = expected.map(record => record.evidencePacketKey);
  const recordMismatches = records.filter(record => !expectedByKey.has(record.evidencePacketKey) || !same(record, expectedByKey.get(record.evidencePacketKey), contentHash)).map(record => record.evidencePacketKey || 'unknown');
  const orderValid = records.every((record, index) => record.evidencePacketOrdinal === index + 1);
  const setValid = !duplicates(actualKeys).length && !expectedKeys.filter(key => !actualKeys.includes(key)).length && !actualKeys.filter(key => !expectedKeys.includes(key)).length;
  const unsupportedPromotions = records.filter(record => record.humanDecisionSelected !== false || record.decisionRecorded !== false
    || record.semanticApplicationApplied !== false || record.requirementsVariantsXpTimingAndMechanicsComplete !== false
    || record.optimizerEligible !== false || record.automaticVerificationApplied !== false
    || record.sourceConflict?.selectedSourceDisposition !== null || record.sourceConflict?.conflictResolved !== false
    || record.humanReviewBoundary?.selectedSourceDisposition !== null || record.humanReviewBoundary?.reviewer !== null
    || record.humanReviewBoundary?.reviewedAt !== null).map(record => record.evidencePacketKey);
  const accountFindings = accountStateFindings(records);
  const evidenceCompleteRecords = records.filter(record => record.state === 'source_conflict_additional_evidence_materialized_human_decision_pending').length;
  const structuralBlockers = [];
  if (!compiled.valid) structuralBlockers.push('additional_evidence_policy_or_bound_policy_invalid');
  if (!packetAssessment.complete) structuralBlockers.push('packet_snapshot_manifest_or_policy_revalidation_failed');
  if (!guidanceAssessment.complete) structuralBlockers.push('guidance_snapshot_manifest_record_or_pipeline_revalidation_failed');
  if (!conflicts.length) structuralBlockers.push('no_source_declaration_conflicts_selected_by_generic_state');
  if (!fetchedSetValid) structuralBlockers.push('fetched_source_set_does_not_match_required_generic_and_candidate_sources');
  if (!setValid || !orderValid || recordMismatches.length) structuralBlockers.push('additional_evidence_packet_set_order_or_content_mismatch');
  if (unsupportedPromotions.length) structuralBlockers.push('additional_evidence_selected_a_decision_or_applied_semantic_optimizer_state');
  if (accountFindings.length) structuralBlockers.push('current_account_state_present');
  const publishable = structuralBlockers.length === 0;
  return {
    contract: policy.auditContract,
    policyCoverage: compiled,
    inputCoverage: {
      packetSnapshotAssessment: packetAssessment,
      guidanceSnapshotAssessment: guidanceAssessment,
      packetRecordCount: packetRecords.length,
      guidanceRecordCount: guidanceRecords.length,
      sourceConflictPacketCount: conflicts.length,
      outputRecordCount: records.length,
      exactOutputSetAndOrder: setValid && orderValid && !recordMismatches.length,
      recordMismatches
    },
    sourceCoverage: {
      requiredFetchedTitleCount: requiredTitles.length,
      actualFetchedTitleCount: fetchedTitles.length,
      fetchedSetValid,
      supportingSourceCount: sharedSources.length,
      completeSupportingSourceCount: sharedSources.filter(source => source.state === 'complete_revision_pinned_supporting_evidence').length,
      candidateRevisionExactMatchCount: records.filter(record => record.candidateRevisionRevalidation.exactMatch).length,
      sourceRevisions: Object.fromEntries(sharedSources.map(source => [source.resolvedTitle, source.sourceRevision]))
    },
    evidenceCoverage: {
      evidenceCompleteRecordCount: evidenceCompleteRecords,
      fieldSemanticsCompleteCount: records.filter(record => record.fieldSemanticsEvidence.evidenceComplete).length,
      taxonomyDefinitionCompleteCount: records.filter(record => record.taxonomyMembershipEvidence.taxonomyDefinitionComplete).length,
      taxonomyMembershipCompleteCount: records.filter(record => record.taxonomyMembershipEvidence.candidateMembership.state === 'complete_revision_pinned_taxonomy_membership_evidence').length,
      exactTaxonomyLinkOccurrenceCount: records.reduce((sum, record) => sum + record.taxonomyMembershipEvidence.candidateMembership.exactMainNamespaceLinkOccurrenceCount, 0),
      reviewEvidenceKeyCount: records.reduce((sum, record) => sum + record.humanReviewBoundary.reviewEvidenceKeys.length, 0)
    },
    semanticPreservationCoverage: {
      humanDecisionSelectedCount: records.filter(record => record.humanDecisionSelected).length,
      decisionRecordedCount: records.filter(record => record.decisionRecorded).length,
      semanticApplicationCount: records.filter(record => record.semanticApplicationApplied).length,
      conflictResolvedCount: records.filter(record => record.sourceConflict.conflictResolved).length,
      requirementsVariantsXpTimingAndMechanicsCompleteCount: records.filter(record => record.requirementsVariantsXpTimingAndMechanicsComplete).length,
      optimizerEligibleCount: records.filter(record => record.optimizerEligible).length,
      automaticVerificationCount: records.filter(record => record.automaticVerificationApplied).length,
      unsupportedPromotions
    },
    accountStateFindings: accountFindings,
    additionalEvidenceMaterializationComplete: publishable && records.length === conflicts.length,
    additionalEvidenceCoverageComplete: publishable && evidenceCompleteRecords === conflicts.length,
    humanReviewComplete: false,
    completeActivityUniverse: false,
    absoluteBestGate: 'blocked_incomplete_activity_universe',
    blockers: unique([
      ...structuralBlockers,
      ...(evidenceCompleteRecords === conflicts.length ? [] : ['one_or_more_source_conflict_additional_evidence_packets_incomplete']),
      'all_priority_activity_candidate_human_decisions_pending',
      'source_declaration_conflicts_not_resolved_by_evidence_collection',
      'canonical_identity_repeatability_atomicity_and_membership_not_applied',
      'requirements_variants_xp_timing_and_mechanics_not_structured',
      'independent_complete_activity_universe_not_established'
    ]),
    publishable
  };
}
