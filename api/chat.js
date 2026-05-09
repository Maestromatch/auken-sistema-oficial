// =============================================================
// AUKÉN — Chat endpoint (widget web y dashboard interno)
// =============================================================
// Usa Claude API directo y persiste cada conversación.
// Carga la config de la óptica desde Supabase (multi-tenant ready).
// =============================================================

import { getSupabaseAdmin } from "../src/lib/supabase-admin.js";
import { callClaude, MODELS, logApiCall } from "../src/lib/anthropic.js";
import { buildSystemPrompt, parseSpecialTags, getEstadoReceta, loadOpticaConfig } from "../src/lib/prompts.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages = [],
      system,
      pacienteId,
      pacienteRut,
      phone = "web-anonymous",
      sessionId,
      canal = "web",
      opticaSlug = "glowvision",
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages requerido" });
    }

    const supabase = getSupabaseAdmin();

    // ───── 1. Cargar config de la óptica ─────
    const opticaCfg = await loadOpticaConfig(supabase, opticaSlug);

    // ───── 2. Cargar paciente si tenemos identificador ─────
    let paciente = null;
    if (pacienteId) {
      const { data } = await supabase.from("pacientes").select("*").eq("id", pacienteId).maybeSingle();
      paciente = data;
    } else if (pacienteRut) {
      const { data } = await supabase.from("pacientes").select("*").eq("rut", pacienteRut).maybeSingle();
      paciente = data;
    }

    if (paciente) {
      paciente.estado_receta = getEstadoReceta(paciente.fecha_ultima_visita);
    }

    // ───── 3. Construir system prompt ─────
    const systemPrompt = system || buildSystemPrompt(paciente, canal, null, opticaCfg);

    // ───── 4. Llamar a Claude ─────
    const claude = await callClaude({
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model: MODELS.CHAT,
      maxTokens: 800,
      temperature: 0.7,
    });

    const { cleanText, actions } = parseSpecialTags(claude.text);

    // ───── 5. Persistir en conversaciones ─────
    let conversacionId = null;
    try {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg?.role === "user") {
        await supabase.rpc("append_message_to_conversation", {
          p_phone: phone,
          p_canal: canal,
          p_role: "user",
          p_content: lastUserMsg.content,
          p_meta: { sessionId },
        });
      }

      const { data: cid } = await supabase.rpc("append_message_to_conversation", {
        p_phone: phone,
        p_canal: canal,
        p_role: "assistant",
        p_content: cleanText,
        p_meta: { sessionId, actions, model: MODELS.CHAT },
      });
      conversacionId = cid;
    } catch (err) {
      console.warn("[chat] No se pudo persistir conversación:", err.message);
    }

    // ───── 6. Ejecutar acciones especiales ─────
    for (const action of actions) {
      await executeWebAction(supabase, action, phone, paciente, opticaCfg).catch(err =>
        console.warn(`[chat] Acción ${action.type} falló:`, err.message)
      );
    }

    // ───── 7. Log de costos ─────
    logApiCall(supabase, {
      opticaId: opticaCfg?.id || paciente?.optica_id,
      conversacionId,
      model: MODELS.CHAT,
      usage: claude.usage,
      costUsd: claude.costUsd,
      latencyMs: claude.latencyMs,
    });

    return res.status(200).json({
      content: [{ type: "text", text: cleanText }],
      actions,
      usage: claude.usage,
      conversacionId,
    });

  } catch (err) {
    console.error("[chat] Error:", err.message, err.stack);
    return res.status(500).json({
      error: err.message || "Error interno del chat",
      content: [{
        type: "text",
        text: "Disculpa, tuve un problema técnico. Por favor inténtalo en un momento."
      }],
    });
  }
}

async function executeWebAction(supabase, action, phone, paciente, opticaCfg) {
  if (action.type === "register" && !paciente) {
    await supabase.from("pacientes").insert({
      nombre: action.nombre,
      rut: action.rut,
      telefono: phone !== "web-anonymous" ? phone : null,
      notas_clinicas: `Captado por chat web. Comuna: ${action.comuna}`,
      fecha_ultima_visita: new Date().toISOString().split("T")[0],
      tags: ["lead-web"],
      optica_id: opticaCfg?.id,
    });
  }

  if (action.type === "escalate" && phone !== "web-anonymous") {
    await supabase
      .from("conversaciones")
      .update({ status: "escalated", escalated_to: opticaCfg?.numero_escalada })
      .eq("phone", phone)
      .eq("status", "active");
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
      origen: "web-bot",
      canal: "web",
      estado: "pendiente_confirmacion",
    });
  }
}
