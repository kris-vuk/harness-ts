import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import { isValidIdentifier, toIdentifier } from "../../../identifier.js";
import { type NGVariable, renderVariable } from "../ng-variable.js";
import {
  type NotificationRule,
  renderNotificationRule,
} from "../notification.js";
import { type FlowControl, renderFlowControl } from "../flow-control.js";
import { type TemplateLink, renderTemplateLink } from "../template-link.js";
import type {
  PipelineChild,
  PipelineConcurrency,
  PipelineProps,
  RunTrigger,
} from "./types.js";

/**
 * The triggers attached to a {@link Pipeline}, exposed via `pipeline.triggers`.
 * Iterable, and `synth()` renders each attached trigger to its own YAML
 * document (one string per trigger) — mirroring how Harness stores each trigger
 * as a separate entity.
 */
export class PipelineTriggers implements Iterable<RunTrigger> {
  constructor(private readonly items: readonly RunTrigger[]) {}

  /** Number of attached triggers. */
  get length(): number {
    return this.items.length;
  }

  /** The attached triggers as a plain array. */
  toArray(): RunTrigger[] {
    return [...this.items];
  }

  /** Renders each attached trigger to its own Harness trigger YAML document. */
  synth(): string[] {
    return this.items.map((trigger) => trigger.synth());
  }

  [Symbol.iterator](): Iterator<RunTrigger> {
    return this.items[Symbol.iterator]();
  }
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
  readonly concurrency?: PipelineConcurrency;
  readonly variables?: NGVariable[];
  readonly notificationRules?: NotificationRule[];
  readonly flowControl?: FlowControl;
  readonly properties?: Record<string, unknown>;
  readonly template?: TemplateLink;

  private readonly stages: PipelineChild[] = [];
  private readonly attachedTriggers: RunTrigger[] = [];

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
    this.concurrency = props.concurrency;
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

  /**
   * Attaches a trigger to this pipeline. Syntactic sugar over building a
   * standalone trigger: it back-fills this pipeline's identifiers into the
   * trigger so it resolves what it points at. The trigger stays a separate
   * document — Harness models triggers as sibling entities, not part of the
   * pipeline — and `build()` writes it to its own file. Chainable.
   */
  addTrigger(trigger: RunTrigger): this {
    trigger.bindToPipeline(this);
    this.attachedTriggers.push(trigger);
    return this;
  }

  /**
   * The triggers attached via {@link addTrigger}. Use `pipeline.triggers.synth()`
   * to render each to its own YAML string, or iterate to inspect them.
   */
  get triggers(): PipelineTriggers {
    return new PipelineTriggers(this.attachedTriggers);
  }

  /**
   * Writes this pipeline and each attached trigger to its own YAML file under
   * `outdir` (default `.harness`). The output directory is **cleared and
   * recreated** on every build, so files from removed pipelines/triggers don't
   * linger. Files are named `<identifier>.yaml`. Returns the absolute paths
   * written.
   *
   * Everything is rendered (and validated) before the directory is touched, so
   * an invalid pipeline or trigger throws and leaves the existing output intact.
   * Throws if the pipeline and a trigger resolve to the same file name.
   */
  build(outdir = ".harness"): string[] {
    const dir = resolve(outdir);

    const rendered: { path: string; yaml: string }[] = [];
    const seen = new Set<string>();
    const stage = (identifier: string, yaml: string): void => {
      const fileName = `${identifier}.yaml`;
      if (seen.has(fileName)) {
        throw new Error(
          `Pipeline.build: two resources write to "${fileName}"; ` +
            "give the pipeline or trigger a distinct identifier.",
        );
      }
      seen.add(fileName);
      rendered.push({ path: join(dir, fileName), yaml });
    };

    // Render everything first so a validation error leaves the output untouched.
    stage(this.identifier, this.synth());
    for (const trigger of this.attachedTriggers) {
      stage(trigger.identifier, trigger.synth());
    }

    // Only now that rendering succeeded, clear and recreate the output dir.
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { path, yaml } of rendered) {
      writeFileSync(path, yaml);
    }
    return rendered.map((r) => r.path);
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
        ...(this.concurrency !== undefined && {
          concurrency: {
            resourceName: this.concurrency.resourceName,
            ...(this.concurrency.queueScope !== undefined && {
              queueScope: this.concurrency.queueScope,
            }),
          },
        }),
        ...(this.flowControl !== undefined && {
          flowControl: renderFlowControl(this.flowControl),
        }),
        ...(this.properties !== undefined && { properties: this.properties }),
        ...(this.notificationRules !== undefined && {
          notificationRules: this.notificationRules.map(renderNotificationRule),
        }),
        ...(this.variables !== undefined && {
          variables: this.variables.map(renderVariable),
        }),
        ...(this.template !== undefined && {
          template: renderTemplateLink(this.template),
        }),
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
    // Disable YAML anchors/aliases: a construct tree legitimately reuses the
    // same array/Expression object in several places (shared delegate selectors,
    // a credential expression used by two env vars), which the stringifier would
    // otherwise emit as `&anchor`/`*alias`. Harness expects plain scalars.
    return stringify(this.toJson(), { aliasDuplicateObjects: false });
  }
}
