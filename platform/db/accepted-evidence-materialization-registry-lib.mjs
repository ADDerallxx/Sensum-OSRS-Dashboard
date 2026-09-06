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
