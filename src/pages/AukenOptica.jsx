import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg:       "#05060A",
  surface:  "rgba(17, 20, 29, 0.6)",
  border:   "rgba(255, 255, 255, 0.08)",
  ink:      "#F1F5F9",
  inkMid:   "#94A3B8",
  primary:  "#FB923C", 
  neon:     "#3B82F6",
  amber:    "#F59E0B",
  green:    "#10B981",
  glass:    "blur(20px)",
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
    if (!error) setInputText("");
  };

  if (loading) return <div style={{ background: C.bg, color: C.inkMid, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>AUKÉN ELITE v7.1...</div>;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'Inter', sans-serif", display: "flex", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; borderRadius: 10px; }
      `}</style>

      <aside style={{ width: 350, background: "#000", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
         <div style={{ padding: "30px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>MONITOR EN VIVO</h2>
         </div>
         <div style={{ flex: 1, overflowY: "auto" }}>
            {patients.map(p => (
              <div key={p.id} onClick={() => setActiveP(p)} style={{
                padding: "20px 24px", borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                background: activeP?.id === p.id ? C.surface : "transparent"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                   <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nombre}</div>
                   <div style={{ fontSize: 9, color: C.inkMid }}>
                      {p.ultima_interaccion_at ? new Date(p.ultima_interaccion_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "Nuevo"}
                   </div>
                </div>
                <div style={{ fontSize: 10, color: C.inkMid }}>{p.telefono}</div>
              </div>
            ))}
         </div>
      </aside>

      <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "radial-gradient(circle at top right, #11141D, #05060A)" }}>
         {activeP ? (
           <>
             <header style={{ padding: "20px 40px", borderBottom: `1px solid ${C.border}`, backdropFilter: C.glass, display: "flex", justifyContent: "space-between" }}>
                <div>
                   <div style={{ fontSize: 16, fontWeight: 700 }}>{activeP.nombre}</div>
                   <div style={{ fontSize: 9, color: C.neon, fontWeight: 700 }}>IA ACTIVA</div>
                </div>
             </header>

             <div style={{ flex: 1, padding: "30px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 15 }}>
                {messages.map(m => (
                  <div key={m.id} style={{ alignSelf: m.remitente === "cliente" ? "flex-start" : "flex-end", maxWidth: "70%" }}>
                    <div style={{
                      background: m.remitente === "cliente" ? C.surface : C.primary,
                      color: m.remitente === "cliente" ? C.ink : "#000",
                      padding: "12px 18px", borderRadius: 20, fontSize: 13, border: `1px solid ${C.border}`
                    }}>{m.contenido}</div>
                  </div>
                ))}
             </div>

             <footer style={{ padding: "25px 40px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ display: "flex", gap: 15 }}>
                   <input 
                     value={inputText}
                     onChange={(e) => setInputText(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && handleSend()}
                     placeholder="Escribir respuesta..." 
                     style={{ flex: 1, background: "#000", border: `1px solid ${C.border}`, color: "#fff", padding: "14px", borderRadius: 12 }} 
                   />
                   <button onClick={handleSend} style={{ background: C.primary, color: "#000", padding: "0 20px", borderRadius: 12, fontWeight: 700, cursor: "pointer", border: "none" }}>ENVIAR</button>
                </div>
             </footer>
           </>
         ) : (
           <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaint }}>SELECCIONE CONVERSACIÓN</div>
         )}
      </section>
    </div>
  );
}
