import { createClient } from "@supabase/supabase-js";

// Inicializar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    console.log("Vapi Message Received:", JSON.stringify(message, null, 2));

    if (!message) {
      console.warn("Received empty message from Vapi");
      return res.status(200).json({ status: 'Empty message' });
    }
    if (message && message.type === 'call-report') {
      const callId = message.call.id;
      const transcript = message.transcript;
      const recordingUrl = message.recordingUrl;
      const status = message.call.status;
      
      console.log(`Llamada Finalizada [${callId}]: ${status}`);
      
      // Guardar resumen en Supabase (Opcional: puedes crear una tabla 'llamadas_ia')
      await supabase.from('llamadas_ia').insert([{
        call_id: callId,
        transcripcion: transcript,
        grabacion_url: recordingUrl,
        estado: status,
        fecha: new Date().toISOString()
      }]).catch(err => console.warn("Error guardando reporte (posible tabla faltante):", err.message));

      return res.status(200).json({ success: true });
    }

    // 2. Ejecución de Herramientas (Function Calling)
    if (message && (message.type === 'function-call' || message.type === 'tool-calls')) {
      const toolCalls = message.toolCalls || [message.functionCall];
      const results = [];

      for (const toolCall of toolCalls) {
        if (!toolCall) continue;
        
        const name = toolCall.name || toolCall.function?.name;
        const toolCallId = toolCall.toolCallId || toolCall.id;
        let args = toolCall.args || toolCall.function?.arguments;
        
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch(e) { console.error("Error parsing args:", e); }
        }

        if (name === 'agendar_cita' || name === 'agendar_citas') {
          const { nombre, rut, fecha, objetivo } = args;
          console.log(`Intentando agendar para: ${nombre} | RUT: ${rut} | Fecha: ${fecha}`);
          
          if (!nombre || !rut || !fecha) {
            results.push({
              toolCallId: toolCallId,
              result: "Me faltan algunos datos (nombre, rut o fecha) para completar la agenda. ¿Me los podrías repetir?"
            });
            continue;
          }

          const { error: citaError } = await supabase.from('citas').insert([{
            nombre,
            rut,
            fecha_hora: fecha,
            objetivo: objetivo || "Consulta General",
            canal: "Voz (Vapi)"
          }]);

          if (citaError) {
            console.error("Error al agendar cita:", citaError);
            results.push({
              toolCallId: toolCallId,
              result: "Hubo un problema técnico al acceder a la agenda, pero he tomado nota de tus datos y un humano te confirmará pronto."
            });
            continue;
          }

          // Asegurar que el paciente existe o actualizar su ficha
          await supabase.from('pacientes').upsert({
            nombre,
            rut,
            notas_clinicas: `Cita agendada por Voz para el ${fecha}. Objetivo: ${objetivo}`,
            fecha_ultima_visita: new Date().toISOString().split('T')[0]
          }, { onConflict: 'rut' });

          results.push({
            toolCallId: toolCallId,
            result: `¡Perfecto! La cita ha sido agendada exitosamente para el ${fecha}. Te esperamos en Caupolicán #763.`
          });
        }
      }

      if (results.length > 0) {
        return res.status(200).json({ results });
      }
    }

    return res.status(200).json({ status: 'Received' });
  } catch (error) {
    console.error('Error in Voice Webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
