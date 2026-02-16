import path from "node:path";
import { DATA_ROOT, readJsonFile, writeJsonFile } from "./utils.js";

export class Config {
  private readonly configPath: string;
  private state: Record<string, unknown>;

  constructor(configPath = path.join(DATA_ROOT, "runtime-config.json")) {
    this.configPath = configPath;
    this.state = {};
  }

  async Load(): Promise<Record<string, unknown>> {
    this.state = (await readJsonFile<Record<string, unknown>>(this.configPath)) ?? {};
    return { ...this.state };
  }

  Get<T = unknown>(key: string): T | undefined {
    return this.state[key] as T | undefined;
  }

  async Set(key: string, value: unknown): Promise<void> {
    this.state[key] = value;
    await writeJsonFile(this.configPath, this.state);
  }
}
