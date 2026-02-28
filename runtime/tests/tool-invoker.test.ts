import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaValidator } from "../src/schema-validator.js";
import { Store } from "../src/store.js";
import { ToolInvoker } from "../src/tool-invoker.js";
import { ToolRegistry } from "../src/tool-registry.js";
import type { ToolSpec } from "../src/types.js";

const TOOL_SPEC: ToolSpec = {
  id: "sum_tool",
  name: "Sum Tool",
  description: "Adds numbers.",
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
      ok: { type: "boolean" },
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
    agentAllowlist: ["agent-1"],
  },
  timeouts: {
    ms: 250,
  },
};

describe("ToolInvoker", () => {
  let store: Store;
  let toolRegistry: ToolRegistry;
  let traces: unknown[];

  beforeEach(async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "agents4d-tool-invoker-"));
    store = new Store(tempDir);
    const validator = new SchemaValidator();
    toolRegistry = new ToolRegistry(store, validator);
    await toolRegistry.Upsert(TOOL_SPEC);
    traces = [];
    await store.CreateRun({
      runId: "run-test",
      agentId: "agent-1",
      status: "running",
    });
  });

  it("invokes tool bindings and validates output", async () => {
    const validator = new SchemaValidator();
    const invoker = new ToolInvoker({
      toolRegistry,
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
        traces.push(event);
      },
      runtimePolicy: {
        allowApprovalBypass: false,
      },
    });

    const result = await invoker.Invoke("run-test", "agent-1", "sum_tool", { a: 2, b: 3 });
    expect(result).toEqual({
      ok: true,
      data: {
        sum: 5,
      },
    });
    expect(traces.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks unauthorized agent", async () => {
    const validator = new SchemaValidator();
    const invoker = new ToolInvoker({
      toolRegistry,
      schemaValidator: validator,
      bindingExecutor: async () => ({ ok: true, data: { sum: 0 } }),
    });

    const result = await invoker.Invoke("run-test", "agent-2", "sum_tool", { a: 2, b: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_NOT_ALLOWED");
    }
  });

  it("rejects invalid input payload", async () => {
    const validator = new SchemaValidator();
    const invoker = new ToolInvoker({
      toolRegistry,
      schemaValidator: validator,
      bindingExecutor: async () => ({ ok: true, data: { sum: 0 } }),
    });

    const result = await invoker.Invoke("run-test", "agent-1", "sum_tool", { a: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_INPUT_SCHEMA");
    }
  });
});
