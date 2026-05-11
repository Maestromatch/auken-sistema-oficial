-- =============================================================
-- MIGRACIÓN 007 — Completar columnas de la tabla `opticas`
-- Ejecutar en Supabase → SQL Editor
-- =============================================================
-- Agrega columnas necesarias para guardar config completa desde
-- el dashboard (servicios, escalar_si, bot_nombre, etc.)
-- Usa IF NOT EXISTS para ser idempotente (seguro re-ejecutar).
-- =============================================================

ALTER TABLE opticas
  ADD COLUMN IF NOT EXISTS ciudad              TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS numero_escalada     TEXT,
  ADD COLUMN IF NOT EXISTS bot_nombre          TEXT DEFAULT 'Aukén',
  ADD COLUMN IF NOT EXISTS promocion_estrella  TEXT DEFAULT 'Examen visual GRATIS al comprar tus lentes',
  ADD COLUMN IF NOT EXISTS servicios           JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalar_si          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS horario             TEXT,
  ADD COLUMN IF NOT EXISTS slogan              TEXT;

-- Poblar valores iniciales para Glow Vision si están vacíos
UPDATE opticas SET
  bot_nombre         = COALESCE(bot_nombre, 'Aukén'),
  promocion_estrella = COALESCE(promocion_estrella, 'Examen visual GRATIS al comprar tus lentes'),
  servicios = CASE
    WHEN servicios IS NULL OR servicios = '[]'::jsonb
    THEN '[
      {"nombre":"Examen visual computarizado","precio":"GRATIS al comprar lentes"},
      {"nombre":"Lentes monofocales","precio":"desde $45.000"},
      {"nombre":"Lentes multifocales progresivos","precio":"desde $180.000"},
      {"nombre":"Lentes de contacto blandos","precio":"desde $25.000 el par"}
    ]'::jsonb
    ELSE servicios
  END,
  escalar_si = CASE
    WHEN escalar_si IS NULL OR escalar_si = '[]'::jsonb
    THEN '["ojo rojo doloroso","pérdida súbita de visión","trauma ocular","destellos o moscas volantes nuevas","reclamo formal"]'::jsonb
    ELSE escalar_si
  END
WHERE slug = 'glowvision';

-- Verificar resultado
SELECT slug, nombre, bot_nombre, horario, ciudad, jsonb_array_length(servicios) AS num_servicios
FROM opticas;
