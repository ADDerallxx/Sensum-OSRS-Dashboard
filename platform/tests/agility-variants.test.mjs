import {enrichAgilityVariantsWithSupportingEvidence,parseAgilityVariants,parseShayzienBasicSupportingEvidence} from '../ingestion/agility-variant-lib.mjs';
const source=`{{Obsolete|pending review}}
|requirement = 50 [[Agility]] (Basic) <br> 62 [[Agility]] (Advanced)
There are two courses available to players beginning at 50 Agility for the basic course, and 62 Agility for the advanced course.
Both courses merge for a final zipline, granting a total of 633 experience for basic lap completion, and 1053.6 experience for advanced lap completion.
Players never fail obstacles on either course.
Under ideal conditions, the basic course can be completed in 1:07.80, yielding approximately 49 completions per hour and ~31,000 xp/hr.
The advanced course can be completed in 1:22.80, allowing roughly 41 completions per hour and ~43,000 xp/hr.`;
const rows=parseAgilityVariants({title:'Fixture Agility Course',content:source,sourceRevision:'123',sourceTimestamp:'2026-01-01',sourceUrl:'https://example.test'}),basic=rows.find(x=>x.variant_key==='basic'),advanced=rows.find(x=>x.variant_key==='advanced'),failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message)};
check(rows.length===2,'Composite page must expand to two variants.');
check(basic.entry_level===50&&advanced.entry_level===62,'Variant entry levels must remain independent.');
check(basic.xp_per_lap===633&&advanced.xp_per_lap===1053.6,'Variant XP must remain independent.');
check(basic.cycle_seconds===67.8&&advanced.cycle_seconds===82.8,'Clock times must convert to seconds exactly.');
check(basic.observed_laps_per_hour===49&&advanced.observed_laps_per_hour===41,'Observed completion rates must survive decimal lap times.');
check(basic.observed_peak_xp_per_hour===31000&&advanced.observed_peak_xp_per_hour===43000,'Observed XP rates must survive decimal lap times.');
check(basic.failure_free_level===50&&advanced.failure_free_level===62,'Shared never-fail evidence must inherit each variant entry level.');
check(rows.every(x=>x.source_warning==='page_marked_obsolete'),'Source warnings must propagate to every variant.');
const shayzienPage=`==Basic course==
This course requires 1 Agility and yields 153.5 Agility [[experience]] for completion.
The basic course takes a minimum of 51.0 seconds to complete, the Agility experience per hour is at most 10,000.
==Advanced course==
This course requires 45 Agility and yields 507.5 Agility [[experience]] for completion.
The advanced course takes a minimum 46.2 seconds to complete and the average Agility experience per hour is at most 30,000. Players can expect to stop failing the obstacles that make up the advanced course at around level 64 Agility. A [[crossbow]] and a [[mith grapple]] are required to complete this course.`;
const overview=`===Shayzien Agility Course===
The Shayzien Agility Course is split into two Basic and Advanced course, with the former requiring 1 Agility and the latter requiring 45 Agility.
The basic course takes around 53 seconds to complete, yields 153.5 experience, with it also being very unlikely to fail any of the course's obstacles, making the average Agility experience per hour 8,750.
The advanced course takes around 49 seconds and yields 507.5 experience, making the average Agility experience per hour around 30,000.`;
const shayzienRaw=parseAgilityVariants({title:'Shayzien Agility Course',content:shayzienPage,sourceRevision:'15168110',sourceTimestamp:'2026-04-07',sourceUrl:'https://example.test/shayzien'}),shayzienEvidence=parseShayzienBasicSupportingEvidence({title:'Agility',content:overview,sourceRevision:'15300000',sourceTimestamp:'2026-08-01',sourceUrl:'https://example.test/agility'}),shayzien=enrichAgilityVariantsWithSupportingEvidence(shayzienRaw,shayzienEvidence),shayzienBasic=shayzien.find(x=>x.variant_key==='basic');
check(shayzienEvidence[0]?.failure_qualifier==='very_unlikely'&&shayzienEvidence[0]?.failure_probability_published===false,'Qualitative failure language must not become a numeric probability.');
check(shayzienBasic?.observed_xp_per_hour===8750&&shayzienBasic?.observed_rate_kind==='practical_average'&&shayzienBasic?.observed_rate_approximate===true,'The overview average must remain an approximate practical observation.');
check(shayzienBasic?.cycle_seconds===51&&shayzienBasic?.cycle_seconds_observed_approximate===53,'Minimum mechanical timing and approximate observed timing must remain separate.');
check(shayzienBasic?.supporting_source_revisions?.includes('15300000')&&shayzienBasic?.source_locator?.supportingEvidence?.line===2,'Supporting evidence must retain its independent revision and source locator.');
const conflict=enrichAgilityVariantsWithSupportingEvidence(shayzienRaw,[{...shayzienEvidence[0],xp_per_lap:154}]).find(x=>x.variant_key==='basic');
check(conflict?.source_warning==='supporting_evidence_conflict'&&conflict?.supporting_evidence_conflicts?.[0]?.rule==='supporting_xp_per_lap_disagrees','Cross-page mechanical disagreement must fail closed.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility variant parser checks passed.');
