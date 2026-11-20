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
 * be quick.
 */
export function anthropicModel(client: Anthropic = new Anthropic()): ModelClient {
  return {
    create: (request) =>
      client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages,
        tools: request.tools,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }),
  };
}
