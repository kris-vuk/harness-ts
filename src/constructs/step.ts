import { isValidIdentifier, toIdentifier } from "../identifier.js";
import type { ExecutionItem } from "./stage.js";
import { type StepWhen, renderStepWhen } from "./when-condition.js";
import {
  type FailureStrategy,
  renderFailureStrategy,
} from "./failure-strategy.js";
import { type Strategy, renderStrategy } from "./strategy.js";

/**
 * Properties common to every Harness step, mirroring `StepElementConfig` in
 * the Harness v0 pipeline schema. Each concrete step type additionally
 * contributes a type-specific `spec`.
 *
 * `when`, `failureStrategies`, and `strategy` are modeled by dedicated value
 * objects; `enforce` (`PolicyConfig`) remains a pass-through object for now.
 */
export interface StepProps {
  /** Display name. */
  name: string;
  /** Defaults to an identifier derived from `name` ("My Step" -> "My_Step"). */
  identifier?: string;
  description?: string;
  /** Step timeout, e.g. "10m", "1h30m". */
  timeout?: string;
  /** Conditional execution (`StepWhenCondition`). */
  when?: StepWhen;
  /** Failure-handling rules (`FailureStrategyConfig` entries). */
  failureStrategies?: FailureStrategy[];
  /** Looping / matrix strategy (`StrategyConfig`). */
  strategy?: Strategy;
  /** Policy enforcement (`PolicyConfig`). */
  enforce?: Record<string, unknown>;
}

/**
 * Base class for a Harness step. Renders the `{ step: { ... } }` entry
 * (`ExecutionWrapperConfig`) consumed by a stage's execution, following the
 * v0 pipeline schema: the shared fields live here, while each concrete step
 * type supplies its `type` discriminator and `spec` block. Concrete step
 * constructs are implemented separately.
 */
export abstract class Step implements ExecutionItem {
  readonly name: string;
  readonly identifier: string;
  readonly description?: string;
  readonly timeout?: string;
  readonly when?: StepWhen;
  readonly failureStrategies?: FailureStrategy[];
  readonly strategy?: Strategy;
  readonly enforce?: Record<string, unknown>;

  constructor(props: StepProps) {
    this.name = props.name;
    this.identifier = props.identifier ?? toIdentifier(props.name);
    this.description = props.description;
    this.timeout = props.timeout;
    this.when = props.when;
    this.failureStrategies = props.failureStrategies;
    this.strategy = props.strategy;
    this.enforce = props.enforce;
  }

  /** The `type` discriminator of the step, e.g. "ShellScript". */
  abstract readonly stepType: string;

  /** Renders the `spec` block specific to this step type. */
  protected abstract renderSpec(): Record<string, unknown>;

  /** Returns problems with this step; empty when valid. */
  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.identifier)) {
      errors.push(`invalid identifier "${this.identifier}"`);
    }
    return errors;
  }

  /** Renders the `{ step: { ... } }` entry used inside a stage's execution. */
  toJson(): Record<string, unknown> {
    return {
      step: {
        name: this.name,
        identifier: this.identifier,
        ...(this.description !== undefined && { description: this.description }),
        type: this.stepType,
        spec: this.renderSpec(),
        ...(this.timeout !== undefined && { timeout: this.timeout }),
        ...(this.when !== undefined && { when: renderStepWhen(this.when) }),
        ...(this.failureStrategies !== undefined && {
          failureStrategies: this.failureStrategies.map(renderFailureStrategy),
        }),
        ...(this.strategy !== undefined && {
          strategy: renderStrategy(this.strategy),
        }),
        ...(this.enforce !== undefined && { enforce: this.enforce }),
      },
    };
  }
}
