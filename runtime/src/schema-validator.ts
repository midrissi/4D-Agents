import Ajv2020Module from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";
import agentSchema from "./schemas/agent.schema.json" with { type: "json" };
import toolSchema from "./schemas/tool.schema.json" with { type: "json" };
import peerSchema from "./schemas/peer.schema.json" with { type: "json" };
import runTraceEventSchema from "./schemas/run-trace-event.schema.json" with { type: "json" };
import a2aEnvelopeSchema from "./schemas/a2a-envelope.schema.json" with { type: "json" };
import type { AgentSpec, A2AEnvelope, PeerSpec, ToolSpec, ValidationResult } from "./types.js";

const Ajv2020Constructor = Ajv2020Module as unknown as new (options?: Record<string, unknown>) => {
  compile: <TSchema = unknown>(schema: unknown) => ValidateFunction<TSchema>;
};
const addFormats = addFormatsModule as unknown as (ajv: unknown) => void;

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const at = error.instancePath || "/";
    return `${at} ${error.message ?? "validation error"}`.trim();
  });
}

function toValidationResult(isValid: boolean, validate: ValidateFunction): ValidationResult {
  return {
    ok: isValid,
    errors: isValid ? [] : formatErrors(validate.errors),
  };
}

export class SchemaValidator {
  private readonly ajv: {
    compile: <TSchema = unknown>(schema: unknown) => ValidateFunction<TSchema>;
  };
  private readonly validateAgentSpec: ValidateFunction<AgentSpec>;
  private readonly validateToolSpec: ValidateFunction<ToolSpec>;
  private readonly validatePeerSpec: ValidateFunction<PeerSpec>;
  private readonly validateTraceEvent: ValidateFunction;
  private readonly validateA2AEnvelope: ValidateFunction<A2AEnvelope>;
  private readonly dynamicValidatorCache: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv2020Constructor({ allErrors: true, strict: true });
    addFormats(this.ajv);
    this.dynamicValidatorCache = new Map();

    this.validateAgentSpec = this.ajv.compile<AgentSpec>(agentSchema);
    this.validateToolSpec = this.ajv.compile<ToolSpec>(toolSchema);
    this.validatePeerSpec = this.ajv.compile<PeerSpec>(peerSchema);
    this.validateTraceEvent = this.ajv.compile(runTraceEventSchema);
    this.validateA2AEnvelope = this.ajv.compile<A2AEnvelope>(a2aEnvelopeSchema);
  }

  ValidateAgent(agentSpec: AgentSpec): ValidationResult {
    const isValid = this.validateAgentSpec(agentSpec);
    return toValidationResult(isValid, this.validateAgentSpec);
  }

  ValidateTool(toolSpec: ToolSpec): ValidationResult {
    const isValid = this.validateToolSpec(toolSpec);
    return toValidationResult(isValid, this.validateToolSpec);
  }

  ValidatePeer(peerSpec: PeerSpec): ValidationResult {
    const isValid = this.validatePeerSpec(peerSpec);
    return toValidationResult(isValid, this.validatePeerSpec);
  }

  ValidateTraceEvent(event: unknown): ValidationResult {
    const isValid = this.validateTraceEvent(event);
    return toValidationResult(isValid, this.validateTraceEvent);
  }

  ValidateToolInput(toolSpec: ToolSpec, input: unknown): ValidationResult {
    const validator = this.getDynamicValidator(`tool_input_${toolSpec.id}`, toolSpec.inputSchema);
    const isValid = validator(input);
    return toValidationResult(isValid, validator);
  }

  ValidateToolOutput(toolSpec: ToolSpec, output: unknown): ValidationResult {
    const validator = this.getDynamicValidator(`tool_output_${toolSpec.id}`, toolSpec.outputSchema);
    const isValid = validator(output);
    return toValidationResult(isValid, validator);
  }

  ValidateEnvelope(envelope: A2AEnvelope): ValidationResult {
    const isValid = this.validateA2AEnvelope(envelope);
    return toValidationResult(isValid, this.validateA2AEnvelope);
  }

  private getDynamicValidator(cacheKey: string, schema: Record<string, unknown> | boolean): ValidateFunction {
    const cached = this.dynamicValidatorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const validator = this.ajv.compile(schema);
    this.dynamicValidatorCache.set(cacheKey, validator);
    return validator;
  }
}
