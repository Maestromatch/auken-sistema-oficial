import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── PALETA WAR ROOM ZEN ──────────────────────────────────────────────
const K = {
  bg:       "#07090D",
  bgDeep:   "#040508",
  surface:  "#11141D",
  surfaceL: "#1A1F2B",
  glass:    "rgba(17, 20, 29, 0.7)",
  border:   "rgba(255, 255, 255, 0.08)",
  ink:      "#F1F5F9",
  inkMid:   "#94A3B8",
  inkFaint: "#475569",
  neon:     "#3B82F6", 
  amber:    "#F59E0B",
  red:      "#EF4444",
  primary:  "#FB923C",
};

// ── HOOKS ────────────────────────────────────────────────────────
function useInterval(fn, ms) {
  const cb = useRef(fn);
  useEffect(() => { cb.current = fn; }, [fn]);
  useEffect(() => { const id = setInterval(() => cb.current(), ms); return () => clearInterval(id); }, [ms]);
}

// ── COMPONENTES ──────────────────────────────────────────────────
function Pulse({ color = K.neon, size = 8 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "ping 2s infinite" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}

export default function AukenOS() {
  const [clients, setClients] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState({ mrr: 0, active: 0, messages: 0, appointments: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [clientsRes, queueRes, logsRes] = await Promise.all([
      supabase.from("saas_clients").select("*"),
      supabase.from("cola_dashboard").select("*"),
      supabase.from("message_queue").select("*").order("received_at", { ascending: false }).limit(8)
    ]);

    if (clientsRes.data) {
      setClients(clientsRes.data);
      const mrr = clientsRes.data.filter(c => c.status === "active").reduce((acc, c) => acc + (c.config?.mensualidad || 0), 0);
      setStats(prev => ({ ...prev, active: clientsRes.data.length, mrr }));
    }

    if (logsRes.data) {
      setActivity(logsRes.data.map(m => ({
        ts: new Date(m.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: m.phone,
        event: m.message_text.substring(0, 40) + "...",
        status: m.status
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useInterval(fetchData, 10000);

  return (
    <div style={{ background: K.bg, minHeight: "100vh", color: K.ink, fontFamily: "'Inter', sans-serif", padding: "20px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        @keyframes ping { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>

      {/* TOP NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40, borderBottom: `1px solid ${K.border}`, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ width: 12, height: 12, background: K.primary, borderRadius: 3 }} />
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, letterSpacing: "-0.02em" }}>AUKÉN OS <span style={{ fontSize: 10, color: K.primary, opacity: 0.8 }}>v6.0 ZEN</span></h1>
        </div>
        <div style={{ display: "flex", gap: 30, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: K.inkMid }}>
          <span style={{ color: K.primary }}>OVERVIEW</span>
          <span>CLIENTES</span>
          <span>SISTEMA</span>
          <span style={{ color: K.inkFaint }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 40 }}>
        
        {/* LEFT COL */}
        <main>
          {/* KPIS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 40 }}>
            {[
              ["MRR TOTAL", `$${stats.mrr.toLocaleString()}`, K.green],
              ["CLIENTES ACTIVOS", stats.active, K.neon],
              ["MENSAJES 24H", stats.messages || "—", K.amber],
              ["CITAS GENERADAS", stats.appointments || "—", K.primary],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: K.surface, padding: 25, borderRadius: 20, border: `1px solid ${K.border}` }}>
                <div style={{ fontSize: 9, color: K.inkFaint, letterSpacing: "0.1em", marginBottom: 10 }}>{l}</div>
                <div style={{ fontSize: 28, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: v === "0" ? K.inkFaint : K.ink }}>{v}</div>
              </div>
            ))}
          </div>

          {/* PRODUCTOS REALES */}
          <div style={{ marginBottom: 40 }}>
             <div style={{ fontSize: 11, color: K.inkFaint, marginBottom: 20, letterSpacing: "0.1em" }}>PRODUCTOS ACTIVOS</div>
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ background: K.surface, padding: 25, borderRadius: 20, border: `1px solid ${K.border}`, display: "flex", gap: 20, alignItems: "center" }}>
                   <div style={{ fontSize: 32 }}>👁️</div>
                   <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Sistema Óptica</div>
                      <div style={{ fontSize: 11, color: K.inkMid }}>Fichas + Bot Agendamiento</div>
                      <div style={{ marginTop: 10, fontSize: 10, color: K.neon, fontWeight: 700 }}>{clients.length} CLIENTE(S) LIVE</div>
                   </div>
                </div>
                <div style={{ background: K.surface, padding: 25, borderRadius: 20, border: `1px solid ${K.border}`, opacity: 0.3 }}>
                   <div style={{ fontSize: 12, color: K.inkFaint }}>OTROS PRODUCTOS EN ROADMAP...</div>
                </div>
             </div>
          </div>

          {/* LISTA DE CLIENTES REALES */}
          <div>
            <div style={{ fontSize: 11, color: K.inkFaint, marginBottom: 20, letterSpacing: "0.1em" }}>CLIENTES EN PRODUCCIÓN</div>
            <div style={{ background: K.surface, borderRadius: 20, border: `1px solid ${K.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: K.bgDeep, color: K.inkFaint }}>
                    <th style={{ padding: "15px 25px", textAlign: "left" }}>CLIENTE</th>
                    <th style={{ padding: "15px 25px", textAlign: "left" }}>STATUS</th>
                    <th style={{ padding: "15px 25px", textAlign: "left" }}>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderTop: `1px solid ${K.border}` }}>
                      <td style={{ padding: "15px 25px" }}>
                        <div style={{ fontWeight: 700 }}>{c.optica_name}</div>
                        <div style={{ fontSize: 10, color: K.inkFaint }}>{c.city}</div>
                      </td>
                      <td style={{ padding: "15px 25px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Pulse color={c.status === "active" ? K.green : K.red} />
                          <span style={{ fontSize: 10, fontWeight: 700 }}>{c.status.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={{ padding: "15px 25px", fontFamily: "'IBM Plex Mono', monospace" }}>
                        ${(c.config?.mensualidad || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan="3" style={{ padding: 40, textAlign: "center", color: K.inkFaint }}>Esperando primer cliente real...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* RIGHT COL (LIVE FEED) */}
        <aside>
          <div style={{ background: K.bgDeep, border: `1px solid ${K.border}`, borderRadius: 24, padding: 25, height: "calc(100vh - 120px)", position: "sticky", top: 100 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 25 }}>
              <Pulse color={K.primary} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>ACTIVIDAD EN VIVO</div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${K.border}`, paddingLeft: 15, position: "relative" }}>
                  <div style={{ fontSize: 9, color: K.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 5 }}>{a.ts}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{a.phone}</div>
                  <div style={{ fontSize: 10, color: K.inkMid, lineHeight: "1.4" }}>{a.event}</div>
                </div>
              ))}
              {activity.length === 0 && (
                <div style={{ fontSize: 11, color: K.inkFaint, textAlign: "center", marginTop: 40 }}>Sin actividad reciente.</div>
              )}
            </div>

            <div style={{ position: "absolute", bottom: 25, left: 25, right: 25 }}>
               <div style={{ background: K.surface, padding: 15, borderRadius: 15, border: `1px solid ${K.border}` }}>
                  <div style={{ fontSize: 9, color: K.inkFaint, marginBottom: 5 }}>ESTADO DE SERVICIOS</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                     <span>Claude AI</span>
                     <span style={{ color: K.green }}>ONLINE</span>
                  </div>
               </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
