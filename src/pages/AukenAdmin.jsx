import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";

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

function clp(n) {
  return "$" + Number(n || 0).toLocaleString("es-CL");
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function buildMrrSeries(opticas) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    return monthKey(d);
  });
  return months.map(key => opticas.reduce((sum, o) => {
    const created = o.created_at ? monthKey(new Date(o.created_at)) : months[0];
    const monthly = Number(o.config?.mensualidad || 0);
    return o.status === "active" && created <= key ? sum + monthly : sum;
  }, 0));
}

function buildPlanBreakdown(opticas) {
  const colors = [Z.primary, Z.neon, Z.green, Z.amber, "#A78BFA"];
  const map = new Map();
  opticas.filter(o => o.status === "active").forEach(o => {
    const name = o.plan_type || "Sin plan";
    const current = map.get(name) || { name, count: 0, mrr: 0, color: colors[map.size % colors.length] };
    current.count += 1;
    current.mrr += Number(o.config?.mensualidad || 0);
    map.set(name, current);
  });
  return Array.from(map.values());
}

function MrrHeroCard({ mrr, mrrPrev, series, payingOpticas, plans, churnPct, onDrill }) {
  const delta = mrrPrev ? ((mrr - mrrPrev) / mrrPrev) * 100 : 0;
  const up = delta >= 0;
  const arr = mrr * 12;
  const arpu = payingOpticas > 0 ? mrr / payingOpticas : 0;
  const W = 220;
  const H = 56;
  const cleanSeries = series?.length ? series : [mrr];
  const max = Math.max(...cleanSeries, 1);
  const min = Math.min(...cleanSeries, 0);
  const pts = cleanSeries.map((v, i) => [
    cleanSeries.length > 1 ? (i / (cleanSeries.length - 1)) * W : W,
    H - ((v - min) / (max - min || 1)) * (H - 8) - 4,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const planTotal = Math.max(mrr, 1);

  return (
    <Card accent={Z.green} glow style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <div style={{ background: `linear-gradient(180deg, ${Z.surface} 0%, ${Z.bgDeep} 100%)`, padding: "20px 22px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 24, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: Z.inkFaint }}>MRR Total / {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 20, padding: "0 7px", borderRadius: 5, background: up ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)", color: up ? Z.green : Z.red, border: `1px solid ${up ? "rgba(16,185,129,0.24)" : "rgba(239,68,68,0.24)"}`, fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ fontSize: 9 }}>{up ? "+" : "-"}</span>{Math.abs(delta).toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: Z.inkMid, fontFamily: "'IBM Plex Mono', monospace" }}>vs {clp(mrrPrev)}</span>
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 48, fontWeight: 700, color: Z.ink, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{clp(mrr)}</span>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              { l: "ARR proyectado", v: clp(arr), c: Z.ink },
              { l: "ARPU", v: clp(Math.round(arpu)), c: Z.ink },
              { l: "Opticas pagando", v: payingOpticas, c: Z.green },
              { l: "Churn proxy", v: `${churnPct.toFixed(1)}%`, c: churnPct > 5 ? Z.red : Z.inkMid },
            ].map(s => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, color: Z.inkFaint, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.l}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: Z.inkFaint, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Distribucion por plan</span>
            <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", border: `1px solid ${Z.border}`, background: Z.bgDeep }}>
              {(plans.length ? plans : [{ name: "Sin MRR", count: 0, mrr: 0, color: Z.inkFaint }]).map(p => (
                <div key={p.name} title={`${p.name}: ${clp(p.mrr)}`} style={{ flexBasis: `${Math.max(0, (p.mrr / planTotal) * 100)}%`, minWidth: p.mrr ? 2 : 0, background: p.color, transition: "flex-basis 400ms cubic-bezier(0.16,1,0.3,1)" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {plans.map(p => <span key={p.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: Z.inkMid }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.name} <span style={{ color: Z.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{p.count}</span></span>)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end", position: "relative" }}>
          <span style={{ fontSize: 10, color: Z.inkFaint, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "right" }}>Ultimos 6 meses</span>
          <svg width={W} height={H} style={{ overflow: "visible" }}>
            <defs><linearGradient id="mrr-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={Z.green} stopOpacity="0.25" /><stop offset="100%" stopColor={Z.green} stopOpacity="0" /></linearGradient></defs>
            <path d={area} fill="url(#mrr-grad)" />
            <path d={path} fill="none" stroke={Z.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3 : 1.5} fill={i === pts.length - 1 ? Z.green : Z.surface} stroke={Z.green} strokeWidth="1.2" />)}
          </svg>
          <button onClick={onDrill} style={{ alignSelf: "flex-end", marginTop: 4, background: "transparent", border: "none", color: Z.primary, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>Ver detalle <Icon name="arrow" size={11} /></button>
        </div>
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

  const activeOpticas = opticas.filter(o => o.status === "active");
  const suspendedOpticas = opticas.filter(o => o.status !== "active");
  const totalMRR = activeOpticas.reduce((s, o) => s + Number(o.config?.mensualidad || 0), 0);
  const mrrSeries = buildMrrSeries(opticas);
  const mrrPrev = mrrSeries.length > 1 ? mrrSeries[mrrSeries.length - 2] : totalMRR;
  const planBreakdown = buildPlanBreakdown(opticas);
  const churnPct = opticas.length ? (suspendedOpticas.length / opticas.length) * 100 : 0;

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
      <MrrHeroCard
        mrr={totalMRR}
        mrrPrev={mrrPrev}
        series={mrrSeries}
        payingOpticas={activeOpticas.length}
        plans={planBreakdown}
        churnPct={churnPct}
        onDrill={() => alert("Detalle financiero pronto: aqui conectaremos billing, cohortes y expansion MRR.")}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 40 }}>
        <KPIZen icon="🏢" label="ÓPTICAS" value={opticas.length} color={Z.neon} />
        <KPIZen icon="✅" label="ACTIVAS" value={activeOpticas.length} color={Z.green} />
        <KPIZen icon="🚫" label="SUSPENDIDAS" value={suspendedOpticas.length} color={Z.red} />
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
