import React from 'react';
import { useNavigate } from 'react-router-dom';

const C = {
  bg: "#0A0C10",
  surface: "#161B22",
  accent: "#0055FF",
  accentGlow: "rgba(0, 85, 255, 0.4)",
  text: "#F0F6FC",
  textDim: "#8B949E",
  glass: "rgba(22, 27, 34, 0.8)",
  border: "rgba(255, 255, 255, 0.1)"
};

const Section = ({ children, style }) => (
  <section style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto", ...style }}>
    {children}
  </section>
);

const Feature = ({ icon, title, desc }) => (
  <div style={{ padding: 24, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, transition: "transform 0.3s ease" }}>
    <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
    <h3 style={{ fontSize: 20, marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>{title}</h3>
    <p style={{ fontSize: 14, color: C.textDim, lineHeight: 1.6 }}>{desc}</p>
  </div>
);

export default function AukenPropuesta() {
  const navigate = useNavigate();

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Outfit:wght@600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .hero-gradient {
          background: radial-gradient(circle at top right, ${C.accentGlow}, transparent 40%),
                      radial-gradient(circle at bottom left, rgba(0, 255, 195, 0.1), transparent 40%);
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.glass, backdropFilter: "blur(10px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>A</div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "1px", fontFamily: "'Outfit'" }}>AUKÉN</span>
        </div>
        <button onClick={() => navigate('/login')} style={{ background: C.accent, color: "white", border: "none", padding: "10px 24px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Entrar al Portal</button>
      </nav>

      {/* HERO */}
      <div className="hero-gradient">
        <Section style={{ textAlign: "center", paddingTop: 120, paddingBottom: 120 }}>
          <h1 style={{ fontSize: "clamp(40px, 8vw, 72px)", fontFamily: "'Playfair Display', serif", lineHeight: 1.1, marginBottom: 24 }}>
            El futuro de tu óptica <br/><span style={{ color: C.accent }}>está en la Inteligencia.</span>
          </h1>
          <p style={{ fontSize: 20, color: C.textDim, maxWidth: 700, margin: "0 auto 40px", lineHeight: 1.6 }}>
            Aukén transforma Ópticas Ferreira en una potencia tecnológica con recepcionistas IA 24/7 y automatización total de pacientes.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button style={{ background: C.accent, color: "white", border: "none", padding: "16px 32px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: `0 8px 24px ${C.accentGlow}` }}>Solicitar Demo</button>
            <button style={{ background: "transparent", color: "white", border: `1px solid ${C.border}`, padding: "16px 32px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Ver Planes</button>
          </div>
        </Section>
      </div>

      {/* FEATURES */}
      <Section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          <Feature 
            icon="🎙️" 
            title="Claudia: Tu Recepcionista IA" 
            desc="Atiende llamadas 24/7 con acento chileno fluido. Agenda citas en tu Dashboard sin que muevas un dedo." 
          />
          <Feature 
            icon="💬" 
            title="WhatsApp Automation" 
            desc="Confirmaciones y recordatorios automáticos vía API Oficial de Meta. Sin riesgos de baneo y 100% profesional." 
          />
          <Feature 
            icon="👁️" 
            title="Visión Artificial OCR" 
            desc="Digitaliza recetas médicas en segundos. Nuestra IA lee las dioptrías y las guarda en la ficha del paciente automáticamente." 
          />
        </div>
      </Section>

      {/* SECURITY & DATA */}
      <div style={{ background: "#0D1117", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 36, fontFamily: "'Outfit'", marginBottom: 24 }}>Seguridad de Nivel Bancario 🛡️</h2>
            <p style={{ color: C.textDim, fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
              Sabemos que los datos de tus pacientes son sagrados. Aukén utiliza encriptación de extremo a extremo y servidores seguros para garantizar que la información médica esté protegida bajo los estándares más altos.
            </p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {["Encriptación SSL/TLS", "Cumplimiento de Privacidad", "Backups Automáticos", "Acceso Restringido por Roles"].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 16 }}>
                  <span style={{ color: "#238636" }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: C.surface, padding: 40, borderRadius: 24, border: `1px solid ${C.accent}40`, boxShadow: `0 0 40px ${C.accent}15` }}>
            <h4 style={{ color: C.accent, marginBottom: 16 }}>DATA INSIGHT</h4>
            <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>99.9%</div>
            <p style={{ color: C.textDim }}>Precisión en la lectura de recetas con IA Vision.</p>
          </div>
        </Section>
      </div>

      {/* PRICING */}
      <Section style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 42, fontFamily: "'Outfit'", marginBottom: 16 }}>Planes para Crecer</h2>
        <p style={{ color: C.textDim, marginBottom: 60 }}>Escala desde un local hasta una cadena nacional.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
          {/* Plan 1 */}
          <div style={{ padding: 40, background: C.surface, borderRadius: 24, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>Plan Básico</h3>
            <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 24 }}>$49.990<span style={{ fontSize: 16, color: C.textDim }}>/mes</span></div>
            <ul style={{ textAlign: "left", padding: 0, listStyle: "none", marginBottom: 40 }}>
              <li style={{ marginBottom: 12 }}>✓ 1 Sucursal</li>
              <li style={{ marginBottom: 12 }}>✓ Claudia IA (Voz Estándar)</li>
              <li style={{ marginBottom: 12 }}>✓ Dashboard de Gestión</li>
              <li style={{ marginBottom: 12 }}>✓ Soporte por Email</li>
            </ul>
            <button style={{ width: "100%", padding: "14px", borderRadius: 10, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 600 }}>Elegir Básico</button>
          </div>

          {/* Plan 2 */}
          <div style={{ padding: 40, background: C.surface, borderRadius: 24, border: `2px solid ${C.accent}`, position: "relative" }}>
            <div style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", background: C.accent, padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>RECOMENDADO</div>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>Plan Pro</h3>
            <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 24 }}>$129.990<span style={{ fontSize: 16, color: C.textDim }}>/mes</span></div>
            <ul style={{ textAlign: "left", padding: 0, listStyle: "none", marginBottom: 40 }}>
              <li style={{ marginBottom: 12 }}>✓ Hasta 3 Sucursales</li>
              <li style={{ marginBottom: 12 }}>✓ Claudia IA (Voz Chilena)</li>
              <li style={{ marginBottom: 12 }}>✓ WhatsApp Business API</li>
              <li style={{ marginBottom: 12 }}>✓ OCR de Recetas Full</li>
            </ul>
            <button style={{ width: "100%", padding: "14px", borderRadius: 10, background: C.accent, border: "none", color: "white", fontWeight: 600 }}>Elegir Pro</button>
          </div>

          {/* Plan 3 */}
          <div style={{ padding: 40, background: C.surface, borderRadius: 24, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>Corporativo</h3>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 24, marginTop: 18 }}>Personalizado</div>
            <ul style={{ textAlign: "left", padding: 0, listStyle: "none", marginBottom: 40 }}>
              <li style={{ marginBottom: 12 }}>✓ Sucursales Ilimitadas</li>
              <li style={{ marginBottom: 12 }}>✓ IA con Voz de Marca</li>
              <li style={{ marginBottom: 12 }}>✓ Integración con ERP/SII</li>
              <li style={{ marginBottom: 12 }}>✓ Account Manager Dedicado</li>
            </ul>
            <button style={{ width: "100%", padding: "14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: "white", fontWeight: 600 }}>Contactar</button>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer style={{ padding: "60px 24px", borderTop: `1px solid ${C.border}`, textAlign: "center", color: C.textDim }}>
        <p>© 2026 Aukén Inteligencia Óptica. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
