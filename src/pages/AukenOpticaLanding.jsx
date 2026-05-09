import { useState, useEffect, useRef } from "react";

const C = {
  cream:     "#090A0F",
  creamDeep: "#05060A",
  ink:       "#F8FAFC",
  inkMid:    "#94A3B8",
  inkFaint:  "#475569",
  cobalt:    "#FB923C", // Naranja principal
  cobaltLight:"#F97316",
  cobaltGhost:"#FB923C15",
  gold:      "#10B981", // Verde neón
  goldLight: "#047857",
  white:     "#11131C", // Surface card
  border:    "#23283A",
};

const PROBLEMS = [
  { icon: "📞", title: "Llamadas sin respuesta", desc: "Un paciente llama a las 8pm a consultar si su receta sigue vigente. Nadie atiende. El lunes ya fue a la competencia.", stat: "73%" , statDesc: "de consultas fuera de horario no se responden" },
  { icon: "📋", title: "Recetas que nadie controla", desc: "Pacientes con recetas vencidas hace meses siguen usando sus lentes viejos. Tú pierdes la venta del control y los lentes nuevos.", stat: "58%", statDesc: "de pacientes no regresa si no se le recuerda" },
  { icon: "📅", title: "Agenda subutilizada", desc: "Horas libres que podrían estar ocupadas si hubieras recordado a ese paciente cuyo control venció hace 3 semanas.", stat: "3.2×", statDesc: "más citas con seguimiento automatizado" },
];

const FEATURES = [
  {
    num: "01",
    title: "Ficha clínica activa",
    desc: "Cada paciente tiene su historial: receta completa, graduación por ojo, notas del optometrista y fecha de próximo control. El asistente la consulta en tiempo real.",
    detail: "OD / OI · Esfera · Cilindro · Eje · Adición · DP",
  },
  {
    num: "02",
    title: "Recordatorio inteligente de receta",
    desc: "El sistema detecta automáticamente qué pacientes tienen receta próxima a vencer o ya vencida, y genera mensajes personalizados por WhatsApp.",
    detail: "30 días antes · en fecha · post-vencimiento",
  },
  {
    num: "03",
    title: "Chat que conoce a tu paciente",
    desc: "Cuando alguien escribe, el asistente lo identifica por nombre o RUT, carga su ficha y responde con contexto real: su receta, su último control, su óptica.",
    detail: "Claude API · respuestas en < 3 segundos",
  },
  {
    num: "04",
    title: "Agendamiento sin fricción",
    desc: "El paciente consulta, el sistema califica, agenda y confirma. Sin llamadas perdidas, sin WhatsApps sin responder, sin horas vacías.",
    detail: "Web · WhatsApp · Instagram DM",
  },
];

const PLANS = [
  {
    name: "Plan Mensual",
    monthly: "89.990",
    setup: "150.000",
    desc: "Ideal para comenzar a automatizar tu óptica sin grandes riesgos.",
    features: ["Carga de pacientes (Excel)", "Hasta 1.000 pacientes", "Dashboard CRM Básico", "Recordatorios WhatsApp", "Agendamiento Inteligente", "Soporte vía chat"],
    cta: "Elegir Mensual",
    highlight: false,
    period: "/mes"
  },
  {
    name: "Plan Anual",
    monthly: "890.000",
    setup: "GRATIS",
    desc: "Para ópticas consolidadas. Ahorras $329.880 respecto al mensual.",
    features: ["CRM Financiero (Control de Ventas)", "Escáner OCR de Recetas con IA", "Gestión de Operativos en Terreno", "Pacientes y Campañas Ilimitadas", "Instalación $0 (Ahorras $150k)", "Prioridad de Soporte 24/7"],
    cta: "Elegir Anual",
    highlight: true,
    period: "/año"
  },
  {
    name: "Multi-Sucursal",
    monthly: "250.000",
    setup: "400.000",
    desc: "Para cadenas de ópticas. Precio base para Dashboard Maestro + $50k por sucursal extra.",
    features: ["Todo lo del Plan Anual", "Múltiples sucursales en 1 Dashboard", "Roles de Vendedores (Multi-Tenant)", "Reportes por Local y Operativo", "API Personalizada (Integraciones)", "Soporte Presencial/Videollamada"],
    cta: "Cotizar a Medida",
    highlight: false,
    period: "base/mes"
  },
];

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, y = 24, style = {} }) {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : `translateY(${y}px)`, transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

// SVG lente decorativo
function LensIcon({ size = 120, color = C.cobalt, opacity = 0.08 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ opacity }}>
      <circle cx="60" cy="60" r="50" stroke={color} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="35" stroke={color} strokeWidth="1" />
      <circle cx="60" cy="60" r="8" stroke={color} strokeWidth="1" />
      <line x1="10" y1="60" x2="110" y2="60" stroke={color} strokeWidth="0.5" />
      <line x1="60" y1="10" x2="60" y2="110" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

function ContactForm() {
  const [form, setForm] = useState({ nombre: "", optica: "", whatsapp: "", plan: "pro" });
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>👁️</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
        Recibido.
      </div>
      <div style={{ color: C.inkFaint, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
        Te contactamos en menos de 24 horas por WhatsApp.
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[
        { key: "nombre",   label: "Tu nombre",           ph: "Dra. Valeria Rojas" },
        { key: "optica",   label: "Nombre de tu óptica", ph: "Óptica Visión Clara" },
        { key: "whatsapp", label: "WhatsApp",             ph: "+56 9 1234 5678" },
      ].map(({ key, label, ph }) => (
        <div key={key}>
          <label style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 5 }}>{label}</label>
          <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
            style={{ width: "100%", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Mono', monospace" }}
            onFocus={e => e.target.style.borderColor = C.cobalt}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>
      ))}
      <div>
        <label style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 5 }}>Plan de interés</label>
        <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
          style={{ width: "100%", background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: "10px 12px", fontSize: 13, color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
          <option value="mensual">Plan Mensual · $89.990/mes</option>
          <option value="anual">Plan Anual · $890.000/año</option>
          <option value="multisucursal">Plan Multi-Sucursal</option>
        </select>
      </div>
      <button onClick={() => form.nombre && form.whatsapp && setSent(true)}
        style={{ background: C.cobalt, color: "#fff", border: "none", borderRadius: 4, padding: "13px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em", marginTop: 4 }}>
        ACTIVAR SISTEMA →
      </button>
    </div>
  );
}

export default function AukenOpticaLanding() {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    document.title = "Aukén Opti-Manager | Inteligencia Artificial para Ópticas";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "Automatiza tu óptica con IA. Lee recetas, agenda pacientes y recupera recetas vencidas por WhatsApp 24/7. Sistema integral de CRM para ópticas.";
  }, []);

  return (
    <div style={{ background: C.cream, minHeight: "100vh", color: C.ink, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; background: ${C.creamDeep}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes rotateSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .nav-link:hover { color: ${C.cobalt} !important; }
        .plan-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(251,146,60,.12) !important; }
        .feature-tab:hover { background: ${C.creamDeep} !important; }
        
        .grid-responsive { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .grid-features { display: grid; grid-template-columns: 280px 1fr; gap: 0; border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; background: ${C.white}; }
        
        @media (max-width: 900px) {
          .grid-responsive { grid-template-columns: 1fr; gap: 40px; }
          .grid-3 { grid-template-columns: 1fr; }
          .grid-features { grid-template-columns: 1fr; }
          .hide-mobile { display: none !important; }
          .mobile-center { text-align: center; }
          .mobile-padding { padding: 40px 20px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(245,240,232,.94)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, height: 56, display: "flex", alignItems: "center", padding: "0 40px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LensIcon size={24} opacity={1} color={C.cobalt} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: C.ink }}>AUKÉN</span>
          <span style={{ color: C.border, margin: "0 6px" }}>·</span>
          <span style={{ fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>ópticas</span>
        </div>
        <div className="hide-mobile" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["El problema", "Funciones", "Precios"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} className="nav-link"
              style={{ color: C.inkMid, fontSize: 12, textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", transition: "color .2s" }}>
              {l}
            </a>
          ))}
          <a href="#contacto" style={{ background: C.cobalt, color: "#fff", padding: "7px 18px", borderRadius: 3, fontSize: 12, textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
            ACTIVAR →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="mobile-padding" style={{ paddingTop: 120, paddingBottom: 80, maxWidth: 1160, margin: "0 auto", padding: "120px 40px 80px" }}>
        <div className="grid-responsive">
        <div>
          <div style={{ animation: "fadeUp .8s ease both", animationDelay: "0ms" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.cobaltGhost, border: `1px solid ${C.cobalt}30`, borderRadius: 3, padding: "5px 12px", marginBottom: 24 }}>
              <div style={{ width: 5, height: 5, background: "#4ADE80", borderRadius: "50%" }} />
              <span style={{ fontSize: 10, color: C.cobalt, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>SISTEMA ACTIVO · 24/7</span>
            </div>
          </div>
          <div style={{ animation: "fadeUp .8s ease both", animationDelay: "80ms" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: "clamp(40px, 5.5vw, 64px)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 24, color: C.ink }}>
              Tu óptica atiende.<br />
              <em style={{ color: C.cobalt, fontStyle: "italic" }}>Cada receta, recordada.</em><br />
              Cada paciente, retenido.
            </h1>
          </div>
          <div style={{ animation: "fadeUp .8s ease both", animationDelay: "160ms" }}>
            <p style={{ color: C.inkMid, fontSize: 16, lineHeight: 1.75, marginBottom: 32, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 300 }}>
              El sistema Aukén conoce la receta de cada paciente, sabe cuándo vence su control y los contacta automáticamente antes de que se vayan a la competencia.
            </p>
          </div>
          <div style={{ animation: "fadeUp .8s ease both", animationDelay: "240ms", display: "flex", gap: 12 }}>
            <a href="#contacto" style={{ background: C.cobalt, color: "#fff", padding: "13px 28px", borderRadius: 3, fontSize: 13, textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
              VER DEMO EN VIVO →
            </a>
            <a href="#funciones" style={{ background: "transparent", color: C.inkMid, padding: "13px 22px", borderRadius: 3, fontSize: 13, textDecoration: "none", border: `1px solid ${C.border}`, fontFamily: "'IBM Plex Mono', monospace" }}>
              Cómo funciona
            </a>
          </div>
          <div style={{ animation: "fadeUp .8s ease both", animationDelay: "320ms", marginTop: 28, display: "flex", gap: 20 }}>
            {[["Sin contrato mínimo", "✓"], ["Activo en 72h", "✓"], ["Soporte en Chile", "✓"]].map(([l, i]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: C.cobalt, fontSize: 12 }}>{i}</span>
                <span style={{ color: C.inkFaint, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual — lente concéntrico animado */}
        <div style={{ animation: "fadeUp .9s ease both", animationDelay: "200ms", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", animation: "rotateSlow 40s linear infinite", opacity: 0.06 }}>
            <LensIcon size={400} color={C.cobalt} opacity={1} />
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, maxWidth: 340, width: "100%", boxShadow: "0 8px 40px rgba(27,58,107,.08)", position: "relative", zIndex: 1 }}>
            {/* Fake receta card */}
            <div style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Receta óptica · Última visita
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 18, color: C.ink, marginBottom: 4 }}>María González</div>
            <div style={{ fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 16 }}>Control: 14 Ago 2024 · Dra. Valeria Rojas</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 14 }}>
              <thead>
                <tr style={{ background: C.cobalt }}>
                  {["", "Esf.", "Cil.", "Eje"].map(h => <th key={h} style={{ padding: "5px 8px", color: "#fff", fontSize: 10, fontWeight: 500, textAlign: "center" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[["OD", "-2.50", "-0.75", "180°"], ["OI", "-3.00", "-1.00", "175°"]].map(([e, ...v]) => (
                  <tr key={e} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "5px 8px", fontWeight: 700, color: C.cobalt, textAlign: "center" }}>{e}</td>
                    {v.map((val, i) => <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: C.ink }}>{val}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 5, padding: "8px 10px", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", fontFamily: "'IBM Plex Mono', monospace" }}>Receta vencida hace 91 días</div>
                <div style={{ fontSize: 10, color: "#991B1B", fontFamily: "'IBM Plex Mono', monospace" }}>Recordatorio enviado automáticamente →</div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* EL PROBLEMA */}
      <section id="el-problema" className="mobile-padding" style={{ background: C.ink, padding: "80px 40px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 48 }}>
              <div style={{ width: 32, height: 1, background: C.cobaltLight }} />
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: "clamp(28px,3.5vw,42px)", color: C.white, letterSpacing: "-0.02em" }}>
                Lo que le cuesta dinero a tu óptica hoy
              </h2>
            </div>
          </Reveal>
          <div className="grid-3">
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div style={{ border: "1px solid #2A2620", borderRadius: 8, padding: 28, borderLeft: `3px solid ${C.cobaltLight}`, background: "#1A1612" }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>{p.icon}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, color: C.white, marginBottom: 10, lineHeight: 1.2 }}>{p.title}</div>
                  <div style={{ color: "#8A8078", fontSize: 13, lineHeight: 1.7, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 300, marginBottom: 16 }}>{p.desc}</div>
                  <div style={{ borderTop: "1px solid #2A2620", paddingTop: 14 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 36, color: C.cobaltLight }}>{p.stat}</div>
                    <div style={{ fontSize: 10, color: "#6A6460", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{p.statDesc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONES */}
      <section id="funciones" className="mobile-padding" style={{ padding: "80px 40px", background: C.cream }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 24, height: 1, background: C.cobalt }} />
                <span style={{ fontSize: 10, color: C.cobalt, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>funciones</span>
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: "clamp(28px,3.5vw,44px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Un sistema construido<br />
                <em style={{ color: C.cobalt }}>específicamente para ópticas.</em>
              </h2>
            </div>
          </Reveal>
          <div className="grid-features">
            {/* Tabs */}
            <div style={{ borderRight: `1px solid ${C.border}` }}>
              {FEATURES.map((f, i) => (
                <button key={f.num} onClick={() => setActiveFeature(i)} className="feature-tab"
                  style={{ width: "100%", textAlign: "left", padding: "20px 20px", background: activeFeature === i ? C.cobaltGhost : "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", borderLeft: activeFeature === i ? `3px solid ${C.cobalt}` : "3px solid transparent", transition: "all .2s" }}>
                  <div style={{ fontSize: 10, color: activeFeature === i ? C.cobalt : C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>{f.num}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 15, color: activeFeature === i ? C.cobalt : C.ink }}>{f.title}</div>
                </button>
              ))}
            </div>
            {/* Content */}
            <div style={{ padding: 36, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 10, color: C.cobalt, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                {FEATURES[activeFeature].num} · {FEATURES[activeFeature].detail}
              </div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 30, color: C.ink, marginBottom: 14, lineHeight: 1.15 }}>
                {FEATURES[activeFeature].title}
              </h3>
              <p style={{ color: C.inkMid, fontSize: 15, lineHeight: 1.75, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 300, marginBottom: 24 }}>
                {FEATURES[activeFeature].desc}
              </p>
              <div style={{ background: C.creamDeep, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: C.cobalt, fontSize: 13 }}>→</span>
                <span style={{ fontSize: 11, color: C.inkMid, fontFamily: "'IBM Plex Mono', monospace" }}>{FEATURES[activeFeature].detail}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="mobile-padding" style={{ padding: "80px 40px", background: C.creamDeep }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div style={{ fontSize: 10, color: C.cobalt, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>planes</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: "clamp(28px,3.5vw,44px)", letterSpacing: "-0.02em" }}>
                Sin letra chica.<br /><em style={{ color: C.cobalt }}>Sin contrato mínimo.</em>
              </h2>
              <p style={{ color: C.inkFaint, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", marginTop: 10 }}>
                Implementación única + suscripción mensual. Cancela cuando quieras.
              </p>
            </div>
          </Reveal>
          <div className="grid-3">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div className="plan-card" style={{ background: plan.highlight ? C.cobalt : C.white, border: `1px solid ${plan.highlight ? C.cobalt : C.border}`, borderRadius: 8, padding: 28, position: "relative", transition: "all .25s", boxShadow: plan.highlight ? "0 8px 32px rgba(27,58,107,.2)" : "none", height: "100%", display: "flex", flexDirection: "column" }}>
                  {plan.highlight && (
                    <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#fff", padding: "3px 14px", borderRadius: 3, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                      MÁS ELEGIDO
                    </div>
                  )}
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, color: plan.highlight ? "#fff" : C.ink, marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 11, color: plan.highlight ? "rgba(255,255,255,.65)" : C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 20 }}>{plan.desc}</div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 36, color: plan.highlight ? "#fff" : C.cobalt }}>
                      ${plan.monthly}
                    </span>
                    <span style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,.6)" : C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{plan.period}</span>
                  </div>
                  <div style={{ fontSize: 10, color: plan.highlight ? "rgba(255,255,255,.5)" : C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 22, textTransform: "uppercase" }}>
                    + {plan.setup === "GRATIS" || plan.setup === "A Medida" ? plan.setup : `$${plan.setup} CLP`} implementación
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: plan.highlight ? C.goldLight : C.cobalt, fontSize: 12, marginTop: 1 }}>·</span>
                        <span style={{ fontSize: 12, color: plan.highlight ? "rgba(255,255,255,.8)" : C.inkMid, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 300 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href="#contacto" style={{ display: "block", textAlign: "center", background: plan.highlight ? C.white : C.cobalt, color: plan.highlight ? C.cobalt : "#fff", padding: "12px", borderRadius: 4, fontSize: 11, textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, letterSpacing: "0.06em" }}>
                    {plan.cta} →
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="mobile-padding" style={{ padding: "80px 40px", background: C.cream }}>
        <div className="grid-responsive" style={{ maxWidth: 1160, margin: "0 auto", alignItems: "start" }}>
          <Reveal>
            <div>
              <div style={{ fontSize: 10, color: C.cobalt, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>activar sistema</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: "clamp(28px,3.5vw,44px)", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 18 }}>
                Tu óptica activa<br />
                <em style={{ color: C.cobalt }}>en 72 horas.</em>
              </h2>
              <p style={{ color: C.inkMid, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 300, lineHeight: 1.75, marginBottom: 28 }}>
                Sin reuniones largas. Sin contratos de 12 meses.<br />
                Cuéntanos tu óptica y en 3 días ya estás operando con el sistema completo.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  ["Día 1", "Levantamos la ficha de tu óptica"],
                  ["Día 2", "Cargamos tus pacientes y servicios"],
                  ["Día 3", "Sistema en vivo y probado contigo"],
                ].map(([d, t]) => (
                  <div key={d} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, border: `1px solid ${C.cobalt}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.cobalt, flexShrink: 0 }}>{d}</div>
                    <div style={{ fontSize: 13, color: C.inkMid, fontFamily: "'IBM Plex Mono', monospace", paddingTop: 9 }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 32 }}>
              <div style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Formulario de contacto</div>
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: C.ink, padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LensIcon size={18} color="#fff" opacity={0.6} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>AUKÉN</span>
          <span style={{ color: "#4A4540", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>sistemas · Santiago, Chile</span>
        </div>
        <div style={{ color: "#4A4540", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
          © 2025 · cada receta, recordada
        </div>
      </footer>
    </div>
  );
}
