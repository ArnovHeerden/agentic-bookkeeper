import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, ProviderRequest, ProviderResponse } from "./types.js";

export interface AnthropicProviderConfig {
  readonly apiKey: string;
  /** Optional override for the underlying Anthropic SDK client (useful in tests). */
  readonly client?: Anthropic;
}

/**
 * Anthropic Claude provider. Translates the provider-agnostic ProviderRequest
 * into Anthropic SDK calls, including:
 *
 * - `cache_control: { type: "ephemeral" }` on system blocks marked `cache: true`
 *   (cuts cost on repeated runs by ~90%).
 * - `tool_choice: { type: "tool", name: ... }` to force tool emission.
 * - Surfaces `cache_creation_input_tokens` / `cache_read_input_tokens` so the
 *   cost layer can compute discounted prices accurately.
 */
export class AnthropicProvider implements LLMProvider {
  public readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(config: AnthropicProviderConfig) {
    this.client = config.client ?? new Anthropic({ apiKey: config.apiKey });
  }

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.system.map((block) => ({
        type: "text" as const,
        text: block.text,
        ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
      })),
      messages: [{ role: "user", content: request.user }],
      tools: [
        {
          name: request.tool.name,
          description: request.tool.description,
          input_schema: request.tool.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: request.tool.name },
    });

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUseBlock) {
      throw new Error(
        `Expected tool_use block in response, got: ${response.content
          .map((b) => b.type)
          .join(", ")}`,
      );
    }

    return {
      toolInput: toolUseBlock.input,
      stopReason: mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        ...(typeof response.usage.cache_creation_input_tokens === "number"
          ? { cacheCreationInputTokens: response.usage.cache_creation_input_tokens }
          : {}),
        ...(typeof response.usage.cache_read_input_tokens === "number"
          ? { cacheReadInputTokens: response.usage.cache_read_input_tokens }
          : {}),
      },
    };
  }
}

function mapStopReason(reason: string | null): ProviderResponse["stopReason"] {
  switch (reason) {
    case "tool_use":
    case "end_turn":
    case "max_tokens":
    case "stop_sequence":
      return reason;
    default:
      return "other";
  }
}
