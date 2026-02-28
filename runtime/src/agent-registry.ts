import { SchemaValidator } from "./schema-validator.js";
import { Store } from "./store.js";
import type { AgentSpec } from "./types.js";

export class AgentRegistry {
  constructor(
    private readonly store: Store,
    private readonly validator: SchemaValidator,
  ) {}

  async Upsert(agentSpec: AgentSpec): Promise<AgentSpec> {
    const validation = this.validator.ValidateAgent(agentSpec);
    if (!validation.ok) {
      throw new Error(`Invalid AgentSpec: ${validation.errors.join("; ")}`);
    }

    await this.store.SaveAgent(agentSpec);
    return agentSpec;
  }

  async Get(agentId: string): Promise<AgentSpec | null> {
    return this.store.LoadAgent(agentId);
  }

  async List(): Promise<AgentSpec[]> {
    return this.store.ListAgents();
  }

  async Delete(agentId: string): Promise<void> {
    await this.store.DeleteAgent(agentId);
  }
}
