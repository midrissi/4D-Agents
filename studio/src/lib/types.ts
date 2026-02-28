export type MemoryScope = "run" | "agent" | "global";
export type PiiMode = "off" | "redact" | "block";
export type RunStatus = "running" | "completed" | "cancelled" | "error";
export type RunTraceEventType =
  | "messageAdded"
  | "toolCallRequested"
  | "toolCallStarted"
  | "toolCallFinished"
  | "error";

export interface AgentSpec {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelRef: {
    provider: string;
    model: string;
    endpoint?: string;
    apiKeyRef: string;
  };
  defaults: {
    temperature: number;
    maxTokens: number;
  };
  allowedTools: string[];
  memory: {
    scope: MemoryScope;
    retentionDays: number;
  };
  policies: {
    allowExternalHttp: boolean;
    allowA2A: boolean;
    piiMode: PiiMode;
  };
}

export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | boolean;
  outputSchema: Record<string, unknown> | boolean;
  binding: {
    type: "4dMethod";
    method: string;
  };
  permissions: {
    requiresApproval: boolean;
    agentAllowlist?: string[];
  };
  timeouts: {
    ms: number;
  };
}

export interface ChatMessage {
  id: string;
  ts: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface RunTraceEvent {
  ts: string;
  type: RunTraceEventType;
  runId: string;
  agentId: string;
  payload: Record<string, unknown>;
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

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ToolResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RpcRequest<TParams = unknown> {
  id: string;
  method: string;
  params: TParams;
}

export interface RpcResponse<TResult = unknown> {
  id: string;
  result?: TResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
