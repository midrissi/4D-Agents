# ORDAMind — 4D Agentic AI Framework

ORDAMind is a 4D component for building agentic AI applications: **agents** (LLM-backed with tools), **workflows** (multi-step pipelines), **scorers** (evaluation), and **storage/observability**. It uses [4D AIKit](https://github.com/4d/4D-AIKit) for OpenAI chat and tools, and exposes an Express-like HTTP API via **On Web Connection**.

---

## Requirements

- **4D** (compatible with your 4D version)
- **4D AIKit** — add it as a component dependency (see below). Configure your OpenAI API key in the host project.

---

## Installation

1. **Add the ORDAMind component** to your 4D project (e.g. place it in `Components` or link it).
2. **Declare the AIKit dependency** in your host project’s `Project/Sources/dependencies.json`:

```json
{
  "dependencies": {
    "4D AIKit_local": {}
  }
}
```

Adjust the key if you use a different AIKit component name (e.g. `"4D AIKit": {}`).

3. **Configure OpenAI** in your host (API key, base URL if needed) as required by 4D AIKit.

---

## Quick start

1. Create the **App** (mind) with at least one agent; add tools, workflows, and storage as needed.
2. Call **`start()`** so the router is created and routes are registered.
3. In **On Web Connection**, forward `/api` requests to the router.

```4d
// e.g. in a startup method or first run
var $mind : cs.ORDAMind.App
$mind:=cs.ORDAMind.App.new(New object(
  "agents"; New object(
    "assistant"; cs.ORDAMind.Agent.new(New object(
      "id"; "assistant";
      "name"; "Assistant";
      "instructions"; "You are a helpful assistant.";
      "model"; "gpt-4o-mini"
    ))
  );
  "workflows"; New object;
  "tools"; New object;
  "storage"; Null;
  "logger"; cs.ORDAMind.Logger.new(New object("name"; "ORDAMind"; "level"; "info"))
))
$mind.start(New object("port"; 80; "host"; "0.0.0.0"))

// Store $mind in a process variable or shared object so On Web Connection can use it
```

```4d
// On Web Connection
If (Position("/api"; $url)=1)
  $mind.getRouter().handle($url; $header)
  Return
End if
```

---

## Core concepts

| Concept | Class | Purpose |
|--------|--------|---------|
| **App (mind)** | `cs.ORDAMind.App` | Root: holds agents, workflows, tools, scorers, storage, logger, observability; creates router on `start()`. |
| **Agent** | `cs.ORDAMind.Agent` | LLM-backed agent (instructions, model, tools). Uses 4D AIKit `OpenAIChatHelper`. |
| **Tool** | `cs.ORDAMind.Tool` | Callable by agents: name, description, parameters (JSON Schema), handler. |
| **Workflow** | `cs.ORDAMind.Workflow` | Pipeline of steps: `.then()`, `.parallel()`, `.branch()`. |
| **Step** | `cs.ORDAMind.Step` | Single step: `execute` = 4D Formula or object with `run`/`execute`. |
| **Scorer** | `cs.ORDAMind.Scorer` | LLM-based evaluation (score + reason). |
| **Storage** | `cs.ORDAMind.StorageBase` | Abstract persistence; you implement (e.g. ORDA, file). |
| **Logger** | `cs.ORDAMind.Logger` | Optional logging (e.g. LOG EVENT). |
| **Observability** | `cs.ORDAMind.Observability` | Traces/spans; can persist via storage. |

---

## Agents

Create agents with id, name, system instructions, model, and optional tools.

```4d
var $agent : cs.ORDAMind.Agent
$agent:=cs.ORDAMind.Agent.new(New object(
  "id"; "weather-agent";
  "name"; "Weather Assistant";
  "instructions"; "You help users get weather. Use the get_weather tool when needed.";
  "model"; "gpt-4o-mini";
  "tools"; $myWeatherTools  // Collection of cs.ORDAMind.Tool
))

// Register in mind config
var $agents : Object
$agents:=New object("weather-agent"; $agent)
// Pass $agents as config.agents to cs.ORDAMind.App.new(...)
```

- **Prompt (one-shot):** `$result:=$agent.prompt("What's the weather in Paris?")`  
  Use `$result.choice.message.content` and `$result.success`.
- **Stream:** Use `$agent.stream($messages; $parameters)` with `onData` / `onTerminate` in parameters.

Agents use 4D AIKit’s `OpenAI` and `OpenAIChatHelper`; you can pass a shared `client` in config to reuse one client.

---

## Tools

Tools are functions the agent can call. Define **name**, **description**, **parameters** (JSON Schema), and a **handler** (4D Formula or object with a callable).

```4d
var $tool : cs.ORDAMind.Tool
$tool:=cs.ORDAMind.Tool.new(New object(
  "id"; "get_weather";
  "name"; "get_weather";
  "description"; "Get current weather for a location.";
  "parameters"; New object(
    "type"; "object";
    "properties"; New object(
      "location"; New object("type"; "string"; "description"; "City or place name")
    );
    "required"; New collection("location")
  );
  "handler"; Formula(MyGetWeather(This; $1))  // $1 = parsed input object
))
```

Handler signature: receives the tool instance and one **Object** (parsed from the LLM tool call). Return **Text**, **Object**, or **Collection**; it will be used as the tool result for the agent.

Register tools in the agent’s `tools` collection; the agent registers each tool with `OpenAIChatHelper` via `getOpenAITool()` and `getHandler()`.

---

## Workflows

Workflows chain **steps** with `.then()`, `.parallel()`, and `.branch()`.

**Step** — config with `id`, optional `description`, and `execute`:

- **4D Formula:** `execute.call(stepInstance; $input)` → return value is the step output.
- **Object:** if it has `.run($input)` or `.execute($input)`, that is called; otherwise input is passed through.

```4d
var $step1 : cs.ORDAMind.Step
$step1:=cs.ORDAMind.Step.new(New object(
  "id"; "fetch";
  "description"; "Fetch data";
  "execute"; Formula(MyFetchStep(This; $1))
))

var $step2 : cs.ORDAMind.Step
$step2:=cs.ORDAMind.Step.new(New object(
  "id"; "format";
  "execute"; Formula(MyFormatStep(This; $1))
))

var $workflow : cs.ORDAMind.Workflow
$workflow:=cs.ORDAMind.Workflow.new(New object("id"; "my-pipeline"; "name"; "My Pipeline"))
$workflow.then($step1).then($step2)
```

- **`.then($step)`** — runs one step; its return value is the input to the next.
- **`.parallel($steps)`** — runs a collection of steps; next step receives an object keyed by step id.
- **`.branch($branches)`** — each branch is e.g. `[condition Formula, step]`; first condition that returns true runs that step.

Run the workflow with **`$workflow.run($input)`**. The router injects the app into the run input so steps can call `$input._mind.getAgent(...)` etc. if needed.

Register workflows in the mind config: `config.workflows` = object with workflow id as key.

---

## Storage

Implement **`cs.ORDAMind.StorageBase`** for your persistence (ORDA, file, etc.). Required methods:

- `createAgent($agent)` → Object
- `getAgentById($id)` → Object
- `listAgents()` → Collection
- `saveScore($scorerId; $runInput; $runOutput; $score; $reason)` → Object
- `saveTrace($trace)` → Object
- `getTrace($traceId)` → Object
- `listTraces($filters)` → Collection

Pass your instance as **`config.storage`** to `cs.ORDAMind.App.new()`.

---

## HTTP API (router)

After **`$mind.start(...)`**, **`$mind.getRouter().handle($url; $header)`** serves these routes (prefix `/api`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:agentId` | Get agent |
| POST | `/api/agents/:agentId/generate` | Body: `{"message":"..."}` or `{"prompt":"..."}` → agent response |
| GET | `/api/agents/:agentId/tools` | List agent tools |
| POST | `/api/agents/:agentId/tools/:toolId/execute` | Execute tool (body: `input` or full body as input) |
| GET | `/api/workflows` | List workflows |
| GET | `/api/workflows/:workflowId` | Get workflow |
| POST | `/api/workflows/:workflowId/create-run` | Run workflow (body: `input` or body as input) |
| GET | `/api/tools` | List global tools |
| POST | `/api/tools/:toolId/execute` | Execute global tool |
| GET | `/api/telemetry/traces` | List traces (if storage provided) |
| GET | `/api/telemetry/traces/:traceId` | Get trace |
| GET | `/api/scorers` | List scorers |
| POST | `/api/a2a` | A2A JSON-RPC endpoint |
| GET | `/api/a2a/cards` | A2A agent cards |

Requests are parsed from **WEB GET HTTP HEADER** and **WEB GET HTTP BODY**; the router expects **X-METHOD** and **X-URL** (or equivalent) to be set by your web server so it can route correctly.

---

## A2A (Agent-to-Agent)

ORDAMind supports the [A2A protocol](https://a2a-protocol.org/) (JSON-RPC 2.0 over HTTP). Use **POST /api/a2a** for requests and **GET /api/a2a/cards** for agent discovery cards.

---

## Optional: Logger and observability

- **Logger:** `config.logger:=cs.ORDAMind.Logger.new(New object("name"; "ORDAMind"; "level"; "info"))`  
  Levels: `debug`, `info`, `warn`, `error`.

- **Observability:** `config.observability:=cs.ORDAMind.Observability.new(New object("storage"; $storage))`  
  Use `startTrace`, `startSpan`, `endSpan`, `recordEvent`, `endTrace`; traces are saved via storage when available.

---

## Scorers

**`cs.ORDAMind.Scorer`** runs LLM-based evaluation: preprocess run input/output, call the LLM with instructions and optional JSON schema, then compute score and reason. Register in **`config.scorers`** (object keyed by scorer id). The storage interface stores scores via `saveScore`.

---

## Summary

1. Add ORDAMind and 4D AIKit to your project; set OpenAI config.
2. Build agents (with optional tools), workflows (with steps), and optionally storage, logger, observability, scorers.
3. Instantiate **`cs.ORDAMind.App`** with that config (e.g. **`cs.ORDAMind.App.new($config)`**) and call **`start($settings)`**.
4. In **On Web Connection**, if the URL starts with `/api`, call **`$mind.getRouter().handle($url; $header)`**.

For a full sample (weather agent, workflow, storage), see the **my-ordamind-app** host project if available in your workspace.
