import type { ChatMessage, LlmCompletion, ModelRef, ToolCall, ToolManifest } from "./types.js";
import { Secrets } from "./secrets.js";
import { newId, nowIso, safeJsonParse, toErrorMessage } from "./utils.js";

export interface LlmProvider {
  Complete(
    messages: ChatMessage[],
    toolManifests: ToolManifest[],
    modelRef: ModelRef,
    params: { temperature: number; maxTokens: number },
  ): Promise<LlmCompletion>;
}

export class LLMClient {
  private readonly providers: Map<string, LlmProvider>;

  constructor(providers?: Record<string, LlmProvider>) {
    this.providers = new Map(Object.entries(providers ?? {}));
  }

  RegisterProvider(providerName: string, provider: LlmProvider): void {
    this.providers.set(providerName, provider);
  }

  async Complete(
    messages: ChatMessage[],
    toolManifests: ToolManifest[],
    modelRef: ModelRef,
    params: { temperature: number; maxTokens: number },
  ): Promise<LlmCompletion> {
    const provider = this.providers.get(modelRef.provider);
    if (!provider) {
      throw new Error(`Provider "${modelRef.provider}" is not registered.`);
    }

    return provider.Complete(messages, toolManifests, modelRef, params);
  }
}

export class MockProvider implements LlmProvider {
  async Complete(
    messages: ChatMessage[],
    _toolManifests: ToolManifest[],
    _modelRef: ModelRef,
    _params: { temperature: number; maxTokens: number },
  ): Promise<LlmCompletion> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return {
        toolCalls: [],
      };
    }

    if (lastMessage.role === "user") {
      const toolRequest = this.parseToolRequest(lastMessage.content);
      if (toolRequest) {
        return {
          assistantMessage: {
            id: newId("msg"),
            ts: nowIso(),
            role: "assistant",
            content: `Calling tool ${toolRequest.toolId}.`,
          },
          toolCalls: [toolRequest],
        };
      }

      return {
        assistantMessage: {
          id: newId("msg"),
          ts: nowIso(),
          role: "assistant",
          content: `Mock response: ${lastMessage.content}`,
        },
        toolCalls: [],
      };
    }

    if (lastMessage.role === "tool") {
      return {
        assistantMessage: {
          id: newId("msg"),
          ts: nowIso(),
          role: "assistant",
          content: `Tool result received: ${lastMessage.content}`,
        },
        toolCalls: [],
      };
    }

    return {
      assistantMessage: {
        id: newId("msg"),
        ts: nowIso(),
        role: "assistant",
        content: "Mock provider completed step.",
      },
      toolCalls: [],
    };
  }

  private parseToolRequest(content: string): ToolCall | null {
    const matches = content.match(/^\/tool\s+([A-Za-z0-9_-]+)\s*(\{[\s\S]*\})?$/);
    if (!matches) {
      return null;
    }

    const toolId = matches[1];
    const rawInput = matches[2];
    const input = rawInput ? safeJsonParse<unknown>(rawInput, {}) : {};

    return {
      id: newId("tool_call"),
      toolId,
      input,
    };
  }
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface OpenAiResponse {
  choices: Array<{
    message: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export interface OpenAIProviderOptions {
  secrets: Secrets;
  fetchFn?: typeof fetch;
}

export class OpenAIProvider implements LlmProvider {
  private readonly secrets: Secrets;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAIProviderOptions) {
    this.secrets = options.secrets;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async Complete(
    messages: ChatMessage[],
    toolManifests: ToolManifest[],
    modelRef: ModelRef,
    params: { temperature: number; maxTokens: number },
  ): Promise<LlmCompletion> {
    const endpoint = modelRef.endpoint ?? "https://api.openai.com/v1/chat/completions";
    const apiKey = await this.secrets.Resolve(modelRef.apiKeyRef);

    const openAiMessages: OpenAiMessage[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
      name: message.name,
      tool_call_id: message.toolCallId,
    }));

    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelRef.model,
        messages: openAiMessages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        tools: toolManifests.map((tool) => ({
          type: "function",
          function: {
            name: tool.id,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
        tool_choice: toolManifests.length > 0 ? "auto" : undefined,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI provider error ${response.status}: ${message}`);
    }

    const payload = (await response.json()) as OpenAiResponse;
    const choice = payload.choices[0];
    if (!choice) {
      throw new Error("OpenAI provider returned no choices.");
    }

    const toolCalls: ToolCall[] =
      choice.message.tool_calls?.map((toolCall) => ({
        id: toolCall.id,
        toolId: toolCall.function.name,
        input: safeJsonParse<unknown>(toolCall.function.arguments, {}),
      })) ?? [];

    const assistantContent = choice.message.content ?? "";

    return {
      assistantMessage: {
        id: newId("msg"),
        ts: nowIso(),
        role: "assistant",
        content: assistantContent,
      },
      toolCalls,
    };
  }
}

export class FallbackProvider implements LlmProvider {
  async Complete(): Promise<LlmCompletion> {
    throw new Error("No provider available.");
  }
}

export function providerErrorToToolMessage(error: unknown): string {
  return `Provider error: ${toErrorMessage(error)}`;
}
