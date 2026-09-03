import {parseRootTemplateSignatures,parseDirectCategorySignatures,buildUnlockLinkedPageSourceSignatures} from '../ingestion/unlock-linked-page-source-signature-lib.mjs';
import {hash} from '../ingestion/lib.mjs';

const failures=[],check=(condition,message)=>{if(!condition)failures.push(message)},content=`<!-- {{Infobox Monster}} -->
{{External|value={{Nested template}}}}
{{Infobox Item
|name=Example
}}
<nowiki>{{Infobox Quest}}</nowiki>
[[Category:Example items]]`,templates=parseRootTemplateSignatures(content),categories=parseDirectCategorySignatures(content),identities=[{targetKey:'wiki-title:example',requestedTitle:'Example',resolvedTitle:'Example',sourceRevision:'123'}],resolution={requestedTitle:'Example',normalizedTitle:'Example',resolvedTitle:'Example',redirected:false,page:{title:'Example',revisions:[{revid:123,timestamp:'2026-09-03T00:00:00Z',slots:{main:{content}}}]}},built=buildUnlockLinkedPageSourceSignatures({identities,resolutions:[resolution],contentHash:hash});
check(templates.map(row=>row.template).join('|')==='External|Infobox Item','Only genuine root templates should be inventoried; nested, comment, and nowiki examples must not leak in.');
check(categories.length===1&&categories[0].category==='Example items','Direct source categories must retain their exact category identity.');
check(built.records[0].sourceRevision==='123'&&built.records[0].sourceContentHash===hash(content)&&built.records[0].revisionAlignedWithIdentity,'Source signatures must retain revision, content hash, and identity-revision alignment.');
check(built.audit.sourceSignatureCoverageComplete&&built.audit.identityRevisionAlignmentComplete&&built.audit.entityTypeClassificationComplete===false&&built.audit.repeatabilityProvenCount===0,'Complete structural capture must remain separate from semantic type and repeatability.');
const drift=buildUnlockLinkedPageSourceSignatures({identities,resolutions:[{...resolution,page:{...resolution.page,revisions:[{...resolution.page.revisions[0],revid:124}]}}],contentHash:hash});
check(drift.audit.publishable&&drift.audit.revisionAlignment.driftCount===1&&!drift.audit.identityRevisionAlignmentComplete&&drift.audit.blockers.includes('one_or_more_linked_page_identity_revisions_drifted'),'Revision drift must remain publishable evidence but block identity alignment.');
const missing=buildUnlockLinkedPageSourceSignatures({identities,resolutions:[],contentHash:hash});
check(!missing.audit.publishable&&missing.audit.blockers.includes('one_or_more_source_signatures_lack_revision_content_provenance'),'Missing API source content must fail publication.');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Cross-skill linked-page source-signature checks passed.');
