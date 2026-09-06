import { runAgilityGapWikiDiscovery } from './agility-gap-wiki-discovery-runner.mjs';

await runAgilityGapWikiDiscovery({
  policyRelativePath: 'platform/policies/agility-mechanical-gap-wiki-discovery-v1.json',
  snapshotDomain: 'agility-mechanical-gap-wiki-discovery',
  auditDirectoryName: 'agility-mechanical-gap-wiki-discovery-audits',
  sourceKind: 'query_bounded_candidate_specific_official_wiki_source_discovery',
  scope: 'four blockers across three level-34 mechanical-model gaps; not a complete Wiki or game-fact universe'
});
