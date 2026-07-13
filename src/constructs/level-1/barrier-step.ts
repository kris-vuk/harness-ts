import { Step, type StepProps } from "./step.js";

export interface BarrierStepProps extends StepProps {
  /** Identifier of a barrier declared in the pipeline's `flowControl`. */
  barrierRef: string;
}

/**
 * A Harness Barrier step (`type: Barrier`): synchronizes execution across
 * parallel stages that share the same `barrierRef`. Renders the
 * `BarrierStepInfo` spec (`{ barrierRef }`).
 */
export class BarrierStep extends Step {
  readonly stepType = "Barrier";

  private readonly barrierRef: string;

  constructor(props: BarrierStepProps) {
    super(props);
    this.barrierRef = props.barrierRef;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.barrierRef.trim() === "") {
      errors.push("barrierRef must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      barrierRef: this.barrierRef,
    };
  }
}
