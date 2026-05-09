import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AukenLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "glow2026") {
      localStorage.setItem("auken_auth", "true");
      navigate("/optica/dashboard");
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#090A0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      color: "#F8FAFC",
      position: "relative",
      overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      `}</style>

      {/* Fondo Decorativo */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, background: "radial-gradient(circle, #FB923C20 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

      <div style={{
        background: "#11131C",
        border: "1px solid #23283A",
        borderRadius: 24,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        position: "relative",
        zIndex: 10,
        animation: error ? "shake 0.4s ease-in-out" : "none"
      }}>
        
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #FB923C, #7DD3FC)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, margin: "0 auto 16px", boxShadow: "0 0 20px #FB923C40" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Glow Vision</h1>
          <p style={{ color: "#94A3B8", fontSize: 14, marginTop: 8 }}>Ingresa al Sistema Aukén</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>Correo de Administrador</label>
            <input 
              type="text" 
              defaultValue="admin@glowvision.cl"
              disabled
              style={{ width: "100%", background: "#05060A", border: "1px solid #23283A", color: "#94A3B8", padding: "12px 16px", borderRadius: 12, outline: "none", fontSize: 14, fontFamily: "'Inter', sans-serif" }} 
            />
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>Contraseña Maestra</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{ width: "100%", background: "#05060A", border: `1px solid ${error ? "#F43F5E" : "#23283A"}`, color: "#F8FAFC", padding: "12px 16px", borderRadius: 12, outline: "none", fontSize: 14, fontFamily: "'Inter', sans-serif", transition: "border-color 0.2s" }} 
            />
            {error && <div style={{ color: "#F43F5E", fontSize: 12, marginTop: 6 }}>Contraseña incorrecta</div>}
          </div>

          <button type="submit" style={{
            background: "linear-gradient(90deg, #FB923C, #F97316)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 8,
            boxShadow: "0 4px 12px #FB923C40",
            transition: "transform 0.1s"
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={e => e.currentTarget.style.transform = "none"}
          >
            Sincronizar Datos
          </button>
        </form>

      </div>
      
      <div style={{ position: "absolute", bottom: 24, fontSize: 12, color: "#475569", fontFamily: "'Inter', sans-serif" }}>
        Seguridad de grado militar · Aukén Systems 2026
      </div>
    </div>
  );
}
