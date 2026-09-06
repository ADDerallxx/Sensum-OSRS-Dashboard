import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence,
  requiredHistoricalSourceRequests
} from './activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const routingDirectory = argument('routing-snapshot');
const sourceEvidenceDirectory = argument('source-evidence-snapshot');
const packetDirectory = argument('packet-snapshot');
const policyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const routingPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-evidence-work-routing-v1.json';
const sourceEvidencePolicyFile = 'platform/policies/activity-candidate-semantic-evidence-v1.json';
const packetPolicyFile = 'platform/policies/activity-candidate-priority-human-review-packet-consolidation-v1.json';
const recordContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const auditContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-audit-v1.json';
const rejectionContract = 'sensum.activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-audit.v1';

function rejection(reason, error = null, audit = null) {
  console.log(JSON.stringify({ contract: rejectionContract, accepted: false, reason, ...(error ? { error } : {}), ...(audit ? { audit } : {}), outputWritten: false }, null, 2));
  process.exitCode = 2;
}

async function readJson(file) { return JSON.parse(await fs.readFile(path.resolve(file), 'utf8')); }
async function readSnapshot(directory, domain) {
  const raw = await fs.readFile(path.join(root, directory, `${domain}.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = JSON.parse(await fs.readFile(path.join(root, directory, 'manifest.json'), 'utf8'));
  return { raw, records, manifest, snapshot: { directory, contentHash: manifest.contentHash, createdAt: manifest.createdAt, explicit: true } };
}

async function exactRevisionPages(revisionIds) {
  const pages = [];
  for (let index = 0; index < revisionIds.length; index += 20) {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: revisionIds.slice(index, index + 20).join('|') });
    const data = await fetchJson(`${WIKI_API}?${params}`);
    pages.push(...(data.query?.pages || []));
    if (index + 20 < revisionIds.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return pages;
}

async function historicalSource(request) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
    rvprop: 'ids|timestamp|content', rvslots: 'main', rvlimit: '1',
    rvstart: request.asOfTimestamp, rvdir: 'older', titles: request.requestedTitle
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const normalized = new Map((data.query?.normalized || []).map(row => [row.from, row.to]));
  return {
    requestedTitle: request.requestedTitle,
    normalizedTitle: normalized.get(request.requestedTitle) || request.requestedTitle,
    asOfTimestamp: request.asOfTimestamp,
    page: data.query?.pages?.[0] || null
  };
}

async function fetchHistoricalClosure(routes, magicWordAliases) {
  const collected = [];
  for (let round = 0; round < 20; round += 1) {
    const pending = requiredHistoricalSourceRequests(routes, collected, magicWordAliases);
    if (!pending.length) return collected;
    for (let index = 0; index < pending.length; index += 5) {
      collected.push(...await Promise.all(pending.slice(index, index + 5).map(historicalSource)));
      if (index + 5 < pending.length) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error('Historical source closure exceeded 20 discovery rounds. Redirect depth or request convergence is unresolved.');
}

function contractsMatch(records, audit, recordContract, auditContract) {
  const recordsMatch = records.every(record => recordContract.required.every(field => Object.hasOwn(record, field))
    && Object.entries(recordContract.invariants || {}).every(([field, value]) => hash(record[field]) === hash(value)));
  const auditMatches = auditContract.required.every(field => Object.hasOwn(audit, field))
    && Object.entries(auditContract.invariants || {}).every(([field, value]) => hash(audit[field]) === hash(value));
  return { recordsMatch, auditMatches, complete: recordsMatch && auditMatches };
}

if (!routingDirectory || !sourceEvidenceDirectory || !packetDirectory) {
  rejection('--routing-snapshot=<directory>, --source-evidence-snapshot=<directory>, and --packet-snapshot=<directory> are required. No input is selected automatically.');
} else {
  try {
    const [policy, routingPolicy, sourceEvidencePolicy, packetPolicy, recordContract, auditContract] = await Promise.all([
      readJson(policyFile), readJson(routingPolicyFile), readJson(sourceEvidencePolicyFile), readJson(packetPolicyFile), readJson(recordContractFile), readJson(auditContractFile)
    ]);
    const [routing, sourceEvidence, packet] = await Promise.all([
      readSnapshot(routingDirectory, policy.inputRoutingDomain),
      readSnapshot(sourceEvidenceDirectory, routingPolicy.inputSourceEvidenceDomain),
      readSnapshot(packetDirectory, routingPolicy.inputPacketDomain)
    ]);
    const siteInfo = await fetchJson(`${WIKI_API}?action=query&format=json&formatversion=2&meta=siteinfo&siprop=magicwords`);
    const magicWordAliases = [...new Set((siteInfo.query?.magicwords || []).flatMap(row => row.aliases || []))];
    const candidatePages = await exactRevisionPages([...new Set(routing.records.map(row => row.sourcePageIdentity.sourceRevision))]);
    const historicalSources = await fetchHistoricalClosure(routing.records, magicWordAliases);
    const built = buildActivityCandidateMissingSupportedInfoboxTemplateAliasAndExpansionEvidence({
      routingRecords: routing.records, routingRaw: routing.raw, routingManifest: routing.manifest, routingSnapshot: routing.snapshot,
      sourceEvidenceRecords: sourceEvidence.records, sourceEvidenceRaw: sourceEvidence.raw, sourceEvidenceManifest: sourceEvidence.manifest, sourceEvidenceSnapshot: sourceEvidence.snapshot,
      packetRecords: packet.records, packetRaw: packet.raw, packetManifest: packet.manifest, packetSnapshot: packet.snapshot,
      candidatePages, historicalSources, magicWordAliases,
      policy, routingPolicy, sourceEvidencePolicy, packetPolicy, contentHash: hash
    });
    const contractCoverage = contractsMatch(built.records, built.audit, recordContract, auditContract);
    const inputSnapshots = {
      routing: { directory: routingDirectory, contentHash: routing.manifest.contentHash, createdAt: routing.manifest.createdAt },
      sourceEvidence: { directory: sourceEvidenceDirectory, contentHash: sourceEvidence.manifest.contentHash, createdAt: sourceEvidence.manifest.createdAt },
      packet: { directory: packetDirectory, contentHash: packet.manifest.contentHash, createdAt: packet.manifest.createdAt }
    };
    if (!built.audit.publishable || !contractCoverage.complete) {
      rejection('Revision-pinned template alias and one-hop expansion evidence failed a structural, provenance, or contract gate.', null, { ...built.audit, contractCoverage });
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const fetchedHistoricalRevisions = historicalSources.map(source => {
        const revision = source.page?.revisions?.[0];
        const content = revision?.slots?.main?.content;
        return {
          requestedTitle: source.requestedTitle,
          normalizedTitle: source.normalizedTitle,
          asOfTimestamp: source.asOfTimestamp,
          resolvedTitle: source.page?.title || null,
          namespace: source.page?.ns ?? null,
          pageId: source.page?.pageid ? Number(source.page.pageid) : null,
          revision: revision?.revid ? String(revision.revid) : null,
          timestamp: revision?.timestamp || null,
          contentHash: typeof content === 'string' ? hash(content) : null,
          explicitMissing: Boolean(source.page && Object.hasOwn(source.page, 'missing'))
        };
      });
      const source = {
        kind: 'revision_pinned_missing_supported_infobox_root_template_alias_and_one_hop_expansion_evidence_without_semantic_or_optimizer_promotion',
        api: WIKI_API,
        fetchMode: 'exact candidate revision plus latest template or module revision at or before each candidate timestamp without API redirect resolution',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputRoutingPolicy: policyBinding(routingPolicy.policy, routingPolicyFile, routingPolicy),
        inputSourceEvidencePolicy: policyBinding(sourceEvidencePolicy.policy, sourceEvidencePolicyFile, sourceEvidencePolicy),
        inputPacketPolicy: policyBinding(packetPolicy.policy, packetPolicyFile, packetPolicy),
        recordContract: { file: recordContractFile, contentHash: hash(recordContract) },
        auditContract: { file: auditContractFile, contentHash: hash(auditContract) },
        inputSnapshots,
        magicWordAliasCount: magicWordAliases.length,
        magicWordAliasSetContentHash: hash([...magicWordAliases].sort()),
        fetchedHistoricalRevisions,
        contractCoverage,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'template-alias-and-expansion-evidence.md'), built.artifacts.markdown),
        fs.writeFile(path.join(snapshot.dir, 'template-alias-and-expansion-evidence-index.json'), built.artifacts.packetIndex),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const report = {
        ...built.audit, generatedAt, policy: source.policy, inputSnapshots, outputSnapshot,
        fetchedHistoricalRevisions, contractCoverage,
        artifacts: {
          ...built.artifacts.artifactManifest,
          artifactManifest: { file: 'artifact-manifest.json', contentHash: hash(built.artifacts.artifactManifestJson), bytes: Buffer.byteLength(built.artifacts.artifactManifestJson, 'utf8') }
        }
      };
      report.contentHash = hash({ ...report, contentHash: undefined });
      const reportDirectory = path.join(root, `${policy.outputDomain}-audits`, generatedAt.replace(/[:.]/g, '-'));
      await fs.mkdir(reportDirectory, { recursive: true });
      await fs.writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({
        contract: report.contract,
        accepted: true,
        inputSnapshots,
        outputSnapshot,
        reportDirectory,
        coverage: {
          evidencePacketCount: report.candidateCoverage.evidencePacketCount,
          exactCandidateRevisionMatchCount: report.candidateCoverage.exactCandidateRevisionMatchCount,
          retainedRootTemplateInvocationCount: report.rootTemplateCoverage.expectedRetainedInvocationCount,
          completeRootTemplateHistoricalAssessmentCount: report.rootTemplateCoverage.completeHistoricalAssessmentCount,
          explicitHistoricalRootAbsenceCount: report.rootTemplateCoverage.explicitHistoricalAbsenceCount,
          redirectHopCount: report.aliasAndRedirectCoverage.redirectHopCount,
          rootsWithWrapperBehaviorCount: report.wrapperAndDependencyCoverage.rootsWithWrapperBehaviorCount,
          sourceInvocationOccurrenceCount: report.wrapperAndDependencyCoverage.sourceInvocationOccurrenceCount,
          pageBackedOneHopDependencyOccurrenceCount: report.wrapperAndDependencyCoverage.pageBackedOneHopDependencyOccurrenceCount,
          completePageBackedOneHopDependencyAssessmentCount: report.wrapperAndDependencyCoverage.completePageBackedOneHopDependencyAssessmentCount,
          explicitHistoricalDependencyAbsenceCount: report.wrapperAndDependencyCoverage.explicitHistoricalDependencyAbsenceCount,
          evidencePacketCoverageComplete: report.evidencePacketCoverageComplete,
          recursiveHistoricalExpansionClosureComplete: report.recursiveHistoricalExpansionClosureComplete,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit snapshots or required official Wiki evidence could not be read or validated.', error.message);
  }
}
