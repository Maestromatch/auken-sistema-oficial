import { useState, useEffect, useRef, useCallback } from "react";

// ── CONFIG DE NICHO ─────────────────────────────────────────────
// En producción esto llega por props o endpoint según el cliente
const BUSINESS_CONFIG = {
  name: "Clínica Dental Arcos",
  niche: "dental",
  icon: "🦷",
  owner: "Dr. Rodrigo Arcos",
  ownerPhone: "+56912345678",
  color: "#2D6A4F",
  accent: "#95D5B2",
  secondaryColor: "#1A3A2A",
  schedule: "Lunes a Viernes 9:00–19:00 · Sábado 9:00–13:00",
  phone: "+56 2 2345 6789",
  address: "Av. Providencia 1234, Santiago",
  services: [
    { name: "Limpieza dental", price: "$35.000" },
    { name: "Extracción simple", price: "$50.000" },
    { name: "Ortodoncia", price: "desde $800.000" },
    { name: "Blanqueamiento", price: "$120.000" },
    { name: "Implante dental", price: "desde $600.000" },
  ],
  escalateOn: ["urgencia", "dolor", "emergencia", "sangrado", "accidente"],
  welcomeMsg: "¡Hola! Soy el asistente de Clínica Dental Arcos. Puedo ayudarte con horarios, servicios, precios y agendar tu cita. ¿En qué te ayudo?",
  systemPrompt: `Eres el asistente virtual de Clínica Dental Arcos. Tu nombre es "Polar".
Eres profesional, cálido y conciso. Respondes en español chileno natural (no exagerado).
Servicios disponibles: Limpieza $35.000, Extracción $50.000, Ortodoncia desde $800.000, Blanqueamiento $120.000, Implante desde $600.000.
Horarios: Lunes a Viernes 9:00–19:00, Sábado 9:00–13:00.
Teléfono: +56 2 2345 6789. Dirección: Av. Providencia 1234, Santiago.
Si el usuario menciona dolor fuerte, emergencia, sangrado o urgencia, dile que lo derivarás al doctor y pide su nombre y número.
Si quiere agendar, pide: nombre, servicio deseado, y dos opciones de horario que le acomoden.
Nunca inventes precios ni procedimientos que no estén en tu lista.
Respuestas cortas: máximo 3 oraciones salvo que expliques un procedimiento.
Termina siempre ofreciendo una acción concreta: agendar, llamar, o resolver otra duda.`,
};

// ── SUGERENCIAS RÁPIDAS POR NICHO ────────────────────────────────
const QUICK_REPLIES = {
  dental:      ["💰 Ver precios", "📅 Agendar hora", "⏰ Horarios", "🚨 Tengo dolor"],
  optica:      ["👁️ Examen de vista", "💰 Precios lentes", "⏰ Horarios", "📅 Reservar hora"],
  veterinaria: ["🐾 Consulta urgente", "💉 Vacunas", "⏰ Horarios", "💰 Precios"],
  carniceria:  ["🥩 Ver cortes", "🚚 Delivery", "⏰ Horarios hoy", "📦 Hacer pedido"],
  botilleria:  ["🍷 Stock vinos", "🚚 Despacho", "⏰ Horarios", "💰 Ofertas"],
};

// ── ESTADO INICIAL ───────────────────────────────────────────────
const mkMsg = (role, content, meta = {}) => ({
  id: Date.now() + Math.random(),
  role, content,
  ts: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
  ...meta,
});

// ── UTILIDADES ───────────────────────────────────────────────────
function detectEscalation(text, triggers) {
  return triggers.some(t => text.toLowerCase().includes(t));
}

function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

// ── AVATAR ───────────────────────────────────────────────────────
function BotAvatar({ color, accent, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${color}, ${accent}40)`,
      border: `1.5px solid ${accent}60`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, flexShrink: 0,
      boxShadow: `0 0 10px ${color}40`,
    }}>🐻‍❄️</div>
  );
}

// ── BURBUJA DE MENSAJE ───────────────────────────────────────────
function Bubble({ msg, config, isLast }) {
  const isBot = msg.role === "assistant";
  const isSystem = msg.role === "system-notice";

  if (isSystem) return (
    <div style={{ textAlign: "center", margin: "8px 0" }}>
      <span style={{
        background: "#E3B34120", color: "#E3B341",
        fontSize: "11px", padding: "4px 10px", borderRadius: "10px",
        fontFamily: "'DM Mono', monospace", border: "1px solid #E3B34140",
      }}>{msg.content}</span>
    </div>
  );

  return (
    <div style={{
      display: "flex", gap: "8px",
      justifyContent: isBot ? "flex-start" : "flex-end",
      alignItems: "flex-end",
      animation: isLast ? "slideUp .25s ease" : "none",
    }}>
      {isBot && <BotAvatar color={config.color} accent={config.accent} size={28} />}
      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: "2px", alignItems: isBot ? "flex-start" : "flex-end" }}>
        {isBot && (
          <span style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginLeft: "2px" }}>
            Polar · {msg.ts}
          </span>
        )}
        <div style={{
          padding: "10px 14px",
          borderRadius: isBot ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          background: isBot ? "#1C2128" : config.color,
          color: "#E6EDF3",
          fontSize: "13.5px", lineHeight: 1.55,
          border: isBot ? "1px solid #30363D" : "none",
          boxShadow: isBot ? "none" : `0 2px 8px ${config.color}50`,
          fontFamily: "'DM Sans', sans-serif",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        {!isBot && (
          <span style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginRight: "2px" }}>
            {msg.ts}
          </span>
        )}
      </div>
    </div>
  );
}

// ── TYPING INDICATOR ─────────────────────────────────────────────
function TypingIndicator({ config }) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
      <BotAvatar color={config.color} accent={config.accent} size={28} />
      <div style={{
        padding: "12px 16px", background: "#1C2128",
        borderRadius: "4px 16px 16px 16px",
        border: "1px solid #30363D", display: "flex", gap: "4px", alignItems: "center",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: config.accent,
            animation: "typingDot 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
            opacity: 0.7,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── ESCALATION CARD ──────────────────────────────────────────────
function EscalationCard({ config, onDismiss }) {
  return (
    <div style={{
      background: "#E3B34110", border: "1px solid #E3B34140",
      borderRadius: "10px", padding: "14px",
      animation: "slideUp .3s ease",
    }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "20px" }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#E3B341", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
            Derivando con {config.owner}
          </div>
          <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
            Para urgencias, te contactamos directamente.
          </div>
          <a href={`https://wa.me/${config.ownerPhone.replace(/\D/g, "")}?text=Hola, necesito ayuda urgente con ${config.name}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              marginTop: "10px", background: "#25D366", color: "#fff",
              padding: "8px 14px", borderRadius: "6px", fontSize: "12px",
              textDecoration: "none", fontWeight: 600,
            }}>
            💬 WhatsApp directo
          </a>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: "14px" }}>✕</button>
      </div>
    </div>
  );
}

// ── BOOKING MINI FORM ────────────────────────────────────────────
function BookingForm({ config, onSubmit, onCancel }) {
  const [data, setData] = useState({ name: "", service: "", time1: "", time2: "" });
  const inp = (key, placeholder, type = "text") => (
    <input type={type} value={data[key]} placeholder={placeholder}
      onChange={e => setData(p => ({ ...p, [key]: e.target.value }))}
      style={{
        width: "100%", background: "#0D1117", border: "1px solid #30363D",
        borderRadius: "6px", padding: "9px 12px", color: "#E6EDF3",
        fontSize: "12px", fontFamily: "'DM Mono', monospace", outline: "none",
        marginTop: "4px",
      }} />
  );
  return (
    <div style={{ background: "#161B22", border: `1px solid ${config.color}50`, borderRadius: "10px", padding: "14px", animation: "slideUp .25s ease" }}>
      <div style={{ fontSize: "12px", color: config.accent, fontFamily: "'DM Mono', monospace", marginBottom: "10px" }}>
        📅 Solicitud de cita
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[
          { key: "name",     ph: "Tu nombre completo" },
          { key: "service",  ph: "Servicio que necesitas" },
          { key: "time1",    ph: "Horario preferido (ej: Martes 10am)" },
          { key: "time2",    ph: "Alternativa de horario" },
        ].map(({ key, ph }) => (
          <div key={key}>
            <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{ph}</div>
            {inp(key, ph)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, background: "none", border: "1px solid #30363D", color: "#8B949E", padding: "8px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
          Cancelar
        </button>
        <button onClick={() => onSubmit(data)} style={{ flex: 2, background: config.color, color: "#fff", border: "none", padding: "8px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
          Enviar solicitud →
        </button>
      </div>
    </div>
  );
}

// ── HEADER DEL CHAT ──────────────────────────────────────────────
function ChatHeader({ config, onClose, onMinimize }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${config.color}, ${config.secondaryColor})`,
      padding: "14px 16px",
      borderRadius: "16px 16px 0 0",
      display: "flex", alignItems: "center", gap: "10px",
    }}>
      <BotAvatar color={config.color} accent={config.accent} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#fff" }}>
          Polar — {config.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3FB950", boxShadow: "0 0 4px #3FB950" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'DM Mono', monospace" }}>
            En línea · responde al instante
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={onMinimize} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: "26px", height: "26px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>−</button>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: "26px", height: "26px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>✕</button>
      </div>
    </div>
  );
}

// ── CHAT INPUT ───────────────────────────────────────────────────
function ChatInput({ onSend, loading, color }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);

  const send = () => {
    const trimmed = val.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setVal("");
    ref.current?.focus();
  };

  return (
    <div style={{ padding: "12px 14px", borderTop: "1px solid #21262D", display: "flex", gap: "8px", background: "#0D1117", borderRadius: "0 0 16px 16px" }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
        placeholder="Escribe tu consulta..."
        disabled={loading}
        style={{
          flex: 1, background: "#161B22", border: "1px solid #30363D",
          borderRadius: "8px", padding: "10px 14px", color: "#E6EDF3",
          fontSize: "13px", fontFamily: "'DM Sans', sans-serif", outline: "none",
          opacity: loading ? 0.5 : 1, transition: "border-color .2s",
        }}
        onFocus={e => e.target.style.borderColor = color}
        onBlur={e => e.target.style.borderColor = "#30363D"}
      />
      <button onClick={send} disabled={!val.trim() || loading}
        style={{
          background: val.trim() && !loading ? color : "#161B22",
          color: val.trim() && !loading ? "#fff" : "#8B949E",
          border: "none", borderRadius: "8px", width: "40px", height: "40px",
          cursor: val.trim() && !loading ? "pointer" : "default",
          fontSize: "16px", transition: "all .2s", flexShrink: 0,
        }}>
        {loading ? "⋯" : "↑"}
      </button>
    </div>
  );
}

// ── WIDGET LAUNCHER ──────────────────────────────────────────────
function Launcher({ config, onClick, unread }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 56, height: 56, borderRadius: "50%",
        background: `linear-gradient(135deg, ${config.color}, ${config.secondaryColor})`,
        border: `2px solid ${config.accent}50`,
        boxShadow: hovered
          ? `0 8px 24px ${config.color}80, 0 0 0 4px ${config.color}20`
          : `0 4px 16px ${config.color}60`,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px",
        transform: hovered ? "scale(1.08)" : "scale(1)",
        transition: "all .25s cubic-bezier(.34,1.56,.64,1)",
        position: "relative",
      }}>
      🐻‍❄️
      {unread > 0 && (
        <div style={{
          position: "absolute", top: -2, right: -2,
          background: "#F85149", color: "#fff",
          width: 18, height: 18, borderRadius: "50%",
          fontSize: "10px", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #080C10",
        }}>{unread}</div>
      )}
    </button>
  );
}

// ── MAIN WIDGET ──────────────────────────────────────────────────
function ChatWidget({ config }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([
    mkMsg("assistant", config.welcomeMsg),
  ]);
  const [loading, setLoading] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [unread, setUnread] = useState(1);
  const scrollRef = useAutoScroll(messages);

  const quickReplies = QUICK_REPLIES[config.niche] || QUICK_REPLIES.dental;

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    const userMsg = mkMsg("user", text);
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setShowBooking(false);

    // Detectar escalada
    if (detectEscalation(text, config.escalateOn)) {
      setTimeout(() => {
        setMessages(prev => [...prev, mkMsg("assistant",
          "Entiendo que tienes una urgencia. Voy a notificar a " + config.owner + " inmediatamente para que te contacte. ¿Puedes darme tu nombre y número de teléfono?",
        )]);
        setShowEscalation(true);
        setLoading(false);
      }, 800);
      return;
    }

    // Detectar intención de agendar
    const bookingTriggers = ["agendar", "reservar", "cita", "hora", "turno", "quiero ir"];
    if (bookingTriggers.some(t => text.toLowerCase().includes(t))) {
      setTimeout(() => {
        setMessages(prev => [...prev, mkMsg("assistant",
          "¡Con gusto te ayudo a agendar! Completa este formulario y te confirmo disponibilidad en menos de 2 horas.",
        )]);
        setShowBooking(true);
        setLoading(false);
      }, 700);
      return;
    }

    // Llamada real a Claude API
    try {
      const history = [...messages, userMsg]
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    system: config.systemPrompt,
    messages: history,
  }),
});
      const data = await response.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Disculpa, no pude procesar tu consulta. ¿Puedes reformularla?";

      setMessages(prev => [...prev, mkMsg("assistant", reply)]);
    } catch {
      setMessages(prev => [...prev, mkMsg("assistant",
        "Tuve un problema de conexión. Puedes llamarnos directamente al " + config.phone + " o escribirnos al WhatsApp.",
      )]);
    } finally {
      setLoading(false);
    }
  }, [messages, config]);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  const handleBookingSubmit = (data) => {
    setShowBooking(false);
    const summary = `Solicitud de cita recibida:\n• Nombre: ${data.name || "—"}\n• Servicio: ${data.service || "—"}\n• Horario 1: ${data.time1 || "—"}\n• Horario 2: ${data.time2 || "—"}\n\nTe confirmaremos disponibilidad pronto. ¡Hasta la vista! 🦷`;
    setMessages(prev => [...prev, mkMsg("assistant", summary)]);
  };

  if (!open) return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
      <div style={{
        background: "#161B22", border: "1px solid #30363D",
        borderRadius: "10px", padding: "8px 14px",
        fontSize: "12px", color: "#E6EDF3", fontFamily: "'DM Mono', monospace",
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
        animation: "fadeIn .4s ease",
        maxWidth: "200px", textAlign: "center", lineHeight: 1.5,
      }}>
        ¿Tienes alguna consulta? <span style={{ color: config.accent }}>Estoy aquí →</span>
      </div>
      <Launcher config={config} onClick={handleOpen} unread={unread} />
    </div>
  );

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes typingDot { 0%,80%,100%{transform:translateY(0);opacity:.7} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes popIn { from { opacity:0; transform:scale(.92) translateY(20px); } to { opacity:1; transform:none; } }
      `}</style>

      <div style={{
        width: "360px",
        background: "#080C10",
        border: "1px solid #30363D",
        borderRadius: "16px",
        boxShadow: `0 24px 64px rgba(0,0,0,.7), 0 0 0 1px ${config.color}20`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "popIn .3s cubic-bezier(.34,1.2,.64,1)",
        maxHeight: minimized ? "56px" : "560px",
        transition: "max-height .35s cubic-bezier(.4,0,.2,1)",
      }}>

        <ChatHeader config={config} onClose={() => setOpen(false)} onMinimize={() => setMinimized(m => !m)} />

        {!minimized && (
          <>
            {/* Messages area */}
            <div ref={scrollRef} style={{
              flex: 1, overflowY: "auto", padding: "16px 14px",
              display: "flex", flexDirection: "column", gap: "12px",
              background: "#080C10",
              minHeight: "280px", maxHeight: "360px",
            }}>
              {messages.map((msg, i) => (
                <Bubble key={msg.id} msg={msg} config={config} isLast={i === messages.length - 1 && !loading} />
              ))}
              {loading && <TypingIndicator config={config} />}
              {showEscalation && <EscalationCard config={config} onDismiss={() => setShowEscalation(false)} />}
              {showBooking && <BookingForm config={config} onSubmit={handleBookingSubmit} onCancel={() => setShowBooking(false)} />}
            </div>

            {/* Quick replies */}
            {messages.length <= 2 && !loading && (
              <div style={{ padding: "0 14px 10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {quickReplies.map(r => (
                  <button key={r} onClick={() => sendMessage(r)}
                    style={{
                      background: "#161B22", border: "1px solid #30363D",
                      borderRadius: "16px", padding: "6px 12px",
                      color: "#E6EDF3", fontSize: "12px", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = config.color; e.target.style.background = `${config.color}20`; }}
                    onMouseLeave={e => { e.target.style.borderColor = "#30363D"; e.target.style.background = "#161B22"; }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Services pill list */}
            {messages.length === 1 && (
              <div style={{ padding: "0 14px 10px" }}>
                <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>Servicios:</div>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {config.services.map(s => (
                    <span key={s.name} onClick={() => sendMessage(`¿Cuánto cuesta ${s.name}?`)}
                      style={{
                        background: `${config.color}20`, border: `1px solid ${config.color}40`,
                        borderRadius: "10px", padding: "3px 9px",
                        color: config.accent, fontSize: "11px", cursor: "pointer",
                        fontFamily: "'DM Mono', monospace",
                      }}>
                      {s.name} · {s.price}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <ChatInput onSend={sendMessage} loading={loading} color={config.color} />

            {/* Powered by */}
            <div style={{ textAlign: "center", padding: "6px", background: "#0D1117", borderTop: "1px solid #21262D" }}>
              <span style={{ fontSize: "10px", color: "#484F58", fontFamily: "'DM Mono', monospace" }}>
                powered by <span style={{ color: "#8B949E" }}>AUKÉN sistemas</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── DEMO WRAPPER ─────────────────────────────────────────────────
// Simula el sitio web del cliente con el widget embebido
export default function WidgetDemo() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0A1628 0%, #0D1117 50%, #080C10 100%)",
      fontFamily: "'Syne', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; background: #0D1117; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
      `}</style>

      {/* Decorative background grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* Glow spots */}
      <div style={{ position: "absolute", top: "20%", left: "15%", width: 300, height: 300, background: "#2D6A4F", borderRadius: "50%", filter: "blur(100px)", opacity: 0.08, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "15%", width: 200, height: 200, background: "#95D5B2", borderRadius: "50%", filter: "blur(80px)", opacity: 0.06, pointerEvents: "none" }} />

      {/* Fake client website card */}
      <div style={{ textAlign: "center", maxWidth: 480, padding: "40px 32px", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "#161B22", border: "1px solid #30363D",
          borderRadius: "20px", padding: "6px 16px", marginBottom: "28px",
        }}>
          <div style={{ width: 5, height: 5, background: "#3FB950", borderRadius: "50%", boxShadow: "0 0 6px #3FB950" }} />
          <span style={{ color: "#8B949E", fontSize: "11px", fontFamily: "'DM Mono', monospace" }}>demo widget · producción</span>
        </div>

        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🦷</div>
        <h1 style={{ fontWeight: 800, fontSize: "28px", letterSpacing: "-0.03em", color: "#E6EDF3", marginBottom: "10px" }}>
          Clínica Dental Arcos
        </h1>
        <p style={{ color: "#8B949E", fontSize: "14px", fontFamily: "'DM Mono', monospace", lineHeight: 1.7, marginBottom: "32px" }}>
          Este es el sitio web de tu cliente.<br />
          El widget Aukén vive abajo a la derecha. →
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "28px" }}>
          {[
            { icon: "📍", label: "Providencia", sub: "Santiago" },
            { icon: "⏰", label: "Lun–Vie", sub: "9:00–19:00" },
            { icon: "📞", label: "+56 2 2345", sub: "6789" },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "10px", padding: "14px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
              <div style={{ fontSize: "12px", color: "#E6EDF3", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0D1117", border: "1px solid #2D6A4F40", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>
            <span style={{ color: "#95D5B2" }}>→</span> Haz clic en el oso abajo a la derecha para ver el Atendedor en acción.<br />
            <span style={{ color: "#95D5B2" }}>→</span> Conectado a Claude API · respuestas reales.<br />
            <span style={{ color: "#95D5B2" }}>→</span> Prueba: "tengo dolor", "quiero agendar", "precios".
          </div>
        </div>
      </div>

      {/* EL WIDGET */}
      <ChatWidget config={BUSINESS_CONFIG} />
    </div>
  );
}
