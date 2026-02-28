import Ajv2020Module from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import addFormatsModule from "ajv-formats";
import agentSchema from "../schemas/agent.schema.json";
import toolSchema from "../schemas/tool.schema.json";
import a2aEnvelopeSchema from "../schemas/a2a-envelope.schema.json";
import type { AgentSpec, ToolSpec, ValidationResult } from "./types";

const Ajv2020Constructor = Ajv2020Module as unknown as new (options?: Record<string, unknown>) => {
  compile: <TSchema = unknown>(schema: unknown) => (data: unknown) => boolean;
  errors?: ErrorObject[] | null;
};
const addFormats = addFormatsModule as unknown as (ajv: unknown) => void;

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "validation error"}`.trim());
}

export class StudioValidator {
  private readonly ajv: {
    compile: <TSchema = unknown>(schema: unknown) => (data: unknown) => boolean;
    errors?: ErrorObject[] | null;
  };

  private readonly validateAgentFn: (value: unknown) => boolean;
  private readonly validateToolFn: (value: unknown) => boolean;
  private readonly validateEnvelopeFn: (value: unknown) => boolean;
  private readonly toolInputCache: Map<string, (value: unknown) => boolean>;
  private readonly toolOutputCache: Map<string, (value: unknown) => boolean>;

  constructor() {
    this.ajv = new Ajv2020Constructor({ allErrors: true, strict: true });
    addFormats(this.ajv);
    this.validateAgentFn = this.ajv.compile(agentSchema);
    this.validateToolFn = this.ajv.compile(toolSchema);
    this.validateEnvelopeFn = this.ajv.compile(a2aEnvelopeSchema);
    this.toolInputCache = new Map();
    this.toolOutputCache = new Map();
  }

  validateAgent(spec: AgentSpec): ValidationResult {
    const ok = this.validateAgentFn(spec);
    return {
      ok,
      errors: ok ? [] : formatErrors(this.ajv.errors),
    };
  }

  validateTool(spec: ToolSpec): ValidationResult {
    const ok = this.validateToolFn(spec);
    return {
      ok,
      errors: ok ? [] : formatErrors(this.ajv.errors),
    };
  }

  validateToolInput(tool: ToolSpec, input: unknown): ValidationResult {
    const key = `${tool.id}__input`;
    const validate = this.toolInputCache.get(key) ?? this.ajv.compile(tool.inputSchema);
    this.toolInputCache.set(key, validate);
    const ok = validate(input);
    return {
      ok,
      errors: ok ? [] : formatErrors(this.ajv.errors),
    };
  }

  validateToolOutput(tool: ToolSpec, output: unknown): ValidationResult {
    const key = `${tool.id}__output`;
    const validate = this.toolOutputCache.get(key) ?? this.ajv.compile(tool.outputSchema);
    this.toolOutputCache.set(key, validate);
    const ok = validate(output);
    return {
      ok,
      errors: ok ? [] : formatErrors(this.ajv.errors),
    };
  }

  validateEnvelope(envelope: unknown): ValidationResult {
    const ok = this.validateEnvelopeFn(envelope);
    return {
      ok,
      errors: ok ? [] : formatErrors(this.ajv.errors),
    };
  }
}

export function parseJsonText<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return {
      ok: true,
      value: JSON.parse(raw) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
