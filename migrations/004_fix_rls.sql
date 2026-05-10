-- ========================================
-- AUKÉN FASE 0.5 — Fix RLS Seguro
-- Ejecutar DESPUÉS de 003_fix_permissions.sql
-- ========================================
-- Problema: Migration 003 deshabilitó RLS completamente
-- Solución: Reactivar con políticas permisivas temporales
-- ========================================

-- 1. Reactivar RLS en todas las tablas críticas
ALTER TABLE public.opticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar cualquier política vieja que pueda dar conflicto
DROP POLICY IF EXISTS "Allow all" ON public.opticas;
DROP POLICY IF EXISTS "Allow all" ON public.pacientes;
DROP POLICY IF EXISTS "Allow all" ON public.conversaciones;
DROP POLICY IF EXISTS "Allow all" ON public.citas;
DROP POLICY IF EXISTS "Allow all" ON public.recetas;
DROP POLICY IF EXISTS "Allow all for development" ON public.opticas;
DROP POLICY IF EXISTS "Allow all for development" ON public.pacientes;
DROP POLICY IF EXISTS "Allow all for development" ON public.conversaciones;
DROP POLICY IF EXISTS "Allow all for development" ON public.citas;
DROP POLICY IF EXISTS "Allow all for development" ON public.recetas;

-- 3. Crear políticas permisivas temporales (SOLO PARA DESARROLLO)
-- En Fase 4 las cambiamos por políticas restrictivas por optica_id

-- Opticas: todos pueden leer, solo service_role puede escribir
CREATE POLICY "Public read opticas" ON public.opticas 
  FOR SELECT USING (true);

CREATE POLICY "Service role manage opticas" ON public.opticas 
  FOR ALL USING (auth.role() = 'service_role');

-- Pacientes, conversaciones, citas: todos pueden hacer todo (temporal)
CREATE POLICY "Allow all for development" ON public.pacientes 
  FOR ALL USING (true);

CREATE POLICY "Allow all for development" ON public.conversaciones 
  FOR ALL USING (true);

CREATE POLICY "Allow all for development" ON public.citas 
  FOR ALL USING (true);

CREATE POLICY "Allow all for development" ON public.recetas 
  FOR ALL USING (true);

-- Message queue: solo backend puede escribir
CREATE POLICY "Public read queue" ON public.message_queue 
  FOR SELECT USING (true);

CREATE POLICY "Service role manage queue" ON public.message_queue 
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Mantener los permisos de schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Verificación final
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('opticas', 'pacientes', 'conversaciones', 'citas', 'recetas', 'message_queue')
ORDER BY tablename;

-- ========================================
-- IMPORTANTE:
-- - RLS ahora está ACTIVA
-- - Políticas son permisivas (desarrollo)
-- - En Fase 4 las haremos restrictivas por optica_id
-- ========================================

SELECT 'RLS reactivada con políticas de desarrollo. Sistema más seguro.' as status;
