import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToaster } from "../components/Toaster";

// Hook responsive — detecta tamaño de pantalla
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { w, isMobile: w < 768, isTablet: w >= 768 && w < 1100 };
}

// ── Design Tokens v2 (Linear.app × Vercel Dashboard) ────────────
const C = {
  // surfaces
  bg:        '#08090C',
  surface:   '#0E1014',
  surfaceL:  '#16181D',
  surfaceXL: '#1C1F26',
  // borders
  border:    'rgba(255,255,255,0.065)',
  borderHot: 'rgba(249,115,22,0.35)',
  // text (aliases para compatibilidad con el resto del archivo)
  ink:       '#EDEEF0',
  inkMid:    '#8A8F98',
  inkFaint:  '#5C616C',
  // brand
  primary:   '#F97316',
  primaryD:  '#C2570C',
  primarySoft:'rgba(249,115,22,0.12)',
  primaryRing:'rgba(249,115,22,0.35)',
  // accent
  neon:      '#7DD3FC',
  // semantic
  green:     '#34D399',
  greenSoft: 'rgba(52,211,153,0.10)',
  amber:     '#FBBF24',
  red:       '#F87171',
  redSoft:   'rgba(248,113,113,0.10)',
  purple:    '#A78BFA',
  // typography
  fontSans:  'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  fontMono:  '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  // shape
  radius:    8,
  radiusSm:  6,
  radiusLg:  12,
  // shadow
  shadow:    '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
  shadowLg:  '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
  // motion
  ease:      'cubic-bezier(0.16, 1, 0.3, 1)',
  dur:       '160ms',
};

// ── Respuestas rápidas ────────────────────────────────────────────────────────
const QUICK_REPLIES = [
  { label: "Saludo",    text: "Hola 👋, ¿en qué puedo ayudarte hoy?" },
  { label: "Un momento", text: "Un momento por favor, revisando tu caso 🔍" },
  { label: "Confirmar cita", text: "Tu cita ha sido confirmada ✅. Te esperamos." },
  { label: "Receta",    text: "Para revisar tu receta necesito que vengas a la óptica o nos envíes una foto 📸" },
  { label: "Horario",   text: "Nuestro horario es Lun–Vie 11:30 a 18:30 hrs 🕐" },
  { label: "Gracias",   text: "Muchas gracias 😊 que tengas un excelente día." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function dateSep(ts) {
  if (!ts) return "Hoy";
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (new Date(now - 86400000).toDateString() === d.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

function diasReceta(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

// ── Micro ─────────────────────────────────────────────────────────────────────
function Dot({ color, size = 8, glow, pulse }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0 }}>
      {pulse && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.3, animation: "ping 2s infinite" }} />}
      <span style={{ position: "relative", display: "block", width: size, height: size, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 8px ${color}` : "none" }} />
    </span>
  );
}

function Tag({ label, color }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}35`,
      borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>{label}</span>
  );
}

// ── Sidebar row ───────────────────────────────────────────────────────────────
function PatientRow({ p, active, onClick, lastMsg, unread }) {
  const dias = diasReceta(p.fecha_ultima_visita);
  const recetaColor = dias === null ? C.inkFaint : dias > 365 ? C.red : dias > 335 ? C.amber : C.green;

  return (
    <div onClick={onClick} style={{
      padding: "12px 16px", cursor: "pointer", borderRadius: 10, margin: "2px 8px",
      background: active ? C.surfaceXL : "transparent",
      border: `1px solid ${active ? C.borderHot : "transparent"}`,
      transition: "all 0.15s",
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceL; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: active ? C.primary : C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nombre || "Sin nombre"}
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 1 }}>{p.telefono || "—"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: C.inkFaint, whiteSpace: "nowrap" }}>
            {lastMsg ? fmtTime(lastMsg.created_at) : ""}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {unread > 0 && (
              <span style={{ background: C.primary, color: "#000", borderRadius: 10, fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <Dot color={recetaColor} size={7} glow={active} />
          </div>
        </div>
      </div>
      {lastMsg && (
        <div style={{ fontSize: 11, color: unread > 0 ? C.inkMid : C.inkFaint, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: unread > 0 ? 600 : 400 }}>
          {lastMsg.remitente === "bot" ? "🤖 " : lastMsg.remitente === "admin" ? "↳ " : ""}
          {lastMsg.contenido}
        </div>
      )}
    </div>
  );
}

// ── Panel ficha derecho ───────────────────────────────────────────────────────
function PatientPanel({ p, onClose, onGoToDashboard }) {
  if (!p) return null;
  const dias = diasReceta(p.fecha_ultima_visita);
  const recetaColor = dias === null ? C.inkFaint : dias > 365 ? C.red : dias > 335 ? C.amber : C.green;
  const recetaLabel = dias === null ? "Sin receta" : dias > 365 ? `Vencida (${dias}d)` : dias > 335 ? `Próxima (${365 - dias}d)` : "Vigente";

  const fields = [
    ["RUT",           p.rut],
    ["Teléfono",      p.telefono],
    ["Comuna",        p.comuna],
    ["Última visita", p.fecha_ultima_visita],
    ["Próx. control", p.fecha_proximo_control],
    ["Producto",      p.producto_actual],
    ["Estado compra", p.estado_compra],
  ];

  return (
    <aside style={{ width: 270, borderLeft: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ficha Paciente</span>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.inkFaint, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", margin: "0 auto 10px",
            background: `linear-gradient(135deg, ${C.primary}90, ${C.neon}90)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: "#000",
          }}>
            {(p.nombre || "?")[0].toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{p.nombre}</div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <Tag label={recetaLabel} color={recetaColor} />
            {p.estado_compra === "Compró" && <Tag label="Cliente" color={C.green} />}
          </div>
          {p.monto_venta && (
            <div style={{ marginTop: 8, fontSize: 14, color: C.green, fontWeight: 800 }}>
              ${Number(p.monto_venta).toLocaleString("es-CL")}
            </div>
          )}
        </div>

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fields.map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: C.inkFaint, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: val ? C.ink : C.inkFaint }}>{val || "—"}</div>
            </div>
          ))}
        </div>

        {/* Receta OCR */}
        {p.receta_data && (
          <div style={{ marginTop: 14, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>📋 Receta OCR</div>
            {[["OD", p.receta_data?.OD], ["OI", p.receta_data?.OI]].map(([eye, d]) => d && (
              <div key={eye} style={{ fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.primary, fontWeight: 700 }}>{eye} </span>
                <span style={{ color: C.inkMid }}>
                  {d.esfera && `Esf ${d.esfera}`}{d.cilindro && ` · Cil ${d.cilindro}`}{d.eje && ` · Eje ${d.eje}°`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {p.notas_clinicas && (
          <div style={{ marginTop: 12, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.inkFaint, fontWeight: 700, marginBottom: 5, textTransform: "uppercase" }}>Notas clínicas</div>
            <div style={{ fontSize: 11, color: C.inkMid, lineHeight: 1.6 }}>{p.notas_clinicas}</div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 7 }}>
        <button onClick={onGoToDashboard} style={{
          background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35`,
          borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          width: "100%", textAlign: "center",
        }}>📋 Ver ficha completa</button>
        {p.telefono && (
          <button onClick={() => window.open(`https://wa.me/${p.telefono.replace(/\D/g, "")}`, "_blank")} style={{
            background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)",
            borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>📱 Abrir en WhatsApp</button>
        )}
      </div>
    </aside>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AukenOptica() {
  const navigate = useNavigate();
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const { isMobile, isTablet } = useViewport();
  const { toast } = useToaster();
  const [showSidebar, setShowSidebar] = useState(false); // móvil: drawer cerrado por defecto

  const [activeP,   setActiveP]   = useState(null);
  const [patients,  setPatients]  = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [lastMsgs,  setLastMsgs]  = useState({});
  const [unreadMap, setUnreadMap] = useState({});      // paciente_id → count
  const [seenMap,   setSeenMap]   = useState(() => {   // última marca de lectura por paciente
    try { return JSON.parse(localStorage.getItem("auken_seen") || "{}"); } catch { return {}; }
  });
  const [inputText,  setInputText]  = useState("");
  const [search,     setSearch]     = useState("");
  const [showPanel,  setShowPanel]  = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [filter,     setFilter]     = useState("all");
  const [showQuick,  setShowQuick]  = useState(false);
  const [newMsgAlert, setNewMsgAlert] = useState(null); // nombre del paciente con msg nuevo
  const [testMode,   setTestMode]   = useState(false);  // simula ser cliente, IA responde
  const [iaThinking, setIaThinking] = useState(false);
  const [creandoDemo, setCreandoDemo] = useState(false);

  // ── Carga pacientes ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const { data: pacs } = await supabase.from("pacientes").select("*").order("created_at", { ascending: false });
    if (!pacs) return;
    setPatients(pacs);
    const ids = pacs.map(p => p.id);
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("mensajes_chat").select("paciente_id, contenido, remitente, created_at")
        .in("paciente_id", ids).order("created_at", { ascending: false });
      if (msgs) {
        const lm = {}, uc = {};
        const seen = JSON.parse(localStorage.getItem("auken_seen") || "{}");
        msgs.forEach(m => {
          if (!lm[m.paciente_id]) lm[m.paciente_id] = m;
          if (m.remitente === "cliente") {
            const lastSeen = seen[m.paciente_id] ? new Date(seen[m.paciente_id]) : new Date(0);
            if (new Date(m.created_at) > lastSeen) uc[m.paciente_id] = (uc[m.paciente_id] || 0) + 1;
          }
        });
        setLastMsgs(lm);
        setUnreadMap(uc);
      }
    }
    setLoading(false);
  }, []);

  // ── Demo: crear cliente placeholder para probar el flujo de registro IA ─────
  const crearDemoCliente = useCallback(async () => {
    setCreandoDemo(true);
    try {
      // Buscar la óptica para obtener optica_id
      const { data: opticaRow } = await supabase.from("opticas")
        .select("id").eq("slug", "glowvision").maybeSingle();

      const fakePhone = `+5690000${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { data: nuevo, error } = await supabase.from("pacientes").insert({
        nombre: "Cliente Demo (sin registrar)",
        telefono: fakePhone,
        notas_clinicas: "Placeholder de prueba IA. El bot debería pedirle nombre/RUT y completar este registro automáticamente.",
        tags: ["demo-pending"],
        optica_id: opticaRow?.id,
        estado_compra: "Pendiente",
      }).select().maybeSingle();

      if (error) { alert("No se pudo crear demo: " + error.message); return; }

      // Activar el chat con este paciente + modo prueba IA
      setActiveP(nuevo);
      setTestMode(true);
      setShowPanel(false);
      setShowSidebar(false);
      toast.info("Demo iniciada", {
        sub: "Escribe como cliente — la IA pedirá tus datos y completará el registro automáticamente",
        duration: 7000,
      });
    } catch (err) {
      alert("Error creando demo: " + err.message);
    } finally {
      setCreandoDemo(false);
    }
  }, [toast]);

  // ── Carga chat ───────────────────────────────────────────────────────────────
  const loadChat = useCallback(async (pId) => {
    if (!pId) return;
    const { data } = await supabase.from("mensajes_chat").select("*").eq("paciente_id", pId).order("created_at", { ascending: true });
    setMessages(data || []);
    // Marcar como leído
    const now = new Date().toISOString();
    const updated = { ...JSON.parse(localStorage.getItem("auken_seen") || "{}"), [pId]: now };
    localStorage.setItem("auken_seen", JSON.stringify(updated));
    setSeenMap(updated);
    setUnreadMap(prev => { const n = { ...prev }; delete n[pId]; return n; });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (activeP) loadChat(activeP.id); }, [activeP, loadChat]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Real-time multi-dispositivo: mensajes + pacientes + citas ───────────────
  useEffect(() => {
    const sub = supabase.channel("auken_live")
      // Mensajes nuevos
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat" }, (payload) => {
        const m = payload.new;
        setLastMsgs(prev => ({ ...prev, [m.paciente_id]: m }));
        if (activeP && m.paciente_id === activeP.id) {
          setMessages(prev => [...prev, m]);
        } else if (m.remitente === "cliente") {
          setUnreadMap(prev => ({ ...prev, [m.paciente_id]: (prev[m.paciente_id] || 0) + 1 }));
          // Alerta visual + toast notificación
          setPatients(prev => {
            const p = prev.find(x => x.id === m.paciente_id);
            if (p) {
              setNewMsgAlert(p.nombre || "Paciente");
              toast.chat("Nuevo mensaje", {
                sub: `${p.nombre}: ${(m.contenido || "").slice(0, 60)}${(m.contenido || "").length > 60 ? "..." : ""}`,
                action: { label: "Abrir chat", onClick: () => { setActiveP(p); setShowSidebar(false); } },
                duration: 6000,
              });
            }
            return prev;
          });
          setTimeout(() => setNewMsgAlert(null), 4000);
        } else if (m.remitente === "bot" && m.metadata?.type === "system_booking_confirmation") {
          // Notificar al operador que el bot agendó algo
          toast.cita("IA agendó una cita", {
            sub: m.contenido?.split("\n")[0]?.replace("✅ ", "") || "Nueva cita agendada por la IA",
            action: m.metadata?.calendar_url ? {
              label: "Google Calendar",
              onClick: () => window.open(m.metadata.calendar_url, "_blank"),
            } : undefined,
            duration: 10000,
          });
        }
      })
      // Pacientes (INSERT/UPDATE/DELETE) — sincroniza entre notebooks
      .on("postgres_changes", { event: "*", schema: "public", table: "pacientes" }, () => {
        refresh();
      })
      // Citas (cuando bot IA agenda automáticamente desde otro dispositivo)
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => {
        // El monitor no muestra citas, pero el dashboard sí; el evento queda registrado.
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeP, refresh]);

  // ── Enviar ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || !activeP || sending) return;
    const text = inputText.trim();
    setSending(true);

    if (testMode) {
      // 🧪 Modo prueba: el operador simula al cliente → Claude responde
      const { error: e1 } = await supabase.from("mensajes_chat").insert([{
        paciente_id: activeP.id, remitente: "cliente", contenido: text,
      }]);
      if (e1) { alert("Error guardando mensaje: " + e1.message); setSending(false); return; }
      setInputText("");
      await loadChat(activeP.id);

      // Llamar a Claude
      setIaThinking(true);
      try {
        const history = [...messages, { remitente: "cliente", contenido: text }]
          .filter(m => m.remitente !== "admin")
          .map(m => ({
            role: m.remitente === "cliente" ? "user" : "assistant",
            content: m.contenido,
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            pacienteId: activeP.id,
            phone: activeP.telefono || "test-dashboard",
            canal: "dashboard-test",
            opticaSlug: "glowvision",
          }),
        });
        const data = await res.json();
        const reply = data?.content?.[0]?.text || "Disculpa, no pude responder en este momento.";

        await supabase.from("mensajes_chat").insert([{
          paciente_id: activeP.id, remitente: "bot", contenido: reply,
        }]);
        await loadChat(activeP.id);
      } catch (err) {
        await supabase.from("mensajes_chat").insert([{
          paciente_id: activeP.id, remitente: "bot",
          contenido: "⚠️ Error técnico: no pude conectar con la IA. Verifica ANTHROPIC_API_KEY en Vercel.",
        }]);
        await loadChat(activeP.id);
      }
      setIaThinking(false);
      setSending(false);
    } else {
      // Modo normal: operador responde como humano
      const { error } = await supabase.from("mensajes_chat").insert([{
        paciente_id: activeP.id, remitente: "admin", contenido: text,
      }]);
      setSending(false);
      if (!error) { setInputText(""); loadChat(activeP.id); }
    }
  };

  const applyQuickReply = (text) => {
    setInputText(text);
    setShowQuick(false);
    inputRef.current?.focus();
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    if (q && !p.nombre?.toLowerCase().includes(q) && !p.telefono?.includes(q)) return false;
    if (filter === "active")  return !!lastMsgs[p.id];
    if (filter === "unread")  return (unreadMap[p.id] || 0) > 0;
    if (filter === "receta") {
      const d = diasReceta(p.fecha_ultima_visita);
      return d !== null && d > 335;
    }
    return true;
  });

  // ── Grupos de mensajes ───────────────────────────────────────────────────────
  const grouped = messages.reduce((acc, m) => {
    const sep = dateSep(m.created_at);
    if (!acc.length || acc[acc.length - 1].sep !== sep) acc.push({ sep, msgs: [m] });
    else acc[acc.length - 1].msgs.push(m);
    return acc;
  }, []);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.15em", marginBottom: 20 }}>AUKÉN</div>
      <div style={{ width: 100, height: 2, background: C.border, borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", width: "40%", height: "100%", background: C.primary, borderRadius: 2, animation: "ldg 1.2s infinite ease-in-out" }} />
      </div>
      <style>{`@keyframes ldg { 0%{left:-40%} 100%{left:140%} }`}</style>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, height: "100vh", color: C.ink, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes ping{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.5);opacity:0}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── TOAST nueva msg ─────────────────────────────────────────────── */}
      {newMsgAlert && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 999,
          background: C.surfaceXL, border: `1px solid ${C.primaryRing}`,
          borderRadius: C.radiusLg, padding: "12px 18px", boxShadow: C.shadowLg,
          animation: "slideIn 0.3s ease-out", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <div>
            <div style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>Nuevo mensaje</div>
            <div style={{ fontSize: 12, color: C.ink }}>{newMsgAlert}</div>
          </div>
        </div>
      )}

      {/* ── TOP NAV ─────────────────────────────────────────────────────── */}
      <nav style={{
        height: 48, borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", flexShrink: 0, zIndex: 50,
        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && (
            <button onClick={() => setShowSidebar(v => !v)} aria-label="Abrir lista"
              style={{ background: "transparent", border: "none", color: C.ink, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
              ☰
            </button>
          )}
          <div style={{ width: 26, height: 26, background: `linear-gradient(135deg, ${C.primary}, ${C.neon})`, borderRadius: C.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, boxShadow: `0 0 10px ${C.primarySoft}` }}>👁️</div>
          <span style={{ fontFamily: C.fontSans, fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>Monitor</span>
          <span style={{ color: C.inkFaint }}>·</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.green }}>
            <Dot color={C.green} size={6} glow pulse />
            <span style={{ fontWeight: 600 }}>EN VIVO</span>
          </div>
          {totalUnread > 0 && (
            <span style={{ background: C.red, color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "2px 6px", marginLeft: 4 }}>
              {totalUnread} sin leer
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => navigate("/optica/dashboard")}
            style={{ background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}30`, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            📊 Dashboard
          </button>
          <button onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.inkFaint, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </nav>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Overlay para cerrar drawer en móvil */}
        {isMobile && showSidebar && (
          <div onClick={() => setShowSidebar(false)} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 30, backdropFilter: "blur(4px)",
          }} />
        )}

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside style={{
          width: isMobile ? 280 : 290,
          borderRight: `1px solid ${C.border}`,
          background: C.surface,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile ? {
            position: "absolute",
            top: 0, bottom: 0, left: 0,
            zIndex: 40,
            transform: showSidebar ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s ease",
            boxShadow: showSidebar ? "8px 0 32px rgba(0,0,0,.6)" : "none",
          } : {}),
        }}>
          {/* Buscador */}
          <div style={{ padding: "10px 10px 6px" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.inkFaint, pointerEvents: "none" }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                style={{ width: "100%", background: C.surfaceL, border: `1px solid ${C.border}`, color: C.ink, padding: "7px 10px 7px 28px", borderRadius: 8, outline: "none", fontSize: 12 }} />
            </div>
          </div>

          {/* Botón demo: simular cliente desconocido */}
          <div style={{ padding: "0 10px 8px" }}>
            <button onClick={crearDemoCliente} disabled={creandoDemo} style={{
              width: "100%",
              background: `linear-gradient(135deg, ${C.purple}25, ${C.neon}25)`,
              border: `1px dashed ${C.purple}60`,
              color: C.purple,
              padding: "8px 12px", borderRadius: 8,
              fontSize: 11, fontWeight: 700, cursor: creandoDemo ? "default" : "pointer",
              opacity: creandoDemo ? 0.6 : 1, transition: "all 0.15s",
            }}
            title="Crea un paciente placeholder para probar el flujo de registro automático de la IA">
              {creandoDemo ? "Creando…" : "🎭 + Demo cliente nuevo"}
            </button>
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 4, padding: "0 10px 8px" }}>
            {[["all","Todos"],["unread",`Sin leer${totalUnread>0?" ("+totalUnread+")":""}`],["active","Con chat"],["receta","Receta ⚠️"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                flex: 1, fontSize: 9, fontWeight: 700, padding: "4px 2px", borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap",
                background: filter === val ? C.primary : C.surfaceL,
                color: filter === val ? "#000" : C.inkFaint,
                border: `1px solid ${filter === val ? C.primary : C.border}`,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ padding: "0 18px 6px", fontSize: 10, color: C.inkFaint, fontWeight: 600 }}>
            {filtered.length} canal{filtered.length !== 1 ? "es" : ""}
          </div>

          {/* Lista */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "32px 20px", textAlign: "center", color: C.inkFaint, fontSize: 12 }}>
                {search ? `Sin resultados` : "Sin pacientes aún."}
              </div>
            )}
            {filtered.map(p => (
              <PatientRow key={p.id} p={p} active={activeP?.id === p.id}
                lastMsg={lastMsgs[p.id]} unread={unreadMap[p.id] || 0}
                onClick={() => { setActiveP(p); setShowPanel(!isMobile); setShowSidebar(false); }}
              />
            ))}
          </div>

          {/* Footer stats */}
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 14 }}>
            {[[patients.length,"pacientes",C.inkFaint],[Object.keys(lastMsgs).length,"con chat",C.neon],[totalUnread,"sin leer",totalUnread>0?C.red:C.inkFaint]].map(([n,l,col])=>(
              <div key={l}>
                <div style={{ fontSize: 15, fontWeight: 700, color: col, fontFamily: "'Outfit', sans-serif" }}>{n}</div>
                <div style={{ fontSize: 9, color: C.inkFaint }}>{l}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── CHAT ────────────────────────────────────────────────────── */}
        <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "radial-gradient(ellipse at 55% 15%, #12182A 0%, #05060A 65%)" }}>
          {activeP ? (
            <>
              {/* Header */}
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: `${C.surface}80` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}70, ${C.neon}70)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: C.ink, flexShrink: 0 }}>
                    {(activeP.nombre || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{activeP.nombre}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: C.neon, fontWeight: 700, letterSpacing: "0.06em" }}>
                        <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: C.neon, marginRight: 4, animation: "blink 2s infinite" }} />
                        IA ACTIVA
                      </span>
                      <span style={{ fontSize: 10, color: C.inkFaint }}>{activeP.telefono}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => refresh().then(() => loadChat(activeP.id))}
                    style={{ background: C.surfaceL, border: `1px solid ${C.border}`, color: C.inkMid, padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    ↻
                  </button>
                  <button onClick={() => setTestMode(v => !v)}
                    style={{
                      background: testMode ? `linear-gradient(135deg, ${C.purple}, ${C.neon})` : C.surfaceL,
                      border: `1px solid ${testMode ? C.purple : C.border}`,
                      color: testMode ? "#000" : C.inkMid,
                      padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 700,
                      boxShadow: testMode ? `0 0 12px ${C.purple}40` : "none",
                    }}>
                    🧪 {testMode ? "Modo Prueba ON" : "Probar IA"}
                  </button>
                  <button onClick={() => setShowQuick(v => !v)}
                    style={{ background: showQuick ? `${C.amber}20` : C.surfaceL, border: `1px solid ${showQuick ? C.amber + "50" : C.border}`, color: showQuick ? C.amber : C.inkMid, padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    ⚡ Rápidas
                  </button>
                  <button onClick={() => setShowPanel(v => !v)}
                    style={{ background: showPanel ? `${C.primary}20` : C.surfaceL, border: `1px solid ${showPanel ? C.primary + "40" : C.border}`, color: showPanel ? C.primary : C.inkMid, padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    👤 Ficha
                  </button>
                </div>
              </div>

              {/* Banner Modo Prueba */}
              {testMode && (
                <div style={{
                  padding: "8px 18px", background: `linear-gradient(135deg, ${C.purple}15, ${C.neon}10)`,
                  borderBottom: `1px solid ${C.purple}30`, display: "flex", alignItems: "center", gap: 10,
                  fontSize: 11, color: C.purple, fontWeight: 600, animation: "slideIn 0.2s ease-out",
                }}>
                  <span style={{ fontSize: 13 }}>🧪</span>
                  <span>Modo Prueba: tus mensajes se enviarán como si fueras el cliente. Claude IA responderá automáticamente.</span>
                </div>
              )}

              {/* Respuestas rápidas expandible */}
              {showQuick && (
                <div style={{ padding: "8px 16px", borderBottom: `1px solid ${C.border}`, background: `${C.surfaceL}90`, display: "flex", gap: 6, flexWrap: "wrap", animation: "slideIn 0.2s ease-out" }}>
                  {QUICK_REPLIES.map(r => (
                    <button key={r.label} onClick={() => applyQuickReply(r.text)} style={{
                      background: `${C.amber}12`, color: C.amber, border: `1px solid ${C.amber}30`,
                      borderRadius: 16, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Mensajes */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.inkFaint, gap: 10 }}>
                    <div style={{ fontSize: 40, opacity: 0.15 }}>💬</div>
                    <div style={{ fontSize: 12, opacity: 0.4 }}>Sin mensajes con este paciente</div>
                  </div>
                )}

                {iaThinking && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: `${C.neon}10`, border: `1px solid ${C.neon}30`, borderRadius: 12, alignSelf: "flex-start", marginBottom: 10, animation: "fadeUp 0.2s" }}>
                    <span style={{ fontSize: 11, color: C.neon, fontWeight: 700 }}>🤖 Aukén IA está pensando</span>
                    <span style={{ display: "flex", gap: 3 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.neon, animation: `blink 1.4s infinite ${i * 0.2}s` }} />
                      ))}
                    </span>
                  </div>
                )}

                {grouped.map(({ sep, msgs }) => (
                  <div key={sep}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 10px" }}>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                      <span style={{ fontSize: 10, color: C.inkFaint, padding: "2px 10px", background: C.surfaceL, borderRadius: 10, border: `1px solid ${C.border}`, fontWeight: 600 }}>{sep}</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                    </div>
                    {msgs.map((m, i) => {
                      const isClient = m.remitente === "cliente";
                      const isBot    = m.remitente === "bot";
                      const isAdmin  = m.remitente === "admin";
                      const isRight  = isBot || isAdmin;
                      return (
                        <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: isRight ? "flex-end" : "flex-start", marginBottom: 10, animation: "fadeUp 0.2s ease-out" }}>
                          {isBot   && <span style={{ fontSize: 9, color: C.neon,   fontWeight: 700, marginBottom: 3, marginRight: 4 }}>🤖 AUKÉN IA</span>}
                          {isAdmin && <span style={{ fontSize: 9, color: C.primary, fontWeight: 700, marginBottom: 3, marginRight: 4 }}>👤 OPERADOR</span>}
                          <div style={{
                            maxWidth: "68%",
                            background: isClient
                              ? C.surfaceXL
                              : isBot
                                ? `linear-gradient(135deg, ${C.neon}20, ${C.purple}20)`
                                : `linear-gradient(135deg, ${C.primary}, ${C.primaryD})`,
                            color: isAdmin ? "#000" : C.ink,
                            padding: "10px 14px",
                            borderRadius: isClient ? "4px 14px 14px 14px" : "14px 14px 4px 14px",
                            fontSize: 13, lineHeight: 1.55,
                            border: (isClient || isBot) ? `1px solid ${C.border}` : "none",
                            boxShadow: isAdmin ? `0 4px 12px ${C.primary}25` : "none",
                          }}>
                            {m.contenido}
                          </div>
                          <span style={{ fontSize: 9, color: C.inkFaint, marginTop: 3, [isRight ? "marginRight" : "marginLeft"]: 4 }}>
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
              <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,.3)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, background: C.surfaceL, borderRadius: 12, padding: "6px 6px 6px 14px", border: `1px solid ${C.border}` }}>
                  <input ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={testMode ? "Escribe como cliente para probar la IA..." : "Responder como operador..."}
                    style={{ flex: 1, background: "transparent", border: "none", color: C.ink, outline: "none", fontSize: 13 }}
                  />
                  <button onClick={handleSend} disabled={!inputText.trim() || sending} style={{
                    background: inputText.trim()
                      ? testMode
                        ? `linear-gradient(135deg, ${C.purple}, ${C.neon})`
                        : `linear-gradient(135deg, ${C.primary}, ${C.primaryD})`
                      : C.surfaceXL,
                    color: inputText.trim() ? "#000" : C.inkFaint,
                    border: "none", borderRadius: 8, padding: "7px 18px",
                    fontWeight: 700, fontSize: 12, cursor: inputText.trim() ? "pointer" : "default", transition: "all .15s", flexShrink: 0,
                  }}>
                    {sending ? "…" : testMode ? "▶ Probar" : "Enviar"}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 5, paddingLeft: 2 }}>
                  {testMode
                    ? "🧪 Modo Prueba activo — Claude IA responderá según el system prompt configurado"
                    : "Enter para enviar · ⚡ para respuestas predefinidas · 🧪 para probar la IA"}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.inkFaint }}>
              <div style={{ fontSize: 52, opacity: 0.1 }}>💬</div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.35, letterSpacing: "0.1em", textTransform: "uppercase" }}>Selecciona un canal</div>
              {totalUnread > 0 && (
                <div style={{ marginTop: 8, background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 8, padding: "8px 16px", fontSize: 12, color: C.red, fontWeight: 600 }}>
                  {totalUnread} mensaje{totalUnread !== 1 ? "s" : ""} sin leer
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── FICHA ────────────────────────────────────────────────────── */}
        {activeP && showPanel && isMobile && (
          <div onClick={() => setShowPanel(false)} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 30, backdropFilter: "blur(4px)",
          }} />
        )}
        {activeP && showPanel && (
          <div style={isMobile ? {
            position: "absolute", top: 0, bottom: 0, right: 0, zIndex: 40,
            boxShadow: "-8px 0 32px rgba(0,0,0,.6)", animation: "slideInRight 0.25s ease",
          } : {}}>
            <PatientPanel
              p={activeP}
              onClose={() => setShowPanel(false)}
              onGoToDashboard={() => navigate("/optica/dashboard")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
