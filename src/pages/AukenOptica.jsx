import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToaster } from "../components/Toaster";
import Icon from "../components/Icon";
import { formatRut, formatVisit, labelMeta, sanitizeNotas } from "../lib/labels";
import { buildTenantPath, getOpticaSlugFromSearch, setStoredOpticaSlug } from "../lib/tenant";

// Hook responsive - detecta tamaño de pantalla
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { w, isMobile: w < 768, isTablet: w >= 768 && w < 1100 };
}

// -- Design Tokens v2 (Linear.app × Vercel Dashboard) ------------
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

// -- Respuestas rápidas --------------------------------------------------------
const QUICK_REPLIES = [
  { label: "Saludo",    text: "Hola , ¿en qué puedo ayudarte hoy?" },
  { label: "Un momento", text: "Un momento por favor, revisando tu caso " },
  { label: "Confirmar cita", text: "Tu cita ha sido confirmada ✓. Te esperamos." },
  { label: "Receta",    text: "Para revisar tu receta necesito que vengas a la óptica o nos envíes una foto " },
  { label: "Horario",   text: "Nuestro horario es Lun-Vie 11:30 a 18:30 hrs " },
  { label: "Gracias",   text: "Muchas gracias  que tengas un excelente día." },
];

// -- Helpers -------------------------------------------------------------------
const DASHBOARD_PATH = "/optica/dashboard";

function dashboardUrl(slug, params = {}) {
  const path = buildTenantPath(DASHBOARD_PATH, slug, params);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function goDashboard(e) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  try {
    localStorage.setItem("auken_auth", "true");
  } catch {}

  const url = dashboardUrl();
  try {
    window.location.assign(url);
  } catch {
    window.location.href = url;
  }
}

function dedupeMessages(list = []) {
  const seen = new Set();
  return list.filter((m) => {
    const key = m.id || `${m.paciente_id}-${m.remitente}-${m.created_at}-${m.contenido}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function relTime(ts) {
  if (!ts) return "";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (Number.isNaN(diff)) return "";
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "ayer";
  return new Date(ts).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function waitingSeconds(lastMsg) {
  if (!lastMsg?.created_at || lastMsg.remitente !== "cliente") return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 1000));
}

function avatarColor(name = "") {
  const palette = ["#F97316", "#34D399", "#7DD3FC", "#FBBF24", "#A78BFA", "#F472B6", "#22D3EE"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts : ["?"]).map(p => p[0]).slice(0, 2).join("").toUpperCase();
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

// -- Micro ---------------------------------------------------------------------
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
      fontFamily: C.fontMono,
    }}>{label}</span>
  );
}

function getMessageKind(m) {
  const t = (m?.contenido || "").toLowerCase();
  if (t.includes("cita agendada") || t.includes("google calendar") || t.includes("receta ocr") || t.includes("ocr")) return "system";
  if (m?.remitente === "bot") return "bot";
  if (m?.remitente === "admin" || m?.remitente === "operador") return "operator";
  return "client";
}

function channelMeta(channel) {
  const raw = String(channel || "wsp").toLowerCase();
  return raw.includes("web")
    ? { label: "Web", color: C.neon }
    : { label: "WhatsApp", color: C.green };
}

function DateSeparator({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", position: "sticky", top: 8, zIndex: 2 }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 10, color: C.inkFaint, padding: "4px 10px", background: C.surface, borderRadius: 999, border: `1px solid ${C.border}`, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", boxShadow: "0 4px 16px rgba(0,0,0,0.28)" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function ChatBubble({ kind, author, text, time, meta, showAvatar = true, channel = "wsp" }) {
  if (kind === "system") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "10px 0", animation: "fadeUp 0.2s ease-out" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 11px", borderRadius: 999,
          background: C.surfaceL, border: `1px dashed ${C.border}`,
          fontSize: 11, color: C.inkMid, fontFamily: C.fontMono,
          maxWidth: "78%", lineHeight: 1.45,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.neon, boxShadow: `0 0 8px ${C.neon}`, flexShrink: 0 }} />
          <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
          {meta && <span style={{ color: C.inkFaint }}>/ {meta}</span>}
        </div>
      </div>
    );
  }

  const clientColor = avatarColor(author || "Paciente");
  const ch = channelMeta(channel);
  const styles = {
    client: {
      wrap: { justifyContent: "flex-start" },
      bubble: { background: C.surfaceL, color: C.ink, border: `1px solid ${C.border}`, borderRadius: "4px 14px 14px 14px", minWidth: 84 },
      avatar: { background: `${clientColor}1A`, color: clientColor, border: `1px solid ${clientColor}33` },
    },
    bot: {
      wrap: { justifyContent: "flex-start" },
      bubble: { background: "rgba(249,115,22,0.06)", color: C.ink, border: "1px solid rgba(249,115,22,0.22)", borderRadius: "4px 14px 14px 14px" },
      avatar: { background: "rgba(249,115,22,0.15)", color: C.primary, border: "1px solid rgba(249,115,22,0.25)" },
    },
    operator: {
      wrap: { justifyContent: "flex-end" },
      bubble: { background: "rgba(52,211,153,0.08)", color: C.ink, border: "1px solid rgba(52,211,153,0.24)", borderRadius: "14px 4px 14px 14px" },
      avatar: { background: "rgba(52,211,153,0.15)", color: C.green, border: "1px solid rgba(52,211,153,0.25)" },
    },
  }[kind] || {};

  const isOperator = kind === "operator";
  return (
    <div style={{ display: "flex", gap: 8, margin: "8px 0", animation: "fadeUp 0.2s ease-out", ...styles.wrap }}>
      {!isOperator && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && (
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, flexShrink: 0,
              fontFamily: C.fontSans,
              ...styles.avatar,
            }}>{kind === "bot" ? "IA" : initials(author || "P")}</div>
          )}
        </div>
      )}

      <div style={{ maxWidth: "72%", minWidth: kind === "client" ? 84 : 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {kind === "bot" && (
          <span style={{ fontSize: 10, color: C.primary, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            AUKÉN IA {meta && <span style={{ color: C.inkFaint, fontWeight: 500 }}>/ {meta}</span>}
          </span>
        )}
        {kind === "operator" && (
          <span style={{ alignSelf: "flex-end", fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Operador
          </span>
        )}
        <div style={{
          padding: "9px 12px", fontSize: 13, lineHeight: 1.5,
          fontFamily: C.fontSans, whiteSpace: "pre-wrap", wordBreak: "break-word",
          ...styles.bubble,
        }}>{text}</div>
        <span style={{
          fontSize: 10, color: C.inkFaint,
          alignSelf: isOperator ? "flex-end" : "flex-start",
          fontFamily: C.fontMono, fontVariantNumeric: "tabular-nums",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {kind === "client" && <span style={{ color: ch.color, fontWeight: 700 }}>por {ch.label}</span>}
          {kind === "client" && <span style={{ color: C.inkFaint }}>/</span>}
          <span>{time}</span>
        </span>
      </div>
    </div>
  );
}

// -- Sidebar row ---------------------------------------------------------------
function StatusPill({ type }) {
  const map = {
    pending: ["Pendiente", C.amber, "rgba(251,191,36,0.10)"],
    human: ["Humano", C.green, "rgba(52,211,153,0.10)"],
    bot: ["Bot", C.primary, "rgba(249,115,22,0.12)"],
  };
  const [label, color, bg] = map[type] || map.bot;
  return (
    <span style={{
      height: 18,
      display: "inline-flex",
      alignItems: "center",
      padding: "0 6px",
      borderRadius: C.radiusSm,
      background: bg,
      color,
      border: `1px solid ${color}30`,
      fontFamily: C.fontMono,
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function PatientRow({ p, active, onClick, lastMsg, unread }) {
  const name = p.nombre || "Sin nombre";
  const c = avatarColor(name);
  const waiting = waitingSeconds(lastMsg);
  const isCritical = waiting > 600;
  const kind = lastMsg?.remitente === "cliente" ? "pending" : lastMsg?.remitente === "admin" ? "human" : "bot";
  const preview = lastMsg?.contenido || p.telefono || "Sin mensajes todavía";

  return (
    <button
      onClick={onClick}
      className="auken-touch"
      style={{
        position: "relative",
        width: "100%",
        textAlign: "left",
        display: "flex",
        gap: 10,
        padding: "12px 14px",
        background: active ? C.surfaceL : "transparent",
        border: "none",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
        transition: `background ${C.dur} ${C.ease}`,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#13151A"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {active && (
        <span style={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 2,
          background: C.primary,
          borderRadius: "0 2px 2px 0",
        }} />
      )}

      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        background: `${c}1A`,
        color: c,
        border: `1px solid ${c}33`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: C.fontSans,
        letterSpacing: "-0.01em",
      }}>
        {initials(name)}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: unread ? 700 : 600,
            color: active || unread ? C.ink : C.inkMid,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {name}
          </span>
          <span style={{
            fontSize: 10,
            color: isCritical ? C.red : unread ? C.primary : C.inkFaint,
            fontFamily: C.fontMono,
            fontWeight: isCritical || unread ? 700 : 500,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}>
            {relTime(lastMsg?.created_at)}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 12,
            color: unread ? C.ink : C.inkFaint,
            fontWeight: unread ? 600 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}>
            {lastMsg?.remitente === "bot" && <span style={{ color: C.primary, fontWeight: 700 }}>IA: </span>}
            {lastMsg?.remitente === "admin" && <span style={{ color: C.green, fontWeight: 700 }}>Op: </span>}
            {preview}
          </span>
          {unread > 0 && (
            <span style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: C.primary,
              color: "#08090C",
              fontSize: 10,
              fontWeight: 800,
              fontFamily: C.fontMono,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 1 }}>
          <StatusPill type={kind} />
          {isCritical && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: C.red,
              fontWeight: 700,
              fontFamily: C.fontMono,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.red }} />
              ESPERANDO {Math.floor(waiting / 60)}m
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ConvListHeader({ search, setSearch, filter, setFilter, count, totalUnread }) {
  const filters = [
    ["all", "Todas"],
    ["unread", totalUnread > 0 ? `Sin leer ${totalUnread}` : "Sin leer"],
    ["live", "En vivo"],
    ["waiting", "Esperando"],
  ];

  return (
    <div style={{
      padding: "14px 14px 10px",
      borderBottom: `1px solid ${C.border}`,
      background: C.surface,
      position: "sticky",
      top: 0,
      zIndex: 2,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
          Conversaciones
        </h2>
        <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkFaint, fontVariantNumeric: "tabular-nums" }}>
          {count}
        </span>
      </div>

      <div style={{ position: "relative", marginBottom: 9 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, pointerEvents: "none", display: "inline-flex" }}><Icon name="search" size={12} /></span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ width: "100%", background: C.surfaceL, border: `1px solid ${C.border}`, color: C.ink, padding: "8px 10px 8px 28px", borderRadius: 8, outline: "none", fontSize: 12 }}
        />
      </div>

      <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
        {filters.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className="auken-touch"
            style={{
              height: 26,
              padding: "0 10px",
              borderRadius: C.radiusSm,
              background: filter === val ? C.surfaceL : "transparent",
              color: filter === val ? C.ink : C.inkMid,
              border: `1px solid ${filter === val ? C.border : "transparent"}`,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: `all ${C.dur} ${C.ease}`,
              flexShrink: 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// -- Panel ficha derecho -------------------------------------------------------
function hasPatientValue(value) {
  if (value === null || value === undefined) return false;
  const v = String(value).trim().toLowerCase();
  return !!v && v !== "pendiente" && v !== "-" && v !== "--" && v !== "—";
}

function PatientProgressRing({ pct, size = 38, stroke = 3 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  const color = pct >= 80 ? C.green : pct >= 40 ? C.amber : C.red;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: `stroke-dashoffset 480ms ${C.ease}` }} />
      <text x={size / 2} y={size / 2} fill={color} textAnchor="middle" dominantBaseline="central" transform={`rotate(90 ${size / 2} ${size / 2})`} style={{ fontSize: 11, fontFamily: C.fontMono, fontWeight: 800 }}>{pct}</text>
    </svg>
  );
}

function PatientPanel({ p, onClose, onGoToDashboard }) {
  const [patient, setPatient] = useState(p);
  useEffect(() => setPatient(p), [p]);
  if (!patient) return null;
  p = patient;
  const cleanNotas = sanitizeNotas(p.notas_clinicas);
  const dias = diasReceta(p.fecha_ultima_visita);
  const recetaColor = dias === null ? C.inkFaint : dias > 365 ? C.red : dias > 335 ? C.amber : C.green;
  const recetaLabel = dias === null ? "Sin receta" : dias > 365 ? `Vencida (${dias}d)` : dias > 335 ? `Próxima (${365 - dias}d)` : "Vigente";

  const allFields = [
    ["rut", "RUT", formatRut(p.rut), p.rut],
    ["telefono", "Telefono", p.telefono, p.telefono],
    ["comuna", "Comuna", p.comuna, p.comuna],
    ["fecha_ultima_visita", "Ultima visita", formatVisit(p.fecha_ultima_visita), p.fecha_ultima_visita],
    ["fecha_proximo_control", "Prox. control", formatVisit(p.fecha_proximo_control), p.fecha_proximo_control],
    ["producto_actual", "Producto", p.producto_actual, p.producto_actual],
    ["estado_compra", "Estado compra", labelMeta("compraState", p.estado_compra || "Pendiente").label, p.estado_compra],
  ];
  const completeBase = allFields.filter(([, label]) => label !== "Estado compra");
  const pct = Math.round((completeBase.filter(([, , , raw]) => hasPatientValue(raw)).length / completeBase.length) * 100);
  const fields = allFields.filter(([, , , raw]) => hasPatientValue(raw));
  const emptyFields = allFields.filter(([, , , raw]) => !hasPatientValue(raw));

  const editField = async (key, label, currentValue) => {
    const next = window.prompt(`Actualizar ${label}`, currentValue || "");
    if (next === null || next === currentValue) return;
    const patch = { [key]: next.trim() || null };
    setPatient(prev => ({ ...prev, ...patch }));
    const { error } = await supabase.from("pacientes").update(patch).eq("id", p.id);
    if (error) {
      setPatient(prev => ({ ...prev, [key]: currentValue }));
      alert("No se pudo guardar el dato. Intenta nuevamente.");
    }
  };

  return (
    <aside style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
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
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, textAlign: "left" }}>
          <PatientProgressRing pct={pct} />
          <div>
            <div style={{ fontSize: 12, color: C.ink, fontWeight: 800 }}>{pct === 100 ? "Ficha completa" : `Ficha ${pct}% completa`}</div>
            <div style={{ fontSize: 10, color: C.inkFaint, lineHeight: 1.35 }}>Mas datos ayudan al bot a responder mejor.</div>
          </div>
        </div>
        </div>

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fields.map(([key, label, val, raw]) => (
            <button key={key} onClick={() => editField(key, label, raw || "")} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              width: "100%", padding: "8px 10px", background: "transparent", border: "1px solid transparent",
              borderRadius: 7, cursor: "pointer", textAlign: "left", transition: `all ${C.dur} ${C.ease}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceL; e.currentTarget.style.borderColor = C.border; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
              <span style={{ fontSize: 10, color: C.inkFaint, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.07em", flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: C.ink, fontWeight: 600, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%" }}>{val}</span>
            </button>
          ))}
          {emptyFields.length > 0 && (
            <button onClick={() => editField(emptyFields[0][0], emptyFields[0][1], "")} style={{
              marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start",
              background: "transparent", border: "none", color: C.primary, fontSize: 11, fontWeight: 800,
              cursor: "pointer", padding: "4px 10px",
            }}>
              <Icon name="plus" size={11} /> Agregar dato
            </button>
          )}
        </div>

        {/* Receta OCR */}
        {p.receta_data && (
          <div style={{ marginTop: 14, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="file" size={12} /> Receta OCR</div>
            {[["OD", p.receta_data?.OD], ["OI", p.receta_data?.OI]].map(([eye, d]) => d && (
              <div key={eye} style={{ fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: C.primary, fontWeight: 700 }}>{eye} </span>
                <span style={{ color: C.inkMid }}>
                  {d.esfera && `Esf ${d.esfera}`}{d.cilindro && ` / Cil ${d.cilindro}`}{d.eje && ` / Eje ${d.eje}°`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {cleanNotas && (
          <div style={{ marginTop: 12, background: C.surfaceL, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.inkFaint, fontWeight: 700, marginBottom: 5, textTransform: "uppercase" }}>Notas clínicas</div>
            <div style={{ fontSize: 11, color: C.inkMid, lineHeight: 1.6 }}>{cleanNotas}</div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 7 }}>
        <a href={`${DASHBOARD_PATH}?patient=${p.id}`} onClick={(e) => onGoToDashboard(e, p.id)} style={{
          background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}35`,
          borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          width: "100%", textAlign: "center", textDecoration: "none", display: "block", position: "relative", zIndex: 5,
        }}><Icon name="file" size={12} /> Ver ficha completa</a>
        {p.telefono && (
          <button onClick={() => window.open(`https://wa.me/${p.telefono.replace(/\D/g, "")}`, "_blank")} style={{
            background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)",
            borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}><Icon name="phone" size={12} /> Abrir en WhatsApp</button>
        )}
      </div>
    </aside>
  );
}

// -- Componente principal ------------------------------------------------------
export default function AukenOptica() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeOpticaSlug = getOpticaSlugFromSearch(searchParams);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const sendingRef = useRef(false);
  const { isMobile, isTablet } = useViewport();
  const { toast } = useToaster();
  const [showSidebar, setShowSidebar] = useState(false); // móvil: drawer cerrado por defecto

  const [optica,    setOptica]    = useState(null);
  const [activeP,   setActiveP]   = useState(null);
  const [patients,  setPatients]  = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [lastMsgs,  setLastMsgs]  = useState({});
  const [unreadMap, setUnreadMap] = useState({});      // paciente_id -> count
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

  useEffect(() => {
    setStoredOpticaSlug(activeOpticaSlug);
  }, [activeOpticaSlug]);

  const openDashboard = useCallback((e, patientId = null) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      localStorage.setItem("auken_auth", "true");
    } catch {}
    navigate(buildTenantPath(DASHBOARD_PATH, activeOpticaSlug, patientId ? { patient: patientId } : {}));
  }, [activeOpticaSlug, navigate]);
  const [testMode,   setTestMode]   = useState(false);  // simula ser cliente, IA responde
  const [iaThinking, setIaThinking] = useState(false);
  const [creandoDemo, setCreandoDemo] = useState(false);

  // -- Carga pacientes aislados por óptica --------------------------------------
  const refresh = useCallback(async () => {
    const { data: opticaRow, error: opticaError } = await supabase
      .from("opticas")
      .select("*")
      .eq("slug", activeOpticaSlug)
      .maybeSingle();

    if (opticaError) {
      console.error("[monitor] Error cargando óptica:", opticaError.message);
      setLoading(false);
      return;
    }

    setOptica(opticaRow || null);
    if (!opticaRow?.id) {
      setPatients([]);
      setLastMsgs({});
      setUnreadMap({});
      setLoading(false);
      return;
    }

    const { data: pacs, error: pacError } = await supabase
      .from("pacientes")
      .select("*")
      .eq("optica_id", opticaRow.id)
      .order("created_at", { ascending: false });

    if (pacError) {
      console.error("[monitor] Error cargando pacientes:", pacError.message);
      setLoading(false);
      return;
    }

    const scopedPatients = pacs || [];
    setPatients(scopedPatients);
    const ids = scopedPatients.map(p => p.id);
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
    } else {
      setLastMsgs({});
      setUnreadMap({});
    }
    setLoading(false);
  }, [activeOpticaSlug]);

  // -- Demo: crear cliente placeholder para probar el flujo de registro IA -----
  const crearDemoCliente = useCallback(async () => {
    setCreandoDemo(true);
    try {
      // Buscar la óptica para obtener optica_id
      const { data: opticaRow } = await supabase.from("opticas")
        .select("id").eq("slug", activeOpticaSlug).maybeSingle();

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
        sub: "Escribe como cliente - la IA pedirá tus datos y completará el registro automáticamente",
        duration: 7000,
      });
    } catch (err) {
      alert("Error creando demo: " + err.message);
    } finally {
      setCreandoDemo(false);
    }
  }, [activeOpticaSlug, toast]);

  // -- Carga chat ---------------------------------------------------------------
  const loadChat = useCallback(async (pId) => {
    if (!pId) return;
    const { data } = await supabase.from("mensajes_chat").select("*").eq("paciente_id", pId).order("created_at", { ascending: true });
    setMessages(dedupeMessages(data || []));
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

  // -- Real-time multi-dispositivo: mensajes + pacientes + citas ---------------
  useEffect(() => {
    const sub = supabase.channel("auken_live")
      // Mensajes nuevos
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat" }, (payload) => {
        const m = payload.new;
        setLastMsgs(prev => ({ ...prev, [m.paciente_id]: m }));
        if (activeP && m.paciente_id === activeP.id) {
          setMessages(prev => dedupeMessages([...prev, m]));
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
            sub: m.contenido?.split("\n")[0]?.replace("✓ ", "") || "Nueva cita agendada por la IA",
            action: m.metadata?.calendar_url ? {
              label: "Google Calendar",
              onClick: () => window.open(m.metadata.calendar_url, "_blank"),
            } : undefined,
            duration: 10000,
          });
        }
      })
      // Pacientes (INSERT/UPDATE/DELETE) - sincroniza entre notebooks
      .on("postgres_changes", { event: "*", schema: "public", table: "pacientes" }, () => {
        refresh();
      })
      // Citas (cuando bot IA agenda automáticamente desde otro dispositivo)
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => {
        // El monitor no muestra citas, pero el dashboard sí; el evento queda registrado.
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeP, refresh, toast]);

  // -- Enviar -------------------------------------------------------------------
  const handleSend = async () => {
    if (!inputText.trim() || !activeP || sending || sendingRef.current) return;
    sendingRef.current = true;
    const text = inputText.trim();
    setSending(true);

    if (testMode) {
      //  Modo prueba: el operador simula al cliente -> Claude responde
      const { error: e1 } = await supabase.from("mensajes_chat").insert([{
        paciente_id: activeP.id, remitente: "cliente", contenido: text,
      }]);
      if (e1) { alert("Error guardando mensaje: " + e1.message); setSending(false); sendingRef.current = false; return; }
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
            opticaSlug: activeOpticaSlug,
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
          contenido: "⚠ Error técnico: no pude conectar con la IA. Verifica ANTHROPIC_API_KEY en Vercel.",
        }]);
        await loadChat(activeP.id);
      }
      setIaThinking(false);
      setSending(false);
      sendingRef.current = false;
    } else {
      // Modo normal: operador responde como humano
      const { error } = await supabase.from("mensajes_chat").insert([{
        paciente_id: activeP.id, remitente: "admin", contenido: text,
      }]);
      setSending(false);
      sendingRef.current = false;
      if (!error) { setInputText(""); loadChat(activeP.id); }
    }
  };

  const applyQuickReply = (text) => {
    setInputText(text);
    setShowQuick(false);
    inputRef.current?.focus();
  };

  // -- Filtrado -----------------------------------------------------------------
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    if (q && !p.nombre?.toLowerCase().includes(q) && !p.telefono?.includes(q)) return false;
    if (filter === "live")    return !!lastMsgs[p.id];
    if (filter === "unread")  return (unreadMap[p.id] || 0) > 0;
    if (filter === "waiting") return waitingSeconds(lastMsgs[p.id]) > 0;
    return true;
  });

  // -- Grupos de mensajes -------------------------------------------------------
  const grouped = messages.reduce((acc, m) => {
    const sep = dateSep(m.created_at);
    if (!acc.length || acc[acc.length - 1].sep !== sep) acc.push({ sep, msgs: [m] });
    else acc[acc.length - 1].msgs.push(m);
    return acc;
  }, []);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  // -- Loading ------------------------------------------------------------------
  if (loading) return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: C.fontSans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes auken-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <nav style={{
        height: 48, borderBottom: `1px solid ${C.border}`, background: C.surface,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", boxShadow: C.shadowSm,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: C.radiusSm, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
          <div style={{ width: 92, height: 14, borderRadius: 4, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 74, height: 28, borderRadius: C.radius, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
          <div style={{ width: 54, height: 28, borderRadius: C.radius, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
        </div>
      </nav>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "290px 1fr 270px", overflow: "hidden" }}>
        {!isMobile && (
          <aside style={{ borderRight: `1px solid ${C.border}`, background: C.surface, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: "100%", height: 34, borderRadius: C.radius, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 4px", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "70%", height: 11, borderRadius: 4, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
                  <div style={{ width: "46%", height: 9, borderRadius: 4, marginTop: 7, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </aside>
        )}
        <main style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              alignSelf: i % 2 ? "flex-end" : "flex-start",
              width: isMobile ? (i % 2 ? "78%" : "68%") : (i % 2 ? "48%" : "38%"),
              height: i === 0 ? 54 : 42,
              borderRadius: i % 2 ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`,
              backgroundSize: "200% 100%",
              animation: "auken-shimmer 1.6s ease-in-out infinite",
            }} />
          ))}
        </main>
        {!isMobile && (
          <aside style={{ borderLeft: `1px solid ${C.border}`, background: C.surface, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", alignSelf: "center", background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
            {[72, 120, 96, 150, 84, 132].map((w, i) => (
              <div key={i} style={{ width: w, height: 11, borderRadius: 4, background: `linear-gradient(90deg, ${C.surfaceL}, ${C.surfaceXL}, ${C.surfaceL})`, backgroundSize: "200% 100%", animation: "auken-shimmer 1.6s ease-in-out infinite" }} />
            ))}
          </aside>
        )}
      </div>
    </div>
  );

  // -- Render -------------------------------------------------------------------
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
        @media (max-width: 768px){button.auken-touch{min-height:44px}}
      `}</style>

      {/* -- TOAST nueva msg ----------------------------------------------- */}
      {newMsgAlert && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 999,
          background: C.surfaceXL, border: `1px solid ${C.primaryRing}`,
          borderRadius: C.radiusLg, padding: "12px 18px", boxShadow: C.shadowLg,
          animation: "slideIn 0.3s ease-out", display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon name="chat" size={16} color={C.primary} />
          <div>
            <div style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>Nuevo mensaje</div>
            <div style={{ fontSize: 12, color: C.ink }}>{newMsgAlert}</div>
          </div>
        </div>
      )}

      {/* -- TOP NAV ------------------------------------------------------- */}
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
          <div style={{ width: 26, height: 26, background: `linear-gradient(135deg, ${C.primary}, ${C.neon})`, borderRadius: C.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", boxShadow: `0 0 10px ${C.primarySoft}` }}><Icon name="eye" size={14} strokeWidth={1.8} /></div>
          <span style={{ fontFamily: C.fontSans, fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>Monitor</span>
          <span style={{ color: C.inkFaint }}>/</span>
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
          <a href={buildTenantPath(DASHBOARD_PATH, activeOpticaSlug)} onClick={openDashboard}
            style={{ background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}30`, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none", position: "relative", zIndex: 5 }}>
            <Icon name="metrics" size={12} /> Dashboard
          </a>
          <button onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.inkFaint, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
            Salir
          </button>
        </div>
      </nav>

      {/* -- BODY ---------------------------------------------------------- */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Overlay para cerrar drawer en móvil */}
        {isMobile && showSidebar && (
          <div onClick={() => setShowSidebar(false)} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 30, backdropFilter: "blur(4px)",
          }} />
        )}

        {/* -- SIDEBAR --------------------------------------------------- */}
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
          <ConvListHeader
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            count={filtered.length}
            totalUnread={totalUnread}
          />

          {/* Botón demo: simular cliente desconocido */}
          <div style={{ padding: "10px 10px 8px" }}>
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
              {creandoDemo ? "Creando..." : <><Icon name="plus" size={12} /> Demo cliente nuevo</>}
            </button>
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

        {/* -- CHAT ------------------------------------------------------ */}
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
                    <Icon name="bot" size={12} /> {testMode ? "Modo Prueba ON" : "Probar IA"}
                  </button>
                  <button onClick={() => setShowQuick(v => !v)}
                    style={{ background: showQuick ? `${C.amber}20` : C.surfaceL, border: `1px solid ${showQuick ? C.amber + "50" : C.border}`, color: showQuick ? C.amber : C.inkMid, padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    <Icon name="bolt" size={12} /> Rápidas
                  </button>
                  <button onClick={() => setShowPanel(v => !v)}
                    style={{ background: showPanel ? `${C.primary}20` : C.surfaceL, border: `1px solid ${showPanel ? C.primary + "40" : C.border}`, color: showPanel ? C.primary : C.inkMid, padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                    <Icon name="users" size={12} /> Ficha
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
                  <Icon name="bot" size={13} />
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
                    <div style={{ opacity: 0.15 }}><Icon name="chat" size={40} /></div>
                    <div style={{ fontSize: 12, opacity: 0.4 }}>Sin mensajes con este paciente</div>
                  </div>
                )}

                {iaThinking && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: `${C.neon}10`, border: `1px solid ${C.neon}30`, borderRadius: 12, alignSelf: "flex-start", marginBottom: 10, animation: "fadeUp 0.2s" }}>
                    <span style={{ fontSize: 11, color: C.neon, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="bot" size={12} /> Aukén IA está pensando</span>
                    <span style={{ display: "flex", gap: 3 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.neon, animation: `blink 1.4s infinite ${i * 0.2}s` }} />
                      ))}
                    </span>
                  </div>
                )}

                {grouped.map(({ sep, msgs }) => (
                  <div key={sep}>
                    <DateSeparator label={sep} />
                    {msgs.map((m, i) => {
                      const kind = getMessageKind(m);
                      const prevKind = i > 0 ? getMessageKind(msgs[i - 1]) : null;
                      const time = m.created_at
                        ? new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                        : "";
                      return (
                        <ChatBubble
                          key={m.id || i}
                          kind={kind}
                          author={activeP?.nombre || m.remitente}
                          text={m.contenido}
                          time={time}
                          meta={kind === "bot" ? "respuesta IA" : null}
                          showAvatar={i === 0 || kind !== prevKind}
                          channel={m.channel || m.canal || "wsp"}
                        />
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
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
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
                    {sending ? "..." : testMode ? "▶ Probar" : "Enviar"}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 5, paddingLeft: 2 }}>
                  {testMode
                    ? "Modo Prueba activo - Claude IA responderá según el system prompt configurado"
                    : "Enter para enviar / respuestas predefinidas / probar la IA"}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.inkFaint }}>
              <div style={{ opacity: 0.1 }}><Icon name="chat" size={52} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.35, letterSpacing: "0.1em", textTransform: "uppercase" }}>Selecciona un canal</div>
              {totalUnread > 0 && (
                <div style={{ marginTop: 8, background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 8, padding: "8px 16px", fontSize: 12, color: C.red, fontWeight: 600 }}>
                  {totalUnread} mensaje{totalUnread !== 1 ? "s" : ""} sin leer
                </div>
              )}
            </div>
          )}
        </section>

        {/* -- FICHA ------------------------------------------------------ */}
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
              onGoToDashboard={openDashboard}
            />
          </div>
        )}
      </div>
    </div>
  );
}
