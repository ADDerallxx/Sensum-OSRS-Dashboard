import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hash } from '../ingestion/lib.mjs';
import {
  auditAgilityColossalWyrmObstaclePageVariantReconciliation,
  buildAgilityColossalWyrmObstaclePageVariantReconciliation,
  compileAgilityColossalWyrmObstaclePageVariantPolicy
} from '../ingestion/agility-colossal-wyrm-obstacle-page-variant-reconciliation-lib.mjs';
import { auditAgilityColossalWyrmGuideMemberCoverage } from '../transforms/agility-colossal-wyrm-guide-member-coverage-lib.mjs';

let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const policy = JSON.parse(fs.readFileSync('platform/policies/agility-colossal-wyrm-obstacle-page-variant-reconciliation-v1.json', 'utf8'));
const page = (title, content, revision, timestamp = '2026-09-05T00:00:00Z') => ({
  title, content, sourceRevision: String(revision), sourceTimestamp: timestamp,
  sourceUrl: `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision}`
});
const row = (title, version, label, xp, action = 'Yes') => `|-
| [[File:Colossal Wyrm course row.png|100px]]
| [[${title}#${version}|${label}]]
| style="text-align:center;"| ${action}
| {{+=|xp|${xp}|echo=2}}`;
const course = ({ basicZipline, advancedZipline }) => `===Basic course obstacles===
${row('Ladder (Colossal Wyrm Agility Course)', '1', 'Ladder', 37.2)}
${row('Tightrope (Colossal Wyrm Agility Course)', '1', 'Tightrope', 37.2)}
${row('Edge (Colossal Wyrm Agility Course)', '1', 'Edge', 37.2)}
${row('Tightrope (Colossal Wyrm Agility Course)', '2', 'Tightrope', 37.2)}
${row('Rope (Colossal Wyrm Agility Course)', '1', 'Rope', 37.2)}
${row('Edge (Colossal Wyrm Agility Course)', '2', 'Edge', 37.2)}
${row('Ladder (Colossal Wyrm Agility Course)', '3', 'Ladder', 37.2)}
${row('Zipline (Colossal Wyrm Agility Course)', 'Basic', 'Zipline', basicZipline)}
===Advanced course obstacles===
${row('Ladder (Colossal Wyrm Agility Course)', '1', 'Ladder', 37.2)}
${row('Tightrope (Colossal Wyrm Agility Course)', '1', 'Tightrope', 37.2)}
${row('Edge (Colossal Wyrm Agility Course)', '1', 'Edge', 37.2)}
${row('Ladder (Colossal Wyrm Agility Course)', '2', 'Ladder', 70)}
${row('Edge (Colossal Wyrm Agility Course)', '3', 'Edge', 70)}
${row('Tightrope (Colossal Wyrm Agility Course)', '3', 'Tightrope', 70)}
${row('Rope (Colossal Wyrm Agility Course)', '2', 'Rope', 70)}
${row('Zipline (Colossal Wyrm Agility Course)', 'Advanced', 'Zipline', advancedZipline)}
===Termites===`;
const obstacleTemplate = variants => `{{Agility info
${variants.map(({ version, level, xp }, index) => `|version${index + 1} = ${version}\n|level${index + 1} = ${level}\n|xp${index + 1} = ${xp}`).join('\n')}
}}`;
const obstacleDefinitions = {
  'Ladder (Colossal Wyrm Agility Course)': [
    { version: '1', level: 50, xp: 37.2 }, { version: '2', level: 62, xp: 62 }, { version: '3', level: 50, xp: 37.2 }
  ],
  'Tightrope (Colossal Wyrm Agility Course)': [
    { version: '1', level: 50, xp: 37.2 }, { version: '2', level: 50, xp: 37.2 }, { version: '3', level: 62, xp: 62 }
  ],
  'Edge (Colossal Wyrm Agility Course)': [
    { version: '1', level: 50, xp: 37.2 }, { version: '2', level: 50, xp: 37.2 }, { version: '3', level: 62, xp: 62 }
  ],
  'Rope (Colossal Wyrm Agility Course)': [
    { version: '1', level: 50, xp: 37.2 }, { version: '2', level: 62, xp: 62 }
  ],
  'Zipline (Colossal Wyrm Agility Course)': [
    { version: 'Basic', level: 50, xp: 243.7 }, { version: 'Advanced', level: 62, xp: 325 }
  ]
};
const currentCourse = page(policy.courseTitle, course({ basicZipline: 341.2, advancedZipline: 662 }), '15331454');
const currentPages = [currentCourse, ...policy.obstaclePages.map((entry, index) => page(entry.title, obstacleTemplate(obstacleDefinitions[entry.title]), String(15329584 + index)))];
const historicalPages = [
  page(policy.courseTitle, course({ basicZipline: 243.7, advancedZipline: 358 }), policy.historicalCourseRevisions.lastConfirmedPreUpdateRevision),
  page(policy.courseTitle, course({ basicZipline: 341.2, advancedZipline: 662 }), policy.historicalCourseRevisions.firstCompletePostUpdateTableRevision),
  ...policy.obstaclePages.map(entry => page(entry.title, obstacleTemplate(obstacleDefinitions[entry.title]), entry.preUpdateRevision))
];
const currentBindings = Object.fromEntries(currentPages.map(source => [source.title, {
  title: source.title, revision: source.sourceRevision, timestamp: source.sourceTimestamp, url: source.sourceUrl
}]));
const inputSnapshot = { directory: 'fixture-reconciliation', contentHash: 'a'.repeat(64), records: 2 };
const priorRecord = (routePolicy, minimumAgility, memberKey, remainingBlockers) => {
  const base = {
    contract: policy.inputReconciliationContract,
    updateDate: policy.updateDate,
    memberKey,
    routePolicy,
    minimumAgility,
    temporalAssignmentComplete: true,
    mechanicalAuthorityComplete: false,
    optimizerEligible: false,
    verifiedBestAuthorized: false,
    automaticVerificationApplied: false,
    accountIndependent: true,
    remainingBlockers,
    sourceRevisions: {
      currentCourse: currentBindings[policy.courseTitle],
      obstacles: policy.obstaclePages.map(entry => currentBindings[entry.title])
    }
  };
  const recordContentHash = hash(base);
  const withRecordHash = { ...base, recordContentHash };
  return { ...withRecordHash, contentHash: hash(withRecordHash) };
};
const reconciliation = [
  priorRecord('basic_route', 50, 'colossal-wyrm:basic-route', [
    'current_course_page_obsolete_for_duration_experience_termites_and_bone_shards',
    'basic_current_obstacle_pages_not_reconciled_with_course_table',
    'basic_approximate_or_upper_bound_rate_not_exact_expected_rate',
    'basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6'
  ]),
  priorRecord('advanced_route', 62, 'colossal-wyrm:advanced-route', [
    'current_course_page_obsolete_for_duration_experience_termites_and_bone_shards',
    'advanced_current_obstacle_pages_not_reconciled_with_course_table',
    'advanced_approximate_or_upper_bound_rate_not_exact_expected_rate'
  ])
];
const options = {
  policy, currentPages, historicalPages,
  inputReconciliationRecords: reconciliation,
  inputReconciliationSnapshot: inputSnapshot,
  contentHash: hash
};

check(compileAgilityColossalWyrmObstaclePageVariantPolicy(policy).valid, 'The exact obstacle-page policy should compile.');
const built = buildAgilityColossalWyrmObstaclePageVariantReconciliation(options);
check(built.audit.publishable && built.audit.reconciliationComplete, 'Complete exact variant evidence should publish the identity reconciliation.');
check(built.records.length === 13 && built.audit.variantCoverage.complete, 'All 13 unique obstacle-page variants must be independently represented.');
check(built.audit.routeOccurrenceCoverage.currentCourseOccurrenceCount === 16
  && built.audit.routeOccurrenceCoverage.basicCurrentOccurrenceCount === 8
  && built.audit.routeOccurrenceCoverage.advancedCurrentOccurrenceCount === 8
  && built.audit.routeOccurrenceCoverage.noUnparsedOrAdditionalXpRows, 'Both eight-row routes and all 16 occurrences must remain explicit even when image links precede obstacle links.');
check(built.audit.xpReconciliation.currentCourseOccurrenceMatchCount === 10
  && built.audit.xpReconciliation.currentCourseOccurrenceConflictCount === 6, 'The current course must retain ten matching and six conflicting route occurrences.');
check(built.audit.xpReconciliation.currentPageVariantMatchCount === 7
  && built.audit.xpReconciliation.currentPageVariantConflictCount === 6, 'Seven unique variants should match and six should conflict with current course rows.');
check(built.audit.xpReconciliation.currentFieldsMatchingPinnedPreUpdatePageCount === 13, 'All current obstacle variant fields must be shown to match their pinned pre-update page revisions.');
check(built.audit.xpReconciliation.currentPageMatchingOnlyPreUpdateCourseCount === 1
  && built.audit.xpReconciliation.currentPageConflictingWithPreAndCurrentCourseCount === 5, 'The Basic zipline alone matches only the pre-update course; five Advanced variants conflict with both course states.');
const basicZipline = built.records.find(record => record.variantKey === 'colossal-wyrm:zipline:basic');
const advancedZipline = built.records.find(record => record.variantKey === 'colossal-wyrm:zipline:advanced');
check(basicZipline.currentPageXp === 243.7 && basicZipline.courseOccurrences[0].xp === 341.2
  && basicZipline.xpDisposition === 'current_obstacle_page_matches_pinned_pre_update_course_only', 'The Basic zipline must retain its exact 243.7 page versus 341.2 current-course conflict.');
check(advancedZipline.currentPageXp === 325 && advancedZipline.preUpdateCourseOccurrences[0].xp === 358
  && advancedZipline.courseOccurrences[0].xp === 662, 'The Advanced zipline must keep all three conflicting source values separate.');
check(built.audit.blockerPreservation.preciseRemainingBlockerCount === 6, 'All six mismatches must become precise variant-specific blockers.');
check(built.records.every(record => !record.mechanicalAuthorityComplete && !record.optimizerEligible && !record.verifiedBestAuthorized), 'Identity reconciliation must never grant mechanical or optimizer authority.');
check(built.records.every(record => record.recordContentHash === hash(Object.fromEntries(Object.entries(record).filter(([key]) => !['recordContentHash', 'contentHash'].includes(key))))), 'Every record content hash must reproduce.');

const members = reconciliation.map((record, index) => ({
  memberKey: record.memberKey,
  candidateKey: `guide:colossal-wyrm:${index ? 'advanced' : 'basic'}`,
  name: `Colossal Wyrm — ${index ? 'Advanced' : 'Basic'}`,
  sourceOrder: index,
  routePolicy: record.routePolicy,
  minimumAgility: record.minimumAgility,
  guideSourceRevision: '15324367',
  sectionKey: 'other-methods:levels-50-62-colossal-wyrm-agility-course',
  corroboratingMinimumAgility: [record.minimumAgility],
  mechanicalBlockers: ['exact_post_update_mechanics_not_reconciled']
}));
const guideCandidates = members.map(member => ({ candidate_key: member.candidateKey, source_section_key: member.sectionKey, source_revision: member.guideSourceRevision, minimum_agility: member.minimumAgility }));
const integrated = auditAgilityColossalWyrmGuideMemberCoverage({ members, guideCandidates, reconciliation, obstacleVariants: built.records });
check(integrated.internalMemberAuditSatisfied && integrated.obstacleVariantReconciliationApplied, 'The complete exact variant set should integrate into both route members.');
check(!integrated.mechanicalBlockers.includes('basic_current_obstacle_pages_not_reconciled_with_course_table')
  && !integrated.mechanicalBlockers.includes('advanced_current_obstacle_pages_not_reconciled_with_course_table'), 'Complete exact coverage must remove both generic obstacle-page blockers.');
check(integrated.mechanicalBlockers.filter(blocker => /^(basic|advanced)_obstacle_/.test(blocker)).length === 6, 'Downstream coverage must retain the six exact obstacle conflicts.');
check(integrated.mechanicalBlockers.includes('basic_post_update_lap_xp_633_conflicts_with_current_obstacle_table_601_6')
  && integrated.mechanicalCompletenessProven === false, 'Unrelated lap-XP and mechanical blockers must survive exact variant integration.');

const invalidPolicy = structuredClone(policy);
invalidPolicy.expectedVariantKeys[0] = 'colossal-wyrm:invented:1';
check(!compileAgilityColossalWyrmObstaclePageVariantPolicy(invalidPolicy).valid, 'A substituted variant key must invalidate the exact policy set.');
const missingHistorical = buildAgilityColossalWyrmObstaclePageVariantReconciliation({ ...options, historicalPages: historicalPages.slice(1) });
check(!missingHistorical.audit.publishable && missingHistorical.records.length === 0, 'A missing exact historical source must fail closed.');
const extraRowPages = structuredClone(currentPages);
extraRowPages[0].content = extraRowPages[0].content.replace('===Advanced course obstacles===', `${row('Unknown obstacle', '1', 'Unknown', 1)}\n===Advanced course obstacles===`);
const extraRow = buildAgilityColossalWyrmObstaclePageVariantReconciliation({ ...options, currentPages: extraRowPages });
check(!extraRow.audit.publishable && !extraRow.audit.routeOccurrenceCoverage.noUnparsedOrAdditionalXpRows, 'An additional unrecognized XP row must fail closed instead of being silently ignored.');
const tamperedPrior = structuredClone(reconciliation);
tamperedPrior[0].minimumAgility = 51;
const staleInput = buildAgilityColossalWyrmObstaclePageVariantReconciliation({ ...options, inputReconciliationRecords: tamperedPrior });
check(!staleInput.audit.publishable && staleInput.audit.blockers.includes('input_temporal_reconciliation_missing_or_invalid'), 'A tampered prior reconciliation must fail its explicit lineage boundary.');
const accountBound = buildAgilityColossalWyrmObstaclePageVariantReconciliation({ ...options, currentBaseLevel: 34 });
check(!accountBound.audit.publishable && accountBound.audit.blockers.includes('account_query_state_baked_into_obstacle_variant_reconciliation'), 'Account-query state must be rejected from the account-independent variant reconciliation.');
const promoted = structuredClone(built.records);
promoted[0].optimizerEligible = true;
const promotionAudit = auditAgilityColossalWyrmObstaclePageVariantReconciliation(promoted, options);
check(!promotionAudit.publishable && promotionAudit.blockers.includes('obstacle_variant_reconciliation_promoted_mechanical_or_optimizer_authority'), 'Any optimizer promotion must fail closed.');
const invalidIntegration = auditAgilityColossalWyrmGuideMemberCoverage({ members, guideCandidates, reconciliation, obstacleVariants: promoted });
check(!invalidIntegration.internalMemberAuditSatisfied
  && invalidIntegration.obstacleVariantSetValidationBlockers.includes('obstacle_variant_record_hash_invalid'), 'The downstream boundary must independently reject altered variant records.');

console.log(`Agility Colossal Wyrm obstacle-page variant reconciliation checks passed: ${checks}`);
