import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import { isValidIdentifier, toIdentifier } from "../../identifier.js";
import { type NGVariable, renderVariable } from "../ng-variable.js";
import {
  type NotificationRule,
  renderNotificationRule,
} from "../notification.js";
import { type FlowControl, renderFlowControl } from "../flow-control.js";
import { type TemplateLink, renderTemplateLink } from "../template-link.js";

/**
 * Scope within which a pipeline's concurrency `resourceName` is unique — runs
 * sharing the name within the scope are queued rather than run concurrently.
 */
export type ConcurrencyQueueScope =
  | "Pipeline"
  | "Project"
  | "Account"
  | "Organization";

/**
 * Pipeline-level concurrency / queuing (`pipeline.concurrency`). Serializes
 * runs that share `resourceName` within `queueScope`.
 *
 * Not part of the Harness v0 pipeline schema exported to `pipeline.json` — the
 * feature is newer than the exported schema — so a pipeline using it will not
 * satisfy the bundled schema validator, though Harness accepts it at runtime.
 */
export interface PipelineConcurrency {
  /** Queue key; runs sharing it within `queueScope` are serialized. */
  resourceName: string;
  /** Defaults to "Pipeline" on the Harness side when omitted. */
  queueScope?: ConcurrencyQueueScope;
}

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
 * Something that starts a **run** of a {@link Pipeline} — e.g. a GitHub push
 * webhook. Attached via {@link Pipeline.addTrigger}. This is distinct from a
 * pipeline's git-backed *definition* (Git Experience), which governs how the
 * pipeline YAML itself is synced, not when it executes.
 *
 * Unlike a {@link PipelineChild}, a run trigger is **not** part of the pipeline
 * document: Harness models triggers as sibling entities that reference a
 * pipeline by identifier and render to their own YAML document. `addTrigger`
 * is sugar — it binds the pipeline into the trigger (so it can resolve the
 * identifiers it points at) and registers it for emission alongside the
 * pipeline. GitHub push is the one implementation today; scheduled/artifact
 * triggers would be additional `RunTrigger`s.
 */
export interface RunTrigger {
  /** Harness identifier; also the trigger's output file name. */
  readonly identifier: string;
  /** Resolve the pipeline this trigger references. Called by `addTrigger`. */
  bindToPipeline(pipeline: Pipeline): void;
  /** Returns problems with this trigger; empty when valid. */
  validate(): string[];
  /** Renders the trigger as its own Harness trigger YAML document. */
  synth(): string;
}

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
 * Properties of a Harness `pipeline`, mirroring the fields of
 * `definitions/pipeline/pipeline` in the Harness v0 pipeline schema.
 *
 * `variables`, `notificationRules`, `flowControl`, and `template` are modeled
 * by dedicated value objects; `properties` remains a pass-through object for
 * now (a dedicated construct can be introduced later without changing this
 * surface).
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
  /** Pipeline-level concurrency / queuing (`concurrency`). */
  concurrency?: PipelineConcurrency;
  /** Pipeline-level `NGVariable` entries. */
  variables?: NGVariable[];
  /** Notification rules (`NotificationRules` entries). */
  notificationRules?: NotificationRule[];
  /** Barrier / flow-control configuration (`flowControl`). */
  flowControl?: FlowControl;
  /** Additional pipeline properties (e.g. `properties.ci.codebase`). */
  properties?: Record<string, unknown>;
  /** Reference to a pipeline template (`TemplateLinkConfig`). */
  template?: TemplateLink;
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
    return stringify(this.toJson());
  }
}
