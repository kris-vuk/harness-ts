import { stringify } from "yaml";
import { isValidIdentifier, toIdentifier } from "../identifier.js";
import { type NGVariable, renderVariable } from "./ng-variable.js";

/**
 * A child that a {@link Pipeline} can render into its `stages` list — a stage,
 * a parallel group, or a template stage. Concrete child constructs are
 * implemented separately; the pipeline only relies on this surface.
 */
export interface PipelineChild {
  /** Harness identifier, unique within the pipeline. */
  readonly identifier: string;
  /** Returns problems with this child; empty when valid. */
  validate(): string[];
  /** Renders the child's entry in the pipeline's `stages` list. */
  toJson(): Record<string, unknown>;
}

/**
 * Properties of a Harness `pipeline`, mirroring the fields of
 * `definitions/pipeline/pipeline` in the Harness v0 pipeline schema.
 *
 * `variables` is modeled by the {@link NGVariable} value object; the other
 * structurally rich fields (`notificationRules`, `flowControl`, `template`,
 * `properties`) are accepted as pass-through objects for now; dedicated
 * constructs for them can be introduced later without changing this surface.
 */
export interface PipelineProps {
  /** Display name. Schema pattern: `^[a-zA-Z_0-9-.][-0-9a-zA-Z_\s.]{0,127}$`. */
  name: string;
  /** Defaults to an identifier derived from `name` ("My Pipeline" -> "My_Pipeline"). */
  identifier?: string;
  projectIdentifier: string;
  /** Defaults to "default". */
  orgIdentifier?: string;
  description?: string;
  tags?: Record<string, string>;
  /** Tags/names of existing delegates to orchestrate the work. */
  delegateSelectors?: string[];
  /** Allow individual stages to be run on their own. */
  allowStageExecutions?: boolean;
  /** Keep the originally supplied inputs when a run is re-run. */
  fixedInputsOnRerun?: boolean;
  /** Overall pipeline timeout, e.g. "1h", "30m", "1d". */
  timeout?: string;
  /** Pipeline-level `NGVariable` entries. */
  variables?: NGVariable[];
  /** Notification rules (`NotificationRules` entries). */
  notificationRules?: Record<string, unknown>[];
  /** Barrier / flow-control configuration. */
  flowControl?: Record<string, unknown>;
  /** Additional pipeline properties (e.g. `properties.ci.codebase`). */
  properties?: Record<string, unknown>;
  /** Reference to a pipeline template (`TemplateLinkConfig`). */
  template?: Record<string, unknown>;
  /** The stages that make up the pipeline. */
  stages?: PipelineChild[];
}

/**
 * A Harness pipeline. Synthesizes to the `{ pipeline: { ... } }` YAML document
 * consumed by Harness, following the v0 pipeline schema.
 */
export class Pipeline {
  readonly name: string;
  readonly identifier: string;
  readonly projectIdentifier: string;
  readonly orgIdentifier: string;
  readonly description?: string;
  readonly tags: Record<string, string>;
  readonly delegateSelectors?: string[];
  readonly allowStageExecutions?: boolean;
  readonly fixedInputsOnRerun?: boolean;
  readonly timeout?: string;
  readonly variables?: NGVariable[];
  readonly notificationRules?: Record<string, unknown>[];
  readonly flowControl?: Record<string, unknown>;
  readonly properties?: Record<string, unknown>;
  readonly template?: Record<string, unknown>;

  private readonly stages: PipelineChild[] = [];

  constructor(props: PipelineProps) {
    this.name = props.name;
    this.identifier = props.identifier ?? toIdentifier(props.name);
    this.projectIdentifier = props.projectIdentifier;
    this.orgIdentifier = props.orgIdentifier ?? "default";
    this.description = props.description;
    this.tags = props.tags ?? {};
    this.delegateSelectors = props.delegateSelectors;
    this.allowStageExecutions = props.allowStageExecutions;
    this.fixedInputsOnRerun = props.fixedInputsOnRerun;
    this.timeout = props.timeout;
    this.variables = props.variables;
    this.notificationRules = props.notificationRules;
    this.flowControl = props.flowControl;
    this.properties = props.properties;
    this.template = props.template;
    for (const stage of props.stages ?? []) {
      this.addStage(stage);
    }
  }

  addStage(stage: PipelineChild): this {
    this.stages.push(stage);
    return this;
  }

  /** Returns problems with the pipeline and everything in it; empty when valid. */
  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.identifier)) {
      errors.push(`invalid identifier "${this.identifier}"`);
    }
    if (this.stages.length === 0) {
      errors.push("pipeline must contain at least one stage");
    }
    const seen = new Set<string>();
    for (const stage of this.stages) {
      if (seen.has(stage.identifier)) {
        errors.push(`duplicate stage identifier "${stage.identifier}"`);
      }
      seen.add(stage.identifier);
      errors.push(...stage.validate().map((e) => `stage "${stage.identifier}": ${e}`));
    }
    return errors;
  }

  toJson(): Record<string, unknown> {
    return {
      pipeline: {
        name: this.name,
        identifier: this.identifier,
        projectIdentifier: this.projectIdentifier,
        orgIdentifier: this.orgIdentifier,
        ...(this.description !== undefined && { description: this.description }),
        tags: this.tags,
        ...(this.delegateSelectors !== undefined && {
          delegateSelectors: this.delegateSelectors,
        }),
        ...(this.allowStageExecutions !== undefined && {
          allowStageExecutions: this.allowStageExecutions,
        }),
        ...(this.fixedInputsOnRerun !== undefined && {
          fixedInputsOnRerun: this.fixedInputsOnRerun,
        }),
        ...(this.timeout !== undefined && { timeout: this.timeout }),
        ...(this.flowControl !== undefined && { flowControl: this.flowControl }),
        ...(this.properties !== undefined && { properties: this.properties }),
        ...(this.notificationRules !== undefined && {
          notificationRules: this.notificationRules,
        }),
        ...(this.variables !== undefined && {
          variables: this.variables.map(renderVariable),
        }),
        ...(this.template !== undefined && { template: this.template }),
        stages: this.stages.map((stage) => stage.toJson()),
      },
    };
  }

  /**
   * Validates the pipeline and renders it as Harness pipeline YAML.
   * @throws if the pipeline is invalid.
   */
  synth(): string {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(
        `Pipeline "${this.identifier}" is invalid:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    return stringify(this.toJson());
  }
}
