-- =============================================================================
-- MedBridge Migration 002: RAG, Audit Log, and Schema Enhancements
-- Run AFTER enabling pgvector extension in Supabase Dashboard:
--   Dashboard → Database → Extensions → search "vector" → Enable
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. pgvector extension (must be enabled in Dashboard first)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;


-- ---------------------------------------------------------------------------
-- 2. Drug knowledge base for Agentic RAG
--    Stores chunked drug information with embeddings for semantic retrieval.
--    Populated by backend/app/seed_drugs.py (one-time seeding script).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drug_knowledge (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_name   TEXT NOT NULL,
    chunk_text  TEXT NOT NULL,
    chunk_type  TEXT DEFAULT 'general',  -- 'indication' | 'interaction' | 'dosage' | 'warning' | 'general'
    embedding   VECTOR(384),             -- all-MiniLM-L6-v2 dimensions
    source      TEXT DEFAULT 'curated_open_data',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest-neighbour search
-- lists=100 is appropriate for ~5000 rows; increase for larger datasets
CREATE INDEX IF NOT EXISTS drug_knowledge_embedding_idx
    ON public.drug_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS drug_knowledge_drug_name_idx
    ON public.drug_knowledge (LOWER(drug_name));

-- No RLS on drug_knowledge: it is read-only reference data, not patient data
ALTER TABLE public.drug_knowledge DISABLE ROW LEVEL SECURITY;


-- pgvector similarity search RPC — called by backend/app/rag.py
CREATE OR REPLACE FUNCTION public.match_drug_knowledge(
    query_embedding  VECTOR(384),
    match_threshold  FLOAT    DEFAULT 0.3,
    match_count      INT      DEFAULT 5
)
RETURNS TABLE (
    id          UUID,
    drug_name   TEXT,
    chunk_text  TEXT,
    chunk_type  TEXT,
    source      TEXT,
    similarity  FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        dk.id,
        dk.drug_name,
        dk.chunk_text,
        dk.chunk_type,
        dk.source,
        1 - (dk.embedding <=> query_embedding) AS similarity
    FROM public.drug_knowledge dk
    WHERE 1 - (dk.embedding <=> query_embedding) > match_threshold
    ORDER BY dk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Audit log — every LLM call and critical action is logged here
--    Implements HIPAA/DPDP-style audit trail (compliance-by-design).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,   -- e.g. 'discharge_analysis', 'symptom_check', 'drug_lookup'
    resource    TEXT,            -- table or endpoint name
    metadata    JSONB,           -- {model, latency_ms, tokens, confidence, retries, ...}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
    ON public.audit_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit log"
    ON public.audit_log FOR INSERT
    WITH CHECK (true);  -- backend uses service key; RLS insert open for service role


-- ---------------------------------------------------------------------------
-- 4. Enrich symptom_logs with confidence scoring + longitudinal context
-- ---------------------------------------------------------------------------
ALTER TABLE public.symptom_logs
    ADD COLUMN IF NOT EXISTS confidence      FLOAT       CHECK (confidence >= 0.0 AND confidence <= 1.0),
    ADD COLUMN IF NOT EXISTS reasoning       TEXT,        -- LLM chain-of-thought for confidence
    ADD COLUMN IF NOT EXISTS pattern_context TEXT,        -- injected longitudinal context
    ADD COLUMN IF NOT EXISTS language        TEXT NOT NULL DEFAULT 'en';


-- ---------------------------------------------------------------------------
-- 5. Enrich reminders with auto-generation tracking
--    Differentiates auto-generated (from discharge extraction) vs manual reminders
-- ---------------------------------------------------------------------------
ALTER TABLE public.reminders
    ADD COLUMN IF NOT EXISTS auto_generated          BOOLEAN   NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source_prescription_id  UUID      REFERENCES public.prescriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reminders_auto_generated_idx
    ON public.reminders (user_id, auto_generated);
