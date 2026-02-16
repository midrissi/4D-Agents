export type MemoryScope = "run" | "agent" | "global";
export type PiiMode = "off" | "redact" | "block";
export type RunStatus = "running" | "completed" | "cancelled" | "error";
export type RunTraceEventType =
  | "messageAdded"
  | "toolCallRequested"
  | "toolCallStarted"
  | "toolCallFinished"
  | "error";

export interface ModelRef {
  provider: string;
  model: string;
  endpoint?: string;
  apiKeyRef: string;
}

export interface AgentDefaults {
  temperature: number;
  maxTokens: number;
}

export interface AgentMemorySpec {
  scope: MemoryScope;
  retentionDays: number;
}

export interface AgentPolicies {
  allowExternalHttp: boolean;
  allowA2A: boolean;
  piiMode: PiiMode;
}

export interface AgentSpec {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelRef: ModelRef;
  defaults: AgentDefaults;
  allowedTools: string[];
  memory: AgentMemorySpec;
  policies: AgentPolicies;
}

export interface ToolBindingSpec {
  type: "4dMethod";
  method: string;
}

export interface ToolPermissions {
  requiresApproval: boolean;
  agentAllowlist?: string[];
}

export interface ToolTimeouts {
  ms: number;
}

export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | boolean;
  outputSchema: Record<string, unknown> | boolean;
  binding: ToolBindingSpec;
  permissions: ToolPermissions;
  timeouts: ToolTimeouts;
}

export interface PeerAuthSpec {
  type: "sharedKey" | "publicKey";
  keyRef: string;
}

export interface PeerPolicySpec {
  allowIncoming: boolean;
  allowOutgoing: boolean;
  rateLimitPerMin: number;
}

export interface PeerSpec {
  id: string;
  name: string;
  baseUrl: string;
  auth: PeerAuthSpec;
  policy: PeerPolicySpec;
}

export interface RunTraceEvent<TPayload = Record<string, unknown>> {
  ts: string;
  type: RunTraceEventType;
  runId: string;
  agentId: string;
  payload: TPayload;
}

export interface A2AEnvelope {
  id: string;
  ts: string;
  fromAgentId: string;
  toAgentId: string;
  type: "message" | "toolRequest" | "toolResult" | "capability" | "health" | "error";
  traceId?: string;
  payload: Record<string, unknown>;
  signature?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  ts: string;
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolManifest {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | boolean;
}

export interface ToolCall {
  id: string;
  toolId: string;
  input: unknown;
}

export interface ToolResultSuccess {
  ok: true;
  data: Record<string, unknown>;
}

export interface ToolResultFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ToolResult = ToolResultSuccess | ToolResultFailure;

export interface LlmCompletion {
  assistantMessage?: ChatMessage;
  toolCalls: ToolCall[];
}

export interface RunMeta {
  runId: string;
  agentId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  options?: Record<string, unknown>;
}

export interface RunRecord {
  meta: RunMeta;
  messages: ChatMessage[];
  trace: RunTraceEvent[];
}

export interface RunListFilter {
  agentId?: string;
  status?: RunStatus;
  limit?: number;
}

export interface RuntimePolicy {
  allowApprovalBypass: boolean;
}
