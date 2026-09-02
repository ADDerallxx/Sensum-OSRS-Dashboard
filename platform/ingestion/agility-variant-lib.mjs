const number=value=>Number(String(value||'').replace(/,/g,''));
const first=(content,patterns)=>{for(const pattern of patterns){const match=content.match(pattern);if(match)return match}return null};
const excerpt=match=>match?.[0]?.slice(0,700)||null;

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
      /(?:this|the (?:basic|advanced)) course[^\n]{0,500}?experience per hour is at most\s*([\d,]+)/i,
      /(?:this|the (?:basic|advanced)) course[^\n]{0,500}?(?:at most|~)\s*([\d,]+)\s*(?:Agility\s+)?(?:experience per hour|xp\/hr)/i
    ])||first(content,[
      new RegExp(`${variant} course[^\\n]{0,500}?experience per hour is at most\\s*([\\d,]+)`,'i'),
      new RegExp(`${variant} course[^\\n]{0,500}?(?:at most|~)\\s*([\\d,]+)\\s*(?:Agility\\s+)?(?:experience per hour|xp\\/hr)`,'i')
    ]),failureFree=first(section,[
      /stop failing[^.]{0,100}?level\s+(\d+)\s+Agility/i
    ])||first(content,[
      new RegExp(`${variant} course[^.]{0,220}?stop failing[^.]{0,100}?level\\s+(\\d+)\\s+Agility`,'i')
    ]),bothNeverFail=/players never fail obstacles on either course/i.test(content),toolLine=variant==='advanced'?(first(section,[/\[\[crossbow\]\][^.]{0,120}?required to complete this course/i])||first(content,[new RegExp(`${variant} course[^.]{0,220}?(?:\\[\\[crossbow\\]\\])[^.]{0,120}?required to complete this course`,'i')])):null;
    const seconds=cycleSeconds?number(cycleSeconds[1]):cycleClock?number(cycleClock[1])*60+number(cycleClock[2]):null;
    return {contract:'sensum.agility-variant.v1',record_key:`agility-variant:${title}:${variant}`,parent_name:title,variant_key:variant,name:`${title} — ${label}`,entry_level:entry?number(entry[1]):null,xp_per_lap:xp?number(xp[1]):null,cycle_seconds:seconds,observed_laps_per_hour:observedActions?number(observedActions[1]):null,observed_peak_xp_per_hour:observedXp?number(observedXp[1]):null,failure_free_level:bothNeverFail?(entry?number(entry[1]):null):(failureFree?number(failureFree[1]):null),requirements:toolLine?['Crossbow','Mith grapple']:[],source_warning:sourceWarning,source_revision:String(sourceRevision||''),source_timestamp:sourceTimestamp||null,source_url:sourceUrl,source_locator:{variant,entry:excerpt(entry),xp:excerpt(xp),cycle:excerpt(cycleSeconds||cycleClock),observedActions:excerpt(observedActions),observedXp:excerpt(observedXp),failure:bothNeverFail?'Players never fail obstacles on either course.':excerpt(failureFree),requirements:excerpt(toolLine)},state:'candidate'};
  });
}
