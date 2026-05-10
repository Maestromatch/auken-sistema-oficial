import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  bg:          "#05060A",
  surface:     "#0E1018",
  surfaceL:    "#161923",
  surfaceXL:   "#1E2330",
  border:      "rgba(255,255,255,0.07)",
  borderHot:   "rgba(251,146,60,0.35)",
  ink:         "#F1F5F9",
  inkMid:      "#94A3B8",
  inkFaint:    "#475569",
  primary:     "#FB923C",
  primaryD:    "#F97316",
  neon:        "#7DD3FC",
  green:       "#10B981",
  amber:       "#F59E0B",
  red:         "#F43F5E",
  purple:      "#A78BFA",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function dateSep(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYest  = new Date(now - 86400000).toDateString() === d.toDateString();
  if (isToday) return "Hoy";
  if (isYest)  return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

function diasReceta(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

// ─── micro componentes ────────────────────────────────────────────────────────
function Dot({ color, size = 8, glow }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: glow ? `0 0 8px ${color}` : "none",
    }} />
  );
}

function Tag({ label, color }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}35`,
      borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.03em",
    }}>{label}</span>
  );
}

// ─── SIDEBAR ITEM ─────────────────────────────────────────────────────────────
function PatientRow({ p, active, onClick, lastMsg }) {
  const dias = diasReceta(p.fecha_ultima_visita);
  const recetaColor = dias === null ? C.inkFaint : dias > 365 ? C.red : dias > 335 ? C.amber : C.green;

  return (
    <div onClick={onClick} style={{
      padding: "14px 18px", cursor: "pointer", borderRadius: 10, margin: "2px 8px",
      transition: "all 0.15s",
      background: active ? C.surfaceXL : "transparent",
      border: `1px solid ${active ? C.borderHot : "transparent"}`,
      boxShadow: active ? "0 4px 16px rgba(0,0,0,.4)" : "none",
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceL; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: active ? C.primary : C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nombre || "Sin nombre"}
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 2 }}>{p.telefono || "—"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: C.inkFaint }}>
            {p.ultima_interaccion_at ? fmtTime(p.ultima_interaccion_at) : ""}
          </span>
          <Dot color={recetaColor} size={7} glow={active} />
        </div>
      </div>
      {lastMsg && (
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lastMsg.remitente === "bot" ? "🤖 " : lastMsg.remitente === "admin" ? "↳ " : ""}{lastMsg.contenido}
        </div>
      )}
    </div>
  );
}

// ─── PATIENT PANEL (derecho) ──────────────────────────────────────────────────
function PatientPanel({ p, onClose, onGoToDashboard }) {
  if (!p) return null;
  const dias = diasReceta(p.fecha_ultima_visita);
  const recetaColor = dias === null ? C.inkFaint : dias > 365 ? C.red : dias > 335 ? C.amber : C.green;
  const recetaLabel = dias === null ? "Sin receta" : dias > 365 ? `Vencida (${dias}d)` : dias > 335 ? `Próxima (${365 - dias}d)` : "Vigente";

  const rows = [
    ["RUT",            p.rut           || "—"],
    ["Teléfono",       p.telefono      || "—"],
    ["Comuna",         p.comuna        || "—"],
    ["Última visita",  p.fecha_ultima_visita || "—"],
    ["Próx. control",  p.fecha_proximo_control || "—"],
    ["Producto",       p.producto_actual || "—"],
    ["Estado compra",  p.estado_compra || "—"],
  ];

  return (
    <aside style={{
      width: 280, borderLeft: `1px solid ${C.border}`,
      background: C.surface, display: "flex", flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ficha Paciente</div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.inkFaint, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
        {/* Avatar + nombre */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}, ${C.neon})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, color: "#000", marginBottom: 12,
          }}>
            {(p.nombre || "?")[0].toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, textAlign: "center" }}>{p.nombre}</div>
          <div style={{ marginTop: 8 }}><Tag label={recetaLabel} color={recetaColor} /></div>
          {p.monto_venta && (
            <div style={{ marginTop: 6, fontSize: 13, color: C.green, fontWeight: 700 }}>
              ${Number(p.monto_venta).toLocaleString("es-CL")} CLP
            </div>
          )}
        </div>

        {/* Datos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: C.inkFaint, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: val === "—" ? C.inkFaint : C.ink }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Receta detalle */}
        {p.receta_data && (
          <div style={{ marginTop: 16, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Receta OCR</div>
            {[["OD", p.receta_data?.OD], ["OI", p.receta_data?.OI]].map(([eye, data]) => data && (
              <div key={eye} style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: C.primary, fontWeight: 700 }}>{eye}</span>
                <span style={{ fontSize: 11, color: C.inkMid, marginLeft: 6 }}>
                  {data.esfera && `Esf ${data.esfera}`}
                  {data.cilindro && ` · Cil ${data.cilindro}`}
                  {data.eje && ` · Eje ${data.eje}°`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {p.notas_clinicas && (
          <div style={{ marginTop: 16, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.inkFaint, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Notas clínicas</div>
            <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{p.notas_clinicas}</div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onGoToDashboard} style={{
          background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35`,
          borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center",
        }}>
          📋 Ver en Dashboard
        </button>
        {p.telefono && (
          <button onClick={() => window.open(`https://wa.me/${p.telefono.replace(/\D/g,"")}`, "_blank")} style={{
            background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)",
            borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center",
          }}>
            📱 Abrir en WhatsApp
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function AukenOptica() {
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const [activeP,    setActiveP]    = useState(null);
  const [patients,   setPatients]   = useState([]);
  const [messages,   setMessages]   = useState([]);
  const [lastMsgs,   setLastMsgs]   = useState({});
  const [inputText,  setInputText]  = useState("");
  const [search,     setSearch]     = useState("");
  const [showPanel,  setShowPanel]  = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [filter,     setFilter]     = useState("all"); // all | active | receta

  // ── Carga pacientes ──────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const { data: pacs } = await supabase.from("pacientes").select("*").order("created_at", { ascending: false });
    if (!pacs) return;
    setPatients(pacs);

    // Última interacción por paciente (primer mensaje descendente)
    const ids = pacs.map(p => p.id);
    if (ids.length > 0) {
      const { data: msgs } = await supabase
        .from("mensajes_chat").select("paciente_id, contenido, remitente, created_at")
        .in("paciente_id", ids).order("created_at", { ascending: false });
      if (msgs) {
        const map = {};
        msgs.forEach(m => { if (!map[m.paciente_id]) map[m.paciente_id] = m; });
        setLastMsgs(map);
      }
    }
    setLoading(false);
  }, []);

  // ── Carga mensajes del paciente activo ───────────────────────────
  const loadChat = useCallback(async (pId) => {
    if (!pId) return;
    const { data } = await supabase.from("mensajes_chat").select("*").eq("paciente_id", pId).order("created_at", { ascending: true });
    setMessages(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => { if (activeP) loadChat(activeP.id); }, [activeP, loadChat]);

  // ── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Real-time mensajes nuevos ────────────────────────────────────
  useEffect(() => {
    const sub = supabase.channel("chat_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat" }, (p) => {
        if (activeP && p.new.paciente_id === activeP.id) {
          setMessages(prev => [...prev, p.new]);
        }
        setLastMsgs(prev => ({ ...prev, [p.new.paciente_id]: p.new }));
      }).subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeP]);

  // ── Enviar mensaje ───────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || !activeP || sending) return;
    setSending(true);
    const { error } = await supabase.from("mensajes_chat").insert([{
      paciente_id: activeP.id, remitente: "admin", contenido: inputText.trim(),
    }]);
    setSending(false);
    if (!error) {
      setInputText("");
      loadChat(activeP.id);
    }
  };

  // ── Filtrado ─────────────────────────────────────────────────────
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.nombre?.toLowerCase().includes(q) || p.telefono?.includes(q);
    if (!matchSearch) return false;
    if (filter === "active") return !!lastMsgs[p.id];
    if (filter === "receta") {
      const dias = diasReceta(p.fecha_ultima_visita);
      return dias !== null && dias > 335;
    }
    return true;
  });

  // ── Grupos de mensajes con separador de fecha ────────────────────
  const groupedMessages = messages.reduce((acc, m) => {
    const sep = dateSep(m.created_at);
    if (acc.length === 0 || acc[acc.length - 1].sep !== sep) {
      acc.push({ sep, messages: [m] });
    } else {
      acc[acc.length - 1].messages.push(m);
    }
    return acc;
  }, []);

  // ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.bg, color: C.primary, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 20, color: C.ink }}>AUKÉN</div>
      <div style={{ width: 120, height: 2, background: C.border, position: "relative", overflow: "hidden", borderRadius: 2 }}>
        <div style={{ position: "absolute", width: "40%", height: "100%", background: C.primary, borderRadius: 2, animation: "loading 1.2s infinite ease-in-out" }} />
      </div>
      <style>{`@keyframes loading { 0% { left:-40%; } 100% { left:140%; } }`}</style>
    </div>
  );

  return (
    <div style={{ background: C.bg, height: "100vh", color: C.ink, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink  { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
      `}</style>

      {/* ── TOP NAV ─────────────────────────────────────────────── */}
      <nav style={{
        height: 52, borderBottom: `1px solid ${C.border}`,
        background: `${C.surface}F2`, backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", flexShrink: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, background: `linear-gradient(135deg, ${C.primary}, ${C.neon})`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👁️</div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>Monitor de Conversaciones</span>
          <span style={{ color: C.inkFaint, fontSize: 12 }}>·</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.green }}>
            <Dot color={C.green} size={6} glow />
            <span style={{ fontWeight: 600 }}>EN VIVO</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate("/optica/dashboard")}
            style={{ background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}30`, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            📊 Dashboard
          </button>
          <button onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.inkFaint, borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </nav>

      {/* ── CUERPO PRINCIPAL ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────── */}
        <aside style={{ width: 300, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", background: C.surface, flexShrink: 0 }}>

          {/* Buscador */}
          <div style={{ padding: "12px 12px 8px" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.inkFaint }}>🔍</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar paciente..."
                style={{ width: "100%", background: C.surfaceL, border: `1px solid ${C.border}`, color: C.ink, padding: "8px 10px 8px 30px", borderRadius: 8, outline: "none", fontSize: 12 }}
              />
            </div>
          </div>

          {/* Filtros rápidos */}
          <div style={{ display: "flex", gap: 4, padding: "0 12px 10px" }}>
            {[["all", "Todos"], ["active", "Con chat"], ["receta", "Receta ⚠️"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                flex: 1, fontSize: 10, fontWeight: 700, padding: "4px 0", borderRadius: 5, cursor: "pointer",
                background: filter === val ? C.primary : C.surfaceL,
                color: filter === val ? "#000" : C.inkFaint,
                border: `1px solid ${filter === val ? C.primary : C.border}`,
              }}>{label}</button>
            ))}
          </div>

          {/* Contador */}
          <div style={{ padding: "0 20px 8px", fontSize: 10, color: C.inkFaint, fontWeight: 600 }}>
            {filtered.length} canal{filtered.length !== 1 ? "es" : ""}
          </div>

          {/* Lista */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: C.inkFaint, fontSize: 12 }}>
                {search ? `Sin resultados para "${search}"` : "Sin pacientes aún."}
              </div>
            )}
            {filtered.map(p => (
              <PatientRow
                key={p.id} p={p} active={activeP?.id === p.id}
                lastMsg={lastMsgs[p.id]}
                onClick={() => { setActiveP(p); setShowPanel(true); }}
              />
            ))}
          </div>

          {/* Stats footer */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 16 }}>
            {[
              [patients.length, "pacientes", C.inkFaint],
              [Object.keys(lastMsgs).length, "con chat", C.neon],
            ].map(([n, l, col]) => (
              <div key={l}>
                <div style={{ fontSize: 16, fontWeight: 700, color: col, fontFamily: "'Outfit', sans-serif" }}>{n}</div>
                <div style={{ fontSize: 9, color: C.inkFaint }}>{l}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── ÁREA DE CHAT ──────────────────────────────────────────── */}
        <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "radial-gradient(ellipse at 60% 20%, #111620 0%, #05060A 70%)" }}>
          {activeP ? (
            <>
              {/* Header chat */}
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.primary}80, ${C.neon}80)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: C.ink,
                  }}>
                    {(activeP.nombre || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{activeP.nombre}</div>
                    <div style={{ display: "flex", align: "center", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: C.neon, fontWeight: 700, letterSpacing: "0.06em" }}>
                        <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: C.neon, marginRight: 5, animation: "blink 2s infinite" }} />
                        IA ACTIVA
                      </span>
                      <span style={{ fontSize: 10, color: C.inkFaint }}>{activeP.telefono}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => refresh().then(() => loadChat(activeP.id))}
                    style={{ background: C.surfaceL, border: `1px solid ${C.border}`, color: C.inkMid, padding: "6px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    ↻ Sync
                  </button>
                  <button onClick={() => setShowPanel(v => !v)}
                    style={{ background: showPanel ? `${C.primary}20` : C.surfaceL, border: `1px solid ${showPanel ? C.primary + "40" : C.border}`, color: showPanel ? C.primary : C.inkMid, padding: "6px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    👤 Ficha
                  </button>
                </div>
              </div>

              {/* Mensajes */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.inkFaint }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>💬</div>
                    <div style={{ fontSize: 12, opacity: 0.5 }}>Sin mensajes aún con este paciente</div>
                  </div>
                )}

                {groupedMessages.map(({ sep, messages: msgs }) => (
                  <div key={sep}>
                    {/* Separador de fecha */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                      <span style={{ fontSize: 10, color: C.inkFaint, fontWeight: 600, padding: "3px 10px", background: C.surfaceL, borderRadius: 10, border: `1px solid ${C.border}` }}>{sep}</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                    </div>

                    {msgs.map((m, i) => {
                      const isBot    = m.remitente === "bot";
                      const isAdmin  = m.remitente === "admin";
                      const isClient = m.remitente === "cliente";
                      const isRight  = isBot || isAdmin;

                      return (
                        <div key={m.id || i} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: isRight ? "flex-end" : "flex-start",
                          marginBottom: 8, animation: "fadeUp 0.2s ease-out",
                        }}>
                          {/* Etiqueta remitente */}
                          {isBot && <span style={{ fontSize: 9, color: C.neon, fontWeight: 700, marginBottom: 3, marginRight: 4 }}>🤖 AUKÉN IA</span>}
                          {isAdmin && <span style={{ fontSize: 9, color: C.primary, fontWeight: 700, marginBottom: 3, marginRight: 4 }}>👤 OPERADOR</span>}

                          <div style={{
                            maxWidth: "68%",
                            background: isClient
                              ? C.surfaceL
                              : isBot
                                ? `linear-gradient(135deg, ${C.neon}22, ${C.purple}22)`
                                : `linear-gradient(135deg, ${C.primary}, ${C.primaryD})`,
                            color: (isBot || isClient) ? C.ink : "#000",
                            padding: "10px 16px",
                            borderRadius: isClient ? "4px 16px 16px 16px" : "16px 16px 4px 16px",
                            fontSize: 13, lineHeight: 1.55,
                            border: (isClient || isBot) ? `1px solid ${C.border}` : "none",
                            boxShadow: isAdmin ? `0 4px 16px ${C.primary}30` : "none",
                          }}>
                            {m.contenido}
                          </div>

                          <span style={{ fontSize: 9, color: C.inkFaint, marginTop: 4, marginLeft: 4, marginRight: 4 }}>
                            {new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,.35)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 10, background: C.surfaceL, borderRadius: 14, padding: "6px 6px 6px 16px", border: `1px solid ${C.border}` }}>
                  <input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Responder como operador humano..."
                    style={{ flex: 1, background: "transparent", border: "none", color: C.ink, outline: "none", fontSize: 13 }}
                  />
                  <button onClick={handleSend} disabled={!inputText.trim() || sending} style={{
                    background: inputText.trim() ? `linear-gradient(135deg, ${C.primary}, ${C.primaryD})` : C.surfaceXL,
                    color: inputText.trim() ? "#000" : C.inkFaint,
                    border: "none", borderRadius: 10, padding: "8px 20px",
                    fontWeight: 700, fontSize: 12, cursor: inputText.trim() ? "pointer" : "default",
                    transition: "all .15s", flexShrink: 0,
                  }}>
                    {sending ? "..." : "Enviar"}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 6, paddingLeft: 4 }}>
                  Enter para enviar · Los mensajes del bot se guardan automáticamente
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.inkFaint, gap: 12 }}>
              <div style={{ fontSize: 56, opacity: 0.15 }}>💬</div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Selecciona un canal</div>
              <div style={{ fontSize: 11, opacity: 0.3 }}>← Elige un paciente de la lista</div>
            </div>
          )}
        </section>

        {/* ── PANEL FICHA ──────────────────────────────────────────── */}
        {activeP && showPanel && (
          <PatientPanel
            p={activeP}
            onClose={() => setShowPanel(false)}
            onGoToDashboard={() => navigate("/optica/dashboard")}
          />
        )}
      </div>
    </div>
  );
}
