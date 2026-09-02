BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE source_kind AS ENUM ('osrs_wiki','jagex','runelite','wise_old_man','ge_price_api','manual','derived');
CREATE TYPE verification_state AS ENUM ('verified','review','stale','rejected','unknown');
CREATE TYPE requirement_kind AS ENUM ('skill','quest','item','achievement','slayer','combat','location','other');
CREATE TYPE equipment_slot AS ENUM ('head','cape','neck','ammo','weapon','body','shield','legs','hands','feet','ring','two_handed');
CREATE TYPE claim_strength AS ENUM ('verified_best','best_verified','estimated','insufficient_data');

CREATE TABLE data_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind source_kind NOT NULL,
 canonical_url text NOT NULL, title text NOT NULL, provider_key text, revision_key text,
 fetched_at timestamptz NOT NULL, published_at timestamptz, content_hash text NOT NULL,
 state verification_state NOT NULL DEFAULT 'unknown', UNIQUE(kind,canonical_url,revision_key)
);
CREATE TABLE data_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 label text NOT NULL, manifest_hash text NOT NULL UNIQUE, complete boolean NOT NULL DEFAULT false,
 validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE snapshot_sources (
 snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE CASCADE,
 source_id uuid REFERENCES data_sources(id), PRIMARY KEY(snapshot_id,source_id)
);
CREATE TABLE skills (id smallserial PRIMARY KEY,slug text UNIQUE NOT NULL,name text UNIQUE NOT NULL,maximum_level smallint NOT NULL CHECK(maximum_level BETWEEN 1 AND 126));
CREATE TABLE quests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wiki_page_id bigint UNIQUE,slug text UNIQUE NOT NULL,name text UNIQUE NOT NULL,
 quest_points smallint NOT NULL DEFAULT 0 CHECK(quest_points>=0),members boolean NOT NULL,difficulty text,length text,
 state verification_state NOT NULL DEFAULT 'unknown',source_id uuid REFERENCES data_sources(id)
);
CREATE TABLE quest_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quest_id uuid NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
 kind requirement_kind NOT NULL,skill_id smallint REFERENCES skills(id),prerequisite_quest_id uuid REFERENCES quests(id),
 required_level smallint,boostable boolean NOT NULL DEFAULT false,optional boolean NOT NULL DEFAULT false,
 alternative_group text,explanation text,source_id uuid NOT NULL REFERENCES data_sources(id),
 CHECK((kind='skill' AND skill_id IS NOT NULL AND required_level IS NOT NULL) OR kind<>'skill'),
 CHECK((kind='quest' AND prerequisite_quest_id IS NOT NULL) OR kind<>'quest')
);
CREATE TABLE items (
 id bigint PRIMARY KEY,name text UNIQUE NOT NULL,wiki_page_id bigint,members boolean NOT NULL,tradeable boolean NOT NULL,
 stackable boolean NOT NULL,noted boolean NOT NULL DEFAULT false,linked_item_id bigint REFERENCES items(id),
 buy_limit integer CHECK(buy_limit IS NULL OR buy_limit>=0),high_alch_value integer CHECK(high_alch_value IS NULL OR high_alch_value>=0),
 state verification_state NOT NULL DEFAULT 'unknown',source_id uuid REFERENCES data_sources(id)
);
CREATE TABLE item_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
 kind requirement_kind NOT NULL,skill_id smallint REFERENCES skills(id),quest_id uuid REFERENCES quests(id),
 required_level smallint,notes text,source_id uuid NOT NULL REFERENCES data_sources(id)
);
CREATE TABLE equipment (
 item_id bigint PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,slot equipment_slot NOT NULL,
 attack_speed_ticks smallint CHECK(attack_speed_ticks IS NULL OR attack_speed_ticks>0),two_handed boolean NOT NULL DEFAULT false,
 attack_stab integer NOT NULL DEFAULT 0,attack_slash integer NOT NULL DEFAULT 0,attack_crush integer NOT NULL DEFAULT 0,
 attack_magic integer NOT NULL DEFAULT 0,attack_ranged integer NOT NULL DEFAULT 0,defence_stab integer NOT NULL DEFAULT 0,
 defence_slash integer NOT NULL DEFAULT 0,defence_crush integer NOT NULL DEFAULT 0,defence_magic integer NOT NULL DEFAULT 0,
 defence_ranged integer NOT NULL DEFAULT 0,melee_strength integer NOT NULL DEFAULT 0,ranged_strength integer NOT NULL DEFAULT 0,
 magic_damage numeric(8,4) NOT NULL DEFAULT 0,prayer integer NOT NULL DEFAULT 0,
 state verification_state NOT NULL DEFAULT 'unknown',source_id uuid NOT NULL REFERENCES data_sources(id)
);
CREATE TABLE effects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE NOT NULL,name text NOT NULL,effect_type text NOT NULL,
 machine_definition jsonb NOT NULL,formula_version text NOT NULL,source_id uuid NOT NULL REFERENCES data_sources(id),
 state verification_state NOT NULL DEFAULT 'unknown'
);
CREATE TABLE item_effects (item_id bigint REFERENCES items(id) ON DELETE CASCADE,effect_id uuid REFERENCES effects(id) ON DELETE CASCADE,condition jsonb NOT NULL DEFAULT '{}'::jsonb,PRIMARY KEY(item_id,effect_id));
CREATE TABLE npcs (
 id bigint PRIMARY KEY,name text NOT NULL,variant text NOT NULL DEFAULT '',wiki_page_id bigint,combat_level integer,hitpoints integer,
 attack_speed_ticks smallint,size smallint,aggressive boolean,poison_immune boolean,venom_immune boolean,
 state verification_state NOT NULL DEFAULT 'unknown',source_id uuid REFERENCES data_sources(id),UNIQUE(name,variant)
);
CREATE TABLE npc_combat_stats (
 npc_id bigint PRIMARY KEY REFERENCES npcs(id) ON DELETE CASCADE,attack_level integer,strength_level integer,defence_level integer,
 magic_level integer,ranged_level integer,defence_stab integer,defence_slash integer,defence_crush integer,defence_magic integer,
 defence_ranged integer,elemental_weakness text,weakness_severity integer,source_id uuid NOT NULL REFERENCES data_sources(id)
);
CREATE TABLE locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE NOT NULL,region text,members boolean NOT NULL,multi_combat boolean,
 nearest_bank_seconds integer,access_notes text,source_id uuid REFERENCES data_sources(id)
);
CREATE TABLE npc_locations (
 npc_id bigint REFERENCES npcs(id) ON DELETE CASCADE,location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
 spawn_count integer,respawn_ticks integer,cannon_allowed boolean,safespot_available boolean,area_density numeric(10,4),
 source_id uuid NOT NULL REFERENCES data_sources(id),PRIMARY KEY(npc_id,location_id)
);
CREATE TABLE recipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE NOT NULL,name text NOT NULL,skill_id smallint REFERENCES skills(id),
 required_level smallint,ticks_per_action numeric(10,4),xp_per_action numeric(14,4) NOT NULL DEFAULT 0,
 success_model jsonb NOT NULL DEFAULT '{"type":"guaranteed"}'::jsonb,formula_version text NOT NULL,
 source_id uuid NOT NULL REFERENCES data_sources(id),state verification_state NOT NULL DEFAULT 'unknown'
);
CREATE TABLE recipe_inputs (
 recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,item_id bigint REFERENCES items(id),quantity numeric(18,6) NOT NULL CHECK(quantity>0),
 consumed boolean NOT NULL DEFAULT true,alternative_group text NOT NULL DEFAULT '',PRIMARY KEY(recipe_id,item_id,alternative_group)
);
CREATE TABLE recipe_outputs (
 recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,item_id bigint REFERENCES items(id),quantity numeric(18,6) NOT NULL CHECK(quantity>0),
 probability numeric(9,8) NOT NULL DEFAULT 1 CHECK(probability>0 AND probability<=1),PRIMARY KEY(recipe_id,item_id)
);
CREATE TABLE price_observations (
 item_id bigint REFERENCES items(id) ON DELETE CASCADE,observed_at timestamptz NOT NULL,source_kind source_kind NOT NULL,
 high_price integer,low_price integer,high_volume bigint,low_volume bigint,PRIMARY KEY(item_id,observed_at,source_kind)
);
CREATE INDEX price_observations_recent_idx ON price_observations(item_id,observed_at DESC);
CREATE TABLE profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_subject text NOT NULL,display_name text NOT NULL,runescape_name text NOT NULL,
 members boolean NOT NULL DEFAULT true,timezone text NOT NULL DEFAULT 'America/Denver',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_subject,runescape_name)
);
CREATE TABLE account_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 captured_at timestamptz NOT NULL,source_kind source_kind NOT NULL,quest_points integer,combat_level numeric(8,3),
 raw_payload jsonb NOT NULL,content_hash text NOT NULL,UNIQUE(profile_id,source_kind,content_hash)
);
CREATE TABLE account_skill_values (
 snapshot_id uuid REFERENCES account_snapshots(id) ON DELETE CASCADE,skill_id smallint REFERENCES skills(id),level smallint NOT NULL,
 xp bigint,xp_exact boolean NOT NULL DEFAULT false,PRIMARY KEY(snapshot_id,skill_id)
);
CREATE TABLE account_quest_values (
 snapshot_id uuid REFERENCES account_snapshots(id) ON DELETE CASCADE,quest_id uuid REFERENCES quests(id),completed boolean NOT NULL,
 completed_on date,detection_source source_kind NOT NULL,PRIMARY KEY(snapshot_id,quest_id)
);
CREATE TABLE training_methods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE NOT NULL,name text NOT NULL,skill_id smallint NOT NULL REFERENCES skills(id),
 method_type text NOT NULL,npc_id bigint REFERENCES npcs(id),recipe_id uuid REFERENCES recipes(id),location_id uuid REFERENCES locations(id),
 attention_score numeric(6,3),setup_seconds integer NOT NULL DEFAULT 0,banking_model jsonb NOT NULL DEFAULT '{}'::jsonb,
 constraints jsonb NOT NULL DEFAULT '{}'::jsonb,formula_version text NOT NULL,source_id uuid NOT NULL REFERENCES data_sources(id),
 state verification_state NOT NULL DEFAULT 'unknown'
);
CREATE TABLE optimization_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES profiles(id),
 account_snapshot_id uuid NOT NULL REFERENCES account_snapshots(id),data_snapshot_id uuid NOT NULL REFERENCES data_snapshots(id),
 contract_version text NOT NULL,formula_version text NOT NULL,requested_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 request jsonb NOT NULL,result jsonb,claim claim_strength NOT NULL DEFAULT 'insufficient_data',candidate_count bigint NOT NULL DEFAULT 0,
 evaluated_count bigint NOT NULL DEFAULT 0,excluded_count bigint NOT NULL DEFAULT 0,unknown_count bigint NOT NULL DEFAULT 0,
 CHECK(evaluated_count+excluded_count+unknown_count<=candidate_count)
);
CREATE TABLE optimization_evidence (
 run_id uuid REFERENCES optimization_runs(id) ON DELETE CASCADE,source_id uuid REFERENCES data_sources(id),entity_type text NOT NULL,
 entity_key text NOT NULL,material boolean NOT NULL DEFAULT true,PRIMARY KEY(run_id,source_id,entity_type,entity_key)
);
CREATE TABLE validation_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),snapshot_id uuid REFERENCES data_snapshots(id) ON DELETE CASCADE,
 severity text NOT NULL CHECK(severity IN('info','warning','error','blocker')),rule_key text NOT NULL,entity_type text NOT NULL,
 entity_key text NOT NULL,message text NOT NULL,details jsonb NOT NULL DEFAULT '{}'::jsonb,detected_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
CREATE INDEX validation_findings_open_idx ON validation_findings(severity,detected_at DESC) WHERE resolved_at IS NULL;
COMMIT;
