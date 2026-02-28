import { describe, expect, it } from "vitest";
import { SchemaValidator } from "../src/schema-validator.js";
import type { AgentSpec, ToolSpec } from "../src/types.js";

const VALID_AGENT: AgentSpec = {
  id: "6bf218cb-5f9b-4373-a67c-aa14a2d47d81",
  name: "Test Agent",
  description: "Validation test agent",
  systemPrompt: "You are a test assistant.",
  modelRef: {
    provider: "mock",
    model: "mock-model",
    apiKeyRef: "mock-key",
  },
  defaults: {
    temperature: 0.1,
    maxTokens: 256,
  },
  allowedTools: ["sum_tool"],
  memory: {
    scope: "run",
    retentionDays: 7,
  },
  policies: {
    allowExternalHttp: false,
    allowA2A: true,
    piiMode: "off",
  },
};

const VALID_TOOL: ToolSpec = {
  id: "sum_tool",
  name: "Sum Tool",
  description: "Adds two numbers.",
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
  },
  timeouts: {
    ms: 500,
  },
};

describe("SchemaValidator", () => {
  it("validates AgentSpec and ToolSpec", () => {
    const validator = new SchemaValidator();

    const agentResult = validator.ValidateAgent(VALID_AGENT);
    const toolResult = validator.ValidateTool(VALID_TOOL);

    expect(agentResult.ok).toBe(true);
    expect(toolResult.ok).toBe(true);
  });

  it("reports errors on invalid specs", () => {
    const validator = new SchemaValidator();

    const badAgent = {
      ...VALID_AGENT,
      id: "not-a-uuid",
    };

    const badTool = {
      ...VALID_TOOL,
      binding: {
        type: "4dMethod",
        method: "wrong-method-prefix",
      },
    };

    expect(validator.ValidateAgent(badAgent as AgentSpec).ok).toBe(false);
    expect(validator.ValidateTool(badTool as ToolSpec).ok).toBe(false);
  });

  it("validates tool payloads and A2A envelopes", () => {
    const validator = new SchemaValidator();
    const inputOk = validator.ValidateToolInput(VALID_TOOL, { a: 1, b: 2 });
    const outputOk = validator.ValidateToolOutput(VALID_TOOL, { ok: true, data: { sum: 3 } });
    const outputFail = validator.ValidateToolOutput(VALID_TOOL, { ok: false });
    const envelope = validator.ValidateEnvelope({
      id: "6bf218cb-5f9b-4373-a67c-aa14a2d47d81",
      ts: new Date().toISOString(),
      fromAgentId: "a",
      toAgentId: "b",
      type: "message",
      payload: {
        text: "hello",
      },
    });

    expect(inputOk.ok).toBe(true);
    expect(outputOk.ok).toBe(true);
    expect(outputFail.ok).toBe(false);
    expect(envelope.ok).toBe(true);
  });
});
