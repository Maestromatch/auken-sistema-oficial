import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ConfirmDialog from "../components/ConfirmDialog";

// ── PALETA ZEN / WAR ROOM ──────────────────────────────────────────────
const Z = {
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
  green:    "#10B981",
  primary:  "#FB923C", 
};

const ADMIN_PASSWORD = "auken-admin-2026";

// ── MICRO COMPONENTES ZEN ────────────────────────────────────────────
function Card({ children, style = {}, accent, glow }) {
  return (
    <div style={{
      background: Z.glass,
      backdropFilter: "blur(16px)",
      border: `1px solid ${Z.border}`,
      borderTop: accent ? `2px solid ${accent}` : `1px solid ${Z.border}`,
      borderRadius: 24,
      padding: 24,
      boxShadow: glow ? `0 0 40px ${accent}20` : "0 8px 32px rgba(0,0,0,0.4)",
      transition: "all 0.3s ease",
      ...style,
    }}>{children}</div>
  );
}

function KPIZen({ label, value, color, icon, glow }) {
  return (
    <Card accent={color} glow={glow} style={{ flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ 
          fontFamily: "'IBM Plex Mono', monospace", 
          fontSize: 10, 
          color: Z.inkFaint, 
          textTransform: "uppercase", 
          letterSpacing: "0.12em" 
        }}>{label}</div>
      </div>
      <div style={{ 
        fontFamily: "'Outfit', sans-serif", 
        fontWeight: 700, 
        fontSize: 32, 
        color: Z.ink, 
        lineHeight: 1 
      }}>
        {value}
      </div>
    </Card>
  );
}

export default function AukenAdmin() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [opticas, setOpticas] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [suspending, setSuspending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOptica, setNewOptica] = useState({ 
    nombre: "", dueño: "", plan: "Mensual", telefono: "", ciudad: "", 
    mensualidad: 89990, instalacion: 150000, notas: "" 
  });

  useEffect(() => {
    if (localStorage.getItem("auken_admin") === "true") setAuthed(true);
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase.from("saas_clients").select("*").order("created_at", { ascending: false });
    if (!error && data) setOpticas(data);
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pass === ADMIN_PASSWORD) {
      localStorage.setItem("auken_admin", "true");
      setAuthed(true);
    } else {
      alert("Acceso Denegado");
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const next = currentStatus === "active" ? "suspended" : "active";
    const { error } = await supabase.from("saas_clients").update({ status: next }).eq("id", id);
    if (!error) fetchClients();
  };

  const requestStatusChange = (optica) => {
    if (optica.status === "active") {
      setSuspending(optica);
      return;
    }
    toggleStatus(optica.id, optica.status);
  };

  const confirmSuspend = async () => {
    if (!suspending) return;
    await toggleStatus(suspending.id, suspending.status);
    setSuspending(null);
  };

  const purgeDemoData = async () => {
    await Promise.all([
      supabase.from("conversaciones").delete().neq("id", 0),
      supabase.from("citas").delete().neq("id", 0),
      supabase.from("pacientes").delete().neq("id", 0),
    ]);
    setPurgeOpen(false);
    fetchClients();
    alert("Datos operativos purgados.");
  };

  const addOptica = async (e) => {
    e.preventDefault();
    const payload = {
      optica_name: newOptica.nombre,
      owner_name: newOptica.dueño,
      plan_type: newOptica.plan,
      city: newOptica.ciudad,
      phone: newOptica.telefono,
      status: "active",
      config: { 
        mensualidad: newOptica.mensualidad, 
        instalacion: newOptica.instalacion,
        notes: newOptica.notas 
      }
    };
    
    const { error } = await supabase.from("saas_clients").insert([payload]);
    if (error) alert("Error: " + error.message);
    else {
      setShowAdd(false);
      fetchClients();
      setNewOptica({ nombre: "", dueño: "", plan: "Mensual", telefono: "", ciudad: "", mensualidad: 89990, instalacion: 150000, notas: "" });
    }
  };

  const totalMRR = opticas.filter(o => o.status === "active").reduce((s, o) => s + (o.config?.mensualidad || 0), 0);

  if (!authed) {
    return (
      <div style={{ background: Z.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Outfit:wght@700&display=swap');
        `}</style>
        <Card style={{ width: 360, textAlign: "center", padding: 40 }} accent={Z.primary} glow>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🌌</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, color: Z.ink, marginBottom: 8 }}>AUKÉN OS</h2>
          <p style={{ fontSize: 12, color: Z.inkFaint, marginBottom: 32, letterSpacing: "0.1em" }}>TERMINAL SUPER ADMIN</p>
          <form onSubmit={handleLogin}>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="CLAVE DE ACCESO"
              style={{ width: "100%", background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none", fontSize: 13, textAlign: "center", marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }} />
            <button type="submit" style={{ width: "100%", background: Z.primary, color: Z.bgDeep, border: "none", borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              INICIAR SESIÓN
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ background: Z.bg, minHeight: "100vh", color: Z.ink, fontFamily: "'Inter', sans-serif", padding: 32 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* HEADER ZEN */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, background: Z.primary, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: Z.bgDeep, fontWeight: 900 }}>A</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700 }}>AUKÉN SUPERADMIN</h1>
          </div>
          <p style={{ color: Z.inkFaint, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>MONITOR DEL ECOSISTEMA v6.0</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }}>
          <button onClick={() => setAdvancedOpen(v => !v)}
            style={{ background: "transparent", border: `1px solid ${Z.border}`, color: Z.inkMid, borderRadius: 12, padding: "10px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            AVANZADO
          </button>
          {advancedOpen && (
            <div style={{ position: "absolute", right: 92, top: 44, width: 220, background: Z.surface, border: `1px solid ${Z.border}`, borderRadius: 12, padding: 6, boxShadow: "0 18px 48px rgba(0,0,0,0.55)", zIndex: 10 }}>
              <button onClick={() => { setAdvancedOpen(false); setPurgeOpen(true); }}
                style={{ width: "100%", textAlign: "left", background: "transparent", color: Z.red, border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                PURGAR DATOS OPERATIVOS
              </button>
            </div>
          )}
          <button onClick={() => { localStorage.removeItem("auken_admin"); setAuthed(false); }}
            style={{ background: Z.surfaceL, border: `1px solid ${Z.border}`, color: Z.inkMid, borderRadius: 12, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            SALIR
          </button>
        </div>
      </header>

      {/* METRICS ZEN */}
      <div style={{ display: "flex", gap: 20, marginBottom: 40 }}>
        <KPIZen icon="💵" label="MRR TOTAL" value={`$${totalMRR.toLocaleString("es-CL")}`} color={Z.green} glow />
        <KPIZen icon="🏢" label="ÓPTICAS" value={opticas.length} color={Z.neon} />
        <KPIZen icon="✅" label="ACTIVAS" value={opticas.filter(o => o.status === "active").length} color={Z.green} />
        <KPIZen icon="🚫" label="SUSPENDIDAS" value={opticas.filter(o => o.status !== "active").length} color={Z.red} />
      </div>

      {/* CLIENTS ZEN */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${Z.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: Z.bgDeep }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Gestión de Partners</h3>
          <button onClick={() => setShowAdd(true)} style={{ background: Z.primary, color: Z.bgDeep, border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + NUEVA ÓPTICA
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: Z.surfaceL }}>
              {["Partner", "Plan", "Mensualidad", "Status", "Acciones"].map(h => (
                <th key={h} style={{ padding: "16px 24px", fontSize: 10, color: Z.inkFaint, fontWeight: 700, textTransform: "uppercase", textAlign: "left", letterSpacing: "0.1em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opticas.map(o => (
              <tr key={o.id} style={{ borderBottom: `1px solid ${Z.border}` }}>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ fontWeight: 600, color: Z.ink }}>{o.optica_name}</div>
                  <div style={{ fontSize: 11, color: Z.inkFaint }}>{o.owner_name} · {o.city}</div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <span style={{ fontSize: 11, color: Z.neon, fontWeight: 600, background: Z.neon + "10", padding: "4px 10px", borderRadius: 8 }}>{o.plan_type}</span>
                </td>
                <td style={{ padding: "16px 24px", fontFamily: "'IBM Plex Mono', monospace", color: Z.green, fontWeight: 700 }}>
                  ${(o.config?.mensualidad || 0).toLocaleString("es-CL")}
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: o.status === "active" ? Z.green : Z.red }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: o.status === "active" ? Z.green : Z.red }}>{o.status.toUpperCase()}</span>
                  </div>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <button onClick={() => requestStatusChange(o)} style={{
                    background: "transparent", border: `1px solid ${o.status === "active" ? Z.red : Z.green}40`,
                    color: o.status === "active" ? Z.red : Z.green, borderRadius: 8, padding: "6px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer"
                  }}>
                    {o.status === "active" ? "SUSPENDER" : "ACTIVAR"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* MODAL ZEN */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <Card style={{ width: 420, padding: 32 }} accent={Z.primary}>
            <h3 style={{ fontSize: 20, color: Z.ink, marginBottom: 24, fontFamily: "'Outfit', sans-serif" }}>Configurar Partner</h3>
            <form onSubmit={addOptica} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input required placeholder="Nombre de la Óptica" value={newOptica.nombre} onChange={e => setNewOptica({...newOptica, nombre: e.target.value})} 
                style={{ background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none" }} />
              <input required placeholder="Dueño" value={newOptica.dueño} onChange={e => setNewOptica({...newOptica, dueño: e.target.value})} 
                style={{ background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                 <input placeholder="Teléfono" value={newOptica.telefono} onChange={e => setNewOptica({...newOptica, telefono: e.target.value})} 
                   style={{ background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none" }} />
                 <input placeholder="Ciudad" value={newOptica.ciudad} onChange={e => setNewOptica({...newOptica, ciudad: e.target.value})} 
                   style={{ background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none" }} />
              </div>
              <select value={newOptica.plan} onChange={e => setNewOptica({...newOptica, plan: e.target.value})} 
                style={{ background: Z.bgDeep, border: `1px solid ${Z.border}`, color: Z.ink, padding: 14, borderRadius: 12, outline: "none", cursor: "pointer" }}>
                <option>Mensual</option><option>Anual</option><option>Empresarial</option>
              </select>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAdd(false)} style={{ flex: 1, background: "transparent", color: Z.inkMid, border: "none", cursor: "pointer" }}>CANCELAR</button>
                <button type="submit" style={{ flex: 1, background: Z.primary, color: Z.bgDeep, border: "none", padding: 14, borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>CREAR PARTNER</button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        onConfirm={purgeDemoData}
        severity="critical"
        title="Purgar datos operativos"
        body="Esto eliminará pacientes, citas y conversaciones de forma permanente. No elimina partners ni configuraciones comerciales. La operación no es reversible."
        action={[
          { label: "Pacientes", value: "se borrarán todos" },
          { label: "Citas", value: "se borrarán todas" },
          { label: "Conversaciones", value: "se borrarán todas" },
          { label: "Partners", value: "se conservan" },
        ]}
        typeToConfirm="PURGAR ECOSISTEMA"
        confirmText="Purgar definitivamente"
        theme={{ bg: Z.bgDeep, surface: Z.surface, surfaceL: Z.surfaceL, border: Z.border, text: Z.ink, textDim: Z.inkMid, textMute: Z.inkFaint, textInv: Z.bgDeep, yellow: Z.amber, red: Z.red, fontSans: "'Inter', sans-serif", fontMono: "'IBM Plex Mono', monospace" }}
      />

      <ConfirmDialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        onConfirm={confirmSuspend}
        severity="danger"
        title={`Suspender ${suspending?.optica_name || "partner"}`}
        body="El bot dejará de responder para esta óptica y el acceso quedará pausado hasta que la reactives."
        action={[
          { label: "Partner", value: suspending?.optica_name || "-" },
          { label: "MRR pausado", value: "$" + Number(suspending?.config?.mensualidad || 0).toLocaleString("es-CL"), mono: true },
        ]}
        typeToConfirm={suspending?.optica_name || ""}
        confirmText="Suspender"
        theme={{ bg: Z.bgDeep, surface: Z.surface, surfaceL: Z.surfaceL, border: Z.border, text: Z.ink, textDim: Z.inkMid, textMute: Z.inkFaint, textInv: Z.bgDeep, yellow: Z.amber, red: Z.red, fontSans: "'Inter', sans-serif", fontMono: "'IBM Plex Mono', monospace" }}
      />
    </div>
  );
}
