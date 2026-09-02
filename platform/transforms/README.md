# Canonicalization

`canonicalize.mjs` converts the newest immutable staging snapshots into
candidate canonical records and a coverage report. It never silently fills a
missing material value.

Canonical records are eligible for later formula evaluation. Quarantined
records retain their source payload, hash, revision, and explicit reasons. A
domain's staging capture may be complete while optimizer coverage is incomplete;
these are intentionally separate gates.

Recipe records expose objective-specific capabilities. XP-rate readiness needs
verified XP and timing; profit-rate readiness additionally needs resolved input
and output identities. A record can support one objective without being falsely
presented as complete for every objective.

Run `node platform/transforms/canonicalize.mjs`.
`activity-readiness.mjs` converts canonical training gaps into a deterministic
enrichment queue. It does not invent action timing or success formulas; records
remain blocked until activity-specific, source-backed vectors are approved.
