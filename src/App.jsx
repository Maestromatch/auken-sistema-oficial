import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Component } from "react";
import AukenOS              from "./pages/AukenOS";
import AukenOptica          from "./pages/AukenOptica";
import AukenOpticaLanding   from "./pages/AukenOpticaLanding";
import AukenOpticaDashboard from "./pages/AukenOpticaDashboard";
import AukenLogin           from "./pages/AukenLogin";
import AukenAdmin           from "./pages/AukenAdmin";
import { ToasterProvider }  from "./components/Toaster";

// ── Error Boundary global ─────────────────────────────────────────────────────
// Captura errores de render que de otro modo dejan la pantalla en blanco.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error("[Aukén ErrorBoundary]", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: "#08090C", minHeight: "100vh", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 24,
          fontFamily: "Inter, sans-serif",
        }}>
          <div style={{
            background: "#0E1014", border: "1px solid rgba(248,113,113,0.35)",
            borderRadius: 12, padding: 32, maxWidth: 520, width: "100%",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#F87171", marginBottom: 8 }}>
              Error al cargar la página
            </div>
            <div style={{ fontSize: 13, color: "#8A8F98", lineHeight: 1.7, marginBottom: 16 }}>
              {this.state.error?.message || "Error desconocido"}
            </div>
            <details style={{ marginBottom: 20 }}>
              <summary style={{ fontSize: 12, color: "#5C616C", cursor: "pointer" }}>Ver detalle técnico</summary>
              <pre style={{ fontSize: 11, color: "#5C616C", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {this.state.error?.stack?.split("\n").slice(0, 6).join("\n")}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#F97316", color: "#08090C", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("auken_auth") === "true";
  const isSuspended = localStorage.getItem("auken_suspended") === "true";
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (isSuspended) return (
    <div style={{ background: "#090A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#F43F5E", marginBottom: 8 }}>Cuenta Suspendida</div>
        <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>Tu suscripción ha sido pausada. Contacta al administrador de Aukén para reactivar tu servicio.</div>
      </div>
    </div>
  );
  return children;
}

function RootRedirect() {
  const isAuthenticated = localStorage.getItem("auken_auth") === "true";
  return <Navigate to={isAuthenticated ? "/optica/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <ToasterProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<RootRedirect />} />
        <Route path="/os"                element={<AukenOS />} />
        <Route path="/login"             element={<AukenLogin />} />

        {/* Óptica */}
        <Route path="/optica"           element={<ProtectedRoute><ErrorBoundary><AukenOptica /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/optica/landing"   element={<AukenOpticaLanding />} />
        <Route path="/optica/dashboard" element={<ProtectedRoute><ErrorBoundary><AukenOpticaDashboard /></ErrorBoundary></ProtectedRoute>} />

        {/* Aliases para evitar 404 si el usuario tipea URL parcial */}
        <Route path="/dashboard"         element={<Navigate to="/optica/dashboard" replace />} />
        <Route path="/monitor"           element={<Navigate to="/optica" replace />} />
        <Route path="/chat"              element={<Navigate to="/optica" replace />} />

        <Route path="/admin"             element={<AukenAdmin />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToasterProvider>
  );
}
