import { rm } from "node:fs/promises";
import path from "node:path";
import { Store } from "./store.js";
import type { ChatMessage, MemoryScope } from "./types.js";
import { DATA_ROOT, ensureDir, readJsonFile, writeJsonFile } from "./utils.js";

export class Memory {
  private readonly memoryRoot: string;

  constructor(
    private readonly store: Store,
    memoryRoot = path.join(DATA_ROOT, "memory"),
  ) {
    this.memoryRoot = memoryRoot;
  }

  async GetContext(runId: string, agentId: string, scope: MemoryScope = "run"): Promise<ChatMessage[]> {
    if (scope === "run") {
      const run = await this.store.GetRun(runId);
      return run?.messages ?? [];
    }

    if (scope === "agent") {
      return (await readJsonFile<ChatMessage[]>(this.agentMemoryPath(agentId))) ?? [];
    }

    return (await readJsonFile<ChatMessage[]>(this.globalMemoryPath())) ?? [];
  }

  async Append(runId: string, agentId: string, memoryItems: ChatMessage[], scope: MemoryScope = "run"): Promise<void> {
    if (scope === "run") {
      for (const item of memoryItems) {
        await this.store.AppendMessage(runId, item);
      }
      return;
    }

    const targetPath = scope === "agent" ? this.agentMemoryPath(agentId) : this.globalMemoryPath();
    await ensureDir(path.dirname(targetPath));
    const existing = (await readJsonFile<ChatMessage[]>(targetPath)) ?? [];
    existing.push(...memoryItems);
    await writeJsonFile(targetPath, existing);
  }

  async Clear(scope: MemoryScope, id?: string): Promise<void> {
    if (scope === "run") {
      if (!id) {
        throw new Error("Memory.Clear(run) requires a run id.");
      }
      await this.store.ReplaceRunMessages(id, []);
      return;
    }

    if (scope === "agent") {
      if (!id) {
        throw new Error("Memory.Clear(agent) requires an agent id.");
      }
      await rm(this.agentMemoryPath(id), { force: true });
      return;
    }

    await rm(this.globalMemoryPath(), { force: true });
  }

  private agentMemoryPath(agentId: string): string {
    return path.join(this.memoryRoot, "agent", `${agentId}.json`);
  }

  private globalMemoryPath(): string {
    return path.join(this.memoryRoot, "global.json");
  }
}
