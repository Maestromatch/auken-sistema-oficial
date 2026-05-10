import { useState } from "react";

const C = {
  bg: "#F7F5F0", bgDeep: "#EFECE5", surface: "#FFFFFF",
  border: "#D8D4CB", borderDark: "#B8B2A7",
  ink: "#1A1612", inkMid: "#4A4540", inkFaint: "#8A8580",
  blue: "#1B3A6B", blueLight: "#2B5BA8", blueGhost: "#E8EEF7",
  teal: "#0D6E6E", tealLight: "#E0F2F2",
  amber: "#B45309", amberLight: "#FEF3C7",
  green: "#166534", greenLight: "#DCFCE7",
  purple: "#6B21A8", purpleLight: "#F3E8FF",
};

const SKILLS = [
  { id: 1, name: "Auditoría SEO", icon: "🔍", category: "Análisis", description: "Analiza el SEO completo de cualquier web y genera un informe visual con puntuación y correcciones.", triggers: ["audita el SEO", "analiza mi web", "revisa el posicionamiento"], status: "active" },
  { id: 2, name: "Automatizaciones N8N", icon: "⚡", category: "Automatización", description: "Crea, revisa y gestiona workflows de automatización en n8n para cualquier proceso de negocio.", triggers: ["automatiza esto", "workflow de n8n", "conectar herramientas"], status: "active" },
  { id: 3, name: "Auditoría Meta Ads", icon: "📊", category: "Análisis", description: "Audita campañas de Meta/Facebook Ads con análisis de rendimiento y recomendaciones.", triggers: ["audita mis ads", "revisa mi campaña", "Facebook Ads"], status: "active" },
  { id: 4, name: "Auditoría de Negocio", icon: "🏢", category: "Análisis", description: "Auditoría digital completa de un negocio: web, redes, embudo de ventas y plan de acción.", triggers: ["audita mi negocio", "analiza mi marca", "auditoría digital"], status: "active" },
  { id: 5, name: "Dashboard Facturas", icon: "💰", category: "Gestión", description: "Genera dashboards de facturación con métricas financieras y visualización de datos.", triggers: ["dashboard de facturas", "facturación", "métricas financieras"], status: "active" },
  { id: 6, name: "Extensión Chrome", icon: "🧩", category: "Desarrollo", description: "Crea extensiones de Chrome personalizadas para automatizar tareas del navegador.", triggers: ["extensión chrome", "crear extensión", "plugin navegador"], status: "active" },
  { id: 7, name: "Instagram Analytics", icon: "📷", category: "Redes Sociales", description: "Análisis completo de perfiles de Instagram con métricas y estrategia de contenido.", triggers: ["analiza mi Instagram", "métricas Instagram", "estrategia IG"], status: "active" },
  { id: 8, name: "Prospección", icon: "🎯", category: "Ventas", description: "Busca y analiza prospectos de negocio, genera informes y mensajes de contacto personalizados.", triggers: ["busca prospectos", "prospectar negocios", "encontrar clientes"], status: "active" },
  { id: 9, name: "Skill Creator", icon: "🛠️", category: "Desarrollo", description: "Crea nuevas skills personalizadas para automatizar cualquier tarea específica.", triggers: ["crea una skill", "nueva habilidad", "skill personalizada"], status: "active" },
  { id: 10, name: "Web Scrolling", icon: "🌐", category: "Análisis", description: "Análisis web con scrolling profundo para extraer datos y contenido completo.", triggers: ["analiza esta web", "scraping", "extraer datos web"], status: "active" },
  { id: 11, name: "Auditoría SEO Kit", icon: "📋", category: "Análisis", description: "Kit completo de auditoría SEO con herramientas avanzadas y reportes detallados.", triggers: ["kit SEO", "auditoría completa SEO"], status: "active" },
  { id: 12, name: "Kit N8N Avanzado", icon: "🔗", category: "Automatización", description: "Kit avanzado de automatización con patrones, validación y código personalizado.", triggers: ["n8n avanzado", "workflow complejo"], status: "active" },
  { id: 13, name: "WhatsApp GlowVision", icon: "💬", category: "Automatización", description: "Envío masivo y automatizado de mensajes vía Meta API. Maneja plantillas de bienvenida y recordatorios.", triggers: ["envía whatsapp", "notifica al paciente", "mensaje de bienvenida"], status: "active" },
  { id: 14, name: "Ahorro de Tokens", icon: "💡", category: "Optimización", description: "13 reglas para optimizar el uso de tokens en Claude y Claude Code.", triggers: ["ahorrar tokens", "optimizar Claude"], status: "config" },
];

const CATEGORIES = ["Todos", "Análisis", "Automatización", "Ventas", "Gestión", "Desarrollo", "Redes Sociales", "Optimización"];
const CAT_COLORS = { "Análisis": C.blue, "Automatización": C.teal, "Ventas": C.amber, "Gestión": C.green, "Desarrollo": C.purple, "Redes Sociales": "#DB2777", "Optimización": C.inkMid };

export default function AukenSkills() {
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = SKILLS.filter(s => {
    const matchCat = filter === "Todos" || s.category === filter;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; background: ${C.bgDeep}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 4px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* NAV */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.blue, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👁️</div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.ink }}>AUKÉN</span>
          <span style={{ color: C.border, margin: "0 6px" }}>·</span>
          <span style={{ fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>habilidades del agente</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/optica" style={{ textDecoration: "none", background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 12px", fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>← Óptica</a>
          <a href="/dashboard" style={{ textDecoration: "none", background: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 12px", fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>Dashboard</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, marginBottom: 6 }}>
            🧠 Habilidades del Agente
          </h1>
          <p style={{ fontSize: 13, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
            {SKILLS.length} skills activas · Tu agente puede ejecutar cualquiera de estas habilidades
          </p>
        </div>

        {/* Buscador + Filtros */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar habilidad..."
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: C.ink, outline: "none", fontFamily: "'IBM Plex Mono', monospace", width: 220 }}
            onFocus={e => e.target.style.borderColor = C.blue} onBlur={e => e.target.style.borderColor = C.border} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                background: filter === cat ? C.blue : C.surface,
                color: filter === cat ? "#fff" : C.inkFaint,
                border: `1px solid ${filter === cat ? C.blue : C.border}`,
                borderRadius: 14, padding: "4px 12px", fontSize: 10, cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", transition: "all .15s",
              }}>{cat}</button>
            ))}
          </div>
        </div>

        {/* Grid de Skills */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((skill, i) => {
            const catColor = CAT_COLORS[skill.category] || C.blue;
            return (
              <div key={skill.id} onClick={() => setSelected(selected?.id === skill.id ? null : skill)}
                style={{
                  background: C.surface, border: `1px solid ${selected?.id === skill.id ? catColor : C.border}`,
                  borderRadius: 10, padding: "18px 20px", cursor: "pointer",
                  borderLeft: `3px solid ${catColor}`, transition: "all .2s",
                  animation: `fadeIn .4s ease ${i * 0.05}s both`,
                  boxShadow: selected?.id === skill.id ? `0 4px 16px ${catColor}20` : "none",
                }}
                onMouseEnter={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = catColor + "60"; }}
                onMouseLeave={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = C.border; }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: `${catColor}12`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {skill.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14, color: C.ink }}>{skill.name}</div>
                      <div style={{ fontSize: 9, color: catColor, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>{skill.category}</div>
                    </div>
                  </div>
                  <span style={{
                    background: skill.status === "active" ? C.greenLight : C.amberLight,
                    color: skill.status === "active" ? C.green : C.amber,
                    border: `1px solid ${skill.status === "active" ? C.green : C.amber}30`,
                    borderRadius: 3, padding: "2px 7px", fontSize: 9,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>{skill.status === "active" ? "Activa" : "Config"}</span>
                </div>

                <p style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5, marginBottom: 10 }}>{skill.description}</p>

                {/* Triggers */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {skill.triggers.map(t => (
                    <span key={t} style={{
                      background: C.bgDeep, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: "2px 8px", fontSize: 9,
                      color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace",
                    }}>"{t}"</span>
                  ))}
                </div>

                {/* Detalle expandido */}
                {selected?.id === skill.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, animation: "fadeIn .3s ease" }}>
                    <div style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Cómo usar esta habilidad
                    </div>
                    <div style={{ background: C.bgDeep, borderRadius: 6, padding: "10px 12px", fontSize: 11, color: C.inkMid, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6 }}>
                      Escribe en el chat cualquiera de los triggers de arriba, o describe lo que necesitas y el agente activará esta skill automáticamente.
                    </div>
                    <a href="/optica" style={{
                      display: "inline-block", marginTop: 10,
                      background: catColor, color: "#fff", textDecoration: "none",
                      borderRadius: 5, padding: "7px 14px", fontSize: 11,
                      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                    }}>Ir al chat →</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div style={{ marginTop: 28, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Skills activas", value: SKILLS.filter(s => s.status === "active").length, color: C.green },
            { label: "Categorías", value: CATEGORIES.length - 1, color: C.blue },
            { label: "Triggers totales", value: SKILLS.reduce((a, s) => a + s.triggers.length, 0), color: C.teal },
            { label: "En configuración", value: SKILLS.filter(s => s.status === "config").length, color: C.amber },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 28, color }}>{value}</div>
              <div style={{ fontSize: 10, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
