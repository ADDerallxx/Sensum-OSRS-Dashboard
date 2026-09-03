import {evidenceFragments} from '../ingestion/activity-evidence-lib.mjs';

const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
const materialSuffix='Players gain 110.5 [[experience]] points for a complete circuit.';
const longLine=`This course has no requirements and is impossible to fail. ${'route context '.repeat(50)}${materialSuffix}`;
const fragment=evidenceFragments(longLine,{limit:10})[0];
check(fragment?.text?.length>500,'Evidence fragments must no longer be silently truncated at 500 characters.');
check(fragment?.text?.endsWith(materialSuffix),'Material facts at the end of a long source line must survive ingestion.');
check(fragment?.line===1,'Full-line evidence must retain its source line locator.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Activity evidence full-line retention checks passed.');
