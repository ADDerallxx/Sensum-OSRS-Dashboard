# Sensum V4 Platform Foundation

This isolated foundation does not serve production traffic yet.

## Target platform

- Next.js/React web client
- Cloud Run API and calculation workers
- Cloud SQL for PostgreSQL
- Cloud Run Jobs for Wiki, price, and validation refreshes
- Vertex AI for evidence review and explanations, never authoritative math

## Accuracy boundary

The optimizer may only rank a candidate when every material input is sourced
and current, explicitly modeled as an assumption with a sensitivity range, or
marked unknown and excluded from an absolute-best claim.

Generative AI may propose relationships, summarize revisions, and explain a
deterministic result. It may not invent stats, requirements, or formulas.

Run `node platform/tests/foundation.test.mjs` from the repository root.

