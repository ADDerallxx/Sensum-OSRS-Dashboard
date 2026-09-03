const key=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const methodParents=new Set(['Fastest experience','Other methods']);

export const agilityGuideSectionKey=(parentTitle,title)=>`${key(parentTitle||'root')}:${key(title)}`;

function roleFor({depth,title,parentTitle}){
  if(depth===2){
    if(methodParents.has(title))return 'method_category';
    if(title==='References')return 'reference_section';
    return 'unknown_top_level_section';
  }
  if(depth!==3||!methodParents.has(parentTitle))return 'unknown_nested_section';
  if(/Questing/i.test(title))return 'one_time_progression_section';
  if(/Rooftop Agility Courses/i.test(title))return 'method_collection';
  if(/Rockslide\s*\+\s*Other Activities/i.test(title)||/Levels 20[–-]47: Brimhaven Agility Arena/i.test(title)||/Hallowed Sepulchre/i.test(title)||/Colossal Wyrm Agility Course/i.test(title))return 'composite_method_section';
  return 'method_section';
}

export function parseAgilityTrainingGuideSectionInventory({title,content,sourceRevision,sourceTimestamp,sourceUrl}){
  if(title!=='Agility training')return {records:[],audit:{contract:'sensum.agility-training-guide-section-ingestion-audit.v1',publishable:false,blockers:['unexpected_source_title']}};
  const text=String(content||''),matches=[...text.matchAll(/^(={2,6})[ \t]*(.*?)[ \t]*\1[ \t]*$/gm)],headings=matches.map((match,index)=>({index,depth:match[1].length,title:match[2].trim(),offset:match.index,line:text.slice(0,match.index).split(/\r?\n/).length}));
  const records=[];
  for(const heading of headings){
    const parent=[...headings.slice(0,heading.index)].reverse().find(candidate=>candidate.depth===2),next=headings.slice(heading.index+1).find(candidate=>candidate.depth<=heading.depth),endOffset=next?.offset??text.length,endLine=next?next.line-1:text.split(/\r?\n/).length,parentTitle=heading.depth===2?null:parent?.title||null,sectionRole=roleFor({depth:heading.depth,title:heading.title,parentTitle}),materialToCandidateUniverse=heading.depth===3&&methodParents.has(parentTitle),sectionText=text.slice(heading.offset,endOffset).trim();
    records.push({
      contract:'sensum.agility-training-guide-section-inventory.v1',
      sectionKey:agilityGuideSectionKey(parentTitle,heading.title),
      sourceOrder:heading.index,
      title:heading.title,
      depth:heading.depth,
      parentTitle,
      sectionRole,
      materialToCandidateUniverse,
      repeatableTraining:materialToCandidateUniverse&&sectionRole!=='one_time_progression_section',
      levelScopeLabel:heading.title.match(/^Levels\s+([^:]+):/i)?.[1]?.trim()||null,
      requiresInternalMemberAudit:['method_collection','composite_method_section'].includes(sectionRole),
      sourceRevision:String(sourceRevision||''),
      sourceTimestamp:sourceTimestamp||null,
      sourceUrl,
      sourceLocator:{headingLine:heading.line,sectionStartLine:heading.line,sectionEndLine:endLine,excerpt:sectionText.slice(0,1800)},
      state:sectionRole.startsWith('unknown_')?'unknown':'candidate'
    });
  }
  const blockers=[];
  for(const required of ['Fastest experience','Other methods','References'])if(!records.some(record=>record.depth===2&&record.title===required))blockers.push(`required_top_level_section_missing:${key(required)}`);
  if(!records.some(record=>record.materialToCandidateUniverse))blockers.push('no_method_bearing_sections_found');
  if(new Set(records.map(record=>record.sectionKey)).size!==records.length)blockers.push('duplicate_section_keys');
  if(records.some(record=>record.state==='unknown'))blockers.push('unexpected_heading_structure_requires_review');
  if(!sourceRevision||!sourceTimestamp||!sourceUrl)blockers.push('revision_provenance_incomplete');
  return {records,audit:{contract:'sensum.agility-training-guide-section-ingestion-audit.v1',headingCount:records.length,materialSectionCount:records.filter(record=>record.materialToCandidateUniverse).length,unknownSectionCount:records.filter(record=>record.state==='unknown').length,blockers,publishable:blockers.length===0}};
}
