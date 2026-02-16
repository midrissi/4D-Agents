import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { AgentSpec, ChatMessage, RunListFilter, RunMeta, RunRecord, RunTraceEvent, RunStatus, ToolSpec } from "./types.js";
import { DATA_ROOT, appendJsonLine, ensureDir, fileExists, newId, nowIso, readJsonFile, safeJsonParse, writeJsonFile } from "./utils.js";

const AGENT_FILE_SUFFIX = ".agent.json";
const TOOL_FILE_SUFFIX = ".tool.json";

export class Store {
  private readonly rootDir: string;
  private readonly agentsDir: string;
  private readonly toolsDir: string;
  private readonly runsDir: string;

  constructor(rootDir = DATA_ROOT) {
    this.rootDir = rootDir;
    this.agentsDir = path.join(this.rootDir, "agents");
    this.toolsDir = path.join(this.rootDir, "tools");
    this.runsDir = path.join(this.rootDir, "runs");
  }

  async SaveAgent(agentSpec: AgentSpec): Promise<void> {
    await ensureDir(this.agentsDir);
    const agentPath = this.agentPath(agentSpec.id);
    await writeJsonFile(agentPath, agentSpec);
  }

  async LoadAgent(agentId: string): Promise<AgentSpec | null> {
    return readJsonFile<AgentSpec>(this.agentPath(agentId));
  }

  async ListAgents(): Promise<AgentSpec[]> {
    await ensureDir(this.agentsDir);
    const files = await readdir(this.agentsDir);
    const agents = await Promise.all(
      files
        .filter((name) => name.endsWith(AGENT_FILE_SUFFIX))
        .map((name) => readJsonFile<AgentSpec>(path.join(this.agentsDir, name))),
    );

    return agents.filter((agent): agent is AgentSpec => agent !== null).sort((a, b) => a.name.localeCompare(b.name));
  }

  async DeleteAgent(agentId: string): Promise<void> {
    await rm(this.agentPath(agentId), { force: true });
  }

  async SaveTool(toolSpec: ToolSpec): Promise<void> {
    await ensureDir(this.toolsDir);
    await writeJsonFile(this.toolPath(toolSpec.id), toolSpec);
  }

  async LoadTool(toolId: string): Promise<ToolSpec | null> {
    return readJsonFile<ToolSpec>(this.toolPath(toolId));
  }

  async ListTools(): Promise<ToolSpec[]> {
    await ensureDir(this.toolsDir);
    const files = await readdir(this.toolsDir);
    const tools = await Promise.all(
      files
        .filter((name) => name.endsWith(TOOL_FILE_SUFFIX))
        .map((name) => readJsonFile<ToolSpec>(path.join(this.toolsDir, name))),
    );

    return tools.filter((tool): tool is ToolSpec => tool !== null).sort((a, b) => a.name.localeCompare(b.name));
  }

  async DeleteTool(toolId: string): Promise<void> {
    await rm(this.toolPath(toolId), { force: true });
  }

  async CreateRun(
    runMeta: Omit<RunMeta, "runId" | "createdAt" | "updatedAt"> & Partial<Pick<RunMeta, "runId">>,
  ): Promise<string> {
    const runId = runMeta.runId ?? newId("run");
    const runDir = this.runPath(runId);
    const now = nowIso();
    const fullMeta: RunMeta = {
      runId,
      agentId: runMeta.agentId,
      status: runMeta.status,
      options: runMeta.options,
      createdAt: now,
      updatedAt: now,
    };

    await ensureDir(runDir);
    await writeJsonFile(this.runMetaPath(runId), fullMeta);
    await writeJsonFile(this.runMessagesPath(runId), []);
    await writeJsonFile(this.runTracePath(runId), []);
    await rm(this.runTraceJsonlPath(runId), { force: true });

    return runId;
  }

  async AppendTrace(runId: string, event: RunTraceEvent): Promise<void> {
    const traceJsonPath = this.runTracePath(runId);
    const trace = (await readJsonFile<RunTraceEvent[]>(traceJsonPath)) ?? [];
    trace.push(event);
    await writeJsonFile(traceJsonPath, trace);
    await appendJsonLine(this.runTraceJsonlPath(runId), event);
    await this.touchRun(runId);
  }

  async AppendMessage(runId: string, message: ChatMessage): Promise<void> {
    const messagesPath = this.runMessagesPath(runId);
    const messages = (await readJsonFile<ChatMessage[]>(messagesPath)) ?? [];
    messages.push(message);
    await writeJsonFile(messagesPath, messages);
    await this.touchRun(runId);
  }

  async ReplaceRunMessages(runId: string, messages: ChatMessage[]): Promise<void> {
    await writeJsonFile(this.runMessagesPath(runId), messages);
    await this.touchRun(runId);
  }

  async GetRunMeta(runId: string): Promise<RunMeta | null> {
    return readJsonFile<RunMeta>(this.runMetaPath(runId));
  }

  async SetRunMeta(runId: string, patch: Partial<RunMeta>): Promise<void> {
    const meta = await this.GetRunMeta(runId);
    if (!meta) {
      throw new Error(`Run ${runId} was not found.`);
    }

    const next: RunMeta = {
      ...meta,
      ...patch,
      runId: meta.runId,
      updatedAt: nowIso(),
    };

    await writeJsonFile(this.runMetaPath(runId), next);
  }

  async SetRunStatus(runId: string, status: RunStatus): Promise<void> {
    await this.SetRunMeta(runId, { status });
  }

  async GetRun(runId: string): Promise<RunRecord | null> {
    const meta = await this.GetRunMeta(runId);
    if (!meta) {
      return null;
    }

    const messages = (await readJsonFile<ChatMessage[]>(this.runMessagesPath(runId))) ?? [];
    const traceFilePath = this.runTracePath(runId);
    let trace = (await readJsonFile<RunTraceEvent[]>(traceFilePath)) ?? [];

    if (trace.length === 0 && (await fileExists(this.runTraceJsonlPath(runId)))) {
      const raw = await readFile(this.runTraceJsonlPath(runId), "utf-8");
      trace = raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => safeJsonParse<RunTraceEvent | null>(line, null))
        .filter((line): line is RunTraceEvent => line !== null);
      await writeJsonFile(traceFilePath, trace);
    }

    return {
      meta,
      messages,
      trace,
    };
  }

  async ListRuns(filter?: RunListFilter): Promise<RunMeta[]> {
    await ensureDir(this.runsDir);
    const entries = await readdir(this.runsDir, { withFileTypes: true });
    const runMetaList = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => readJsonFile<RunMeta>(this.runMetaPath(entry.name))),
    );

    let runs = runMetaList.filter((meta): meta is RunMeta => meta !== null);
    if (filter?.agentId) {
      runs = runs.filter((run) => run.agentId === filter.agentId);
    }
    if (filter?.status) {
      runs = runs.filter((run) => run.status === filter.status);
    }

    runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (filter?.limit && filter.limit > 0) {
      return runs.slice(0, filter.limit);
    }

    return runs;
  }

  private agentPath(agentId: string): string {
    return path.join(this.agentsDir, `${agentId}${AGENT_FILE_SUFFIX}`);
  }

  private toolPath(toolId: string): string {
    return path.join(this.toolsDir, `${toolId}${TOOL_FILE_SUFFIX}`);
  }

  private runPath(runId: string): string {
    return path.join(this.runsDir, runId);
  }

  private runMetaPath(runId: string): string {
    return path.join(this.runPath(runId), "meta.json");
  }

  private runMessagesPath(runId: string): string {
    return path.join(this.runPath(runId), "messages.json");
  }

  private runTracePath(runId: string): string {
    return path.join(this.runPath(runId), "trace.json");
  }

  private runTraceJsonlPath(runId: string): string {
    return path.join(this.runPath(runId), "trace.jsonl");
  }

  private async touchRun(runId: string): Promise<void> {
    const meta = await this.GetRunMeta(runId);
    if (!meta) {
      return;
    }

    await writeJsonFile(this.runMetaPath(runId), {
      ...meta,
      updatedAt: nowIso(),
    });
  }
}
