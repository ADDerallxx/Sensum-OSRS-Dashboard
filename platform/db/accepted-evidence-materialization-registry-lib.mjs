import {
  RAW_STATEMENT_FACT_KIND,
  buildReconciliationQuery,
  buildSkillUnlockMaterializationSql,
  validateSkillUnlockMaterializationInput,
  verifyReconciliation
} from './skill-unlock-materialization-lib.mjs';
import {
  ACTIVITY_SCOPE_FACT_KIND,
  ACTIVITY_SCOPE_INPUT_DOMAIN,
  buildActivitySubjectScopeExistingSourceCountQuery,
  buildActivitySubjectScopeMaterializationSql,
  buildActivitySubjectScopeReconciliationQuery,
  validateActivitySubjectScopeMaterializationInput,
  verifyActivitySubjectScopeReconciliation
} from './activity-subject-scope-materialization-lib.mjs';
import {
  WEIGHTED_PARENT_TASK_FACT_KIND,
  WEIGHTED_PARENT_TASK_INPUT_DOMAIN,
  buildWeightedParentTaskMembershipExistingSourceCountQuery,
  buildWeightedParentTaskMembershipMaterializationSql,
  buildWeightedParentTaskMembershipReconciliationQuery,
  validateWeightedParentTaskMembershipMaterializationInput,
  verifyWeightedParentTaskMembershipReconciliation
} from './weighted-parent-task-membership-materialization-lib.mjs';
import {
  ACTIVITY_CANDIDATE_SOURCE_FACT_KIND,
  ACTIVITY_CANDIDATE_SOURCE_INPUT_DOMAIN,
  buildActivityCandidateSourceExistingSourceCountQuery,
  buildActivityCandidateSourceMaterializationSql,
  buildActivityCandidateSourceReconciliationQuery,
  validateActivityCandidateSourceMaterializationInput,
  verifyActivityCandidateSourceReconciliation
} from './activity-candidate-source-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SOURCE_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_SOURCE_INPUT_DOMAIN,
  buildActivityReferenceMemberSourceExistingSourceCountQuery,
  buildActivityReferenceMemberSourceMaterializationSql,
  buildActivityReferenceMemberSourceReconciliationQuery,
  validateActivityReferenceMemberSourceMaterializationInput,
  verifyActivityReferenceMemberSourceReconciliation
} from './activity-reference-collection-member-source-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_INPUT_DOMAIN,
  buildActivityReferenceMemberCanonicalIdentityExistingSourceCountQuery,
  buildActivityReferenceMemberCanonicalIdentityMaterializationSql,
  buildActivityReferenceMemberCanonicalIdentityReconciliationQuery,
  validateActivityReferenceMemberCanonicalIdentityMaterializationInput,
  verifyActivityReferenceMemberCanonicalIdentityReconciliation
} from './activity-reference-member-canonical-activity-identity-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_COLLECTION_IDENTITY_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_COLLECTION_IDENTITY_INPUT_DOMAIN,
  buildActivityReferenceMemberCollectionIdentityExistingSourceCountQuery,
  buildActivityReferenceMemberCollectionIdentityMaterializationSql,
  buildActivityReferenceMemberCollectionIdentityReconciliationQuery,
  validateActivityReferenceMemberCollectionIdentityMaterializationInput,
  verifyActivityReferenceMemberCollectionIdentityReconciliation
} from './activity-reference-member-collection-activity-identity-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_INPUT_DOMAIN,
  buildActivityReferenceMemberRepeatabilityExistingSourceCountQuery,
  buildActivityReferenceMemberRepeatabilityMaterializationSql,
  buildActivityReferenceMemberRepeatabilityReconciliationQuery,
  validateActivityReferenceMemberRepeatabilityMaterializationInput,
  verifyActivityReferenceMemberRepeatabilityReconciliation
} from './activity-reference-member-repeatability-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_INPUT_DOMAIN,
  buildActivityReferenceMemberUnresolvedRelationshipExistingSourceCountQuery,
  buildActivityReferenceMemberUnresolvedRelationshipMaterializationSql,
  buildActivityReferenceMemberUnresolvedRelationshipReconciliationQuery,
  validateActivityReferenceMemberUnresolvedRelationshipMaterializationInput,
  verifyActivityReferenceMemberUnresolvedRelationshipReconciliation
} from './activity-reference-member-unresolved-subject-relationship-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_INPUT_DOMAIN,
  buildActivityReferenceMemberSubjectExactLineExistingSourceCountQuery,
  buildActivityReferenceMemberSubjectExactLineMaterializationSql,
  buildActivityReferenceMemberSubjectExactLineReconciliationQuery,
  validateActivityReferenceMemberSubjectExactLineMaterializationInput,
  verifyActivityReferenceMemberSubjectExactLineReconciliation
} from './activity-reference-member-canonical-activity-subject-declaration-exact-line-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_INPUT_DOMAIN,
  buildActivityReferenceMemberSubjectStructuralContextExistingSourceCountQuery,
  buildActivityReferenceMemberSubjectStructuralContextMaterializationSql,
  buildActivityReferenceMemberSubjectStructuralContextReconciliationQuery,
  validateActivityReferenceMemberSubjectStructuralContextMaterializationInput,
  verifyActivityReferenceMemberSubjectStructuralContextReconciliation
} from './activity-reference-member-canonical-activity-subject-declaration-structural-context-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_INPUT_DOMAIN,
  buildActivityReferenceMemberSignalScopeExistingSourceCountQuery,
  buildActivityReferenceMemberSignalScopeMaterializationSql,
  buildActivityReferenceMemberSignalScopeReconciliationQuery,
  validateActivityReferenceMemberSignalScopeMaterializationInput,
  verifyActivityReferenceMemberSignalScopeReconciliation
} from './activity-reference-member-independent-repeatability-signal-scope-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_INPUT_DOMAIN,
  buildActivityReferenceMemberSignalSubjectPredicateExistingSourceCountQuery,
  buildActivityReferenceMemberSignalSubjectPredicateMaterializationSql,
  buildActivityReferenceMemberSignalSubjectPredicateReconciliationQuery,
  validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput,
  verifyActivityReferenceMemberSignalSubjectPredicateReconciliation
} from './activity-reference-member-independent-repeatability-signal-subject-predicate-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_INPUT_DOMAIN,
  buildActivityReferenceMemberIndependentSourceExistingSourceCountQuery,
  buildActivityReferenceMemberIndependentSourceMaterializationSql,
  buildActivityReferenceMemberIndependentSourceReconciliationQuery,
  validateActivityReferenceMemberIndependentSourceMaterializationInput,
  verifyActivityReferenceMemberIndependentSourceReconciliation
} from './activity-reference-member-independent-repeatability-source-evidence-materialization-lib.mjs';
import {
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND,
  ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_INPUT_DOMAIN,
  buildActivityReferenceMemberRepeatabilityGapExistingSourceCountQuery,
  buildActivityReferenceMemberRepeatabilityGapMaterializationSql,
  buildActivityReferenceMemberRepeatabilityGapReconciliationQuery,
  validateActivityReferenceMemberRepeatabilityGapMaterializationInput,
  verifyActivityReferenceMemberRepeatabilityGapReconciliation
} from './activity-reference-member-repeatability-gap-evidence-materialization-lib.mjs';
import {
  ACTIVITY_INFOBOX_SCHEMA_FACT_KIND,
  ACTIVITY_INFOBOX_SCHEMA_INPUT_DOMAIN,
  buildActivityInfoboxSchemaExistingSourceCountQuery,
  buildActivityInfoboxSchemaMaterializationSql,
  buildActivityInfoboxSchemaReconciliationQuery,
  validateActivityInfoboxSchemaMaterializationInput,
  verifyActivityInfoboxSchemaReconciliation
} from './activity-infobox-schema-semantics-evidence-materialization-lib.mjs';
import {
  CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND,
  CROSS_SKILL_UNTYPED_PAGE_SOURCE_INPUT_DOMAIN,
  buildCrossSkillUntypedPageSourceExistingSourceCountQuery,
  buildCrossSkillUntypedPageSourceMaterializationSql,
  buildCrossSkillUntypedPageSourceReconciliationQuery,
  validateCrossSkillUntypedPageSourceMaterializationInput,
  verifyCrossSkillUntypedPageSourceReconciliation
} from './cross-skill-untyped-page-source-evidence-materialization-lib.mjs';

export const ACCEPTED_EVIDENCE_REGISTRY_CONTRACT = 'sensum.accepted-evidence-materialization-registry.v1';

const adapters = [
  {
    domain: 'skill-level-unlock-inventory',
    dataFile: 'skill-level-unlock-inventory.ndjson',
    auditDirectory: 'skill-level-unlock-inventory-audits',
    auditContract: 'sensum.skill-level-unlock-inventory-audit.v1',
    factKind: RAW_STATEMENT_FACT_KIND,
    snapshotDirectory: audit => audit?.inputSnapshot?.directory,
    validate: validateSkillUnlockMaterializationInput,
    buildSql: buildSkillUnlockMaterializationSql,
    buildReconciliationQuery,
    verifyReconciliation
  },
  {
    domain: ACTIVITY_SCOPE_INPUT_DOMAIN,
    dataFile: 'activity-canonical-subject-scope-evidence.ndjson',
    auditDirectory: 'activity-canonical-subject-scope-evidence-audits',
    auditContract: 'sensum.activity-canonical-subject-scope-evidence-audit.v1',
    factKind: ACTIVITY_SCOPE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivitySubjectScopeMaterializationInput,
    buildSql: buildActivitySubjectScopeMaterializationSql,
    buildExistingSourceCountQuery: buildActivitySubjectScopeExistingSourceCountQuery,
    buildReconciliationQuery: buildActivitySubjectScopeReconciliationQuery,
    verifyReconciliation: verifyActivitySubjectScopeReconciliation
  },
  {
    domain: WEIGHTED_PARENT_TASK_INPUT_DOMAIN,
    dataFile: 'weighted-parent-task-entry-membership-evidence.ndjson',
    auditDirectory: 'weighted-parent-task-entry-membership-evidence-audits',
    auditContract: 'sensum.weighted-parent-task-entry-membership-evidence-audit.v1',
    factKind: WEIGHTED_PARENT_TASK_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateWeightedParentTaskMembershipMaterializationInput,
    buildSql: buildWeightedParentTaskMembershipMaterializationSql,
    buildExistingSourceCountQuery: buildWeightedParentTaskMembershipExistingSourceCountQuery,
    buildReconciliationQuery: buildWeightedParentTaskMembershipReconciliationQuery,
    verifyReconciliation: verifyWeightedParentTaskMembershipReconciliation
  },
  {
    domain: ACTIVITY_CANDIDATE_SOURCE_INPUT_DOMAIN,
    dataFile: 'activity-candidate-source-evidence.ndjson',
    auditDirectory: 'activity-candidate-source-evidence-audits',
    auditContract: 'sensum.activity-candidate-source-evidence-audit.v1',
    factKind: ACTIVITY_CANDIDATE_SOURCE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityCandidateSourceMaterializationInput,
    buildSql: buildActivityCandidateSourceMaterializationSql,
    buildExistingSourceCountQuery: buildActivityCandidateSourceExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityCandidateSourceReconciliationQuery,
    verifyReconciliation: verifyActivityCandidateSourceReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_SOURCE_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-source-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-source-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-source-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_SOURCE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberSourceMaterializationInput,
    buildSql: buildActivityReferenceMemberSourceMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberSourceExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberSourceReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberSourceReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-canonical-activity-identity-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-canonical-activity-identity-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-canonical-activity-identity-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_CANONICAL_IDENTITY_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberCanonicalIdentityMaterializationInput,
    buildSql: buildActivityReferenceMemberCanonicalIdentityMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberCanonicalIdentityExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberCanonicalIdentityReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberCanonicalIdentityReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_COLLECTION_IDENTITY_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-collection-activity-identity-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-collection-activity-identity-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-collection-activity-identity-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_COLLECTION_IDENTITY_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberCollectionIdentityMaterializationInput,
    buildSql: buildActivityReferenceMemberCollectionIdentityMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberCollectionIdentityExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberCollectionIdentityReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberCollectionIdentityReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-repeatability-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-repeatability-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-repeatability-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberRepeatabilityMaterializationInput,
    buildSql: buildActivityReferenceMemberRepeatabilityMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberRepeatabilityExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberRepeatabilityReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberRepeatabilityReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-unresolved-subject-relationship-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-unresolved-subject-relationship-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-unresolved-subject-relationship-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_UNRESOLVED_RELATIONSHIP_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberUnresolvedRelationshipMaterializationInput,
    buildSql: buildActivityReferenceMemberUnresolvedRelationshipMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberUnresolvedRelationshipExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberUnresolvedRelationshipReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberUnresolvedRelationshipReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-exact-line-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_SUBJECT_EXACT_LINE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberSubjectExactLineMaterializationInput,
    buildSql: buildActivityReferenceMemberSubjectExactLineMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberSubjectExactLineExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberSubjectExactLineReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberSubjectExactLineReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_SUBJECT_STRUCTURAL_CONTEXT_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberSubjectStructuralContextMaterializationInput,
    buildSql: buildActivityReferenceMemberSubjectStructuralContextMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberSubjectStructuralContextExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberSubjectStructuralContextReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberSubjectStructuralContextReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-independent-repeatability-signal-scope-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-scope-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_SIGNAL_SCOPE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberSignalScopeMaterializationInput,
    buildSql: buildActivityReferenceMemberSignalScopeMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberSignalScopeExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberSignalScopeReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberSignalScopeReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-independent-repeatability-signal-subject-predicate-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_SIGNAL_SUBJECT_PREDICATE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberSignalSubjectPredicateMaterializationInput,
    buildSql: buildActivityReferenceMemberSignalSubjectPredicateMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberSignalSubjectPredicateExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberSignalSubjectPredicateReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberSignalSubjectPredicateReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-independent-repeatability-source-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-independent-repeatability-source-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-independent-repeatability-source-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_INDEPENDENT_SOURCE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberIndependentSourceMaterializationInput,
    buildSql: buildActivityReferenceMemberIndependentSourceMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberIndependentSourceExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberIndependentSourceReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberIndependentSourceReconciliation
  },
  {
    domain: ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_INPUT_DOMAIN,
    dataFile: 'activity-reference-collection-member-repeatability-gap-evidence.ndjson',
    auditDirectory: 'activity-reference-collection-member-repeatability-gap-evidence-audits',
    auditContract: 'sensum.activity-reference-collection-member-repeatability-gap-evidence-audit.v1',
    factKind: ACTIVITY_REFERENCE_MEMBER_REPEATABILITY_GAP_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityReferenceMemberRepeatabilityGapMaterializationInput,
    buildSql: buildActivityReferenceMemberRepeatabilityGapMaterializationSql,
    buildExistingSourceCountQuery: buildActivityReferenceMemberRepeatabilityGapExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityReferenceMemberRepeatabilityGapReconciliationQuery,
    verifyReconciliation: verifyActivityReferenceMemberRepeatabilityGapReconciliation
  },
  {
    domain: ACTIVITY_INFOBOX_SCHEMA_INPUT_DOMAIN,
    dataFile: 'activity-infobox-schema-semantics-evidence.ndjson',
    auditDirectory: 'activity-infobox-schema-semantics-evidence-audits',
    auditContract: 'sensum.activity-infobox-schema-semantics-evidence-audit.v1',
    factKind: ACTIVITY_INFOBOX_SCHEMA_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivityInfoboxSchemaMaterializationInput,
    buildSql: buildActivityInfoboxSchemaMaterializationSql,
    buildExistingSourceCountQuery: buildActivityInfoboxSchemaExistingSourceCountQuery,
    buildReconciliationQuery: buildActivityInfoboxSchemaReconciliationQuery,
    verifyReconciliation: verifyActivityInfoboxSchemaReconciliation
  },
  {
    domain: CROSS_SKILL_UNTYPED_PAGE_SOURCE_INPUT_DOMAIN,
    dataFile: 'cross-skill-untyped-page-source-evidence.ndjson',
    auditDirectory: 'cross-skill-untyped-page-source-evidence-audits',
    auditContract: 'sensum.cross-skill-untyped-page-source-evidence-audit.v1',
    factKind: CROSS_SKILL_UNTYPED_PAGE_SOURCE_FACT_KIND,
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateCrossSkillUntypedPageSourceMaterializationInput,
    buildSql: buildCrossSkillUntypedPageSourceMaterializationSql,
    buildExistingSourceCountQuery: buildCrossSkillUntypedPageSourceExistingSourceCountQuery,
    buildReconciliationQuery: buildCrossSkillUntypedPageSourceReconciliationQuery,
    verifyReconciliation: verifyCrossSkillUntypedPageSourceReconciliation
  }
];

const registry = new Map(adapters.map(adapter => [adapter.domain, Object.freeze(adapter)]));
if (registry.size !== adapters.length) throw new Error('accepted_evidence_registry_duplicate_domain');
for (const adapter of adapters) {
  for (const field of ['domain','dataFile','auditDirectory','auditContract','factKind','snapshotDirectory','validate','buildSql','buildReconciliationQuery','verifyReconciliation']) {
    if (!adapter[field]) throw new Error(`accepted_evidence_registry_adapter_incomplete:${adapter.domain}:${field}`);
  }
}

export function acceptedEvidenceDomains() {
  return [...registry.keys()].sort();
}

export function getAcceptedEvidenceAdapter(domain) {
  const adapter = registry.get(domain);
  if (!adapter) throw new Error(`unsupported_accepted_evidence_domain:${domain}; supported=${acceptedEvidenceDomains().join(',')}`);
  return adapter;
}
