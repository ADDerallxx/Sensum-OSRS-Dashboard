BEGIN;

CREATE TYPE activity_model_kind AS ENUM (
  'fixed_cycle',
  'success_roll',
  'resource_cycle',
  'lap',
  'combat',
  'time_gated'
);

CREATE TYPE evidence_state AS ENUM ('unknown','draft','verified','stale','rejected');

CREATE TABLE activity_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  name text NOT NULL,
  skill text NOT NULL,
  model_kind activity_model_kind NOT NULL,
  xp_per_success numeric NOT NULL CHECK (xp_per_success >= 0),
  base_cycle_ticks numeric CHECK (base_cycle_ticks > 0),
  level_requirement integer CHECK (level_requirement BETWEEN 1 AND 99),
  members boolean,
  formula_version text NOT NULL,
  evidence_state evidence_state NOT NULL DEFAULT 'unknown',
  source_id uuid REFERENCES data_sources(id),
  source_revision text,
  content_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_method_id uuid NOT NULL REFERENCES activity_methods(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id),
  label text NOT NULL,
  resource_count integer CHECK (resource_count > 0),
  respawn_seconds numeric CHECK (respawn_seconds > 0),
  bank_round_trip_seconds numeric CHECK (bank_round_trip_seconds >= 0),
  movement_seconds_per_cycle numeric CHECK (movement_seconds_per_cycle >= 0),
  evidence_state evidence_state NOT NULL DEFAULT 'unknown',
  source_id uuid REFERENCES data_sources(id),
  source_revision text,
  UNIQUE(activity_method_id,label)
);

CREATE TABLE activity_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_method_id uuid NOT NULL REFERENCES activity_methods(id) ON DELETE CASCADE,
  requirement_kind text NOT NULL,
  requirement_key text NOT NULL,
  minimum_value numeric,
  source_id uuid REFERENCES data_sources(id),
  source_revision text,
  UNIQUE(activity_method_id,requirement_kind,requirement_key)
);

CREATE TABLE activity_model_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_method_id uuid NOT NULL REFERENCES activity_methods(id) ON DELETE CASCADE,
  label text NOT NULL,
  inputs jsonb NOT NULL,
  expected jsonb NOT NULL,
  tolerance jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_state evidence_state NOT NULL DEFAULT 'unknown',
  source_id uuid REFERENCES data_sources(id),
  source_revision text,
  UNIQUE(activity_method_id,label)
);

CREATE INDEX activity_methods_skill_idx ON activity_methods(skill, evidence_state);
CREATE INDEX activity_locations_method_idx ON activity_locations(activity_method_id);
CREATE INDEX activity_requirements_method_idx ON activity_requirements(activity_method_id);

COMMIT;
