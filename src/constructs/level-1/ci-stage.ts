import { Stage, type StageProps, type ExecutionItem } from "./stage.js";

/** Operating system for a CI build, per the schema's `Platform.os` enum. */
export type CIOs = "Linux" | "MacOS" | "Windows";
/** CPU architecture for a CI build, per the schema's `Platform.arch` enum. */
export type CIArch = "Amd64" | "Arm64";

/**
 * The `platform` block of a CI stage (`Platform`): the OS/arch the build runs
 * on. Paired with a {@link CIRuntime} for the hosted "Harness Cloud" path.
 */
export interface CIPlatform {
  os: CIOs;
  arch: CIArch;
}

/**
 * The `runtime` block of a CI stage. `Cloud` runs on Harness-hosted machines
 * (`CloudRuntime`); `Docker` runs on a local Docker daemon (`DockerRuntime`).
 * `size`/`harnessImageConnectorRef` are optional refinements of each.
 */
export type CIRuntime =
  | { type: "Cloud"; size?: string; imageName?: string; nestedVirtualization?: boolean }
  | { type: "Docker"; harnessImageConnectorRef?: string };

/**
 * A CI build `infrastructure` block. Models the two common self-managed
 * variants: `KubernetesDirect` (runs pods on a cluster, needs a connector +
 * namespace) and `UseFromStage` (reuse another stage's infrastructure). Less
 * common specs can extend this union later.
 */
export type CIInfrastructure =
  | {
      type: "KubernetesDirect";
      connectorRef: string;
      namespace: string;
      os?: CIOs;
      /** Connector used to pull Harness images into the cluster. */
      harnessImageConnectorRef?: string;
      serviceAccountName?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    }
  | {
      type: "UseFromStage";
      /** Identifier of the stage whose infrastructure is reused. */
      useFromStage: string;
    };

/** The `caching` block of a CI stage (`Caching`). */
export interface CICaching {
  enabled: boolean;
  key?: string;
  override?: boolean;
  paths?: string[];
  policy?: string;
}

export interface CIStageProps extends StageProps {
  /**
   * Clone the pipeline's connected codebase into the workspace before running
   * steps. Defaults to Harness's own default (`true`) when omitted.
   */
  cloneCodebase?: boolean;
  /**
   * Hosted-machine platform. Provide together with {@link runtime} for the
   * Harness Cloud path; omit both when using {@link infrastructure}.
   */
  platform?: CIPlatform;
  /** Execution runtime (Cloud or Docker); pairs with {@link platform}. */
  runtime?: CIRuntime;
  /** Self-managed build infrastructure (Kubernetes / reused stage). */
  infrastructure?: CIInfrastructure;
  /** Remote-cache configuration for the build. */
  caching?: CICaching;
  /** Paths shared across steps within the stage. */
  sharedPaths?: string[];
  /** The build/test steps (e.g. Run, RunTests, BuildAndPushDockerRegistry). */
  steps?: ExecutionItem[];
}

/**
 * A Harness CI (Integration) stage (`type: CI`): builds and tests code.
 * Renders the `IntegrationStageConfigImpl` spec — `cloneCodebase`, the build
 * environment (`platform` + `runtime` for Harness Cloud, or `infrastructure`
 * for a self-managed cluster), and an `execution` with `steps`.
 */
export class CIStage extends Stage {
  readonly stageType = "CI";

  private readonly cloneCodebase?: boolean;
  private readonly platform?: CIPlatform;
  private readonly runtime?: CIRuntime;
  private readonly infrastructure?: CIInfrastructure;
  private readonly caching?: CICaching;
  private readonly sharedPaths?: string[];
  private readonly steps: ExecutionItem[] = [];

  constructor(props: CIStageProps) {
    super(props);
    this.cloneCodebase = props.cloneCodebase;
    this.platform = props.platform;
    this.runtime = props.runtime;
    this.infrastructure = props.infrastructure;
    this.caching = props.caching;
    this.sharedPaths = props.sharedPaths;
    for (const step of props.steps ?? []) {
      this.steps.push(step);
    }
  }

  addStep(item: ExecutionItem): this {
    this.steps.push(item);
    return this;
  }

  override validate(): string[] {
    const errors = super.validate();

    const hasCloud = this.platform !== undefined || this.runtime !== undefined;
    if (hasCloud && this.infrastructure !== undefined) {
      errors.push(
        "specify either platform/runtime or infrastructure, not both",
      );
    }
    if (!hasCloud && this.infrastructure === undefined) {
      errors.push("stage must define a build environment (platform/runtime or infrastructure)");
    }
    if (hasCloud && (this.platform === undefined || this.runtime === undefined)) {
      errors.push("platform and runtime must be provided together");
    }
    if (this.infrastructure?.type === "KubernetesDirect") {
      if (!this.infrastructure.connectorRef) {
        errors.push("KubernetesDirect infrastructure requires a connectorRef");
      }
      if (!this.infrastructure.namespace) {
        errors.push("KubernetesDirect infrastructure requires a namespace");
      }
    }

    if (this.steps.length === 0) {
      errors.push("stage must contain at least one step");
    }
    const seen = new Set<string>();
    for (const item of this.steps) {
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
      ...(this.cloneCodebase !== undefined && { cloneCodebase: this.cloneCodebase }),
      ...(this.platform !== undefined && { platform: { ...this.platform } }),
      ...(this.runtime !== undefined && { runtime: this.renderRuntime(this.runtime) }),
      ...(this.infrastructure !== undefined && {
        infrastructure: this.renderInfrastructure(this.infrastructure),
      }),
      ...(this.caching !== undefined && { caching: this.renderCaching(this.caching) }),
      ...(this.sharedPaths !== undefined && { sharedPaths: this.sharedPaths }),
      execution: {
        steps: this.steps.map((item) => item.toJson()),
      },
    };
  }

  private renderRuntime(runtime: CIRuntime): Record<string, unknown> {
    if (runtime.type === "Cloud") {
      const spec: Record<string, unknown> = {};
      if (runtime.size !== undefined) spec.size = runtime.size;
      if (runtime.imageName !== undefined) spec.imageName = runtime.imageName;
      if (runtime.nestedVirtualization !== undefined) {
        spec.nestedVirtualization = runtime.nestedVirtualization;
      }
      return { type: "Cloud", spec };
    }
    const spec: Record<string, unknown> = {};
    if (runtime.harnessImageConnectorRef !== undefined) {
      spec.harnessImageConnectorRef = runtime.harnessImageConnectorRef;
    }
    return { type: "Docker", spec };
  }

  private renderInfrastructure(infra: CIInfrastructure): Record<string, unknown> {
    if (infra.type === "UseFromStage") {
      return { type: "UseFromStage", useFromStage: infra.useFromStage };
    }
    const spec: Record<string, unknown> = {
      connectorRef: infra.connectorRef,
      namespace: infra.namespace,
    };
    if (infra.os !== undefined) spec.os = infra.os;
    if (infra.harnessImageConnectorRef !== undefined) {
      spec.harnessImageConnectorRef = infra.harnessImageConnectorRef;
    }
    if (infra.serviceAccountName !== undefined) {
      spec.serviceAccountName = infra.serviceAccountName;
    }
    if (infra.labels !== undefined) spec.labels = infra.labels;
    if (infra.annotations !== undefined) spec.annotations = infra.annotations;
    return { type: "KubernetesDirect", spec };
  }

  private renderCaching(caching: CICaching): Record<string, unknown> {
    return {
      enabled: caching.enabled,
      ...(caching.key !== undefined && { key: caching.key }),
      ...(caching.override !== undefined && { override: caching.override }),
      ...(caching.paths !== undefined && { paths: caching.paths }),
      ...(caching.policy !== undefined && { policy: caching.policy }),
    };
  }
}
