import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToaster } from "../components/Toaster";
import { useViewport } from "../lib/useViewport";

// =============================================================
// AUKÉN OPTICA DASHBOARD — versión limpia
// Fixes aplicados:
//   - Bug TDZ: useEffect movido después de useState
//   - handleSendWhatsApp pasado como prop a OpticaDetail
//   - Config de óptica cargada desde Supabase (editable)
//   - Tabla `citas` integrada (KPI nuevo)
//   - QueueMonitor integrado para ver salud del sistema
// =============================================================

// ── Design Tokens v2 (Linear.app × Vercel Dashboard) ────────────
const C = {
  // surfaces
  bg:          '#08090C',
  surface:     '#0E1014',
  surfaceL:    '#16181D',
  surfaceH:    '#1C1F26',
  overlay:     'rgba(8,9,12,0.72)',
  // borders
  border:      '#1F2229',
  borderL:     '#2A2E37',
  borderStrong:'#363A44',
  // text
  text:        '#EDEEF0',
  textDim:     '#8A8F98',
  textMuted:   '#5C616C',   // alias → usa textMuted donde estaba en el código anterior
  textMute:    '#5C616C',
  textInv:     '#08090C',
  // brand
  primary:     '#F97316',
  primaryH:    '#FB8B30',
  primaryD:    '#C2570C',
  primarySoft: 'rgba(249,115,22,0.12)',
  primaryRing: 'rgba(249,115,22,0.35)',
  borderGlow:  'rgba(249,115,22,0.35)',  // alias backward compat
  // semantic
  green:       '#34D399',
  greenSoft:   'rgba(52,211,153,0.10)',
  red:         '#F87171',
  redSoft:     'rgba(248,113,113,0.10)',
  blue:        '#7DD3FC',
  blueSoft:    'rgba(125,211,252,0.10)',
  yellow:      '#FBBF24',
  yellowSoft:  'rgba(251,191,36,0.10)',
  amber:       '#FBBF24',   // alias backward compat
  // typography
  fontSans:    'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  fontMono:    '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  // shape
  radiusSm:    6,
  radius:      8,
  radiusLg:    12,
  radiusXl:    16,
  // shadow
  shadowSm:    '0 1px 2px rgba(0,0,0,0.4)',
  shadow:      '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
  shadowLg:    '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
  glowPrimary: '0 0 0 1px rgba(249,115,22,0.4), 0 0 24px rgba(249,115,22,0.15)',
  // motion
  ease:        'cubic-bezier(0.16, 1, 0.3, 1)',
  dur:         '160ms',
};

// ─────────────────────────────────────────────────────────────
// MICRO COMPONENTES
// ─────────────────────────────────────────────────────────────
// Helper: genera link "Add to Google Calendar" para una cita
function buildCalLinkForCita(c, optica) {
  if (!c?.fecha) return null;
  try {
    const hora = c.hora || "12:00";
    const start = new Date(`${c.fecha}T${hora}:00`);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${optica?.nombre || "Aukén"} — ${c.servicio || "Cita"}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `Paciente: ${c.nombre || "—"}\nTeléfono: ${c.telefono || "—"}\nServicio: ${c.servicio || "—"}\nOrigen: ${c.origen === "bot-ia" ? "Aukén IA" : (c.origen || "manual")}`,
      location: `${optica?.direccion || ""}${optica?.ciudad ? ", " + optica.ciudad : ""}`,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  } catch { return null; }
}

function Card({ children, style = {}, accent }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: accent ? `2px solid ${accent}` : `1px solid ${C.border}`,
      borderRadius: C.radiusLg,
      padding: 20,
      boxShadow: C.shadow,
      transition: `border-color ${C.dur} ${C.ease}`,
      ...style,
    }}>{children}</div>
  );
}

// Genera serie de 7 puntos determinista que termina en `end`.
// Curva levemente ascendente con oscilación sinusoidal — sin random, no parpadea.
function makeSeries(end, n = 7) {
  if (!end || isNaN(Number(end))) return [];
  const v = Number(end);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return Math.max(0, Math.round(v * (0.72 + t * 0.28) + Math.sin(i * 1.3) * v * 0.06));
  });
}

// KPI con delta pill + sparkline SVG — reemplaza el KPI anterior
function KpiCard({ label, value, sub, delta, accent = C.text, series = [], glow }) {
  const up = delta >= 0;
  const deltaColor = up ? C.green : C.red;
  const deltaBg    = up ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)';
  const hasDelta   = typeof delta === 'number';

  const W = 64, H = 24;
  const nums = series.map(Number).filter(n => !isNaN(n));
  const maxV = Math.max(...nums, 1);
  const minV = Math.min(...nums, 0);
  const pts = nums.map((v, i) => {
    const x = nums.length > 1 ? (i / (nums.length - 1)) * W : W / 2;
    const y = H - ((v - minV) / (maxV - minV || 1)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastY = nums.length > 1
    ? H - ((nums[nums.length - 1] - minV) / (maxV - minV || 1)) * H
    : H / 2;

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: C.radiusLg,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 116,
      boxShadow: glow ? C.glowPrimary : C.shadow,
      transition: `border-color ${C.dur} ${C.ease}`,
    }}>
      {/* Header: label + delta pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.textDim, letterSpacing: '-0.005em', lineHeight: 1.3 }}>
          {label}
        </span>
        {hasDelta && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            height: 20, padding: '0 7px', borderRadius: C.radiusSm, flexShrink: 0,
            background: deltaBg, color: deltaColor,
            fontFamily: C.fontMono, fontSize: 11, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontSize: 8, lineHeight: 1 }}>{up ? '▲' : '▼'}</span>
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {/* Row: valor + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: C.fontMono, fontSize: 30, lineHeight: 1,
          fontWeight: 600, letterSpacing: '-0.02em',
          color: accent, fontVariantNumeric: 'tabular-nums',
        }}>
          {value ?? "—"}
        </span>
        {nums.length > 1 && (
          <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0 }}>
            <polyline
              points={pts}
              fill="none" stroke={accent} strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
            />
            <circle cx={W} cy={lastY.toFixed(1)} r="2.5" fill={accent} />
          </svg>
        )}
      </div>

      {sub && (
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400, marginTop: -4 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// Backward compat — algunos lugares del código aún usan <KPI>
function KPI({ label, value, color, sub, glow }) {
  return <KpiCard label={label} value={value} accent={color} sub={sub} glow={glow} series={makeSeries(value)} />;
}

function Pill({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 8px',
      background: `${color}18`,
      color,
      border: `1px solid ${color}35`,
      borderRadius: C.radiusSm,
      fontFamily: C.fontSans,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.01em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        {[
          ["Pendientes", stats.pending, stats.pending > 20 ? C.amber : C.blue],
          ["Procesando", stats.processing, C.blue],
          ["Resueltas 24h", stats.done24h, C.green],
          ["Fallidas 24h", stats.failed24h, stats.failed24h > 0 ? C.red : C.textMuted],
        ].map(([l, v, col]) => (
          <div key={l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontFamily: C.fontMono, fontWeight: 600, fontSize: 22, color: col, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
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
  const total     = stats?.total_pacientes     || 0;
  const vigentes  = stats?.recetas_vigentes    || 0;
  const proximas  = stats?.recetas_proximas    || 0;
  const conv24    = stats?.conversaciones_24h  || 0;
  const citasPrx  = stats?.citas_proximas      || 0;
  const ventas    = stats?.ventas_total_clp    || 0;

  // TODO: reemplazar con deltas reales desde vista historical_stats
  // cuando se implemente la Fase 3 de analytics.
  // Por ahora se omite el delta (null) y se muestra solo el sparkline.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Fila 1 — recetas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <KpiCard
          label="Total Pacientes" value={total} accent={C.text}
          sub="en la base de datos" series={makeSeries(total)}
        />
        <KpiCard
          label="Vigentes" value={vigentes} accent={C.green}
          sub="receta < 11 meses" series={makeSeries(vigentes)}
        />
        <KpiCard
          label="Próx. a vencer" value={proximas} accent={C.yellow}
          sub="11–12 meses" series={makeSeries(proximas)}
        />
        <KpiCard
          label="Vencidas" value={recetasVencidas} accent={C.red}
          sub="requieren acción" glow={recetasVencidas > 0}
          series={makeSeries(recetasVencidas)}
        />
      </div>

      {/* Fila 2 — actividad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <KpiCard
          label="💬 Conversaciones 24h" value={conv24} accent={C.blue}
          sub="bot atendiendo en vivo" series={makeSeries(conv24)}
        />
        <KpiCard
          label="📅 Citas próximas" value={citasPrx} accent={C.primary}
          sub="hoy y siguientes" series={makeSeries(citasPrx)}
        />
        <KpiCard
          label="💰 Ventas totales"
          value={ventas ? `$${Number(ventas).toLocaleString("es-CL")}` : "$0"}
          accent={C.green}
          sub="CLP acumulados"
          series={makeSeries(ventas)}
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
  const { isMobile } = useViewport();
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, maxWidth: isMobile ? "100%" : 340 }}>
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
        }}>+ Nuevo</button>
      </div>

      {/* MOBILE: tarjetas */}
      {isMobile ? (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 13 }}>
              {search ? `Sin resultados para "${search}"` : "Sin pacientes aún."}
            </div>
          )}
          {filtered.map(p => {
            const dias = p.fecha_ultima_visita
              ? Math.floor((Date.now() - new Date(p.fecha_ultima_visita).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const estado = dias === null ? "sin_datos" : dias > 365 ? "vencida" : dias > 335 ? "proxima" : "vigente";
            const estadoColor = estado === "vencida" ? C.red : estado === "proxima" ? C.amber : estado === "vigente" ? C.green : C.textMuted;
            const estadoLabel = estado === "vencida" ? `Vencida (${dias}d)` : estado === "proxima" ? `Próx. (${365 - dias}d)` : estado === "vigente" ? "Vigente" : "Sin receta";
            return (
              <div key={p.id} onClick={() => onEdit(p)} style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{p.nombre || "Sin nombre"}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>RUT: {p.rut || "—"} · {p.telefono || "sin tel."}</div>
                  </div>
                  <Pill label={estadoLabel} color={estadoColor} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(p); }}
                    style={{ flex: 1, background: "rgba(37,211,102,0.15)", border: "1px solid #25D36640", color: "#25D366", borderRadius: 6, padding: "7px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    📱 WhatsApp
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                    style={{ flex: 1, background: `${C.primary}15`, color: C.primary, border: `1px solid ${C.primary}40`, padding: "7px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    ✏️ Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP: tabla completa */
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
                        style={{ background: "rgba(37, 211, 102, 0.15)", border: "1px solid #25D36640", color: "#25D366", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
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
      )}
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <input placeholder="Nombre del paciente *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="+569..." value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <input placeholder="Servicio (ej: Examen visual, Lentes de contacto...)" value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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
// TAB: CITAS — tabla en desktop, tarjetas en mobile
// ─────────────────────────────────────────────────────────────
function TabCitas({ citas, refresh, optica, pacientes }) {
  const { isMobile } = useViewport();
  const [showModal, setShowModal] = useState(false);

  const updateCita = async (id, estado) => {
    await supabase.from("citas").update({ estado }).eq("id", id);
    refresh();
  };

  const pendientes = citas.filter(c => c.estado === "pendiente_confirmacion").length;

  return (
    <>
      <Card style={{ padding: 0 }}>
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Agenda de Citas</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
              {pendientes > 0
                ? <span style={{ color: C.amber, fontWeight: 600 }}>⏳ {pendientes} pendientes de confirmar</span>
                : `${citas.length} citas totales`}
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: C.primary, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Nueva Cita
          </button>
        </div>

        {/* MOBILE: tarjetas */}
        {isMobile ? (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {citas.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 13 }}>
                No hay citas. Usa "+ Nueva Cita" para agregar.
              </div>
            )}
            {citas.map(c => {
              const estadoColor = c.estado === "confirmada" ? C.green
                : c.estado === "cancelada" ? C.red
                : c.estado === "completada" ? C.blue : C.amber;
              const isBot = c.origen === "bot-ia";
              const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;
              return (
                <div key={c.id} style={{
                  background: C.bg,
                  border: `1px solid ${isBot ? "#A78BFA40" : C.border}`,
                  borderLeft: `3px solid ${estadoColor}`,
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{c.nombre || "—"}</div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{c.servicio || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.fecha || "—"}</div>
                      {c.hora && <div style={{ fontSize: 12, color: C.textDim }}>{c.hora}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill label={c.estado} color={estadoColor} />
                    {isBot && <Pill label="🤖 IA" color="#A78BFA" />}
                    {calLink && (
                      <a href={calLink} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#7DD3FC", textDecoration: "none", fontWeight: 700, background: "rgba(66,133,244,0.15)", padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(66,133,244,0.4)" }}>
                        📅 Google Calendar
                      </a>
                    )}
                    {c.estado === "pendiente_confirmacion" && (
                      <button onClick={() => updateCita(c.id, "confirmada")}
                        style={{ background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                        ✓ Confirmar
                      </button>
                    )}
                    {c.estado !== "cancelada" && (
                      <button onClick={() => updateCita(c.id, "cancelada")}
                        style={{ background: `${C.red}15`, color: C.red, border: `1px solid ${C.red}30`, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DESKTOP: tabla completa */
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
                    : c.estado === "completada" ? C.blue : C.amber;
                  const isBot = c.origen === "bot-ia";
                  const origenColor = isBot ? "#A78BFA" : C.blue;
                  const origenLabel = isBot ? "🤖 IA" : (c.origen || "manual");
                  const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;

                  return (
                    <tr key={c.id} style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: isBot ? "rgba(167,139,250,0.04)" : "transparent",
                    }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{c.nombre || `Paciente #${c.paciente_id}`}</div>
                        {c.telefono && <div style={{ fontSize: 11, color: C.textDim }}>{c.telefono}</div>}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.text }}>{c.servicio || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.text }}>{c.fecha} {c.hora && `· ${c.hora}`}</td>
                      <td style={{ padding: "12px 16px" }}><Pill label={origenLabel} color={origenColor} /></td>
                      <td style={{ padding: "12px 16px" }}><Pill label={c.estado} color={estadoColor} /></td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {calLink && (
                            <a href={calLink} target="_blank" rel="noopener noreferrer"
                              title="Agregar a Google Calendar"
                              style={{ background: "rgba(66,133,244,0.15)", color: "#7DD3FC", border: "1px solid rgba(66,133,244,0.4)", padding: "5px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                              📅 Calendar
                            </a>
                          )}
                          {c.estado === "pendiente_confirmacion" && (
                            <button onClick={() => updateCita(c.id, "confirmada")}
                              style={{ background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                              ✓ Confirmar
                            </button>
                          )}
                          {c.estado !== "cancelada" && (
                            <button onClick={() => updateCita(c.id, "cancelada")}
                              style={{ background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}40`, padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
// TAB: CONFIGURACIÓN — con dirty-state para no perder cambios
// ─────────────────────────────────────────────────────────────
function TabConfiguracion({ optica, refresh }) {
  const [edit, setEdit] = useState(optica);
  const [dirty, setDirty] = useState(false);   // true = hay cambios sin guardar
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Guarda el último payload guardado para que el useEffect no lo pise
  // cuando refresh() devuelve datos de BD que aún no tienen la columna servicios
  // (es decir, antes de ejecutar la migración 007)
  const lastSavedRef = useRef(null);

  // Solo sincronizar desde la BD si el usuario NO está editando activamente.
  // Merge con lastSavedRef para preservar campos que la BD aún no devuelve
  // (migración 007 pendiente → servicios/ciudad/etc. vendrán null hasta ejecutarla).
  useEffect(() => {
    if (!dirty) {
      setEdit({ ...(optica || {}), ...(lastSavedRef.current || {}) });
    }
  }, [optica, dirty]);

  const upd = (field, value) => {
    setEdit(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);

    // Asegurarse de que servicios/escalar_si sean arrays JSON válidos
    const serviciosClean = Array.isArray(edit.servicios)
      ? edit.servicios.filter(s => s && (s.nombre || s.precio))
      : [];
    const escalarSiClean = Array.isArray(edit.escalar_si)
      ? edit.escalar_si.filter(Boolean)
      : [];

    const payload = {
      nombre:              edit.nombre            || "",
      slogan:              edit.slogan            || "",
      direccion:           edit.direccion         || "",
      ciudad:              edit.ciudad            || "",
      telefono:            edit.telefono          || "",
      whatsapp:            edit.whatsapp          || "",
      horario:             edit.horario           || "",
      numero_escalada:     edit.numero_escalada   || "",
      bot_nombre:          edit.bot_nombre        || "Aukén",
      promocion_estrella:  edit.promocion_estrella|| "",
      servicios:           serviciosClean,
      escalar_si:          escalarSiClean,
    };

    const { error } = await supabase
      .from("opticas")
      .update(payload)
      .eq("id", optica.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      lastSavedRef.current = payload;  // ← preserva lo guardado ante refresh() con BD sin migración 007
      setDirty(false);                 // ← limpia dirty para que el useEffect sincronice (con merge)
      refresh();
      setTimeout(() => setSaved(false), 3000);
    } else {
      console.error("[config] Error guardando:", error);
      setSaveError(error.message);
    }
  };

  const updateServicio = (idx, key, value) => {
    const arr = [...(edit.servicios || [])];
    arr[idx] = { ...arr[idx], [key]: value };
    setEdit(prev => ({ ...prev, servicios: arr }));
    setDirty(true);
  };
  const addServicio = () => {
    setEdit(prev => ({ ...prev, servicios: [...(prev.servicios || []), { nombre: "", precio: "" }] }));
    setDirty(true);
  };
  const removeServicio = (idx) => {
    setEdit(prev => ({ ...prev, servicios: (prev.servicios || []).filter((_, i) => i !== idx) }));
    setDirty(true);
  };

  const Field = ({ label, value, onChange, ph }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={ph}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
    </div>
  );

  // Detectar si la BD aún no tiene la columna servicios (migración 007 pendiente)
  const needsMigration007 = optica && (optica.servicios === undefined || optica.servicios === null) && !lastSavedRef.current;

  return (
    <Card>
      {/* Banner migración 007 — se oculta automáticamente tras ejecutar la migración */}
      {needsMigration007 && (
        <div style={{
          background: `${C.amber}12`, border: `1px solid ${C.amber}40`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 20,
          fontSize: 12, color: C.amber, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Migración 007 requerida para guardar Servicios</div>
          <div style={{ color: C.textDim }}>
            Los cambios de nombre/horario/teléfono ya se guardan correctamente.
            Para que los <strong style={{ color: C.amber }}>servicios y precios</strong> persistan en la BD, ejecuta la migración en:
            <br />
            <strong style={{ color: C.text }}>Supabase → SQL Editor → migrations/007_opticas_completar_columnas.sql</strong>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>⚙️ Configuración de la Óptica</h3>
          {dirty && (
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, background: `${C.amber}15`, border: `1px solid ${C.amber}40`, padding: "3px 10px", borderRadius: 12 }}>
              ● Cambios sin guardar
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: C.textDim }}>Estos datos los usa el bot Aukén automáticamente en cada conversación.</p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Field label="Nombre comercial" value={edit.nombre} onChange={v => upd("nombre", v)} ph="Óptica Glow Vision" />
          <Field label="Slogan" value={edit.slogan} onChange={v => upd("slogan", v)} ph="calidad que inspira" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Field label="Dirección" value={edit.direccion} onChange={v => upd("direccion", v)} ph="Caupolicán #763" />
          <Field label="Ciudad" value={edit.ciudad} onChange={v => upd("ciudad", v)} ph="Punitaqui" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Teléfono general" value={edit.telefono} onChange={v => upd("telefono", v)} ph="+56 9 5493 2802" />
          <Field label="WhatsApp escalada (dueño)" value={edit.numero_escalada} onChange={v => upd("numero_escalada", v)} ph="+56954932802" />
        </div>

        <Field label="Horario de atención" value={edit.horario} onChange={v => upd("horario", v)} ph="Lunes a Viernes 11:30 a 18:30" />
        <Field label="Promoción estrella" value={edit.promocion_estrella} onChange={v => upd("promocion_estrella", v)} ph="Examen visual GRATIS al comprar tus lentes" />
        <Field label="Nombre del bot" value={edit.bot_nombre} onChange={v => upd("bot_nombre", v)} ph="Aukén" />

        {/* SERVICIOS */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>
            Servicios y precios ({(edit.servicios || []).length})
          </label>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {(edit.servicios || []).length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>
                Sin servicios. Agrega el primero con el botón de abajo.
              </div>
            )}
            {(edit.servicios || []).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={s.nombre || ""}
                  onChange={(e) => updateServicio(i, "nombre", e.target.value)}
                  placeholder="Nombre del servicio"
                  style={{ flex: 2, background: C.surfaceL, border: `1px solid ${C.border}`, color: C.text, padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none", minWidth: 0 }}
                />
                <input
                  value={s.precio || ""}
                  onChange={(e) => updateServicio(i, "precio", e.target.value)}
                  placeholder="$45.000"
                  style={{ flex: 1, background: C.surfaceL, border: `1px solid ${C.border}`, color: C.text, padding: "8px 12px", borderRadius: 6, fontSize: 12, outline: "none", minWidth: 0 }}
                />
                <button
                  onClick={() => removeServicio(i)}
                  title="Eliminar servicio"
                  style={{ background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}40`, width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                >×</button>
              </div>
            ))}
            <button
              onClick={addServicio}
              style={{ background: `${C.primary}15`, color: C.primary, border: `1px dashed ${C.primary}50`, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 2 }}
            >
              + Agregar servicio
            </button>
          </div>
        </div>

        {/* ERROR */}
        {saveError && (
          <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red }}>
            ⚠️ Error al guardar: {saveError}
            <br /><span style={{ color: C.textDim, fontSize: 11 }}>
              Si el error menciona una columna, ejecuta la migración 007 en Supabase SQL Editor.
            </span>
          </div>
        )}

        {/* GUARDAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            onClick={save}
            disabled={saving || !dirty}
            style={{
              background: saved ? C.green : dirty ? C.primary : `${C.primary}50`,
              color: "#000",
              border: "none", borderRadius: 8, padding: "12px 28px",
              fontSize: 14, fontWeight: 700,
              cursor: (saving || !dirty) ? "default" : "pointer",
              opacity: saving ? 0.6 : 1, transition: "all .2s",
            }}
          >
            {saving ? "Guardando..." : saved ? "✓ Guardado" : dirty ? "💾 Guardar cambios" : "Sin cambios"}
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <input placeholder="Nombre completo *" value={edit.nombre || ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="RUT" value={edit.rut || ""} onChange={(e) => setEdit({ ...edit, rut: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <input placeholder="Teléfono (+569...)" value={edit.telefono || ""} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            <input placeholder="Comuna" value={edit.comuna || ""} onChange={(e) => setEdit({ ...edit, comuna: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
          </div>

          <input placeholder="Producto Actual (Ej: Multifocales Blue)" value={edit.producto_actual || ""} onChange={(e) => setEdit({ ...edit, producto_actual: e.target.value })}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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

// ─────────────────────────────────────────────────────────────
// TAB: EN VIVO — Chat + Citas simultáneos en tiempo real
// ─────────────────────────────────────────────────────────────
function TabEnVivo({ citas, optica }) {
  const { isMobile } = useViewport();
  const [mensajes, setMensajes]     = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [loadError, setLoadError]   = useState(null);
  const [liveCount, setLiveCount]   = useState(0); // pulsos de actividad
  const msgEndRef = useRef(null);

  const loadMensajes = useCallback(async () => {
    const { data, error } = await supabase
      .from("mensajes_chat")
      .select("id, paciente_id, remitente, contenido, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      // Error más común: tabla no en realtime publication o columna faltante
      console.error("[TabEnVivo] Error cargando mensajes:", error.message);
      setLoadError(error.message);
      setLoadingMsgs(false);
      return;
    }

    setLoadError(null);
    setMensajes((data || []).reverse());
    setLoadingMsgs(false);
    setLiveCount(n => n + 1);
  }, []);

  useEffect(() => {
    loadMensajes();

    // Polling cada 8 segundos como fallback si el realtime no funciona aún
    // (ocurre antes de ejecutar la migración 008 que habilita la publicación)
    const pollInterval = setInterval(loadMensajes, 8000);

    // Suscripción realtime (requiere migración 008 ejecutada en Supabase)
    const sub = supabase.channel("enlive_mensajes_tab_v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat" }, () => {
        loadMensajes();
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[TabEnVivo] Realtime activo en mensajes_chat");
          clearInterval(pollInterval); // Realtime OK, cancelar polling
        }
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(sub);
    };
  }, [loadMensajes]);

  // Scroll al último mensaje al cargar
  useEffect(() => {
    if (!loadingMsgs && mensajes.length > 0) {
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, [loadingMsgs]);

  const today = new Date().toISOString().split("T")[0];
  const citasProximas = [...citas]
    .filter(c => c.fecha >= today && c.estado !== "cancelada")
    .sort((a, b) => `${a.fecha}${a.hora || ""}`.localeCompare(`${b.fecha}${b.hora || ""}`))
    .slice(0, 15);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: 16,
      alignItems: "start",
    }}>
      {/* ── Panel izquierdo: Chat en vivo ── */}
      <Card accent={C.primary} style={{ padding: 0 }}>
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: loadError ? C.red : C.green,
              boxShadow: `0 0 6px ${loadError ? C.red : C.green}`,
              display: "inline-block", animation: loadError ? "none" : "pulse 2s infinite",
            }} />
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>💬 Chat en vivo</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {loadError ? "⚠️ error" : `${mensajes.length} msgs`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={loadMensajes}
              style={{ fontSize: 10, color: C.textDim, background: `${C.border}50`, border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              ↻
            </button>
            <a href="/optica"
              style={{ fontSize: 11, color: C.primary, fontWeight: 700, background: `${C.primary}15`, border: `1px solid ${C.primary}40`, borderRadius: 6, padding: "4px 10px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Abrir monitor →
            </a>
          </div>
        </div>

        {/* Banner de error si la migración 008 no se ejecutó */}
        {loadError && (
          <div style={{
            background: `${C.red}15`, borderBottom: `1px solid ${C.red}30`,
            padding: "8px 14px", fontSize: 11, color: C.red, lineHeight: 1.5,
          }}>
            ⚠️ <strong>Error:</strong> {loadError}
            <br />
            <span style={{ color: C.textDim }}>Ejecuta la migración 008 en Supabase SQL Editor para activar realtime en mensajes_chat.</span>
          </div>
        )}

        <div style={{
          height: isMobile ? 300 : 440, overflowY: "auto",
          padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
          scrollbarWidth: "thin",
        }}>
          {loadingMsgs && (
            <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: 24 }}>Cargando mensajes...</div>
          )}
          {!loadingMsgs && !loadError && mensajes.length === 0 && (
            <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: 24 }}>
              Sin mensajes aún.<br />
              <span style={{ fontSize: 11 }}>Prueba el chat desde el Monitor. Los mensajes aparecerán aquí.</span>
            </div>
          )}
          {mensajes.map((m, i) => {
            const isBot = m.remitente === "bot";
            const isCliente = m.remitente === "cliente";
            return (
              <div key={m.id || i} style={{
                display: "flex",
                justifyContent: isBot ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  background: isBot ? `${C.primary}18` : isCliente ? C.surfaceL : `${C.blue}15`,
                  border: `1px solid ${isBot ? C.primary + "35" : C.border}`,
                  borderRadius: isBot ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  padding: "7px 12px",
                  fontSize: 12,
                  color: C.text,
                }}>
                  {!isBot && (
                    <div style={{ fontSize: 10, color: isCliente ? C.primary : C.blue, marginBottom: 3, fontWeight: 700, textTransform: "uppercase" }}>
                      {m.remitente}
                    </div>
                  )}
                  <div style={{ lineHeight: 1.5, wordBreak: "break-word" }}>{m.contenido}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 3, textAlign: isBot ? "right" : "left" }}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>
      </Card>

      {/* ── Panel derecho: Citas próximas ── */}
      <Card accent={C.blue} style={{ padding: 0 }}>
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: C.blue, boxShadow: `0 0 6px ${C.blue}`,
              display: "inline-block",
            }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>📅 Citas próximas</span>
          </div>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
            {citasProximas.filter(c => c.fecha === today).length} hoy · {citasProximas.length} total
          </span>
        </div>

        <div style={{ height: isMobile ? 300 : 440, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {citasProximas.length === 0 && (
            <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: 24 }}>
              No hay citas próximas.<br />
              <span style={{ fontSize: 11 }}>Las citas agendadas aparecerán aquí.</span>
            </div>
          )}
          {citasProximas.map((c, i) => {
            const isToday = c.fecha === today;
            const estadoColor = c.estado === "confirmada" ? C.green
              : c.estado === "cancelada" ? C.red
              : c.estado === "completada" ? C.blue
              : C.amber;
            const isBot = c.origen === "bot-ia";
            const calLink = buildCalLinkForCita(c, optica);

            return (
              <div key={c.id || i} style={{
                background: isToday ? `${C.primary}10` : C.bg,
                border: `1px solid ${isToday ? C.primary + "50" : C.border}`,
                borderRadius: 10, padding: "10px 14px",
                borderLeft: `3px solid ${isToday ? C.primary : estadoColor}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nombre || "Paciente"}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.servicio || "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: isToday ? C.primary : C.text,
                      background: isToday ? `${C.primary}15` : "transparent",
                      padding: isToday ? "2px 6px" : "0",
                      borderRadius: 4,
                    }}>
                      {isToday ? "📍 HOY" : c.fecha}
                    </div>
                    {c.hora && (
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 1, fontWeight: 600 }}>{c.hora}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill label={c.estado} color={estadoColor} />
                  {isBot && <Pill label="🤖 IA" color="#A78BFA" />}
                  {calLink && (
                    <a
                      href={calLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: "auto",
                        fontSize: 11, color: "#7DD3FC",
                        textDecoration: "none", fontWeight: 700,
                        background: "rgba(66,133,244,0.15)",
                        padding: "3px 9px", borderRadius: 4,
                        border: "1px solid rgba(66,133,244,0.4)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      📅 Google Calendar
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// =============================================================
// COMPONENTE PRINCIPAL
// =============================================================
export default function AukenOpticaDashboard() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useViewport();

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

  // Auto-refresh cada 10 segundos como fallback
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const { toast } = useToaster();
  const initialLoadDone = useRef(false);

  // Real-time multi-dispositivo + notificaciones toast
  useEffect(() => {
    const sub = supabase.channel("dashboard_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pacientes" }, (p) => {
        refresh();
        if (initialLoadDone.current) {
          toast.success("Paciente registrado", { sub: p.new.nombre || "Nuevo paciente añadido" });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "citas" }, (p) => {
        refresh();
        if (initialLoadDone.current) {
          const isBot = p.new.origen === "bot-ia";
          const fechaFmt = `${p.new.fecha || ""}${p.new.hora ? " · " + p.new.hora : ""}`;
          toast.cita(isBot ? "🤖 IA agendó una cita" : "Nueva cita agendada", {
            sub: `${p.new.nombre || "Paciente"} — ${p.new.servicio || "servicio"} — ${fechaFmt}`,
            duration: 8000,
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pacientes" }, () => refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "citas" },     () => refresh())
      .on("postgres_changes", { event: "*",      schema: "public", table: "opticas" },   () => refresh())
      .subscribe();
    setTimeout(() => { initialLoadDone.current = true; }, 1500);
    return () => supabase.removeChannel(sub);
  }, [refresh, toast]);

  // Title dinámico (también después de useState)
  useEffect(() => {
    if (optica) document.title = `${optica.nombre} | Aukén`;
  }, [optica?.nombre]);

  // Acción WhatsApp — normaliza número chileno y abre wa.me
  // NO es async porque window.open necesita estar en el contexto directo del evento
  const handleSendWhatsApp = useCallback((paciente) => {
    if (!paciente?.telefono) {
      alert("Este paciente no tiene teléfono registrado.");
      return;
    }

    // Normalizar número: quitar todo lo que no sea dígito
    let phone = paciente.telefono.replace(/\D/g, "");
    // Si empieza con 0, quitarlo (ej: 09xxxxxxxx → 9xxxxxxxx)
    if (phone.startsWith("0")) phone = phone.slice(1);
    // Si tiene 8 o 9 dígitos sin prefijo de país, asumir Chile (+56)
    if (phone.length <= 9 && !phone.startsWith("56")) phone = "56" + phone;
    // Si empieza con 569... ya está correcto; si empieza con 56 + 8 dígitos también.

    const nombre = (paciente.nombre || "Estimado").split(" ")[0];
    const msg = encodeURIComponent(
      `Hola ${nombre} 👋, te escribimos de ${optica?.nombre || "la óptica"}. ¿En qué te podemos ayudar?`
    );

    // window.open con rel noopener — más confiable que location.href en desktop
    // En mobile iOS/Android abre la app de WhatsApp directamente
    const waUrl = `https://wa.me/${phone}?text=${msg}`;
    const win = window.open(waUrl, "_blank", "noopener,noreferrer");
    // Fallback por si el popup blocker lo bloqueó
    if (!win) window.location.href = waUrl;
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 6px; }
      `}</style>

      {/* TOPNAV */}
      <nav style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: isMobile ? "0 12px" : "0 28px",
        height: isMobile ? 48 : 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50, gap: 8,
        boxShadow: C.shadowSm,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, background: `linear-gradient(135deg, ${C.primary}, ${C.blue})`, borderRadius: C.radius, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 14 : 16, flexShrink: 0, boxShadow: `0 0 12px ${C.primarySoft}` }}>👁️</div>
          <span style={{ fontFamily: C.fontSans, fontWeight: 700, fontSize: isMobile ? 14 : 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: '-0.02em' }}>{optica?.nombre || "AUKÉN"}</span>
          {!isMobile && (
            <>
              <span style={{ color: C.textMuted, margin: "0 4px" }}>·</span>
              <span style={{ fontSize: 12, color: C.textDim }}>Dashboard</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, flexShrink: 0 }}>
          <button onClick={() => navigate("/optica")}
            title="Ir al monitor de conversaciones"
            style={{ background: C.primarySoft, border: `1px solid ${C.primaryRing}`, color: C.primary, borderRadius: C.radius, padding: isMobile ? "5px 10px" : "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: '-0.01em', transition: `background ${C.dur} ${C.ease}` }}>
            💬 {isMobile ? "" : "Chat"}
          </button>
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.green, fontWeight: 500, background: C.greenSoft, padding: "4px 10px", borderRadius: C.radiusSm, border: `1px solid rgba(52,211,153,0.2)` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}80` }} />
              Activo
            </div>
          )}
          <button onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: C.radius, padding: isMobile ? "5px 10px" : "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: '-0.01em' }}>
            {isMobile ? "Salir" : "Cerrar sesión"}
          </button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{ padding: isMobile ? "12px 10px 24px" : "24px 32px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, paddingBottom: 0, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            ["metricas",  "📊 Métricas"],
            ["enlive",    isMobile ? "🔴 Vivo" : "🔴 En Vivo"],
            ["pacientes", isMobile ? `👥 (${pacientes.length})` : `👥 Pacientes (${pacientes.length})`],
            ["citas",     isMobile ? `📅 (${citas.filter(c => c.estado === "pendiente_confirmacion").length})` : `📅 Citas (${citas.filter(c => c.estado === "pendiente_confirmacion").length})`],
            ["config",    isMobile ? "⚙️" : "⚙️ Config"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: "transparent",
              color: tab === id ? C.text : C.textDim,
              border: "none",
              borderBottom: tab === id ? `2px solid ${C.primary}` : "2px solid transparent",
              borderRadius: 0,
              padding: isMobile ? "8px 12px" : "9px 16px",
              fontSize: isMobile ? 12 : 13,
              fontWeight: tab === id ? 600 : 400,
              cursor: "pointer",
              transition: `color ${C.dur} ${C.ease}, border-color ${C.dur} ${C.ease}`,
              whiteSpace: "nowrap",
              letterSpacing: '-0.01em',
              marginBottom: -1,
            }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "metricas" && <TabMetricas optica={optica} stats={stats} />}
        {tab === "enlive"   && <TabEnVivo citas={citas} optica={optica} />}
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
