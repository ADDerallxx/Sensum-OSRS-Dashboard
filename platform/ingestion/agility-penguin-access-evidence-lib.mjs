const located=(content,pattern)=>{const match=String(content||'').match(pattern);return match?{match,line:String(content||'').slice(0,match.index).split(/\r?\n/).length,excerpt:match[0].slice(0,1800)}:null};
const source=(page,evidence)=>({sourceRevision:String(page.sourceRevision||''),sourceTimestamp:page.sourceTimestamp||null,sourceUrl:page.sourceUrl,sourceLocator:{line:evidence.line,excerpt:evidence.excerpt}});

export function parsePenguinAccessReconciliationEvidence({coursePage,icebergPage,questPage,overviewPage}){
  if(coursePage?.title!=='Penguin Agility Course'||icebergPage?.title!=='Iceberg'||questPage?.title!=='Cold War'||overviewPage?.title!=='Agility')return null;
  const coursePartial=located(coursePage.content,/course is available to players with boosted level\s+30\s+\[\[Agility\]\] and partial completion of \[\[Cold War\]\]/i),courseAccess=located(coursePage.content,/Agility course requires a boostable level\s+30\s+\[\[Agility\]\][\s\S]{0,160}?requires partial completion of[\s\S]{0,80}?\[\[Cold War\]\] to access/i),icebergHalfway=located(icebergPage.content,/can only be accessed by those who have gone halfway through \[\[Cold War\]\]/i),questSequence=located(questPage.content,/Once inside,[\s\S]{0,420}?you will now have to complete an \[\[Penguin agility course\|agility course\]\]/i),questReentry=located(questPage.content,/You may re-enter the \[\[Penguin agility course\|agility course\]\] after completion of the quest/i),overviewCompletion=located(overviewPage.content,/This Agility course requires level\s+30\s+Agility[\s\S]{0,160}?requires completion of[\s\S]{0,80}?\[\[Cold War\]\] to access/i);
  if(!coursePartial||!courseAccess||!icebergHalfway||!questSequence||!questReentry||!overviewCompletion)return null;
  return {
    contract:'sensum.agility-penguin-access-reconciliation-evidence.v1',
    evidence_key:'eligibility:penguin-course:cold-war-progress-reconciliation',
    candidate_key:'agility-access:Penguin Agility Course:clockwork_suit',
    canonical_requirement:{
      quest:'Cold War',
      mode:'any_of',
      alternatives:[
        {state:'completed'},
        {state:'in_progress',milestone:'penguin_agility_course_access',stage_source:'Cold War quest guide',quest_start_alone_sufficient:false}
      ],
      minimum_progress:'reached_penguin_agility_course_during_quest',
      completion_also_satisfies:true,
      account_state_observability:'requires_completed_quest_or_explicit_progress_milestone'
    },
    discrepant_claim:{quest:'Cold War',state:'completion',scope:'general_agility_overview'},
    resolution:{status:'resolved',rule:'specific_course_location_and_quest_sequence_override_general_overview_summary',basis:['course_page_states_partial_completion_twice','location_page_states_halfway_through_quest','quest_guide_requires_course_before_quest_completion','quest_guide_separately_confirms_post_completion_reentry']},
    source_revision:String(coursePage.sourceRevision||''),
    supporting_source_revisions:[String(icebergPage.sourceRevision||''),String(questPage.sourceRevision||''),String(overviewPage.sourceRevision||'')].filter(Boolean),
    source_timestamp:coursePage.sourceTimestamp||null,
    source_url:coursePage.sourceUrl,
    source_locator:{courseIntro:source(coursePage,coursePartial),courseAccess:source(coursePage,courseAccess),icebergAccess:source(icebergPage,icebergHalfway),questSequence:source(questPage,questSequence),questReentry:source(questPage,questReentry),overviewSummary:source(overviewPage,overviewCompletion)},
    state:'candidate'
  };
}

export function reconcilePenguinAccessVariant(variant,{reconciliationEvidence=null,overviewEvidence=null}={}){
  if(variant?.parent_name!=='Penguin Agility Course')return variant;
  if(reconciliationEvidence?.resolution?.status==='resolved'){
    const requirement=reconciliationEvidence.canonical_requirement;
    return {
      ...variant,
      quest_progress_requirements:[requirement],
      requirements:[...(variant.requirements||[]).filter(item=>item!=='Partial completion of Cold War'),`Cold War: completed or reached ${requirement.alternatives[1].milestone.replace(/_/g,' ')} during the quest`],
      supporting_evidence:reconciliationEvidence,
      supporting_source_revisions:[...new Set([...(variant.supporting_source_revisions||[]),reconciliationEvidence.source_revision,...reconciliationEvidence.supporting_source_revisions])],
      resolved_source_discrepancies:[...(variant.resolved_source_discrepancies||[]),{claim:reconciliationEvidence.discrepant_claim,resolution:reconciliationEvidence.resolution}],
      source_conflicts:(variant.source_conflicts||[]).filter(item=>item.rule!=='quest_progress_requirement_conflict'),
      source_locator:{...variant.source_locator,supportingEvidence:reconciliationEvidence.source_locator}
    };
  }
  if(!overviewEvidence)return variant;
  return {
    ...variant,
    supporting_evidence:overviewEvidence,
    supporting_source_revisions:[...new Set([...(variant.supporting_source_revisions||[]),overviewEvidence.source_revision])],
    source_conflicts:[...(variant.source_conflicts||[]),{rule:'quest_progress_requirement_conflict',primary:{quest:'Cold War',state:'partial_completion',source_revision:String(variant.source_revision||'')},supporting:{quest:'Cold War',state:'completion',source_revision:overviewEvidence.source_revision},resolution:'unresolved'}]
  };
}
