import { runAgilityGapWikiDiscovery } from './agility-gap-wiki-discovery-runner.mjs';

await runAgilityGapWikiDiscovery({
  policyRelativePath: 'platform/policies/agility-target-condition-gap-wiki-discovery-v1.json',
  snapshotDomain: 'agility-target-condition-gap-wiki-discovery',
  auditDirectoryName: 'agility-target-condition-gap-wiki-discovery-audits',
  sourceKind: 'query_bounded_target_condition_official_wiki_source_discovery',
  scope: '17 blockers across five level-34 target-condition gaps; not a complete Wiki or game-fact universe'
});
