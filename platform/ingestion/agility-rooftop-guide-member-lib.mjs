const expectedCourseNames=['Draynor Village Rooftop Course','Al Kharid Rooftop Course','Varrock Rooftop Course','Canifis Rooftop Course','Falador Rooftop Course',"Seers' Village Rooftop Course",'Pollnivneach Rooftop Course','Rellekka Rooftop Course','Ardougne Rooftop Course'];
const key=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function parseAgilityRooftopGuideMembers({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  const blockers=[];
  if(title!=='Agility training')blockers.push('unexpected_source_title');
  const text=String(content||''),heading=/^===\s*Levels\s+1[–-]99:\s*Rooftop Agility Courses\s*===\s*$/m.exec(text);
  if(!heading)blockers.push('rooftop_collection_heading_missing');
  const start=heading?.index??-1,after=start>=0?text.slice(start):'',nextOffset=after.slice(1).search(/^===/m),section=start<0?'':nextOffset<0?after:after.slice(0,nextOffset+1),table=/\{\|\s*class="wikitable"[\s\S]*?\n\|\}/m.exec(section)?.[0]||'';
  if(!table)blockers.push('rooftop_collection_table_missing');
  const records=[];
  for(const rowText of table.split(/\r?\n\|-\s*\r?\n/).slice(1)){
    const row=/^\|\s*([^\r\n]+)\r?\n\|\s*\[\[([^|\]]+ Rooftop Course)(?:\|([^\]]+))?\]\]/m.exec(rowText);
    if(!row)continue;
    const courseName=row[2].trim(),levelNumbers=[...row[1].matchAll(/\d+/g)].map(match=>Number(match[0])),absoluteOffset=start+section.indexOf(table)+table.indexOf(rowText),line=text.slice(0,absoluteOffset).split(/\r?\n/).length;
    records.push({contract:'sensum.agility-rooftop-guide-member.v1',memberKey:`rooftop:${key(courseName)}`,courseName,displayName:(row[3]||courseName).trim(),sourceOrder:records.length,guideLevelScopeLabel:row[1].trim(),guideLevelNumbers:levelNumbers,minimumRecommendedBaseLevel:levelNumbers[0]??null,sourceRevision:String(sourceRevision||''),sourceTimestamp:sourceTimestamp||null,sourceUrl,sourceLocator:{section:'Levels 1–99: Rooftop Agility Courses',row:courseName,line,excerpt:`| ${rowText}`.slice(0,2400)},state:'candidate'});
  }
  const names=records.map(record=>record.courseName),missingCourseNames=expectedCourseNames.filter(name=>!names.includes(name)),unexpectedCourseNames=names.filter(name=>!expectedCourseNames.includes(name)),duplicateCourseNames=[...new Set(names.filter((name,index)=>names.indexOf(name)!==index))],orderMatches=names.length===expectedCourseNames.length&&names.every((name,index)=>name===expectedCourseNames[index]);
  if(missingCourseNames.length)blockers.push('one_or_more_expected_rooftop_rows_missing');
  if(unexpectedCourseNames.length)blockers.push('one_or_more_unexpected_rooftop_rows_require_review');
  if(duplicateCourseNames.length)blockers.push('duplicate_rooftop_rows');
  if(!orderMatches)blockers.push('rooftop_row_order_changed');
  if(!sourceRevision||!sourceTimestamp||!sourceUrl)blockers.push('revision_provenance_incomplete');
  return {records,audit:{contract:'sensum.agility-rooftop-guide-member-ingestion-audit.v1',expectedCourseNames,memberCount:records.length,missingCourseNames,unexpectedCourseNames,duplicateCourseNames,sourceOrderMatches:orderMatches,blockers,publishable:blockers.length===0}};
}
