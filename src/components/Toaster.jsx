import { useEffect, useState, createContext, useContext, useCallback } from "react";

// =============================================================
// AUKEN - Sistema global de notificaciones toast
// =============================================================
// API estable:
//   const { toast } = useToaster();
//   toast.success("Cita agendada", { sub: "Viernes 10:00", action: { label: "Ver", onClick: ... } });
// =============================================================

const ToasterContext = createContext(null);

const C = {
  surface: "#0E1014",
  surfaceL: "#16181D",
  border: "rgba(255,255,255,0.065)",
  text: "#EDEEF0",
  textDim: "#8A8F98",
  textMuted: "#5C616C",
  primary: "#F97316",
  green: "#34D399",
  blue: "#7DD3FC",
  yellow: "#FBBF24",
  red: "#F87171",
  purple: "#A78BFA",
  fontSans: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontMono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  radius: 8,
  ease: "cubic-bezier(0.16,1,0.3,1)",
};

const TYPE_STYLES = {
  success: { color: C.green, icon: "✓", bg: "rgba(52,211,153,0.06)" },
  info: { color: C.blue, icon: "i", bg: "rgba(125,211,252,0.06)" },
  warn: { color: C.yellow, icon: "!", bg: "rgba(251,191,36,0.06)" },
  warning: { color: C.yellow, icon: "!", bg: "rgba(251,191,36,0.06)" },
  error: { color: C.red, icon: "×", bg: "rgba(248,113,113,0.06)" },
  danger: { color: C.red, icon: "×", bg: "rgba(248,113,113,0.06)" },
  bot: { color: C.purple, icon: "IA", bg: "rgba(167,139,250,0.06)" },
  ia: { color: C.primary, icon: "◆", bg: "rgba(249,115,22,0.06)" },
  cita: { color: C.primary, icon: "C", bg: "rgba(249,115,22,0.06)" },
  chat: { color: C.blue, icon: "M", bg: "rgba(125,211,252,0.06)" },
};

let nextId = 1;

function ToastItem({ toast, onClose }) {
  const duration = toast.duration || 6000;
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(Boolean(toast.pinned));
  const s = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
  const action = toast.action || (toast.onAction && toast.actionLabel ? { label: toast.actionLabel, onClick: toast.onAction } : null);
  const body = toast.body || toast.sub;

  useEffect(() => {
    if (paused || pinned) return undefined;
    const start = Date.now();
    const initial = progress;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, initial - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onClose();
      }
    }, 50);
    return () => clearInterval(id);
  }, [paused, pinned, duration, onClose]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: "relative",
        minWidth: 340,
        maxWidth: 400,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: C.radius,
        boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        overflow: "hidden",
        animation: `auken-toast-in 280ms ${C.ease}`,
        pointerEvents: "auto",
        fontFamily: C.fontSans,
        color: C.text,
      }}
    >
      <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          flexShrink: 0,
          background: s.bg,
          color: s.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: s.icon.length > 1 ? 10 : 13,
          fontWeight: 700,
          fontFamily: C.fontMono,
        }}>{s.icon}</div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{toast.title}</span>
            {toast.meta && (
              <span style={{
                fontSize: 10,
                color: C.textMuted,
                fontFamily: C.fontMono,
                flexShrink: 0,
              }}>{toast.meta}</span>
            )}
          </div>

          {body && (
            <span style={{
              fontSize: 12,
              color: C.textDim,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}>{body}</span>
          )}

          {action && (
            <button
              onClick={action.onClick}
              style={{
                alignSelf: "flex-start",
                marginTop: 6,
                background: "transparent",
                color: s.color,
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: C.fontSans,
              }}
            >{action.label} →</button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, alignSelf: "flex-start", flexShrink: 0 }}>
          <button
            onClick={() => setPinned(v => !v)}
            title={pinned ? "Soltar notificacion" : "Fijar notificacion"}
            style={{
              background: pinned ? `${s.color}18` : "transparent",
              border: "none",
              color: pinned ? s.color : C.textMuted,
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              padding: 0,
              width: 16,
              height: 16,
            }}
            aria-label={pinned ? "Soltar notificacion" : "Fijar notificacion"}
          >•</button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              width: 16,
              height: 16,
            }}
            aria-label="Cerrar"
          >×</button>
        </div>
      </div>

      {!pinned && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 2,
          width: `${progress}%`,
          background: s.color,
          opacity: 0.5,
          transition: "width 50ms linear",
        }} />
      )}
    </div>
  );
}

function ToastStack({ toasts, closeToast }) {
  return (
    <>
      <style>{`
        @keyframes auken-toast-in {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 520px) {
          .auken-toast-wrap { left: 12px !important; right: 12px !important; bottom: 12px !important; max-width: none !important; }
          .auken-toast-wrap > div { min-width: 0 !important; max-width: none !important; width: 100% !important; }
        }
      `}</style>
      <div className="auken-toast-wrap auken-toast-stack" style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
        maxWidth: "calc(100vw - 32px)",
      }}>
        {toasts.map((t, index) => (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              transform: `translateY(${index * -1}px)`,
            }}
          >
            <ToastItem toast={t} onClose={() => closeToast(t.id)} />
          </div>
        ))}
      </div>
    </>
  );
}

export function ToasterProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const closeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((opts) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, ...opts }].slice(-5));
    return id;
  }, []);

  const api = {
    push,
    close: closeToast,
    success: (title, opts = {}) => push({ type: "success", title, ...opts }),
    info: (title, opts = {}) => push({ type: "info", title, ...opts }),
    warn: (title, opts = {}) => push({ type: "warn", title, ...opts }),
    warning: (title, opts = {}) => push({ type: "warning", title, ...opts }),
    error: (title, opts = {}) => push({ type: "error", title, ...opts }),
    danger: (title, opts = {}) => push({ type: "danger", title, ...opts }),
    bot: (title, opts = {}) => push({ type: "bot", title, ...opts }),
    ia: (title, opts = {}) => push({ type: "ia", title, ...opts }),
    cita: (title, opts = {}) => push({ type: "cita", title, ...opts }),
    chat: (title, opts = {}) => push({ type: "chat", title, ...opts }),
  };

  return (
    <ToasterContext.Provider value={{ toast: api }}>
      {children}
      <ToastStack toasts={toasts} closeToast={closeToast} />
    </ToasterContext.Provider>
  );
}

export function useToaster() {
  const ctx = useContext(ToasterContext);
  if (!ctx) {
    const noop = () => {};
    return {
      toast: {
        push: noop,
        close: noop,
        success: noop,
        info: noop,
        warn: noop,
        warning: noop,
        error: noop,
        danger: noop,
        bot: noop,
        ia: noop,
        cita: noop,
        chat: noop,
      },
    };
  }
  return ctx;
}
