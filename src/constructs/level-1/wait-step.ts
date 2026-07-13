import { Step, type StepProps } from "./step.js";

/**
 * A Wait step uses `duration` rather than `timeout`, so `timeout` is omitted
 * from its props.
 */
export interface WaitStepProps extends Omit<StepProps, "timeout"> {
  /** How long to pause, e.g. "10m", "1h", "30s". */
  duration: string;
}

/**
 * A Harness Wait step (`type: Wait`): pauses the execution for a fixed
 * duration. Renders the `WaitStepInfo` spec, whose only required field is
 * `duration`.
 */
export class WaitStep extends Step {
  readonly stepType = "Wait";

  private readonly duration: string;

  constructor(props: WaitStepProps) {
    super(props);
    this.duration = props.duration;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.duration.trim() === "") {
      errors.push("duration must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      duration: this.duration,
    };
  }
}
