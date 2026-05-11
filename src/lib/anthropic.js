// =============================================================
// AUKÉN — Cliente Anthropic centralizado
// Maneja: llamadas a Claude, retries, tracking de costos
// FASE 0 activa: Prompt Caching para ~75% ahorro en tokens input
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

// Precios por millón de tokens (USD). Verificados en docs.anthropic.com/pricing
// Claude Sonnet 4.6: $3.00 input / $15.00 output
//   Con cache:        $3.75 cache-write / $0.30 cache-read (10% del normal!)
// Claude Haiku 4.5:  $1.00 input / $5.00 output
// Claude Opus 4.7:   $5.00 input / $25.00 output
const PRICING = {
  "claude-sonnet-4-6": {
    in:          3.00,
    out:         15.00,
    cacheWrite:  3.75,   // 125% del input (primera vez, escribe al caché)
    cacheRead:   0.30,   // 10% del input  (llamadas siguientes, lee del caché)
  },
  "claude-haiku-4-5-20251001": {
    in:          1.00,
    out:         5.00,
    cacheWrite:  1.25,
    cacheRead:   0.10,
  },
  "claude-opus-4-7": {
    in:          5.00,
    out:         25.00,
    cacheWrite:  6.25,
    cacheRead:   0.50,
  },
};

/**
 * Llama a Claude con Prompt Caching activo.
 * El system prompt se marca como ephemeral cache → TTL 5 min en Anthropic.
 * Primera llamada: cache-write (125% costo input). Siguientes: cache-read (10%).
 *
 * @param {object} params
 * @param {string} params.system        - System prompt (se cachea automáticamente)
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

  // ── FASE 0: Prompt Caching ────────────────────────────────────────────────
  // El system prompt se pasa como array de content blocks con cache_control.
  // Anthropic cachea el bloque por 5 minutos; todas las llamadas dentro de
  // ese TTL usan cache-read (10% del costo normal de input).
  // Requisito mínimo: 1024 tokens para activar caché (Sonnet/Opus), 2048 (Haiku).
  const systemBlocks = [
    {
      type: "text",
      text: typeof system === "string" ? system : JSON.stringify(system),
      cache_control: { type: "ephemeral" },
    },
  ];
  // ─────────────────────────────────────────────────────────────────────────

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemBlocks,
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
          "anthropic-beta": "prompt-caching-2024-07-31",   // ← activa caché
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
    inputTokens:       data.usage?.input_tokens              || 0,
    outputTokens:      data.usage?.output_tokens             || 0,
    cacheReadTokens:   data.usage?.cache_read_input_tokens   || 0,  // ← FASE 0
    cacheWriteTokens:  data.usage?.cache_creation_input_tokens || 0, // ← FASE 0
  };

  const costUsd = calculateCost(model, usage);

  // Log de caché para visibilidad (solo en dev/servidor)
  if (usage.cacheReadTokens > 0 || usage.cacheWriteTokens > 0) {
    console.log(`[claude] cache hit=${usage.cacheReadTokens}tok write=${usage.cacheWriteTokens}tok saved≈${Math.round(usage.cacheReadTokens*0.9)}tok`);
  }

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
 * Calcula el costo real en USD considerando tokens de caché (FASE 0).
 * Con caché activo, el ahorro típico es 70-80% en tokens de input.
 */
export function calculateCost(model, usage) {
  const pricing = PRICING[model];
  if (!pricing) return null;

  // Tokens normales (los que no estaban en caché)
  const inCost        = (usage.inputTokens       / 1_000_000) * pricing.in;
  const outCost       = (usage.outputTokens      / 1_000_000) * pricing.out;
  // Tokens de caché (FASE 0)
  const cacheWriteCost = ((usage.cacheWriteTokens || 0) / 1_000_000) * (pricing.cacheWrite || pricing.in * 1.25);
  const cacheReadCost  = ((usage.cacheReadTokens  || 0) / 1_000_000) * (pricing.cacheRead  || pricing.in * 0.10);

  return Number((inCost + outCost + cacheWriteCost + cacheReadCost).toFixed(6));
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
