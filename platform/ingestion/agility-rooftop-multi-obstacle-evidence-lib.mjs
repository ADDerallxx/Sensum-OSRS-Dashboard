const number=value=>Number(String(value||'').replace(/,/g,''));
const located=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,excerpt:match[0].slice(0,1800)}:null};
const source=(page,evidence)=>({sourceRevision:String(page.sourceRevision||''),sourceTimestamp:page.sourceTimestamp||null,sourceUrl:page.sourceUrl,sourceLocator:{line:evidence.line,excerpt:evidence.excerpt}});
function obstacleEvidence(page,{key,courseName,xpField='xp'}){
  const content=page?.content||'',info=located(content,/\{\{Agility info[\s\S]{0,900}?\}\}/i),description=located(content,/An Agility level of\s+(\d+)\s+is required to pass the obstacle[^\n]*/i);
  if(!info||!description)return null;
  const level=info.match[0].match(/\|level\s*=\s*(\d+)/i),xp=info.match[0].match(new RegExp(`\\|${xpField}\\s*=\\s*([\\d,.]+)`,'i'));
  if(!level||!xp||!info.match[0].includes(courseName))return null;
  const chart=located(content,/\{\{Skilling success chart[\s\S]{0,1800}?\}\}/i),needsChart=located(content,/\[\[Category:Needs skilling success chart\]\]/i);
  return {
    obstacle_key:key,
    source_page_title:page.title,
    requirement:{skill:'Agility',base_level:number(level[1])},
    xp_on_success:number(xp[1]),
    success_chart_present:!!chart,
    needs_success_chart_marker_present:!!needsChart,
    success_probability_evidence_status:chart?'chart_present_unverified':'not_published',
    source_revision:String(page.sourceRevision||''),
    source_url:page.sourceUrl,
    source_locator:{description:source(page,description),agilityInfo:source(page,info),...(chart||needsChart?{successChartStatus:source(page,chart||needsChart)}:{})}
  };
}

export function parseAlKharidMultiObstacleFailureEvidence({coursePage,tightropePage,zipLinePage}){
  if(coursePage?.title!=='Al Kharid Rooftop Course'||tightropePage?.title!=='Tightrope (Al Kharid Rooftop Course)'||zipLinePage?.title!=='Zip line (Al Kharid Rooftop Course)')return [];
  const course=coursePage.content||'',entry=located(course,/available to players with an \[\[Agility\]\] level of\s+(\d+)\s+or higher/i),lapXp=located(course,/Players get\s+([\d,.]+)\s+experience points from completing the course/i),failure=located(course,/possible to fail the ''([^']+)'' and ''([^']+)'' obstacles[\s\S]{0,100}?taking\s+(\d+)[–-](\d+)\s+damage each time/i),timing=located(course,/complete this course in\s+([\d.]+)\s+seconds\s+\((\d+)\s+ticks\)[\s\S]{0,100}?up to around\s+([\d,]+)\s+experience per hour/i),tightropeRow=located(course,/\[\[Tightrope \(Al Kharid Rooftop Course\)#Tightrope_1\|Tightrope 1\]\][\s\S]{0,120}?\{\{\+=\|xp\|([\d,.]+)\|echo=2\}\}[\s\S]{0,100}?\|Yes/i),zipRow=located(course,/\[\[Zip line \(Al Kharid Rooftop Course\)\|Zip line\]\][\s\S]{0,120}?\{\{\+=\|xp\|([\d,.]+)\|echo=2\}\}[\s\S]{0,100}?\|Yes/i);
  if(!entry||!lapXp||!failure||!timing||!tightropeRow||!zipRow)return [];
  const entryLevel=number(entry.match[1]),damage={minimum:number(failure.match[3]),maximum:number(failure.match[4])},tightrope=obstacleEvidence(tightropePage,{key:'tightrope_1',courseName:'Al Kharid Rooftop Course',xpField:'xp1'}),zipLine=obstacleEvidence(zipLinePage,{key:'zip_line',courseName:'Al Kharid Rooftop Course'});
  if(!tightrope||!zipLine)return [];
  const obstacleRows=[{...tightrope,course_label:failure.match[1],course_table_xp:number(tightropeRow.match[1]),damage},{...zipLine,course_label:failure.match[2],course_table_xp:number(zipRow.match[1]),damage}];
  const sourceConflicts=[];
  for(const obstacle of obstacleRows){
    if(obstacle.requirement.base_level!==entryLevel)sourceConflicts.push({rule:`${obstacle.obstacle_key}_requirement_disagrees_with_course_entry`,courseEntry:entryLevel,obstacleEntry:obstacle.requirement.base_level});
    if(obstacle.xp_on_success!==obstacle.course_table_xp)sourceConflicts.push({rule:`${obstacle.obstacle_key}_success_xp_disagrees_with_course_table`,courseXp:obstacle.course_table_xp,obstacleXp:obstacle.xp_on_success});
  }
  return [{
    contract:'sensum.agility-rooftop-multi-obstacle-failure-evidence.v2',
    evidence_key:'condition:al-kharid-rooftop:multi-obstacle-failure',
    candidate_key:'guide:rooftop:al-kharid',
    method_variant:'standard_lap',
    entry_level:entryLevel,
    account_independent:true,
    failure_possible:true,
    failure_probability_published:false,
    aggregate_failure_probability_model:{published:false,kind:'unpublished_per_obstacle_probabilities'},
    failure_scope:{failed_attempt_xp_published:false,recovery_route_and_time_published:false},
    failure_outcomes:obstacleRows,
    lap_completion_xp:number(lapXp.match[1]),
    lap_timing:{seconds:number(timing.match[1]),ticks:number(timing.match[2]),failure_inclusion_unspecified:true},
    source_stated_xp_per_hour_upper:{value:number(timing.match[3]),approximate:true,is_expected:false,failure_and_energy_conditions_unspecified:true},
    condition_limitations:[...new Set(['per_obstacle_success_probability_model_incomplete','failed_obstacle_xp_outcome_not_published','failure_recovery_route_and_time_penalty_not_published',...sourceConflicts.map(conflict=>conflict.rule)])],
    source_conflicts:sourceConflicts,
    source_revision:String(coursePage.sourceRevision||''),
    supporting_source_revisions:[String(tightropePage.sourceRevision||''),String(zipLinePage.sourceRevision||'')].filter(Boolean),
    source_timestamp:coursePage.sourceTimestamp||null,
    source_url:coursePage.sourceUrl,
    source_locator:{entry:source(coursePage,entry),lapXp:source(coursePage,lapXp),failure:source(coursePage,failure),timing:source(coursePage,timing),courseObstacleRows:[source(coursePage,tightropeRow),source(coursePage,zipRow)]},
    state:'blocked'
  }];
}
