import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5-5";

export interface ModelRequest {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: Anthropic.Beta.BetaTool[];
}

/**
 * The one model call the loop makes per turn. An interface so tests and the
 * eval can script the model's responses.
 */
export interface ModelClient {
  create(request: ModelRequest): Promise<Anthropic.Beta.BetaMessage>;
}

/**
 * Claude Sonnet 5.5 through the Anthropic SDK. Server-side fallback is on:
 * if the model declines, the API retries on another model inside the same
 * call. Effort is medium: a verdict is a short judgement, and replies should
 * be quick. Automatic prompt caching makes later turns read earlier ones,
 * images included, at a fraction of the cost.
 *
 * The SDK's defaults (a 10-minute timeout, two retries) outlast the
 * function's 120 s, so a slow call would be killed mid-check with no reply.
 * One call here takes at most about 51 s (25 s, one retry); with the
 * loop's 45 s time cap and the 5 s gathering window, a check finishes or
 * fails inside 120 s.
 */
export const MODEL_TIMEOUT_MS = 25_000;
export const MODEL_MAX_RETRIES = 1;

export function anthropicModel(
  client: Anthropic = new Anthropic({ timeout: MODEL_TIMEOUT_MS, maxRetries: MODEL_MAX_RETRIES }),
): ModelClient {
  return {
    create: (request) =>
      client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: request.system,
        // Cache the whole prefix (system, tools, forwarded content and earlier
        // turns), so screenshots aren't paid for in full on every turn.
        cache_control: { type: "ephemeral" },
        messages: request.messages,
        tools: request.tools,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }),
  };
}
