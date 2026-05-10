import { useState, useEffect, useRef, useCallback } from "react";

// ── PALETA TERMINAL ──────────────────────────────────────────────
const T = {
  bg:        "#080B0F",
  bgMid:     "#0D1117",
  bgSurf:    "#161B22",
  bgHover:   "#1C2128",
  border:    "#21262D",
  borderMid: "#30363D",
  green:     "#3FB950",
  greenDim:  "#238636",
  greenGhost:"#3FB95015",
  amber:     "#E3B341",
  amberDim:  "#BB8009",
  amberGhost:"#E3B34115",
  red:       "#F85149",
  redGhost:  "#F8514915",
  blue:      "#58A6FF",
  blueGhost: "#58A6FF15",
  purple:    "#BC8CFF",
  ink:       "#E6EDF3",
  inkMid:    "#8B949E",
  inkFaint:  "#484F58",
  whatsapp:  "#25D366",
};

// ── DATOS ────────────────────────────────────────────────────────
const PATIENTS_QUEUE = [
  { id:"q001", name:"María González",  phone:"+56912345678", optica:"Óptica Visión Clara", estado:"vencida",  dias:-274, receta:"14 Ago 2024", status:"pending",  sent:null },
  { id:"q002", name:"Ana Flores",      phone:"+56933221144", optica:"Óptica Visión Clara", estado:"vencida",  dias:-255, receta:"02 Sep 2024", status:"pending",  sent:null },
  { id:"q003", name:"Carlos Méndez",   phone:"+56987654321", optica:"Óptica Lux Centro",  estado:"proxima",  dias:83,   receta:"20 Ene 2025", status:"pending",  sent:null },
  { id:"q004", name:"Pedro Riquelme",  phone:"+56955443322", optica:"Óptica Visión Clara", estado:"proxima",  dias:122,  receta:"28 Feb 2025", status:"pending",  sent:null },
  { id:"q005", name:"Luisa Morales",   phone:"+56966778899", optica:"Óptica Lux Centro",  estado:"vencida",  dias:-180, receta:"03 Nov 2024", status:"sent",     sent:"09:14" },
  { id:"q006", name:"Roberto Soto",    phone:"+56944556677", optica:"Óptica Visión Clara", estado:"vencida",  dias:-310, receta:"28 Jul 2024", status:"replied",  sent:"08:52" },
  { id:"q007", name:"Fernanda Castro", phone:"+56922334455", optica:"Óptica Lux Centro",  estado:"proxima",  dias:45,   receta:"15 Abr 2025", status:"booked",   sent:"08:31" },
  { id:"q008", name:"Jorge Valenzuela",phone:"+56911223344", optica:"Óptica Visión Clara", estado:"vencida",  dias:-198, receta:"17 Oct 2024", status:"failed",   sent:"08:10" },
];

const FLOW_NODES = [
  { id:"n1", type:"trigger",   label:"Receta vencida",       sub:"Disparador automático",     x:40,  y:120, color:T.amber  },
  { id:"n2", type:"wait",      label:"Esperar 1 día",         sub:"Delay antes de envío",      x:220, y:120, color:T.blue   },
  { id:"n3", type:"message",   label:"Enviar WA",             sub:"Mensaje personalizado",     x:400, y:120, color:T.whatsapp },
  { id:"n4", type:"branch",    label:"¿Respondió?",           sub:"Bifurcación de respuesta",  x:580, y:120, color:T.purple },
  { id:"n5", type:"action",    label:"Agendar cita",          sub:"Google Calendar API",       x:720, y:60,  color:T.green  },
  { id:"n6", type:"wait",      label:"Esperar 7 días",        sub:"Sin respuesta",             x:720, y:180, color:T.blue   },
  { id:"n7", type:"message",   label:"2do recordatorio",      sub:"Tono más urgente",          x:880, y:180, color:T.whatsapp },
];

const LOG_ENTRIES = [
  { ts:"10:41:02", level:"info",    msg:"Webhook n8n recibido · paciente q001 · disparo de flujo RECETA_VENCIDA" },
  { ts:"10:41:03", level:"success", msg:"WhatsApp API → +56912345678 · template:receta_vencida · messageId:wamid.HB..." },
  { ts:"10:38:17", level:"success", msg:"Respuesta recibida de +56944556677 · intent:AGENDAR · derivado a calendario" },
  { ts:"10:38:18", level:"info",    msg:"Google Calendar API → cita creada · Óptica Visión Clara · 2025-06-12 10:30" },
  { ts:"10:35:44", level:"warn",    msg:"Reintento 2/3 · +56911223344 · error 131026: número no registrado en WA Business" },
  { ts:"10:31:02", level:"error",   msg:"Fallo definitivo · +56911223344 · marcado como failed en cola" },
  { ts:"10:28:55", level:"success", msg:"Flujo PROXIMA_CONTROL completado · Fernanda Castro · cita agendada exitosamente" },
  { ts:"10:15:00", level:"info",    msg:"Cron job ejecutado · escaneando 187 fichas · 23 vencidas · 14 próximas" },
];

// ── HELPERS ──────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:  { label:"Pendiente", color:T.inkMid,  bg:T.bgSurf,    icon:"○" },
  sent:     { label:"Enviado",   color:T.blue,    bg:T.blueGhost, icon:"✓" },
  replied:  { label:"Respondió", color:T.amber,   bg:T.amberGhost,icon:"◉" },
  booked:   { label:"Agendó",    color:T.green,   bg:T.greenGhost,icon:"★" },
  failed:   { label:"Falló",     color:T.red,     bg:T.redGhost,  icon:"✕" },
};

const LOG_CFG = {
  info:    { color:T.blue,   prefix:"INFO " },
  success: { color:T.green,  prefix:"OK   " },
  warn:    { color:T.amber,  prefix:"WARN " },
  error:   { color:T.red,    prefix:"ERR  " },
};

const NODE_ICONS = {
  trigger: "⚡", wait: "⏳", message: "💬", branch: "⑃", action: "⚙",
};

function useInterval(fn, ms) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ── COMPONENTES BASE ─────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return (
    <span style={{ background: bg, color, border:`1px solid ${color}30`, borderRadius:3, padding:"2px 7px", fontSize:10, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.04em" }}>
      {label}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:9, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>
      {children}
    </div>
  );
}

function Card({ children, style={} }) {
  return (
    <div style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:8, ...style }}>
      {children}
    </div>
  );
}

// ── LIVE COUNTER ─────────────────────────────────────────────────
function LiveCounter({ value, color, label, sub }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let current = 0;
    const step = Math.ceil(value / 30);
    const id = setInterval(() => {
      current = Math.min(current + step, value);
      setDisplay(current);
      if (current >= value) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [value]);
  return (
    <Card style={{ padding:"18px 20px" }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, fontSize:32, color, lineHeight:1 }}>
        {display.toLocaleString("es-CL")}
      </div>
      <div style={{ fontSize:10, color:T.inkMid, marginTop:5 }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:T.inkFaint, marginTop:2 }}>{sub}</div>}
    </Card>
  );
}

// ── FLOW BUILDER (visual, no-drag) ───────────────────────────────
function FlowBuilder({ activeNode, setActiveNode }) {
  const CONN = [
    { from:"n1", to:"n2" }, { from:"n2", to:"n3" }, { from:"n3", to:"n4" },
    { from:"n4", to:"n5", label:"Sí" }, { from:"n4", to:"n6", label:"No" },
    { from:"n6", to:"n7" },
  ];
  const W = 960, H = 260;
  const nodeMap = Object.fromEntries(FLOW_NODES.map(n => [n.id, n]));

  return (
    <Card style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <SectionLabel>Constructor de flujo · RECETA_VENCIDA</SectionLabel>
          <div style={{ fontSize:12, color:T.ink }}>Flujo activo · 3 ópticas · 23 pacientes en cola</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {["Guardar flujo","Activar","Clonar"].map((lbl,i) => (
            <button key={lbl} style={{ background: i===1 ? T.greenDim : T.bgHover, color: i===1 ? "#fff" : T.inkMid, border:`1px solid ${i===1 ? T.green : T.border}`, borderRadius:5, padding:"6px 12px", fontSize:10, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position:"relative", overflowX:"auto", background:T.bg }}>
        <svg width={W} height={H} style={{ display:"block" }}>
          {/* Grid */}
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke={T.border} strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />

          {/* Connections */}
          {CONN.map(({ from, to, label }) => {
            const a = nodeMap[from], b = nodeMap[to];
            if (!a || !b) return null;
            const x1 = a.x + 70, y1 = a.y + 22, x2 = b.x, y2 = b.y + 22;
            const mx = (x1 + x2) / 2;
            return (
              <g key={`${from}-${to}`}>
                <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none" stroke={T.borderMid} strokeWidth="1.5" strokeDasharray="4 3" />
                {label && (
                  <text x={mx} y={(y1+y2)/2-5} fill={T.inkFaint} fontSize="9" fontFamily="'IBM Plex Mono',monospace" textAnchor="middle">{label}</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes — positioned absolutely over SVG */}
        <div style={{ position:"absolute", top:0, left:0, width:W, height:H, pointerEvents:"none" }}>
          {FLOW_NODES.map(node => (
            <div key={node.id} onClick={() => setActiveNode(activeNode?.id === node.id ? null : node)}
              style={{
                position:"absolute", left:node.x, top:node.y,
                width:70, height:44, background:T.bgSurf,
                border:`1.5px solid ${activeNode?.id === node.id ? node.color : T.border}`,
                borderRadius:8, cursor:"pointer", pointerEvents:"auto",
                boxShadow: activeNode?.id === node.id ? `0 0 12px ${node.color}40` : "none",
                transition:"all .2s", display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", gap:2,
              }}>
              <span style={{ fontSize:16 }}>{NODE_ICONS[node.type]}</span>
              <div style={{ fontSize:8, color:activeNode?.id === node.id ? node.color : T.inkFaint, fontFamily:"'IBM Plex Mono',monospace", textAlign:"center", lineHeight:1.2, padding:"0 4px" }}>
                {node.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Node config panel */}
      {activeNode && (
        <div style={{ padding:"14px 18px", borderTop:`1px solid ${T.border}`, background:T.bgMid, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div>
            <SectionLabel>Tipo de nodo</SectionLabel>
            <div style={{ color:activeNode.color, fontSize:13, fontFamily:"'IBM Plex Mono',monospace" }}>
              {NODE_ICONS[activeNode.type]} {activeNode.type.toUpperCase()}
            </div>
            <div style={{ fontSize:11, color:T.inkMid, marginTop:2 }}>{activeNode.sub}</div>
          </div>
          {activeNode.type === "message" && (
            <div>
              <SectionLabel>Template WhatsApp</SectionLabel>
              <select style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:4, padding:"6px 8px", color:T.ink, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", width:"100%" }}>
                <option>receta_vencida_v2</option>
                <option>proxima_control_30d</option>
                <option>seguimiento_sin_respuesta</option>
              </select>
            </div>
          )}
          {activeNode.type === "wait" && (
            <div>
              <SectionLabel>Duración</SectionLabel>
              <div style={{ display:"flex", gap:6 }}>
                <input defaultValue="1" type="number" style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:4, padding:"6px 8px", color:T.ink, fontSize:11, width:60, fontFamily:"'IBM Plex Mono',monospace" }} />
                <select style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:4, padding:"6px 8px", color:T.ink, fontSize:11, fontFamily:"'IBM Plex Mono',monospace" }}>
                  <option>días</option><option>horas</option><option>minutos</option>
                </select>
              </div>
            </div>
          )}
          {activeNode.type === "branch" && (
            <div>
              <SectionLabel>Condición</SectionLabel>
              <select style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:4, padding:"6px 8px", color:T.ink, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", width:"100%" }}>
                <option>respondió al mensaje</option>
                <option>agendó cita</option>
                <option>mencionó urgencia</option>
              </select>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"flex-end", gap:6 }}>
            <button style={{ background:activeNode.color+"20", border:`1px solid ${activeNode.color}50`, color:activeNode.color, borderRadius:4, padding:"6px 12px", fontSize:10, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
              Guardar nodo
            </button>
            <button onClick={() => setActiveNode(null)} style={{ background:"none", border:`1px solid ${T.border}`, color:T.inkMid, borderRadius:4, padding:"6px 10px", fontSize:10, cursor:"pointer" }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── COLA DE MENSAJES ─────────────────────────────────────────────
function MessageQueue() {
  const [queue, setQueue] = useState(PATIENTS_QUEUE);
  const [sending, setSending] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);

  const simulateSend = useCallback((id) => {
    setSending(id);
    setTimeout(() => {
      setQueue(q => q.map(p => p.id === id
        ? { ...p, status: Math.random() > 0.15 ? "sent" : "failed", sent: new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }) }
        : p
      ));
      setSending(null);
    }, 1200 + Math.random() * 800);
  }, []);

  const simulateBulk = useCallback(() => {
    const targets = selected.length > 0
      ? queue.filter(p => selected.includes(p.id) && p.status === "pending")
      : queue.filter(p => p.status === "pending");
    targets.forEach((p, i) => setTimeout(() => simulateSend(p.id), i * 600));
    setSelected([]);
  }, [queue, selected, simulateSend]);

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const filtered = queue.filter(p => filter === "all" || p.status === filter);
  const counts = Object.fromEntries(["pending","sent","replied","booked","failed"].map(s => [s, queue.filter(p => p.status === s).length]));

  const previewMsg = (p) => `Hola *${p.name.split(" ")[0]}* 👋\n\nTe escribimos de *${p.optica}*.\n\nNotamos que tu última revisión fue en *${p.receta}* y ${p.estado === "vencida" ? "tu receta está vencida" : "tu próximo control se acerca"}. Es un buen momento para agendar.\n\n¿Tienes disponibilidad esta semana? Tenemos horas de *Lunes a Viernes 9:30–19:30*. 🗓️`;

  return (
    <Card>
      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <SectionLabel>Cola de mensajes WhatsApp</SectionLabel>
          <div style={{ fontSize:12, color:T.ink }}>{queue.filter(p=>p.status==="pending").length} mensajes pendientes</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {selected.length > 0 && (
            <div style={{ fontSize:10, color:T.amber, fontFamily:"'IBM Plex Mono',monospace" }}>
              {selected.length} seleccionados
            </div>
          )}
          <button onClick={simulateBulk} style={{ background:T.whatsapp, color:"#fff", border:"none", borderRadius:5, padding:"7px 14px", fontSize:11, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontWeight:600 }}>
            {selected.length > 0 ? `Enviar ${selected.length} →` : "Enviar todos →"}
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div style={{ padding:"8px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:6 }}>
        {[["all","Todos",queue.length], ...Object.entries(counts).map(([k,v])=>[k, STATUS_CFG[k]?.label, v])].map(([val,lbl,cnt]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            background: filter===val ? T.bgHover : "none",
            border:`1px solid ${filter===val ? T.borderMid : "transparent"}`,
            borderRadius:4, padding:"4px 10px", fontSize:10, cursor:"pointer",
            color: filter===val ? T.ink : T.inkFaint, fontFamily:"'IBM Plex Mono',monospace",
            transition:"all .15s",
          }}>
            {lbl} <span style={{ color:T.inkFaint }}>({cnt})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:T.bgMid }}>
              <th style={{ width:32, padding:"8px 12px" }}>
                <input type="checkbox" onChange={e => setSelected(e.target.checked ? filtered.filter(p=>p.status==="pending").map(p=>p.id) : [])} style={{ accentColor:T.green }} />
              </th>
              {["Paciente","Teléfono","Óptica","Estado receta","Cola","Acción"].map(h => (
                <th key={h} style={{ padding:"8px 12px", fontSize:9, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace", textAlign:"left", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const s = STATUS_CFG[p.status];
              const isSending = sending === p.id;
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}`, background: selected.includes(p.id) ? T.greenGhost : i%2===0 ? T.bgSurf : T.bg, transition:"background .15s" }}>
                  <td style={{ padding:"9px 12px" }}>
                    {p.status === "pending" && (
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor:T.green }} />
                    )}
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ fontSize:12, color:T.ink, fontFamily:"'IBM Plex Mono',monospace" }}>{p.name}</div>
                  </td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace" }}>{p.phone}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:T.inkMid, fontFamily:"'IBM Plex Mono',monospace" }}>{p.optica.replace("Óptica ","")}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ color: p.estado==="vencida" ? T.red : T.amber, fontSize:10 }}>
                        {p.estado==="vencida" ? "⚠" : "⏰"}
                      </span>
                      <span style={{ fontSize:10, color: p.estado==="vencida" ? T.red : T.amber, fontFamily:"'IBM Plex Mono',monospace" }}>
                        {p.dias < 0 ? `${Math.abs(p.dias)}d vencida` : `${p.dias}d restantes`}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    {isSending ? (
                      <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                        {[0,1,2].map(i => <div key={i} style={{ width:4,height:4,borderRadius:"50%",background:T.whatsapp,animation:"dot 1.2s infinite",animationDelay:`${i*.2}s` }} />)}
                        <span style={{ fontSize:9, color:T.whatsapp, fontFamily:"'IBM Plex Mono',monospace", marginLeft:4 }}>enviando...</span>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <Pill label={`${s.icon} ${s.label}`} color={s.color} bg={s.bg} />
                        {p.sent && <span style={{ fontSize:9, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace" }}>{p.sent}</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => setPreview(preview?.id===p.id ? null : p)} style={{ background:T.bgHover, border:`1px solid ${T.border}`, color:T.inkMid, borderRadius:4, padding:"3px 8px", fontSize:9, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
                        ver
                      </button>
                      {p.status === "pending" && (
                        <button onClick={() => simulateSend(p.id)} disabled={isSending} style={{ background:T.whatsapp+"20", border:`1px solid ${T.whatsapp}50`, color:T.whatsapp, borderRadius:4, padding:"3px 8px", fontSize:9, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
                          {isSending ? "..." : "→ WA"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview panel */}
      {preview && (
        <div style={{ padding:"14px 18px", borderTop:`1px solid ${T.border}`, background:T.bgMid, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>
          <div>
            <SectionLabel>Preview · {preview.name}</SectionLabel>
            <div style={{ background:"#E8F5E9", borderRadius:8, padding:14, fontFamily:"'DM Sans',sans-serif" }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ background:T.whatsapp, color:"#fff", borderRadius:"50%", width:18, height:18, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>👁️</span>
                <strong>{preview.optica}</strong>
              </div>
              <div style={{ background:"#fff", borderRadius:"8px 8px 8px 0", padding:"9px 11px", fontSize:12, color:"#1a1a1a", lineHeight:1.65, boxShadow:"0 1px 2px rgba(0,0,0,.1)", whiteSpace:"pre-line" }}>
                {previewMsg(preview)}
              </div>
              <div style={{ display:"flex", gap:5, marginTop:7, flexWrap:"wrap" }}>
                {["Sí, quiero hora","Ver horarios","Más tarde"].map(b => (
                  <div key={b} style={{ background:"#fff", border:`1px solid ${T.whatsapp}`, color:T.whatsapp, borderRadius:12, padding:"3px 8px", fontSize:9, cursor:"pointer" }}>{b}</div>
                ))}
              </div>
              <div style={{ fontSize:8, color:"#999", textAlign:"right", marginTop:5 }}>✓✓ Enviado</div>
            </div>
          </div>
          <div>
            <SectionLabel>Datos del paciente</SectionLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                ["Nombre",   preview.name],
                ["Teléfono", preview.phone],
                ["Óptica",   preview.optica],
                ["Receta",   preview.receta],
                ["Estado",   preview.estado === "vencida" ? `Vencida hace ${Math.abs(preview.dias)} días` : `Control en ${preview.dias} días`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:10, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace" }}>{k}</span>
                  <span style={{ fontSize:10, color:T.ink, fontFamily:"'IBM Plex Mono',monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── LIVE LOG ─────────────────────────────────────────────────────
function LiveLog() {
  const [logs, setLogs] = useState(LOG_ENTRIES);
  const [paused, setPaused] = useState(false);
  const ref = useRef(null);

  const NEW_LOGS = [
    { level:"info",    msg:"Cron check · escaneando fichas activas..." },
    { level:"success", msg:"n8n webhook recibido · flujo PROXIMA_CONTROL activado" },
    { level:"info",    msg:"WhatsApp template verificado · receta_vencida_v2 · aprobado" },
    { level:"warn",    msg:"Rate limit approaching · 45/50 mensajes/hora · throttling activado" },
    { level:"success", msg:"Respuesta WA recibida · intención: AGENDAR · procesando..." },
  ];

  useInterval(() => {
    if (paused) return;
    const entry = NEW_LOGS[Math.floor(Math.random() * NEW_LOGS.length)];
    const ts = new Date().toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    setLogs(l => [{ ts, ...entry }, ...l].slice(0, 60));
  }, 3000);

  useEffect(() => {
    if (!paused && ref.current) ref.current.scrollTop = 0;
  }, [logs, paused]);

  return (
    <Card>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:6, height:6, background:paused ? T.amber : T.green, borderRadius:"50%", boxShadow: paused ? "none" : `0 0 6px ${T.green}` }} />
          <SectionLabel>Log del sistema · tiempo real</SectionLabel>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setPaused(p => !p)} style={{ background:T.bgHover, border:`1px solid ${T.border}`, color:T.inkMid, borderRadius:4, padding:"3px 9px", fontSize:9, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
            {paused ? "▶ Reanudar" : "⏸ Pausar"}
          </button>
          <button onClick={() => setLogs([])} style={{ background:T.bgHover, border:`1px solid ${T.border}`, color:T.inkMid, borderRadius:4, padding:"3px 9px", fontSize:9, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
            Limpiar
          </button>
        </div>
      </div>
      <div ref={ref} style={{ height:180, overflowY:"auto", padding:"8px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11 }}>
        {logs.map((log, i) => {
          const cfg = LOG_CFG[log.level];
          return (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:3, animation: i===0 ? "fadeIn .3s ease" : "none" }}>
              <span style={{ color:T.inkFaint, flexShrink:0 }}>{log.ts}</span>
              <span style={{ color:cfg.color, flexShrink:0 }}>{cfg.prefix}</span>
              <span style={{ color: log.level==="error" ? T.red : log.level==="warn" ? T.amber : T.inkMid }}>{log.msg}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── CONFIG PANEL ─────────────────────────────────────────────────
function ConfigPanel({ onClose }) {
  const [saved, setSaved] = useState(false);
  const [creds, setCreds] = useState({
    waToken:     "EAABs...(tu token aquí)",
    waPhoneId:   "123456789012345",
    n8nWebhook:  "https://tu-n8n.railway.app/webhook/auken-optica",
    n8nApiKey:   "eyJhbGc...",
    calendarId:  "clinica@gmail.com",
  });

  const FIELDS = [
    { key:"waToken",    label:"WhatsApp Business API Token",     ph:"EAABs...",    doc:"Meta for Developers → WhatsApp → API Setup" },
    { key:"waPhoneId",  label:"Phone Number ID",                  ph:"123456789",   doc:"Meta Dashboard → Phone Numbers" },
    { key:"n8nWebhook", label:"n8n Webhook URL",                  ph:"https://...", doc:"n8n → Workflow → Webhook node → URL" },
    { key:"n8nApiKey",  label:"n8n API Key",                      ph:"eyJhbGc...",  doc:"n8n → Settings → API → Create API Key" },
    { key:"calendarId", label:"Google Calendar ID (agendamiento)",ph:"email@...",   doc:"Google Calendar → Settings → Calendar ID" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", backdropFilter:"blur(6px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.bgMid, border:`1px solid ${T.borderMid}`, borderRadius:12, width:"100%", maxWidth:560, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, color:T.ink, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500 }}>Configurar integraciones</div>
            <div style={{ fontSize:10, color:T.inkFaint, marginTop:2 }}>Credenciales almacenadas de forma segura</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${T.border}`, color:T.inkFaint, width:26, height:26, borderRadius:5, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:14 }}>
          {/* Status indicators */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[
              { label:"WhatsApp API", status:"connected", color:T.green },
              { label:"n8n",          status:"connected", color:T.green },
              { label:"Google Cal",   status:"pending",   color:T.amber },
            ].map(({ label, status, color }) => (
              <div key={label} style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:color, boxShadow: status==="connected" ? `0 0 5px ${color}` : "none" }} />
                  <span style={{ fontSize:9, color, fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>{status}</span>
                </div>
                <div style={{ fontSize:11, color:T.ink, fontFamily:"'IBM Plex Mono',monospace" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Fields */}
          {FIELDS.map(({ key, label, ph, doc }) => (
            <div key={key}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                <label style={{ fontSize:10, color:T.inkMid, fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</label>
                <span style={{ fontSize:9, color:T.inkFaint, fontFamily:"'IBM Plex Mono',monospace" }}>{doc}</span>
              </div>
              <input value={creds[key]} onChange={e => setCreds(p => ({ ...p, [key]: e.target.value }))}
                placeholder={ph}
                style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px", color:T.green, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", outline:"none" }}
                onFocus={e => e.target.style.borderColor = T.green}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>
          ))}

          {/* n8n workflow snippet */}
          <div>
            <SectionLabel>Snippet n8n — nodo HTTP Request para envío WA</SectionLabel>
            <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:5, padding:"10px 12px", fontSize:10, color:T.green, fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.7, overflowX:"auto" }}>
              <span style={{ color:T.inkFaint }}>POST </span>https://graph.facebook.com/v18.0/<span style={{ color:T.amber }}>{"{"}phoneNumberId{"}"}</span>/messages<br/>
              <span style={{ color:T.inkFaint }}>Authorization:</span> Bearer <span style={{ color:T.amber }}>{"{"}waToken{"}"}</span><br/>
              <span style={{ color:T.inkFaint }}>Body: </span>{"{"}<br/>
              {"  "}<span style={{ color:T.blue }}>"messaging_product"</span>: <span style={{ color:T.purple }}>"whatsapp"</span>,<br/>
              {"  "}<span style={{ color:T.blue }}>"to"</span>: <span style={{ color:T.amber }}>{"{"}patient.phone{"}"}</span>,<br/>
              {"  "}<span style={{ color:T.blue }}>"type"</span>: <span style={{ color:T.purple }}>"template"</span>,<br/>
              {"  "}<span style={{ color:T.blue }}>"template"</span>: {"{"}<span style={{ color:T.blue }}>"name"</span>: <span style={{ color:T.purple }}>"receta_vencida_v2"</span>{"}"}<br/>
              {"}"}
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1500); }}
              style={{ flex:1, background:saved ? T.greenDim : T.bgHover, color:saved ? "#fff" : T.ink, border:`1px solid ${saved ? T.green : T.borderMid}`, borderRadius:5, padding:10, fontSize:11, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, transition:"all .3s" }}>
              {saved ? "✓ Guardado" : "Guardar configuración"}
            </button>
            <button style={{ background:"none", border:`1px solid ${T.border}`, color:T.amber, borderRadius:5, padding:"10px 14px", fontSize:11, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace" }}>
              Probar conexión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────
export default function AukenIntegrations() {
  const [tab, setTab] = useState("queue");
  const [showConfig, setShowConfig] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [tick, setTick] = useState(0);

  useInterval(() => setTick(t => t + 1), 1000);

  const uptime = `${String(Math.floor(tick/3600)).padStart(2,"0")}:${String(Math.floor((tick%3600)/60)).padStart(2,"0")}:${String(tick%60).padStart(2,"0")}`;

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.ink, fontFamily:"'IBM Plex Mono',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:3px; background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.borderMid}; border-radius:3px; }
        @keyframes dot { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>

      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}

      {/* TOPBAR */}
      <nav style={{ background:T.bgMid, borderBottom:`1px solid ${T.border}`, padding:"0 22px", height:50, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, background:T.green, borderRadius:"50%", boxShadow:`0 0 6px ${T.green}`, animation:"pulse 2s infinite" }} />
            <span style={{ fontWeight:500, fontSize:14, letterSpacing:"0.04em" }}>AUKÉN</span>
            <span style={{ color:T.border }}>·</span>
            <span style={{ color:T.inkFaint, fontSize:11 }}>integrations</span>
          </div>
          {/* Tabs */}
          <div style={{ display:"flex", gap:2, background:T.bg, borderRadius:5, padding:2, border:`1px solid ${T.border}` }}>
            {[["queue","Cola WA"],["flow","Flujos n8n"],["docs","Setup"]].map(([val,lbl]) => (
              <button key={val} onClick={() => setTab(val)} style={{ background:tab===val ? T.bgSurf : "none", color:tab===val ? T.ink : T.inkFaint, border:tab===val ? `1px solid ${T.borderMid}` : "1px solid transparent", borderRadius:4, padding:"4px 12px", fontSize:10, cursor:"pointer", transition:"all .15s" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Live stats */}
          {[
            { label:"uptime", value:uptime, color:T.green },
            { label:"enviados hoy", value:"31", color:T.blue },
            { label:"en cola", value:"4", color:T.amber },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background:T.bgSurf, border:`1px solid ${T.border}`, borderRadius:4, padding:"4px 10px", textAlign:"center" }}>
              <div style={{ fontSize:12, color, fontWeight:500 }}>{value}</div>
              <div style={{ fontSize:8, color:T.inkFaint }}>{label}</div>
            </div>
          ))}
          <button onClick={() => setShowConfig(true)} style={{ background:T.bgSurf, border:`1px solid ${T.borderMid}`, color:T.ink, borderRadius:5, padding:"6px 12px", fontSize:10, cursor:"pointer" }}>
            ⚙ Configurar
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
          <LiveCounter value={31}  color={T.green}  label="Enviados hoy"       sub="desde las 08:00" />
          <LiveCounter value={18}  color={T.amber}  label="Respuestas recibidas" sub="58% tasa apertura" />
          <LiveCounter value={7}   color={T.green}  label="Citas agendadas"    sub="vía WhatsApp" />
          <LiveCounter value={1}   color={T.red}    label="Fallos"             sub="número no registrado" />
          <LiveCounter value={4}   color={T.blue}   label="En cola"            sub="próximos 30 min" />
        </div>

        {/* Tab content */}
        {tab === "queue" && <MessageQueue />}

        {tab === "flow" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <FlowBuilder activeNode={activeNode} setActiveNode={setActiveNode} />
            <LiveLog />
          </div>
        )}

        {tab === "docs" && (
          <Card style={{ padding:24 }}>
            <SectionLabel>Guía de setup · Aukén × n8n × WhatsApp Business API</SectionLabel>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
              {[
                {
                  title:"1. WhatsApp Business API",
                  color:T.whatsapp,
                  steps:[
                    "Crear cuenta en Meta for Developers",
                    "Crear App → tipo: Business",
                    "Agregar producto: WhatsApp",
                    "Copiar Phone Number ID y Token",
                    "Crear y enviar templates para aprobación",
                    "Aprobar template receta_vencida_v2",
                  ],
                  link:"developers.facebook.com/docs/whatsapp",
                },
                {
                  title:"2. n8n (automatización)",
                  color:T.orange||"#FF6D00",
                  steps:[
                    "Deploy n8n en Railway o Render (gratis)",
                    "Crear workflow: Webhook → HTTP Request",
                    "Configurar nodo HTTP con credenciales WA",
                    "Agregar nodo Google Calendar para citas",
                    "Activar workflow y copiar webhook URL",
                    "Pegar URL en panel Aukén → Configurar",
                  ],
                  link:"docs.n8n.io",
                },
                {
                  title:"3. Google Calendar API",
                  color:T.blue,
                  steps:[
                    "Google Cloud Console → APIs & Services",
                    "Habilitar Google Calendar API",
                    "Crear Service Account → descargar JSON",
                    "Compartir calendario con email del service account",
                    "Copiar Calendar ID desde configuración",
                    "Pegar en panel Aukén → Configurar",
                  ],
                  link:"developers.google.com/calendar",
                },
                {
                  title:"4. Costos estimados",
                  color:T.amber,
                  steps:[
                    "WhatsApp API: USD $0.012/mensaje Chile",
                    "100 mensajes/mes = ~$1.200 CLP",
                    "n8n self-hosted: $0 (Railway ~$5 USD/mes)",
                    "Google Calendar API: gratuito",
                    "Claude API: ~$0.003/consulta (Sonnet)",
                    "Total stack: < $15.000 CLP/mes por óptica",
                  ],
                  link:null,
                },
              ].map(({ title, color, steps, link }) => (
                <div key={title} style={{ background:T.bgMid, border:`1px solid ${T.border}`, borderRadius:7, padding:18 }}>
                  <div style={{ color, fontSize:13, fontWeight:500, marginBottom:12 }}>{title}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {steps.map((s, i) => (
                      <div key={i} style={{ display:"flex", gap:8, fontSize:11, color:T.inkMid }}>
                        <span style={{ color:T.inkFaint, flexShrink:0 }}>{String(i+1).padStart(2,"0")}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  {link && (
                    <div style={{ marginTop:12, fontSize:9, color:T.inkFaint }}>
                      docs → <span style={{ color:color }}>{link}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
