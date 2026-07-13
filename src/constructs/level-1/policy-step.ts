import { Step, type StepProps } from "./step.js";

export interface PolicyStepProps extends StepProps {
  /** Identifiers of the OPA policy sets to evaluate. */
  policySets: string[];
  /**
   * The JSON payload to evaluate the policy sets against, e.g. a runtime
   * expression like "<+pipeline.variables.config>". Rendered under the
   * `Custom` policy spec.
   */
  payload?: string;
}

/**
 * A Harness Policy step (`type: Policy`): evaluates OPA policy sets against a
 * payload. Renders the `PolicyStepInfo` spec with `type: Custom` (the
 * `policySpec.payload` form).
 */
export class PolicyStep extends Step {
  readonly stepType = "Policy";

  private readonly policySets: string[];
  private readonly payload?: string;

  constructor(props: PolicyStepProps) {
    super(props);
    this.policySets = props.policySets;
    this.payload = props.payload;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.policySets.length === 0) {
      errors.push("policySets must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      type: "Custom",
      policySets: this.policySets,
      ...(this.payload !== undefined && {
        policySpec: { payload: this.payload },
      }),
    };
  }
}
