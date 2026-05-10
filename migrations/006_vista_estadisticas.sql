-- ========================================
-- AUKÉN — Migration 006: Vista estadisticas_optica
-- ========================================
-- Causa: La vista existente no agregaba monto_venta porque la columna
-- recién se agregó en la migration 005. KPIs en dashboard mostraban $0
-- aunque hubiera ventas registradas.
--
-- Solución: REPLACE de la vista con todos los campos correctos
-- agregados desde pacientes + citas + mensajes_chat.
-- ========================================

DROP VIEW IF EXISTS public.estadisticas_optica CASCADE;

CREATE OR REPLACE VIEW public.estadisticas_optica AS
SELECT
  o.id                              AS optica_id,
  o.slug                            AS slug,
  o.nombre                          AS nombre,

  -- Pacientes totales
  COUNT(DISTINCT p.id)              AS total_pacientes,

  -- Recetas por estado de antigüedad (basado en fecha_ultima_visita)
  COUNT(DISTINCT p.id) FILTER (
    WHERE p.fecha_ultima_visita IS NOT NULL
      AND p.fecha_ultima_visita > (CURRENT_DATE - INTERVAL '335 days')
  ) AS recetas_vigentes,

  COUNT(DISTINCT p.id) FILTER (
    WHERE p.fecha_ultima_visita IS NOT NULL
      AND p.fecha_ultima_visita <= (CURRENT_DATE - INTERVAL '335 days')
      AND p.fecha_ultima_visita >  (CURRENT_DATE - INTERVAL '365 days')
  ) AS recetas_proximas,

  COUNT(DISTINCT p.id) FILTER (
    WHERE p.fecha_ultima_visita IS NOT NULL
      AND p.fecha_ultima_visita <= (CURRENT_DATE - INTERVAL '365 days')
  ) AS recetas_vencidas,

  -- Citas próximas (hoy y siguientes, no canceladas)
  (SELECT COUNT(*) FROM public.citas c
    WHERE c.optica_id = o.id
      AND c.fecha >= CURRENT_DATE
      AND COALESCE(c.estado,'') NOT IN ('cancelada','completada')
  ) AS citas_proximas,

  -- Conversaciones últimas 24h (mensajes_chat distintos por paciente)
  (SELECT COUNT(DISTINCT m.paciente_id) FROM public.mensajes_chat m
    JOIN public.pacientes pp ON pp.id = m.paciente_id
    WHERE pp.optica_id = o.id
      AND m.created_at > (now() - INTERVAL '24 hours')
  ) AS conversaciones_24h,

  -- Ventas — SUM de monto_venta donde estado_compra = 'Compró'
  COALESCE(
    SUM(p.monto_venta) FILTER (WHERE p.estado_compra = 'Compró'),
    0
  ) AS ventas_total_clp,

  -- Cantidad de clientes que compraron
  COUNT(DISTINCT p.id) FILTER (WHERE p.estado_compra = 'Compró') AS clientes_compraron,

  -- Ticket promedio
  COALESCE(
    AVG(p.monto_venta) FILTER (WHERE p.estado_compra = 'Compró' AND p.monto_venta > 0),
    0
  )::numeric(12,2) AS ticket_promedio_clp

FROM public.opticas o
LEFT JOIN public.pacientes p ON p.optica_id = o.id
GROUP BY o.id, o.slug, o.nombre;

-- Permisos para el frontend (lectura via anon)
GRANT SELECT ON public.estadisticas_optica TO anon, authenticated, service_role;

-- Verificación: corre esto y deberías ver Glow Vision con ventas > 0
SELECT slug, nombre, total_pacientes, ventas_total_clp, clientes_compraron, ticket_promedio_clp
FROM public.estadisticas_optica
WHERE slug = 'glowvision';
