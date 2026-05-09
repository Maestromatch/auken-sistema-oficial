import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AukenOS              from "./pages/AukenOS";
import AukenLanding         from "./pages/AukenLanding";
import AukenDashboard       from "./pages/AukenDashboard";
import AukenWidget          from "./pages/AukenWidget";
import AukenOptica          from "./pages/AukenOptica";
import AukenOpticaLanding   from "./pages/AukenOpticaLanding";
import AukenOpticaDashboard from "./pages/AukenOpticaDashboard";
import AukenPropuesta       from "./pages/AukenPropuesta";
import AukenIntegrations    from "./pages/AukenIntegrations";
import AukenLogin           from "./pages/AukenLogin";
import AukenAdmin           from "./pages/AukenAdmin";

// Protected Route Component
function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem("auken_auth") === "true";
  const isSuspended = localStorage.getItem("auken_suspended") === "true";
  if (!isAuthenticated) return <Navigate to="/login" />;
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<AukenOS />} />
        <Route path="/landing"           element={<AukenLanding />} />
        <Route path="/dashboard"         element={<AukenDashboard />} />
        <Route path="/widget"            element={<AukenWidget />} />
        <Route path="/propuesta"         element={<AukenPropuesta />} />
        <Route path="/login"             element={<AukenLogin />} />
        
        {/* Protected Routes for the Optic */}
        <Route path="/optica"            element={<ProtectedRoute><AukenOptica /></ProtectedRoute>} />
        <Route path="/optica/landing"    element={<AukenOpticaLanding />} />
        <Route path="/optica/dashboard"  element={<ProtectedRoute><AukenOpticaDashboard /></ProtectedRoute>} />
        
        <Route path="/integrations"      element={<AukenIntegrations />} />
        <Route path="/admin"             element={<AukenAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}
