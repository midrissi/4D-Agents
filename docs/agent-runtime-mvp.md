# 4D Agents Framework - MVP Implementation Notes

This repository now includes an MVP implementation of the requested 4D Agents framework in two parts:

1. **Runtime core** (`/runtime`) for agent/tool execution, persistence, schema validation, traces, and RPC.
2. **Agent Studio** (`/studio`) React + TypeScript web app suitable for embedding in a 4D WebView.

## Implemented Core Specs

### Canonical JSON Schemas

Schema files are present in both runtime and studio (for parity validation):

- `agent.schema.json`
- `tool.schema.json`
- `peer.schema.json`
- `run-trace-event.schema.json`
- `a2a-envelope.schema.json`

### Runtime modules

`/runtime/src` includes:

- `config.ts` (`Load`, `Get`, `Set`)
- `secrets.ts` (`Resolve` with env/file lookup and hard failure on missing secret)
- `store.ts` (agents/tools/runs persistence with JSON + JSONL traces)
- `schema-validator.ts` (`ValidateAgent`, `ValidateTool`, `ValidateToolInput`, `ValidateToolOutput`, `ValidateEnvelope`)
- `agent-registry.ts`
- `tool-registry.ts` (including `ResolveBinding`)
- `memory.ts` (run/agent/global behavior)
- `tool-invoker.ts` (permission checks, input/output schema checks, timeout handling, trace events)
- `llm-client.ts` (`MockProvider` and `OpenAIProvider`)
- `run-engine.ts` (`StartRun`, `SendMessage`, `Step`, `Cancel`)
- `orchestrator.ts` (`Delegate`, `RunWorkflow`)
- `rpc.ts` (Studio/runtime method surface)
- `runtime.ts` (wiring and registration facade)

### Trace model

Runtime writes traces as:

- `trace.json` (array)
- `trace.jsonl` (append-only stream)

Supported MVP event types:

- `messageAdded`
- `toolCallRequested`
- `toolCallStarted`
- `toolCallFinished`
- `error`

### Test coverage

Runtime tests in `/runtime/tests` validate:

- schema validation behavior
- tool invocation pipeline and permission checks
- run loop with deterministic mock provider and tool call round trip

## Agent Studio (WebView app)

`/studio` includes:

- **Agents** screen (list/create/edit/delete with JSON schema validation before save)
- **Tools** screen (list/create/edit/delete, schema editor, test harness, 4D stub generation)
- **Run / Debug** screen (chat messages, run controls, trace viewer with filtering)

Studio-side validation is handled by AJV in `src/lib/validator.ts`.

## RPC Contract

Request format:

```json
{
  "id": "<uuid>",
  "method": "agents.upsert",
  "params": {}
}
```

Response format:

```json
{
  "id": "<uuid>",
  "result": {}
}
```

Error response:

```json
{
  "id": "<uuid>",
  "error": {
    "code": "RPC_ERROR",
    "message": "..."
  }
}
```

Implemented methods include:

- `agents.list|get|upsert|delete`
- `tools.list|get|upsert|delete|resolveBinding|invoke`
- `runs.list|get|start|send|step|cancel`
- `schemas.validateAgent|validateTool|validateEnvelope`

## 4D Component Integration Path

To embed Studio in 4D WebView and route RPC into the runtime:

1. Host built Studio assets in the 4D component.
2. Expose a bridge function in WebView:
   - `window.__AGENTS4D_RPC_HANDLER__ = async (request) => { ... }`
3. Inside the bridge, dispatch `request.method` to corresponding 4D methods/classes or to this runtime core.
4. Register actual 4D tool binding handlers (`Tool_<toolIdNormalized>`) in runtime wiring.

The Studio includes "Generate 4D Stub" output to accelerate method scaffolding for `Tool_*` handlers.
