import { v4 as uuidv4 } from "uuid";
import type { AgentSpec, ChatMessage, RpcRequest, RpcResponse, RunMeta, RunRecord, RunTraceEvent, ToolResult, ToolSpec } from "./types";
import { StudioValidator } from "./validator";

type RpcParams = Record<string, unknown>;

export interface RpcTransport {
  send(request: RpcRequest): Promise<RpcResponse>;
}

export class RpcClient {
  constructor(private readonly transport: RpcTransport) {}

  async call<TResult, TParams extends RpcParams = RpcParams>(method: string, params: TParams): Promise<TResult> {
    const request: RpcRequest<TParams> = {
      id: uuidv4(),
      method,
      params,
    };

    const response = await this.transport.send(request);
    if (response.error) {
      throw new Error(`${response.error.code}: ${response.error.message}`);
    }

    return response.result as TResult;
  }
}

declare global {
  interface Window {
    __AGENTS4D_RPC_HANDLER__?: (request: RpcRequest) => Promise<RpcResponse>;
  }
}

export class WindowRuntimeTransport implements RpcTransport {
  async send(request: RpcRequest): Promise<RpcResponse> {
    const handler = window.__AGENTS4D_RPC_HANDLER__;
    if (!handler) {
      throw new Error("No 4D runtime RPC handler is attached (window.__AGENTS4D_RPC_HANDLER__).");
    }

    return handler(request);
  }
}

interface InMemoryRuntimeState {
  agents: Map<string, AgentSpec>;
  tools: Map<string, ToolSpec>;
  runs: Map<string, RunRecord>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newMessage(role: ChatMessage["role"], content: string, extras?: Partial<ChatMessage>): ChatMessage {
  return {
    id: uuidv4(),
    ts: nowIso(),
    role,
    content,
    name: extras?.name,
    toolCallId: extras?.toolCallId,
  };
}

function newTrace(
  type: RunTraceEvent["type"],
  runId: string,
  agentId: string,
  payload: Record<string, unknown>,
): RunTraceEvent {
  return {
    ts: nowIso(),
    type,
    runId,
    agentId,
    payload,
  };
}

export class InMemoryRuntimeTransport implements RpcTransport {
  private readonly state: InMemoryRuntimeState;
  private readonly validator: StudioValidator;

  constructor(seed?: { agents?: AgentSpec[]; tools?: ToolSpec[] }) {
    this.state = {
      agents: new Map((seed?.agents ?? []).map((agent) => [agent.id, agent])),
      tools: new Map((seed?.tools ?? []).map((tool) => [tool.id, tool])),
      runs: new Map(),
    };
    this.validator = new StudioValidator();
  }

  async send(request: RpcRequest): Promise<RpcResponse> {
    try {
      const result = await this.dispatch(request.method, request.params as RpcParams);
      return {
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        id: request.id,
        error: {
          code: "RPC_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async dispatch(method: string, params: RpcParams): Promise<unknown> {
    switch (method) {
      case "agents.list":
        return [...this.state.agents.values()];
      case "agents.get":
        return this.state.agents.get(this.requireString(params, "agentId")) ?? null;
      case "agents.upsert":
        return this.upsertAgent(params as unknown as AgentSpec);
      case "agents.delete":
        this.state.agents.delete(this.requireString(params, "agentId"));
        return { ok: true };

      case "tools.list":
        return [...this.state.tools.values()];
      case "tools.get":
        return this.state.tools.get(this.requireString(params, "toolId")) ?? null;
      case "tools.upsert":
        return this.upsertTool(params as unknown as ToolSpec);
      case "tools.delete":
        this.state.tools.delete(this.requireString(params, "toolId"));
        return { ok: true };
      case "tools.invoke":
        return this.invokeTool(
          this.requireString(params, "toolId"),
          params.input,
          this.requireString(params, "agentId", "studio-agent"),
        );

      case "runs.start":
        return this.startRun(this.requireString(params, "agentId"), (params.initialMessages as ChatMessage[] | undefined) ?? []);
      case "runs.step":
        return this.stepRun(this.requireString(params, "runId"));
      case "runs.get":
        return this.state.runs.get(this.requireString(params, "runId")) ?? null;
      case "runs.list":
        return [...this.state.runs.values()].map((record) => record.meta);
      case "runs.send":
        return this.sendRunMessage(this.requireString(params, "runId"), this.requireRole(params), this.requireString(params, "content"));
      case "runs.cancel":
        return this.cancelRun(this.requireString(params, "runId"));
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  private upsertAgent(agent: AgentSpec): AgentSpec {
    const validation = this.validator.validateAgent(agent);
    if (!validation.ok) {
      throw new Error(`Invalid AgentSpec: ${validation.errors.join("; ")}`);
    }
    this.state.agents.set(agent.id, agent);
    return agent;
  }

  private upsertTool(tool: ToolSpec): ToolSpec {
    const validation = this.validator.validateTool(tool);
    if (!validation.ok) {
      throw new Error(`Invalid ToolSpec: ${validation.errors.join("; ")}`);
    }
    this.state.tools.set(tool.id, tool);
    return tool;
  }

  private invokeTool(toolId: string, input: unknown, agentId: string): ToolResult {
    const tool = this.state.tools.get(toolId);
    if (!tool) {
      return {
        ok: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool "${toolId}" not found.`,
        },
      };
    }

    if (tool.permissions.agentAllowlist && !tool.permissions.agentAllowlist.includes(agentId)) {
      return {
        ok: false,
        error: {
          code: "TOOL_NOT_ALLOWED",
          message: `Agent "${agentId}" is not allowed to invoke "${toolId}".`,
        },
      };
    }

    const inputValidation = this.validator.validateToolInput(tool, input);
    if (!inputValidation.ok) {
      return {
        ok: false,
        error: {
          code: "TOOL_INPUT_SCHEMA",
          message: inputValidation.errors.join("; "),
        },
      };
    }

    const result: ToolResult = {
      ok: true,
      data: {
        echo: input as Record<string, unknown>,
        toolId,
      },
    };

    const outputValidation = this.validator.validateToolOutput(tool, result);
    if (!outputValidation.ok) {
      return {
        ok: false,
        error: {
          code: "TOOL_OUTPUT_SCHEMA",
          message: outputValidation.errors.join("; "),
        },
      };
    }

    return result;
  }

  private startRun(agentId: string, initialMessages: ChatMessage[]): string {
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found.`);
    }

    const runId = uuidv4();
    const now = nowIso();
    const meta: RunMeta = {
      runId,
      agentId,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    const messages = initialMessages.map((message) => ({
      ...message,
      id: message.id || uuidv4(),
      ts: message.ts || nowIso(),
    }));
    const trace = messages.map((message) =>
      newTrace("messageAdded", runId, agentId, {
        role: message.role,
        content: message.content,
      }),
    );

    this.state.runs.set(runId, { meta, messages, trace });
    return runId;
  }

  private sendRunMessage(runId: string, role: ChatMessage["role"], content: string): { ok: true } {
    const run = this.requireRun(runId);
    const message = newMessage(role, content);
    run.messages.push(message);
    run.trace.push(
      newTrace("messageAdded", run.meta.runId, run.meta.agentId, {
        role,
        content,
      }),
    );
    run.meta.updatedAt = nowIso();
    return { ok: true };
  }

  private cancelRun(runId: string): { ok: true } {
    const run = this.requireRun(runId);
    run.meta.status = "cancelled";
    run.meta.updatedAt = nowIso();
    run.trace.push(
      newTrace("error", runId, run.meta.agentId, {
        code: "RUN_CANCELLED",
        message: "Run cancelled by user.",
      }),
    );
    return { ok: true };
  }

  private stepRun(runId: string): RunRecord {
    const run = this.requireRun(runId);
    if (run.meta.status !== "running") {
      return run;
    }

    const agent = this.state.agents.get(run.meta.agentId);
    if (!agent) {
      throw new Error(`Agent "${run.meta.agentId}" not found.`);
    }

    const userMessage = [...run.messages].reverse().find((message) => message.role === "user");
    if (!userMessage) {
      const assistant = newMessage("assistant", "No user message to process.");
      run.messages.push(assistant);
      run.trace.push(
        newTrace("messageAdded", runId, agent.id, {
          role: "assistant",
          content: assistant.content,
        }),
      );
      run.meta.status = "completed";
      run.meta.updatedAt = nowIso();
      return run;
    }

    const toolCall = this.parseToolCall(userMessage.content);
    if (toolCall && agent.allowedTools.includes(toolCall.toolId)) {
      run.trace.push(
        newTrace("toolCallRequested", runId, agent.id, {
          toolId: toolCall.toolId,
          input: toolCall.input,
        }),
      );
      run.trace.push(
        newTrace("toolCallStarted", runId, agent.id, {
          toolId: toolCall.toolId,
        }),
      );

      const toolResult = this.invokeTool(toolCall.toolId, toolCall.input, agent.id);
      const toolMessage = newMessage("tool", JSON.stringify(toolResult), {
        name: toolCall.toolId,
        toolCallId: uuidv4(),
      });
      run.messages.push(toolMessage);
      run.trace.push(
        newTrace("messageAdded", runId, agent.id, {
          role: "tool",
          content: toolMessage.content,
          name: toolMessage.name,
        }),
      );
      run.trace.push(
        newTrace("toolCallFinished", runId, agent.id, {
          toolId: toolCall.toolId,
          ok: toolResult.ok,
        }),
      );

      const assistant = newMessage("assistant", `Tool ${toolCall.toolId} returned: ${JSON.stringify(toolResult)}`);
      run.messages.push(assistant);
      run.trace.push(
        newTrace("messageAdded", runId, agent.id, {
          role: "assistant",
          content: assistant.content,
        }),
      );
      run.meta.status = "completed";
      run.meta.updatedAt = nowIso();
      return run;
    }

    const assistant = newMessage("assistant", `Studio mock response: ${userMessage.content}`);
    run.messages.push(assistant);
    run.trace.push(
      newTrace("messageAdded", runId, agent.id, {
        role: "assistant",
        content: assistant.content,
      }),
    );
    run.meta.status = "completed";
    run.meta.updatedAt = nowIso();
    return run;
  }

  private parseToolCall(content: string): { toolId: string; input: unknown } | null {
    const match = content.match(/^\/tool\s+([A-Za-z0-9_-]+)\s*(\{[\s\S]*\})?$/);
    if (!match) {
      return null;
    }
    const toolId = match[1];
    let input: unknown = {};
    if (match[2]) {
      try {
        input = JSON.parse(match[2]);
      } catch {
        input = {};
      }
    }
    return { toolId, input };
  }

  private requireString(params: RpcParams, key: string, fallback?: string): string {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required param "${key}".`);
  }

  private requireRole(params: RpcParams): ChatMessage["role"] {
    const value = params.role;
    if (value === "system" || value === "user" || value === "assistant" || value === "tool") {
      return value;
    }
    throw new Error("Invalid role parameter.");
  }

  private requireRun(runId: string): RunRecord {
    const run = this.state.runs.get(runId);
    if (!run) {
      throw new Error(`Run "${runId}" not found.`);
    }
    return run;
  }
}

export function createRpcClient(): RpcClient {
  const transport =
    typeof window !== "undefined" && window.__AGENTS4D_RPC_HANDLER__
      ? new WindowRuntimeTransport()
      : new InMemoryRuntimeTransport();
  return new RpcClient(transport);
}
