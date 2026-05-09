import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const Z = {
  bg:       "#07090D",
  surface:  "#11141D",
  surfaceL: "#1A1F2B",
  border:   "rgba(255, 255, 255, 0.08)",
  ink:      "#F1F5F9",
  inkMid:   "#94A3B8",
  inkFaint: "#475569",
  primary:  "#FB923C", 
  neon:     "#3B82F6", 
  green:    "#10B981",
  amber:    "#F59E0B",
  red:      "#EF4444",
  grad:     "linear-gradient(135deg, #FB923C 0%, #F59E0B 100%)",
};

export default function AukenOpticaDashboard() {
  const [tab, setTab] = useState("metricas");
  const [optica, setOptica] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [queue, setQueue] = useState({ pending: 0, processing: 0, done: 0 });
  const [selectedP, setSelectedP] = useState(null);
  const [loading, setLoading] = useState(true);

  const OPTICA_SLUG = "glowvision";

  const refresh = useCallback(async () => {
    try {
      const [optRes, pacRes, citaRes, vntRes, qRes] = await Promise.all([
        supabase.from("opticas").select("*").eq("slug", OPTICA_SLUG).maybeSingle(),
        supabase.from("pacientes").select("*").order("created_at", { ascending: false }),
        supabase.from("citas").select("*").order("fecha", { ascending: true }),
        supabase.from("ventas").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_queue_stats").catch(() => ({ data: null }))
      ]);

      setOptica(optRes.data);
      setPacientes(pacRes.data || []);
      setCitas(citaRes.data || []);
      setVentas(vntRes.data || []);
      if (qRes?.data) setQueue(qRes.data);
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  if (loading) return <div style={{ background: Z.bg, color: Z.inkMid, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>AUKÉN OS v6.8...</div>;

  return (
    <div style={{ background: Z.bg, minHeight: "100vh", color: Z.ink, fontFamily: "'Inter', sans-serif", padding: "40px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>

      {/* HEADER DINÁMICO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ width: 45, height: 45, background: Z.grad, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👁️</div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, margin: 0 }}>{optica?.nombre}</h1>
          <span style={{ fontSize: 9, background: Z.amber + "20", color: Z.amber, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>WAR ROOM v6.8</span>
        </div>
        
        {/* MONITOR DE PULSO (VIVO) */}
        <div style={{ display: "flex", gap: 20, background: Z.surfaceL, padding: "10px 25px", borderRadius: 20, border: `1px solid ${Z.border}` }}>
           <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: Z.inkFaint }}>PENDIENTES</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: queue.pending > 0 ? Z.amber : Z.ink }}>{queue.pending}</div>
           </div>
           <div style={{ width: 1, background: Z.border }} />
           <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: Z.inkFaint }}>PROCESANDO</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: Z.neon }} className={queue.processing > 0 ? "pulse" : ""}>{queue.processing}</div>
           </div>
           <div style={{ width: 1, background: Z.border }} />
           <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: Z.inkFaint }}>SISTEMA</div>
              <div style={{ fontSize: 10, color: Z.green, fontWeight: 700, marginTop: 5 }}>ONLINE</div>
           </div>
        </div>
      </header>

      {/* NAVEGACIÓN */}
      <nav style={{ display: "flex", gap: 40, borderBottom: `1px solid ${Z.border}`, marginBottom: 35 }}>
        {["metricas", "crm", "campañas", "agenda", "config"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", padding: "15px 0", color: tab === t ? Z.primary : Z.inkFaint,
            borderBottom: tab === t ? `3px solid ${Z.primary}` : "3px solid transparent", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase"
          }}>{t === "crm" ? "BASE CLÍNICA" : t.toUpperCase()}</button>
        ))}
      </nav>

      <main>
        {tab === "metricas" && (
           <div style={{ display: "flex", flexDirection: "column", gap: 25 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                 <div style={{ background: Z.surface, padding: 25, borderRadius: 24, border: `1px solid ${Z.border}` }}>
                    <div style={{ fontSize: 10, color: Z.inkFaint, marginBottom: 10 }}>INGRESOS TOTALES</div>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>${ventas.reduce((s,v)=>s+Number(v.monto), 0).toLocaleString()}</div>
                 </div>
                 <div style={{ background: Z.surface, padding: 25, borderRadius: 24, border: `1px solid ${Z.border}` }}>
                    <div style={{ fontSize: 10, color: Z.inkFaint, marginBottom: 10 }}>PACIENTES ACTIVOS</div>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{pacientes.length}</div>
                 </div>
                 <div style={{ background: Z.surface, padding: 25, borderRadius: 24, border: `1px solid ${Z.border}` }}>
                    <div style={{ fontSize: 10, color: Z.inkFaint, marginBottom: 10 }}>FOTOS DE RECETAS</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: Z.neon }}>{pacientes.filter(p => p.receta_img_path).length}</div>
                 </div>
                 <div style={{ background: Z.surface, padding: 25, borderRadius: 24, border: `1px solid ${Z.border}` }}>
                    <div style={{ fontSize: 10, color: Z.inkFaint, marginBottom: 10 }}>CONVERSIÓN BOT</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: Z.green }}>{pacientes.length > 0 ? Math.round((ventas.length/pacientes.length)*100) : 0}%</div>
                 </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 25 }}>
                 <div style={{ background: Z.surface, borderRadius: 24, padding: 25, border: `1px solid ${Z.border}` }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>FLUJO DE LEADS (ÚLTIMAS 24H)</h3>
                    <div style={{ height: 200, background: Z.bgDeep, borderRadius: 15, display: "flex", alignItems: "flex-end", padding: 20, gap: 10 }}>
                       {[30, 45, 60, 20, 80, 50, 40, 90, 100, 30].map((h, i) => (
                         <div key={i} style={{ flex: 1, height: `${h}%`, background: Z.grad, borderRadius: 4, opacity: 0.7 }} />
                       ))}
                    </div>
                 </div>
                 <div style={{ background: Z.surface, borderRadius: 24, padding: 25, border: `1px solid ${Z.border}` }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>ACTIVIDAD RECIENTE</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                       {pacientes.slice(0, 3).map(p => (
                         <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 35, height: 35, background: Z.surfaceL, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                            <div>
                               <div style={{ fontSize: 12, fontWeight: 700 }}>{p.nombre}</div>
                               <div style={{ fontSize: 10, color: Z.inkFaint }}>Nueva interacción vía WhatsApp</div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {tab === "crm" && (
           <div style={{ background: Z.surface, borderRadius: 24, overflow: "hidden", border: `1px solid ${Z.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                 <thead>
                    <tr style={{ background: Z.surfaceL }}>
                       <th style={{ padding: 20, textAlign: "left", fontSize: 10, color: Z.inkFaint }}>Paciente</th>
                       <th style={{ padding: 20, textAlign: "left", fontSize: 10, color: Z.inkFaint }}>Estado</th>
                       <th style={{ padding: 20, textAlign: "left", fontSize: 10, color: Z.inkFaint }}>Receta Escaneada</th>
                       <th style={{ padding: 20, textAlign: "left", fontSize: 10, color: Z.inkFaint }}>Acción</th>
                    </tr>
                 </thead>
                 <tbody>
                    {pacientes.map(p => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${Z.border}` }}>
                         <td style={{ padding: 20 }}>
                            <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: Z.inkMid }}>{p.rut}</div>
                         </td>
                         <td style={{ padding: 20 }}>
                            <span style={{ color: p.estado === "vigente" ? Z.green : Z.red, fontWeight: 700, fontSize: 11 }}>{p.estado?.toUpperCase()}</span>
                         </td>
                         <td style={{ padding: 20 }}>
                            {p.receta_img_path ? <span style={{ color: Z.neon }}>✅ LISTO</span> : <span style={{ color: Z.inkFaint }}>—</span>}
                         </td>
                         <td style={{ padding: 20 }}>
                            <button style={{ background: Z.surfaceL, border: "none", color: Z.ink, padding: "6px 15px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>VER FICHA</button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        )}
      </main>

      <footer style={{ marginTop: 60, textAlign: "center", fontSize: 10, color: Z.inkFaint, fontFamily: "monospace" }}>
        AUKÉN ZEN MASTER OS v6.8 · OPERATIONAL RADAR: ACTIVE
      </footer>
    </div>
  );
}
