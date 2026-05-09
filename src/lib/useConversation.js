// =============================================================
// AUKÉN — Hook useConversation
// Carga el historial activo de un paciente o phone desde Supabase
// y lo mantiene sincronizado con la base de datos.
// =============================================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Carga la conversación activa para un paciente o número de teléfono.
 * Una conversación se considera activa si tuvo actividad en las últimas 24h.
 *
 * @param {object} options
 * @param {number}  [options.pacienteId] - id del paciente
 * @param {string}  [options.phone]      - número (alternativa a pacienteId)
 * @param {string}  [options.canal]      - 'whatsapp' | 'web' | 'voz'
 *
 * @returns {{
 *   messages: Array,
 *   conversacionId: number|null,
 *   loading: boolean,
 *   refresh: function,
 *   reset: function
 * }}
 */
export function useConversation({ pacienteId, phone, canal = "web" }) {
  const [messages, setMessages] = useState([]);
  const [conversacionId, setConversacionId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pacienteId && !phone) return;

    setLoading(true);
    try {
      let query = supabase
        .from("conversaciones")
        .select("id, messages, status, last_message_at")
        .eq("canal", canal)
        .eq("status", "active")
        .gte(
          "last_message_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
        .order("last_message_at", { ascending: false })
        .limit(1);

      if (pacienteId) {
        query = query.eq("paciente_id", pacienteId);
      } else if (phone) {
        query = query.eq("phone", phone);
      }

      const { data, error } = await query;
      if (error) throw error;

      const conv = data?.[0];
      if (conv) {
        setConversacionId(conv.id);
        // Convertir el formato de Supabase al formato del componente Chat
        setMessages(
          (conv.messages || []).map((m, idx) => ({
            id: `db-${conv.id}-${idx}`,
            role: m.role,
            content: m.content,
            ts: m.ts || "",
            meta: m.meta || {},
          }))
        );
      } else {
        setConversacionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("[useConversation] Error cargando:", err.message);
    } finally {
      setLoading(false);
    }
  }, [pacienteId, phone, canal]);

  useEffect(() => {
    load();
  }, [load]);

  // Suscripción en tiempo real a cambios en la conversación.
  // Si el bot responde por WhatsApp mientras un humano mira el dashboard,
  // se actualiza solo.
  useEffect(() => {
    if (!conversacionId) return;

    const channel = supabase
      .channel(`conv-${conversacionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversaciones",
          filter: `id=eq.${conversacionId}`,
        },
        (payload) => {
          const newMessages = payload.new?.messages || [];
          setMessages(
            newMessages.map((m, idx) => ({
              id: `db-${conversacionId}-${idx}`,
              role: m.role,
              content: m.content,
              ts: m.ts || "",
              meta: m.meta || {},
            }))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversacionId]);

  const reset = useCallback(() => {
    setMessages([]);
    setConversacionId(null);
  }, []);

  return { messages, conversacionId, loading, refresh: load, reset };
}
