// =============================================================
// AUKÉN — System prompts para Claude (multi-óptica)
// =============================================================
// La config viene de la tabla `opticas` en Supabase. Si por algún
// motivo no se puede cargar, hay un fallback con datos de Glow Vision.
// =============================================================

/**
 * Configuración de fallback (Glow Vision).
 * En producción la real viene de la tabla `opticas` por slug.
 */
export const OPTICA_FALLBACK = {
  nombre: "Óptica Glow Vision",
  slogan: "calidad que inspira",
  direccion: "Caupolicán #763, Punitaqui",
  horario: "Lunes a Viernes 11:30 a 18:30",
  telefono: "+56 9 5493 2802",
  numero_escalada: "+56954932802",
  bot_nombre: "Aukén",
  promocion_estrella: "Examen visual GRATIS al comprar tus lentes",
  servicios: [
    { nombre: "Examen visual computarizado", precio: "GRATIS al comprar lentes" },
    { nombre: "Lentes monofocales", precio: "desde $45.000" },
    { nombre: "Lentes multifocales progresivos", precio: "desde $180.000" },
    { nombre: "Lentes de contacto blandos", precio: "desde $25.000 el par" },
  ],
  escalar_si: [
    "ojo rojo doloroso",
    "pérdida súbita de visión",
    "trauma ocular",
    "destellos o moscas volantes nuevas",
    "reclamo formal",
  ],
};

/**
 * Carga config de una óptica desde Supabase.
 * Si falla, retorna el fallback sin lanzar error (resiliencia).
 *
 * @param {object} supabase - Cliente de Supabase
 * @param {string} slug     - 'glowvision', 'optica-lux', etc. Default: 'glowvision'
 */
export async function loadOpticaConfig(supabase, slug = "glowvision") {
  try {
    const { data, error } = await supabase
      .from("opticas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      console.warn(`[prompts] No se cargó config de '${slug}', usando fallback`);
      return OPTICA_FALLBACK;
    }

    // Normalizar formato (servicios y escalar_si pueden venir como string o array)
    return {
      ...OPTICA_FALLBACK,  // base por si falta algún campo
      ...data,
      servicios: Array.isArray(data.servicios) ? data.servicios : OPTICA_FALLBACK.servicios,
      escalar_si: Array.isArray(data.escalar_si) ? data.escalar_si : OPTICA_FALLBACK.escalar_si,
    };
  } catch (err) {
    console.error("[prompts] Error cargando config:", err.message);
    return OPTICA_FALLBACK;
  }
}

/**
 * Construye el system prompt según contexto del paciente y la óptica.
 *
 * @param {object|null} paciente   - Ficha del paciente si existe en BD
 * @param {string}      canal      - 'whatsapp' | 'web' | 'voz'
 * @param {string|null} summary    - Resumen de conversaciones anteriores
 * @param {object|null} opticaCfg  - Config de la óptica (o fallback si null)
 */
export function buildSystemPrompt(paciente, canal = "whatsapp", summary = null, opticaCfg = null) {
  const o = opticaCfg || OPTICA_FALLBACK;
  const esRegistrado = !!paciente;
  const recetaVencida = paciente?.estado_receta === "vencida";
  const proximoControl = paciente?.estado_receta === "proxima";

  const fichaSection = esRegistrado
    ? `
=== FICHA DEL PACIENTE (úsala para personalizar) ===
- Nombre: ${paciente.nombre}
- RUT: ${paciente.rut || "no registrado"}
- Edad: ${paciente.edad || "—"}
- Última visita: ${paciente.fecha_ultima_visita || "no registrada"}
- Próximo control: ${paciente.fecha_proximo_control || "no programado"}
- Producto actual: ${paciente.producto_actual || "—"}
- Estado de receta: ${recetaVencida ? "VENCIDA" : proximoControl ? "PRÓXIMA A VENCER" : "VIGENTE"}
${paciente.notas_clinicas ? `- Notas clínicas: ${paciente.notas_clinicas}` : ""}
${
  paciente.receta_data
    ? `
RECETA ÓPTICA:
- OD: esfera ${paciente.receta_data.OD?.esfera || "—"} | cilindro ${paciente.receta_data.OD?.cilindro || "—"} | eje ${paciente.receta_data.OD?.eje || "—"}
- OI: esfera ${paciente.receta_data.OI?.esfera || "—"} | cilindro ${paciente.receta_data.OI?.cilindro || "—"} | eje ${paciente.receta_data.OI?.eje || "—"}`
    : ""
}
====================================================
`
    : "";

  const alertSection = recetaVencida
    ? `
ALERTA: La receta de este paciente está VENCIDA (última visita: ${paciente?.fecha_ultima_visita}).
Menciónaselo con calidez al inicio y sugiere agendar control. Sin insistir si cambia el tema.`
    : proximoControl
    ? `
ALERTA: Próximo control se acerca (${paciente?.fecha_proximo_control}). Menciónalo de forma sutil.`
    : "";

  const summarySection = summary
    ? `
=== CONTEXTO DE CONVERSACIONES ANTERIORES ===
${summary}
==============================================
`
    : "";

  const canalGuidance = {
    whatsapp: "Estás en WhatsApp. Mensajes cortos (máximo 3 oraciones), tono cálido y conversacional, emojis con moderación (máximo 1 por mensaje), sin formato markdown.",
    web: "Estás en el chat web. Puedes ser ligeramente más extenso si la pregunta lo amerita, pero mantén concisión.",
    voz: "Estás en una llamada telefónica. Habla natural y fluido, sin listas ni emojis. Frases cortas y claras.",
  };

  return `Eres "${o.bot_nombre}", el asistente virtual de ${o.nombre}${o.slogan ? ` (slogan: "${o.slogan}")` : ""}.

PERSONALIDAD: Cálido, profesional, conciso. Hablas español chileno natural sin exagerar modismos. Eres bueno en ventas pero nunca insistente.

NEGOCIO:
- Dirección: ${o.direccion}${o.ciudad ? `, ${o.ciudad}` : ""}
- Horario: ${o.horario}
- Teléfono: ${o.telefono}

SERVICIOS Y PRECIOS:
${o.servicios.map(s => `- ${s.nombre}: ${s.precio}`).join("\n")}

${o.promocion_estrella ? `PROMOCIÓN ESTRELLA: ${o.promocion_estrella}` : ""}

CANAL: ${canalGuidance[canal] || canalGuidance.whatsapp}

${fichaSection}
${alertSection}
${summarySection}

REGLAS DE ORO:
1. Si el usuario te da datos personales claros (nombre + RUT) y NO está en la base, pídele confirmación de la comuna y agrega EXACTAMENTE al final: [REGISTER: Nombre | RUT | Comuna]. Esa etiqueta NO se muestra al paciente.
2. Si menciona ${o.escalar_si.slice(0, 3).join(", ")} u otra urgencia médica, agrega [ESCALAR] al final.
3. Para agendar, pide nombre, RUT y dos opciones de horario. Si tienes los 3, agrega [AGENDAR: servicio | fecha | hora].
4. Nunca inventes precios, servicios ni horarios distintos a los listados.
5. Si no sabes algo, no inventes. Di que un asesor humano confirmará pronto.
6. Termina cada respuesta con una pregunta o acción concreta.

NO HAGAS:
- No uses formato markdown.
- No prometas plazos específicos.
- No saludes "buenos días" si ya hubo intercambio.
- No respondas en bullets en WhatsApp.`;
}

/**
 * Detecta y extrae tags secretos de la respuesta de Claude.
 */
export function parseSpecialTags(text) {
  const actions = [];
  let cleanText = text;

  const registerMatch = text.match(/\[REGISTER:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\s*\]/);
  if (registerMatch) {
    actions.push({
      type: "register",
      nombre: registerMatch[1].trim(),
      rut: registerMatch[2].trim(),
      comuna: registerMatch[3].trim(),
    });
    cleanText = cleanText.replace(/\[REGISTER:[^\]]*\]/g, "").trim();
  }

  if (text.includes("[ESCALAR]")) {
    actions.push({ type: "escalate" });
    cleanText = cleanText.replace(/\[ESCALAR\]/g, "").trim();
  }

  const agendarMatch = text.match(/\[AGENDAR:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\s*\]/);
  if (agendarMatch) {
    actions.push({
      type: "book",
      servicio: agendarMatch[1].trim(),
      fecha: agendarMatch[2].trim(),
      hora: agendarMatch[3].trim(),
    });
    cleanText = cleanText.replace(/\[AGENDAR:[^\]]*\]/g, "").trim();
  }

  return { cleanText, actions };
}

/**
 * Calcula el estado de la receta de un paciente
 */
export function getEstadoReceta(fechaUltimaVisita) {
  if (!fechaUltimaVisita) return "sin_datos";
  const dias = Math.floor(
    (Date.now() - new Date(fechaUltimaVisita).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (dias > 365) return "vencida";
  if (dias > 335) return "proxima";
  return "vigente";
}
