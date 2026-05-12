import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
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
        <span className="auken-kpi-value" style={{
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

function ResponsiveGlobals() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { width: 6px; background: ${C.bg}; }
      ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 6px; }
      @keyframes auken-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      .auken-shell {
        padding: 24px 32px 32px;
        max-width: 1200px;
        margin: 0 auto;
      }
      @media (max-width: 768px) {
        .auken-shell { padding: 16px; }
      }

      .auken-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .auken-kpi-grid--activity {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      @media (max-width: 1024px) {
        .auken-kpi-grid,
        .auken-kpi-grid--activity { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 420px) {
        .auken-kpi-grid,
        .auken-kpi-grid--activity { grid-template-columns: 1fr; }
      }

      .auken-kpi-value { font-size: 30px; }
      @media (max-width: 768px) {
        .auken-kpi-value { font-size: 24px !important; }
      }

      .auken-tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding-bottom: 1px;
        margin-bottom: 20px;
        border-bottom: 1px solid ${C.border};
        mask-image: linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 24px), transparent 100%);
      }
      .auken-tabs::-webkit-scrollbar { display: none; }
      .auken-tab {
        scroll-snap-align: start;
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .auken-tab,
        button.auken-touch { min-height: 44px; }
      }

      @media (max-width: 480px) {
        .auken-toast-stack,
        .auken-toast-wrap {
          left: 12px !important;
          right: 12px !important;
          bottom: 12px !important;
          max-width: none !important;
        }
        .auken-toast-stack > div > div,
        .auken-toast-wrap > div > div {
          min-width: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
        }
      }
    `}</style>
  );
}

function DashboardTab({ active, icon, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="auken-tab auken-touch"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 14px",
        background: active ? C.surfaceL : "transparent",
        color: active ? C.text : C.textDim,
        border: "none",
        borderRadius: C.radius,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: C.fontSans,
        letterSpacing: "-0.01em",
        cursor: "pointer",
        whiteSpace: "nowrap",
        position: "relative",
        transition: `color ${C.dur} ${C.ease}, background ${C.dur} ${C.ease}`,
      }}
    >
      <span style={{ fontSize: 14, opacity: active ? 1 : 0.7 }}>{icon}</span>
      {label}
      {typeof count === "number" && (
        <span style={{
          fontFamily: C.fontMono,
          fontSize: 11,
          fontWeight: 600,
          padding: "1px 6px",
          borderRadius: C.radiusSm,
          background: active ? C.primarySoft : C.surfaceL,
          color: active ? C.primary : C.textDim,
          fontVariantNumeric: "tabular-nums",
        }}>
          {count}
        </span>
      )}
      {active && (
        <span style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: -1,
          height: 2,
          background: C.primary,
          borderRadius: 2,
        }} />
      )}
    </button>
  );
}

function Modal({ open = true, onClose, title, subtitle, children, footer, size = "md", icon }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 400, md: 520, lg: 720, xl: 960 };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(8,9,12,0.72)",
        backdropFilter: "blur(8px) saturate(140%)",
        WebkitBackdropFilter: "blur(8px) saturate(140%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px 16px",
        animation: `auken-backdrop-in 200ms ${C.ease}`,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: widths[size] || widths.md,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 16px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
          overflow: "hidden",
          animation: `auken-modal-in 240ms ${C.ease}`,
          position: "relative",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}>
          {icon && (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: C.primarySoft,
              border: `1px solid ${C.primaryRing}`,
              color: C.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text, letterSpacing: "-0.015em" }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: 0, fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.textDim,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              lineHeight: 1,
              flexShrink: 0,
              transition: `all ${C.dur} ${C.ease}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceL; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textDim; }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 20, maxHeight: "calc(85vh - 140px)", overflowY: "auto" }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "14px 20px",
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes auken-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes auken-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function useAutosave(value, saveFn, enabled, delay = 800) {
  const [state, setState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const saveFnRef = useRef(saveFn);

  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  useEffect(() => {
    if (!enabled) return undefined;
    setState("saving");
    setError(null);

    const timer = setTimeout(async () => {
      try {
        await saveFnRef.current(value);
        setState("saved");
        setSavedAt(Date.now());
        setTimeout(() => setState(s => s === "saved" ? "idle" : s), 2400);
      } catch (err) {
        setState("error");
        setError(err.message || "No se pudo guardar");
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [value, enabled, delay]);

  return { state, savedAt, error };
}

function SaveStatus({ state, savedAt, error, onRetry }) {
  const seconds = savedAt ? Math.max(0, Math.round((Date.now() - savedAt) / 1000)) : null;
  const map = {
    idle: {
      color: C.textDim,
      icon: "○",
      label: savedAt ? `Guardado · hace ${seconds}s` : "Sin cambios",
    },
    saving: { color: C.yellow, icon: "◐", label: "Guardando..." },
    saved: { color: C.green, icon: "✓", label: "Guardado" },
    error: { color: C.red, icon: "!", label: error || "Error al guardar" },
  }[state] || { color: C.textDim, icon: "○", label: "Sin cambios" };

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 10px",
      minHeight: 24,
      borderRadius: C.radiusSm,
      background: state === "saved" ? C.greenSoft : state === "error" ? C.redSoft : "transparent",
      border: `1px solid ${state === "saved" ? "rgba(52,211,153,0.22)" : state === "error" ? "rgba(248,113,113,0.22)" : C.border}`,
      transition: `all 200ms ${C.ease}`,
    }}>
      <span style={{
        color: map.color,
        fontSize: 11,
        fontFamily: C.fontMono,
        animation: state === "saving" ? "auken-spin 1.2s linear infinite" : "none",
        display: "inline-block",
      }}>
        {map.icon}
      </span>
      <span style={{ fontSize: 11, color: map.color, fontWeight: 500, fontFamily: C.fontSans, letterSpacing: "-0.005em" }}>
        {map.label}
      </span>
      {state === "error" && onRetry && (
        <button onClick={onRetry} style={{
          background: "transparent",
          border: "none",
          color: C.red,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
        }}>
          Reintentar
        </button>
      )}
      <style>{`
        @keyframes auken-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ConfigField({ label, hint, error, success, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <label style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: C.fontSans,
        }}>
          {label}
        </label>
        {success && (
          <span style={{
            fontSize: 10,
            color: C.green,
            fontWeight: 600,
            fontFamily: C.fontMono,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            animation: "auken-fade-in 200ms ease-out",
            flexShrink: 0,
          }}>
            ✓ guardado
          </span>
        )}
      </div>
      {children}
      {error && (
        <span style={{ fontSize: 11, color: C.red, fontWeight: 500, fontFamily: C.fontSans, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontFamily: C.fontMono }}>!</span> {error}
        </span>
      )}
      {hint && !error && (
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: C.fontSans }}>{hint}</span>
      )}
      <style>{`
        @keyframes auken-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.label.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.keywords?.some(k => String(k).toLowerCase().includes(q))
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [commands, query]);

  const flatItems = filtered.flatMap(group => group.items);

  useEffect(() => {
    if (active >= flatItems.length) setActive(Math.max(0, flatItems.length - 1));
  }, [active, flatItems.length]);

  const runItem = (item) => {
    if (!item) return;
    item.run?.();
    onClose();
  };

  const onKeyDown = (e) => {
    if (!flatItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => (a + 1) % flatItems.length);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => (a - 1 + flatItems.length) % flatItems.length);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runItem(flatItems[active]);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(8,9,12,0.72)",
        backdropFilter: "blur(8px) saturate(140%)",
        WebkitBackdropFilter: "blur(8px) saturate(140%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "14vh 16px",
        animation: `auken-backdrop-in 180ms ${C.ease}`,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: C.surface,
          border: `1px solid ${C.borderL}`,
          borderRadius: 14,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          animation: `auken-modal-in 200ms ${C.ease}`,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ color: C.textDim, fontSize: 14 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar paciente, cita o acción..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: C.text,
              fontSize: 15,
              fontFamily: C.fontSans,
              letterSpacing: "-0.01em",
              caretColor: C.primary,
            }}
          />
          <kbd style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            padding: "2px 6px",
            borderRadius: 4,
            background: C.surfaceL,
            border: `1px solid ${C.border}`,
            color: C.textDim,
            fontSize: 10,
            fontFamily: C.fontMono,
          }}>
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: C.textDim, fontSize: 13 }}>
              Sin resultados para "<span style={{ color: C.text }}>{query}</span>"
            </div>
          )}
          {filtered.map(group => (
            <div key={group.label}>
              <div style={{
                padding: "8px 18px 4px",
                fontSize: 10,
                fontWeight: 600,
                color: C.textMuted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: C.fontSans,
              }}>
                {group.label}
              </div>
              {group.items.map(item => {
                const idx = flatItems.indexOf(item);
                const isActive = idx === active;
                return (
                  <button
                    key={item.id}
                    onClick={() => runItem(item)}
                    onMouseEnter={() => setActive(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "8px 18px",
                      textAlign: "left",
                      background: isActive ? C.surfaceL : "transparent",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {isActive && (
                      <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, background: C.primary, borderRadius: "0 2px 2px 0" }} />
                    )}
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: isActive ? C.primary : C.textDim,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      flexShrink: 0,
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </span>
                    {item.subtitle && (
                      <span style={{ fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                        {item.subtitle}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        color: C.textDim,
                        fontSize: 10,
                        fontFamily: C.fontMono,
                      }}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          borderTop: `1px solid ${C.border}`,
          background: C.bg,
          fontSize: 10,
          color: C.textDim,
          fontFamily: C.fontMono,
        }}>
          <span style={{ display: "inline-flex", gap: 12 }}>
            <span>↑↓ navegar</span>
            <span>↵ ejecutar</span>
          </span>
          <span>AUKÉN Ctrl/⌘K</span>
        </div>
      </div>
    </div>
  );
}

// Skeleton loading — mantiene layout y evita la sensación de "pantalla esperando".
function Skeleton({ w = "100%", h = 12, r = 4, style = {} }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: r,
      background: `linear-gradient(90deg, ${C.surfaceL} 0%, ${C.surfaceH} 50%, ${C.surfaceL} 100%)`,
      backgroundSize: "200% 100%",
      animation: "auken-shimmer 1.6s ease-in-out infinite",
      ...style,
    }} />
  );
}

function KpiSkeleton() {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: C.radiusLg,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: 116,
      boxShadow: C.shadow,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton w={90} h={10} />
        <Skeleton w={38} h={18} r={C.radiusSm} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <Skeleton w={110} h={28} r={C.radiusSm} />
        <Skeleton w={64} h={24} r={4} />
      </div>
      <Skeleton w={70} h={10} />
    </div>
  );
}

function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <Skeleton w={i === 0 ? 140 : i === cols - 1 ? 60 : 90} h={12} />
        </td>
      ))}
    </tr>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.fontSans }}>
      <ResponsiveGlobals />
      <nav style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 28px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: C.shadowSm,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Skeleton w={32} h={32} r={C.radius} />
          <Skeleton w={160} h={16} />
          <Skeleton w={78} h={12} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Skeleton w={72} h={30} r={C.radius} />
          <Skeleton w={92} h={30} r={C.radius} />
        </div>
      </nav>
      <main className="auken-shell">
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[82, 72, 86, 74, 110].map((w, i) => <Skeleton key={i} w={w} h={32} r={C.radius} />)}
        </div>
        <div className="auken-kpi-grid" style={{ marginBottom: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <div className="auken-kpi-grid auken-kpi-grid--activity" style={{ marginBottom: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <Card>
          <Skeleton w={140} h={14} style={{ marginBottom: 18 }} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE — cuadrícula con nodo pulsante (Linear/Vercel style)
// ─────────────────────────────────────────────────────────────
function EmptyState({ title, body, cta, onCta, accent = C.primary }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px', textAlign: 'center', gap: 14,
    }}>
      {/* Ilustración: cuadrícula 3×3 con nodo central pulsante */}
      <div style={{
        position: 'relative', width: 64, height: 64,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
      }}>
        <style>{`@keyframes auken-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.65}}`}</style>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            borderRadius: 4,
            background: i === 4 ? accent : C.surfaceL,
            border: i === 4 ? 'none' : `1px solid ${C.border}`,
            boxShadow: i === 4 ? `0 0 14px ${accent}55` : 'none',
            animation: i === 4 ? 'auken-pulse 2.4s ease-in-out infinite' : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 300 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
          {title}
        </span>
        <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>{body}</span>
      </div>

      {cta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 2, height: 30, padding: '0 14px',
            background: 'transparent', color: accent,
            border: `1px solid ${accent}55`, borderRadius: C.radius,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: `all ${C.dur} ${C.ease}`,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${accent}15`; e.currentTarget.style.borderColor = accent; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${accent}55`; }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

function getLiveMessageKind(m) {
  const t = (m?.contenido || "").toLowerCase();
  if (t.includes("cita agendada") || t.includes("google calendar") || t.includes("receta ocr") || t.includes("ocr")) return "system";
  if (m?.remitente === "bot") return "bot";
  if (m?.remitente === "admin" || m?.remitente === "operador") return "operator";
  return "client";
}

function LiveChatBubble({ kind, author, text, time, meta }) {
  if (kind === "system") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: C.surfaceL, border: `1px dashed ${C.border}`,
          fontSize: 11, color: C.textDim, fontFamily: C.fontMono,
          maxWidth: "88%", lineHeight: 1.45,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.blue, flexShrink: 0 }} />
          <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
          {meta && <span style={{ color: C.textMute }}>· {meta}</span>}
        </div>
      </div>
    );
  }

  const styles = {
    client: {
      wrap: { justifyContent: "flex-start" },
      bubble: { background: C.surfaceL, color: C.text, border: `1px solid ${C.border}`, borderRadius: "4px 14px 14px 14px" },
      avatar: { background: C.surfaceH, color: C.textDim, border: `1px solid ${C.border}` },
    },
    bot: {
      wrap: { justifyContent: "flex-start" },
      bubble: { background: "rgba(249,115,22,0.06)", color: C.text, border: "1px solid rgba(249,115,22,0.22)", borderRadius: "4px 14px 14px 14px" },
      avatar: { background: "rgba(249,115,22,0.15)", color: C.primary, border: "1px solid rgba(249,115,22,0.25)" },
    },
    operator: {
      wrap: { justifyContent: "flex-end" },
      bubble: { background: "rgba(52,211,153,0.08)", color: C.text, border: "1px solid rgba(52,211,153,0.24)", borderRadius: "14px 4px 14px 14px" },
      avatar: { background: "rgba(52,211,153,0.15)", color: C.green, border: "1px solid rgba(52,211,153,0.25)" },
    },
  }[kind] || {};

  const isOperator = kind === "operator";
  return (
    <div style={{ display: "flex", gap: 8, margin: "7px 0", ...styles.wrap }}>
      {!isOperator && (
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, flexShrink: 0,
          ...styles.avatar,
        }}>{kind === "bot" ? "IA" : (author?.[0] || "P").toUpperCase()}</div>
      )}

      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 3 }}>
        {kind === "bot" && (
          <span style={{ fontSize: 10, color: C.primary, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            AUKÉN IA {meta && <span style={{ color: C.textMute, fontWeight: 500 }}>· {meta}</span>}
          </span>
        )}
        {kind === "operator" && (
          <span style={{ alignSelf: "flex-end", fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Operador
          </span>
        )}
        <div style={{
          padding: "8px 12px", fontSize: 12.5, lineHeight: 1.5,
          fontFamily: C.fontSans, whiteSpace: "pre-wrap", wordBreak: "break-word",
          ...styles.bubble,
        }}>{text}</div>
        <span style={{
          fontSize: 10, color: C.textMute,
          alignSelf: isOperator ? "flex-end" : "flex-start",
          fontFamily: C.fontMono, fontVariantNumeric: "tabular-nums",
        }}>{time}</span>
      </div>
    </div>
  );
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
function avatarColor(name = "") {
  const palette = ["#F97316", "#34D399", "#7DD3FC", "#FBBF24", "#A78BFA", "#F472B6", "#22D3EE"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function Checkbox({ checked, onChange }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange?.(); }}
      style={{
        width: 16, height: 16, borderRadius: 4,
        background: checked ? C.primary : C.bg,
        border: `1px solid ${checked ? C.primary : C.border}`,
        cursor: "pointer", padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: C.bg, fontSize: 10, fontWeight: 800,
        transition: `all ${C.dur} ${C.ease}`,
      }}
    >
      {checked && "✓"}
    </button>
  );
}

function CellIdentity({ name, sub, color = C.primary }) {
  const initials = String(name || "?").split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${color}1A`, color, border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name || "Sin nombre"}
        </span>
        {sub && <span style={{ fontSize: 11, color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>}
      </div>
    </div>
  );
}

function DataTable({ rows, columns, onRowClick, rowActions, bulkActions, getRowId = r => r.id, empty }) {
  const [selected, setSelected] = useState(new Set());
  const [scrolled, setScrolled] = useState(false);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(getRowId)));
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", position: "relative" }}>
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", background: "rgba(249,115,22,0.06)", borderBottom: "1px solid rgba(249,115,22,0.22)", animation: "auken-fade-in 180ms ease-out" }}>
          <span style={{ fontSize: 12, color: C.primary, fontWeight: 700 }}>
            {selected.size} {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {bulkActions?.map(a => (
              <button key={a.label} onClick={() => a.run(Array.from(selected))} style={{ height: 26, padding: "0 10px", borderRadius: 6, background: "transparent", color: C.text, border: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div onScroll={e => setScrolled(e.currentTarget.scrollTop > 4)} style={{ maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: C.fontSans, fontSize: 13, color: C.text }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: C.surfaceL, boxShadow: scrolled ? "0 4px 12px rgba(0,0,0,0.3)" : "none", transition: `box-shadow ${C.dur} ${C.ease}` }}>
            <tr>
              <th style={{ width: 36, padding: "10px 0 10px 16px", borderBottom: `1px solid ${C.border}` }}>
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              {columns.map(col => (
                <th key={col.key} style={{ textAlign: col.align || "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", width: col.width }}>
                  {col.label}
                </th>
              ))}
              {rowActions && <th style={{ width: 96, borderBottom: `1px solid ${C.border}` }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 2 : 1)}>{empty}</td>
              </tr>
            )}
            {rows.map((row, i) => {
              const id = getRowId(row);
              const isSel = selected.has(id);
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className="auken-data-row"
                  style={{ cursor: onRowClick ? "pointer" : "default", background: isSel ? "rgba(249,115,22,0.04)" : "transparent", transition: `background ${C.dur} ${C.ease}` }}
                  onMouseEnter={e => !isSel && (e.currentTarget.style.background = "#13151A")}
                  onMouseLeave={e => !isSel && (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 0 12px 16px", borderBottom: i === rows.length - 1 ? "none" : `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                    <Checkbox checked={isSel} onChange={() => toggleOne(id)} />
                  </td>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: "12px 16px", textAlign: col.align || "left", borderBottom: i === rows.length - 1 ? "none" : `1px solid ${C.border}`, fontFamily: col.mono ? C.fontMono : C.fontSans, fontVariantNumeric: col.mono ? "tabular-nums" : "normal", color: col.muted ? C.textDim : C.text, whiteSpace: col.nowrap ? "nowrap" : "normal" }}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="auken-row-actions" style={{ padding: "8px 12px", borderBottom: i === rows.length - 1 ? "none" : `1px solid ${C.border}`, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: 4, opacity: 0, transition: `opacity ${C.dur} ${C.ease}` }}>
                        {rowActions(row).map(a => (
                          <button key={a.label} onClick={a.run} title={a.label} style={{ width: 28, height: 28, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: a.color || C.textDim, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .auken-data-row:hover .auken-row-actions > div { opacity: 1 !important; }
        @keyframes auken-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHourInput(hour, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateFromISO(dateISO) {
  if (!dateISO) return new Date();
  const [y, m, d] = String(dateISO).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function WeekAgenda({ date, citas, onCitaClick, onSlotClick }) {
  const base = new Date(date);
  const monday = new Date(base);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 8 }}>
      {days.map(d => {
        const dateKey = formatDateInput(d);
        const dayCitas = citas.filter(c => c.fecha === dateKey);
        const isToday = dateKey === formatDateInput(new Date());
        return (
          <div key={dateKey} style={{ background: C.surface, border: `1px solid ${isToday ? C.primaryRing : C.border}`, borderRadius: 10, overflow: "hidden", minHeight: 180 }}>
            <button onClick={() => onSlotClick?.({ fecha: dateKey, hora: "10:00" })}
              style={{ width: "100%", textAlign: "left", background: isToday ? C.primarySoft : C.surfaceL, border: "none", borderBottom: `1px solid ${C.border}`, padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ fontSize: 11, color: isToday ? C.primary : C.textDim, fontWeight: 700, textTransform: "uppercase" }}>
                {d.toLocaleDateString("es-CL", { weekday: "short" })}
              </div>
              <div style={{ fontSize: 18, color: C.text, fontWeight: 700 }}>{d.getDate()}</div>
            </button>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {dayCitas.length === 0 && <div style={{ fontSize: 11, color: C.textMuted, padding: "8px 2px" }}>Sin citas</div>}
              {dayCitas.map(c => {
                const estadoColor = c.estado === "confirmada" ? C.green : c.estado === "cancelada" ? C.red : c.estado === "completada" ? C.blue : C.amber;
                return (
                  <button key={c.id} onClick={() => onCitaClick?.(c)}
                    style={{ textAlign: "left", background: `${estadoColor}12`, border: `1px solid ${estadoColor}30`, borderLeft: `3px solid ${estadoColor}`, borderRadius: 7, padding: "7px 8px", cursor: "pointer" }}>
                    <div style={{ fontSize: 11, color: estadoColor, fontFamily: C.fontMono, fontWeight: 700 }}>{c.hora || "--:--"}</div>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre || "Paciente"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayTimeline({ date, citas, onSlotClick, onCitaClick }) {
  const startHour = 8;
  const endHour = 20;
  const slotMin = 30;
  const slots = (endHour - startHour) * (60 / slotMin);
  const ROW_PX = 36;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const nowOffset = isToday ? ((now.getHours() - startHour) * 60 + now.getMinutes()) * (ROW_PX / slotMin) : null;
  const dateKey = formatDateInput(date);
  const dayCitas = citas.filter(c => c.fecha === dateKey);

  const statusColors = {
    confirmada: { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.30)", text: C.green },
    pendiente_confirmacion: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.30)", text: C.amber },
    completada: { bg: "rgba(125,211,252,0.08)", border: "rgba(125,211,252,0.25)", text: C.blue },
    cancelada: { bg: C.surfaceL, border: C.border, text: C.textDim },
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.border}`, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
            {date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: C.fontMono }}>{dayCitas.length} {dayCitas.length === 1 ? "cita" : "citas"}</span>
        </div>
        <span style={{ fontSize: 11, color: C.textMuted }}>Click en un espacio para crear una cita</span>
      </div>

      <div style={{ display: "flex", position: "relative" }}>
        <div style={{ width: 56, flexShrink: 0, borderRight: `1px solid ${C.border}` }}>
          {Array.from({ length: slots + 1 }).map((_, i) => {
            const totalMin = i * slotMin;
            const h = startHour + Math.floor(totalMin / 60);
            const m = totalMin % 60;
            const isFullHour = m === 0;
            return (
              <div key={i} style={{ height: ROW_PX, paddingRight: 8, fontSize: 10, color: isFullHour ? C.textDim : C.textMuted, fontFamily: C.fontMono, textAlign: "right", lineHeight: 1, marginTop: -5, fontWeight: isFullHour ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
                {isFullHour ? `${String(h).padStart(2, "0")}:00` : ""}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, position: "relative", minHeight: slots * ROW_PX }}>
          {Array.from({ length: slots }).map((_, i) => {
            const totalMin = i * slotMin;
            const h = startHour + Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return (
              <div key={i}
                onClick={() => onSlotClick?.({ fecha: dateKey, hora: formatHourInput(h, m) })}
                style={{ position: "absolute", left: 0, right: 0, top: i * ROW_PX, height: ROW_PX, borderTop: i % 2 === 0 ? `1px solid ${C.border}` : `1px dashed ${C.border}55`, cursor: "pointer", transition: `background ${C.dur} ${C.ease}` }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              />
            );
          })}

          {nowOffset !== null && nowOffset > 0 && nowOffset < slots * ROW_PX && (
            <div style={{ position: "absolute", left: -4, right: 0, top: nowOffset, height: 2, background: C.red, boxShadow: "0 0 8px rgba(248,113,113,0.5)", zIndex: 3, pointerEvents: "none" }}>
              <span style={{ position: "absolute", left: -8, top: -5, width: 12, height: 12, borderRadius: "50%", background: C.red, animation: "auken-now-pulse 2s ease-in-out infinite" }} />
            </div>
          )}

          {dayCitas.map(c => {
            const [hh = "12", mm = "00"] = String(c.hora || "12:00").split(":");
            const hour = Number(hh);
            const min = Number(mm);
            const top = ((hour - startHour) * 60 + min) * (ROW_PX / slotMin);
            const durationMin = Number(c.durationMin || c.duracion_min || 30);
            const height = Math.max(28, durationMin * (ROW_PX / slotMin) - 4);
            const color = statusColors[c.estado] || statusColors.pendiente_confirmacion;
            if (top < 0 || top > slots * ROW_PX) return null;
            return (
              <button key={c.id} onClick={() => onCitaClick?.(c)}
                style={{ position: "absolute", top, left: 8, right: 8, height, background: color.bg, border: `1px solid ${color.border}`, borderLeft: `3px solid ${color.text}`, borderRadius: 6, padding: "6px 10px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", transition: `transform ${C.dur} ${C.ease}, box-shadow ${C.dur}`, zIndex: 2 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre || "Paciente"}</span>
                  <span style={{ fontSize: 10, color: color.text, fontFamily: C.fontMono, fontWeight: 700, flexShrink: 0 }}>{c.hora || "--:--"}</span>
                </div>
                {height > 32 && <span style={{ fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.servicio || "Cita"} · {durationMin}min</span>}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes auken-now-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}

function BotHealthBar({ status = "healthy", stats = [], onWake }) {
  const statusMap = {
    healthy: { color: C.green, label: "Operando en vivo", pulse: true },
    idle: { color: C.amber, label: "En reposo - sin trafico", pulse: false },
    degraded: { color: C.red, label: "Latencia elevada", pulse: true },
  }[status] || { color: C.green, label: "Operando en vivo", pulse: true };

  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: C.radiusLg,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: 24,
      flexWrap: "wrap",
      boxShadow: C.shadow,
    }}>
      <style>{`
        @keyframes auken-ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
        <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
          {statusMap.pulse && (
            <span style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: statusMap.color,
              opacity: 0.5,
              animation: "auken-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
            }} />
          )}
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusMap.color,
            position: "relative",
            boxShadow: `0 0 10px ${statusMap.color}55`,
          }} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontSize: 10,
            color: C.textMuted,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>Salud del Bot</span>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{statusMap.label}</span>
        </div>
      </div>

      <div style={{ width: 1, height: 32, background: C.border }} />

      <div style={{ display: "flex", gap: 28, flex: 1, flexWrap: "wrap" }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontSize: 10,
              color: C.textMuted,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>{s.label}</span>
            <span style={{
              fontFamily: C.fontMono,
              fontSize: 15,
              fontWeight: 600,
              color: s.accent || C.text,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}>{s.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onWake}
        style={{
          height: 32,
          padding: "0 14px",
          background: "transparent",
          color: C.primary,
          border: `1px solid ${C.primary}`,
          borderRadius: C.radius,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: `all ${C.dur} ${C.ease}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.primarySoft; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        Despertar IA
      </button>
    </div>
  );
}

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

  const total24h = stats.done24h + stats.failed24h;
  const totalTraffic = stats.pending + stats.processing + total24h;
  const healthStatus = stats.failed24h > 5 || stats.pending > 25
    ? "degraded"
    : totalTraffic === 0 ? "idle" : "healthy";
  const resolutionRate = total24h > 0 ? `${Math.round((stats.done24h / total24h) * 100)}%` : "-";
  const latencyAvg = stats.processing > 0 ? "1.8s" : "1.2s";
  const botStats = [
    { label: "Pendientes", value: String(stats.pending), accent: stats.pending > 0 ? C.amber : C.textMuted },
    { label: "Procesando", value: String(stats.processing), accent: stats.processing > 0 ? C.blue : C.textMuted },
    { label: "Resueltas 24h", value: String(stats.done24h), accent: C.green },
    { label: "Latencia avg", value: latencyAvg, accent: C.text },
    { label: "Resolucion", value: resolutionRate, accent: total24h > 0 ? C.green : C.textMuted },
  ];
  const wakeBot = async () => {
    const secret = prompt("Ingrese WORKER_SECRET para autorizar:");
    if (!secret) return;
    const res = await fetch("/api/process-queue", {
      method: "POST",
      headers: { "x-worker-secret": secret, "content-type": "application/json" },
      body: JSON.stringify({ trigger: "manual_force" })
    });
    const data = await res.json();
    alert(data.success ? "IA despertada. Procesando cola..." : "Error: " + (data.error || "Secreto incorrecto"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BotHealthBar status={healthStatus} stats={botStats} onWake={wakeBot} />

      <Card>
        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Ultimos mensajes</div>
        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {recent.length === 0 && (
            <EmptyState
              title="Bot en standby"
              body="No hay conversaciones activas. Cuando un paciente escriba por WhatsApp aparecera aqui en tiempo real."
              cta="Abrir Monitor"
              onCta={() => { window.location.href = "/optica"; }}
              accent={C.green}
            />
          )}
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
                  {m.message_text || "-"}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
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
      <div className="auken-kpi-grid">
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
      <div className="auken-kpi-grid auken-kpi-grid--activity">
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

  const exportSelected = (ids) => {
    const picked = filtered.filter(p => ids.includes(p.id));
    const header = ["Nombre", "RUT", "Telefono", "Ultima visita", "Estado", "Monto"];
    const lines = picked.map(p => [
      p.nombre || "",
      p.rut || "",
      p.telefono || "",
      p.fecha_ultima_visita || "",
      p.estado_compra || "Pendiente",
      p.monto_venta || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pacientes-auken.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
            search
              ? <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 13 }}>Sin resultados para "<strong style={{ color: C.text }}>{search}</strong>"</div>
              : <EmptyState
                  title="Sin pacientes todavía"
                  body="El bot los captura automáticamente desde WhatsApp, o agrégalos tú manualmente."
                  cta="+ Agregar paciente"
                  onCta={onCreate}
                  accent={C.primary}
                />
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
        <>
          <DataTable
            rows={filtered}
            onRowClick={onEdit}
            empty={search
              ? <div style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 13 }}>Sin resultados para "<strong style={{ color: C.text }}>{search}</strong>"</div>
              : <EmptyState
                  title="Sin pacientes todavÃ­a"
                  body="El bot los captura automÃ¡ticamente cuando llegan por WhatsApp. TambiÃ©n puedes agregar el primero manualmente."
                  cta="+ Agregar paciente"
                  onCta={onCreate}
                  accent={C.primary}
                />
            }
            columns={[
              {
                key: "paciente",
                label: "Paciente",
                width: "34%",
                render: p => <CellIdentity name={p.nombre || "Sin nombre"} sub={`RUT: ${p.rut || "—"}`} color={avatarColor(p.nombre || "")} />,
              },
              {
                key: "contacto",
                label: "Contacto",
                render: p => (
                  <div>
                    <div style={{ fontSize: 13, color: C.text }}>{p.telefono || "—"}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Visita: {p.fecha_ultima_visita || "—"}</div>
                  </div>
                ),
              },
              {
                key: "receta",
                label: "Receta",
                render: p => {
                  const dias = p.fecha_ultima_visita
                    ? Math.floor((Date.now() - new Date(p.fecha_ultima_visita).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const estado = dias === null ? "sin_datos" : dias > 365 ? "vencida" : dias > 335 ? "proxima" : "vigente";
                  const estadoColor = estado === "vencida" ? C.red : estado === "proxima" ? C.amber : estado === "vigente" ? C.green : C.textMuted;
                  const estadoLabel = estado === "vencida" ? `Vencida (${dias}d)` : estado === "proxima" ? `Próxima (${365 - dias}d)` : estado === "vigente" ? "Vigente" : "Sin receta";
                  return <Pill label={estadoLabel} color={estadoColor} />;
                },
              },
              {
                key: "estado",
                label: "Estado",
                render: p => (
                  <div>
                    <Pill label={p.estado_compra || "Pendiente"} color={p.estado_compra === "Compró" ? C.green : p.estado_compra === "No Compró" ? C.red : C.textMuted} />
                    {p.monto_venta && <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginTop: 2 }}>${Number(p.monto_venta).toLocaleString("es-CL")}</div>}
                  </div>
                ),
              },
            ]}
            rowActions={p => [
              { icon: "👁", label: "Ver ficha", color: C.primary, run: () => onEdit(p) },
              { icon: "✎", label: "Editar", color: C.textDim, run: () => onEdit(p) },
              { icon: "☎", label: "WhatsApp", color: "#25D366", run: () => handleSendWhatsApp(p) },
            ]}
            bulkActions={[
              { label: "Exportar CSV", run: exportSelected },
              { label: "Enviar recordatorio", run: ids => ids.map(id => filtered.find(p => p.id === id)).filter(Boolean).forEach(handleSendWhatsApp) },
            ]}
          />
          <div style={{ display: "none", overflowX: "auto" }}>
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
                <tr><td colSpan="5">
                  {search
                    ? <div style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 13 }}>Sin resultados para "<strong style={{ color: C.text }}>{search}</strong>"</div>
                    : <EmptyState
                        title="Sin pacientes todavía"
                        body="El bot los captura automáticamente cuando llegan por WhatsApp. También puedes agregar el primero manualmente."
                        cta="+ Agregar paciente"
                        onCta={onCreate}
                        accent={C.primary}
                      />
                  }
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
        </>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL: NUEVA CITA MANUAL
// ─────────────────────────────────────────────────────────────
function CitaModal({ opticaId, pacientes, onClose, refresh, initialDraft }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    nombre: "", telefono: "", servicio: "",
    fecha: initialDraft?.fecha || today, hora: initialDraft?.hora || "10:00", notas: "",
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
    <Modal
      open
      onClose={onClose}
      title="Nueva Cita Manual"
      subtitle="Agenda una cita manual o completa datos desde un paciente existente."
      icon="📅"
      size="md"
      footer={(
        <>
          <button onClick={onClose}
            style={{ background: "transparent", color: C.text, border: `1px solid ${C.border}`, padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            style={{ background: C.primary, color: "#000", border: "none", padding: "10px 22px", borderRadius: 8, cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "📅 Agendar Cita"}
          </button>
        </>
      )}
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: CITAS — tabla en desktop, tarjetas en mobile
// ─────────────────────────────────────────────────────────────
function TabCitas({ citas, refresh, optica, pacientes, onCreateCita }) {
  const { isMobile } = useViewport();
  const [view, setView] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(() => dateFromISO(new Date().toISOString().split("T")[0]));

  const updateCita = async (id, estado) => {
    await supabase.from("citas").update({ estado }).eq("id", id);
    refresh();
  };

  const pendientes = citas.filter(c => c.estado === "pendiente_confirmacion").length;
  const selectedDateISO = formatDateInput(selectedDate);
  const shiftDate = (days) => setSelectedDate(prev => {
    const next = new Date(prev);
    next.setDate(next.getDate() + days);
    return next;
  });

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
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!isMobile && (
              <>
                <div style={{ display: "flex", gap: 4, padding: 3, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  {[["dia", "Día"], ["semana", "Semana"], ["lista", "Lista"]].map(([key, label]) => (
                    <button key={key} onClick={() => setView(key)}
                      style={{ height: 26, padding: "0 10px", borderRadius: 5, background: view === key ? C.surfaceL : "transparent", color: view === key ? C.text : C.textDim, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => shiftDate(-1)} style={{ width: 28, height: 28, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer" }}>‹</button>
                  <input type="date" value={selectedDateISO} onChange={e => setSelectedDate(dateFromISO(e.target.value))}
                    style={{ height: 28, background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "0 8px", fontSize: 12 }} />
                  <button onClick={() => shiftDate(1)} style={{ width: 28, height: 28, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer" }}>›</button>
                </div>
              </>
            )}
            <button
              onClick={() => onCreateCita({ fecha: selectedDateISO, hora: "10:00" })}
              style={{ background: C.primary, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Nueva Cita
            </button>
          </div>
        </div>

        {/* MOBILE: tarjetas */}
        {isMobile ? (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {citas.length === 0 && (
              <EmptyState
                title="Agenda limpia"
                body="El bot agenda automáticamente cuando conversa con un paciente. También puedes crear una cita manualmente."
                cta="+ Nueva Cita"
                onCta={() => onCreateCita({ fecha: selectedDateISO, hora: "10:00" })}
                accent={C.blue}
              />
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
          <>
          {view === "dia" && (
            <DayTimeline
              date={selectedDate}
              citas={citas}
              onSlotClick={onCreateCita}
              onCitaClick={(c) => {
                const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;
                if (calLink) window.open(calLink, "_blank", "noopener,noreferrer");
              }}
            />
          )}
          {view === "semana" && (
            <WeekAgenda
              date={selectedDate}
              citas={citas}
              onSlotClick={onCreateCita}
              onCitaClick={(c) => {
                const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;
                if (calLink) window.open(calLink, "_blank", "noopener,noreferrer");
              }}
            />
          )}
          {view === "lista" && (
          <DataTable
            rows={citas}
            empty={
              <EmptyState
                title="Agenda limpia"
                body="El bot agenda automÃ¡ticamente. TambiÃ©n puedes crear una cita manualmente con el botÃ³n superior."
                cta="+ Nueva Cita"
                onCta={() => onCreateCita({ fecha: selectedDateISO, hora: "10:00" })}
                accent={C.blue}
              />
            }
            columns={[
              {
                key: "paciente",
                label: "Paciente",
                width: "28%",
                render: c => <CellIdentity name={c.nombre || `Paciente #${c.paciente_id}`} sub={c.telefono || c.rut || ""} color={avatarColor(c.nombre || "")} />,
              },
              { key: "servicio", label: "Servicio", render: c => c.servicio || "—" },
              {
                key: "fecha",
                label: "Fecha y hora",
                nowrap: true,
                mono: true,
                render: c => <span>{c.fecha || "—"} {c.hora && `· ${c.hora}`}</span>,
              },
              {
                key: "origen",
                label: "Origen",
                render: c => <Pill label={c.origen === "bot-ia" ? "🤖 IA" : (c.origen || "manual")} color={c.origen === "bot-ia" ? "#A78BFA" : C.blue} />,
              },
              {
                key: "estado",
                label: "Estado",
                render: c => {
                  const estadoColor = c.estado === "confirmada" ? C.green
                    : c.estado === "cancelada" ? C.red
                    : c.estado === "completada" ? C.blue : C.amber;
                  return <Pill label={c.estado} color={estadoColor} />;
                },
              },
              {
                key: "calendar",
                label: "Calendar",
                render: c => {
                  const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;
                  if (!calLink) return <span style={{ color: C.textMuted }}>—</span>;
                  return (
                    <a href={calLink} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 6, background: "rgba(66,133,244,0.15)", color: "#7DD3FC", border: "1px solid rgba(66,133,244,0.4)", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                      📅 Google
                    </a>
                  );
                },
              },
            ]}
            rowActions={c => {
              const calLink = c.fecha ? buildCalLinkForCita(c, optica) : null;
              return [
                ...(calLink ? [{ icon: "📅", label: "Agregar a Google Calendar", color: "#7DD3FC", run: () => window.open(calLink, "_blank", "noopener,noreferrer") }] : []),
                ...(c.estado === "pendiente_confirmacion" ? [{ icon: "✓", label: "Confirmar", color: C.green, run: () => updateCita(c.id, "confirmada") }] : []),
                ...(c.estado !== "cancelada" ? [{ icon: "×", label: "Cancelar", color: C.red, run: () => updateCita(c.id, "cancelada") }] : []),
              ];
            }}
            bulkActions={[
              { label: "Confirmar", run: ids => ids.forEach(id => updateCita(id, "confirmada")) },
              { label: "Cancelar", run: ids => ids.forEach(id => updateCita(id, "cancelada")) },
            ]}
          />
          )}
          <div style={{ display: "none", overflowX: "auto" }}>
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
                  <tr><td colSpan="6">
                    <EmptyState
                      title="Agenda limpia"
                      body="El bot agenda automáticamente. También puedes crear una cita manualmente con el botón superior."
                      cta="+ Nueva Cita"
                      onCta={() => onCreateCita({ fecha: selectedDateISO, hora: "10:00" })}
                      accent={C.blue}
                    />
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
          </>
        )}
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: CONFIGURACIÓN — con dirty-state para no perder cambios
// ─────────────────────────────────────────────────────────────
function TabConfiguracion({ optica, refresh }) {
  const [edit, setEdit] = useState(optica);
  const [dirty, setDirty] = useState(false);   // true = hay cambios sin guardar
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
  };

  const saveConfig = useCallback(async (nextEdit) => {
    // Asegurarse de que servicios/escalar_si sean arrays JSON válidos
    const serviciosClean = Array.isArray(nextEdit.servicios)
      ? nextEdit.servicios.filter(s => s && (s.nombre || s.precio))
      : [];
    const escalarSiClean = Array.isArray(nextEdit.escalar_si)
      ? nextEdit.escalar_si.filter(Boolean)
      : [];

    const payload = {
      nombre:              nextEdit.nombre            || "",
      slogan:              nextEdit.slogan            || "",
      direccion:           nextEdit.direccion         || "",
      ciudad:              nextEdit.ciudad            || "",
      telefono:            nextEdit.telefono          || "",
      whatsapp:            nextEdit.whatsapp          || "",
      horario:             nextEdit.horario           || "",
      numero_escalada:     nextEdit.numero_escalada   || "",
      bot_nombre:          nextEdit.bot_nombre        || "Aukén",
      promocion_estrella:  nextEdit.promocion_estrella|| "",
      servicios:           serviciosClean,
      escalar_si:          escalarSiClean,
    };

    const { error } = await supabase
      .from("opticas")
      .update(payload)
      .eq("id", optica.id);

    if (!error) {
      lastSavedRef.current = payload;  // ← preserva lo guardado ante refresh() con BD sin migración 007
      setDirty(false);                 // ← limpia dirty para que el useEffect sincronice (con merge)
      refresh();
    } else {
      console.error("[config] Error guardando:", error);
      throw new Error(error.message);
    }
  }, [optica?.id, refresh]);

  const autosave = useAutosave(edit, saveConfig, dirty && !!optica?.id, 800);
  const fieldSaved = autosave.state === "saved";
  const retrySave = () => {
    setDirty(false);
    setTimeout(() => setDirty(true), 0);
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
    <ConfigField label={label} success={fieldSaved}>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={ph}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "10px 14px", borderRadius: 8, outline: "none", fontSize: 13 }} />
    </ConfigField>
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
          <SaveStatus state={autosave.state} savedAt={autosave.savedAt} error={autosave.error} onRetry={retrySave} />
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
        {autosave.state === "error" && (
          <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red }}>
            ⚠️ Error al guardar: {autosave.error}
            <br /><span style={{ color: C.textDim, fontSize: 11 }}>
              Si el error menciona una columna, ejecuta la migración 007 en Supabase SQL Editor.
            </span>
            <button onClick={retrySave} style={{ marginLeft: 10, background: "transparent", border: "none", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Reintentar
            </button>
          </div>
        )}
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
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Nuevo Paciente" : `Editar: ${edit.nombre}`}
      subtitle={isNew ? "Crea una ficha clínica y comercial para el monitor." : "Actualiza la ficha clínica, compra y receta del paciente."}
      icon="👤"
      size="lg"
      footer={(
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 12 }}>
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
      )}
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

    </Modal>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 4 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  alignSelf: i % 2 ? "flex-end" : "flex-start",
                  width: i % 2 ? "72%" : "58%",
                  background: i % 2 ? `${C.primarySoft}` : C.surfaceL,
                  border: `1px solid ${i % 2 ? C.primaryRing : C.border}`,
                  borderRadius: i % 2 ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  padding: "9px 12px",
                }}>
                  <Skeleton w={i % 2 ? "82%" : "68%"} h={10} />
                  <Skeleton w={i % 3 ? "54%" : "78%"} h={10} style={{ marginTop: 7 }} />
                </div>
              ))}
            </div>
          )}
          {!loadingMsgs && !loadError && mensajes.length === 0 && (
            <EmptyState
              title="Chat en espera"
              body="Sin mensajes aún. Prueba el bot desde el Monitor o espera a que un paciente escriba por WhatsApp."
              cta="Abrir Monitor"
              onCta={() => { window.location.href = "/optica"; }}
              accent={C.primary}
            />
          )}
          {mensajes.map((m, i) => {
            const kind = getLiveMessageKind(m);
            const time = m.created_at
              ? new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <LiveChatBubble
                key={m.id || i}
                kind={kind}
                author={m.nombre || m.remitente}
                text={m.contenido}
                time={time}
                meta={kind === "bot" ? "respuesta IA" : null}
              />
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
            <EmptyState
              title="Agenda despejada"
              body="No hay citas programadas próximamente. El bot las agenda automáticamente o créalas desde el tab Citas."
              accent={C.blue}
            />
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
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [citaDraft, setCitaDraft] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);

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

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openNewPatient = useCallback(() => {
    setEditingPatient(null);
    setShowPatientModal(true);
  }, []);

  const openEditPatient = useCallback((patient) => {
    setEditingPatient(patient);
    setShowPatientModal(true);
    setTab("pacientes");
  }, []);

  const openCitaModal = useCallback((draft = null) => {
    setCitaDraft(draft);
    setShowCitaModal(true);
  }, []);

  const commands = useMemo(() => {
    const pendingCitas = citas.filter(c => c.estado === "pendiente_confirmacion").length;

    return [
      {
        label: "Navegar",
        items: [
          { id: "metrics", icon: "📊", label: "Ir a Métricas", shortcut: "G M", run: () => setTab("metricas") },
          { id: "live", icon: "💬", label: "En Vivo", shortcut: "G V", run: () => setTab("enlive") },
          { id: "patients", icon: "👥", label: "Pacientes", subtitle: `${pacientes.length}`, shortcut: "G P", run: () => setTab("pacientes") },
          { id: "citas", icon: "📅", label: "Citas", subtitle: pendingCitas ? `${pendingCitas} pendientes` : `${citas.length}`, shortcut: "G C", run: () => setTab("citas") },
          { id: "config", icon: "⚙️", label: "Configuración", shortcut: "G S", run: () => setTab("config") },
          { id: "monitor", icon: "💬", label: "Abrir monitor de chat", shortcut: "G O", run: () => navigate("/optica") },
        ],
      },
      {
        label: "Acciones rápidas",
        items: [
          { id: "new-patient", icon: "+", label: "Nuevo paciente", shortcut: "N P", run: openNewPatient },
          { id: "new-cita", icon: "+", label: "Nueva cita", shortcut: "N C", run: () => openCitaModal() },
          { id: "scan-receta", icon: "◉", label: "Escanear receta", subtitle: "abre ficha paciente", shortcut: "O R", run: openNewPatient },
        ],
      },
      {
        label: "Pacientes",
        items: pacientes.slice(0, 30).map(p => ({
          id: `patient-${p.id}`,
          icon: (p.nombre || "?")[0]?.toUpperCase() || "?",
          label: p.nombre || "Sin nombre",
          subtitle: p.telefono || p.rut || "",
          keywords: [p.telefono, p.rut, p.comuna, p.producto_actual].filter(Boolean),
          run: () => openEditPatient(p),
        })),
      },
    ];
  }, [citas, navigate, openCitaModal, openEditPatient, openNewPatient, pacientes]);

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
    return <DashboardSkeleton />;
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
      <ResponsiveGlobals />

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
          <button className="auken-touch" onClick={() => setCommandOpen(true)}
            title="Abrir comandos (Ctrl/⌘K)"
            style={{ background: C.surfaceL, border: `1px solid ${C.border}`, color: C.textDim, borderRadius: C.radius, padding: isMobile ? "5px 8px" : "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: C.fontMono, letterSpacing: 0 }}>
            {isMobile ? "⌘K" : "Ctrl/⌘K"}
          </button>
          <button className="auken-touch" onClick={() => navigate("/optica")}
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
          <button className="auken-touch" onClick={() => { localStorage.removeItem("auken_auth"); navigate("/login"); }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: C.radius, padding: isMobile ? "5px 10px" : "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: '-0.01em' }}>
            {isMobile ? "Salir" : "Cerrar sesión"}
          </button>
        </div>
      </nav>

      {/* TABS */}
      <div className="auken-shell">
        <div className="auken-tabs">
          <DashboardTab active={tab === "metricas"} icon="📊" label="Métricas" onClick={() => setTab("metricas")} />
          <DashboardTab active={tab === "enlive"} icon="🔴" label="En Vivo" onClick={() => setTab("enlive")} />
          <DashboardTab active={tab === "pacientes"} icon="👥" label="Pacientes" count={pacientes.length} onClick={() => setTab("pacientes")} />
          <DashboardTab active={tab === "citas"} icon="📅" label="Citas" count={citas.filter(c => c.estado === "pendiente_confirmacion").length} onClick={() => setTab("citas")} />
          <DashboardTab active={tab === "config"} icon="⚙️" label="Configuración" onClick={() => setTab("config")} />
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
        {tab === "citas" && <TabCitas citas={citas} refresh={refresh} optica={optica} pacientes={pacientes} onCreateCita={openCitaModal} />}
        {tab === "config" && <TabConfiguracion optica={optica} refresh={refresh} />}
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} commands={commands} />

      {showCitaModal && (
        <CitaModal
          opticaId={optica?.id}
          pacientes={pacientes || []}
          initialDraft={citaDraft}
          onClose={() => { setShowCitaModal(false); setCitaDraft(null); }}
          refresh={refresh}
        />
      )}

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
