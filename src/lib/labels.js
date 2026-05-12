export const LABELS = {
  citaState: {
    pendiente_confirmacion: { label: "Por confirmar", tone: "warning", icon: "bolt" },
    confirmada: { label: "Confirmada", tone: "success", icon: "check" },
    completada: { label: "Completada", tone: "info", icon: "check" },
    cancelada: { label: "Cancelada", tone: "neutral", icon: "x" },
    no_asistio: { label: "No asistiÃ³", tone: "danger", icon: "warning" },
  },
  citaOrigin: {
    manual: { label: "Manual", tone: "neutral", icon: "edit" },
    "bot-ia": { label: "AukÃ©n IA", tone: "primary", icon: "bot" },
    wsp: { label: "WhatsApp", tone: "success", icon: "phone" },
    whatsapp: { label: "WhatsApp", tone: "success", icon: "phone" },
  },
  compraState: {
    Pendiente: { label: "Pendiente", tone: "warning", icon: "bolt" },
    "ComprÃ³": { label: "Cliente", tone: "success", icon: "check" },
    "No ComprÃ³": { label: "No comprÃ³", tone: "danger", icon: "x" },
  },
  recetaState: {
    sin_datos: { label: "Sin receta", tone: "neutral", icon: "file" },
    vigente: { label: "Vigente", tone: "success", icon: "check" },
    proxima: { label: "PrÃ³x. a vencer", tone: "warning", icon: "bolt" },
    vencida: { label: "Vencida", tone: "danger", icon: "warning" },
  },
};

const DEMO_HINTS = [
  "Placeholder de prueba IA",
  "El bot deberÃ­a pedirle nombre/RUT",
  "Datos completados vÃ­a demo IA",
];

export function labelMeta(kind, value, fallbackTone = "neutral") {
  return LABELS[kind]?.[value] || { label: humanizeEnum(value), tone: fallbackTone, icon: "file" };
}

export function humanizeEnum(value) {
  if (!value) return "Sin dato";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

export function formatRut(value) {
  if (!value || String(value).toLowerCase() === "pendiente") return "RUT pendiente";
  return String(value).toUpperCase();
}

export function formatVisit(value) {
  if (!value) return "AÃºn no visita";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "AÃºn no visita";
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}

export function formatCitaDate(fecha, hora) {
  if (!fecha) return "Fecha por definir";
  const date = new Date(`${fecha}T${hora || "12:00"}:00`);
  if (Number.isNaN(date.getTime())) return `${fecha}${hora ? ` Â· ${hora}` : ""}`;
  const day = date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }).replace(".", "");
  return `${day}${hora ? ` Â· ${hora}` : ""}`;
}

export function formatCLP(value) {
  return "$" + Number(value || 0).toLocaleString("es-CL");
}

export function recetaStateFromLastVisit(value) {
  if (!value) return { state: "sin_datos", days: null };
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(days)) return { state: "sin_datos", days: null };
  if (days > 365) return { state: "vencida", days };
  if (days > 335) return { state: "proxima", days };
  return { state: "vigente", days };
}

export function sanitizeNotas(raw, isDemoMode = false) {
  if (!raw) return null;
  if (!isDemoMode && DEMO_HINTS.some(h => String(raw).includes(h))) return null;
  return raw;
}
