import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// =============================================================
// AUKÉN OPTICA DASHBOARD — versión limpia
// Fixes aplicados:
//   - Bug TDZ: useEffect movido después de useState
//   - handleSendWhatsApp pasado como prop a OpticaDetail
//   - Config de óptica cargada desde Supabase (editable)
//   - Tabla `citas` integrada (KPI nuevo)
//   - QueueMonitor integrado para ver salud del sistema
// =============================================================

const C = {
  bg:         "#090A0F",
  surface:    "#11131C",
  surfaceL:   "#1A1D2A",
  border:     "#23283A",
  borderGlow: "#FB923C40",
  text:       "#F8FAFC",
  textDim:    "#94A3B8",
  textMuted:  "#475569",
  primary:    "#FB923C",
  primaryD:   "#7DD3FC",
  green:      "#10B981",
  amber:      "#F59E0B",
  red:        "#F43F5E",
  blue:       "#7DD3FC",
};

// ─────────────────────────────────────────────────────────────
// MICRO COMPONENTES
// ─────────────────────────────────────────────────────────────
function Card({ children, style = {}, accent }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: accent ? `2px solid ${accent}` : `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      ...style,
    }}>{children}</div>
  );
}

function KPI({ label, value, color, sub, glow }) {
  return (
    <Card accent={color} style={{
      boxShadow: glow ? `0 0 20px ${color}25` : undefined,
    }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 32, color, lineHeight: 1, textShadow: glow ? `0 0 12px ${color}50` : "none" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{
      background: `${color}20`,
      color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: "2px 8px",
      fontSize: 11, fontWeight: 600,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>{label}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// QUEUE MONITOR (en línea)
// ─────────────────────────────────────────────────────────────
function QueueMonitor() {
  const [stats, setStats] = useState({ pending: 0, processing: 0, done24h: 0, failed24h: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const tick = async () => {
      const { data } = await supabase.from("cola_dashboard").select("*");
      if (data) {
        const byStatus = Object.fromEntries(data.map(d => [d.status, d]));
        setStats({
          pending: byStatus.pending?.total || 0,
          processing: byStatus.processing?.total || 0,
          done24h: byStatus.done?.ultimas_24h || 0,
          failed24h: byStatus.failed?.ultimas_24h || 0,
        });
      }
      const { data: recentMsgs } = await supabase.from("message_queue")
        .select("phone, message_text, status, received_at, error_message")
        .order("received_at", { ascending: false }).limit(8);
      setRecent(recentMsgs || []);
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = stats.pending < 20 && stats.failed24h < 5;
  const healthColor = stats.failed24h > 20 ? C.red : isHealthy ? C.green : C.amber;

  return (
    <Card accent={healthColor}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.textDim, textTransform: "uppercase", fontWeight: 600 }}>🚦 Salud del Bot</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: healthColor }}>
              {isHealthy ? "OPERANDO NORMAL" : "REVISAR"}
            </span>
          </div>
        </div>
        <button 
          onClick={async () => {
            const secret = prompt("Ingrese WORKER_SECRET para autorizar:");
            if(!secret) return;
            const res = await fetch("/api/process-queue", { 
              method: "POST", 
              headers: { "x-worker-secret": secret, "content-type": "application/json" },
              body: JSON.stringify({ trigger: "manual_force" })
            });
            const data = await res.json();
            alert(data.success ? "¡IA Despertada! Procesando cola..." : "Error: " + (data.error || "Secreto incorrecto"));
          }}
          style={{ background: "rgba(251, 146, 60, 0.1)", border: `1px solid ${C.primary}`, color: C.primary, padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          ⚡ FORZAR DESPERTAR IA
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          ["Pendientes", stats.pending, stats.pending > 20 ? C.amber : C.blue],
          ["Procesando", stats.processing, C.blue],
          ["Resueltas 24h", stats.done24h, C.green],
          ["Fallidas 24h", stats.failed24h, stats.failed24h > 0 ? C.red : C.textMuted],
        ].map(([l, v, col]) => (
          <div key={l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 22, color: col }}>{v}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Últimos mensajes</div>
      <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {recent.length === 0 && <div style={{ color: C.textMuted, fontSize: 12, padding: 12, textAlign: "center" }}>Sin mensajes recientes</div>}
        {recent.map((m, i) => {
          const col = m.status === "done" ? C.green : m.status === "failed" ? C.red : m.status === "processing" ? C.amber : C.blue;
          return (
            <div key={i} style={{
              background: C.bg, borderLeft: `3px solid ${col}`,
              borderRadius: 4, padding: "6px 10px", fontSize: 11,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{m.phone}</span>
                <span style={{ color: col, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{m.status}</span>
              </div>
              <div style={{ color: C.textDim, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.message_text || "—"}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: MÉTRICAS
// ─────────────────────────────────────────────────────────────
function TabMetricas({ optica, stats }) {
  const recetasVencidas = stats?.recetas_vencidas || 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Total Pacientes" value={stats?.total_pacientes} color={C.text} sub="En la base de datos" />
        <KPI label="Vigentes" value={stats?.recetas_vigentes} color={C.green} sub="Receta < 11 meses" />
        <KPI label="Próximas a vencer" value={stats?.recetas_proximas} color={C.amber} sub="11–12 meses" />
        <KPI label="Vencidas" value={recetasVencidas} color={C.red} sub="Requieren acción" glow={recetasVencidas > 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KPI label="💬 Conversaciones 24h" value={stats?.conversaciones_24h} color={C.blue} sub="Bot atendiendo en vivo" />
        <KPI label="📅 Citas próximas" value={stats?.citas_proximas} color={C.primary} sub="Hoy y siguientes" />
        <KPI
          label="💰 Ventas totales"
          value={stats?.ventas_total_clp ? `$${Number(stats.ventas_total_clp).toLocaleString("es-CL")}` : "$0"}
          color={C.green} sub="CLP acumulados"
        />
      </div>

      <QueueMonitor />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: PACIENTES
// ─────────────────────────────────────────────────────────────
function TabPacientes({ optica, pacientes, refresh, handleSendWhatsApp, onEdit, onCreate }) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? pacientes.filter(p => {
        const q = search.toLowerCase();
        return (p.nombre?.toLowerCase().includes(q)) ||
               (p.rut?.toLowerCase().includes(q)) ||
               (p.telefono?.includes(q));
      })
    : pacientes;

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Base de Datos de Pacientes</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
            {filtered.length !== pacientes.length ? `${filtered.length} de ${pacientes.length} mostrados` : `${pacientes.length} registrados`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, maxWidth: 340 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre, RUT o teléfono..."
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "8px 14px", borderRadius: 8, outline: "none", fontSize: 13 }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
          )}
        </div>
        <button onClick={onCreate} style={{
          background: C.primary, color: "#000", border: "none", borderRadius: 6,
          padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}>+ Nuevo Paciente</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: `${C.surfaceL}80` }}>
              {["Paciente", "Contacto", "Receta", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="5" style={{ padding: "40px", textAlign: "center", color: C.textDim, fontSize: 13 }}>
                {search ? `Sin resultados para "${search}"` : "Aún no hay pacientes. Agrega el primero arriba o captúralos automáticamente desde WhatsApp."}
              </td></tr>
            )}
            {filtered.map(p => {
              const dias = p.fecha_ultima_visita
                ? Math.floor((Date.now() - new Date(p.fecha_ultima_visita).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const estado = dias === null ? "sin_datos" : dias > 365 ? "vencida" : dias > 335 ? "proxima" : "vigente";
              const estadoColor = estado === "vencida" ? C.red : estado === "proxima" ? C.amber : estado === "vigente" ? C.green : C.textMuted;
              const estadoLabel = estado === "vencida" ? `Vencida (${dias}d)` : estado === "proxima" ? `Próxima (${365 - dias}d)` : estado === "vigente" ? "Vigente" : "Sin receta";

              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onClick={() => onEdit(p)}
                  onMouseEnter={e => e.currentTarget.style.background = `${C.surfaceL}40`}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{p.nombre || "Sin nombre"}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>RUT: {p.rut || "—"}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, color: C.text }}>{p.telefono || "—"}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Visita: {p.fecha_ultima_visita || "—"}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Pill label={estadoLabel} color={estadoColor} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Pill
                      label={p.estado_compra || "Pendiente"}
                      color={p.estado_compra === "Compró" ? C.green : p.estado_compra === "No Compró" ? C.red : C.textMuted}
                    />
                    {p.monto_venta && <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginTop: 2 }}>${Number(p.monto_venta).toLocaleString("es-CL")}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(p); }}
                      style={{ background: "rgba(37, 211, 102, 0.15)", border: `1px solid #25D36640`, color: "#25D366", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                    >📱 WhatsApp</button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                      style={{ background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}40`, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                    >✏️ Editar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVA CITA MANUAL
// ─────────────────────────────────────────────────────────────
function CitaModal({ opticaId, pacientes, onClose, refresh }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    nombre: "", telefono: "", servicio: "",
    fecha: today, hora: "10:00", notas: "",
    estado: "confirmada",
  });
  const [saving, setSaving] = useState(false);
  const [selectedPacienteId, setSelectedPacienteId] = useState("");

  const handlePacienteSelect = (e) => {
    const id = e.target.value;
    setSelectedPacienteId(id);
    if (id) {
      const p = pacientes.find(p => String(p.id) === id);
      if (p) setForm(prev => ({ ...prev, nombre: p.nombre || "", telefono: p.telefono || "" }));
    }
  };

  const save = async () => {
    if (!form.nombre) { alert("El nombre del paciente es obligatorio"); return; }
    if (!form.fecha) { alert("La fecha es obligatoria"); return; }
    setSaving(true);
    const { error } = await supabase.from("citas").insert([{
      optica_id: opticaId,
      paciente_id: selectedPacienteId || null,
      nombre: form.nombre,
      telefono: form.telefono,
      servicio: form.servicio,
      fecha: form.fecha,
      hora: form.hora,
      notas: form.notas,
      estado: form.estado,
      origen: "manual",
    }]);
    setSaving(false);
    if (error) { alert("Error al guardar: " + error.message); }
    else { refresh(); onClose(); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, width: 480, maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>📅 Nueva Cita Manual</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textDim, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {pacientes.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 6 }}>
                Paciente existente (opcional)
              </label>
              <select value={selectedPacienteId} onChange={handlePacienteSelect}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: selectedPacienteId ? C.text : C.textMuted, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }}>
                <option value="">— O ingresar nombre manualmente abajo —</option>
                {pacientes.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.nombre}{p.rut ? ` · ${p.rut}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input placeholder="Nombre del paciente *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="+569..." value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <input placeholder="Servicio (ej: Examen visual, Lentes de contacto...)" value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>Fecha *</div>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>Hora</div>
              <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 6 }}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }}>
              <option value="confirmada">Confirmada</option>
              <option value="pendiente_confirmacion">Pendiente confirmación</option>
            </select>
          </div>

          <textarea placeholder="Notas adicionales" rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13, fontFamily: "inherit", resize: "none" }} />
        </div>

        <div style={{ padding: 24, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose}
            style={{ background: "transparent", color: C.text, border: `1px solid ${C.border}`, padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            style={{ background: C.primary, color: "#000", border: "none", padding: "10px 22px", borderRadius: 8, cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "📅 Agendar Cita"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: CITAS
// ─────────────────────────────────────────────────────────────
function TabCitas({ citas, refresh, optica, pacientes }) {
  const [showModal, setShowModal] = useState(false);

  const updateCita = async (id, estado) => {
    await supabase.from("citas").update({ estado }).eq("id", id);
    refresh();
  };

  return (
    <>
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Agenda de Citas</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
              {citas.filter(c => c.estado === "pendiente_confirmacion").length} pendientes de confirmar
            </div>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            background: C.primary, color: "#000", border: "none", borderRadius: 6,
            padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>+ Nueva Cita</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: `${C.surfaceL}80` }}>
                {["Paciente", "Servicio", "Fecha y hora", "Origen", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {citas.length === 0 && (
                <tr><td colSpan="6" style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 13 }}>
                  No hay citas agendadas. Usa "+ Nueva Cita" para agregar una manualmente.
                </td></tr>
              )}
              {citas.map(c => {
                const estadoColor = c.estado === "confirmada" ? C.green
                  : c.estado === "cancelada" ? C.red
                  : c.estado === "completada" ? C.blue
                  : C.amber;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{c.nombre || `Paciente #${c.paciente_id}`}</div>
                      {c.telefono && <div style={{ fontSize: 11, color: C.textDim }}>{c.telefono}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text }}>{c.servicio || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text }}>{c.fecha} {c.hora && `· ${c.hora}`}</td>
                    <td style={{ padding: "12px 16px" }}><Pill label={c.origen || "manual"} color={C.blue} /></td>
                    <td style={{ padding: "12px 16px" }}><Pill label={c.estado} color={estadoColor} /></td>
                    <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                      {c.estado === "pendiente_confirmacion" && (
                        <button onClick={() => updateCita(c.id, "confirmada")}
                          style={{ background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          ✓ Confirmar
                        </button>
                      )}
                      <button onClick={() => updateCita(c.id, "cancelada")}
                        style={{ background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}40`, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {showModal && (
        <CitaModal
          opticaId={optica?.id}
          pacientes={pacientes || []}
          onClose={() => setShowModal(false)}
          refresh={refresh}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────
function TabConfiguracion({ optica, refresh }) {
  const [edit, setEdit] = useState(optica);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setEdit(optica); }, [optica]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("opticas")
      .update({
        nombre: edit.nombre, slogan: edit.slogan,
        direccion: edit.direccion, ciudad: edit.ciudad,
        telefono: edit.telefono, whatsapp: edit.whatsapp,
        horario: edit.horario, numero_escalada: edit.numero_escalada,
        bot_nombre: edit.bot_nombre,
        promocion_estrella: edit.promocion_estrella,
        servicios: edit.servicios, escalar_si: edit.escalar_si,
      })
      .eq("id", optica.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      refresh();
      setTimeout(() => setSaved(false), 2500);
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const updateServicio = (idx, key, value) => {
    const newServicios = [...(edit.servicios || [])];
    newServicios[idx] = { ...newServicios[idx], [key]: value };
    setEdit({ ...edit, servicios: newServicios });
  };
  const addServicio = () => setEdit({ ...edit, servicios: [...(edit.servicios || []), { nombre: "", precio: "" }] });
  const removeServicio = (idx) => setEdit({ ...edit, servicios: edit.servicios.filter((_, i) => i !== idx) });

  const Field = ({ label, value, onChange, ph }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={ph}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
    </div>
  );

  return (
    <Card>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>⚙️ Configuración de la Óptica</h3>
        <p style={{ fontSize: 13, color: C.textDim }}>Estos datos los usa el bot Aukén automáticamente en cada conversación.</p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <Field label="Nombre comercial" value={edit.nombre} onChange={v => setEdit({ ...edit, nombre: v })} ph="Óptica Glow Vision" />
          <Field label="Slogan" value={edit.slogan} onChange={v => setEdit({ ...edit, slogan: v })} ph="calidad que inspira" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <Field label="Dirección" value={edit.direccion} onChange={v => setEdit({ ...edit, direccion: v })} ph="Caupolicán #763" />
          <Field label="Ciudad" value={edit.ciudad} onChange={v => setEdit({ ...edit, ciudad: v })} ph="Punitaqui" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Teléfono general" value={edit.telefono} onChange={v => setEdit({ ...edit, telefono: v })} ph="+56 9 5493 2802" />
          <Field label="WhatsApp escalada (dueño)" value={edit.numero_escalada} onChange={v => setEdit({ ...edit, numero_escalada: v })} ph="+56954932802" />
        </div>

        <Field label="Horario de atención" value={edit.horario} onChange={v => setEdit({ ...edit, horario: v })} ph="Lunes a Viernes 11:30 a 18:30" />

        <Field label="Promoción estrella" value={edit.promocion_estrella} onChange={v => setEdit({ ...edit, promocion_estrella: v })} ph="Examen visual GRATIS al comprar tus lentes" />

        <Field label="Nombre del bot" value={edit.bot_nombre} onChange={v => setEdit({ ...edit, bot_nombre: v })} ph="Aukén" />

        {/* SERVICIOS */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>
            Servicios y precios
          </label>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {(edit.servicios || []).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input value={s.nombre || ""} onChange={(e) => updateServicio(i, "nombre", e.target.value)} placeholder="Nombre del servicio"
                  style={{ flex: 2, background: C.surfaceL, border: `1px solid ${C.border}`, color: C.text, padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none" }} />
                <input value={s.precio || ""} onChange={(e) => updateServicio(i, "precio", e.target.value)} placeholder="$45.000"
                  style={{ flex: 1, background: C.surfaceL, border: `1px solid ${C.border}`, color: C.text, padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none" }} />
                <button onClick={() => removeServicio(i)}
                  style={{ background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}40`, padding: "0 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            ))}
            <button onClick={addServicio}
              style={{ background: `${C.primary}15`, color: C.primary, border: `1px dashed ${C.primary}50`, padding: "8px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              + Agregar servicio
            </button>
          </div>
        </div>

        {/* GUARDAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={save} disabled={saving}
            style={{
              background: saved ? C.green : C.primary, color: "#000",
              border: "none", borderRadius: 8, padding: "12px 28px",
              fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1, transition: "all .2s",
            }}>
            {saving ? "Guardando..." : saved ? "✓ Guardado" : "💾 Guardar cambios"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVO / EDITAR PACIENTE
// ─────────────────────────────────────────────────────────────
function PatientModal({ patient, opticaId, onClose, refresh }) {
  const isNew = !patient?.id;
  const [edit, setEdit] = useState(patient || {
    nombre: "", rut: "", telefono: "", notas_clinicas: "",
    estado_compra: "Pendiente", monto_venta: "", optica_id: opticaId,
    fecha_ultima_visita: new Date().toISOString().split("T")[0],
    fecha_proximo_control: "", comuna: "", producto_actual: "",
  });
  const [scanning, setScanning] = useState(false);

  const save = async () => {
    if (!edit.nombre) { alert("El nombre es obligatorio"); return; }
    const payload = { ...edit, optica_id: opticaId };
    try {
      let res;
      if (isNew) {
        res = await supabase.from("pacientes").insert([payload]);
      } else {
        const { id, ...rest } = payload;
        res = await supabase.from("pacientes").update(rest).eq("id", id);
      }
      
      if (res.error) {
        console.error("Error Supabase:", res.error);
        alert("No se pudo guardar: " + res.error.message);
      } else {
        refresh();
        onClose();
      }
    } catch (err) {
      alert("Error inesperado: " + err.message);
    }
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar a ${edit.nombre}? Esta acción no se puede deshacer.`)) return;
    await supabase.from("pacientes").delete().eq("id", edit.id);
    refresh();
    onClose();
  };

  const scanReceta = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    try {
      // Comprimir imagen primero (se hace en el frontend)
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const MAX = 800;
          if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
          else if (height > MAX) { width *= MAX / height; height = MAX; }
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const base64Full = canvas.toDataURL("image/jpeg", 0.7);
          const base64Str = base64Full.split(",")[1];

          const res = await fetch("/api/vision", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64Str }),
          });
          const data = await res.json();
          if (data.success) {
            setEdit(prev => ({ ...prev, receta_data: data.data, receta_img_url: base64Full }));
          } else {
            alert("No se pudo leer la receta. Inténtalo con mejor luz o ingresa los datos manualmente.");
          }
          setScanning(false);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Error escaneando: " + err.message);
      setScanning(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, width: 540, maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
              {isNew ? "Nuevo Paciente" : `Editar: ${edit.nombre}`}
            </h3>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textDim, fontSize: 22, cursor: "pointer" }}>×</button>
          </div>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* OCR */}
          <label style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: scanning ? `${C.amber}20` : `${C.green}15`,
            border: `1px dashed ${scanning ? C.amber : C.green}50`,
            color: scanning ? C.amber : C.green,
            padding: 14, borderRadius: 8, cursor: scanning ? "default" : "pointer",
            fontSize: 13, fontWeight: 600,
          }}>
            {scanning ? "🔍 Analizando receta con IA..." : "📸 Escanear receta con cámara/foto"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={scanReceta} disabled={scanning} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input placeholder="Nombre completo *" value={edit.nombre || ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="RUT" value={edit.rut || ""} onChange={(e) => setEdit({ ...edit, rut: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Teléfono (+569...)" value={edit.telefono || ""} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="Comuna" value={edit.comuna || ""} onChange={(e) => setEdit({ ...edit, comuna: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <input placeholder="Producto Actual (Ej: Multifocales Blue)" value={edit.producto_actual || ""} onChange={(e) => setEdit({ ...edit, producto_actual: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>Última Visita</div>
              <input type="date" value={edit.fecha_ultima_visita || ""} onChange={(e) => setEdit({ ...edit, fecha_ultima_visita: e.target.value })}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>Próximo Control</div>
              <input type="date" value={edit.fecha_proximo_control || ""} onChange={(e) => setEdit({ ...edit, fecha_proximo_control: e.target.value })}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            </div>
          </div>

          <textarea placeholder="Notas clínicas" rows={3} value={edit.notas_clinicas || ""} onChange={(e) => setEdit({ ...edit, notas_clinicas: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13, fontFamily: "inherit", resize: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={edit.estado_compra || "Pendiente"} onChange={(e) => setEdit({ ...edit, estado_compra: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }}>
              <option>Pendiente</option><option>Compró</option><option>No Compró</option>
            </select>
            {edit.estado_compra === "Compró" && (
              <input type="number" placeholder="Monto venta $" value={edit.monto_venta || ""} onChange={(e) => setEdit({ ...edit, monto_venta: e.target.value })}
                style={{ background: C.bg, border: `1px solid ${C.green}50`, color: C.green, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 14, fontWeight: 700 }} />
            )}
          </div>

          {/* Receta */}
          {edit.receta_data && (
            <div style={{ background: `${C.border}30`, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: C.primary, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>📋 Receta detectada</div>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                <div></div>
                <div style={{ color: C.textDim, textAlign: "center" }}>Esfera</div>
                <div style={{ color: C.textDim, textAlign: "center" }}>Cilindro</div>
                <div style={{ color: C.textDim, textAlign: "center" }}>Eje</div>

                <div style={{ color: C.primary, fontWeight: 700 }}>OD</div>
                <input value={edit.receta_data?.OD?.esfera || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OD: { ...edit.receta_data?.OD, esfera: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />
                <input value={edit.receta_data?.OD?.cilindro || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OD: { ...edit.receta_data?.OD, cilindro: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />
                <input value={edit.receta_data?.OD?.eje || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OD: { ...edit.receta_data?.OD, eje: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />

                <div style={{ color: C.primary, fontWeight: 700 }}>OI</div>
                <input value={edit.receta_data?.OI?.esfera || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OI: { ...edit.receta_data?.OI, esfera: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />
                <input value={edit.receta_data?.OI?.cilindro || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OI: { ...edit.receta_data?.OI, cilindro: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />
                <input value={edit.receta_data?.OI?.eje || ""} onChange={(e) => setEdit({ ...edit, receta_data: { ...edit.receta_data, OI: { ...edit.receta_data?.OI, eje: e.target.value } } })}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 6, borderRadius: 4, textAlign: "center", outline: "none", fontSize: 11 }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 24, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            {!isNew && (
              <button onClick={remove}
                style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}40`, padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                🗑 Eliminar
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose}
              style={{ background: "transparent", color: C.text, border: `1px solid ${C.border}`, padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
            <button onClick={save}
              style={{ background: C.primary, color: "#000", border: "none", padding: "10px 22px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              💾 Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// COMPONENTE PRINCIPAL
// =============================================================
export default function AukenOpticaDashboard() {
  const navigate = useNavigate();

  // ⚠️ FIX: Todos los useState ANTES de cualquier useEffect
  const [tab, setTab] = useState("metricas");
  const [optica, setOptica] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [showPatientModal, setShowPatientModal] = useState(false);

  // Slug de la óptica (en F3 vendrá del usuario logueado)
  const OPTICA_SLUG = "glowvision";

  // Carga inicial + refresh
  const refresh = useCallback(async () => {
    try {
      const [opticaRes, pacientesRes, citasRes, statsRes] = await Promise.all([
        supabase.from("opticas").select("*").eq("slug", OPTICA_SLUG).maybeSingle(),
        supabase.from("pacientes").select("*").order("created_at", { ascending: false, nullsFirst: false }),
        supabase.from("citas").select("*").order("fecha", { ascending: true, nullsFirst: false }).limit(100),
        supabase.from("estadisticas_optica").select("*").eq("slug", OPTICA_SLUG).maybeSingle(),
      ]);

      if (opticaRes.error) throw new Error("No se cargó la óptica: " + opticaRes.error.message);
      if (!opticaRes.data) throw new Error("Óptica no encontrada. ¿Corriste la migración 002?");

      setOptica(opticaRes.data);
      setPacientes(pacientesRes.data || []);
      setCitas(citasRes.data || []);
      setStats(statsRes.data);
      setLoading(false);
    } catch (err) {
      console.error("[dashboard] Error:", err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // ✅ useEffect DESPUÉS de useState (sin TDZ)
  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh cada 10 segundos
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Title dinámico (también después de useState)
  useEffect(() => {
    if (optica) document.title = `${optica.nombre} | Aukén`;
  }, [optica?.nombre]);

  // Acción WhatsApp (definida en parent, pasada como prop)
  const handleSendWhatsApp = useCallback(async (paciente) => {
    if (!paciente?.telefono) {
      alert("Este paciente no tiene teléfono registrado.");
      return;
    }
    const msg = encodeURIComponent(
      `Hola ${paciente.nombre.split(" ")[0]} 👋, te escribimos de ${optica?.nombre || "la óptica"}.`
    );
    window.open(`https://wa.me/${paciente.telefono.replace(/\D/g, "")}?text=${msg}`, "_blank");
  }, [optica]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div>Cargando dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <Card style={{ maxWidth: 500 }} accent={C.red}>
          <h3 style={{ color: C.red, fontSize: 18, marginBottom: 12 }}>⚠️ Error al cargar el dashboard</h3>
          <p style={{ color: C.text, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>{error}</p>
          <p style={{ color: C.textDim, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Causa más probable: la migración SQL no se ejecutó. Revisa que en Supabase existan las tablas <code style={{ color: C.primary }}>opticas</code>, <code style={{ color: C.primary }}>citas</code>, <code style={{ color: C.primary }}>conversaciones</code> y <code style={{ color: C.primary }}>message_queue</code>.
          </p>
          <button onClick={() => window.location.reload()}
            style={{ background: C.primary, color: "#000", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            Reintentar
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 6px; }
      `}</style>

      {/* TOPNAV */}
      <nav style={{
        background: `${C.surface}E6`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`, padding: "0 32px",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryD})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👁️</div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18 }}>{optica?.nombre || "AUKÉN"}</span>
          <span style={{ color: C.textMuted, margin: "0 8px" }}>·</span>
          <span style={{ fontSize: 12, color: C.textDim }}>Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.green, fontWeight: 600, background: `${C.green}10`, padding: "4px 10px", borderRadius: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            Activo
          </div>
          <button onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{ padding: "24px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 24 }}>
          {[
            ["metricas", "📊 Métricas"],
            ["pacientes", `👥 Pacientes (${pacientes.length})`],
            ["citas", `📅 Citas (${citas.filter(c => c.estado === "pendiente_confirmacion").length})`],
            ["config", "⚙️ Configuración"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: tab === id ? C.surfaceL : "transparent",
              color: tab === id ? C.text : C.textDim,
              border: tab === id ? `1px solid ${C.borderGlow}` : "1px solid transparent",
              borderRadius: 8, padding: "8px 16px", fontSize: 13,
              fontWeight: tab === id ? 600 : 500, cursor: "pointer", transition: "all .2s",
            }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "metricas" && <TabMetricas optica={optica} stats={stats} />}
        {tab === "pacientes" && (
          <TabPacientes
            optica={optica} pacientes={pacientes} refresh={refresh}
            handleSendWhatsApp={handleSendWhatsApp}
            onEdit={(p) => { setEditingPatient(p); setShowPatientModal(true); }}
            onCreate={() => { setEditingPatient(null); setShowPatientModal(true); }}
          />
        )}
        {tab === "citas" && <TabCitas citas={citas} refresh={refresh} optica={optica} pacientes={pacientes} />}
        {tab === "config" && <TabConfiguracion optica={optica} refresh={refresh} />}
      </div>

      {showPatientModal && (
        <PatientModal
          patient={editingPatient}
          opticaId={optica?.id}
          onClose={() => { setShowPatientModal(false); setEditingPatient(null); }}
          refresh={refresh}
        />
      )}
    </div>
  );
}
