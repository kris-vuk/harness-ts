import { isValidIdentifier, toIdentifier } from "../../identifier.js";
import type { PipelineChild } from "./pipeline/types.js";
import { type NGVariable, renderVariable } from "./ng-variable.js";
import { type StageWhen, renderStageWhen } from "./when-condition.js";
import {
  type FailureStrategy,
  renderFailureStrategy,
} from "./failure-strategy.js";
import { type Strategy, renderStrategy } from "./strategy.js";

/**
 * Anything that can appear in a stage's `execution.steps` list — a step, a
 * step group, or a parallel group — mirroring an `ExecutionWrapperConfig`
 * entry in the Harness v0 pipeline schema. `toJson()` renders the wrapper
 * (e.g. `{ step: { ... } }`). Concrete step constructs are implemented
 * separately; stages only rely on this surface.
 */
export interface ExecutionItem {
  /** Harness identifier, unique within the execution. */
  readonly identifier: string;
  /** Returns problems with this item; empty when valid. */
  validate(): string[];
  /** Renders the item's `ExecutionWrapperConfig` entry. */
  toJson(): Record<string, unknown>;
}

/**
 * Properties common to every Harness stage node, mirroring the shared fields
 * of the `*StageNode` definitions in the Harness v0 pipeline schema. Each
 * concrete stage type additionally contributes a type-specific `spec`.
 *
 * `variables`, `when`, `failureStrategies`, and `strategy` are modeled by
 * dedicated value objects; `runMode` (`RunModeConfig`) remains a pass-through
 * object for now.
 */
export interface StageProps {
  /** Display name. */
  name: string;
  /** Defaults to an identifier derived from `name` ("My Stage" -> "My_Stage"). */
  identifier?: string;
  description?: string;
  tags?: Record<string, string>;
  /** Stage-level `NGVariable` entries. */
  variables?: NGVariable[];
  /** Conditional execution (`StageWhenCondition`). */
  when?: StageWhen;
  /** Failure-handling rules (`FailureStrategyConfig` entries). */
  failureStrategies?: FailureStrategy[];
  /** Tags/names of existing delegates to run this stage. */
  delegateSelectors?: string[];
  /** Looping / matrix strategy (`StrategyConfig`). */
  strategy?: Strategy;
  /** Stage timeout, e.g. "1h", "30m", "1d". */
  timeout?: string;
  /** Run-mode configuration (`RunModeConfig`). */
  runMode?: Record<string, unknown>;
}

/**
 * Base class for a Harness stage. Renders the `- stage:` entry consumed by a
 * {@link Pipeline}, following the v0 pipeline schema: the shared fields live
 * here, while each concrete stage type supplies its `type` discriminator and
 * `spec` block. Concrete stage constructs are implemented separately.
 */
export abstract class Stage implements PipelineChild {
  readonly name: string;
  readonly identifier: string;
  readonly description?: string;
  readonly tags: Record<string, string>;
  readonly variables?: NGVariable[];
  readonly when?: StageWhen;
  readonly failureStrategies?: FailureStrategy[];
  readonly delegateSelectors?: string[];
  readonly strategy?: Strategy;
  readonly timeout?: string;
  readonly runMode?: Record<string, unknown>;

  constructor(props: StageProps) {
    this.name = props.name;
    this.identifier = props.identifier ?? toIdentifier(props.name);
    this.description = props.description;
    this.tags = props.tags ?? {};
    this.variables = props.variables;
    this.when = props.when;
    this.failureStrategies = props.failureStrategies;
    this.delegateSelectors = props.delegateSelectors;
    this.strategy = props.strategy;
    this.timeout = props.timeout;
    this.runMode = props.runMode;
  }

  /** The `type` discriminator of the stage, e.g. "Custom", "Deployment". */
  abstract readonly stageType: string;

  /** Renders the `spec` block specific to this stage type. */
  protected abstract renderSpec(): Record<string, unknown>;

  /** Returns problems with this stage; empty when valid. */
  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.identifier)) {
      errors.push(`invalid identifier "${this.identifier}"`);
    }
    return errors;
  }

  /** Renders the `- stage:` entry used inside the pipeline's `stages` list. */
  toJson(): Record<string, unknown> {
    return {
      stage: {
        name: this.name,
        identifier: this.identifier,
        ...(this.description !== undefined && { description: this.description }),
        type: this.stageType,
        spec: this.renderSpec(),
        ...(this.when !== undefined && { when: renderStageWhen(this.when) }),
        ...(this.failureStrategies !== undefined && {
          failureStrategies: this.failureStrategies.map(renderFailureStrategy),
        }),
        ...(this.strategy !== undefined && {
          strategy: renderStrategy(this.strategy),
        }),
        ...(this.delegateSelectors !== undefined && {
          delegateSelectors: this.delegateSelectors,
        }),
        ...(this.timeout !== undefined && { timeout: this.timeout }),
        ...(this.runMode !== undefined && { runMode: this.runMode }),
        ...(this.variables !== undefined && {
          variables: this.variables.map(renderVariable),
        }),
        tags: this.tags,
      },
    };
  }
}
