export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen (imageBase64)' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY no configurada' });
    }

    const payload = {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Eres un experto en óptica. Analiza esta imagen de una receta óptica.
Extrae la siguiente información:
- Fecha de emisión de la receta
- Ojo Derecho (OD): Esfera, Cilindro, Eje
- Ojo Izquierdo (OI): Esfera, Cilindro, Eje
- Distancia Pupilar (DP) si está presente
- Adición si está presente

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin explicaciones, sin bloques de código. Solo el JSON puro:
{"fecha": "", "OD": {"esfera": "", "cilindro": "", "eje": ""}, "OI": {"esfera": "", "cilindro": "", "eje": ""}, "adicion": "", "dp": ""}

Si no puedes leer algún campo, déjalo como cadena vacía "".`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 512,
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("Groq API error:", JSON.stringify(data.error));
      throw new Error(data.error.message || "Error en Groq API");
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error("Respuesta vacía de Groq");
    }

    const rawContent = data.choices[0].message.content;
    console.log("Groq raw response:", rawContent);
    
    // Extraer JSON de la respuesta (puede venir con texto extra o bloques de código)
    let jsonString = rawContent;

    // Intentar extraer JSON de bloque de código
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    // Intentar extraer JSON con regex si no es un JSON válido directamente
    if (!jsonString.startsWith('{')) {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    const parsedJson = JSON.parse(jsonString);

    res.status(200).json({ success: true, data: parsedJson });
  } catch (error) {
    console.error("Error en vision OCR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
