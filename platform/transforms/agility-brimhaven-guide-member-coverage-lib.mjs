const unique=values=>[...new Set(values)];
const normalized=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function auditAgilityBrimhavenGuideMemberCoverage({members=[],guideCandidates=[],vectors=[]}){
  const guideRevisions=unique(members.map(member=>member.sourceRevision).filter(Boolean)),sectionKey=unique(members.map(member=>member.sectionKey).filter(Boolean))[0]||null,sectionCandidates=guideCandidates.filter(candidate=>candidate.source_section_key===sectionKey),memberDetails=members.map(member=>{
    const candidateRows=sectionCandidates.filter(candidate=>candidate.candidate_key===member.candidateKey),vectorTokens=member.memberKey.endsWith('pillars-with-floor-spike-downtime')?['brimhaven agility arena','active floor spikes']:member.memberKey.endsWith('detached-camera-floor-spikes')?['brimhaven agility arena','detached camera floor spikes']:[],vectorRows=vectorTokens.length?vectors.filter(vector=>vectorTokens.every(token=>normalized(vector.name).includes(token))):[],blockers=[];
    if(candidateRows.length!==1)blockers.push(candidateRows.length?'duplicate_same_revision_guide_candidates':'same_revision_guide_candidate_missing');
    if(candidateRows.some(candidate=>candidate.source_revision!==member.sourceRevision))blockers.push('guide_candidate_revision_mismatch');
    return {memberKey:member.memberKey,candidateKey:member.candidateKey,name:member.name,sourceOrder:member.sourceOrder,strategyPolicy:member.strategyPolicy,guideCandidateKeys:candidateRows.map(candidate=>candidate.candidate_key),vectorScenarioKeys:vectorRows.map(vector=>vector.scenarioKey),optionalPolicyAxes:member.optionalPolicyAxes||[],modifierAxes:member.modifierAxes||[],sourceRevision:member.sourceRevision,sourceUrl:member.sourceUrl,sourceLocator:member.sourceLocator,status:blockers.length?'member_coverage_blocked':'member_identity_covered',blockers};
  }),expectedCandidateKeys=new Set(members.map(member=>member.candidateKey)),unexpectedSectionCandidateKeys=unique(sectionCandidates.filter(candidate=>!expectedCandidateKeys.has(candidate.candidate_key)).map(candidate=>candidate.candidate_key)),uncovered=memberDetails.filter(member=>member.blockers.length),blockers=[];
  if(guideRevisions.length!==1)blockers.push('guide_member_revision_scope_invalid');
  if(unique(members.map(member=>member.sectionKey)).length!==1)blockers.push('guide_member_section_scope_invalid');
  if(members.length!==3)blockers.push('expected_three_brimhaven_strategy_members');
  if(uncovered.length)blockers.push('one_or_more_brimhaven_members_lack_exact_same_revision_candidate_coverage');
  if(unexpectedSectionCandidateKeys.length)blockers.push('guide_section_candidate_not_present_in_member_inventory');
  const internalMemberAuditSatisfied=!blockers.length;
  return {contract:'sensum.agility-brimhaven-guide-member-coverage-audit.v1',sectionKey,guideSourceRevision:guideRevisions.length===1?guideRevisions[0]:null,memberCount:members.length,coveredMemberCount:memberDetails.length-uncovered.length,uncoveredMemberCount:uncovered.length,sectionCandidateCount:sectionCandidates.length,linkedVectorCount:unique(memberDetails.flatMap(member=>member.vectorScenarioKeys)).length,memberIdentityCoverageOnly:true,variantCompletenessProven:false,mechanicalCompletenessProven:false,memberDetails,unexpectedSectionCandidateKeys,internalMemberAuditSatisfied,blockers,absoluteBestGate:internalMemberAuditSatisfied?'member_identity_coverage_satisfied_only':'blocked_incomplete_brimhaven_member_identity_coverage'};
}
