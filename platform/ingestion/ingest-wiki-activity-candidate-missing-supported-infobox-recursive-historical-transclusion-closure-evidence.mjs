import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, hash, writeSnapshot } from './lib.mjs';
import { WIKI_API } from './activity-evidence-lib.mjs';
import {
  buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence,
  extractHistoricalSourcesFromOneHopPackets,
  requiredRecursiveHistoricalSourceRequests
} from './activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-lib.mjs';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(argument('root') || '.platform-data');
const oneHopDirectory = argument('one-hop-snapshot');
const policyFile = 'platform/policies/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';
const oneHopPolicyFile = 'platform/policies/activity-candidate-missing-supported-infobox-template-alias-and-expansion-evidence-v1.json';
const recordContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-v1.json';
const auditContractFile = 'platform/contracts/activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-audit-v1.json';
const rejectionContract = 'sensum.activity-candidate-missing-supported-infobox-recursive-historical-transclusion-closure-evidence-audit.v1';

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

function historicalIdentity(request, data) {
  const normalized = new Map((data.query?.normalized || []).map(row => [row.from, row.to]));
  const page = data.query?.pages?.[0] || null;
  const revision = page?.revisions?.[0] || null;
  const sourceText = revision?.slots?.main?.content;
  const explicitMissing = Boolean(page && Object.hasOwn(page, 'missing'));
  return {
    requestedTitle: request.requestedTitle,
    normalizedTitle: normalized.get(request.requestedTitle) || request.requestedTitle,
    resolvedTitle: page?.title || normalized.get(request.requestedTitle) || request.requestedTitle,
    namespace: Number.isInteger(page?.ns) ? page.ns : null,
    sourcePageId: page?.pageid ? Number(page.pageid) : null,
    sourceRevision: revision?.revid ? String(revision.revid) : null,
    sourceTimestamp: revision?.timestamp || null,
    asOfTimestamp: request.asOfTimestamp,
    timestampAtOrBeforeBoundary: explicitMissing || Boolean(revision?.timestamp && Date.parse(revision.timestamp) <= Date.parse(request.asOfTimestamp)),
    sourceUrl: page?.title ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.title.replaceAll(' ', '_'))}` : null,
    sourceExactRevisionUrl: revision?.revid ? `https://oldschool.runescape.wiki/w/Special:PermanentLink/${revision.revid}` : null,
    sourceContentHash: typeof sourceText === 'string' ? hash(sourceText) : null,
    sourceContentBytes: typeof sourceText === 'string' ? Buffer.byteLength(sourceText, 'utf8') : 0,
    exactRevisionSourceText: typeof sourceText === 'string' ? sourceText : null,
    explicitMissing
  };
}

async function historicalSource(request) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
    rvprop: 'ids|timestamp|content', rvslots: 'main', rvlimit: '1',
    rvstart: request.asOfTimestamp, rvdir: 'older', titles: request.requestedTitle
  });
  return historicalIdentity(request, await fetchJson(`${WIKI_API}?${params}`));
}

async function fetchHistoricalClosure(oneHopRecords, initialSources, magicWordAliases, policy) {
  const collected = [...initialSources];
  for (let round = 0; round < 100; round += 1) {
    const pending = requiredRecursiveHistoricalSourceRequests(oneHopRecords, collected, magicWordAliases, policy);
    if (!pending.length) return collected;
    for (let index = 0; index < pending.length; index += 5) {
      collected.push(...await Promise.all(pending.slice(index, index + 5).map(historicalSource)));
      if (index + 5 < pending.length) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error('Recursive historical dependency discovery exceeded 100 rounds. Closure convergence is unresolved.');
}

function contractsMatch(records, audit, recordContract, auditContract) {
  const recordsMatch = records.every(record => recordContract.required.every(field => Object.hasOwn(record, field))
    && Object.entries(recordContract.invariants || {}).every(([field, value]) => hash(record[field]) === hash(value)));
  const auditMatches = auditContract.required.every(field => Object.hasOwn(audit, field))
    && Object.entries(auditContract.invariants || {}).every(([field, value]) => hash(audit[field]) === hash(value));
  return { recordsMatch, auditMatches, complete: recordsMatch && auditMatches };
}

if (!oneHopDirectory) {
  rejection('--one-hop-snapshot=<directory> is required. No input is selected automatically.');
} else {
  try {
    const [policy, oneHopPolicy, recordContract, auditContract] = await Promise.all([
      readJson(policyFile), readJson(oneHopPolicyFile), readJson(recordContractFile), readJson(auditContractFile)
    ]);
    const oneHop = await readSnapshot(oneHopDirectory, policy.inputOneHopDomain);
    const siteInfo = await fetchJson(`${WIKI_API}?action=query&format=json&formatversion=2&meta=siteinfo&siprop=magicwords`);
    const magicWordAliases = [...new Set((siteInfo.query?.magicwords || []).flatMap(row => row.aliases || []))];
    const extracted = extractHistoricalSourcesFromOneHopPackets(oneHop.records, hash);
    if (extracted.conflicts.length) throw new Error(`One-hop evidence contains conflicting historical source identities: ${extracted.conflicts.join(', ')}`);
    const historicalSources = await fetchHistoricalClosure(oneHop.records, extracted.historicalSources, magicWordAliases, policy);
    const built = buildActivityCandidateMissingSupportedInfoboxRecursiveHistoricalTransclusionClosureEvidence({
      oneHopRecords: oneHop.records, oneHopRaw: oneHop.raw, oneHopManifest: oneHop.manifest, oneHopSnapshot: oneHop.snapshot,
      historicalSources, magicWordAliases, policy, oneHopPolicy, contentHash: hash
    });
    const contractCoverage = contractsMatch(built.records, built.audit, recordContract, auditContract);
    if (!built.audit.publishable || !contractCoverage.complete) {
      rejection('Recursive historical transclusion closure evidence failed a structural, provenance, or contract gate.', null, { ...built.audit, contractCoverage });
    } else {
      const policyBinding = (id, file, value) => ({ id, file, contentHash: hash(value) });
      const inputSnapshot = { directory: oneHopDirectory, contentHash: oneHop.manifest.contentHash, createdAt: oneHop.manifest.createdAt };
      const fetchedHistoricalRevisions = historicalSources.map(source => ({
        requestedTitle: source.requestedTitle, normalizedTitle: source.normalizedTitle, resolvedTitle: source.resolvedTitle,
        namespace: source.namespace, pageId: source.sourcePageId, revision: source.sourceRevision, timestamp: source.sourceTimestamp,
        asOfTimestamp: source.asOfTimestamp, timestampAtOrBeforeBoundary: source.timestampAtOrBeforeBoundary,
        contentHash: source.sourceContentHash, explicitMissing: source.explicitMissing
      }));
      const source = {
        kind: 'revision_pinned_recursive_static_historical_template_and_module_dependency_closure_without_rendered_output_or_semantic_promotion',
        api: WIKI_API,
        fetchMode: 'latest template or module revision at or before each candidate timestamp without current-head redirect resolution',
        policy: policyBinding(policy.policy, policyFile, policy),
        inputOneHopPolicy: policyBinding(oneHopPolicy.policy, oneHopPolicyFile, oneHopPolicy),
        recordContract: { file: recordContractFile, contentHash: hash(recordContract) },
        auditContract: { file: auditContractFile, contentHash: hash(auditContract) },
        inputSnapshot,
        magicWordAliasCount: magicWordAliases.length,
        magicWordAliasSetContentHash: hash([...magicWordAliases].sort()),
        fetchedHistoricalRevisions,
        contractCoverage,
        audit: built.audit
      };
      const snapshot = await writeSnapshot(root, policy.outputDomain, built.records.map(record => ({ ...record, contentHash: hash(record) })), source);
      await Promise.all([
        fs.writeFile(path.join(snapshot.dir, 'recursive-historical-transclusion-closure.md'), built.artifacts.markdown),
        fs.writeFile(path.join(snapshot.dir, 'recursive-historical-transclusion-closure-index.json'), built.artifacts.graphIndex),
        fs.writeFile(path.join(snapshot.dir, 'artifact-manifest.json'), built.artifacts.artifactManifestJson)
      ]);
      const generatedAt = new Date().toISOString();
      const outputSnapshot = { directory: path.basename(snapshot.dir), contentHash: snapshot.manifest.contentHash };
      const report = {
        ...built.audit, generatedAt, policy: source.policy, inputSnapshot, outputSnapshot,
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
        inputSnapshot,
        outputSnapshot,
        reportDirectory,
        coverage: {
          closurePacketCount: report.candidateCoverage.closurePacketCount,
          historicalNodeCount: report.graphCoverage.historicalNodeCount,
          staticPageBackedEdgeCount: report.graphCoverage.staticPageBackedEdgeCount,
          completeStaticEdgeAssessmentCount: report.graphCoverage.completeStaticEdgeAssessmentCount,
          explicitHistoricalAbsenceEdgeCount: report.graphCoverage.explicitHistoricalAbsenceEdgeCount,
          redirectHopCount: report.graphCoverage.redirectHopCount,
          maximumObservedDepth: report.graphCoverage.maximumObservedDepth,
          cycleCount: report.graphCoverage.cycleCount,
          wikitextNodeCount: report.wrapperCoverage.wikitextNodeCount,
          luaModuleNodeCount: report.dependencyBoundaryCoverage.luaModuleNodeCount,
          dynamicOrEngineBoundaryCount: report.dependencyBoundaryCoverage.dynamicOrEngineBoundaryCount,
          boundaryClassCounts: report.dependencyBoundaryCoverage.boundaryClassCounts,
          staticRecursiveHistoricalTransclusionClosureComplete: report.staticRecursiveHistoricalTransclusionClosureComplete,
          completeRenderedOutputAttribution: report.completeRenderedOutputAttribution,
          humanReviewComplete: report.humanReviewComplete,
          completeActivityUniverse: report.completeActivityUniverse,
          absoluteBestGate: report.absoluteBestGate,
          blockers: report.blockers
        }
      }, null, 2));
    }
  } catch (error) {
    rejection('Explicit snapshot or required official Wiki evidence could not be read or validated.', error.message);
  }
}
