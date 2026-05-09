import { useState, useEffect, useRef } from "react";

// ── DATOS SIMULADOS ──────────────────────────────────────────────
const MOCK_CLIENTS = [
  {
    id: 1, name: "Clínica Dental Arcos", niche: "dental", icon: "🦷",
    plan: "Oso Polar Pro", status: "active", since: "2025-02-10",
    monthly: 250000, setup: 600000,
    contacts: 312, booked: 47, escalated: 6, resolved: 259,
    weeklyData: [28, 34, 41, 38, 52, 47, 44, 51, 48, 55, 62, 58],
    lastReport: "Hace 3 días", nextBilling: "2025-06-10",
    channels: ["whatsapp", "web", "instagram"],
    owner: "Dr. Rodrigo Arcos", phone: "+56912345678",
    color: "#2D6A4F", accent: "#95D5B2",
  },
  {
    id: 2, name: "Óptica Visión Clara", niche: "optica", icon: "👁️",
    plan: "Oso Polar Base", status: "active", since: "2025-03-15",
    monthly: 150000, setup: 400000,
    contacts: 189, booked: 28, escalated: 3, resolved: 158,
    weeklyData: [14, 18, 22, 19, 24, 21, 26, 23, 28, 25, 31, 28],
    lastReport: "Hace 1 día", nextBilling: "2025-06-15",
    channels: ["whatsapp", "web"],
    owner: "Valentina Muñoz", phone: "+56987654321",
    color: "#1B4332", accent: "#B7E4C7",
  },
  {
    id: 3, name: "Veterinaria PataPata", niche: "veterinaria", icon: "🐾",
    plan: "Oso Polar Pro", status: "onboarding", since: "2025-05-01",
    monthly: 250000, setup: 600000,
    contacts: 12, booked: 2, escalated: 1, resolved: 9,
    weeklyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 6, 12],
    lastReport: "Hoy", nextBilling: "2025-06-01",
    channels: ["whatsapp"],
    owner: "Camila Herrera", phone: "+56911223344",
    color: "#40916C", accent: "#D8F3DC",
  },
  {
    id: 4, name: "Carnicería El Toro", niche: "carniceria", icon: "🥩",
    plan: "Oso Polar Base", status: "paused", since: "2025-01-20",
    monthly: 150000, setup: 400000,
    contacts: 421, booked: 0, escalated: 12, resolved: 389,
    weeklyData: [38, 42, 45, 40, 35, 28, 22, 18, 12, 8, 4, 0],
    lastReport: "Hace 14 días", nextBilling: "2025-06-20",
    channels: ["whatsapp", "web"],
    owner: "Juan Pizarro", phone: "+56955667788",
    color: "#6B2D0F", accent: "#F4A261",
  },
];

const STATUS_CONFIG = {
  active:     { label: "Activo",      color: "#3FB950", bg: "#3FB95015" },
  onboarding: { label: "Onboarding",  color: "#E3B341", bg: "#E3B34115" },
  paused:     { label: "Pausado",     color: "#F85149", bg: "#F8514915" },
};

const CHANNEL_ICONS = { whatsapp: "💬", web: "🌐", instagram: "📷" };

const ONBOARDING_STEPS = [
  { id: 1, title: "Datos del negocio",    desc: "Nombre, rubro, dueño y contacto principal" },
  { id: 2, title: "Configurar canales",   desc: "WhatsApp, chat web e Instagram DM" },
  { id: 3, title: "Base de conocimiento", desc: "Servicios, precios, horarios y FAQs" },
  { id: 4, title: "Flujo de escalada",    desc: "Cuándo y cómo notificar al dueño" },
  { id: 5, title: "Activar y probar",     desc: "Deploy y prueba de conversación real" },
];

// ── MICRO HOOKS ──────────────────────────────────────────────────
function useIntersection(ref, threshold = 0.1) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return v;
}

function Fade({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const v = useIntersection(ref);
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : "translateY(20px)", transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

// ── SPARKLINE ────────────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 36 }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`${color}20`} stroke="none" />
    </svg>
  );
}

// ── MINI CHART ───────────────────────────────────────────────────
function BarChart({ data, color, labels }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "64px" }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <div style={{ width: "100%", background: `${color}30`, borderRadius: "3px 3px 0 0", position: "relative", height: `${(v / max) * 52}px`, minHeight: "2px" }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: color, borderRadius: "3px 3px 0 0", height: "100%", opacity: i === data.length - 1 ? 1 : 0.5 }} />
          </div>
          {labels && <span style={{ fontSize: "9px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

// ── CLIENT CARD ──────────────────────────────────────────────────
function ClientCard({ client, onClick, selected }) {
  const s = STATUS_CONFIG[client.status];
  return (
    <div onClick={() => onClick(client)} style={{
      background: selected ? "#161B22" : "#0D1117",
      border: selected ? `1px solid ${client.color}` : "1px solid #21262D",
      borderRadius: "10px", padding: "16px", cursor: "pointer",
      transition: "all .2s", marginBottom: "10px",
    }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "#30363D"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "#21262D"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", background: `${client.color}20`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
            {client.icon}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px", color: "#E6EDF3" }}>{client.name}</div>
            <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginTop: "1px" }}>{client.plan}</div>
          </div>
        </div>
        <div style={{ background: s.bg, color: s.color, fontSize: "10px", padding: "3px 8px", borderRadius: "12px", fontFamily: "'DM Mono', monospace", border: `1px solid ${s.color}40` }}>
          {s.label}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: "16px", color: client.accent }}>{client.contacts}</div>
            <div style={{ fontSize: "9px", color: "#8B949E" }}>consultas</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: "16px", color: "#3FB950" }}>{client.booked}</div>
            <div style={{ fontSize: "9px", color: "#8B949E" }}>agendadas</div>
          </div>
        </div>
        <Sparkline data={client.weeklyData} color={client.color} width={80} height={28} />
      </div>
    </div>
  );
}

// ── CLIENT DETAIL ────────────────────────────────────────────────
function ClientDetail({ client, onClose }) {
  const s = STATUS_CONFIG[client.status];
  const weeks = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];
  const resolvedRate = Math.round((client.resolved / client.contacts) * 100);

  return (
    <div style={{ background: "#0D1117", border: `1px solid ${client.color}`, borderRadius: "12px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#161B22", padding: "20px 24px", borderBottom: "1px solid #21262D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", background: `${client.color}25`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
            {client.icon}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px" }}>{client.name}</div>
            <div style={{ fontSize: "12px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{client.owner} · {client.phone}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ background: s.bg, color: s.color, fontSize: "11px", padding: "4px 10px", borderRadius: "12px", fontFamily: "'DM Mono', monospace", border: `1px solid ${s.color}40` }}>
            {s.label}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #30363D", color: "#8B949E", width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>✕</button>
        </div>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {[
            { label: "Consultas totales", value: client.contacts, color: client.accent },
            { label: "Citas agendadas",   value: client.booked,   color: "#3FB950" },
            { label: "Escaladas",         value: client.escalated, color: "#E3B341" },
            { label: "Tasa resolución",   value: `${resolvedRate}%`, color: "#58A6FF" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#161B22", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "26px", color }}>{value}</div>
              <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginTop: "4px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: "#161B22", borderRadius: "8px", padding: "20px" }}>
          <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Consultas por semana (últimas 12)
          </div>
          <BarChart data={client.weeklyData} color={client.color} labels={weeks} />
        </div>

        {/* Info row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div style={{ background: "#161B22", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>CANALES ACTIVOS</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {client.channels.map(c => (
                <span key={c} style={{ background: "#21262D", borderRadius: "6px", padding: "4px 8px", fontSize: "14px" }} title={c}>
                  {CHANNEL_ICONS[c]}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: "#161B22", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>FACTURACIÓN MENSUAL</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "18px", color: "#3FB950" }}>
              ${client.monthly.toLocaleString("es-CL")}
            </div>
            <div style={{ fontSize: "10px", color: "#8B949E", marginTop: "2px" }}>próximo cobro: {client.nextBilling}</div>
          </div>
          <div style={{ background: "#161B22", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>ÚLTIMO REPORTE</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "14px", color: "#E6EDF3" }}>{client.lastReport}</div>
            <button style={{ marginTop: "8px", background: client.color, color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
              Enviar reporte →
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          {["Configurar flujos", "Editar base de datos", "Pausar sistema"].map((action, i) => (
            <button key={action} style={{ background: i === 2 ? "#F8514910" : "#161B22", color: i === 2 ? "#F85149" : "#E6EDF3", border: `1px solid ${i === 2 ? "#F8514940" : "#30363D"}`, borderRadius: "6px", padding: "8px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ONBOARDING WIZARD ────────────────────────────────────────────
function OnboardingWizard({ onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", niche: "dental", owner: "", phone: "", plan: "pro",
    channels: ["whatsapp"],
    services: "", schedule: "", faq: "",
    escalateCondition: "no_answer_2min", escalatePhone: "",
  });

  const NICHES = [
    { key: "dental", icon: "🦷", label: "Dental" },
    { key: "optica", icon: "👁️", label: "Óptica" },
    { key: "veterinaria", icon: "🐾", label: "Veterinaria" },
    { key: "carniceria", icon: "🥩", label: "Carnicería" },
    { key: "botilleria", icon: "🍷", label: "Botillería" },
  ];

  const input = (key, placeholder, type = "text") => (
    <input type={type} value={form[key]} placeholder={placeholder}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      style={{ width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: "6px", padding: "10px 12px", color: "#E6EDF3", fontSize: "13px", fontFamily: "'DM Mono', monospace", outline: "none", marginTop: "6px" }} />
  );

  const textarea = (key, placeholder) => (
    <textarea value={form[key]} placeholder={placeholder} rows={4}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      style={{ width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: "6px", padding: "10px 12px", color: "#E6EDF3", fontSize: "13px", fontFamily: "'DM Mono', monospace", outline: "none", resize: "vertical", marginTop: "6px" }} />
  );

  const toggleChannel = ch => setForm(p => ({
    ...p,
    channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch],
  }));

  const label = (text) => <div style={{ fontSize: "12px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginTop: "14px" }}>{text}</div>;

  const stepContent = {
    1: (
      <div>
        {label("Nombre del negocio")}
        {input("name", "Clínica Dental García")}
        {label("Tipo de negocio")}
        <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
          {NICHES.map(n => (
            <button key={n.key} onClick={() => setForm(p => ({ ...p, niche: n.key }))}
              style={{ background: form.niche === n.key ? "#2D6A4F" : "#161B22", border: form.niche === n.key ? "1px solid #95D5B2" : "1px solid #30363D", borderRadius: "8px", padding: "8px 14px", color: "#E6EDF3", cursor: "pointer", fontSize: "13px" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        {label("Nombre del dueño")}
        {input("owner", "Dr. Rodrigo García")}
        {label("WhatsApp del dueño")}
        {input("phone", "+56 9 1234 5678", "tel")}
      </div>
    ),
    2: (
      <div>
        {label("Canales a activar")}
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          {Object.entries(CHANNEL_ICONS).map(([ch, icon]) => (
            <button key={ch} onClick={() => toggleChannel(ch)}
              style={{ flex: 1, background: form.channels.includes(ch) ? "#2D6A4F20" : "#161B22", border: form.channels.includes(ch) ? "1px solid #2D6A4F" : "1px solid #30363D", borderRadius: "8px", padding: "14px 8px", color: "#E6EDF3", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "22px" }}>{icon}</span>
              <span style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", color: "#8B949E", textTransform: "capitalize" }}>{ch}</span>
              {form.channels.includes(ch) && <span style={{ fontSize: "9px", color: "#3FB950" }}>✓ activo</span>}
            </button>
          ))}
        </div>
        {label("Plan contratado")}
        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
          {[["base", "Oso Polar Base · $150K/mes"], ["pro", "Oso Polar Pro · $250K/mes"], ["total", "Oso Polar Total · $380K/mes"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setForm(p => ({ ...p, plan: val }))}
              style={{ flex: 1, background: form.plan === val ? "#2D6A4F20" : "#161B22", border: form.plan === val ? "1px solid #2D6A4F" : "1px solid #30363D", borderRadius: "8px", padding: "10px 6px", color: form.plan === val ? "#E6EDF3" : "#8B949E", cursor: "pointer", fontSize: "11px", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
    ),
    3: (
      <div>
        {label("Servicios y precios (uno por línea)")}
        {textarea("services", "Limpieza dental: $35.000\nExtracción: $50.000 - $120.000\nOrtodoncia: desde $800.000")}
        {label("Horarios de atención")}
        {textarea("schedule", "Lunes a Viernes: 9:00 - 19:00\nSábado: 9:00 - 13:00\nDomingo: Cerrado")}
        {label("Preguntas frecuentes (clave: respuesta)")}
        {textarea("faq", "¿Atienden urgencias? → Sí, contáctenos al +569...\n¿Tienen convenios? → Fonasa nivel 3 y 4")}
      </div>
    ),
    4: (
      <div>
        {label("¿Cuándo escalar al dueño?")}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          {[
            ["no_answer_2min", "Si el bot no puede responder en 2 intentos"],
            ["urgency",        "Si el cliente menciona dolor, urgencia o emergencia"],
            ["always",         "Siempre al final de cada conversación"],
          ].map(([val, lbl]) => (
            <button key={val} onClick={() => setForm(p => ({ ...p, escalateCondition: val }))}
              style={{ background: form.escalateCondition === val ? "#2D6A4F20" : "#161B22", border: form.escalateCondition === val ? "1px solid #2D6A4F" : "1px solid #30363D", borderRadius: "8px", padding: "12px 14px", color: "#E6EDF3", cursor: "pointer", fontSize: "13px", fontFamily: "'DM Mono', monospace", textAlign: "left" }}>
              {form.escalateCondition === val ? "◉" : "○"} {lbl}
            </button>
          ))}
        </div>
        {label("WhatsApp para notificaciones de escalada")}
        {input("escalatePhone", "+56 9 8765 4321", "tel")}
      </div>
    ),
    5: (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🐻‍❄️</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "22px", marginBottom: "8px" }}>
          Todo listo para activar
        </div>
        <div style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace", marginBottom: "28px", lineHeight: 1.7 }}>
          Revisa el resumen antes de hacer el deploy:
        </div>
        <div style={{ background: "#161B22", borderRadius: "10px", padding: "20px", textAlign: "left", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            ["Negocio",   form.name || "—"],
            ["Dueño",     form.owner || "—"],
            ["Canales",   form.channels.join(", ") || "—"],
            ["Plan",      `Oso Polar ${form.plan}`],
            ["Escalada",  form.escalatePhone || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{k}</span>
              <span style={{ color: "#E6EDF3", fontFamily: "'DM Mono', monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#0D1117", border: "1px solid #30363D", borderRadius: "16px", width: "100%", maxWidth: "540px", maxHeight: "90vh", overflow: "auto" }}>
        {/* Wizard header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #21262D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "16px" }}>Nuevo cliente</div>
            <div style={{ color: "#8B949E", fontSize: "11px", fontFamily: "'DM Mono', monospace", marginTop: "2px" }}>
              Paso {step} de {ONBOARDING_STEPS.length} · {ONBOARDING_STEPS[step - 1].title}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #30363D", color: "#8B949E", width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ padding: "0 24px", paddingTop: "16px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {ONBOARDING_STEPS.map(s => (
              <div key={s.id} style={{ flex: 1, height: "3px", borderRadius: "2px", background: s.id <= step ? "#2D6A4F" : "#21262D", transition: "background .3s" }} />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: "20px 24px 8px" }}>
          <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>{ONBOARDING_STEPS[step - 1].title}</div>
          <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", marginBottom: "8px" }}>{ONBOARDING_STEPS[step - 1].desc}</div>
          {stepContent[step]}
        </div>

        {/* Nav */}
        <div style={{ padding: "16px 24px 20px", display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{ background: "none", border: "1px solid #30363D", color: "#8B949E", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: "13px" }}>
            {step === 1 ? "Cancelar" : "← Atrás"}
          </button>
          <button onClick={() => step < ONBOARDING_STEPS.length ? setStep(s => s + 1) : onClose()}
            style={{ background: "#2D6A4F", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "13px" }}>
            {step === ONBOARDING_STEPS.length ? "🐻‍❄️ Activar sistema" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GLOBAL METRICS ───────────────────────────────────────────────
function GlobalMetrics({ clients }) {
  const active = clients.filter(c => c.status === "active").length;
  const totalContacts = clients.reduce((a, c) => a + c.contacts, 0);
  const totalBooked = clients.reduce((a, c) => a + c.booked, 0);
  const mrr = clients.filter(c => c.status !== "paused").reduce((a, c) => a + c.monthly, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
      {[
        { label: "Clientes activos",    value: active,                              color: "#3FB950", suffix: `/ ${clients.length}` },
        { label: "Consultas atendidas", value: totalContacts.toLocaleString("es-CL"), color: "#58A6FF", suffix: "" },
        { label: "Citas generadas",     value: totalBooked,                         color: "#95D5B2", suffix: "" },
        { label: "MRR",                 value: `$${(mrr / 1000).toFixed(0)}K`,      color: "#E3B341", suffix: " CLP" },
      ].map(({ label, value, color, suffix }) => (
        <Fade key={label}>
          <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "26px", color }}>
              {value}<span style={{ fontSize: "14px", color: "#8B949E" }}>{suffix}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginTop: "4px" }}>{label}</div>
          </div>
        </Fade>
      ))}
    </div>
  );
}

// ── MAIN DASHBOARD ───────────────────────────────────────────────
export default function AukenDashboard() {
  const [clients] = useState(MOCK_CLIENTS);
  const [selected, setSelected] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.owner.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ background: "#080C10", minHeight: "100vh", fontFamily: "'Syne', 'DM Mono', sans-serif", color: "#E6EDF3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; background: #0D1117; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
      `}</style>

      {showOnboarding && <OnboardingWizard onClose={() => setShowOnboarding(false)} />}

      {/* TOPBAR */}
      <div style={{ background: "#0D1117", borderBottom: "1px solid #21262D", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 7, height: 7, background: "#3FB950", borderRadius: "50%", boxShadow: "0 0 6px #3FB950" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "16px" }}>AUKÉN</span>
            <span style={{ color: "#30363D", fontSize: "14px" }}>/</span>
            <span style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>dashboard</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>
            🌲 Santiago · bosque mode
          </div>
          <button onClick={() => setShowOnboarding(true)}
            style={{ background: "#2D6A4F", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 56px)" }}>

        {/* SIDEBAR */}
        <div style={{ borderRight: "1px solid #21262D", padding: "20px", overflowY: "auto", background: "#080C10" }}>
          {/* Search + filter */}
          <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
              style={{ width: "100%", background: "#161B22", border: "1px solid #30363D", borderRadius: "6px", padding: "9px 12px", color: "#E6EDF3", fontSize: "13px", fontFamily: "'DM Mono', monospace", outline: "none" }} />
            <div style={{ display: "flex", gap: "6px" }}>
              {[["all", "Todos"], ["active", "Activos"], ["onboarding", "Onboard"], ["paused", "Pausados"]].map(([val, lbl]) => (
                <button key={val} onClick={() => setFilterStatus(val)}
                  style={{ flex: 1, background: filterStatus === val ? "#161B22" : "none", border: filterStatus === val ? "1px solid #30363D" : "1px solid transparent", borderRadius: "5px", color: filterStatus === val ? "#E6EDF3" : "#8B949E", fontSize: "10px", padding: "5px 2px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: "10px", color: "#8B949E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </div>

          {filtered.map(client => (
            <ClientCard key={client.id} client={client} onClick={setSelected} selected={selected?.id === client.id} />
          ))}
        </div>

        {/* MAIN PANEL */}
        <div style={{ padding: "28px", overflowY: "auto" }}>
          {selected ? (
            <Fade>
              <ClientDetail client={selected} onClose={() => setSelected(null)} />
            </Fade>
          ) : (
            <div>
              <div style={{ marginBottom: "24px" }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "22px", marginBottom: "4px" }}>
                  Buenos días, agencia 🌲
                </h1>
                <p style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>
                  {new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {clients.filter(c => c.status === "active").length} osos trabajando ahora mismo
                </p>
              </div>

              <GlobalMetrics clients={clients} />

              {/* Activity feed */}
              <Fade delay={100}>
                <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "10px", padding: "20px" }}>
                  <div style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
                    Actividad reciente
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { time: "hace 4 min",  icon: "💬", msg: "Clínica Dental Arcos",  detail: "Nueva consulta: presupuesto ortodoncia", color: "#2D6A4F" },
                      { time: "hace 18 min", icon: "📅", msg: "Óptica Visión Clara",   detail: "Cita agendada: examen de vista sábado 10:30", color: "#1B4332" },
                      { time: "hace 42 min", icon: "⚠️",  msg: "Clínica Dental Arcos",  detail: "Escalada al dueño: consulta urgencia", color: "#E3B341" },
                      { time: "hace 1h",     icon: "🆕", msg: "Veterinaria PataPata",  detail: "Sistema activado · primer mensaje recibido", color: "#40916C" },
                      { time: "hace 2h",     icon: "💬", msg: "Óptica Visión Clara",   detail: "7 consultas resueltas sin intervención humana", color: "#1B4332" },
                    ].map(({ time, icon, msg, detail, color }, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ width: "32px", height: "32px", background: `${color}20`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#E6EDF3" }}>{msg}</span>
                            <span style={{ fontSize: "11px", color: "#8B949E", fontFamily: "'DM Mono', monospace" }}>{time}</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#8B949E", fontFamily: "'DM Mono', monospace", marginTop: "1px" }}>{detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Fade>

              {/* Empty state prompt */}
              <Fade delay={200}>
                <div style={{ marginTop: "16px", background: "#0D1117", border: "1px dashed #30363D", borderRadius: "10px", padding: "24px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🐻‍❄️</div>
                  <div style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>
                    Selecciona un cliente para ver sus métricas detalladas
                    <br />o activa uno nuevo con el botón de arriba
                  </div>
                </div>
              </Fade>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
