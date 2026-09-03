import {skillingSuccessInterpolation} from '../formulas/skilling-success-v1.mjs';

const number=value=>Number(String(value||'').replace(/,/g,''));
const located=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,excerpt:match[0].slice(0,1800)}:null};
const source=(page,evidence)=>({sourceRevision:String(page.sourceRevision||''),sourceUrl:page.sourceUrl,sourceLocator:{line:evidence.line,excerpt:evidence.excerpt}});

export function parseBrimhavenFloorSpikeSuccessEvidence({obstaclePage,formulaPage,targetBaseAgility=34}){
  if(obstaclePage?.title!=='Floor spikes (Brimhaven Agility Arena)'||formulaPage?.title!=='Module:Skilling success chart')return [];
  const obstacle=obstaclePage.content||'',formulaContent=formulaPage.content||'',failureFree=located(obstacle,/Players will no longer fail this obstacle at level\s+(\d+)\s+\[\[Agility\]\]/i),entry=located(obstacle,/\{\{Agility info[\s\S]{0,500}?\|level\s*=\s*(\d+)/i),needsChart=located(obstacle,/\[\[Category:Needs skilling success chart\]\]/i),chart=located(obstacle,/\{\{Skilling success chart[\s\S]{0,1800}?\}\}/i),formula=located(formulaContent,/function p\.interp\(low, high, level\)[\s\S]{0,260}?return math\.min\(math\.max\(value \/ 256, 0\), 1\)/i);
  if(!failureFree||!entry||!formula||(!needsChart&&!chart))return [];
  const low=chart?.match[0].match(/\|low(?:1)?\s*=\s*(\d+)/i),high=chart?.match[0].match(/\|high(?:1)?\s*=\s*(\d+)/i),required=chart?.match[0].match(/\|req(?:1)?\s*=\s*(\d+)/i),entryLevel=number(entry.match[1]),failureFreeLevel=number(failureFree.match[1]),target=number(targetBaseAgility);
  if(!Number.isInteger(target)||target<1||target>99||failureFreeLevel<=entryLevel)return [];
  const parametersPublished=!!low&&!!high,requirementMatches=!required||number(required[1])===entryLevel,parameterStatusConflict=!!needsChart&&parametersPublished,targetAtOrAboveFailureFree=target>=failureFreeLevel,targetBelowEntry=target<entryLevel,interpolationUsable=parametersPublished&&requirementMatches&&!parameterStatusConflict&&!targetBelowEntry;
  const successProbability=targetAtOrAboveFailureFree?1:interpolationUsable?skillingSuccessInterpolation({low:number(low[1]),high:number(high[1]),level:target}):null;
  const targetConditionBlocker=targetBelowEntry?'target_below_floor_spike_entry_level':!requirementMatches?'success_interpolation_requirement_does_not_match_obstacle_entry':parameterStatusConflict?'success_chart_conflicts_with_needs_chart_marker':successProbability===null?'success_interpolation_low_high_parameters_not_published':null;
  const common={
    contract:'sensum.agility-floor-spike-success-evidence.v1',
    evidence_key:'condition:brimhaven:floor-spikes:success-interpolation',
    method_variant:'floor_spike_obstacle',
    entry_level:entryLevel,
    target_base_agility:target,
    failure_possible:true,
    failure_free_level:failureFreeLevel,
    failure_probability_published:successProbability!==null,
    success_formula_published:true,
    success_formula_kind:'wiki_skilling_success_interpolation',
    success_formula_parameters_published:parametersPublished,
    success_formula_parameters:parametersPublished?{low:number(low[1]),high:number(high[1])}:null,
    target_condition_kind:targetAtOrAboveFailureFree?'explicit_failure_free_threshold':successProbability!==null?'revision_pinned_formula':parametersPublished?'blocked_condition_mismatch':'blocked_missing_formula_parameters',
    success_probability_at_target:successProbability,
    failure_probability_at_target:successProbability===null?null:1-successProbability,
    target_condition_blocker:targetConditionBlocker,
    source_revision:String(obstaclePage.sourceRevision||''),
    supporting_source_revisions:[String(formulaPage.sourceRevision||'')].filter(Boolean),
    source_timestamp:obstaclePage.sourceTimestamp||null,
    source_url:obstaclePage.sourceUrl,
    source_locator:{entry:source(obstaclePage,entry),failureFree:source(obstaclePage,failureFree),parameterStatus:source(obstaclePage,needsChart||chart),formula:source(formulaPage,formula)},
    state:successProbability!==null?'candidate':'blocked'
  };
  return ['guide:brimhaven:floor-spikes-active','guide:brimhaven:floor-spikes-detached'].map(candidate_key=>({...common,candidate_key,evidence_key:`${common.evidence_key}:${candidate_key.split(':').at(-1)}`}));
}
