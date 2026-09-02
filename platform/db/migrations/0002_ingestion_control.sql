BEGIN;
CREATE TYPE ingestion_status AS ENUM ('queued','running','validated','published','failed','quarantined');
CREATE TABLE ingestion_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),domain text NOT NULL,status ingestion_status NOT NULL DEFAULT 'queued',
 source_kind source_kind NOT NULL,started_at timestamptz,finished_at timestamptz,record_count bigint NOT NULL DEFAULT 0,
 source_revision text,content_hash text,raw_object_uri text,error_message text,metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE ingestion_records (
 run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,record_key text NOT NULL,payload jsonb NOT NULL,
 source_url text NOT NULL,source_revision text,content_hash text NOT NULL,state verification_state NOT NULL DEFAULT 'unknown',
 findings jsonb NOT NULL DEFAULT '[]'::jsonb,PRIMARY KEY(run_id,record_key)
);
CREATE TABLE publication_gates (
 domain text PRIMARY KEY,minimum_records bigint NOT NULL,required_fields text[] NOT NULL DEFAULT '{}',
 maximum_unknown_ratio numeric(8,7) NOT NULL DEFAULT 0,maximum_stale_ratio numeric(8,7) NOT NULL DEFAULT 0,
 require_source_revision boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO publication_gates(domain,minimum_records,required_fields,maximum_unknown_ratio,maximum_stale_ratio,require_source_revision) VALUES
 ('items',3000,ARRAY['id','name','members'],0,0.02,false),
 ('equipment',100,ARRAY['item_id','slot','source_revision'],0.01,0.02,true),
 ('monsters',100,ARRAY['id','name','hitpoints','source_revision'],0.01,0.02,true),
 ('recipes',100,ARRAY['name','inputs','outputs','xp_per_action','source_revision'],0.02,0.02,true),
 ('prices',1000,ARRAY['item_id','observed_at'],0,0.20,false);
COMMIT;

