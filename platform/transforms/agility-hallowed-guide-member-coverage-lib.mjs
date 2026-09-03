const unique=values=>[...new Set(values)];
export const HALLOWED_SECTION_KEY='fastest-experience:levels-62-99-hallowed-sepulchre';
export const HALLOWED_GUIDE_CANDIDATE_KEY='guide:hallowed-sepulchre';
export const HALLOWED_FLOOR_POLICY_KEYS=[1,2,3,4,5].flatMap(floor=>['looting','no_looting'].map(policy=>`hallowed-sepulchre:floor-${floor}:${policy}`));
export const HALLOWED_EQUIPMENT_KEYS=['hallowed-equipment:obelisk:saradomin-item','hallowed-equipment:coffin:lockpick','hallowed-equipment:coffin:strange-old-lockpick','hallowed-equipment:bridge:standard','hallowed-equipment:bridge:crystal-saw','hallowed-equipment:bridge:hallowed-hammer','hallowed-equipment:brazier:standard','hallowed-equipment:brazier:hallowed-symbol','hallowed-equipment:portal:standard','hallowed-equipment:portal:hallowed-focus','hallowed-equipment:pillar:standard','hallowed-equipment:pillar:hallowed-grapple','hallowed-equipment:traps:hallowed-ring'];
const sameSet=(actual,expected)=>actual.length===expected.length&&actual.every(value=>expected.includes(value));

export function auditAgilityHallowedGuideMemberCoverage({guideCandidates=[],floorPolicyVariants=[],equipmentMembers=[],vectors=[]}){
  const blockers=[],guideRows=guideCandidates.filter(candidate=>candidate.candidate_key===HALLOWED_GUIDE_CANDIDATE_KEY&&candidate.source_section_key===HALLOWED_SECTION_KEY),guideRevisions=unique(guideRows.map(row=>row.source_revision).filter(Boolean));
  if(guideRows.length!==1)blockers.push(guideRows.length?'duplicate_hallowed_guide_candidates':'hallowed_guide_candidate_missing');
  if(guideRevisions.length!==1)blockers.push('hallowed_guide_revision_scope_invalid');
  const guideAxes=unique(guideRows.flatMap(row=>row.composite_variant_axes||[]));
  if(!sameSet(guideAxes,['maximum_floor','looting_policy','equipment_state']))blockers.push('hallowed_guide_composite_axes_incomplete_or_changed');

  const floorRows=floorPolicyVariants.filter(row=>row.parent_name==='Hallowed Sepulchre'),floorRevisions=unique(floorRows.map(row=>row.source_revision).filter(Boolean)),floorKeys=floorRows.map(row=>row.record_key),unexpectedFloorPolicyKeys=unique(floorKeys.filter(key=>!HALLOWED_FLOOR_POLICY_KEYS.includes(key))),hallowedVectors=vectors.filter(vector=>String(vector.recordKey||'').startsWith('hallowed-sepulchre:floor-')),unexpectedVectorKeys=unique(hallowedVectors.map(vector=>vector.recordKey).filter(key=>!HALLOWED_FLOOR_POLICY_KEYS.includes(key)));
  if(floorRevisions.length!==1)blockers.push('hallowed_floor_policy_revision_scope_invalid');
  if(unexpectedFloorPolicyKeys.length)blockers.push('unexpected_hallowed_floor_policy_member');
  if(unexpectedVectorKeys.length)blockers.push('unexpected_hallowed_floor_policy_vector');
  const memberDetails=HALLOWED_FLOOR_POLICY_KEYS.map(recordKey=>{
    const rows=floorRows.filter(row=>row.record_key===recordKey),revision=rows[0]?.source_revision||null,vectorRows=hallowedVectors.filter(vector=>vector.recordKey===recordKey),memberBlockers=[];
    if(rows.length!==1)memberBlockers.push(rows.length?'duplicate_hallowed_floor_policy_member':'hallowed_floor_policy_member_missing');
    if(vectorRows.length!==1)memberBlockers.push(vectorRows.length?'duplicate_hallowed_floor_policy_vector':'hallowed_floor_policy_vector_missing');
    if(vectorRows.some(vector=>vector.sourceRevision!==revision))memberBlockers.push('hallowed_floor_policy_vector_revision_mismatch');
    return {recordKey,floor:rows[0]?.floor||null,lootingPolicy:rows[0]?.looting_policy||null,entryLevel:rows[0]?.entry_level||null,observedXpPerHour:rows[0]?.observed_xp_per_hour||null,sourceRevision:revision,vectorScenarioKeys:vectorRows.map(vector=>vector.scenarioKey),status:memberBlockers.length?'member_coverage_blocked':'member_identity_covered',blockers:memberBlockers};
  });
  if(memberDetails.some(member=>member.blockers.length))blockers.push('one_or_more_hallowed_floor_policy_members_incomplete');
  if(unique(memberDetails.map(member=>member.floor).filter(Boolean)).length!==5||unique(memberDetails.map(member=>member.lootingPolicy).filter(Boolean)).length!==2)blockers.push('five_floor_two_policy_cross_product_not_proven');

  const equipmentRows=equipmentMembers.filter(row=>row.parent_name==='Hallowed Sepulchre'),equipmentRevisions=unique(equipmentRows.map(row=>row.source_revision).filter(Boolean)),equipmentKeys=equipmentRows.map(row=>row.record_key),unexpectedEquipmentKeys=unique(equipmentKeys.filter(key=>!HALLOWED_EQUIPMENT_KEYS.includes(key)));
  if(equipmentRevisions.length!==1)blockers.push('hallowed_equipment_revision_scope_invalid');
  if(floorRevisions.length===1&&equipmentRevisions.length===1&&floorRevisions[0]!==equipmentRevisions[0])blockers.push('hallowed_detail_page_revision_mismatch');
  if(unexpectedEquipmentKeys.length)blockers.push('unexpected_hallowed_equipment_member');
  const equipmentDetails=HALLOWED_EQUIPMENT_KEYS.map(recordKey=>{const rows=equipmentRows.filter(row=>row.record_key===recordKey),memberBlockers=[];if(rows.length!==1)memberBlockers.push(rows.length?'duplicate_hallowed_equipment_member':'hallowed_equipment_member_missing');return {recordKey,recordKind:rows[0]?.record_kind||null,encounter:rows[0]?.encounter||null,sourceRevision:rows[0]?.source_revision||null,status:memberBlockers.length?'member_coverage_blocked':'member_identity_covered',blockers:memberBlockers}});
  if(equipmentDetails.some(member=>member.blockers.length))blockers.push('one_or_more_hallowed_equipment_members_incomplete');
  const internalMemberAuditSatisfied=blockers.length===0;
  return {contract:'sensum.agility-hallowed-guide-member-coverage-audit.v1',sectionKey:HALLOWED_SECTION_KEY,guideCandidateKey:HALLOWED_GUIDE_CANDIDATE_KEY,guideSourceRevision:guideRevisions.length===1?guideRevisions[0]:null,hallowedSourceRevision:floorRevisions.length===1&&equipmentRevisions.length===1&&floorRevisions[0]===equipmentRevisions[0]?floorRevisions[0]:null,memberCount:floorRows.length,coveredMemberCount:memberDetails.filter(member=>!member.blockers.length).length,floorCount:unique(memberDetails.map(member=>member.floor).filter(Boolean)).length,lootingPolicyCount:unique(memberDetails.map(member=>member.lootingPolicy).filter(Boolean)).length,vectorMatchCount:unique(memberDetails.flatMap(member=>member.vectorScenarioKeys)).length,equipmentMemberCount:equipmentRows.length,coveredEquipmentMemberCount:equipmentDetails.filter(member=>!member.blockers.length).length,floorPolicyIdentityCoverageOnly:true,equipmentModifierCatalogLinked:true,variantCompletenessProven:false,mechanicalCompletenessProven:false,memberDetails,equipmentDetails,unexpectedFloorPolicyKeys,unexpectedVectorKeys,unexpectedEquipmentKeys,internalMemberAuditSatisfied,blockers,absoluteBestGate:internalMemberAuditSatisfied?'member_identity_coverage_satisfied_only':'blocked_incomplete_hallowed_member_identity_coverage'};
}
