import { AgentRegistry } from "./agent-registry.js";
import { Config } from "./config.js";
import { LLMClient, MockProvider, type LlmProvider } from "./llm-client.js";
import { Memory } from "./memory.js";
import { Orchestrator } from "./orchestrator.js";
import { RuntimeRpcServer } from "./rpc.js";
import { RunEngine } from "./run-engine.js";
import { SchemaValidator } from "./schema-validator.js";
import { Secrets } from "./secrets.js";
import { Store } from "./store.js";
import { ToolRegistry } from "./tool-registry.js";
import { type ToolBindingExecutor, ToolInvoker } from "./tool-invoker.js";
import type { RuntimePolicy } from "./types.js";

export type MethodBindingHandler = (input: unknown) => Promise<unknown> | unknown;

export interface AgentRuntimeOptions {
  dataDir?: string;
  runtimePolicy?: RuntimePolicy;
}

export class AgentRuntime {
  readonly config: Config;
  readonly secrets: Secrets;
  readonly store: Store;
  readonly schemaValidator: SchemaValidator;
  readonly agents: AgentRegistry;
  readonly tools: ToolRegistry;
  readonly memory: Memory;
  readonly llmClient: LLMClient;
  readonly toolInvoker: ToolInvoker;
  readonly runEngine: RunEngine;
  readonly orchestrator: Orchestrator;
  readonly rpc: RuntimeRpcServer;

  private readonly methodBindings: Map<string, MethodBindingHandler>;

  constructor(options: AgentRuntimeOptions = {}) {
    this.methodBindings = new Map();

    this.config = new Config();
    this.secrets = new Secrets();
    this.store = new Store(options.dataDir);
    this.schemaValidator = new SchemaValidator();
    this.agents = new AgentRegistry(this.store, this.schemaValidator);
    this.tools = new ToolRegistry(this.store, this.schemaValidator);
    this.memory = new Memory(this.store);
    this.llmClient = new LLMClient({
      mock: new MockProvider(),
    });

    const bindingExecutor: ToolBindingExecutor = async (methodName, input) => {
      const handler = this.methodBindings.get(methodName);
      if (!handler) {
        throw new Error(`No tool binding registered for method "${methodName}".`);
      }
      return handler(input);
    };

    this.toolInvoker = new ToolInvoker({
      toolRegistry: this.tools,
      schemaValidator: this.schemaValidator,
      bindingExecutor,
      emitTrace: async (event) => {
        await this.store.AppendTrace(event.runId, event);
      },
      runtimePolicy: options.runtimePolicy ?? { allowApprovalBypass: false },
    });

    this.runEngine = new RunEngine(this.store, this.agents, this.tools, this.memory, this.llmClient, this.toolInvoker);
    this.orchestrator = new Orchestrator(this.runEngine, this.store);
    this.rpc = new RuntimeRpcServer({
      agents: this.agents,
      tools: this.tools,
      store: this.store,
      runEngine: this.runEngine,
      toolInvoker: this.toolInvoker,
      schemaValidator: this.schemaValidator,
    });
  }

  RegisterMethodBinding(methodName: string, handler: MethodBindingHandler): void {
    this.methodBindings.set(methodName, async (input) => handler(input));
  }

  RegisterProvider(providerName: string, provider: LlmProvider): void {
    this.llmClient.RegisterProvider(providerName, provider);
  }
}
