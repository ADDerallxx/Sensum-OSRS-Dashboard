import {enrichAgilityVariantsWithObstacleEvidence,parseShayzienBasicObstacleEvidence} from '../ingestion/agility-shayzien-obstacle-evidence-lib.mjs';
const page=(title,content,sourceRevision)=>({title,content,sourceRevision,sourceTimestamp:'2026-09-03T00:00:00Z',sourceUrl:`https://example.test/${encodeURIComponent(title)}`});
const course=`==Basic course==
This course requires 1 Agility and yields 153.5 Agility [[experience]] for completion.
The basic course takes a minimum of 51.0 seconds to complete, the Agility [[experience]] per hour is at most 10,000.
|[[File:1.png]]||[[Ladder (Shayzien Agility Course)|Ladder]]||{{+=|xp|5.5|echo=2}}
|[[File:2.png]]||[[Monkeybars (Shayzien Agility Course)|Monkeybars]]||{{+=|xp|8|echo=2}}
|[[File:3.png]]||[[Tightrope (Shayzien Agility Course)|Tightrope]]||{{+=|xp|9|echo=2}}
|[[File:4.png]]||[[Bar (Shayzien Agility Course)|Bar]]||{{+=|xp|7|echo=2}}
|[[File:5.png]]||[[Tightrope (Shayzien Agility Course)|Tightrope]]||{{+=|xp|9|echo=2}}
|[[File:6.png]]||[[Tightrope (Shayzien Agility Course)|Tightrope]]||{{+=|xp|9|echo=2}}
|[[File:7.png]]||[[Gap (Shayzien Agility Course)|Gap]]||{{+=|xp|106|echo=2}}
==Advanced course==
* The [[experience]] per hour gained at the basic course has been increased from 8,750 to 10,000.`;
const overview=`The basic course takes around 53 seconds to complete, yields 153.5 experience, with it also being very unlikely to fail any of the course's obstacles, making the average Agility experience per hour 8,750.`;
const obstacle=(name,xp,revision,extra='')=>page(`${name} (Shayzien Agility Course)`,`The '''${name.toLowerCase()}''' is an [[Agility]] obstacle found within the [[Shayzien Agility Course]], granting the player ${xp} Agility experience.
{{Agility info
|name = ${name}
|level = 1
|xp = ${xp}
|course = [[Shayzien Agility Course]]
|type = Obstacle
}}
${extra}`,revision);
const pages=[obstacle('Ladder',5.5,'14715880'),obstacle('Monkeybars',8,'14730388'),obstacle('Tightrope',9,'14738994','Players can no longer fail crossing this obstacle.'),obstacle('Bar',7,'14658395'),obstacle('Gap',106,'14658396')];
const parse=(overrides={})=>parseShayzienBasicObstacleEvidence({coursePage:page('Shayzien Agility Course',overrides.course||course,'15168110'),overviewPage:page('Agility',overrides.overview||overview,'15326985'),obstaclePages:overrides.pages||pages});
const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},evidence=parse()[0];
check(evidence?.obstacle_sequence?.length===7&&evidence.lap_xp===153.5,'The complete seven-occurrence route and exact lap XP must survive.');
check(evidence.failure_scope.known_failure_free_occurrences.join(',')==='3,5,6'&&evidence.failure_scope.known_failure_free_obstacle_types.join(',')==='tightrope','The Tightrope no-failure statement must apply to all three Tightrope occurrences and no other obstacle.');
check(evidence.failure_scope.unresolved_obstacle_types.sort().join(',')==='bar,gap,ladder,monkeybars'&&!evidence.failure_scope.complete,'Obstacle types without explicit failure evidence must remain unresolved.');
check(evidence.failure_scope.numeric_probability_published===false&&evidence.failure_scope.failed_attempt_xp_published===false&&evidence.failure_scope.recovery_route_and_time_published===false,'Missing probability, failed XP, and recovery facts must remain explicit.');
check(evidence.rate_evidence.current_upper_bound_xp_per_hour===10000&&evidence.rate_evidence.superseded_average_xp_per_hour===8750&&evidence.rate_evidence.current_expected_xp_per_hour===null,'The current upper bound and superseded average must not become a current expected rate.');
const aligned=parse({overview:overview.replace('8,750','10,000')})[0];
check(aligned.rate_evidence.overview_rate_state==='current_expected'&&aligned.rate_evidence.current_expected_xp_per_hour===10000&&aligned.rate_evidence.current_expected_rate_published===true&&aligned.rate_evidence.superseded_average_xp_per_hour===null,'A future overview update that agrees with the current course rate must become current expected evidence automatically.');
check(evidence.supporting_source_revisions.includes('15326985')&&evidence.supporting_source_revisions.includes('14738994'),'Overview and obstacle revisions must remain attached.');
const enriched=enrichAgilityVariantsWithObstacleEvidence([{record_key:'agility-variant:Shayzien Agility Course:basic',supporting_source_revisions:['15326985'],source_conflicts:[],source_locator:{variant:'basic'}}],[evidence])[0];
check(enriched.obstacle_failure_evidence===evidence&&enriched.supporting_source_revisions.includes('14658396')&&enriched.state==='blocked','Level-independent obstacle evidence must survive variant enrichment.');
check(parse({pages:pages.filter(item=>!item.title.startsWith('Tightrope'))}).length===0,'Missing obstacle evidence must fail closed.');
const mismatchPages=pages.map(item=>item.title.startsWith('Gap')?obstacle('Gap',105,'14658396'):item),mismatch=parse({pages:mismatchPages})[0];
check(mismatch.source_conflicts.some(item=>item.rule==='gap_xp_disagrees_with_course_table'),'Course and obstacle XP disagreement must remain a blocker.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Shayzien basic obstacle failure-scope evidence checks passed.');
