import { RunEngine } from "./run-engine.js";
import { Store } from "./store.js";

export interface WorkflowStep {
  agentId: string;
  prompt: string;
}

export interface WorkflowSpec {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

export class Orchestrator {
  constructor(
    private readonly runEngine: RunEngine,
    private readonly store: Store,
  ) {}

  async Delegate(parentRunId: string, toAgentId: string, message: string): Promise<string> {
    const parentRun = await this.store.GetRun(parentRunId);
    if (!parentRun) {
      throw new Error(`Parent run "${parentRunId}" does not exist.`);
    }

    const childRunId = await this.runEngine.StartRun(
      toAgentId,
      [
        {
          role: "user",
          content: message,
        },
      ],
      {
        parentRunId,
      },
    );

    await this.runEngine.Step(childRunId);

    await this.store.AppendTrace(parentRunId, {
      ts: new Date().toISOString(),
      type: "messageAdded",
      runId: parentRunId,
      agentId: parentRun.meta.agentId,
      payload: {
        role: "assistant",
        content: `Delegated to ${toAgentId} in child run ${childRunId}.`,
      },
    });

    return childRunId;
  }

  async RunWorkflow(workflowSpec: WorkflowSpec, input: string): Promise<string> {
    if (workflowSpec.steps.length === 0) {
      throw new Error("Workflow must contain at least one step.");
    }

    let previousOutput = input;
    let firstRunId = "";

    for (const [index, step] of workflowSpec.steps.entries()) {
      const runId = await this.runEngine.StartRun(
        step.agentId,
        [
          {
            role: "user",
            content: index === 0 ? previousOutput : `${step.prompt}\n\n${previousOutput}`,
          },
        ],
        {
          workflowId: workflowSpec.id,
          workflowName: workflowSpec.name,
          stepIndex: index,
        },
      );

      const run = await this.runEngine.Step(runId);
      if (!firstRunId) {
        firstRunId = runId;
      }

      const latestAssistant = [...run.messages].reverse().find((message) => message.role === "assistant");
      previousOutput = latestAssistant?.content ?? previousOutput;
    }

    return firstRunId;
  }
}
