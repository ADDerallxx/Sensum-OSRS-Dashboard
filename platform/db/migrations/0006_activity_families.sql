BEGIN;

CREATE TABLE activity_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_key text NOT NULL UNIQUE,
  family_kind text NOT NULL,
  model_kind activity_model_kind,
  classifier_version text NOT NULL,
  state evidence_state NOT NULL DEFAULT 'draft',
  formula_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_family_members (
  activity_family_id uuid NOT NULL REFERENCES activity_families(id) ON DELETE CASCADE,
  activity_method_id uuid REFERENCES activity_methods(id) ON DELETE CASCADE,
  external_record_key text NOT NULL,
  classification_score numeric NOT NULL CHECK (classification_score BETWEEN 0 AND 1),
  classification_reasons text[] NOT NULL DEFAULT '{}',
  source_revision text NOT NULL,
  PRIMARY KEY(activity_family_id,external_record_key)
);

CREATE TABLE activity_family_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_family_id uuid NOT NULL REFERENCES activity_families(id) ON DELETE CASCADE,
  external_record_key text NOT NULL,
  fact_kind text NOT NULL,
  fact_class text NOT NULL CHECK (fact_class IN ('mechanical','constraint','observational')),
  value jsonb NOT NULL,
  state activity_evidence_state NOT NULL DEFAULT 'candidate',
  source_url text NOT NULL,
  source_revision text NOT NULL,
  source_locator jsonb NOT NULL,
  parser_version text NOT NULL,
  content_hash text NOT NULL,
  UNIQUE(external_record_key,fact_kind,source_revision,content_hash)
);

CREATE INDEX activity_family_members_record_idx ON activity_family_members(external_record_key);
CREATE INDEX activity_family_facts_family_idx ON activity_family_facts(activity_family_id,state);

COMMIT;
