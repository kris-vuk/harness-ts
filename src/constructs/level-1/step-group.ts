import { isValidIdentifier, toIdentifier } from "../../identifier.js";
import type { ExecutionItem } from "./stage.js";
import { type NGVariable, renderVariable } from "./ng-variable.js";
import { type StepWhen, renderStepWhen } from "./when-condition.js";
import {
  type FailureStrategy,
  renderFailureStrategy,
} from "./failure-strategy.js";
import { type Strategy, renderStrategy } from "./strategy.js";
import { type TemplateLink, renderTemplateLink } from "./template-link.js";

/**
 * Properties of a step group (`StepGroupElementConfig`). A step group is a
 * named, reusable container of execution items inside a stage's execution —
 * the last container primitive alongside {@link ParallelGroup}. Unlike a
 * parallel group it has its own identifier and can carry its own `when`,
 * `failureStrategies`, `strategy`, and step-group infrastructure.
 *
 * `variables`, the `when`/`failureStrategies`/`strategy` blocks, and `template`
 * are modeled by dedicated value objects; `stepGroupInfra` and `platform`
 * remain pass-through objects for now (dedicated constructs can be added later
 * without changing this surface).
 */
export interface StepGroupProps {
  /** Display name. */
  name: string;
  /** Defaults to an identifier derived from `name` ("My Group" -> "My_Group"). */
  identifier?: string;
  description?: string;
  /**
   * The items to run in the group (steps, parallel groups, or nested step
   * groups). May be empty only when the group is sourced from a `template`.
   */
  steps?: ExecutionItem[];
  /** Conditional execution (`StepWhenCondition`). */
  when?: StepWhen;
  /** Failure-handling rules (`FailureStrategyConfig` entries). */
  failureStrategies?: FailureStrategy[];
  /** Looping / matrix strategy (`StrategyConfig`). */
  strategy?: Strategy;
  delegateSelectors?: string[];
  /** Paths shared across the group's steps (`sharedPaths`). */
  sharedPaths?: string[];
  /** Group-level `NGVariable` entries. */
  variables?: NGVariable[];
  /** Step-group infrastructure (`StepGroupInfra`), e.g. a container context. */
  stepGroupInfra?: Record<string, unknown>;
  /** Platform selectors for the group (`platform`). */
  platform?: Record<string, unknown>;
  /** Reference to a step-group template (`TemplateLinkConfig`). */
  template?: TemplateLink;
}

/**
 * A step group inside a stage's execution. Renders the `stepGroup` variant of
 * `ExecutionWrapperConfig` — `{ stepGroup: { identifier, name, steps, ... } }`
 * — following the v0 pipeline schema. Its children are themselves
 * {@link ExecutionItem}s, so groups may nest and may contain parallel groups.
 */
export class StepGroup implements ExecutionItem {
  readonly identifier: string;

  private readonly name: string;
  private readonly description?: string;
  private readonly items: ExecutionItem[] = [];
  private readonly when?: StepWhen;
  private readonly failureStrategies?: FailureStrategy[];
  private readonly strategy?: Strategy;
  private readonly delegateSelectors?: string[];
  private readonly sharedPaths?: string[];
  private readonly variables?: NGVariable[];
  private readonly stepGroupInfra?: Record<string, unknown>;
  private readonly platform?: Record<string, unknown>;
  private readonly template?: TemplateLink;

  constructor(props: StepGroupProps) {
    this.name = props.name;
    this.identifier = props.identifier ?? toIdentifier(props.name);
    this.description = props.description;
    for (const item of props.steps ?? []) {
      this.items.push(item);
    }
    this.when = props.when;
    this.failureStrategies = props.failureStrategies;
    this.strategy = props.strategy;
    this.delegateSelectors = props.delegateSelectors;
    this.sharedPaths = props.sharedPaths;
    this.variables = props.variables;
    this.stepGroupInfra = props.stepGroupInfra;
    this.platform = props.platform;
    this.template = props.template;
  }

  addStep(item: ExecutionItem): this {
    this.items.push(item);
    return this;
  }

  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.identifier)) {
      errors.push(`invalid identifier "${this.identifier}"`);
    }
    // A group is empty only legitimately when its steps come from a template.
    if (this.items.length === 0 && this.template === undefined) {
      errors.push("step group must contain at least one step");
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

  toJson(): Record<string, unknown> {
    return {
      stepGroup: {
        identifier: this.identifier,
        name: this.name,
        ...(this.description !== undefined && { description: this.description }),
        ...(this.template !== undefined && {
          template: renderTemplateLink(this.template),
        }),
        ...(this.items.length > 0 && {
          steps: this.items.map((item) => item.toJson()),
        }),
        ...(this.stepGroupInfra !== undefined && {
          stepGroupInfra: this.stepGroupInfra,
        }),
        ...(this.platform !== undefined && { platform: this.platform }),
        ...(this.sharedPaths !== undefined && { sharedPaths: this.sharedPaths }),
        ...(this.variables !== undefined && {
          variables: this.variables.map(renderVariable),
        }),
        ...(this.delegateSelectors !== undefined && {
          delegateSelectors: this.delegateSelectors,
        }),
        ...(this.when !== undefined && { when: renderStepWhen(this.when) }),
        ...(this.failureStrategies !== undefined && {
          failureStrategies: this.failureStrategies.map(renderFailureStrategy),
        }),
        ...(this.strategy !== undefined && {
          strategy: renderStrategy(this.strategy),
        }),
      },
    };
  }
}
