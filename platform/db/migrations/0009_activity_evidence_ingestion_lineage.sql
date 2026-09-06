BEGIN;

CREATE TABLE activity_evidence_ingestion_lineage (
  activity_evidence_id uuid PRIMARY KEY REFERENCES activity_evidence(id) ON DELETE CASCADE,
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_evidence_ingestion_lineage_run_idx
  ON activity_evidence_ingestion_lineage(ingestion_run_id);

COMMENT ON TABLE activity_evidence_ingestion_lineage IS
  'One-to-one provenance link from each materialized evidence statement to its exact accepted ingestion run.';

COMMIT;
