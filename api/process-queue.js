// =============================================================
// AUKÉN — Worker de procesamiento de cola WhatsApp
// =============================================================
// Procesa mensajes con concurrencia controlada.
// Carga config de óptica desde Supabase (multi-tenant ready).
// =============================================================

import { getSupabaseAdmin } from "../src/lib/supabase-admin.js";
import { callClaude, MODELS, logApiCall } from "../src/lib/anthropic.js";
import { buildSystemPrompt, parseSpecialTags, getEstadoReceta, loadOpticaConfig } from "../src/lib/prompts.js";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const META_API_VERSION = "v21.0";
const MAX_PARALLEL = 5;

// Cache de configuración por óptica (válido durante la invocación del worker)
let configCache = null;

export default async function handler(req, res) {
  // Auth
  const secret = req.headers["x-worker-secret"];
  const cronAuth = req.headers["authorization"];
  const expectedSecret = process.env.WORKER_SECRET || "auken-worker-2026";
  const expectedCron = `Bearer ${process.env.CRON_SECRET || "auken-cron-2026"}`;

  if (secret !== expectedSecret && cronAuth !== expectedCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabaseAdmin();
  const trigger = req.body?.trigger || (req.method === "GET" ? "cron" : "manual");
  const specificPhones = req.body?.phones;

  // Cargar config de óptica (por ahora solo Glow Vision; en F3 será dinámico por phone_number_id)
  configCache = await loadOpticaConfig(supabase, "glowvision");

  // 1. Sacar mensajes pendientes
  let pending;
  try {
    if (specificPhones && specificPhones.length > 0) {
      const results = await Promise.all(
        specificPhones.map(phone =>
          supabase.rpc("pull_pending_messages", { p_phone: phone, p_limit: 5 })
        )
      );
      pending = results.flatMap(r => r.data || []);
    } else {
      const { data } = await supabase.rpc("pull_pending_global", { p_limit: 30 });
      pending = data || [];
    }
  } catch (err) {
    console.error("[worker] Error sacando de la cola:", err.message);
    return res.status(500).json({ error: err.message });
  }

  if (pending.length === 0) {
    return res.status(200).json({ trigger, processed: 0, message: "cola vacía" });
  }

  // 2. Agrupar por teléfono
  const byPhone = {};
  for (const msg of pending) {
    if (!byPhone[msg.phone]) byPhone[msg.phone] = [];
    byPhone[msg.phone].push(msg);
  }

  // 3. Procesar grupos en paralelo (máx 5 a la vez)
  const phones = Object.keys(byPhone);
  const results = [];

  for (let i = 0; i < phones.length; i += MAX_PARALLEL) {
    const batch = phones.slice(i, i + MAX_PARALLEL);
    const batchResults = await Promise.allSettled(
      batch.map(phone => processPhoneQueue(supabase, phone, byPhone[phone]))
    );
    results.push(...batchResults);
  }

  return res.status(200).json({
    trigger,
    phones_processed: phones.length,
    messages_total: pending.length,
    successful: results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length,
  });
}

async function processPhoneQueue(supabase, phone, messages) {
  messages.sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  const consolidatedText = messages.map(m => m.message_text).filter(Boolean).join("\n");

  if (!consolidatedText.trim()) {
    await markAsDone(supabase, messages);
    return;
  }

  try {
    // Buscar paciente
    const { data: paciente } = await supabase
      .from("pacientes").select("*").eq("telefono", phone).maybeSingle();

    let pacienteEnriched = paciente;
    if (paciente) {
      pacienteEnriched = { ...paciente, estado_receta: getEstadoReceta(paciente.fecha_ultima_visita) };
    }

    // Cargar conversación activa
    const { data: convs } = await supabase
      .from("conversaciones")
      .select("*")
      .eq("phone", phone)
      .eq("canal", "whatsapp")
      .eq("status", "active")
      .gte("last_message_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("last_message_at", { ascending: false })
      .limit(1);

    const conv = convs?.[0];
    const history = (conv?.messages || []).slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Llamar a Claude (con config de óptica)
    const systemPrompt = buildSystemPrompt(pacienteEnriched, "whatsapp", conv?.summary, configCache);

    // DETERMINAR SI HAY IMAGEN (NUTRIENT PREP)
    const imageMessage = messages.find(m => m.message_type === "image");
    let userContent = consolidatedText;
    
    if (imageMessage) {
      userContent = `[EL USUARIO ENVIÓ UNA IMAGEN/RECETA CON ID: ${imageMessage.media_id}]\n${consolidatedText}`;
    }

    const claude = await callClaude({
      system: systemPrompt,
      messages: [...history, { role: "user", content: userContent }],
      model: MODELS.CHAT,
      maxTokens: 600,
      temperature: 0.7,
    });

    const { cleanText, actions } = parseSpecialTags(claude.text);

    // Si hay imagen, forzar acción de escaneo en la metadata
    if (imageMessage) {
      actions.push({ type: "ocr_scan", media_id: imageMessage.media_id });
    }

    // Guardar mensajes en tabla mensajes_chat (Monitor Realtime)
    await supabase.from("mensajes_chat").insert([
      { paciente_id: paciente?.id, remitente: "cliente", contenido: consolidatedText || "[Imagen/Receta]", metadata: { phone, media_id: imageMessage?.media_id } },
      { paciente_id: paciente?.id, remitente: "bot", contenido: cleanText, metadata: { actions } }
    ]);

    // NUTRIENT OCR INTEGRATION (SI HAY IMAGEN)
    if (imageMessage && process.env.NUTRIENT_API_KEY) {
      // Aquí se dispararía el proceso de OCR en segundo plano o asíncrono
      console.log("[OCR] Procesando receta con Nutrient:", imageMessage.media_id);
    }

    // Log de costos
    logApiCall(supabase, {
      opticaId: configCache?.id || paciente?.optica_id,
      conversacionId: conv?.id,
      model: MODELS.CHAT,
      usage: claude.usage,
      costUsd: claude.costUsd,
      latencyMs: claude.latencyMs,
    });

    // Ejecutar acciones especiales
    for (const action of actions) {
      await executeAction(supabase, action, phone, paciente, configCache);
    }

    // Enviar respuesta por WhatsApp
    if (cleanText && WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
      await sendWhatsAppMessage(phone, cleanText);
    }

    await markAsDone(supabase, messages);

  } catch (err) {
    console.error(`[worker] Error procesando ${phone}:`, err.message);
    await markAsFailed(supabase, messages, err.message);
    throw err;
  }
}

async function executeAction(supabase, action, phone, paciente, opticaCfg) {
  if (action.type === "register" && !paciente) {
    await supabase.from("pacientes").insert({
      nombre: action.nombre,
      rut: action.rut,
      telefono: phone,
      notas_clinicas: `Captado por Aukén WhatsApp. Comuna: ${action.comuna}`,
      fecha_ultima_visita: new Date().toISOString().split("T")[0],
      tags: ["lead-whatsapp"],
      optica_id: opticaCfg?.id,
    });
  }

  if (action.type === "escalate") {
    await supabase
      .from("conversaciones")
      .update({ status: "escalated", escalated_to: opticaCfg?.numero_escalada })
      .eq("phone", phone)
      .eq("status", "active");

    if (opticaCfg?.numero_escalada && WHATSAPP_TOKEN) {
      await sendWhatsAppMessage(
        opticaCfg.numero_escalada.replace(/\D/g, ""),
        `🚨 Aukén derivó una consulta al humano. Paciente: ${paciente?.nombre || phone}. Revisa el dashboard.`
      ).catch(() => {});
    }
  }

  if (action.type === "book" && paciente) {
    await supabase.from("citas").insert({
      paciente_id: paciente.id,
      optica_id: opticaCfg?.id || paciente.optica_id,
      nombre: paciente.nombre,
      rut: paciente.rut,
      telefono: paciente.telefono,
      servicio: action.servicio,
      fecha: action.fecha,
      hora: action.hora,
      origen: "whatsapp-bot",
      canal: "whatsapp",
      estado: "pendiente_confirmacion",
    }).then(({ error }) => {
      if (error) console.warn("[worker] No se creó la cita:", error.message);
    });
  }
}

async function sendWhatsAppMessage(toPhone, text) {
  const cleanPhone = String(toPhone).replace(/\D/g, "");

  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: text },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(`Meta API: ${data?.error?.message || "send failed"}`);
  return data;
}

async function markAsDone(supabase, messages) {
  const ids = messages.map(m => m.id);
  await supabase
    .from("message_queue")
    .update({ status: "done", processed_at: new Date().toISOString() })
    .in("id", ids);
}

async function markAsFailed(supabase, messages, errorMessage) {
  for (const msg of messages) {
    const newStatus = msg.attempts >= 3 ? "failed" : "pending";
    await supabase
      .from("message_queue")
      .update({ status: newStatus, error_message: errorMessage.slice(0, 500) })
      .eq("id", msg.id);
  }
}
