import { Step, type StepProps } from "./step.js";

/**
 * The Kubernetes (native manifest) deploy step family. Every class extends the
 * abstract {@link Step} directly — there is intentionally no shared `K8sStep`
 * base — so each step declares its own copy of the fields it shares with the
 * rest of the family (`delegateSelectors`, `skipDryRun`, `pruningEnabled`, …).
 * These are the steps a `DeploymentStage` with `deploymentType: Kubernetes`
 * runs in its execution.
 *
 * `type` discriminators and `spec` shapes follow the v0 pipeline schema
 * (`definitions.pipeline.steps.cd.*`). Structurally rich, rarely-set fields
 * (`commandFlags`, manifest `source`, `trafficRouting` config) are accepted as
 * pass-through objects for now; dedicated constructs can be added later without
 * changing this surface.
 */

/** Command-line flag override for a kubectl-backed step (`K8sStepCommandFlag`). */
export type K8sCommandFlag = Record<string, unknown>;

/**
 * How many pods a step targets (`InstanceSelectionWrapper`): a fixed `Count`
 * or a `Percentage` of the desired replica count. Shared by Canary/Scale/
 * BlueGreen-stage-scale-up.
 */
export type InstanceSelection =
  | { type: "Count"; count: number }
  | { type: "Percentage"; percentage: number };

function renderInstanceSelection(
  sel: InstanceSelection,
): Record<string, unknown> {
  return sel.type === "Count"
    ? { type: "Count", spec: { count: sel.count } }
    : { type: "Percentage", spec: { percentage: sel.percentage } };
}

// ---------------------------------------------------------------------------
// K8sRollingDeploy
// ---------------------------------------------------------------------------

export interface K8sRollingDeployStepProps extends StepProps {
  /** Skip the `kubectl apply --dry-run` validation. Defaults to false. */
  skipDryRun?: boolean;
  /** Prune resources removed from the manifest between deploys. */
  pruningEnabled?: boolean;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sRollingDeploy` step: rolling update of a Kubernetes workload. */
export class K8sRollingDeployStep extends Step {
  readonly stepType = "K8sRollingDeploy";

  private readonly skipDryRun?: boolean;
  private readonly pruningEnabled?: boolean;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sRollingDeployStepProps) {
    super(props);
    this.skipDryRun = props.skipDryRun;
    this.pruningEnabled = props.pruningEnabled;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.skipDryRun !== undefined && { skipDryRun: this.skipDryRun }),
      ...(this.pruningEnabled !== undefined && {
        pruningEnabled: this.pruningEnabled,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sRollingRollback
// ---------------------------------------------------------------------------

export interface K8sRollingRollbackStepProps extends StepProps {
  pruningEnabled?: boolean;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sRollingRollback` step: rolls back a rolling deploy. */
export class K8sRollingRollbackStep extends Step {
  readonly stepType = "K8sRollingRollback";

  private readonly pruningEnabled?: boolean;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sRollingRollbackStepProps) {
    super(props);
    this.pruningEnabled = props.pruningEnabled;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.pruningEnabled !== undefined && {
        pruningEnabled: this.pruningEnabled,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sApply
// ---------------------------------------------------------------------------

export interface K8sApplyStepProps extends StepProps {
  /** Manifest paths (relative to the service manifest) to apply. */
  filePaths: string[];
  skipDryRun?: boolean;
  /** Skip waiting for resources to reach a steady state after apply. */
  skipSteadyStateCheck?: boolean;
  /** Apply the files as-is without Harness values/Helm rendering. */
  skipRendering?: boolean;
  /** Values/Kustomize overrides (`ManifestConfigWrapper` entries). */
  overrides?: Record<string, unknown>[];
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sApply` step: applies specific manifest files ad hoc. */
export class K8sApplyStep extends Step {
  readonly stepType = "K8sApply";

  private readonly filePaths: string[];
  private readonly skipDryRun?: boolean;
  private readonly skipSteadyStateCheck?: boolean;
  private readonly skipRendering?: boolean;
  private readonly overrides?: Record<string, unknown>[];
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sApplyStepProps) {
    super(props);
    this.filePaths = props.filePaths;
    this.skipDryRun = props.skipDryRun;
    this.skipSteadyStateCheck = props.skipSteadyStateCheck;
    this.skipRendering = props.skipRendering;
    this.overrides = props.overrides;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.filePaths.length === 0) {
      errors.push("filePaths must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      filePaths: this.filePaths,
      ...(this.skipDryRun !== undefined && { skipDryRun: this.skipDryRun }),
      ...(this.skipSteadyStateCheck !== undefined && {
        skipSteadyStateCheck: this.skipSteadyStateCheck,
      }),
      ...(this.skipRendering !== undefined && {
        skipRendering: this.skipRendering,
      }),
      ...(this.overrides !== undefined && { overrides: this.overrides }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sDelete
// ---------------------------------------------------------------------------

/** What a `K8sDelete` step removes (`DeleteResourcesWrapper`). */
export type DeleteResources =
  | { type: "ResourceName"; resourceNames: string[] }
  | { type: "ReleaseName"; deleteNamespace?: boolean }
  | {
      type: "ManifestPath";
      manifestPaths?: string[];
      /** Delete every manifest of the release instead of specific paths. */
      allManifestPaths?: boolean;
    };

function renderDeleteResources(r: DeleteResources): Record<string, unknown> {
  switch (r.type) {
    case "ResourceName":
      return { type: "ResourceName", spec: { resourceNames: r.resourceNames } };
    case "ReleaseName":
      return {
        type: "ReleaseName",
        spec: {
          ...(r.deleteNamespace !== undefined && {
            deleteNamespace: r.deleteNamespace,
          }),
        },
      };
    case "ManifestPath":
      return {
        type: "ManifestPath",
        spec: {
          ...(r.manifestPaths !== undefined && {
            manifestPaths: r.manifestPaths,
          }),
          ...(r.allManifestPaths !== undefined && {
            allManifestPaths: r.allManifestPaths,
          }),
        },
      };
  }
}

export interface K8sDeleteStepProps extends StepProps {
  deleteResources: DeleteResources;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sDelete` step: deletes deployed Kubernetes resources. */
export class K8sDeleteStep extends Step {
  readonly stepType = "K8sDelete";

  private readonly deleteResources: DeleteResources;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sDeleteStepProps) {
    super(props);
    this.deleteResources = props.deleteResources;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  override validate(): string[] {
    const errors = super.validate();
    const r = this.deleteResources;
    if (r.type === "ResourceName" && r.resourceNames.length === 0) {
      errors.push("deleteResources.resourceNames must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      deleteResources: renderDeleteResources(this.deleteResources),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sScale
// ---------------------------------------------------------------------------

export interface K8sScaleStepProps extends StepProps {
  /** Workload to scale, e.g. "Deployment/my-app". */
  workload: string;
  instanceSelection: InstanceSelection;
  skipSteadyStateCheck?: boolean;
  delegateSelectors?: string[];
}

/** A Harness `K8sScale` step: scales a workload to a count or percentage. */
export class K8sScaleStep extends Step {
  readonly stepType = "K8sScale";

  private readonly workload: string;
  private readonly instanceSelection: InstanceSelection;
  private readonly skipSteadyStateCheck?: boolean;
  private readonly delegateSelectors?: string[];

  constructor(props: K8sScaleStepProps) {
    super(props);
    this.workload = props.workload;
    this.instanceSelection = props.instanceSelection;
    this.skipSteadyStateCheck = props.skipSteadyStateCheck;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.workload.trim() === "") {
      errors.push("workload must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      workload: this.workload,
      instanceSelection: renderInstanceSelection(this.instanceSelection),
      ...(this.skipSteadyStateCheck !== undefined && {
        skipSteadyStateCheck: this.skipSteadyStateCheck,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sBlueGreenDeploy
// ---------------------------------------------------------------------------

export interface K8sBlueGreenDeployStepProps extends StepProps {
  skipDryRun?: boolean;
  pruningEnabled?: boolean;
  /** Skip the deploy when the stage manifest matches the primary. */
  skipDeploymentIfSameManifest?: boolean;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sBlueGreenDeploy` step: stages a new (green) color. */
export class K8sBlueGreenDeployStep extends Step {
  readonly stepType = "K8sBlueGreenDeploy";

  private readonly skipDryRun?: boolean;
  private readonly pruningEnabled?: boolean;
  private readonly skipDeploymentIfSameManifest?: boolean;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sBlueGreenDeployStepProps) {
    super(props);
    this.skipDryRun = props.skipDryRun;
    this.pruningEnabled = props.pruningEnabled;
    this.skipDeploymentIfSameManifest = props.skipDeploymentIfSameManifest;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.skipDryRun !== undefined && { skipDryRun: this.skipDryRun }),
      ...(this.pruningEnabled !== undefined && {
        pruningEnabled: this.pruningEnabled,
      }),
      ...(this.skipDeploymentIfSameManifest !== undefined && {
        skipDeploymentIfSameManifest: this.skipDeploymentIfSameManifest,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sCanaryDeploy
// ---------------------------------------------------------------------------

export interface K8sCanaryDeployStepProps extends StepProps {
  instanceSelection: InstanceSelection;
  skipDryRun?: boolean;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sCanaryDeploy` step: deploys a canary of N pods/percent. */
export class K8sCanaryDeployStep extends Step {
  readonly stepType = "K8sCanaryDeploy";

  private readonly instanceSelection: InstanceSelection;
  private readonly skipDryRun?: boolean;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sCanaryDeployStepProps) {
    super(props);
    this.instanceSelection = props.instanceSelection;
    this.skipDryRun = props.skipDryRun;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      instanceSelection: renderInstanceSelection(this.instanceSelection),
      ...(this.skipDryRun !== undefined && { skipDryRun: this.skipDryRun }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sCanaryDelete
// ---------------------------------------------------------------------------

export interface K8sCanaryDeleteStepProps extends StepProps {
  delegateSelectors?: string[];
}

/** A Harness `K8sCanaryDelete` step: removes the canary workload. */
export class K8sCanaryDeleteStep extends Step {
  readonly stepType = "K8sCanaryDelete";

  private readonly delegateSelectors?: string[];

  constructor(props: K8sCanaryDeleteStepProps) {
    super(props);
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sBGSwapServices
// ---------------------------------------------------------------------------

export interface K8sBGSwapServicesStepProps extends StepProps {
  skipDryRun?: boolean;
  delegateSelectors?: string[];
}

/** A Harness `K8sBGSwapServices` step: swaps primary/stage services (BG). */
export class K8sBGSwapServicesStep extends Step {
  readonly stepType = "K8sBGSwapServices";

  private readonly skipDryRun?: boolean;
  private readonly delegateSelectors?: string[];

  constructor(props: K8sBGSwapServicesStepProps) {
    super(props);
    this.skipDryRun = props.skipDryRun;
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.skipDryRun !== undefined && { skipDryRun: this.skipDryRun }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sDiff
// ---------------------------------------------------------------------------

export interface K8sDiffStepProps extends StepProps {
  delegateSelectors?: string[];
}

/** A Harness `K8sDiff` step: shows the diff of rendered manifests. */
export class K8sDiffStep extends Step {
  readonly stepType = "K8sDiff";

  private readonly delegateSelectors?: string[];

  constructor(props: K8sDiffStepProps) {
    super(props);
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sDryRun
// ---------------------------------------------------------------------------

export interface K8sDryRunStepProps extends StepProps {
  /** Encrypt the rendered manifest output published by the step. */
  encryptYamlOutput?: boolean;
  delegateSelectors?: string[];
}

/** A Harness `K8sDryRun` step: renders manifests without applying them. */
export class K8sDryRunStep extends Step {
  readonly stepType = "K8sDryRun";

  private readonly encryptYamlOutput?: boolean;
  private readonly delegateSelectors?: string[];

  constructor(props: K8sDryRunStepProps) {
    super(props);
    this.encryptYamlOutput = props.encryptYamlOutput;
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.encryptYamlOutput !== undefined && {
        encryptYamlOutput: this.encryptYamlOutput,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sPatch
// ---------------------------------------------------------------------------

/** Merge strategy for a `K8sPatch` step (`kubectl patch --type`). */
export type PatchMergeStrategy = "json" | "merge" | "strategic";

export interface K8sPatchStepProps extends StepProps {
  /** Workload to patch, e.g. "Deployment/my-app". */
  workload: string;
  /** Patch source (`StoreConfigWrapper`): where the patch files live. */
  source: Record<string, unknown>;
  mergeStrategyType: PatchMergeStrategy;
  /** Record the patch as a change-cause annotation. */
  recordChangeCause?: boolean;
  skipSteadyStateCheck?: boolean;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sPatch` step: patches a live workload from patch files. */
export class K8sPatchStep extends Step {
  readonly stepType = "K8sPatch";

  private readonly workload: string;
  private readonly source: Record<string, unknown>;
  private readonly mergeStrategyType: PatchMergeStrategy;
  private readonly recordChangeCause?: boolean;
  private readonly skipSteadyStateCheck?: boolean;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sPatchStepProps) {
    super(props);
    this.workload = props.workload;
    this.source = props.source;
    this.mergeStrategyType = props.mergeStrategyType;
    this.recordChangeCause = props.recordChangeCause;
    this.skipSteadyStateCheck = props.skipSteadyStateCheck;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.workload.trim() === "") {
      errors.push("workload must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      workload: this.workload,
      source: this.source,
      mergeStrategyType: this.mergeStrategyType,
      ...(this.recordChangeCause !== undefined && {
        recordChangeCause: this.recordChangeCause,
      }),
      ...(this.skipSteadyStateCheck !== undefined && {
        skipSteadyStateCheck: this.skipSteadyStateCheck,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sRollout
// ---------------------------------------------------------------------------

/** `kubectl rollout` subcommand run by a `K8sRollout` step. */
export type RolloutCommand =
  | "restart"
  | "resume"
  | "status"
  | "undo"
  | "pause"
  | "history";

/** Resources a `K8sRollout` step acts on (`RolloutResourcesWrapper`). */
export type RolloutResources =
  | { type: "ResourceName"; resourceNames: string[] }
  | { type: "ManifestPath"; manifestPaths: string[] };

function renderRolloutResources(r: RolloutResources): Record<string, unknown> {
  return r.type === "ResourceName"
    ? { type: "ResourceName", spec: { resourceNames: r.resourceNames } }
    : { type: "ManifestPath", spec: { manifestPaths: r.manifestPaths } };
}

export interface K8sRolloutStepProps extends StepProps {
  command: RolloutCommand;
  resources: RolloutResources;
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sRollout` step: runs a `kubectl rollout` subcommand. */
export class K8sRolloutStep extends Step {
  readonly stepType = "K8sRollout";

  private readonly command: RolloutCommand;
  private readonly resources: RolloutResources;
  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sRolloutStepProps) {
    super(props);
    this.command = props.command;
    this.resources = props.resources;
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      command: this.command,
      resources: renderRolloutResources(this.resources),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sTrafficRouting
// ---------------------------------------------------------------------------

export interface K8sTrafficRoutingStepProps extends StepProps {
  /** `inherit` a routing config from an earlier step, or supply a `config`. */
  type: "inherit" | "config";
  /** Traffic-routing provider config (`K8sTrafficRoutingSpec`). */
  trafficRouting: Record<string, unknown>;
  delegateSelectors?: string[];
}

/** A Harness `K8sTrafficRouting` step: shifts traffic via a mesh/ingress. */
export class K8sTrafficRoutingStep extends Step {
  readonly stepType = "K8sTrafficRouting";

  private readonly type: "inherit" | "config";
  private readonly trafficRouting: Record<string, unknown>;
  private readonly delegateSelectors?: string[];

  constructor(props: K8sTrafficRoutingStepProps) {
    super(props);
    this.type = props.type;
    this.trafficRouting = props.trafficRouting;
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      type: this.type,
      trafficRouting: this.trafficRouting,
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sBlueGreenStageScaleDown
// ---------------------------------------------------------------------------

export interface K8sBlueGreenStageScaleDownStepProps extends StepProps {
  delegateSelectors?: string[];
}

/** A Harness `K8sBlueGreenStageScaleDown` step: scales down the stage color. */
export class K8sBlueGreenStageScaleDownStep extends Step {
  readonly stepType = "K8sBlueGreenStageScaleDown";

  private readonly delegateSelectors?: string[];

  constructor(props: K8sBlueGreenStageScaleDownStepProps) {
    super(props);
    this.delegateSelectors = props.delegateSelectors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sBlueGreenStageScaleUp
// ---------------------------------------------------------------------------

/** Whether stage-scale-up sizes from the primary automatically or explicitly. */
export type ReplicaCountMode = "Auto" | "Custom";

export interface K8sBlueGreenStageScaleUpStepProps extends StepProps {
  /** Defaults to "Auto" on the Harness side when omitted. */
  replicaCountMode?: ReplicaCountMode;
  /** Required when `replicaCountMode` is "Custom". */
  instanceSelection?: InstanceSelection;
  skipSteadyStateCheck?: boolean;
  delegateSelectors?: string[];
}

/** A Harness `K8sBlueGreenStageScaleUp` step: scales the stage color back up. */
export class K8sBlueGreenStageScaleUpStep extends Step {
  readonly stepType = "K8sBlueGreenStageScaleUp";

  private readonly replicaCountMode?: ReplicaCountMode;
  private readonly instanceSelection?: InstanceSelection;
  private readonly skipSteadyStateCheck?: boolean;
  private readonly delegateSelectors?: string[];

  constructor(props: K8sBlueGreenStageScaleUpStepProps) {
    super(props);
    this.replicaCountMode = props.replicaCountMode;
    this.instanceSelection = props.instanceSelection;
    this.skipSteadyStateCheck = props.skipSteadyStateCheck;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.replicaCountMode === "Custom" && this.instanceSelection === undefined) {
      errors.push(
        'instanceSelection is required when replicaCountMode is "Custom"',
      );
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.replicaCountMode !== undefined && {
        replicaCountMode: this.replicaCountMode,
      }),
      ...(this.instanceSelection !== undefined && {
        instanceSelection: renderInstanceSelection(this.instanceSelection),
      }),
      ...(this.skipSteadyStateCheck !== undefined && {
        skipSteadyStateCheck: this.skipSteadyStateCheck,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// K8sProgressiveCanaryRollback
// ---------------------------------------------------------------------------

export interface K8sProgressiveCanaryRollbackStepProps extends StepProps {
  delegateSelectors?: string[];
  commandFlags?: K8sCommandFlag[];
}

/** A Harness `K8sProgressiveCanaryRollback` step: rolls back a progressive canary. */
export class K8sProgressiveCanaryRollbackStep extends Step {
  readonly stepType = "K8sProgressiveCanaryRollback";

  private readonly delegateSelectors?: string[];
  private readonly commandFlags?: K8sCommandFlag[];

  constructor(props: K8sProgressiveCanaryRollbackStepProps) {
    super(props);
    this.delegateSelectors = props.delegateSelectors;
    this.commandFlags = props.commandFlags;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
      ...(this.commandFlags !== undefined && { commandFlags: this.commandFlags }),
    };
  }
}
