import { useEffect, useState } from "react";

const DEFAULT_THEME = {
  bg: "#08090C",
  surface: "#0E1014",
  surfaceL: "#16181D",
  border: "#1F2229",
  text: "#EDEEF0",
  textDim: "#8A8F98",
  textMute: "#5C616C",
  textInv: "#08090C",
  yellow: "#FBBF24",
  red: "#F87171",
  fontSans: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontMono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  severity = "danger",
  title,
  body,
  confirmText = "Confirmar",
  typeToConfirm,
  action,
  theme,
}) {
  const T = { ...DEFAULT_THEME, ...(theme || {}) };
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(severity === "critical" ? 5 : 0);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setCount(severity === "critical" ? 5 : 0);
      return undefined;
    }
    if (severity !== "critical") return undefined;
    const id = setInterval(() => setCount(c => (c <= 0 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [open, severity]);

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

  const severityStyles = {
    caution: { fg: T.yellow, bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)" },
    danger: { fg: T.red, bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
    critical: { fg: T.red, bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.35)" },
  };
  const sev = severityStyles[severity] || severityStyles.danger;
  const phraseOk = !typeToConfirm || typed.trim() === typeToConfirm;
  const timeOk = count === 0;
  const canFire = phraseOk && timeOk;

  const handleConfirm = async () => {
    if (!canFire) return;
    await onConfirm?.();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(8,9,12,0.78)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "14vh 16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: T.surface,
          border: `1px solid ${sev.border}`,
          borderRadius: 14,
          boxShadow: `0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px ${sev.border}, inset 0 1px 0 rgba(255,255,255,0.04)`,
          overflow: "hidden",
          animation: `auken-modal-in 220ms ${T.ease}`,
          fontFamily: T.fontSans,
        }}
      >
        <div style={{ height: 3, background: sev.fg, opacity: 0.78 }} />

        <div style={{ padding: "22px 22px 18px", display: "flex", gap: 14 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            flexShrink: 0,
            background: sev.bg,
            border: `1px solid ${sev.border}`,
            color: sev.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontFamily: T.fontMono,
            fontWeight: 800,
          }}>
            !
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: "-0.015em" }}>
              {title}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: T.textDim, lineHeight: 1.55 }}>
              {body}
            </p>
          </div>
        </div>

        {action?.length > 0 && (
          <div style={{
            margin: "0 22px 18px",
            padding: "10px 12px",
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}>
            {action.map((row, i) => (
              <div key={`${row.label}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 11, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 600, fontFamily: row.mono ? T.fontMono : T.fontSans, textAlign: "right" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {typeToConfirm && (
          <div style={{ padding: "0 22px 18px" }}>
            <label style={{ display: "block", fontSize: 12, color: T.textDim, fontWeight: 600, marginBottom: 6 }}>
              Para continuar, escribe{" "}
              <code style={{ fontFamily: T.fontMono, color: sev.fg, fontWeight: 800, background: sev.bg, padding: "1px 6px", borderRadius: 4, border: `1px solid ${sev.border}` }}>
                {typeToConfirm}
              </code>
            </label>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              style={{
                width: "100%",
                height: 36,
                padding: "0 12px",
                background: T.bg,
                color: T.text,
                border: `1px solid ${phraseOk && typed ? sev.fg : T.border}`,
                borderRadius: 8,
                outline: "none",
                fontFamily: T.fontMono,
                fontSize: 13,
                transition: `border-color 160ms ${T.ease}`,
              }}
            />
          </div>
        )}

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "14px 22px",
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
        }}>
          <span style={{ fontSize: 11, color: T.textMute, fontFamily: T.fontMono }}>
            {severity === "critical" && count > 0 ? `disponible en ${count}s` : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              background: "transparent",
              color: T.text,
              border: `1px solid ${T.border}`,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}>
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canFire}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                background: canFire ? sev.fg : T.surfaceL,
                color: canFire ? T.textInv : T.textMute,
                border: `1px solid ${canFire ? sev.fg : T.border}`,
                fontSize: 13,
                fontWeight: 800,
                cursor: canFire ? "pointer" : "not-allowed",
                transition: `all 160ms ${T.ease}`,
              }}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
