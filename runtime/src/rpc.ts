import { AgentRegistry } from "./agent-registry.js";
import { RunEngine } from "./run-engine.js";
import { SchemaValidator } from "./schema-validator.js";
import { Store } from "./store.js";
import { ToolRegistry } from "./tool-registry.js";
import { ToolInvoker } from "./tool-invoker.js";
import type { AgentSpec, A2AEnvelope, ChatMessage, RunListFilter, ToolSpec } from "./types.js";

export interface RpcRequest<TParams = unknown> {
  id: string;
  method: string;
  params: TParams;
}

export interface RpcErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface RpcResponse<TResult = unknown> {
  id: string;
  result?: TResult;
  error?: RpcErrorPayload;
}

class RpcError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface RuntimeRpcServerOptions {
  agents: AgentRegistry;
  tools: ToolRegistry;
  store: Store;
  runEngine: RunEngine;
  toolInvoker: ToolInvoker;
  schemaValidator: SchemaValidator;
}

export class RuntimeRpcServer {
  private readonly agents: AgentRegistry;
  private readonly tools: ToolRegistry;
  private readonly store: Store;
  private readonly runEngine: RunEngine;
  private readonly toolInvoker: ToolInvoker;
  private readonly schemaValidator: SchemaValidator;

  constructor(options: RuntimeRpcServerOptions) {
    this.agents = options.agents;
    this.tools = options.tools;
    this.store = options.store;
    this.runEngine = options.runEngine;
    this.toolInvoker = options.toolInvoker;
    this.schemaValidator = options.schemaValidator;
  }

  async handle(request: RpcRequest): Promise<RpcResponse> {
    try {
      const result = await this.dispatch(request.method, request.params as Record<string, unknown>);
      return {
        id: request.id,
        result,
      };
    } catch (error) {
      if (error instanceof RpcError) {
        return {
          id: request.id,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      return {
        id: request.id,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case "agents.upsert":
        return this.agents.Upsert(params as unknown as AgentSpec);
      case "agents.get":
        return this.agents.Get(this.requireString(params, "agentId"));
      case "agents.list":
        return this.agents.List();
      case "agents.delete":
        return this.agents.Delete(this.requireString(params, "agentId"));

      case "tools.upsert":
        return this.tools.Upsert(params as unknown as ToolSpec);
      case "tools.get":
        return this.tools.Get(this.requireString(params, "toolId"));
      case "tools.list":
        return this.tools.List();
      case "tools.delete":
        return this.tools.Delete(this.requireString(params, "toolId"));
      case "tools.resolveBinding":
        return this.tools.ResolveBinding(this.requireString(params, "toolId"));
      case "tools.invoke":
        return this.toolInvoker.Invoke(
          this.requireString(params, "runId"),
          this.requireString(params, "agentId"),
          this.requireString(params, "toolId"),
          params.input,
        );

      case "runs.start":
        return this.runEngine.StartRun(
          this.requireString(params, "agentId"),
          (params.initialMessages as Array<Pick<ChatMessage, "role" | "content" | "name" | "toolCallId">>) ?? [],
          (params.options as Record<string, unknown>) ?? {},
        );
      case "runs.send":
        await this.runEngine.SendMessage(
          this.requireString(params, "runId"),
          this.requireRole(params, "role"),
          this.requireString(params, "content"),
        );
        return { ok: true };
      case "runs.step":
        return this.runEngine.Step(this.requireString(params, "runId"));
      case "runs.cancel":
        await this.runEngine.Cancel(this.requireString(params, "runId"));
        return { ok: true };
      case "runs.get":
        return this.store.GetRun(this.requireString(params, "runId"));
      case "runs.list":
        return this.store.ListRuns((params.filter as RunListFilter | undefined) ?? undefined);

      case "schemas.validateAgent":
        return this.schemaValidator.ValidateAgent(params as unknown as AgentSpec);
      case "schemas.validateTool":
        return this.schemaValidator.ValidateTool(params as unknown as ToolSpec);
      case "schemas.validateEnvelope":
        return this.schemaValidator.ValidateEnvelope(params as unknown as A2AEnvelope);
      default:
        throw new RpcError("METHOD_NOT_FOUND", `Unsupported RPC method "${method}".`);
    }
  }

  private requireString(params: Record<string, unknown>, key: string): string {
    const value = params[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new RpcError("INVALID_PARAMS", `Missing or invalid "${key}".`, params);
    }
    return value;
  }

  private requireRole(params: Record<string, unknown>, key: string): ChatMessage["role"] {
    const value = params[key];
    if (value === "system" || value === "user" || value === "assistant" || value === "tool") {
      return value;
    }
    throw new RpcError("INVALID_PARAMS", `Missing or invalid "${key}".`, params);
  }
}
