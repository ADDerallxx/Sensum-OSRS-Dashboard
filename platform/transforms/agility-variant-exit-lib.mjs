export function verifyAgilityVariantExpansion(audit){
  const blockers=[];
  if(audit?.contract!=='sensum.activity-variant-audit.v1')blockers.push('unexpected_audit_contract');
  if(audit?.completeCoverage!==true)blockers.push('coverage_not_complete');
  if(Number(audit?.pending)!==0)blockers.push('pending_findings');
  if((audit?.pendingPages||[]).length)blockers.push('pending_pages');
  if(Number(audit?.expanded)!==Number(audit?.findings)||!Number(audit?.findings))blockers.push('not_all_findings_expanded');
  if(Object.values(audit?.byAxis||{}).some(axis=>Number(axis.pending)!==0))blockers.push('axis_pending');
  if((audit?.variantSnapshotRejections||[]).length)blockers.push('variant_snapshot_rejections');
  if((audit?.details||[]).length!==Number(audit?.findings))blockers.push('finding_detail_count_mismatch');
  if((audit?.details||[]).some(row=>row.state!=='expanded'||!row.source_revision||!row.source_url||!row.source_locators?.length))blockers.push('untraceable_or_unexpanded_detail');
  if(audit?.absoluteBestActivityGate!=='eligible_for_next_gate')blockers.push('next_gate_not_eligible');
  return {contract:'sensum.agility-variant-expansion-exit.v1',passed:blockers.length===0,blockers,findings:Number(audit?.findings||0),expanded:Number(audit?.expanded||0),pending:Number(audit?.pending||0),axes:Object.keys(audit?.byAxis||{}).length,auditGeneratedAt:audit?.generatedAt||null,auditContentHash:audit?.contentHash||null,nextGate:audit?.absoluteBestActivityGate||null};
}
