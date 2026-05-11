import { useEffect, useState, createContext, useContext, useCallback } from "react";

// =============================================================
// AUKÉN — Sistema global de notificaciones toast
// =============================================================
// Uso:
//   import { ToasterProvider, useToaster } from "../components/Toaster";
//
//   En App.jsx envolver con <ToasterProvider>...</ToasterProvider>
//   En cualquier componente:
//     const { toast } = useToaster();
//     toast.success("Cita agendada", { sub: "Viernes 10:00", action: { label: "Ver", onClick: ... } });
// =============================================================

const ToasterContext = createContext(null);

const TYPE_STYLES = {
  success: { color: "#10B981", icon: "✅" },
  info:    { color: "#7DD3FC", icon: "ℹ️" },
  warn:    { color: "#F59E0B", icon: "⚠️" },
  error:   { color: "#F43F5E", icon: "❌" },
  bot:     { color: "#A78BFA", icon: "🤖" },
  cita:    { color: "#FB923C", icon: "📅" },
  chat:    { color: "#7DD3FC", icon: "💬" },
};

let nextId = 1;

export function ToasterProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((opts) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, ...opts }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, opts.duration || 5000);
  }, []);

  const api = {
    push,
    success: (title, opts = {}) => push({ type: "success", title, ...opts }),
    info:    (title, opts = {}) => push({ type: "info",    title, ...opts }),
    warn:    (title, opts = {}) => push({ type: "warn",    title, ...opts }),
    error:   (title, opts = {}) => push({ type: "error",   title, ...opts }),
    bot:     (title, opts = {}) => push({ type: "bot",     title, ...opts }),
    cita:    (title, opts = {}) => push({ type: "cita",    title, ...opts }),
    chat:    (title, opts = {}) => push({ type: "chat",    title, ...opts }),
  };

  return (
    <ToasterContext.Provider value={{ toast: api }}>
      {children}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10,
        pointerEvents: "none",
        maxWidth: "calc(100vw - 32px)",
      }}>
        <style>{`
          @keyframes toastSlide{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
          @keyframes toastFade{to{opacity:0;transform:translateX(20px);}}
        `}</style>
        {toasts.map(t => {
          const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
          return (
            <div key={t.id} style={{
              background: "#0E1018",
              border: `1px solid ${s.color}40`,
              borderLeft: `3px solid ${s.color}`,
              borderRadius: 10,
              padding: "12px 16px",
              minWidth: 280, maxWidth: 360,
              boxShadow: `0 8px 24px rgba(0,0,0,.5), 0 0 16px ${s.color}20`,
              backdropFilter: "blur(12px)",
              animation: "toastSlide 0.25s ease-out",
              pointerEvents: "auto",
              fontFamily: "'Inter', sans-serif",
              color: "#F1F5F9",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: s.color, marginBottom: t.sub ? 3 : 0 }}>
                    {t.title}
                  </div>
                  {t.sub && (
                    <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.4, wordBreak: "break-word" }}>
                      {t.sub}
                    </div>
                  )}
                  {t.action && (
                    <button onClick={t.action.onClick} style={{
                      marginTop: 8, background: `${s.color}20`, color: s.color,
                      border: `1px solid ${s.color}50`, borderRadius: 6,
                      padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>{t.action.label}</button>
                  )}
                </div>
                <button
                  onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                  style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                  aria-label="Cerrar">×</button>
              </div>
            </div>
          );
        })}
      </div>
    </ToasterContext.Provider>
  );
}

export function useToaster() {
  const ctx = useContext(ToasterContext);
  if (!ctx) {
    // Fallback silencioso si se usa fuera del provider — no rompe nada
    return { toast: { push: () => {}, success: () => {}, info: () => {}, warn: () => {}, error: () => {}, bot: () => {}, cita: () => {}, chat: () => {} } };
  }
  return ctx;
}
