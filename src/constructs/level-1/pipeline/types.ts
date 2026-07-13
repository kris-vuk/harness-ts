import type { NGVariable } from "../ng-variable.js";
import type { NotificationRule } from "../notification.js";
import type { FlowControl } from "../flow-control.js";
import type { TemplateLink } from "../template-link.js";
import type { Pipeline } from "./pipeline.js";

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
 * How Harness fetches the branch when creating/importing the remote pipeline.
 * "Branch" tracks the tip of {@link PipelineGitConfigProps.branch}; "Commit"
 * pins a specific `commitId`.
 */
export type PipelineGitFetchType = "Branch" | "Commit";

/**
 * Properties for the Git configuration of a {@link Pipeline}'s **own
 * definition** — i.e. the repo that stores the pipeline YAML, not any
 * application/source repo the pipeline builds or deploys.
 *
 * In Harness this is "Git Experience": a pipeline stored with
 * `storeType: REMOTE` lives as a YAML file in a git repo, and Harness keeps its
 * in-account copy in sync with that file. This metadata is **not** part of the
 * v0 pipeline document ({@link Pipeline.toJson}); it rides alongside the YAML as
 * entity/API-level "git details" when the pipeline is created or imported. So,
 * like a trigger, this is a separate resource that *references* a pipeline
 * rather than something embedded in the pipeline document.
 */
export interface PipelineGitConfigProps {
  /** Pipeline whose definition lives in git. Supplies its identifier. */
  pipeline: Pipeline;
  /** Existing Git connector ref pointing at the pipeline-definition repo. */
  connectorRef: string;
  /** Repository holding the pipeline YAML, e.g. "my-org/pipeline-defs". */
  repoName: string;
  /** Branch the pipeline YAML is read from / written to, e.g. "main". */
  branch: string;
  /**
   * Path to the pipeline YAML within the repo, e.g.
   * ".harness/my_pipeline.yaml".
   */
  filePath: string;
  /**
   * Whether Harness fetches by branch tip or a pinned commit. Defaults to
   * "Branch" — the mode that lets the in-account copy update when the repo
   * updates.
   */
  gitFetchType?: PipelineGitFetchType;
  /** Commit to pin when `gitFetchType` is "Commit". */
  commitId?: string;
  /**
   * Base branch to open the file against (used by some create/import flows).
   * Optional; defaults to {@link branch} on the Harness side when omitted.
   */
  baseBranch?: string;
}
