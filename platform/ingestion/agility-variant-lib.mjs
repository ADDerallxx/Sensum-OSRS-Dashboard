const number=value=>Number(String(value||'').replace(/,/g,''));
const first=(content,patterns)=>{for(const pattern of patterns){const match=content.match(pattern);if(match)return match}return null};
const excerpt=match=>match?.[0]?.slice(0,700)||null;
const located=(content,pattern)=>{const match=content.match(pattern);return match?{match,line:content.slice(0,match.index).split(/\r?\n/).length,excerpt:match[0].slice(0,1200)}:null};

export function parseShayzienBasicSupportingEvidence({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Agility')return [];
  const statement=located(content,/The Shayzien Agility Course is split into two Basic and Advanced course, with the former requiring\s+(\d+)\s+Agility and the latter requiring\s+(\d+)\s+Agility\.[\s\S]{0,300}?basic course takes around\s+([\d.]+)\s+seconds to complete, yields\s+([\d.]+)\s+experience, with it also being very unlikely to fail any of the course's obstacles, making the average Agility experience per hour\s+([\d,]+)/i);
  if(!statement)return [];
  return [{
    contract:'sensum.agility-variant-supporting-evidence.v1',
    evidence_key:'agility-variant-support:shayzien:basic:practical-rate-and-failure',
    parent_name:'Shayzien Agility Course',
    variant_key:'basic',
    entry_level:number(statement.match[1]),
    cycle_seconds_observed_approximate:number(statement.match[3]),
    xp_per_lap:number(statement.match[4]),
    failure_possible:true,
    failure_qualifier:'very_unlikely',
    failure_probability_published:false,
    observed_xp_per_hour:number(statement.match[5]),
    observed_rate_kind:'practical_average',
    observed_rate_is_expected:true,
    observed_rate_approximate:true,
    source_revision:String(sourceRevision||''),
    source_timestamp:sourceTimestamp||null,
    source_url:sourceUrl,
    source_locator:{line:statement.line,excerpt:statement.excerpt},
    state:'candidate'
  }];
}

export function enrichAgilityVariantsWithSupportingEvidence(records,evidenceRows){
  const evidenceByVariant=new Map((evidenceRows||[]).map(row=>[`${row.parent_name}:${row.variant_key}`,row]));
  return records.map(row=>{
    const evidence=evidenceByVariant.get(`${row.parent_name}:${row.variant_key}`);
    if(!evidence)return row;
    const conflicts=[];
    if(number(row.entry_level)!==number(evidence.entry_level))conflicts.push({rule:'supporting_entry_level_disagrees',primary:row.entry_level,supporting:evidence.entry_level});
    if(number(row.xp_per_lap)!==number(evidence.xp_per_lap))conflicts.push({rule:'supporting_xp_per_lap_disagrees',primary:row.xp_per_lap,supporting:evidence.xp_per_lap});
    if(row.published_rate_change&&number(evidence.observed_xp_per_hour)===number(row.published_rate_change.previous_xp_per_hour)&&number(row.observed_peak_xp_per_hour)===number(row.published_rate_change.current_xp_per_hour))conflicts.push({rule:'supporting_rate_matches_superseded_pre_update_value',primaryCurrent:row.observed_peak_xp_per_hour,supporting:evidence.observed_xp_per_hour,superseded:row.published_rate_change.previous_xp_per_hour,sourceRevision:row.source_revision,supportingSourceRevision:evidence.source_revision});
    const common={...row,supporting_evidence:evidence,supporting_source_revisions:[...new Set([...(row.supporting_source_revisions||[]),evidence.source_revision])],source_locator:{...row.source_locator,supportingEvidence:evidence.source_locator},source_conflicts:[...(row.source_conflicts||[]),...conflicts]};
    if(conflicts.length){const rateConflictOnly=conflicts.every(conflict=>conflict.rule==='supporting_rate_matches_superseded_pre_update_value');return {...common,...(rateConflictOnly?{cycle_seconds_observed_approximate:evidence.cycle_seconds_observed_approximate,failure_possible:evidence.failure_possible,failure_qualifier:evidence.failure_qualifier,failure_probability_published:evidence.failure_probability_published}:{}),state:'blocked',source_warning:'supporting_evidence_conflict',supporting_evidence_conflicts:conflicts}};
    return {...common,cycle_seconds_observed_approximate:evidence.cycle_seconds_observed_approximate,failure_possible:evidence.failure_possible,failure_qualifier:evidence.failure_qualifier,failure_probability_published:evidence.failure_probability_published,observed_xp_per_hour:evidence.observed_xp_per_hour,observed_rate_kind:evidence.observed_rate_kind,observed_rate_is_expected:evidence.observed_rate_is_expected,observed_rate_approximate:evidence.observed_rate_approximate,observed_comparison_policy:'mechanical_upper_bound_vs_practical_observed'};
  });
}

export function parseAgilityVariants({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(!/basic course/i.test(content)||!/advanced course/i.test(content))return [];
  const sourceWarning=/\{\{Obsolete\b/i.test(content)?'page_marked_obsolete':null;
  return ['basic','advanced'].map(variant=>{
    const label=variant[0].toUpperCase()+variant.slice(1),section=content.match(new RegExp(`==${label} course==([\\s\\S]*?)(?=\\n==[^=]|$)`,'i'))?.[1]||'',entry=first(section,[
      /this course requires\s+(\d+)\s+(?:\[\[)?Agility/i
    ])||first(content,[
      new RegExp(`(?:requirement\\s*=)?[^\\n]{0,80}?(\\d+)\\s*\\[\\[Agility\\]\\]\\s*\\(${label}\\)`,'i'),
      new RegExp(`${variant} course[^.]{0,100}?requires\\s+(\\d+)\\s+(?:\\[\\[)?Agility`,'i'),
      new RegExp(`beginning at\\s+(\\d+)\\s+(?:\\[\\[)?Agility[^.]{0,80}?${variant} course`,'i')
    ]),xp=first(section,[
      /this course[^.]{0,120}?yields\s+([\d,.]+)\s+Agility[^.]{0,40}?experience/i
    ])||first(content,[
      new RegExp(`${variant} course[^.]{0,120}?yields\\s+([\\d,.]+)\\s+Agility[^.]{0,40}?experience`,'i'),
      new RegExp(`([\\d,.]+)\\s+experience for ${variant} lap completion`,'i')
    ]),cycleSeconds=first(section,[
      /(?:this|the (?:basic|advanced)) course[^.]{0,120}?takes(?: a minimum(?: of)?| a minimum)?\s+(\d+(?:\.\d+)?)\s+seconds/i
    ])||first(content,[
      new RegExp(`${variant} course[^.]{0,120}?takes(?: a minimum(?: of)?| a minimum)?\\s+(\\d+(?:\\.\\d+)?)\\s+seconds`,'i')
    ]),cycleClock=first(content,[
      new RegExp(`${variant} course[^.]{0,120}?completed in\\s+(\\d+):(\\d+(?:\\.\\d+)?)`,'i')
    ]),observedActions=first(content,[
      new RegExp(`${variant} course[^\\n]{0,500}?(?:yielding approximately|allowing roughly)\\s+(\\d+(?:\\.\\d+)?)\\s+completions per hour`,'i')
    ]),observedXp=first(section,[
      /(?:this|the (?:basic|advanced)) course[^\n]{0,500}?(?:\[\[)?experience(?:\]\])? per hour is at most\s*([\d,]+)/i,
      /(?:this|the (?:basic|advanced)) course[^\n]{0,500}?(?:at most|~)\s*([\d,]+)\s*(?:Agility\s+)?(?:(?:\[\[)?experience(?:\]\])? per hour|xp\/hr)/i
    ])||first(content,[
      new RegExp(`${variant} course[^\\n]{0,500}?(?:\\[\\[)?experience(?:\\]\\])? per hour is at most\\s*([\\d,]+)`,'i'),
      new RegExp(`${variant} course[^\\n]{0,500}?(?:at most|~)\\s*([\\d,]+)\\s*(?:Agility\\s+)?(?:(?:\\[\\[)?experience(?:\\]\\])? per hour|xp\\/hr)`,'i')
    ]),failureFree=first(section,[
      /stop failing[^.]{0,100}?level\s+(\d+)\s+Agility/i
    ])||first(content,[
      new RegExp(`${variant} course[^.]{0,220}?stop failing[^.]{0,100}?level\\s+(\\d+)\\s+Agility`,'i')
    ]),bothNeverFail=/players never fail obstacles on either course/i.test(content),toolLine=variant==='advanced'?(first(section,[/\[\[crossbow\]\][^.]{0,120}?required to complete this course/i])||first(content,[new RegExp(`${variant} course[^.]{0,220}?(?:\\[\\[crossbow\\]\\])[^.]{0,120}?required to complete this course`,'i')])):null;
    const seconds=cycleSeconds?number(cycleSeconds[1]):cycleClock?number(cycleClock[1])*60+number(cycleClock[2]):null;
    const rateChange=variant==='basic'&&title==='Shayzien Agility Course'?located(content,/(?:\[\[)?experience(?:\]\])? per hour gained at the basic course has been increased from\s+([\d,]+)\s+to\s+([\d,]+)/i):null;
    return {contract:'sensum.agility-variant.v1',record_key:`agility-variant:${title}:${variant}`,parent_name:title,variant_key:variant,name:`${title} — ${label}`,axis_coverage:['course_branch',...(toolLine?['equipment_modifier']:[])],entry_level:entry?number(entry[1]):null,xp_per_lap:xp?number(xp[1]):null,cycle_seconds:seconds,observed_laps_per_hour:observedActions?number(observedActions[1]):null,observed_peak_xp_per_hour:observedXp?number(observedXp[1]):null,observed_rate_kind:observedXp?'source_stated_upper_bound':null,observed_rate_is_expected:observedXp?false:null,published_rate_change:rateChange?{previous_xp_per_hour:number(rateChange.match[1]),current_xp_per_hour:number(rateChange.match[2]),source_revision:String(sourceRevision||''),source_url:sourceUrl,source_locator:{line:rateChange.line,excerpt:rateChange.excerpt}}:null,failure_free_level:bothNeverFail?(entry?number(entry[1]):null):(failureFree?number(failureFree[1]):null),requirements:toolLine?['Crossbow','Mith grapple']:[],source_warning:sourceWarning,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl,source_locator:{variant,entry:excerpt(entry),xp:excerpt(xp),cycle:excerpt(cycleSeconds||cycleClock),observedActions:excerpt(observedActions),observedXp:excerpt(observedXp),rateChange:rateChange?{line:rateChange.line,excerpt:rateChange.excerpt}:null,failure:bothNeverFail?'Players never fail obstacles on either course.':excerpt(failureFree),requirements:excerpt(toolLine)},state:'candidate'};
  });
}
