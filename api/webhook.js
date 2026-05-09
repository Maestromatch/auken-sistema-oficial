// =============================================================
// AUKÉN — Webhook WhatsApp v2 (encola y responde rápido)
// =============================================================
// CRÍTICO: este endpoint debe responder 200 a Meta en <2 segundos
// SIEMPRE, incluso si todo lo demás falla. La cola y el worker se
// encargan del resto. Esto es lo que resuelve el problema de
// concurrencia que colapsa a Vamble y otros bots.
// =============================================================

import { getSupabaseAdmin } from "../src/lib/supabase-admin.js";

export default async function handler(req, res) {
  // ───────── 1. Verificación inicial de Meta (GET) ─────────
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verificación fallida" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ───────── 2. Parseo del payload de Meta ─────────
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[webhook] Supabase init failed:", err.message);
    // Aún así respondemos 200 para que Meta no reintente
    return res.status(200).send("EVENT_RECEIVED");
  }

  const body = req.body;

  // Meta a veces envía notificaciones de status (delivered, read) que no nos interesan
  const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages || messages.length === 0) {
    return res.status(200).send("EVENT_RECEIVED");
  }

  // ───────── 3. Encolar cada mensaje (sin procesar) ─────────
  const toInsert = [];
  for (const msg of messages) {
    const phone = msg.from;
    let messageText = "";
    let messageType = msg.type || "text";
    let mediaId = null;

    if (msg.type === "text") {
      messageText = msg.text?.body || "";
    } else if (msg.type === "image") {
      messageText = msg.image?.caption || "[imagen]";
      mediaId = msg.image?.id;
    } else if (msg.type === "audio") {
      messageText = "[nota de voz]";
      mediaId = msg.audio?.id;
    } else if (msg.type === "interactive") {
      messageText =
        msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        "[interacción]";
    } else {
      messageText = `[${msg.type}]`;
    }

    toInsert.push({
      phone,
      message_text: messageText,
      message_type: messageType,
      media_id: mediaId,
      meta_message_id: msg.id,           // único, previene duplicados
      raw_payload: msg,
      status: "pending",
    });
  }

  // Insertar en la cola (con upsert por meta_message_id por si Meta reintenta)
  const { error: insertError } = await supabase
    .from("message_queue")
    .upsert(toInsert, { onConflict: "meta_message_id", ignoreDuplicates: true });

  if (insertError) {
    console.error("[webhook] Error encolando:", insertError.message);
    // Aún así respondemos 200 — el log queda en consola para debug
  }

  // ───────── 4. Disparar worker SIN AWAIT (fire & forget) ─────────
  // Esto procesa los mensajes en una invocación separada, así
  // este endpoint puede responder 200 inmediatamente.
  const workerUrl = `${getBaseUrl(req)}/api/process-queue`;
  const workerSecret = process.env.WORKER_SECRET || "auken-worker-2026";

  // No await: que arranque y nosotros respondemos ya
  fetch(workerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify({
      phones: [...new Set(toInsert.map(m => m.phone))],  // unique phones
      trigger: "webhook",
    }),
  }).catch(err => {
    console.error("[webhook] No se pudo despertar al worker:", err.message);
  });

  // ───────── 5. Responder 200 a Meta INMEDIATAMENTE ─────────
  return res.status(200).send("EVENT_RECEIVED");
}

function getBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}
