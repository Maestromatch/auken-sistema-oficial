// =============================================================
// AUKÉN — Monitor de cola en tiempo real
// Componente para insertar en AukenOpticaDashboard o AukenAdmin
// Muestra estado de la cola, alertas y métricas de salud.
// =============================================================

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#090A0F",
  surface: "#11131C",
  border: "#23283A",
  text: "#F8FAFC",
  textDim: "#94A3B8",
  textMuted: "#475569",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#F43F5E",
  blue: "#7DD3FC",
};

export default function QueueMonitor() {
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    done24h: 0,
    failed24h: 0,
    oldestPending: null,
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [recentMessages, setRecentMessages] = useState([]);

  const fetchStats = async () => {
    const { data } = await supabase.from("cola_dashboard").select("*");
    if (!data) return;

    const byStatus = Object.fromEntries(data.map(d => [d.status, d]));

    setStats({
      pending: byStatus.pending?.total || 0,
      processing: byStatus.processing?.total || 0,
      done24h: byStatus.done?.ultimas_24h || 0,
      failed24h: byStatus.failed?.ultimas_24h || 0,
      oldestPending: byStatus.pending?.pendiente_mas_antiguo || null,
    });
    setLastUpdate(new Date());

    // Últimos 10 mensajes procesados
    const { data: recent } = await supabase
      .from("message_queue")
      .select("phone, message_text, status, received_at, processed_at, error_message")
      .order("received_at", { ascending: false })
      .limit(10);
    setRecentMessages(recent || []);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // refrescar cada 5s
    return () => clearInterval(interval);
  }, []);

  // Calcular salud del sistema
  const isHealthy = stats.pending < 20 && stats.failed24h < 5;
  const isCritical = stats.pending > 50 || stats.failed24h > 20;
  const oldestAge = stats.oldestPending
    ? Math.floor((Date.now() - new Date(stats.oldestPending).getTime()) / 1000)
    : 0;

  const healthColor = isCritical ? C.red : isHealthy ? C.green : C.amber;
  const healthLabel = isCritical
    ? "CRÍTICO"
    : isHealthy
    ? "SALUDABLE"
    : "ATENCIÓN";

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 24,
      borderTop: `2px solid ${healthColor}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: C.textDim, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
            🚦 Salud de la Cola
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: healthColor,
              boxShadow: `0 0 8px ${healthColor}`,
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: healthColor }}>{healthLabel}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {lastUpdate && `actualizado: ${lastUpdate.toLocaleTimeString("es-CL")}`}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Stat label="Pendientes" value={stats.pending} color={stats.pending > 20 ? C.amber : C.blue} />
        <Stat label="Procesando" value={stats.processing} color={C.blue} />
        <Stat label="Resueltas (24h)" value={stats.done24h} color={C.green} />
        <Stat label="Fallidas (24h)" value={stats.failed24h} color={stats.failed24h > 0 ? C.red : C.textMuted} />
      </div>

      {/* Alerta si hay mensaje pendiente antiguo */}
      {oldestAge > 60 && (
        <div style={{
          background: `${C.red}15`,
          border: `1px solid ${C.red}40`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
          color: C.red,
        }}>
          ⚠ Hay un mensaje pendiente desde hace {Math.floor(oldestAge / 60)} min. Revisa el worker.
        </div>
      )}

      {/* Últimos mensajes */}
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: 10, letterSpacing: "0.05em" }}>
          Últimos mensajes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
          {recentMessages.length === 0 && (
            <div style={{ fontSize: 12, color: C.textMuted, padding: 16, textAlign: "center" }}>
              Sin mensajes recientes
            </div>
          )}
          {recentMessages.map((m, i) => {
            const statusColor = m.status === "done" ? C.green
                              : m.status === "failed" ? C.red
                              : m.status === "processing" ? C.amber
                              : C.blue;
            return (
              <div key={i} style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${statusColor}`,
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>{m.phone}</span>
                  <span style={{ color: statusColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ color: C.textDim, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.message_text || "—"}
                </div>
                {m.error_message && (
                  <div style={{ color: C.red, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
                    {m.error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "12px 14px",
    }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 28, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{label}</div>
    </div>
  );
}
