import { Stage, type StageProps, type ExecutionItem } from "./stage.js";

export interface CustomStageProps extends StageProps {
  steps?: ExecutionItem[];
}

/**
 * A Harness Custom stage (`type: Custom`): a plain sequence of execution
 * items with no service/environment/infrastructure attached. Renders the
 * `CustomStageConfig` spec, whose only structural field is `execution`.
 */
export class CustomStage extends Stage {
  readonly stageType = "Custom";

  private readonly items: ExecutionItem[] = [];

  constructor(props: CustomStageProps) {
    super(props);
    for (const item of props.steps ?? []) {
      this.items.push(item);
    }
  }

  addStep(item: ExecutionItem): this {
    this.items.push(item);
    return this;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.items.length === 0) {
      errors.push("stage must contain at least one step");
    }
    const seen = new Set<string>();
    for (const item of this.items) {
      if (seen.has(item.identifier)) {
        errors.push(`duplicate step identifier "${item.identifier}"`);
      }
      seen.add(item.identifier);
      errors.push(...item.validate().map((e) => `"${item.identifier}": ${e}`));
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      execution: {
        steps: this.items.map((item) => item.toJson()),
      },
    };
  }
}
