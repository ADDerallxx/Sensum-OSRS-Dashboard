import {parseAgilityVariants} from '../ingestion/agility-variant-lib.mjs';
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
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility variant parser checks passed.');
