import { v4 as uuidv4 } from "uuid";
import type { AgentSpec, ToolSpec } from "./types";

function normalizedToolMethod(toolId: string): string {
  return `Tool_${toolId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

export function newAgentSpec(): AgentSpec {
  return {
    id: uuidv4(),
    name: "New Agent",
    description: "Describe what this agent does.",
    systemPrompt: "You are a helpful assistant.",
    modelRef: {
      provider: "mock",
      model: "mock-model",
      apiKeyRef: "default",
    },
    defaults: {
      temperature: 0.2,
      maxTokens: 1024,
    },
    allowedTools: [],
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
}

export function newToolSpec(): ToolSpec {
  const id = "new_tool";
  return {
    id,
    name: "New Tool",
    description: "Describe what this tool does.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
      },
    },
    binding: {
      type: "4dMethod",
      method: normalizedToolMethod(id),
    },
    permissions: {
      requiresApproval: false,
    },
    timeouts: {
      ms: 10_000,
    },
  };
}

export function fourDStubForTool(tool: ToolSpec): string {
  const methodName = normalizedToolMethod(tool.id);
  const stubHeader = `// Auto-generated stub for ${tool.id}`;
  return [
    stubHeader,
    `// Method: ${methodName}`,
    "// Input is JSON text payload and output must follow {ok,data|error} shape",
    "",
    "// Example (pseudo-4D):",
    "// #DECLARE ($input : Object) -> $result : Object",
    "// var $result : Object",
    "// $result:=New object(\"ok\";True;\"data\";New object(\"echo\";$input))",
    "// $0:=$result",
  ].join("\n");
}
