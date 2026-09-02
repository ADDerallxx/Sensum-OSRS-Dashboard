BEGIN;

CREATE TYPE activity_evidence_state AS ENUM ('candidate','parsed','verified','rejected','stale');

CREATE TABLE activity_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_method_id uuid REFERENCES activity_methods(id) ON DELETE CASCADE,
  record_key text NOT NULL,
  fact_kind text NOT NULL,
  state activity_evidence_state NOT NULL DEFAULT 'candidate',
  raw_locator jsonb NOT NULL,
  parsed_value jsonb,
  formula_version text,
  source_id uuid NOT NULL REFERENCES data_sources(id),
  source_revision text NOT NULL,
  source_timestamp timestamptz,
  content_hash text NOT NULL,
  reviewed_at timestamptz,
  reviewed_by text,
  UNIQUE(record_key,fact_kind,source_revision)
);

CREATE TABLE activity_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status ingestion_status NOT NULL DEFAULT 'running',
  queue_hash text NOT NULL,
  source_manifest jsonb NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  parsed_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE INDEX activity_evidence_method_idx ON activity_evidence(activity_method_id,state);
CREATE INDEX activity_evidence_revision_idx ON activity_evidence(source_revision);

COMMIT;
