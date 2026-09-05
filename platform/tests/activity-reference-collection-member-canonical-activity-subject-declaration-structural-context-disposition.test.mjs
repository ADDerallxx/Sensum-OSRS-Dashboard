import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditCanonicalActivitySubjectDeclarationStructuralContextDispositions,
  buildCanonicalActivitySubjectDeclarationStructuralContextDispositions,
  compileCanonicalActivitySubjectDeclarationStructuralContextDispositionPolicy
} from '../transforms/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-disposition-lib.mjs';

const policy = JSON.parse(fs.readFileSync('platform/policies/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-disposition-v1.json', 'utf8'));
const recordContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-disposition-v1.json', 'utf8'));
const auditContract = JSON.parse(fs.readFileSync('platform/contracts/activity-reference-collection-member-canonical-activity-subject-declaration-structural-context-disposition-audit-v1.json', 'utf8'));

function packet({ ordinal, pageId = 100, title = 'Example activity', region = 'active_source_text', exactCase = true, beforeHeading = true, template = null, parameter = null, link = false }) {
  const occurrenceKey = `member:a|${pageId}|5000:${ordinal}:16`;
  const exactSourceLines = `Example activity ${ordinal}`;
  return {
    structuralContextEvidenceKey: `${occurrenceKey}:structural-context-v1`,
    candidateEvidenceKey: `member:a|${pageId}|5000`,
    occurrenceKey,
    sourceRevisionEvidence: { sourcePageId: pageId, resolvedTitle: title, sourceRevision: '5000', sourceTimestamp: '2026-01-05T00:00:00Z', sourceUrl: `https://oldschool.runescape.wiki/w/${title.replaceAll(' ', '_')}`, sourceContentHash: `source-${pageId}`, completeRevisionContentScanned: true },
    sourceRevisionVerification: { fetchedPagePresent: true, fetchedRevisionContentPresent: true, fetchedPageIdMatchesCandidate: true, fetchedTitleMatchesCandidate: true, fetchedRevisionMatchesCandidate: true, fetchedTimestampMatchesCandidate: true, fetchedUrlMatchesCandidate: true, fetchedContentHashMatchesCandidate: true, upstreamCompleteRevisionScanConfirmed: true },
    sourceExactLineOccurrence: { occurrenceKey, matchedText: 'Example activity', canonicalActivityLabelExactCaseMatch: exactCase, sourceRegionState: region, sourceLocator: { absoluteOffsetStart: ordinal * 20, absoluteOffsetEnd: ordinal * 20 + 15, lineStart: ordinal, lineEnd: ordinal, columnStart: 1, columnEnd: 16 }, exactSourceLines, exactSourceLinesContentHash: hash(exactSourceLines), canonicalActivitySubjectDeclarationVerdict: null, canonicalActivityScopeVerdict: null, repeatabilityVerdict: null },
    exactOccurrenceRevalidation: { absoluteOffsetsMatch: true, lineAndColumnLocatorMatches: true, exactSourceLinesMatch: true, exactSourceLinesHashMatches: true, sourceRegionStateMatches: true, exactCaseFlagMatches: true },
    structuralContext: {
      sourceRegionState: region,
      pagePosition: { beforeFirstHeading: beforeHeading, headingHierarchy: beforeHeading ? [] : [{ level: 2, headingText: 'Details' }] },
      exactLine: { listMarker: null },
      contiguousSourceBlock: { exactSource: exactSourceLines, exactSourceContentHash: hash(exactSourceLines) },
      enclosingTemplates: template ? [{ templateName: template, occurrenceRole: { role: 'named_parameter_value', parameterOrdinal: 1, parameterName: parameter }, exactSource: `{{${template}|${parameter}=${exactSourceLines}}}` }] : [],
      enclosingTemplateParameterReferences: [],
      enclosingLinks: link ? [{ linkOrdinal: 1, occurrenceRole: { role: 'link_target', segmentOrdinal: 0, optionName: null }, exactSource: '[[Example activity]]' }] : [],
      enclosingTable: null,
      delimiterAudit: { templatesBalanced: true, linksBalanced: true, tablesBalanced: true },
      canonicalActivitySubjectDeclarationVerdict: null,
      canonicalActivityScopeVerdict: null,
      repeatabilityVerdict: null
    },
    canonicalActivitySubjectDeclarationVerdict: null,
    canonicalActivityScopeVerdict: null,
    repeatabilityVerdict: null,
    deficiencies: [],
    state: 'complete_revision_pinned_structural_context_evidence'
  };
}

function input(key = 'member:a', packets = null) {
  const rows = packets || [
    packet({ ordinal: 1, template: 'Infobox Activity', parameter: 'name' }),
    packet({ ordinal: 2, link: true }),
    packet({ ordinal: 3, pageId: 200, title: 'Other page', link: true }),
    packet({ ordinal: 4, pageId: 201, title: 'Another page' }),
    packet({ ordinal: 5, pageId: 202, title: 'Protected page', region: 'protected_or_ignored_source_region' })
  ];
  return {
    contract: policy.inputContract,
    memberCandidateKey: key,
    canonicalActivityIdentity: { canonicalActivityKey: `activity:${key}`, canonicalLabel: 'Example activity', stableIdentityAnchor: { collectionPageId: 10, linkedSubjectPageId: 20, relationshipClass: 'describes' } },
    canonicalActivitySubjectDeclarationStructuralContextEvidence: { evidenceState: 'complete_revision_pinned_subject_declaration_structural_context_evidence_packet', evidenceChannel: 'revision_pinned_exact_occurrence_structural_parent_inventory', canonicalActivityKey: `activity:${key}`, occurrenceStructuralContextPackets: rows },
    canonicalActivitySubjectDeclarationStructuralContextObservations: { occurrenceCount: rows.length, canonicalActivitySubjectDeclarationVerdict: null, canonicalActivityScopeVerdict: null, repeatabilityVerdict: null, deficiencies: [] },
    canonicalActivitySubjectDeclarationReview: { state: 'unreviewed_structural_context_evidence_collected_semantic_disposition_required', canonicalActivitySubjectDeclarationVerdict: null, canonicalActivityScopeVerdict: null, repeatabilityVerdict: null, evidenceKeys: [] },
    memberExpansionReview: { state: 'unreviewed', memberKeys: [], evidenceKeys: [] },
    mechanicsReview: { state: 'unreviewed', evidenceKeys: [] },
    optimizerEligible: false,
    accountIndependent: true,
    blockers: ['canonical_activity_subject_declaration_structural_context_requires_semantic_disposition'],
    state: policy.inputState,
    contentHash: `structural-${key}`
  };
}

const source = input();
const built = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [source], policy });
assert.equal(built.audit.publishable, true);
assert.equal(built.audit.structuralContextDispositionAttemptCoverageComplete, true);
assert.equal(built.audit.canonicalActivitySubjectDeclarationStructuralContextDispositionCoverageComplete, true);
assert.equal(built.audit.occurrenceDispositionCoverage.inputStructuralContextOccurrenceCount, 5);
assert.equal(built.audit.occurrenceDispositionCoverage.outputOccurrenceDispositionCount, 5);
assert.deepEqual(built.audit.occurrenceDispositionCoverage.evidenceUseClassCounts, {
  structurally_qualified_page_subject_declaration_candidate: 1,
  title_aligned_supporting_occurrence_not_subject_binding_evidence: 1,
  cross_page_link_reference_not_subject_binding_evidence: 1,
  cross_page_unlinked_mention_not_subject_binding_evidence: 1,
  protected_or_mixed_occurrence_non_supporting: 1
});
assert.equal(built.audit.subjectCandidateCoverage.structurallyQualifiedCandidateCount, 1);
assert.equal(built.audit.subjectCandidateCoverage.canonicalActivitySubjectBindingCount, 0);
assert.equal(built.audit.subjectCandidateCoverage.schemaSemanticsRevisionPinned, false);
const output = built.records[0];
assert.equal(output.canonicalActivitySubjectDeclarationStructuralDisposition.state, 'structurally_qualified_subject_candidate_requires_revision_pinned_schema_semantics');
assert.equal(output.canonicalActivitySubjectBinding, null);
assert.equal(output.canonicalActivitySubjectDeclarationReview.canonicalActivitySubjectDeclarationVerdict, null);
assert.equal(output.optimizerEligible, false);
for (const field of recordContract.required) assert.ok(Object.hasOwn(output, field), `missing record field ${field}`);
for (const field of auditContract.required) assert.ok(Object.hasOwn(built.audit, field), `missing audit field ${field}`);

const repeated = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [source], policy });
assert.equal(hash(built.records), hash(repeated.records));

const referenceOnly = input('member:reference-only', [packet({ ordinal: 6, pageId: 300, title: 'Reference page', link: true })]);
const unresolved = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [referenceOnly], policy });
assert.equal(unresolved.audit.publishable, true);
assert.equal(unresolved.records[0].canonicalActivitySubjectDeclarationStructuralDisposition.state, 'unresolved_no_structurally_qualified_subject_declaration_candidate');
assert.equal(unresolved.records[0].canonicalActivitySubjectDeclarationStructuralDisposition.canonicalActivitySubjectDeclarationVerdict, null);
assert.ok(unresolved.records[0].blockers.includes('canonical_activity_subject_page_not_identified'));

const conflicts = input('member:conflict', [
  packet({ ordinal: 7, pageId: 400, template: 'Infobox Activity', parameter: 'name' }),
  packet({ ordinal: 8, pageId: 401, template: 'Infobox Activity', parameter: 'name' })
]);
const conflict = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [conflicts], policy });
assert.equal(conflict.audit.publishable, true);
assert.equal(conflict.records[0].canonicalActivitySubjectDeclarationStructuralDisposition.state, 'blocked_multiple_structurally_qualified_subject_pages');

const forbiddenPolicy = structuredClone(policy);
forbiddenPolicy.overrides = { 'activity:member:a': 'supported' };
const forbidden = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [source], policy: forbiddenPolicy });
assert.equal(forbidden.audit.publishable, false);
assert.ok(forbidden.audit.blockers.includes('canonical_activity_subject_declaration_structural_context_disposition_policy_invalid_or_activity_specific'));

const promotedRecords = structuredClone(built.records);
promotedRecords[0].canonicalActivitySubjectBinding = { sourcePageId: 100 };
promotedRecords[0].optimizerEligible = true;
const promoted = auditCanonicalActivitySubjectDeclarationStructuralContextDispositions(promotedRecords, { structuralContextRecords: [source], policy });
assert.equal(promoted.publishable, false);
assert.ok(promoted.blockers.includes('structural_context_disposition_created_unsupported_semantic_or_downstream_promotion'));

const accountRecords = structuredClone(built.records);
accountRecords[0].currentBaseLevel = 34;
const account = auditCanonicalActivitySubjectDeclarationStructuralContextDispositions(accountRecords, { structuralContextRecords: [source], policy });
assert.equal(account.publishable, false);
assert.ok(account.blockers.includes('account_query_state_baked_into_subject_declaration_structural_context_disposition'));

const invalidInput = structuredClone(source);
invalidInput.canonicalActivitySubjectDeclarationStructuralContextObservations.deficiencies = ['incomplete'];
const invalid = buildCanonicalActivitySubjectDeclarationStructuralContextDispositions({ structuralContextRecords: [invalidInput], policy });
assert.equal(invalid.audit.publishable, false);
assert.ok(invalid.audit.blockers.includes('no_complete_structural_context_evidence_inputs'));

const compiled = compileCanonicalActivitySubjectDeclarationStructuralContextDispositionPolicy(policy);
assert.equal(compiled.candidateRuleValid, true);
assert.deepEqual(compiled.invalidRules, []);
assert.deepEqual(compiled.forbiddenPolicyPaths, []);
console.log('Canonical activity subject-declaration structural-context disposition checks passed.');
