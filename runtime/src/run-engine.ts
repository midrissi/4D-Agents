import { AgentRegistry } from "./agent-registry.js";
import { LLMClient } from "./llm-client.js";
import { Memory } from "./memory.js";
import { Store } from "./store.js";
import { ToolRegistry } from "./tool-registry.js";
import { ToolInvoker } from "./tool-invoker.js";
import type { AgentSpec, ChatMessage, RunRecord, ToolManifest, ToolResult } from "./types.js";
import { newId, nowIso, toErrorMessage } from "./utils.js";

export interface StartRunOptions {
  maxIterations?: number;
  [key: string]: unknown;
}

export class RunEngine {
  constructor(
    private readonly store: Store,
    private readonly agentRegistry: AgentRegistry,
    private readonly toolRegistry: ToolRegistry,
    private readonly memory: Memory,
    private readonly llmClient: LLMClient,
    private readonly toolInvoker: ToolInvoker,
  ) {}

  async StartRun(
    agentId: string,
    initialMessages: Array<Pick<ChatMessage, "role" | "content" | "name" | "toolCallId">>,
    options: StartRunOptions = {},
  ): Promise<string> {
    const agent = await this.agentRegistry.Get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" was not found.`);
    }

    const runId = await this.store.CreateRun({
      agentId,
      status: "running",
      options: {
        ...options,
      },
    });

    for (const initialMessage of initialMessages) {
      await this.SendMessage(runId, initialMessage.role, initialMessage.content, {
        name: initialMessage.name,
        toolCallId: initialMessage.toolCallId,
      });
    }

    return runId;
  }

  async SendMessage(
    runId: string,
    role: ChatMessage["role"],
    content: string,
    extras?: { name?: string; toolCallId?: string },
  ): Promise<void> {
    const runMeta = await this.store.GetRunMeta(runId);
    if (!runMeta) {
      throw new Error(`Run "${runId}" not found.`);
    }

    const agent = await this.agentRegistry.Get(runMeta.agentId);
    if (!agent) {
      throw new Error(`Run "${runId}" references unknown agent "${runMeta.agentId}".`);
    }

    const message: ChatMessage = {
      id: newId("msg"),
      ts: nowIso(),
      role,
      content,
      name: extras?.name,
      toolCallId: extras?.toolCallId,
    };

    await this.store.AppendMessage(runId, message);
    if (agent.memory.scope !== "run") {
      await this.memory.Append(runId, agent.id, [message], agent.memory.scope);
    }

    await this.store.AppendTrace(runId, {
      ts: message.ts,
      type: "messageAdded",
      runId,
      agentId: agent.id,
      payload: {
        role: message.role,
        content: message.content,
        name: message.name,
        toolCallId: message.toolCallId,
      },
    });
  }

  async Step(runId: string): Promise<RunRecord> {
    const run = await this.store.GetRun(runId);
    if (!run) {
      throw new Error(`Run "${runId}" not found.`);
    }
    if (run.meta.status === "cancelled") {
      return run;
    }

    const agent = await this.requireAgent(run.meta.agentId);
    const manifests = await this.allowedToolManifests(agent);
    const maxIterations = this.maxIterations(run.meta.options);

    try {
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const prompt = await this.buildPrompt(runId, agent);
        const completion = await this.llmClient.Complete(prompt, manifests, agent.modelRef, {
          temperature: agent.defaults.temperature,
          maxTokens: agent.defaults.maxTokens,
        });

        if (completion.assistantMessage && completion.assistantMessage.content.trim().length > 0) {
          await this.SendMessage(runId, "assistant", completion.assistantMessage.content);
        }

        if (completion.toolCalls.length === 0) {
          await this.store.SetRunStatus(runId, "completed");
          const updated = await this.store.GetRun(runId);
          if (!updated) {
            throw new Error(`Run "${runId}" disappeared while finalizing completion.`);
          }
          return updated;
        }

        for (const toolCall of completion.toolCalls) {
          await this.store.AppendTrace(runId, {
            ts: nowIso(),
            type: "toolCallRequested",
            runId,
            agentId: agent.id,
            payload: {
              toolId: toolCall.toolId,
              toolCallId: toolCall.id,
              input: toolCall.input,
            },
          });

          const toolResult = await this.toolInvoker.Invoke(runId, agent.id, toolCall.toolId, toolCall.input);
          await this.SendMessage(runId, "tool", JSON.stringify(toolResult), {
            name: toolCall.toolId,
            toolCallId: toolCall.id,
          });
        }
      }

      await this.store.AppendTrace(runId, {
        ts: nowIso(),
        type: "error",
        runId,
        agentId: agent.id,
        payload: {
          code: "MAX_ITERATIONS_REACHED",
          message: `Run reached maxIterations=${maxIterations}.`,
        },
      });
      await this.store.SetRunStatus(runId, "error");
      const updated = await this.store.GetRun(runId);
      if (!updated) {
        throw new Error(`Run "${runId}" disappeared after max iteration failure.`);
      }
      return updated;
    } catch (error) {
      await this.store.AppendTrace(runId, {
        ts: nowIso(),
        type: "error",
        runId,
        agentId: agent.id,
        payload: {
          code: "RUN_STEP_FAILED",
          message: toErrorMessage(error),
          details: error instanceof Error ? error.stack : undefined,
        },
      });
      await this.store.SetRunStatus(runId, "error");
      const updated = await this.store.GetRun(runId);
      if (!updated) {
        throw new Error(`Run "${runId}" disappeared after step error.`);
      }
      return updated;
    }
  }

  async Cancel(runId: string): Promise<void> {
    const run = await this.store.GetRun(runId);
    if (!run) {
      throw new Error(`Run "${runId}" not found.`);
    }
    await this.store.SetRunStatus(runId, "cancelled");
    await this.store.AppendTrace(runId, {
      ts: nowIso(),
      type: "error",
      runId,
      agentId: run.meta.agentId,
      payload: {
        code: "RUN_CANCELLED",
        message: "Run was cancelled.",
      },
    });
  }

  private async requireAgent(agentId: string): Promise<AgentSpec> {
    const agent = await this.agentRegistry.Get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" was not found.`);
    }
    return agent;
  }

  private async allowedToolManifests(agent: AgentSpec): Promise<ToolManifest[]> {
    const manifests: ToolManifest[] = [];
    for (const toolId of agent.allowedTools) {
      const tool = await this.toolRegistry.Get(toolId);
      if (!tool) {
        continue;
      }
      manifests.push({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
    return manifests;
  }

  private async buildPrompt(runId: string, agent: AgentSpec): Promise<ChatMessage[]> {
    const run = await this.store.GetRun(runId);
    if (!run) {
      throw new Error(`Run "${runId}" not found while building prompt.`);
    }

    const context = agent.memory.scope === "run" ? [] : await this.memory.GetContext(runId, agent.id, agent.memory.scope);
    const systemPrompt: ChatMessage = {
      id: newId("sys"),
      ts: nowIso(),
      role: "system",
      content: agent.systemPrompt,
    };

    return [systemPrompt, ...context, ...run.messages];
  }

  private maxIterations(options: Record<string, unknown> | undefined): number {
    const candidate = options?.maxIterations;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 1) {
      return Math.floor(candidate);
    }
    return 5;
  }
}

export function toolResultToMessage(result: ToolResult): string {
  return JSON.stringify(result);
}
