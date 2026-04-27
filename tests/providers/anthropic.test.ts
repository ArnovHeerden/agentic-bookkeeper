import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicProvider, CATEGORIZE_V1_TOOL, type ProviderRequest } from "../../src/index.js";

/**
 * Build an Anthropic SDK mock that records the request it receives and
 * returns a configurable response.
 *
 * The SDK's exhaustive Message/Usage types evolve every release; we cast
 * via `unknown` rather than chase newly-required fields whose values the
 * provider doesn't care about.
 */
function buildMockClient(response: unknown): {
  client: Anthropic;
  createSpy: ReturnType<typeof vi.fn>;
} {
  const createSpy = vi.fn().mockResolvedValue(response);
  const client = { messages: { create: createSpy } } as unknown as Anthropic;
  return { client, createSpy };
}

const baseRequest: ProviderRequest = {
  model: "claude-haiku-4-5",
  maxTokens: 512,
  temperature: 0.1,
  system: [
    { text: "Static rules block — should be cached.", cache: true },
    { text: "Per-call dynamic context.", cache: false },
  ],
  user: "Transaction: ...",
  tool: CATEGORIZE_V1_TOOL,
};

const buildSuccessResponse = (toolInput: Record<string, unknown>): unknown => ({
  id: "msg_test_001",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5",
  content: [
    {
      type: "tool_use",
      id: "toolu_test_001",
      name: CATEGORIZE_V1_TOOL.name,
      input: toolInput,
    },
  ],
  stop_reason: "tool_use",
  stop_sequence: null,
  usage: {
    input_tokens: 5000,
    output_tokens: 100,
    cache_creation_input_tokens: 4500,
    cache_read_input_tokens: 0,
  },
});

interface CapturedCall {
  model: string;
  max_tokens: number;
  temperature: number;
  system: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  tool_choice: { type: string; name: string };
  tools: Array<Record<string, unknown>>;
}

const captureCall = (createSpy: ReturnType<typeof vi.fn>): CapturedCall => {
  const args = createSpy.mock.calls[0];
  if (!args || args.length === 0) throw new Error("createSpy was not called");
  return args[0] as CapturedCall;
};

describe("AnthropicProvider — request shape", () => {
  it("forces tool-use with the tool name from the request", async () => {
    const { client, createSpy } = buildMockClient(buildSuccessResponse({ ok: true }));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await provider.call(baseRequest);

    expect(createSpy).toHaveBeenCalledOnce();
    const call = captureCall(createSpy);
    expect(call.tool_choice).toEqual({ type: "tool", name: CATEGORIZE_V1_TOOL.name });
  });

  it("attaches cache_control to cacheable system blocks only", async () => {
    const { client, createSpy } = buildMockClient(buildSuccessResponse({ ok: true }));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await provider.call(baseRequest);

    const call = captureCall(createSpy);
    expect(call.system).toHaveLength(2);
    expect(call.system[0]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    expect(call.system[1]).toMatchObject({ type: "text" });
    expect(call.system[1]).not.toHaveProperty("cache_control");
  });

  it("passes through model, max_tokens, temperature", async () => {
    const { client, createSpy } = buildMockClient(buildSuccessResponse({ ok: true }));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await provider.call(baseRequest);

    const call = captureCall(createSpy);
    expect(call.model).toBe("claude-haiku-4-5");
    expect(call.max_tokens).toBe(512);
    expect(call.temperature).toBe(0.1);
  });

  it("includes the user message as a single user-role content", async () => {
    const { client, createSpy } = buildMockClient(buildSuccessResponse({ ok: true }));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await provider.call(baseRequest);

    const call = captureCall(createSpy);
    expect(call.messages).toEqual([{ role: "user", content: "Transaction: ..." }]);
  });
});

describe("AnthropicProvider — response handling", () => {
  it("extracts the tool_use block input as toolInput", async () => {
    const expectedInput = { accountCode: "6920", confidence: 0.9 };
    const { client } = buildMockClient(buildSuccessResponse(expectedInput));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    const response = await provider.call(baseRequest);

    expect(response.toolInput).toEqual(expectedInput);
    expect(response.stopReason).toBe("tool_use");
  });

  it("propagates token usage including cache fields when present", async () => {
    const { client } = buildMockClient(buildSuccessResponse({}));
    const provider = new AnthropicProvider({ apiKey: "test", client });

    const response = await provider.call(baseRequest);

    expect(response.usage.inputTokens).toBe(5000);
    expect(response.usage.outputTokens).toBe(100);
    expect(response.usage.cacheCreationInputTokens).toBe(4500);
    expect(response.usage.cacheReadInputTokens).toBe(0);
  });

  it("throws when the response contains no tool_use block", async () => {
    const sdkResponse = {
      ...(buildSuccessResponse({}) as Record<string, unknown>),
      content: [{ type: "text", text: "I refuse to call the tool" }],
    };
    const { client } = buildMockClient(sdkResponse);
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await expect(provider.call(baseRequest)).rejects.toThrow(/Expected tool_use/);
  });

  it("maps unknown stop_reason to 'other'", async () => {
    const sdkResponse = {
      ...(buildSuccessResponse({}) as Record<string, unknown>),
      stop_reason: "totally_new_reason",
    };
    const { client } = buildMockClient(sdkResponse);
    const provider = new AnthropicProvider({ apiKey: "test", client });

    const response = await provider.call(baseRequest);
    expect(response.stopReason).toBe("other");
  });

  it("exposes the provider name", () => {
    const provider = new AnthropicProvider({ apiKey: "test" });
    expect(provider.name).toBe("anthropic");
  });
});
