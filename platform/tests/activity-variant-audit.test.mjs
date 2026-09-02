import {auditVariantAxes} from '../transforms/activity-variant-audit-lib.mjs';
const records=[
  {name:'Expanded',source_revision:'1',source_url:'u',evidence_fragments:[{line:1,text:'This course is split into a basic and advanced course.'}]},
  {name:'Floors',source_revision:'2',source_url:'u',evidence_fragments:[{line:2,text:'The Agility level required to enter Floor 4 is 77.'}]},
  {name:'Diary',source_revision:'3',source_url:'u',evidence_fragments:[{line:3,text:'The hard diary increases the experience rate.'}]},
  {name:'Reference',source_revision:'4',source_url:'u',evidence_fragments:[{line:4,text:'The hard diary increases the experience rate.'}]}
],members=[{name:'Expanded',entity_role:'composite_method'},{name:'Floors',entity_role:'trainable_method'},{name:'Diary',entity_role:'trainable_method'},{name:'Reference',entity_role:'reference_collection'}],variants=[{parent_name:'Expanded',variant_key:'basic'},{parent_name:'Expanded',variant_key:'advanced'}],report=auditVariantAxes({records,members,variants}),failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message)};
check(report.expanded===1,'Expanded course branches must be recognized.');
check(report.pending===2,'Unexpanded floor and diary axes must remain pending.');
check(report.referenceCollectionsExcluded===1,'Reference collections must be excluded.');
check(report.details.every(x=>x.source_revision&&x.source_locators.length),'Every finding must retain revision-pinned locators.');
check(report.completeCoverage===false&&report.absoluteBestActivityGate==='blocked','Pending material variants must block complete coverage.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Activity variant audit checks passed.');
