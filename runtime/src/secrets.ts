import path from "node:path";
import { DATA_ROOT, readJsonFile } from "./utils.js";

export class Secrets {
  private readonly fromEnvPrefix: string;
  private readonly secretsPath: string;
  private loadedSecrets: Record<string, string> | null;

  constructor(options?: { envPrefix?: string; secretsPath?: string }) {
    this.fromEnvPrefix = options?.envPrefix ?? "AGENTS4D_SECRET_";
    this.secretsPath = options?.secretsPath ?? path.join(DATA_ROOT, "secrets.json");
    this.loadedSecrets = null;
  }

  async Resolve(keyRef: string): Promise<string> {
    const envKey = `${this.fromEnvPrefix}${keyRef}`.toUpperCase();
    const envValue = process.env[envKey];
    if (envValue) {
      return envValue;
    }

    const secrets = await this.readSecretsFile();
    const value = secrets[keyRef];
    if (!value) {
      throw new Error(`Missing required secret "${keyRef}". Run blocked.`);
    }

    return value;
  }

  private async readSecretsFile(): Promise<Record<string, string>> {
    if (this.loadedSecrets) {
      return this.loadedSecrets;
    }

    this.loadedSecrets = (await readJsonFile<Record<string, string>>(this.secretsPath)) ?? {};
    return this.loadedSecrets;
  }
}
