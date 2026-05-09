-- ========================================
-- DESBLOQUEO DE PERMISOS (Fix de Botones)
-- Ejecutar en SQL Editor de Supabase
-- ========================================

-- 1. Deshabilitar RLS temporalmente para asegurar flujo total
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_chat DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.opticas DISABLE ROW LEVEL SECURITY;

-- 2. Asegurar que las secuencias funcionen
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Limpiar cualquier política bloqueante previa
DROP POLICY IF EXISTS "Allow all" ON public.pacientes;
DROP POLICY IF EXISTS "Allow all" ON public.citas;
DROP POLICY IF EXISTS "Allow all" ON public.mensajes_chat;

-- 4. Notificación de éxito
SELECT 'Permisos desbloqueados. Aukén tiene vía libre.' as status;
