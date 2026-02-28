import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AgentRegistry } from "../src/agent-registry.js";
import { LLMClient, MockProvider } from "../src/llm-client.js";
import { Memory } from "../src/memory.js";
import { RunEngine } from "../src/run-engine.js";
import { SchemaValidator } from "../src/schema-validator.js";
import { Store } from "../src/store.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { ToolInvoker } from "../src/tool-invoker.js";
import type { AgentSpec, ToolSpec } from "../src/types.js";

const AGENT_ID = "d65d8c35-df5d-4be0-bf31-cbf6b80c1ff4";

const AGENT: AgentSpec = {
  id: AGENT_ID,
  name: "Math Agent",
  description: "Runs math tools",
  systemPrompt: "You are a math assistant.",
  modelRef: {
    provider: "mock",
    model: "mock-model",
    apiKeyRef: "mock-key",
  },
  defaults: {
    temperature: 0,
    maxTokens: 128,
  },
  allowedTools: ["sum_tool"],
  memory: {
    scope: "run",
    retentionDays: 7,
  },
  policies: {
    allowExternalHttp: false,
    allowA2A: false,
    piiMode: "off",
  },
};

const TOOL: ToolSpec = {
  id: "sum_tool",
  name: "Sum Tool",
  description: "Adds two numbers",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["a", "b"],
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["ok", "data"],
    properties: {
      ok: { const: true },
      data: {
        type: "object",
        required: ["sum"],
        properties: {
          sum: { type: "number" },
        },
      },
    },
  },
  binding: {
    type: "4dMethod",
    method: "Tool_sum_tool",
  },
  permissions: {
    requiresApproval: false,
    agentAllowlist: [AGENT_ID],
  },
  timeouts: {
    ms: 500,
  },
};

describe("RunEngine", () => {
  let store: Store;
  let runEngine: RunEngine;

  beforeEach(async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "agents4d-run-engine-"));
    store = new Store(tempDir);
    const validator = new SchemaValidator();
    const agents = new AgentRegistry(store, validator);
    const tools = new ToolRegistry(store, validator);
    const memory = new Memory(store, path.join(tempDir, "memory"));
    const llm = new LLMClient({ mock: new MockProvider() });

    await agents.Upsert(AGENT);
    await tools.Upsert(TOOL);

    const toolInvoker = new ToolInvoker({
      toolRegistry: tools,
      schemaValidator: validator,
      bindingExecutor: async (_method, input) => {
        const payload = input as { a: number; b: number };
        return {
          ok: true,
          data: {
            sum: payload.a + payload.b,
          },
        };
      },
      emitTrace: async (event) => {
        await store.AppendTrace(event.runId, event);
      },
      runtimePolicy: {
        allowApprovalBypass: false,
      },
    });

    runEngine = new RunEngine(store, agents, tools, memory, llm, toolInvoker);
  });

  it("completes a run with a tool call and trace", async () => {
    const runId = await runEngine.StartRun(
      AGENT_ID,
      [
        {
          role: "user",
          content: '/tool sum_tool {"a":1,"b":2}',
        },
      ],
      {
        maxIterations: 5,
      },
    );

    const finalRun = await runEngine.Step(runId);
    expect(finalRun.meta.status).toBe("completed");

    const roles = finalRun.messages.map((message) => message.role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
    expect(roles).toContain("tool");

    const traceTypes = finalRun.trace.map((event) => event.type);
    expect(traceTypes).toContain("toolCallRequested");
    expect(traceTypes).toContain("toolCallStarted");
    expect(traceTypes).toContain("toolCallFinished");
  });
});
