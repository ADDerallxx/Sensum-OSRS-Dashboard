import {agilityGuideSectionKey,parseAgilityTrainingGuideSectionInventory} from '../ingestion/agility-training-guide-section-inventory-lib.mjs';
import {auditAgilityTrainingGuideSectionCoverage} from '../transforms/agility-training-guide-section-coverage-lib.mjs';

const source=`Intro
==Fastest experience==
===Levels 1–20: Questing===
Quest rewards.
===Levels 20–40: Example Course===
Repeatable method.
==Other methods==
===Levels 1–99: Rooftop Agility Courses===
{| class="wikitable"
|}
===Levels 50+: New Method===
New method text.
==References==
{{Reflist}}`,input={title:'Agility training',content:source,sourceRevision:'123',sourceTimestamp:'2026-09-03',sourceUrl:'https://example.test/agility-training'},parsed=parseAgilityTrainingGuideSectionInventory(input),failures=[],check=(ok,message)=>{if(!ok)failures.push(message)};
check(parsed.audit.publishable===true&&parsed.records.length===7&&parsed.audit.materialSectionCount===4,'Every top-level and method-bearing heading must be inventoried in source order.');
const material=parsed.records.filter(record=>record.materialToCandidateUniverse);
check(material[0].sectionRole==='one_time_progression_section'&&material[0].repeatableTraining===false,'Questing must remain material progression without becoming repeatable training.');
check(material.find(record=>record.title.includes('Rooftop'))?.sectionRole==='method_collection'&&material.find(record=>record.title.includes('Rooftop'))?.requiresInternalMemberAudit===true,'Collection sections must require a separate internal-member audit.');
check(material.every(record=>record.sourceLocator.headingLine&&record.sourceLocator.sectionEndLine>=record.sourceLocator.sectionStartLine),'Every material section must retain an exact source location.');
const candidates=[{candidate_key:'quest',name:'Questing',source_section_key:agilityGuideSectionKey('Fastest experience','Levels 1–20: Questing')},{candidate_key:'course',name:'Example',source_section_key:agilityGuideSectionKey('Fastest experience','Levels 20–40: Example Course')},{candidate_key:'roof',name:'Rooftops',source_section_key:agilityGuideSectionKey('Other methods','Levels 1–99: Rooftop Agility Courses')}],coverage=auditAgilityTrainingGuideSectionCoverage({sections:parsed.records,candidates});
check(coverage.materialSectionCount===4&&coverage.coveredSectionCount===3&&coverage.uncoveredSectionCount===1&&coverage.uncoveredSections[0].title==='Levels 50+: New Method','New source sections must become named coverage gaps automatically.');
check(coverage.internalMemberAuditPendingCount===1&&coverage.blockers.includes('covered_collection_or_composite_section_members_not_audited'),'Section presence must not prove a collection\'s internal member coverage.');
check(coverage.completeGameUniverseProven===false&&coverage.blockers.includes('official_training_guide_not_proven_exhaustive_game_universe'),'A fully parsed guide must never be treated as the complete game universe by itself.');
const orphan=auditAgilityTrainingGuideSectionCoverage({sections:parsed.records,candidates:[...candidates,{candidate_key:'orphan',name:'Orphan'}]});
check(orphan.orphanCandidateCount===1&&orphan.blockers.includes('one_or_more_candidates_are_not_linked_to_an_inventoried_section'),'Unlinked candidates must fail closed.');
const unexpected=parseAgilityTrainingGuideSectionInventory({...input,content:source.replace('==References==','==Unexpected category==\n====Nested surprise====\nText\n==References==')});
check(unexpected.audit.publishable===false&&unexpected.audit.blockers.includes('unexpected_heading_structure_requires_review'),'Unexpected heading depth or parent structure must block publication.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Agility training-guide section inventory checks passed.');
