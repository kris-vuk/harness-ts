import { Step, type StepProps } from "./step.js";

/**
 * The kinds of change a `FlagConfiguration` step can apply to a feature flag
 * (`PatchInstruction.type`): toggle state, set on/off/default variations,
 * add/update rules, or manage target/segment variation maps.
 */
export type PatchInstructionType =
  | "SetFeatureFlagState"
  | "SetOnVariation"
  | "SetOffVariation"
  | "SetDefaultVariations"
  | "AddRule"
  | "UpdateRule"
  | "AddTargetsToVariationTargetMap"
  | "RemoveTargetsToVariationTargetMap"
  | "AddSegmentToVariationTargetMap"
  | "RemoveSegmentsToVariationTargetMap";

/**
 * A single change to apply to a feature flag (`PatchInstruction`). The schema
 * only strongly types `type`; the per-type `spec` is accepted as a
 * pass-through object.
 */
export interface PatchInstruction {
  type: PatchInstructionType;
  /** Optional instruction identifier. */
  identifier?: string;
  /** Type-specific payload (e.g. `{ state: "on" }`, variation/rule details). */
  spec?: Record<string, unknown>;
}

function renderInstruction(i: PatchInstruction): Record<string, unknown> {
  return {
    ...(i.identifier !== undefined && { identifier: i.identifier }),
    type: i.type,
    ...(i.spec !== undefined && { spec: i.spec }),
  };
}

export interface FlagConfigurationStepProps extends StepProps {
  /** Identifier of the feature flag to modify. */
  feature: string;
  /** Identifier of the environment the change targets. */
  environment: string;
  /** Ordered changes to apply to the flag. */
  instructions: PatchInstruction[];
}

/**
 * A Harness `FlagConfiguration` step: applies a list of {@link PatchInstruction}
 * changes to a feature flag in a given environment. Renders the
 * `FlagConfigurationStepInfo` spec.
 */
export class FlagConfigurationStep extends Step {
  readonly stepType = "FlagConfiguration";

  private readonly feature: string;
  private readonly environment: string;
  private readonly instructions: PatchInstruction[];

  constructor(props: FlagConfigurationStepProps) {
    super(props);
    this.feature = props.feature;
    this.environment = props.environment;
    this.instructions = props.instructions;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.feature.trim() === "") {
      errors.push("feature must not be empty");
    }
    if (this.environment.trim() === "") {
      errors.push("environment must not be empty");
    }
    if (this.instructions.length === 0) {
      errors.push("instructions must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      feature: this.feature,
      environment: this.environment,
      instructions: this.instructions.map(renderInstruction),
    };
  }
}
