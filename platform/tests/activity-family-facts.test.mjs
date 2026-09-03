import {parseSimpleLapClaims} from '../transforms/activity-family-fact-lib.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const intro=`This Agility course is the lowest level course that can be accessed and has no requirements. It is impossible to fail any of the obstacles at this course. Players gain 110.5 [[experience]] points for a complete circuit.`;
const timing=`A lap will take a minimum of 34 seconds to complete. Therefore the average experience per hour will be around 10,000, depending on the player's concentration.`;
const claims=[...parseSimpleLapClaims(intro),...parseSimpleLapClaims(timing)],get=kind=>claims.find(claim=>claim.kind===kind);
check(get('xp_per_success')?.value?.xp===110.5&&get('xp_per_success')?.value?.unit==='lap','Complete-circuit XP must be retained as lap XP.');
check(get('lap_seconds')?.value?.seconds===34&&get('lap_seconds')?.value?.timing_kind==='minimum','Minimum lap timing must remain labeled as a minimum.');
check(get('observed_xp_per_hour')?.value?.maximum===10000&&get('observed_xp_per_hour')?.value?.observation_kind==='practical_average'&&get('observed_xp_per_hour')?.value?.approximate===true,'Reverse-order practical average rates must remain approximate observations.');
check(parseSimpleLapClaims('Players gain experience while training.').length===0,'Incomplete prose must not create numeric facts.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Reusable simple-lap fact checks passed.');
