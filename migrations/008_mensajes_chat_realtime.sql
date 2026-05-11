-- =============================================================
-- MIGRACIÓN 008 — Habilitar Realtime en mensajes_chat
-- Ejecutar en Supabase → SQL Editor
-- =============================================================
-- Sin esto, el tab "En Vivo" del dashboard no recibe actualizaciones
-- automáticas cuando llegan nuevos mensajes al chat.
-- =============================================================

-- 1. Agregar mensajes_chat a la publicación de realtime de Supabase
--    (tabla debe estar en supabase_realtime para postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_chat;

-- 2. Asegurar que citas y pacientes también están en realtime
--    (probablemente ya están, pero mejor confirmar)
DO $$
BEGIN
  -- citas
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'citas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.citas;
    RAISE NOTICE 'citas añadida a supabase_realtime';
  ELSE
    RAISE NOTICE 'citas ya estaba en supabase_realtime';
  END IF;

  -- pacientes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pacientes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pacientes;
    RAISE NOTICE 'pacientes añadida a supabase_realtime';
  ELSE
    RAISE NOTICE 'pacientes ya estaba en supabase_realtime';
  END IF;
END $$;

-- 3. Asegurar que mensajes_chat tiene las columnas necesarias para el monitor
ALTER TABLE public.mensajes_chat
  ADD COLUMN IF NOT EXISTS id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ADD COLUMN IF NOT EXISTS paciente_id BIGINT REFERENCES public.pacientes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS remitente  TEXT NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS contenido  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata   JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Índices para queries del monitor
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_paciente  ON public.mensajes_chat(paciente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_created   ON public.mensajes_chat(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_remitente ON public.mensajes_chat(remitente);

-- 4. Verificar estado
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('mensajes_chat', 'citas', 'pacientes', 'opticas')
ORDER BY tablename;
