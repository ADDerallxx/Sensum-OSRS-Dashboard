import {
  buildReconciliationQuery,
  buildSkillUnlockMaterializationSql,
  validateSkillUnlockMaterializationInput,
  verifyReconciliation
} from './skill-unlock-materialization-lib.mjs';
import {
  ACTIVITY_SCOPE_INPUT_DOMAIN,
  buildActivitySubjectScopeMaterializationSql,
  buildActivitySubjectScopeReconciliationQuery,
  validateActivitySubjectScopeMaterializationInput,
  verifyActivitySubjectScopeReconciliation
} from './activity-subject-scope-materialization-lib.mjs';

export const ACCEPTED_EVIDENCE_REGISTRY_CONTRACT = 'sensum.accepted-evidence-materialization-registry.v1';

const adapters = [
  {
    domain: 'skill-level-unlock-inventory',
    dataFile: 'skill-level-unlock-inventory.ndjson',
    auditDirectory: 'skill-level-unlock-inventory-audits',
    auditContract: 'sensum.skill-level-unlock-inventory-audit.v1',
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
    snapshotDirectory: audit => audit?.outputSnapshot?.directory,
    validate: validateActivitySubjectScopeMaterializationInput,
    buildSql: buildActivitySubjectScopeMaterializationSql,
    buildReconciliationQuery: buildActivitySubjectScopeReconciliationQuery,
    verifyReconciliation: verifyActivitySubjectScopeReconciliation
  }
];

const registry = new Map(adapters.map(adapter => [adapter.domain, Object.freeze(adapter)]));
if (registry.size !== adapters.length) throw new Error('accepted_evidence_registry_duplicate_domain');
for (const adapter of adapters) {
  for (const field of ['domain','dataFile','auditDirectory','auditContract','snapshotDirectory','validate','buildSql','buildReconciliationQuery','verifyReconciliation']) {
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
