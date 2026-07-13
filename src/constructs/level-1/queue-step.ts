import { Step, type StepProps } from "./step.js";

/** Scope at which a queue key serializes executions. */
export type QueueScope = "Pipeline" | "Stage";

export interface QueueStepProps extends StepProps {
  /** The resource key to serialize on; executions sharing a key run one at a time. */
  key: string;
  scope: QueueScope;
}

/**
 * A Harness Queue step (`type: Queue`): serializes executions competing for a
 * shared resource key. Renders the `QueueStepInfo` spec (`{ key, scope }`).
 */
export class QueueStep extends Step {
  readonly stepType = "Queue";

  private readonly key: string;
  private readonly scope: QueueScope;

  constructor(props: QueueStepProps) {
    super(props);
    this.key = props.key;
    this.scope = props.scope;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.key.trim() === "") {
      errors.push("key must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      key: this.key,
      scope: this.scope,
    };
  }
}
