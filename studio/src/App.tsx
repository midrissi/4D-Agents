import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { fourDStubForTool, newAgentSpec, newToolSpec } from "./lib/defaults";
import { createRpcClient } from "./lib/rpc";
import type { AgentSpec, ChatMessage, RunMeta, RunRecord, ToolResult, ToolSpec } from "./lib/types";
import { parseJsonText, StudioValidator } from "./lib/validator";

type Tab = "agents" | "tools" | "run";

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function App() {
  const rpc = useMemo(() => createRpcClient(), []);
  const validator = useMemo(() => new StudioValidator(), []);
  const [tab, setTab] = useState<Tab>("agents");

  const [agents, setAgents] = useState<AgentSpec[]>([]);
  const [tools, setTools] = useState<ToolSpec[]>([]);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [status, setStatus] = useState<string>("");

  const [agentEditor, setAgentEditor] = useState<string>(pretty(newAgentSpec()));
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const [toolEditor, setToolEditor] = useState<string>(pretty(newToolSpec()));
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [toolSampleInput, setToolSampleInput] = useState<string>('{"example":"value"}');
  const [toolTestOutput, setToolTestOutput] = useState<string>("");
  const [toolStubOutput, setToolStubOutput] = useState<string>("");
  const [toolTestAgentId, setToolTestAgentId] = useState<string>("");

  const [runAgentId, setRunAgentId] = useState<string>("");
  const [runInput, setRunInput] = useState<string>("Hello");
  const [runId, setRunId] = useState<string>("");
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const [traceFilter, setTraceFilter] = useState<string>("all");

  useEffect(() => {
    void refreshAll();
  }, []);

  async function refreshAll(): Promise<void> {
    try {
      const [agentList, toolList, runList] = await Promise.all([
        rpc.call<AgentSpec[]>("agents.list", {}),
        rpc.call<ToolSpec[]>("tools.list", {}),
        rpc.call<RunMeta[]>("runs.list", {}),
      ]);
      setAgents(agentList);
      setTools(toolList);
      setRuns(runList);
      if (!selectedAgentId && agentList.length > 0) {
        setSelectedAgentId(agentList[0].id);
        setAgentEditor(pretty(agentList[0]));
      }
      if (!toolTestAgentId && agentList.length > 0) {
        setToolTestAgentId(agentList[0].id);
      }
      if (!runAgentId && agentList.length > 0) {
        setRunAgentId(agentList[0].id);
      }
      if (!selectedToolId && toolList.length > 0) {
        setSelectedToolId(toolList[0].id);
        setToolEditor(pretty(toolList[0]));
      }
      setStatus("Loaded latest agents, tools, and runs.");
    } catch (error) {
      setStatus(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function loadAgentIntoEditor(agentId: string): void {
    const found = agents.find((agent) => agent.id === agentId);
    if (!found) {
      return;
    }
    setSelectedAgentId(agentId);
    setAgentEditor(pretty(found));
  }

  function loadToolIntoEditor(toolId: string): void {
    const found = tools.find((tool) => tool.id === toolId);
    if (!found) {
      return;
    }
    setSelectedToolId(toolId);
    setToolEditor(pretty(found));
  }

  async function saveAgent(): Promise<void> {
    const parsed = parseJsonText<AgentSpec>(agentEditor);
    if (!parsed.ok) {
      setStatus(`Agent JSON parse error: ${parsed.error}`);
      return;
    }
    const validation = validator.validateAgent(parsed.value);
    if (!validation.ok) {
      setStatus(`AgentSpec validation errors:\n${validation.errors.join("\n")}`);
      return;
    }
    await rpc.call<AgentSpec, AgentSpec>("agents.upsert", parsed.value);
    await refreshAll();
    setSelectedAgentId(parsed.value.id);
    setStatus(`Saved agent ${parsed.value.id}.`);
  }

  async function deleteAgent(agentId: string): Promise<void> {
    await rpc.call("agents.delete", { agentId });
    if (selectedAgentId === agentId) {
      const replacement = newAgentSpec();
      setAgentEditor(pretty(replacement));
      setSelectedAgentId("");
    }
    await refreshAll();
    setStatus(`Deleted agent ${agentId}.`);
  }

  async function saveTool(): Promise<void> {
    const parsed = parseJsonText<ToolSpec>(toolEditor);
    if (!parsed.ok) {
      setStatus(`Tool JSON parse error: ${parsed.error}`);
      return;
    }
    const validation = validator.validateTool(parsed.value);
    if (!validation.ok) {
      setStatus(`ToolSpec validation errors:\n${validation.errors.join("\n")}`);
      return;
    }
    await rpc.call<ToolSpec, ToolSpec>("tools.upsert", parsed.value);
    await refreshAll();
    setSelectedToolId(parsed.value.id);
    setStatus(`Saved tool ${parsed.value.id}.`);
  }

  async function deleteTool(toolId: string): Promise<void> {
    await rpc.call("tools.delete", { toolId });
    if (selectedToolId === toolId) {
      setToolEditor(pretty(newToolSpec()));
      setSelectedToolId("");
    }
    await refreshAll();
    setStatus(`Deleted tool ${toolId}.`);
  }

  async function testTool(): Promise<void> {
    const parsedTool = parseJsonText<ToolSpec>(toolEditor);
    if (!parsedTool.ok) {
      setStatus(`Tool JSON parse error: ${parsedTool.error}`);
      return;
    }
    const parsedInput = parseJsonText<unknown>(toolSampleInput);
    if (!parsedInput.ok) {
      setStatus(`Tool input JSON parse error: ${parsedInput.error}`);
      return;
    }
    const toolValidation = validator.validateTool(parsedTool.value);
    if (!toolValidation.ok) {
      setStatus(`Cannot test: invalid ToolSpec.\n${toolValidation.errors.join("\n")}`);
      return;
    }
    const inputValidation = validator.validateToolInput(parsedTool.value, parsedInput.value);
    if (!inputValidation.ok) {
      setStatus(`Tool input validation failed:\n${inputValidation.errors.join("\n")}`);
      return;
    }

    const startedAt = performance.now();
    const result = await rpc.call<ToolResult>("tools.invoke", {
      runId: "studio_tool_harness",
      agentId: toolTestAgentId || "studio-agent",
      toolId: parsedTool.value.id,
      input: parsedInput.value,
    });
    const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;

    const outputValidation = validator.validateToolOutput(parsedTool.value, result);
    const report = {
      elapsedMs,
      result,
      outputValidation,
    };
    setToolTestOutput(pretty(report));
    if (outputValidation.ok) {
      setStatus(`Tool test completed in ${elapsedMs}ms.`);
    } else {
      setStatus(`Tool returned payload failing output schema in ${elapsedMs}ms.`);
    }
  }

  function generateStub(): void {
    const parsed = parseJsonText<ToolSpec>(toolEditor);
    if (!parsed.ok) {
      setStatus(`Tool JSON parse error: ${parsed.error}`);
      return;
    }
    setToolStubOutput(fourDStubForTool(parsed.value));
    setStatus(`Generated 4D stub for ${parsed.value.id}.`);
  }

  async function startRun(): Promise<void> {
    if (!runAgentId) {
      setStatus("Select an agent before starting a run.");
      return;
    }
    const initialMessages: ChatMessage[] = runInput.trim()
      ? [
          {
            id: uuidv4(),
            ts: new Date().toISOString(),
            role: "user",
            content: runInput,
          },
        ]
      : [];
    const startedRunId = await rpc.call<string>("runs.start", {
      agentId: runAgentId,
      initialMessages,
      options: {
        maxIterations: 5,
      },
    });
    setRunId(startedRunId);
    const loaded = await rpc.call<RunRecord | null>("runs.get", { runId: startedRunId });
    setRunRecord(loaded);
    await refreshAll();
    setStatus(`Started run ${startedRunId}.`);
  }

  async function sendRunMessage(): Promise<void> {
    if (!runId || !runInput.trim()) {
      setStatus("Set an active run and a message before sending.");
      return;
    }
    await rpc.call("runs.send", {
      runId,
      role: "user",
      content: runInput,
    });
    const loaded = await rpc.call<RunRecord | null>("runs.get", { runId });
    setRunRecord(loaded);
    setRunInput("");
    setStatus(`Sent message to run ${runId}.`);
  }

  async function stepRun(): Promise<void> {
    if (!runId) {
      setStatus("Start or select a run before stepping.");
      return;
    }
    const stepped = await rpc.call<RunRecord>("runs.step", { runId });
    setRunRecord(stepped);
    await refreshAll();
    setStatus(`Stepped run ${runId}.`);
  }

  async function cancelRun(): Promise<void> {
    if (!runId) {
      return;
    }
    await rpc.call("runs.cancel", { runId });
    const loaded = await rpc.call<RunRecord | null>("runs.get", { runId });
    setRunRecord(loaded);
    await refreshAll();
    setStatus(`Cancelled run ${runId}.`);
  }

  async function openRun(selectedRunId: string): Promise<void> {
    setRunId(selectedRunId);
    const loaded = await rpc.call<RunRecord | null>("runs.get", { runId: selectedRunId });
    setRunRecord(loaded);
  }

  const filteredTrace =
    runRecord?.trace.filter((event) => (traceFilter === "all" ? true : event.type === traceFilter)) ?? [];

  return (
    <div className="app-shell">
      <header>
        <h1>4D Agents Studio</h1>
        <p>Embedded Agent Studio for agents, tools, runs, and trace debugging.</p>
      </header>

      <nav className="tabs">
        <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>
          Agents
        </button>
        <button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}>
          Tools
        </button>
        <button className={tab === "run" ? "active" : ""} onClick={() => setTab("run")}>
          Run / Debug
        </button>
        <button onClick={() => void refreshAll()}>Refresh</button>
      </nav>

      <section className="status">{status}</section>

      {tab === "agents" && (
        <section className="panel-grid">
          <aside className="side-list">
            <h2>Agents</h2>
            <button
              onClick={() => {
                const draft = newAgentSpec();
                setSelectedAgentId("");
                setAgentEditor(pretty(draft));
              }}
            >
              New Agent
            </button>
            <ul>
              {agents.map((agent) => (
                <li key={agent.id} className={selectedAgentId === agent.id ? "selected" : ""}>
                  <button onClick={() => loadAgentIntoEditor(agent.id)}>{agent.name}</button>
                  <button className="danger" onClick={() => void deleteAgent(agent.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="editor">
            <h2>AgentSpec Editor</h2>
            <textarea value={agentEditor} onChange={(event) => setAgentEditor(event.target.value)} />
            <div className="row">
              <button onClick={() => void saveAgent()}>Validate + Save Agent</button>
            </div>
          </div>
        </section>
      )}

      {tab === "tools" && (
        <section className="panel-grid">
          <aside className="side-list">
            <h2>Tools</h2>
            <button
              onClick={() => {
                const draft = newToolSpec();
                setSelectedToolId("");
                setToolEditor(pretty(draft));
              }}
            >
              New Tool
            </button>
            <ul>
              {tools.map((tool) => (
                <li key={tool.id} className={selectedToolId === tool.id ? "selected" : ""}>
                  <button onClick={() => loadToolIntoEditor(tool.id)}>{tool.name}</button>
                  <button className="danger" onClick={() => void deleteTool(tool.id)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="editor">
            <h2>ToolSpec Editor</h2>
            <textarea value={toolEditor} onChange={(event) => setToolEditor(event.target.value)} />
            <div className="row">
              <button onClick={() => void saveTool()}>Validate + Save Tool</button>
              <button onClick={() => void generateStub()}>Generate 4D Stub</button>
            </div>

            <h3>Tool Test Harness</h3>
            <label>
              Agent for test execution
              <select value={toolTestAgentId} onChange={(event) => setToolTestAgentId(event.target.value)}>
                <option value="">studio-agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Input JSON</label>
            <textarea value={toolSampleInput} onChange={(event) => setToolSampleInput(event.target.value)} />
            <button onClick={() => void testTool()}>Run Tool Test</button>
            <label>Harness Output (validation + timing)</label>
            <pre>{toolTestOutput}</pre>
            <label>Generated 4D Stub</label>
            <pre>{toolStubOutput}</pre>
          </div>
        </section>
      )}

      {tab === "run" && (
        <section className="run-layout">
          <aside className="side-list">
            <h2>Runs</h2>
            <ul>
              {runs.map((run) => (
                <li key={run.runId} className={runId === run.runId ? "selected" : ""}>
                  <button onClick={() => void openRun(run.runId)}>
                    {run.runId.slice(0, 8)} - {run.status}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="editor">
            <h2>Run / Debug</h2>
            <div className="row">
              <label>
                Agent
                <select value={runAgentId} onChange={(event) => setRunAgentId(event.target.value)}>
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => void startRun()}>Start Run</button>
              <button onClick={() => void stepRun()}>Step</button>
              <button className="danger" onClick={() => void cancelRun()}>
                Cancel
              </button>
            </div>

            <div className="row">
              <textarea value={runInput} onChange={(event) => setRunInput(event.target.value)} />
              <button onClick={() => void sendRunMessage()}>Send Message</button>
            </div>

            <h3>Chat</h3>
            <div className="chat">
              {(runRecord?.messages ?? []).map((message) => (
                <article key={message.id} className={`chat-message role-${message.role}`}>
                  <strong>{message.role}</strong>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>

            <h3>Trace</h3>
            <label>
              Filter
              <select value={traceFilter} onChange={(event) => setTraceFilter(event.target.value)}>
                <option value="all">all</option>
                <option value="messageAdded">messageAdded</option>
                <option value="toolCallRequested">toolCallRequested</option>
                <option value="toolCallStarted">toolCallStarted</option>
                <option value="toolCallFinished">toolCallFinished</option>
                <option value="error">error</option>
              </select>
            </label>
            <div className="trace">
              {filteredTrace.map((event, idx) => (
                <details key={`${event.ts}-${idx}`} open={idx === filteredTrace.length - 1}>
                  <summary>
                    {event.ts} | {event.type}
                  </summary>
                  <pre>{pretty(event.payload)}</pre>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
