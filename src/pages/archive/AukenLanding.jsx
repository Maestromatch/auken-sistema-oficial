import { useState, useEffect, useRef } from "react";

const NICHES = {
  dental: {
    label: "Clínica Dental",
    icon: "🦷",
    pain: "Pacientes que llaman a las 10pm y no los atienden nunca más.",
    stat: "68%",
    statLabel: "de las consultas dentales se pierden fuera de horario",
    demo: ["Hola, necesito una hora para sacarme una muela del juicio", "¿Tienen disponibilidad este sábado?", "¿Cuánto cuesta aproximadamente?"],
    results: ["47 consultas atendidas en 30 días", "12 citas agendadas automáticamente", "3 emergencias derivadas al doctor a tiempo"],
    color: "#2D6A4F",
    accent: "#95D5B2",
  },
  optica: {
    label: "Óptica",
    icon: "👁️",
    pain: "Clientes que preguntan precios y se van a la competencia.",
    stat: "54%",
    statLabel: "de los clientes compra donde responden primero",
    demo: ["¿Hacen examen de vista sin hora previa?", "Busco lentes para computador, ¿qué tienen?", "¿Demoran mucho los lentes con medida?"],
    results: ["31 cotizaciones respondidas al instante", "8 exámenes agendados en fin de semana", "ROI: 4.2x en 45 días"],
    color: "#1B4332",
    accent: "#B7E4C7",
  },
  veterinaria: {
    label: "Veterinaria",
    icon: "🐾",
    pain: "Dueños de mascotas en pánico a medianoche sin saber qué hacer.",
    stat: "3 de 4",
    statLabel: "emergencias veterinarias ocurren fuera del horario comercial",
    demo: ["Mi perro se comió algo, ¿qué hago?", "¿Atienden urgencias nocturnas?", "Necesito vacunar a mi gato, ¿cuánto sale?"],
    results: ["22 urgencias triadas correctamente", "15 consultas presenciales generadas", "0 clientes perdidos por no respuesta"],
    color: "#40916C",
    accent: "#D8F3DC",
  },
  carniceria: {
    label: "Carnicería",
    icon: "🥩",
    pain: "Pedidos por WhatsApp que se pierden entre mensajes.",
    stat: "82%",
    statLabel: "de los pedidos de delivery se hacen por WhatsApp en Chile",
    demo: ["¿Tienen costillar para este domingo?", "¿A qué hora cierran hoy?", "Quiero hacer un pedido para mañana temprano"],
    results: ["94 pedidos gestionados sin error", "Promedio de respuesta: 8 segundos", "Ventas +23% en primer mes"],
    color: "#6B2D0F",
    accent: "#F4A261",
  },
  botilleria: {
    label: "Botillería",
    icon: "🍷",
    pain: "Consultas de stock y precio que nunca se responden a tiempo.",
    stat: "61%",
    statLabel: "de los clientes abandona si no recibe respuesta en 5 minutos",
    demo: ["¿Tienen Carménère de menos de 10 mil?", "¿Hacen despacho a domicilio?", "¿Hasta qué hora abren los sábados?"],
    results: ["Tiempo respuesta: de 4 horas a 11 segundos", "38 despachos coordinados automáticamente", "Reseñas Google: de 3.2 a 4.7 estrellas"],
    color: "#4A1942",
    accent: "#C77DFF",
  },
};

const PLANS = [
  {
    name: "Oso Polar Base",
    price: "150.000",
    setup: "400.000",
    desc: "Para negocios que quieren no perder ni una consulta más.",
    features: ["Chat web + WhatsApp", "Respuestas 24/7", "Agendamiento básico", "Reporte semanal por WhatsApp", "Soporte por correo"],
    highlight: false,
  },
  {
    name: "Oso Polar Pro",
    price: "250.000",
    setup: "600.000",
    desc: "Para negocios que quieren crecer mientras duermen.",
    features: ["Todo lo anterior", "Instagram DM automatizado", "Formulario web inteligente", "Panel de métricas en tiempo real", "Escalada a dueño con resumen", "Soporte directo por WhatsApp"],
    highlight: true,
  },
  {
    name: "Oso Polar Total",
    price: "380.000",
    setup: "900.000",
    desc: "Para cuando quieres que la competencia llore.",
    features: ["Todo lo anterior", "Múltiples sucursales", "CRM básico integrado", "Reportes mensuales ejecutivos", "Personalización avanzada de flujos", "Reunión mensual de optimización"],
    highlight: false,
  },
];

function useIntersection(ref, threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return visible;
}

function AnimSection({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const visible = useIntersection(ref);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function ChatDemo({ niche }) {
  const data = NICHES[niche];
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    setStep(0);
    setShown([]);
    setTyping(false);
  }, [niche]);

  useEffect(() => {
    if (step >= data.demo.length * 2) return;
    const isUser = step % 2 === 0;
    const msgIdx = Math.floor(step / 2);
    if (isUser) {
      const t = setTimeout(() => {
        setShown(p => [...p, { type: "user", text: data.demo[msgIdx] }]);
        setStep(s => s + 1);
      }, 900);
      return () => clearTimeout(t);
    } else {
      setTyping(true);
      const t = setTimeout(() => {
        setTyping(false);
        const responses = [
          `¡Hola! Soy el asistente de ${data.label}. Con gusto te ayudo. ¿Para cuándo necesitas la hora?`,
          `Revisando disponibilidad... Tenemos el sábado 15 a las 10:30 o 12:00. ¿Cuál te acomoda?`,
          `El valor estimado está entre $80.000 y $180.000 según complejidad. El doctor te confirma el presupuesto exacto en la consulta. ¿Agendamos?`,
        ];
        setShown(p => [...p, { type: "bot", text: responses[msgIdx] || "Perfecto, te confirmo por este medio." }]);
        setStep(s => s + 1);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [step, data]);

  return (
    <div style={{ background: "#0D1117", borderRadius: "12px", border: "1px solid #21262D", overflow: "hidden", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ background: "#161B22", padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #21262D" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#238636" }} />
        <span style={{ color: "#8B949E", fontSize: "12px" }}>oso-polar-demo · {data.label}</span>
        <button onClick={() => { setStep(0); setShown([]); setTyping(false); }}
          style={{ marginLeft: "auto", background: "none", border: "1px solid #30363D", color: "#8B949E", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>
          ↺ replay
        </button>
      </div>
      <div style={{ padding: "16px", minHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {shown.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.type === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: m.type === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.type === "user" ? data.color : "#21262D",
              color: m.type === "user" ? "#fff" : "#E6EDF3", fontSize: "13px", lineHeight: 1.5,
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }}>
              {m.type === "bot" && <span style={{ color: data.accent, fontSize: "11px", display: "block", marginBottom: "3px" }}>Oso Polar ·</span>}
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ padding: "10px 14px", background: "#21262D", borderRadius: "16px 16px 16px 4px" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: data.accent, margin: "0 2px", animation: "bounce 1s infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ROICalc({ niche }) {
  const data = NICHES[niche];
  const [calls, setCalls] = useState(40);
  const [ticket, setTicket] = useState(60000);
  const lost = Math.round(calls * 0.35);
  const recovered = Math.round(lost * 0.6);
  const revenue = recovered * ticket;

  return (
    <div style={{ background: "#0D1117", border: `1px solid ${data.color}40`, borderRadius: "12px", padding: "24px" }}>
      <div style={{ color: "#8B949E", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
        Calculadora de recuperación
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ color: "#E6EDF3", fontSize: "13px", display: "block", marginBottom: "6px" }}>
            Consultas/mes que recibes: <strong style={{ color: data.accent }}>{calls}</strong>
          </label>
          <input type="range" min="10" max="300" value={calls} onChange={e => setCalls(+e.target.value)}
            style={{ width: "100%", accentColor: data.color }} />
        </div>
        <div>
          <label style={{ color: "#E6EDF3", fontSize: "13px", display: "block", marginBottom: "6px" }}>
            Ticket promedio: <strong style={{ color: data.accent }}>${ticket.toLocaleString("es-CL")}</strong>
          </label>
          <input type="range" min="5000" max="500000" step="5000" value={ticket} onChange={e => setTicket(+e.target.value)}
            style={{ width: "100%", accentColor: data.color }} />
        </div>
        <div style={{ background: "#161B22", borderRadius: "8px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
          {[
            { label: "Consultas perdidas", value: lost, color: "#F85149" },
            { label: "Recuperadas c/ Aukén", value: recovered, color: data.accent },
            { label: "Ingreso adicional/mes", value: `$${(revenue / 1000).toFixed(0)}K`, color: "#3FB950" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ color, fontSize: "22px", fontWeight: "700", fontFamily: "'DM Mono', monospace" }}>{value}</div>
              <div style={{ color: "#8B949E", fontSize: "11px", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ color: "#8B949E", fontSize: "11px", textAlign: "center" }}>
          vs. inversión mensual en Aukén: <span style={{ color: "#E6EDF3" }}>$150.000 – $380.000 CLP</span>
        </div>
      </div>
    </div>
  );
}

export default function AukenLanding() {
  const [activeNiche, setActiveNiche] = useState("dental");
  const niche = NICHES[activeNiche];

  return (
    <div style={{ background: "#080C10", minHeight: "100vh", fontFamily: "'Syne', 'DM Mono', sans-serif", color: "#E6EDF3", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes pulse-slow { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        ::-webkit-scrollbar { width: 4px; background: #0D1117; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
        .niche-btn:hover { opacity: 0.85; transform: translateY(-1px); transition: all 0.2s; }
        .plan-card:hover { border-color: rgba(255,255,255,0.15) !important; transform: translateY(-2px); transition: all 0.25s; }
        .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); transition: all 0.2s; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(8,12,16,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #21262D", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 8, height: 8, background: niche.accent, borderRadius: "50%", animation: "pulse-slow 2s infinite" }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>AUKÉN</span>
          <span style={{ color: "#8B949E", fontSize: "11px", marginLeft: "4px" }}>sistemas</span>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {["Demo", "Resultados", "Precios"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "#8B949E", fontSize: "13px", textDecoration: "none", fontFamily: "'DM Mono', monospace" }}
              onMouseEnter={e => e.target.style.color = "#E6EDF3"} onMouseLeave={e => e.target.style.color = "#8B949E"}>
              {item}
            </a>
          ))}
          <a href="#contacto" className="cta-btn" style={{ background: niche.color, color: "#fff", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
            Activar sistema →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: "120px", paddingBottom: "80px", maxWidth: "1200px", margin: "0 auto", padding: "120px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#161B22", border: "1px solid #30363D", borderRadius: "20px", padding: "6px 14px", marginBottom: "24px" }}>
              <span style={{ width: 6, height: 6, background: "#3FB950", borderRadius: "50%", display: "inline-block", animation: "pulse-slow 1.5s infinite" }} />
              <span style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace" }}>sistema activo · 24/7</span>
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "20px" }}>
              Tu negocio atiende.<br />
              <span style={{ color: niche.accent }}>Tú duermes.</span>
            </h1>
            <p style={{ color: "#8B949E", fontSize: "17px", lineHeight: 1.7, marginBottom: "32px", fontFamily: "'DM Mono', monospace", fontWeight: 300 }}>
              {niche.pain}
              <br /><br />
              El sistema Aukén atiende, califica y agenda por ti. Como tu mejor empleado, pero a las 3 de la mañana.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a href="#demo" className="cta-btn" style={{ background: niche.color, color: "#fff", padding: "14px 28px", borderRadius: "8px", fontSize: "15px", textDecoration: "none", fontWeight: 700, display: "inline-block" }}>
                Ver demo en vivo →
              </a>
              <a href="#precios" className="cta-btn" style={{ background: "transparent", color: "#E6EDF3", padding: "14px 28px", borderRadius: "8px", fontSize: "15px", textDecoration: "none", border: "1px solid #30363D", display: "inline-block" }}>
                Ver planes
              </a>
            </div>
            <div style={{ marginTop: "32px", display: "flex", gap: "24px" }}>
              {[["Sin contrato largo", "✓"], ["Activo en 72h", "✓"], ["Soporte en Chile", "✓"]].map(([label, icon]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: niche.accent, fontSize: "13px" }}>{icon}</span>
                  <span style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* STAT + NICHE SELECTOR */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0D1117", border: `1px solid ${niche.color}60`, borderRadius: "16px", padding: "28px", textAlign: "center", animation: "float 4s ease-in-out infinite" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "52px", color: niche.accent, lineHeight: 1 }}>
                {niche.stat}
              </div>
              <div style={{ color: "#8B949E", fontSize: "13px", marginTop: "8px", fontFamily: "'DM Mono', monospace", lineHeight: 1.5 }}>
                {niche.statLabel}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
              {Object.entries(NICHES).map(([key, val]) => (
                <button key={key} onClick={() => setActiveNiche(key)} className="niche-btn"
                  style={{ background: activeNiche === key ? val.color : "#161B22", border: activeNiche === key ? `1px solid ${val.accent}` : "1px solid #30363D", borderRadius: "8px", padding: "10px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "18px" }}>{val.icon}</span>
                  <span style={{ color: activeNiche === key ? "#fff" : "#8B949E", fontSize: "9px", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{val.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" style={{ background: "#0D1117", borderTop: "1px solid #21262D", borderBottom: "1px solid #21262D", padding: "80px 32px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimSection>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>demo interactivo</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em" }}>
                Así habla el Oso Polar con tus clientes
              </h2>
            </div>
          </AnimSection>
          <AnimSection delay={100}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "start" }}>
              <ChatDemo niche={activeNiche} />
              <ROICalc niche={activeNiche} />
            </div>
          </AnimSection>
        </div>
      </section>

      {/* RESULTADOS */}
      <section id="resultados" style={{ padding: "80px 32px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimSection>
            <div style={{ marginBottom: "48px" }}>
              <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>casos reales</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em" }}>
                Lo que pasa cuando el Oso trabaja
              </h2>
            </div>
          </AnimSection>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {niche.results.map((result, i) => (
              <AnimSection key={result} delay={i * 100}>
                <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "12px", padding: "28px", borderLeft: `3px solid ${niche.color}` }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", color: niche.accent, fontSize: "12px", marginBottom: "8px" }}>resultado {String(i + 1).padStart(2, "0")}</div>
                  <div style={{ color: "#E6EDF3", fontSize: "15px", lineHeight: 1.5 }}>{result}</div>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" style={{ background: "#0D1117", borderTop: "1px solid #21262D", borderBottom: "1px solid #21262D", padding: "80px 32px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <AnimSection>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>planes</div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em" }}>Sin letra chica</h2>
              <p style={{ color: "#8B949E", fontSize: "14px", marginTop: "8px", fontFamily: "'DM Mono', monospace" }}>Implementación única + suscripción mensual. Sin contrato mínimo.</p>
            </div>
          </AnimSection>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {PLANS.map((plan, i) => (
              <AnimSection key={plan.name} delay={i * 120}>
                <div className="plan-card" style={{ background: plan.highlight ? "#161B22" : "#0D1117", border: plan.highlight ? `1px solid ${niche.color}` : "1px solid #21262D", borderRadius: "12px", padding: "28px", position: "relative", height: "100%" }}>
                  {plan.highlight && (
                    <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: niche.color, color: "#fff", padding: "4px 14px", borderRadius: "12px", fontSize: "11px", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
                      más popular
                    </div>
                  )}
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "18px", marginBottom: "4px" }}>{plan.name}</div>
                  <div style={{ color: "#8B949E", fontSize: "12px", marginBottom: "20px", fontFamily: "'DM Mono', monospace" }}>{plan.desc}</div>
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#8B949E", fontSize: "11px", fontFamily: "'DM Mono', monospace" }}>desde </span>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "28px", color: plan.highlight ? niche.accent : "#E6EDF3" }}>${plan.price}</span>
                    <span style={{ color: "#8B949E", fontSize: "12px" }}>/mes CLP</span>
                  </div>
                  <div style={{ color: "#8B949E", fontSize: "11px", marginBottom: "24px", fontFamily: "'DM Mono', monospace" }}>
                    + ${plan.setup} CLP implementación única
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <span style={{ color: niche.accent, fontSize: "13px", marginTop: "1px" }}>·</span>
                        <span style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href="#contacto" className="cta-btn" style={{ display: "block", textAlign: "center", background: plan.highlight ? niche.color : "transparent", color: plan.highlight ? "#fff" : "#E6EDF3", padding: "12px", borderRadius: "6px", fontSize: "13px", textDecoration: "none", fontWeight: 600, border: plan.highlight ? "none" : "1px solid #30363D" }}>
                    Activar {plan.name} →
                  </a>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" style={{ padding: "80px 32px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <AnimSection>
            <div style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>activar sistema</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em", marginBottom: "16px" }}>
              Activo en 72 horas.
            </h2>
            <p style={{ color: "#8B949E", fontSize: "15px", fontFamily: "'DM Mono', monospace", marginBottom: "40px", lineHeight: 1.6 }}>
              Sin reuniones largas. Sin contratos de 12 meses.<br />
              Cuéntanos tu negocio y en 3 días ya estás operando.
            </p>
          </AnimSection>
          <AnimSection delay={150}>
            <ContactForm niche={niche} nicheKey={activeNiche} />
          </AnimSection>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #21262D", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "16px" }}>AUKÉN</span>
          <span style={{ color: "#8B949E", fontSize: "11px", fontFamily: "'DM Mono', monospace" }}>sistemas · Santiago, Chile</span>
        </div>
        <div style={{ color: "#8B949E", fontSize: "11px", fontFamily: "'DM Mono', monospace" }}>
          © 2025 · El oso trabaja mientras duermes
        </div>
      </footer>
    </div>
  );
}

function ContactForm({ niche, nicheKey }) {
  const [form, setForm] = useState({ nombre: "", negocio: "", whatsapp: "", nicho: nicheKey });
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!form.nombre || !form.whatsapp) return;
    setSent(true);
  };

  if (sent) return (
    <div style={{ background: "#0D1117", border: `1px solid ${niche.color}`, borderRadius: "12px", padding: "40px", textAlign: "center" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>🐻‍❄️</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "8px" }}>El Oso está en camino.</div>
      <div style={{ color: "#8B949E", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>Te contactamos en menos de 24 horas por WhatsApp.</div>
    </div>
  );

  return (
    <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "12px", padding: "32px", textAlign: "left" }}>
      {[
        { key: "nombre", label: "Nombre y apellido", placeholder: "Dr. García" },
        { key: "negocio", label: "Nombre del negocio", placeholder: "Clínica Dental García" },
        { key: "whatsapp", label: "WhatsApp", placeholder: "+56 9 1234 5678" },
      ].map(({ key, label, placeholder }) => (
        <div key={key} style={{ marginBottom: "16px" }}>
          <label style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: "6px" }}>{label}</label>
          <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
            style={{ width: "100%", background: "#161B22", border: "1px solid #30363D", borderRadius: "6px", padding: "12px 14px", color: "#E6EDF3", fontSize: "14px", fontFamily: "'DM Mono', monospace", outline: "none" }}
            onFocus={e => e.target.style.borderColor = niche.color}
            onBlur={e => e.target.style.borderColor = "#30363D"}
          />
        </div>
      ))}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ color: "#8B949E", fontSize: "12px", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: "6px" }}>Tipo de negocio</label>
        <select value={form.nicho} onChange={e => setForm(p => ({ ...p, nicho: e.target.value }))}
          style={{ width: "100%", background: "#161B22", border: "1px solid #30363D", borderRadius: "6px", padding: "12px 14px", color: "#E6EDF3", fontSize: "14px", fontFamily: "'DM Mono', monospace" }}>
          {Object.entries(NICHES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>
      <button onClick={handleSubmit} className="cta-btn"
        style={{ width: "100%", background: niche.color, color: "#fff", padding: "14px", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: "pointer", border: "none", fontFamily: "'Syne', sans-serif" }}>
        Activar mi sistema →
      </button>
    </div>
  );
}
