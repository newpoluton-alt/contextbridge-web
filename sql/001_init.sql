CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS cb_settings (owner_id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS cb_encounters (
 id uuid PRIMARY KEY, owner_id text NOT NULL, context_key text NOT NULL, data jsonb NOT NULL,
 embedding vector(1536), embedding_model text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,context_key)
);
CREATE INDEX IF NOT EXISTS cb_encounters_owner ON cb_encounters(owner_id);
CREATE INDEX IF NOT EXISTS cb_encounters_vector ON cb_encounters USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS cb_encounters_search ON cb_encounters USING gin(to_tsvector('simple',data->>'expression'||' '||(data->>'sentence')));
CREATE TABLE IF NOT EXISTS cb_chats (id uuid PRIMARY KEY,owner_id text NOT NULL,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS cb_chats_owner ON cb_chats(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS cb_cache (owner_id text NOT NULL,cache_key text NOT NULL,data jsonb NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',PRIMARY KEY(owner_id,cache_key));
CREATE TABLE IF NOT EXISTS cb_pair_codes (hash text PRIMARY KEY,owner_id text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS cb_extension_tokens (hash text PRIMARY KEY,owner_id text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS cb_usage (owner_id text NOT NULL,day date NOT NULL DEFAULT CURRENT_DATE,requests integer NOT NULL DEFAULT 0,PRIMARY KEY(owner_id,day));
-- All data access uses owner predicates and parameterized SQL in the server.
-- Tables are not exposed through a public Data API. Never ship DATABASE_URL to clients.
REVOKE ALL ON cb_settings,cb_encounters,cb_chats,cb_cache,cb_pair_codes,cb_extension_tokens,cb_usage FROM PUBLIC;
