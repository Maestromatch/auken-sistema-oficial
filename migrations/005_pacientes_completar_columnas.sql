-- ========================================
-- AUKÉN — Migration 005: Completar columnas faltantes
-- ========================================
-- Causa: Migration inicial de pacientes/citas no incluyó todos los
-- campos que el dashboard y el bot esperan. El error reportado fue:
--   "Could not find the 'rut' column of 'pacientes' in the schema cache"
--
-- Esta migration es IDEMPOTENTE: usa "ADD COLUMN IF NOT EXISTS",
-- por lo que es seguro correrla múltiples veces.
-- ========================================

-- ─── PACIENTES ────────────────────────────────────────────
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS rut                   VARCHAR(20);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefono              VARCHAR(30);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS comuna                VARCHAR(80);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS producto_actual       TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS notas_clinicas        TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS fecha_ultima_visita   DATE;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS fecha_proximo_control DATE;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS estado_compra         VARCHAR(20) DEFAULT 'Pendiente';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS monto_venta           NUMERIC(12,2);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS receta_data           JSONB;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS receta_img_url        TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS tags                  TEXT[];
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ultima_interaccion_at TIMESTAMPTZ;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS optica_id             UUID REFERENCES public.opticas(id) ON DELETE CASCADE;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS created_at            TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();

-- Índices para búsqueda rápida en el sidebar
CREATE INDEX IF NOT EXISTS idx_pacientes_optica   ON public.pacientes(optica_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono ON public.pacientes(telefono);
CREATE INDEX IF NOT EXISTS idx_pacientes_rut      ON public.pacientes(rut);

-- ─── CITAS ────────────────────────────────────────────────
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS nombre    VARCHAR(120);
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS rut       VARCHAR(20);
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS telefono  VARCHAR(30);
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS servicio  TEXT;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS fecha     DATE;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS hora      TIME;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS notas     TEXT;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS estado    VARCHAR(30) DEFAULT 'pendiente_confirmacion';
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS origen    VARCHAR(30) DEFAULT 'manual';
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS canal     VARCHAR(20) DEFAULT 'dashboard';
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_citas_optica  ON public.citas(optica_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha   ON public.citas(fecha);
CREATE INDEX IF NOT EXISTS idx_citas_estado  ON public.citas(estado);

-- ─── MENSAJES_CHAT ────────────────────────────────────────
-- Tabla usada por el monitor en /optica para mostrar conversaciones
ALTER TABLE public.mensajes_chat ADD COLUMN IF NOT EXISTS metadata   JSONB;
ALTER TABLE public.mensajes_chat ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_mensajes_paciente ON public.mensajes_chat(paciente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_created  ON public.mensajes_chat(created_at DESC);

-- ─── TRIGGER para updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pacientes_touch ON public.pacientes;
CREATE TRIGGER pacientes_touch BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS citas_touch ON public.citas;
CREATE TRIGGER citas_touch BEFORE UPDATE ON public.citas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── Verificación final ───────────────────────────────────
SELECT
  table_name,
  COUNT(*) FILTER (WHERE column_name IN (
    'rut','telefono','comuna','producto_actual','notas_clinicas',
    'fecha_ultima_visita','fecha_proximo_control','estado_compra',
    'monto_venta','receta_data','receta_img_url','tags','optica_id'
  )) AS columnas_completas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('pacientes','citas','mensajes_chat')
GROUP BY table_name
ORDER BY table_name;

-- ✅ Esperado: pacientes con 13 columnas completas
-- ✅ Si todo OK, el modal de paciente del dashboard ya guarda sin errores.
