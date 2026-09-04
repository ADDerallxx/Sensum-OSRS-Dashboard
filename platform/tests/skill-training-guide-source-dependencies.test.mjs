import assert from 'node:assert/strict';
import {
  parseSkillTrainingGuideTemplateDependencies,
  buildSkillTrainingGuideTemplateDependencyInventory,
  buildMissingLinkProvenance,
  buildSkillTrainingGuideSourceDependencyAudit
} from '../ingestion/skill-training-guide-source-dependency-lib.mjs';

const guide={title:'Training guide',sourcePageId:101,sourceRevision:'5001',sourceTimestamp:'2026-01-01T00:00:00Z',sourceUrl:'https://oldschool.runescape.wiki/w/Training_guide',sourceContentHash:'guide-hash',skillKeys:['crafting'],channels:['members'],content:`Lead {{SCP|Crafting|link=yes}} and {{#invoke:Example|render|x={{NA}}}}.
{{PAGENAME}} {{{optional|fallback}}} {{:Shared page}}
<!-- {{Ignored}} --> <nowiki>{{Also ignored}}</nowiki>
<math>\frac{1}{1 + \frac{X}{Y}}</math>
{{{{dynamic template}}|x}}`};
const parsed=parseSkillTrainingGuideTemplateDependencies(guide,['PAGENAME']);
assert.equal(parsed.audit.balancedSourceDelimiters,true);
assert.equal(parsed.occurrences.length,7);
assert.equal(parsed.parameterOccurrences.length,1);
assert.equal(parsed.occurrences.filter(row=>row.sourceName==='Ignored'||row.sourceName==='Also ignored').length,0);
assert.equal(parsed.occurrences.find(row=>row.sourceName==='#invoke:Example').dependencyClass,'module_transclusion');
assert.equal(parsed.occurrences.find(row=>row.sourceName==='#invoke:Example').pageTitle,'Module:Example');
assert.equal(parsed.occurrences.find(row=>row.sourceName==='PAGENAME').dependencyClass,'magic_word');
assert.equal(parsed.occurrences.find(row=>row.sourceName===':Shared page').dependencyClass,'page_transclusion');
assert.ok(parsed.occurrences.some(row=>row.dependencyClass==='dynamic_name'));

const expectedGuides=[{resolvedTitle:'Training guide',sourceRevision:'5001'}];
const pageTitles=['Template:SCP','Template:NA','Module:Example','Shared page','Template:dynamic template'];
const targetResolutions=pageTitles.map((requestedTitle,index)=>({requestedTitle,redirected:false,page:{pageid:200+index,title:requestedTitle,revisions:[{revid:6000+index,timestamp:'2026-01-02T00:00:00Z'}]}}));
const built=buildSkillTrainingGuideTemplateDependencyInventory({expectedGuides,guidePages:[guide],magicWordAliases:['PAGENAME'],targetResolutions});
assert.equal(built.audit.guideCoverage.exactGuideRevisionSetMatch,true);
assert.equal(built.audit.templateInvocationCoverage.exactOccurrenceSetMatch,true);
assert.equal(built.audit.pageDependencyResolutionCoverage.pageBackedDependencyCount,5);
assert.equal(built.audit.pageDependencyResolutionCoverage.currentRevisionPinnedCount,5);
assert.equal(built.audit.sourceInvocationInventoryComplete,true);
assert.equal(built.audit.historicalExpansionClosureComplete,false);
assert.equal(built.records.every(row=>row.optimizerEligible===false),true);
assert.equal(built.records.every(row=>row.renderedLinkOutput===null),true);

const missingLink={targetKey:'wiki-title:spirit tree (farming)/patches',requestedTitles:['Spirit tree (Farming)/Patches'],resolutionState:'missing_wiki_page',references:[{guidePageId:101,guideTitle:'Training guide',guideRevision:'5001',guideTimestamp:'2026-01-01T00:00:00Z',guideContentHash:'guide-hash',sourceTarget:'Spirit tree (Farming)/Patches',sourceLocator:{line:8,excerpt:'See [[Spirit tree (Farming)/Patches]].'},skillKeys:['crafting'],channels:['members']} ]};
const head={...guide,content:'See [[Spirit tree (Farming)/Patches]].'};
const exactTargetResolutions=[{requestedTitle:'Spirit tree (Farming)/Patches',page:{ns:0,title:'Spirit tree (Farming)/Patches',missing:true}}];
const searchObservations=[{requestedTitle:'Spirit tree (Farming)/Patches',query:'intitle:"Spirit tree (Farming)/Patches"',observedAt:'2026-01-02T00:00:00Z',results:[{title:'Spirit Tree (Farming)/Patches',pageid:999}]}];
const candidateResolutions=[{requestedTitle:'Spirit Tree (Farming)/Patches',redirected:false,page:{pageid:999,title:'Spirit Tree (Farming)/Patches',revisions:[{revid:7001,timestamp:'2026-01-02T00:00:00Z'}]}}];
const provenance=buildMissingLinkProvenance({missingLinkRecords:[missingLink],exactTargetResolutions,currentGuidePages:[head],searchObservations,candidateResolutions,logEventsByTitle:{'spirit tree (farming)/patches':[]}});
assert.equal(provenance.audit.provenanceInventoryComplete,true);
assert.equal(provenance.audit.missingLinkResolutionComplete,false);
assert.equal(provenance.audit.missingLinksStillPresentAtCurrentHead,1);
assert.equal(provenance.audit.searchCandidateCount,1);
assert.equal(provenance.audit.automaticReplacementCount,0);
assert.equal(provenance.records[0].automaticReplacement,null);
assert.equal(provenance.records[0].searchObservation.candidates[0].reviewCandidateOnly,true);
assert.equal(provenance.records[0].searchObservation.candidates[0].exactTitleMatch,false);

const combined=buildSkillTrainingGuideSourceDependencyAudit(built.audit,provenance.audit);
assert.equal(combined.sourceDependencyInventoryComplete,true);
assert.equal(combined.historicalExpansionClosureComplete,false);
assert.equal(combined.missingLinkResolutionComplete,false);
assert.equal(combined.publishable,false);
assert.equal(combined.canonicalActivityIdentityCount,0);
assert.equal(combined.optimizerEligibleActivityCount,0);

const missingResolution=buildSkillTrainingGuideTemplateDependencyInventory({expectedGuides,guidePages:[guide],magicWordAliases:['PAGENAME'],targetResolutions:targetResolutions.slice(1)});
assert.equal(missingResolution.audit.sourceInvocationInventoryComplete,false);
assert.ok(missingResolution.audit.blockers.includes('page_dependency_resolution_assessment_missing'));

const injectedAccount=structuredClone(built.records);injectedAccount[0].accountState={level:99};
const accountAudit=(await import('../ingestion/skill-training-guide-source-dependency-lib.mjs')).auditSkillTrainingGuideTemplateDependencies(injectedAccount,{expectedGuides,guidePages:[guide],guideAudits:[parsed.audit],parameterOccurrences:parsed.parameterOccurrences});
assert.equal(accountAudit.sourceInvocationInventoryComplete,false);
assert.ok(accountAudit.blockers.includes('account_query_state_baked_into_template_inventory'));

console.log('Cross-skill guide source-dependency and missing-link provenance checks passed.');
