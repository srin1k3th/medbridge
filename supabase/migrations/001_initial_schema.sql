-- ============================================================
-- MedBridge — Initial Schema
-- Supabase (PostgreSQL) with Row Level Security
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
--    One row per authenticated user. Created on sign-up.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    fname            TEXT,
    age              INTEGER,
    diagnosis        TEXT,
    doctor_name      TEXT,
    doctor_whatsapp  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);


-- ────────────────────────────────────────────────────────────
-- 2. DISCHARGE_ANALYSES
--    Stores the plain-language summary produced by the
--    /analyse endpoint for each discharge document.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discharge_analyses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_text  TEXT NOT NULL,
    language       TEXT NOT NULL DEFAULT 'en',   -- 'en' | 'hi' | 'ta'
    what_happened  TEXT,
    home_care      TEXT,
    warning_signs  TEXT,
    follow_up      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discharge_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discharge analyses"
    ON public.discharge_analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discharge analyses"
    ON public.discharge_analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 3. PRESCRIPTIONS
--    Medications extracted from discharge summaries or
--    individual prescription uploads, saved per user.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drug_name    TEXT NOT NULL,
    dosage       TEXT,
    frequency    TEXT,
    duration     TEXT,
    notes        TEXT,
    source       TEXT DEFAULT 'discharge_summary',  -- 'discharge_summary' | 'manual'
    source_text  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prescriptions"
    ON public.prescriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prescriptions"
    ON public.prescriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prescriptions"
    ON public.prescriptions FOR DELETE
    USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 4. SYMPTOM_LOGS
--    Stores each symptom check result and whether the
--    doctor was subsequently notified via WhatsApp.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptom_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symptom_text     TEXT NOT NULL,
    classification   TEXT NOT NULL CHECK (classification IN ('SAFE', 'MONITOR', 'URGENT')),
    explanation      TEXT,
    action           TEXT,
    doctor_notified  BOOLEAN NOT NULL DEFAULT FALSE,
    notified_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own symptom logs"
    ON public.symptom_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symptom logs"
    ON public.symptom_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own symptom logs"
    ON public.symptom_logs FOR UPDATE
    USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 5. REMINDERS
--    Medication reminders (daily) and appointment reminders.
--    Appointments are distinguished by a '[APPT]' prefix on
--    drug_name (matching the frontend convention).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drug_name    TEXT NOT NULL,           -- medicine name OR '[APPT] Dr. Name'
    dose         TEXT,                    -- dosage string OR location/notes for appt
    time_of_day  TIME NOT NULL,           -- HH:MM local time
    date         DATE,                    -- NULL = daily recurring; set for appointments
    is_done      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
    ON public.reminders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
    ON public.reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
    ON public.reminders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
    ON public.reminders FOR DELETE
    USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- HELPER: auto-update profiles.updated_at on every change
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ────────────────────────────────────────────────────────────
-- HELPER: auto-create a profile row when a user signs up
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
