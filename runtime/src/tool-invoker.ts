import { SchemaValidator } from "./schema-validator.js";
import { ToolRegistry } from "./tool-registry.js";
import type { RunTraceEvent, RuntimePolicy, ToolResult, ToolSpec } from "./types.js";
import { nowIso, toErrorMessage } from "./utils.js";

export interface ToolInvocationContext {
  runId: string;
  agentId: string;
  toolId: string;
  methodName: string;
}

export type ToolBindingExecutor = (methodName: string, input: unknown, context: ToolInvocationContext) => Promise<unknown>;

export interface ToolInvokerOptions {
  toolRegistry: ToolRegistry;
  schemaValidator: SchemaValidator;
  bindingExecutor: ToolBindingExecutor;
  emitTrace?: (event: RunTraceEvent) => Promise<void>;
  runtimePolicy?: RuntimePolicy;
}

export class ToolInvoker {
  private readonly toolRegistry: ToolRegistry;
  private readonly schemaValidator: SchemaValidator;
  private readonly bindingExecutor: ToolBindingExecutor;
  private readonly emitTrace: (event: RunTraceEvent) => Promise<void>;
  private readonly runtimePolicy: RuntimePolicy;

  constructor(options: ToolInvokerOptions) {
    this.toolRegistry = options.toolRegistry;
    this.schemaValidator = options.schemaValidator;
    this.bindingExecutor = options.bindingExecutor;
    this.emitTrace = options.emitTrace ?? (async () => {});
    this.runtimePolicy = options.runtimePolicy ?? { allowApprovalBypass: false };
  }

  async Invoke(runId: string, agentId: string, toolId: string, input: unknown): Promise<ToolResult> {
    const tool = await this.toolRegistry.Get(toolId);
    if (!tool) {
      const failure = this.failure("TOOL_NOT_FOUND", `Tool "${toolId}" is not registered.`);
      await this.emitToolError(runId, agentId, toolId, failure.error);
      return failure;
    }

    const permissionsResult = this.checkPermissions(tool, agentId);
    if (!permissionsResult.ok) {
      await this.emitToolError(runId, agentId, toolId, permissionsResult.error);
      return permissionsResult;
    }

    const inputValidation = this.schemaValidator.ValidateToolInput(tool, input);
    if (!inputValidation.ok) {
      const failure = this.failure("TOOL_INPUT_SCHEMA", "Tool input failed validation.", inputValidation.errors);
      await this.emitToolError(runId, agentId, toolId, failure.error);
      return failure;
    }

    const startTs = Date.now();
    await this.emitTrace({
      ts: nowIso(),
      type: "toolCallStarted",
      runId,
      agentId,
      payload: {
        toolId,
        method: tool.binding.method,
      },
    });

    try {
      const rawOutput = await this.invokeWithTimeout(tool, runId, agentId, input);
      const normalizedOutput = this.normalizeResult(rawOutput);
      const outputValidation = this.schemaValidator.ValidateToolOutput(tool, normalizedOutput);
      if (!outputValidation.ok) {
        const failure = this.failure("TOOL_OUTPUT_SCHEMA", "Tool output failed validation.", outputValidation.errors);
        await this.emitToolError(runId, agentId, toolId, failure.error);
        await this.emitTrace({
          ts: nowIso(),
          type: "toolCallFinished",
          runId,
          agentId,
          payload: {
            toolId,
            durationMs: Date.now() - startTs,
            ok: false,
          },
        });
        return failure;
      }

      await this.emitTrace({
        ts: nowIso(),
        type: "toolCallFinished",
        runId,
        agentId,
        payload: {
          toolId,
          durationMs: Date.now() - startTs,
          ok: true,
        },
      });
      return normalizedOutput;
    } catch (error) {
      const failure = this.failure("TOOL_EXECUTION", toErrorMessage(error));
      await this.emitToolError(runId, agentId, toolId, failure.error);
      await this.emitTrace({
        ts: nowIso(),
        type: "toolCallFinished",
        runId,
        agentId,
        payload: {
          toolId,
          durationMs: Date.now() - startTs,
          ok: false,
        },
      });
      return failure;
    }
  }

  private checkPermissions(tool: ToolSpec, agentId: string): ToolResult {
    if (tool.permissions.agentAllowlist && tool.permissions.agentAllowlist.length > 0) {
      if (!tool.permissions.agentAllowlist.includes(agentId)) {
        return this.failure("TOOL_NOT_ALLOWED", `Agent "${agentId}" is not allowed to invoke tool "${tool.id}".`);
      }
    }

    if (tool.permissions.requiresApproval && !this.runtimePolicy.allowApprovalBypass) {
      return this.failure(
        "TOOL_APPROVAL_REQUIRED",
        `Tool "${tool.id}" requires approval and approval bypass is disabled.`,
      );
    }

    return {
      ok: true,
      data: {},
    };
  }

  private normalizeResult(rawOutput: unknown): ToolResult {
    if (rawOutput && typeof rawOutput === "object" && "ok" in rawOutput) {
      const candidate = rawOutput as ToolResult;
      if (typeof candidate.ok === "boolean") {
        return candidate;
      }
    }

    if (rawOutput && typeof rawOutput === "object" && !Array.isArray(rawOutput)) {
      return {
        ok: true,
        data: rawOutput as Record<string, unknown>,
      };
    }

    return {
      ok: true,
      data: {
        value: rawOutput as unknown,
      },
    };
  }

  private async invokeWithTimeout(
    tool: ToolSpec,
    runId: string,
    agentId: string,
    input: unknown,
  ): Promise<unknown> {
    const timeoutMs = tool.timeouts.ms;
    return Promise.race([
      this.bindingExecutor(tool.binding.method, input, {
        runId,
        agentId,
        toolId: tool.id,
        methodName: tool.binding.method,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool "${tool.id}" timed out after ${timeoutMs} ms.`)), timeoutMs);
      }),
    ]);
  }

  private failure(code: string, message: string, details?: unknown): ToolResult {
    return {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  private async emitToolError(
    runId: string,
    agentId: string,
    toolId: string,
    error: { code: string; message: string; details?: unknown },
  ): Promise<void> {
    await this.emitTrace({
      ts: nowIso(),
      type: "error",
      runId,
      agentId,
      payload: {
        toolId,
        ...error,
      },
    });
  }
}
