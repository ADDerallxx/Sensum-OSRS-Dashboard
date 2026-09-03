const rooftopName=value=>String(value||'').match(/^(.+? Rooftop Course)(?:\s+—.*)?$/)?.[1]||null;
const unique=values=>[...new Set(values)];

export function auditAgilityRooftopGuideMemberCoverage({members=[],courseTable=[],guideCandidates=[],vectors=[]}){
  const guideRevisions=unique(members.map(member=>member.sourceRevision).filter(Boolean)),tableNames=courseTable.map(row=>row.name).filter(Boolean),memberNames=members.map(member=>member.courseName),rooftopVectors=vectors.filter(vector=>rooftopName(vector.name)),memberDetails=members.map(member=>{
    const tableRows=courseTable.filter(row=>row.name===member.courseName),candidateRows=guideCandidates.filter(candidate=>rooftopName(candidate.name)===member.courseName),vectorRows=rooftopVectors.filter(vector=>rooftopName(vector.name)===member.courseName),blockers=[];
    if(tableRows.length!==1)blockers.push(tableRows.length?'duplicate_structured_course_records':'structured_course_record_missing');
    if(!vectorRows.length)blockers.push('detailed_activity_vector_missing');
    return {memberKey:member.memberKey,courseName:member.courseName,sourceOrder:member.sourceOrder,guideLevelScopeLabel:member.guideLevelScopeLabel,structuredCourseRecordKeys:tableRows.map(row=>row.record_key),guideCandidateKeys:candidateRows.map(row=>row.candidate_key),vectorScenarioKeys:vectorRows.map(row=>row.scenarioKey),sourceRevision:member.sourceRevision,sourceUrl:member.sourceUrl,sourceLocator:member.sourceLocator,status:blockers.length?'member_coverage_blocked':'member_identity_covered',blockers};
  }),unexpectedStructuredCourseNames=unique(tableNames.filter(name=>!memberNames.includes(name))),unexpectedVectorCourseNames=unique(rooftopVectors.map(vector=>rooftopName(vector.name)).filter(name=>!memberNames.includes(name))),uncovered=memberDetails.filter(member=>member.blockers.length),blockers=[];
  if(guideRevisions.length!==1)blockers.push('guide_member_revision_scope_invalid');
  if(uncovered.length)blockers.push('one_or_more_rooftop_members_lack_structured_or_vector_coverage');
  if(unexpectedStructuredCourseNames.length)blockers.push('structured_course_not_present_in_guide_member_inventory');
  if(unexpectedVectorCourseNames.length)blockers.push('rooftop_vector_not_present_in_guide_member_inventory');
  const internalMemberAuditSatisfied=!blockers.length&&members.length===9;
  return {contract:'sensum.agility-rooftop-guide-member-coverage-audit.v1',sectionKey:'other-methods:levels-1-99-rooftop-agility-courses',guideSourceRevision:guideRevisions.length===1?guideRevisions[0]:null,memberCount:members.length,coveredMemberCount:memberDetails.length-uncovered.length,uncoveredMemberCount:uncovered.length,structuredCourseCount:courseTable.length,rooftopVectorCount:rooftopVectors.length,guideCandidateMemberCount:memberDetails.filter(member=>member.guideCandidateKeys.length).length,memberIdentityCoverageOnly:true,variantAndMechanicalCompletenessProven:false,variantCoverageGate:'separate_activity_variant_and_mechanical_audits',unexpectedStructuredCourseNames,unexpectedVectorCourseNames,memberDetails,internalMemberAuditSatisfied,blockers,absoluteBestGate:internalMemberAuditSatisfied?'member_identity_coverage_satisfied_only':'blocked_incomplete_rooftop_member_identity_coverage'};
}
