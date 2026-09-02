BEGIN;

CREATE TYPE recommendation_claim_strength AS ENUM ('verified_absolute_best','best_approved','provisional','insufficient_data');

CREATE TABLE golden_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL,
  source_revision text NOT NULL,
  vector_content_hash text NOT NULL,
  packet_content_hash text NOT NULL,
  reviewer text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject','needs_evidence')),
  notes text NOT NULL,
  approval_scope text NOT NULL,
  content_hash text NOT NULL UNIQUE,
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_key text NOT NULL UNIQUE,
  objective jsonb NOT NULL,
  account_conditions jsonb NOT NULL,
  data_snapshot jsonb NOT NULL,
  formula_version text NOT NULL,
  claim recommendation_claim_strength NOT NULL,
  winner jsonb,
  provisional_leader jsonb,
  closest_alternative jsonb,
  candidate_coverage jsonb NOT NULL,
  exclusions jsonb NOT NULL,
  challenge_result jsonb NOT NULL,
  evidence jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_certificate_inputs (
  recommendation_certificate_id uuid NOT NULL REFERENCES recommendation_certificates(id) ON DELETE CASCADE,
  golden_activity_scenario_id uuid REFERENCES golden_activity_scenarios(id),
  external_scenario_key text NOT NULL,
  vector_content_hash text NOT NULL,
  review_decision_hash text,
  PRIMARY KEY(recommendation_certificate_id,external_scenario_key)
);

CREATE TABLE recommendation_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_certificate_id uuid NOT NULL REFERENCES recommendation_certificates(id) ON DELETE CASCADE,
  challenger_key text NOT NULL,
  challenge_kind text NOT NULL,
  result text NOT NULL CHECK (result IN ('winner_survives','winner_loses','inconclusive')),
  comparison jsonb NOT NULL,
  material boolean NOT NULL DEFAULT true,
  UNIQUE(recommendation_certificate_id,challenger_key,challenge_kind)
);

CREATE INDEX recommendation_certificates_created_idx ON recommendation_certificates(created_at DESC);

COMMIT;
