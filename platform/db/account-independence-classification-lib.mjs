export const ACCOUNT_INDEPENDENCE_CLASSIFICATION_CONTRACT='sensum.accepted-evidence-account-independence-classification.v1';

const forbiddenAccountKey=name=>/^(?:currentBaseLevel|targetBaseLevel|accountLevel|accountState|accountSnapshot|accountName|accountSkills|accountStats|accountQuestState|bankContents|ownedItems|ownedItemIds|ownedEquipment|playerName|characterName|username|rsn|preferences)$/i.test(String(name||''));

function joinPath(parent,key) {
  return /^\d+$/.test(String(key))?`${parent}[${key}]`:`${parent}.${key}`;
}

export function accountScopedPaths(value,path='$') {
  const found=[];
  if(Array.isArray(value)) {
    value.forEach((child,index)=>found.push(...accountScopedPaths(child,joinPath(path,index))));
    return found;
  }
  if(!value||typeof value!=='object') return found;
  for(const [key,child] of Object.entries(value)) {
    const childPath=joinPath(path,key);
    if(key==='accountIndependent') continue;
    if(key==='accountStateFindings') {
      if(!Array.isArray(child)||child.length) found.push(childPath);
      continue;
    }
    if(forbiddenAccountKey(key)) found.push(childPath);
    else found.push(...accountScopedPaths(child,childPath));
  }
  return found;
}

export function classifyAcceptedEvidenceAccountIndependence({audit,manifest,records}) {
  const blockers=[];
  if(!audit||typeof audit!=='object') blockers.push('audit_missing');
  if(!manifest||typeof manifest!=='object') blockers.push('manifest_missing');
  if(!Array.isArray(records)) blockers.push('records_missing');

  const declaration=audit?.accountIndependent;
  const findings=audit?.accountStateFindings;
  if(declaration!==undefined&&declaration!==true&&declaration!==false) blockers.push('audit_account_independence_declaration_invalid');
  if(declaration===false) blockers.push('audit_declares_account_dependent');
  else if(declaration!==true&&!Array.isArray(findings)) blockers.push('audit_lacks_account_independence_evidence');
  if(Array.isArray(findings)&&findings.length) blockers.push('audit_account_state_findings_present');
  if(findings!==undefined&&!Array.isArray(findings)) blockers.push('audit_account_state_findings_invalid');

  const auditPaths=accountScopedPaths(audit,'$.audit');
  const manifestPaths=accountScopedPaths(manifest,'$.manifest');
  const recordPaths=accountScopedPaths(records,'$.records');
  if(auditPaths.length) blockers.push('account_state_present_in_audit');
  if(manifestPaths.length) blockers.push('account_state_present_in_manifest');
  if(recordPaths.length) blockers.push('account_state_present');

  const uniqueBlockers=[...new Set(blockers)];
  return {
    contract:ACCOUNT_INDEPENDENCE_CLASSIFICATION_CONTRACT,
    proven:uniqueBlockers.length===0,
    basis:declaration===true?'explicit_audit_declaration_plus_full_structural_scan':Array.isArray(findings)?'empty_audit_findings_plus_full_structural_scan':'insufficient',
    auditDeclaration:declaration===true?true:declaration===false?false:null,
    auditFindingCount:Array.isArray(findings)?findings.length:null,
    scannedRecordCount:Array.isArray(records)?records.length:0,
    prohibitedPaths:{audit:auditPaths,manifest:manifestPaths,records:recordPaths},
    blockers:uniqueBlockers
  };
}
