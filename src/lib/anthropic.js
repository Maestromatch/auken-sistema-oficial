// =============================================================
// AUKÉN — Cliente Anthropic centralizado
// Maneja: llamadas a Claude, retries, tracking de costos
// =============================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Modelos disponibles. Cambiar aquí afecta todo el sistema.
export const MODELS = {
  // Sonnet 4.6 — el caballo de batalla. Conversaciones, retención, ventas.
  CHAT: "claude-sonnet-4-6",
  // Haiku — para clasificación rápida y barata (lead scoring, intent detection)
  FAST: "claude-haiku-4-5-20251001",
  // Opus — solo para casos complejos (resúmenes ejecutivos, escalada compleja)
  REASONING: "claude-opus-4-7",
};

// Precios por millón de tokens (USD). Verificados en docs.claude.com/pricing
// Sonnet 4.6: $3 input / $15 output
// Haiku 4.5:  $1 input / $5 output
// Opus 4.7:   $5 input / $25 output
const PRICING = {
  "claude-sonnet-4-6":         { in: 3.00, out: 15.00 },
  "claude-haiku-4-5-20251001": { in: 1.00, out: 5.00 },
  "claude-opus-4-7":           { in: 5.00, out: 25.00 },
};

/**
 * Llama a Claude y devuelve { text, usage, costUsd, latencyMs }
 *
 * @param {object} params
 * @param {string} params.system        - System prompt
 * @param {Array}  params.messages      - [{ role, content }]
 * @param {string} [params.model]       - Default: MODELS.CHAT
 * @param {number} [params.maxTokens]   - Default: 1024
 * @param {number} [params.temperature] - Default: 0.7
 * @param {Array}  [params.tools]       - Tool use (function calling)
 */
export async function callClaude({
  system,
  messages,
  model = MODELS.CHAT,
  maxTokens = 1024,
  temperature = 0.7,
  tools,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada en variables de entorno");
  }

  const startedAt = Date.now();

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let response;
  let data;
  let lastError;

  // Retry con backoff exponencial: 1s, 2s, 4s
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      data = await response.json();

      if (response.ok) break;

      // Rate limit o overload: vale la pena reintentar
      if (response.status === 429 || response.status === 529) {
        lastError = new Error(`Anthropic ${response.status}: ${data?.error?.message || "rate limited"}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      // Otros errores: no reintentar
      throw new Error(`Anthropic ${response.status}: ${data?.error?.message || "unknown error"}`);
    } catch (err) {
      lastError = err;
      if (attempt === 2) throw err;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  if (!response?.ok) {
    throw lastError || new Error("Anthropic request failed after retries");
  }

  const latencyMs = Date.now() - startedAt;
  const text = data.content?.map(b => b.text || "").join("") || "";
  const toolUses = data.content?.filter(b => b.type === "tool_use") || [];

  const usage = {
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };

  const costUsd = calculateCost(model, usage);

  return {
    text,
    toolUses,
    usage,
    costUsd,
    latencyMs,
    stopReason: data.stop_reason,
    raw: data,
  };
}

/**
 * Calcula el costo en USD de una llamada
 */
export function calculateCost(model, usage) {
  const pricing = PRICING[model];
  if (!pricing) return null;
  const inCost = (usage.inputTokens / 1_000_000) * pricing.in;
  const outCost = (usage.outputTokens / 1_000_000) * pricing.out;
  return Number((inCost + outCost).toFixed(6));
}

/**
 * Registra una llamada en api_logs (fire-and-forget, no bloquea)
 */
export function logApiCall(supabase, {
  opticaId,
  conversacionId,
  model,
  usage,
  costUsd,
  latencyMs,
  success = true,
  errorMessage = null,
}) {
  // No await: que se grabe en background
  supabase.from("api_logs").insert({
    optica_id: opticaId,
    conversacion_id: conversacionId,
    provider: "anthropic",
    model,
    input_tokens: usage?.inputTokens,
    output_tokens: usage?.outputTokens,
    cost_usd: costUsd,
    latency_ms: latencyMs,
    success,
    error_message: errorMessage,
  }).then(({ error }) => {
    if (error) console.error("Error logging API call:", error.message);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
