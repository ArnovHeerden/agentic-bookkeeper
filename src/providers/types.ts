import type { TokenUsage } from "../cost.js";

/**
 * Provider-agnostic request shape. The agent loop builds this; concrete
 * providers translate it into their SDK's call format.
 *
 * Caching: blocks marked `cache: true` are sent to the provider with cache
 * directives where supported (Anthropic `cache_control: { type: "ephemeral" }`).
 */
export interface ProviderRequest {
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly system: readonly SystemBlock[];
  readonly user: string;
  readonly tool: ToolDefinition;
}

export interface SystemBlock {
  readonly text: string;
  readonly cache: boolean;
}

/**
 * Tool/function-call schema. JSON Schema (draft-07 subset) for the input.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/**
 * Provider-agnostic response. `toolInput` is the raw object the model passed
 * to the tool; the agent will Zod-validate it.
 */
export interface ProviderResponse {
  readonly toolInput: unknown;
  readonly stopReason: "tool_use" | "end_turn" | "max_tokens" | "stop_sequence" | "other";
  readonly usage: TokenUsage;
}

/**
 * The interface every LLM provider implements.
 *
 * Implementations should:
 * - Surface raw token usage including cache_read/cache_write breakdowns
 * - Throw the underlying SDK error (so retry.ts can classify it)
 * - Force tool-use (the model MUST emit a tool call, not a text response)
 */
export interface LLMProvider {
  readonly name: string;
  call(request: ProviderRequest): Promise<ProviderResponse>;
}
