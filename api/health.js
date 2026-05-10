// =============================================================
// AUKÉN — Health check / Diagnóstico Fase 1
// =============================================================
// Endpoint público para verificar que todos los componentes están OK.
// Llamar: GET /api/health
// =============================================================

import { getSupabaseAdmin } from "../src/lib/supabase-admin.js";

export default async function handler(req, res) {
  const checks = {
    timestamp: new Date().toISOString(),
    components: {},
  };

  let allOk = true;

  // 1. Variables de entorno críticas
  const requiredEnvs = [
    "ANTHROPIC_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "WORKER_SECRET",
  ];

  const optionalEnvs = [
    "WHATSAPP_TOKEN",
    "PHONE_NUMBER_ID",
    "VERIFY_TOKEN",
  ];

  const missingEnvs = requiredEnvs.filter(k => !process.env[k]);
  const missingOptional = optionalEnvs.filter(k => !process.env[k]);
  checks.components.env = {
    ok: missingEnvs.length === 0,
    missing: missingEnvs,
    optional_missing: missingOptional,
    whatsapp_ready: missingOptional.length === 0,
  };
  if (missingEnvs.length > 0) allOk = false;

  // 2. Supabase reachable
  try {
    const supabase = getSupabaseAdmin();
    const { count: queueCount } = await supabase
      .from("message_queue")
      .select("*", { count: "exact", head: true });
    checks.components.supabase = { ok: true, queue_size: queueCount };
  } catch (err) {
    checks.components.supabase = { ok: false, error: err.message };
    allOk = false;
  }

  // 3. Tablas críticas existen
  try {
    const supabase = getSupabaseAdmin();
    const tables = ["message_queue", "conversaciones", "api_logs", "pacientes"];
    const tableChecks = {};
    for (const t of tables) {
      const { error } = await supabase.from(t).select("id").limit(1);
      tableChecks[t] = !error;
      if (error) allOk = false;
    }
    checks.components.tables = { ok: Object.values(tableChecks).every(Boolean), details: tableChecks };
  } catch (err) {
    checks.components.tables = { ok: false, error: err.message };
    allOk = false;
  }

  // 4. Anthropic alcanzable (sin gastar tokens reales)
  try {
    // Solo verifica que la key existe; un ping real gastaría dinero
    checks.components.anthropic = {
      ok: !!process.env.ANTHROPIC_API_KEY,
      key_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10) + "...",
    };
  } catch (err) {
    checks.components.anthropic = { ok: false, error: err.message };
  }

  // 5. Estado de la cola
  try {
    const supabase = getSupabaseAdmin();
    const { data: dashboard } = await supabase.from("cola_dashboard").select("*");
    checks.components.queue_health = { ok: true, dashboard };
  } catch (err) {
    checks.components.queue_health = { ok: false, error: err.message };
  }

  return res.status(allOk ? 200 : 500).json({
    status: allOk ? "healthy" : "degraded",
    ...checks,
  });
}
