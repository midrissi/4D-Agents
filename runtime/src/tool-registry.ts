import { SchemaValidator } from "./schema-validator.js";
import { Store } from "./store.js";
import type { ToolSpec } from "./types.js";

export class ToolRegistry {
  constructor(
    private readonly store: Store,
    private readonly validator: SchemaValidator,
  ) {}

  async Upsert(toolSpec: ToolSpec): Promise<ToolSpec> {
    const validation = this.validator.ValidateTool(toolSpec);
    if (!validation.ok) {
      throw new Error(`Invalid ToolSpec: ${validation.errors.join("; ")}`);
    }

    await this.store.SaveTool(toolSpec);
    return toolSpec;
  }

  async Get(toolId: string): Promise<ToolSpec | null> {
    return this.store.LoadTool(toolId);
  }

  async List(): Promise<ToolSpec[]> {
    return this.store.ListTools();
  }

  async Delete(toolId: string): Promise<void> {
    await this.store.DeleteTool(toolId);
  }

  async ResolveBinding(toolId: string): Promise<string> {
    const tool = await this.Get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} is not registered.`);
    }

    return tool.binding.method;
  }
}
