import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AukenOptica from './pages/AukenOptica'
import AukenOpticaDashboard from './pages/AukenOpticaDashboard'
import AukenLogin from './pages/AukenLogin'
import AukenAdmin from './pages/AukenAdmin'

const ProtectedRoute = ({ children }) => {
  const auth = localStorage.getItem("auken_auth");
  return auth === "true" ? children : <Navigate to="/login" />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AukenLogin />} />
        <Route path="/admin" element={<AukenAdmin />} />
        <Route path="/" element={<ProtectedRoute><AukenOptica /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><AukenOpticaDashboard /></ProtectedRoute>} />
        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
