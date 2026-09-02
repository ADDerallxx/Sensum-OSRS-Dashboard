BEGIN;

CREATE TYPE golden_vector_state AS ENUM ('blocked','proposed','approved','rejected','stale');

CREATE TABLE golden_activity_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL UNIQUE,
  activity_family_id uuid NOT NULL REFERENCES activity_families(id),
  external_record_key text NOT NULL,
  skill text NOT NULL,
  conditions jsonb NOT NULL,
  mechanics jsonb NOT NULL,
  expected jsonb NOT NULL,
  observed jsonb NOT NULL,
  formula_version text NOT NULL,
  source_revision text NOT NULL,
  state golden_vector_state NOT NULL DEFAULT 'blocked',
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE golden_activity_contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  golden_activity_scenario_id uuid NOT NULL REFERENCES golden_activity_scenarios(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','blocker')),
  expected jsonb,
  actual jsonb,
  source_locators jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  UNIQUE(golden_activity_scenario_id,rule_key)
);

CREATE TABLE golden_activity_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  golden_activity_scenario_id uuid NOT NULL REFERENCES golden_activity_scenarios(id) ON DELETE CASCADE,
  decision golden_vector_state NOT NULL,
  reviewer text NOT NULL,
  notes text,
  source_revision text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX golden_activity_state_idx ON golden_activity_scenarios(state,skill);

COMMIT;
