// =============================================================
// AUKÉN — Cliente Supabase para backend (service role)
// Bypassa RLS. Solo usar en endpoints serverless, NUNCA en frontend.
// =============================================================

import { createClient } from "@supabase/supabase-js";

let cachedClient = null;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno"
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}
