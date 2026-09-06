import assert from 'node:assert/strict';
import test from 'node:test';
import {buildExistingExactWikiSourceCountQuery,exactWikiSourceIdentityKey,exactWikiSourceReconciliationPredicate} from '../db/exact-wiki-source-identity-lib.mjs';

test('exact Wiki revision identity is URL and revision, not a domain-specific provider alias',()=>{
  const source={sourceUrl:'https://oldschool.runescape.wiki/w/Prayer%2FLevel_up_table',title:'Prayer/Level up table',providerKey:'wiki-pageid:182673',sourceRevision:'15309555',sourceTimestamp:'2026-08-19T20:38:17Z',sourceContentHash:'a'.repeat(64)};
  assert.equal(exactWikiSourceIdentityKey(source),`${source.sourceUrl}|${source.sourceRevision}`);
  const query=buildExistingExactWikiSourceCountQuery([source]);
  assert.match(query,/canonical_url=e\.source_url/);
  assert.match(query,/title=e\.title/);
  assert.match(query,/revision_key=e\.source_revision/);
  assert.match(query,/published_at=e\.published_at/);
  assert.match(query,/content_hash=e\.content_hash/);
  assert.doesNotMatch(query,/provider_key=e\.provider_key/);
  assert.doesNotMatch(exactWikiSourceReconciliationPredicate(),/provider_key/);
});
