import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg:       "#05060A",
  surface:  "rgba(17, 20, 29, 0.4)",
  surfaceL: "rgba(30, 35, 50, 0.6)",
  border:   "rgba(255, 255, 255, 0.06)",
  borderActive: "rgba(251, 146, 60, 0.3)",
  ink:      "#F8FAFC",
  inkMid:   "#94A3B8",
  primary:  "#FB923C", 
  neon:     "#7DD3FC",
  green:    "#10B981",
  glass:    "blur(25px) saturate(180%)",
};

export default function AukenOptica() {
  const [activeP, setActiveP] = useState(null);
  const [patients, setPatients] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: pacs } = await supabase.from("pacientes").select("*").order("created_at", { ascending: false });
    setPatients(pacs || []);
    setLoading(false);
  }, []);

  const loadChat = useCallback(async (pId) => {
    if (!pId) return;
    const { data } = await supabase.from("mensajes_chat").select("*").eq("paciente_id", pId).order("created_at", { ascending: true });
    setMessages(data || []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (activeP) loadChat(activeP.id); }, [activeP, loadChat]);

  useEffect(() => {
    const sub = supabase.channel("chat_live").on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat" }, (p) => {
      if (activeP && p.new.paciente_id === activeP.id) {
        setMessages(prev => [...prev, p.new]);
      }
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeP]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeP) return;
    const msg = { paciente_id: activeP.id, remitente: "admin", contenido: inputText };
    const { error } = await supabase.from("mensajes_chat").insert([msg]);
    if (!error) {
      setInputText("");
      loadChat(activeP.id);
    }
  };

  if (loading) return (
    <div style={{ background: C.bg, color: C.primary, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
       <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 20 }}>AUKÉN OS</div>
       <div style={{ width: 100, height: 2, background: C.border, position: "relative" }}>
          <div style={{ position: "absolute", width: "40%", height: "100%", background: C.primary, animation: "loading 1.5s infinite" }} />
       </div>
       <style>{`@keyframes loading { 0% { left: -40%; } 100% { left: 140%; } }`}</style>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'Inter', sans-serif", display: "flex", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
        .glass { backdrop-filter: ${C.glass}; background: ${C.surface}; border: 1px solid ${C.border}; }
        .active-user { background: ${C.surfaceL}; border-color: ${C.borderActive}; }
      `}</style>

      {/* SIDEBAR ELITE */}
      <aside style={{ width: 380, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>
         <div style={{ padding: "40px 30px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.primary, fontWeight: 800, letterSpacing: "0.2em", marginBottom: 8 }}>TERMINAL DE COMANDO</div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700, margin: 0 }}>Monitor Central</h2>
         </div>
         <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {patients.map(p => (
              <div key={p.id} onClick={() => setActiveP(p)} style={{
                margin: "4px", padding: "20px 24px", borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
                border: "1px solid transparent",
                ...(activeP?.id === p.id ? { background: C.surfaceL, borderColor: C.borderActive, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" } : {})
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                   <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: activeP?.id === p.id ? C.primary : C.ink }}>{p.nombre}</div>
                      <div style={{ fontSize: 11, color: C.inkMid, marginTop: 4 }}>{p.telefono}</div>
                   </div>
                   <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ fontSize: 10, color: C.inkMid }}>
                        {p.ultima_interaccion_at ? new Date(p.ultima_interaccion_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "REC."}
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 10px ${C.green}40` }} />
                   </div>
                </div>
              </div>
            ))}
         </div>
      </aside>

      {/* CHAT ELITE */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "radial-gradient(circle at 70% 30%, #11141D 0%, #05060A 100%)", position: "relative" }}>
         {activeP ? (
           <>
             <header style={{ padding: "25px 40px", borderBottom: `1px solid ${C.border}`, backdropFilter: C.glass, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
                <div>
                   <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>{activeP.nombre}</div>
                   <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: C.neon, fontWeight: 700, letterSpacing: "0.1em" }}>IA INTERCEPTOR ACTIVE</span>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.neon, animation: "blink 1s infinite" }} />
                   </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                   <button onClick={refresh} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.ink, padding: "8px 16px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Sincronizar</button>
                </div>
             </header>

             <div style={{ flex: 1, padding: "40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
                {messages.length === 0 && <div style={{ textAlign: "center", color: C.inkMid, marginTop: 40, fontSize: 13 }}>Historial encriptado. Iniciando sesión de monitoreo...</div>}
                {messages.map(m => (
                  <div key={m.id} style={{ 
                    alignSelf: m.remitente === "cliente" ? "flex-start" : "flex-end", 
                    maxWidth: "65%",
                    animation: "fadeIn 0.3s ease-out"
                  }}>
                    <div style={{
                      background: m.remitente === "cliente" ? C.surface : "linear-gradient(135deg, #FB923C 0%, #F97316 100%)",
                      color: m.remitente === "cliente" ? C.ink : "#000",
                      padding: "16px 22px", 
                      borderRadius: m.remitente === "cliente" ? "2px 20px 20px 20px" : "20px 20px 2px 20px",
                      fontSize: 14, 
                      lineHeight: "1.5",
                      border: m.remitente === "cliente" ? `1px solid ${C.border}` : "none",
                      boxShadow: m.remitente === "cliente" ? "none" : "0 8px 20px rgba(251, 146, 60, 0.2)"
                    }}>{m.contenido}</div>
                    <div style={{ fontSize: 9, color: C.inkMid, marginTop: 6, textAlign: m.remitente === "cliente" ? "left" : "right", textTransform: "uppercase" }}>
                      {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · {m.remitente === "cliente" ? "RECIBIDO" : (m.remitente === "admin" ? "HUMANO" : "IA AUKÉN")}
                    </div>
                  </div>
                ))}
             </div>

             <footer style={{ padding: "30px 40px", borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)" }}>
                <div style={{ display: "flex", gap: 20, background: "#000", padding: "10px", borderRadius: 20, border: `1px solid ${C.border}` }}>
                   <input 
                     value={inputText}
                     onChange={(e) => setInputText(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && handleSend()}
                     placeholder="Escribir comando de respuesta..." 
                     style={{ flex: 1, background: "transparent", border: "none", color: "#fff", padding: "12px 20px", outline: "none", fontSize: 14 }} 
                   />
                   <button onClick={handleSend} style={{ 
                     background: C.primary, color: "#000", padding: "0 30px", borderRadius: 14, fontWeight: 700, cursor: "pointer", border: "none",
                     boxShadow: "0 0 15px rgba(251, 146, 60, 0.4)", transition: "transform 0.1s"
                   }}
                   onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
                   onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                   >ENVIAR</button>
                </div>
             </footer>
           </>
         ) : (
           <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.inkMid }}>
              <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.2 }}>👁️</div>
              <div style={{ fontSize: 12, letterSpacing: "0.4em", fontWeight: 700, opacity: 0.5 }}>AGUARDANDO SELECCIÓN DE CANAL</div>
           </div>
         )}
      </section>
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
