export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, name, date, type = 'welcome' } = req.body;

  // Limpiar el teléfono (debe ser formato internacional sin el +)
  const cleanPhone = phone.replace(/\D/g, '');

  // Configuración desde Variables de Entorno (Deep Knowledge)
  const TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_ID = process.env.PHONE_NUMBER_ID;

  if (!TOKEN || !PHONE_ID) {
    return res.status(500).json({ error: 'Faltan credenciales de WhatsApp en el servidor' });
  }

  // Cuerpo del mensaje para Meta API
  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: type === 'welcome' ? "glowvision_bienvenida" : "glowvision_recordatorio",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: date || "Pronto" }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (result.error) {
      console.error('Error Meta API:', result.error);
      return res.status(400).json({ error: result.error.message });
    }

    return res.status(200).json({ success: true, messageId: result.messages[0].id });
  } catch (error) {
    console.error('Error de red:', error);
    return res.status(500).json({ error: 'Error de conexión con Meta API' });
  }
}
