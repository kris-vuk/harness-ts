import { Step, type StepProps } from "./step.js";
import { type NGVariable, renderVariable } from "./ng-variable.js";

/**
 * The Terraform provisioner step family. Every class extends the abstract
 * {@link Step} directly (flat lineage, no shared base class), but the four
 * steps share a large config surface — a config-files store, var files, a
 * backend config, environment variables, and CLI flags — factored into the
 * value objects and `render*`/`validate*` helpers below.
 *
 * Specs follow the v0 pipeline schema (`Terraform{Apply,Plan,Destroy,
 * Rollback}StepInfo`, under `definitions.pipeline.steps.cd`). Fields Harness
 * accepts as either a literal or a runtime expression string are typed as
 * such.
 */

// ---------------------------------------------------------------------------
// Shared value objects
// ---------------------------------------------------------------------------

/** Git provider for a Terraform config/var-file store (`StoreConfigWrapper.type`). */
export type GitStoreType = "Git" | "Github" | "GitLab" | "Bitbucket";

/**
 * A Git-backed store for config files or a remote var file
 * (`StoreConfigWrapper` + `GithubStore`-style spec). Points at a folder within
 * a repository, resolved either by branch or by commit.
 */
export interface GitStore {
  type: GitStoreType;
  connectorRef: string;
  gitFetchType: "Branch" | "Commit";
  /** Set when `gitFetchType` is "Branch". */
  branch?: string;
  /** Set when `gitFetchType` is "Commit". */
  commitId?: string;
  /** Repo name, when the connector is account/org level. */
  repoName?: string;
  folderPath?: string;
  paths?: string[] | string;
}

function validateGitStore(s: GitStore, label: string): string[] {
  const errors: string[] = [];
  if (s.connectorRef.trim() === "") {
    errors.push(`${label}: store connectorRef must not be empty`);
  }
  if (s.gitFetchType === "Branch" && s.branch === undefined) {
    errors.push(`${label}: store gitFetchType "Branch" requires a branch`);
  }
  if (s.gitFetchType === "Commit" && s.commitId === undefined) {
    errors.push(`${label}: store gitFetchType "Commit" requires a commitId`);
  }
  return errors;
}

function renderGitStore(s: GitStore): Record<string, unknown> {
  return {
    type: s.type,
    spec: {
      connectorRef: s.connectorRef,
      gitFetchType: s.gitFetchType,
      ...(s.branch !== undefined && { branch: s.branch }),
      ...(s.commitId !== undefined && { commitId: s.commitId }),
      ...(s.repoName !== undefined && { repoName: s.repoName }),
      ...(s.folderPath !== undefined && { folderPath: s.folderPath }),
      ...(s.paths !== undefined && { paths: s.paths }),
    },
  };
}

/**
 * A Terraform var file (`TerraformVarFile`): either inline HCL `content` or a
 * remote {@link GitStore}. `identifier` is unique within the step.
 */
export type TerraformVarFile =
  | { identifier: string; type: "Inline"; content: string }
  | { identifier: string; type: "Remote"; store: GitStore; optional?: boolean | string };

function validateVarFile(v: TerraformVarFile): string[] {
  const errors: string[] = [];
  if (v.identifier.trim() === "") {
    errors.push("var file identifier must not be empty");
  }
  if (v.type === "Inline" && v.content.trim() === "") {
    errors.push(`var file "${v.identifier}": inline content must not be empty`);
  }
  if (v.type === "Remote") {
    errors.push(...validateGitStore(v.store, `var file "${v.identifier}"`));
  }
  return errors;
}

function renderVarFile(v: TerraformVarFile): Record<string, unknown> {
  if (v.type === "Inline") {
    return {
      varFile: {
        identifier: v.identifier,
        type: "Inline",
        spec: { content: v.content },
      },
    };
  }
  return {
    varFile: {
      identifier: v.identifier,
      type: "Remote",
      spec: {
        store: renderGitStore(v.store),
        ...(v.optional !== undefined && { optional: v.optional }),
      },
    },
  };
}

/**
 * A Terraform backend configuration (`TerraformBackendConfig`): either inline
 * HCL `content` or a remote {@link GitStore}.
 */
export type TerraformBackendConfig =
  | { type: "Inline"; content: string }
  | { type: "Remote"; store: GitStore };

function renderBackendConfig(b: TerraformBackendConfig): Record<string, unknown> {
  if (b.type === "Inline") {
    return { type: "Inline", spec: { content: b.content } };
  }
  return { type: "Remote", spec: { store: renderGitStore(b.store) } };
}

/** Terraform command a CLI flag applies to (`TerraformCliOptionFlag.commandType`). */
export type TerraformCommandType =
  | "INIT"
  | "WORKSPACE"
  | "REFRESH"
  | "PLAN"
  | "APPLY"
  | "DESTROY";

/** A CLI option flag scoped to a Terraform command (`TerraformCliOptionFlag`). */
export interface TerraformCliFlag {
  commandType: TerraformCommandType;
  flag: string;
}

/**
 * The config-files + execution surface shared by Apply, Plan, and Destroy.
 * `configFiles` is required; the rest are optional refinements.
 */
export interface TerraformExecutionConfig {
  /** Where the root Terraform module lives. */
  configFiles: GitStore;
  /**
   * Module-source options for `configFiles` (`ModuleSource`), rendered as a
   * sibling of `configFiles.store`. Set `useConnectorCredentials` to reuse the
   * config-files connector's credentials when fetching remote modules.
   */
  moduleSource?: { useConnectorCredentials: boolean | string };
  varFiles?: TerraformVarFile[];
  backendConfig?: TerraformBackendConfig;
  /** Terraform env vars (`TF_VAR_*` etc.); reuses the NGVariable union. */
  environmentVariables?: NGVariable[];
  /** Resource address targets (`-target`). */
  targets?: string[] | string;
  workspace?: string;
  commandFlags?: TerraformCliFlag[];
  skipRefreshCommand?: boolean | string;
  skipStateStorage?: boolean | string;
}

function validateExecutionConfig(
  c: TerraformExecutionConfig,
): string[] {
  const errors: string[] = [];
  errors.push(...validateGitStore(c.configFiles, "configFiles"));
  const seen = new Set<string>();
  for (const v of c.varFiles ?? []) {
    if (seen.has(v.identifier)) {
      errors.push(`duplicate var file identifier "${v.identifier}"`);
    }
    seen.add(v.identifier);
    errors.push(...validateVarFile(v));
  }
  return errors;
}

function renderExecutionConfig(
  c: TerraformExecutionConfig,
): Record<string, unknown> {
  return {
    configFiles: {
      store: renderGitStore(c.configFiles),
      ...(c.moduleSource !== undefined && { moduleSource: c.moduleSource }),
    },
    ...(c.varFiles !== undefined && { varFiles: c.varFiles.map(renderVarFile) }),
    ...(c.backendConfig !== undefined && {
      backendConfig: renderBackendConfig(c.backendConfig),
    }),
    ...(c.environmentVariables !== undefined && {
      environmentVariables: c.environmentVariables.map(renderVariable),
    }),
    ...(c.targets !== undefined && { targets: c.targets }),
    ...(c.workspace !== undefined && { workspace: c.workspace }),
    ...(c.skipRefreshCommand !== undefined && {
      skipRefreshCommand: c.skipRefreshCommand,
    }),
    ...(c.skipStateStorage !== undefined && {
      skipStateStorage: c.skipStateStorage,
    }),
  };
}

function renderCliFlags(flags: TerraformCliFlag[]): Record<string, unknown>[] {
  return flags.map((f) => ({ commandType: f.commandType, flag: f.flag }));
}

// ---------------------------------------------------------------------------
// TerraformApply
// ---------------------------------------------------------------------------

/**
 * How an Apply/Destroy step sources its plan (`TerraformStepConfiguration`):
 * `Inline` runs from its own config; `InheritFromPlan` reuses a prior
 * `TerraformPlan`; `InheritFromApply` (Destroy only) reuses a prior Apply.
 */
export type TerraformConfigurationType =
  | "Inline"
  | "InheritFromPlan"
  | "InheritFromApply";

export interface TerraformApplyStepProps extends StepProps {
  /** Links Plan/Apply/Destroy/Rollback steps to the same state. */
  provisionerIdentifier: string;
  configurationType: TerraformConfigurationType;
  /** Required when `configurationType` is "Inline". */
  configuration?: TerraformExecutionConfig;
  commandFlags?: TerraformCliFlag[];
  delegateSelectors?: string[];
}

/**
 * A Harness `TerraformApply` step (`type: TerraformApply`): applies Terraform
 * config, either inline or inheriting a prior plan. Renders
 * `TerraformApplyStepInfo`.
 */
export class TerraformApplyStep extends Step {
  readonly stepType = "TerraformApply";

  private readonly props: TerraformApplyStepProps;

  constructor(props: TerraformApplyStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    const p = this.props;
    if (p.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    if (p.configurationType === "Inline" && p.configuration === undefined) {
      errors.push('configuration is required when configurationType is "Inline"');
    }
    if (p.configuration !== undefined) {
      errors.push(...validateExecutionConfig(p.configuration));
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      provisionerIdentifier: p.provisionerIdentifier,
      configuration: {
        type: p.configurationType,
        ...(p.configuration !== undefined && {
          spec: renderExecutionConfig(p.configuration),
        }),
        ...(p.commandFlags !== undefined && {
          commandFlags: renderCliFlags(p.commandFlags),
        }),
      },
      ...(p.delegateSelectors !== undefined && {
        delegateSelectors: p.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// TerraformDestroy
// ---------------------------------------------------------------------------

export interface TerraformDestroyStepProps extends StepProps {
  provisionerIdentifier: string;
  configurationType: TerraformConfigurationType;
  /** Required when `configurationType` is "Inline". */
  configuration?: TerraformExecutionConfig;
  commandFlags?: TerraformCliFlag[];
  delegateSelectors?: string[];
}

/**
 * A Harness `TerraformDestroy` step (`type: TerraformDestroy`): destroys
 * provisioned resources. Renders `TerraformDestroyStepInfo`.
 */
export class TerraformDestroyStep extends Step {
  readonly stepType = "TerraformDestroy";

  private readonly props: TerraformDestroyStepProps;

  constructor(props: TerraformDestroyStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    const p = this.props;
    if (p.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    if (p.configurationType === "Inline" && p.configuration === undefined) {
      errors.push('configuration is required when configurationType is "Inline"');
    }
    if (p.configuration !== undefined) {
      errors.push(...validateExecutionConfig(p.configuration));
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      provisionerIdentifier: p.provisionerIdentifier,
      configuration: {
        type: p.configurationType,
        ...(p.configuration !== undefined && {
          spec: renderExecutionConfig(p.configuration),
        }),
        ...(p.commandFlags !== undefined && {
          commandFlags: renderCliFlags(p.commandFlags),
        }),
      },
      ...(p.delegateSelectors !== undefined && {
        delegateSelectors: p.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// TerraformPlan
// ---------------------------------------------------------------------------

export interface TerraformPlanStepProps extends StepProps {
  provisionerIdentifier: string;
  /** Whether the plan is for an apply or a destroy. */
  command: "Apply" | "Destroy";
  /** Secret manager storing the generated plan. */
  secretManagerRef: string;
  configuration: TerraformExecutionConfig;
  exportTerraformPlanJson?: boolean | string;
  exportTerraformHumanReadablePlan?: boolean | string;
  /** Store the generated plan on the delegate rather than the Harness secret manager. */
  storeTfPlanOnDelegate?: boolean | string;
  commandFlags?: TerraformCliFlag[];
  delegateSelectors?: string[];
}

/**
 * A Harness `TerraformPlan` step (`type: TerraformPlan`): generates and stores
 * a Terraform plan for a later Apply/Destroy to inherit. Renders
 * `TerraformPlanStepInfo` (whose `configuration` is `TerraformPlanExecutionData`,
 * carrying `command` + `secretManagerRef` alongside the shared execution data).
 */
export class TerraformPlanStep extends Step {
  readonly stepType = "TerraformPlan";

  private readonly props: TerraformPlanStepProps;

  constructor(props: TerraformPlanStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    const p = this.props;
    if (p.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    if (p.secretManagerRef.trim() === "") {
      errors.push("secretManagerRef must not be empty");
    }
    errors.push(...validateExecutionConfig(p.configuration));
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      provisionerIdentifier: p.provisionerIdentifier,
      configuration: {
        command: p.command,
        secretManagerRef: p.secretManagerRef,
        ...renderExecutionConfig(p.configuration),
        ...(p.exportTerraformPlanJson !== undefined && {
          exportTerraformPlanJson: p.exportTerraformPlanJson,
        }),
        ...(p.exportTerraformHumanReadablePlan !== undefined && {
          exportTerraformHumanReadablePlan: p.exportTerraformHumanReadablePlan,
        }),
        ...(p.storeTfPlanOnDelegate !== undefined && {
          storeTfPlanOnDelegate: p.storeTfPlanOnDelegate,
        }),
        ...(p.commandFlags !== undefined && {
          commandFlags: renderCliFlags(p.commandFlags),
        }),
      },
      ...(p.delegateSelectors !== undefined && {
        delegateSelectors: p.delegateSelectors,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// TerraformRollback
// ---------------------------------------------------------------------------

export interface TerraformRollbackStepProps extends StepProps {
  provisionerIdentifier: string;
  skipRefreshCommand?: boolean | string;
  commandFlags?: TerraformCliFlag[];
  delegateSelectors?: string[];
}

/**
 * A Harness `TerraformRollback` step (`type: TerraformRollback`): rolls state
 * back to the last successful provision for a `provisionerIdentifier`. Renders
 * `TerraformRollbackStepInfo`.
 */
export class TerraformRollbackStep extends Step {
  readonly stepType = "TerraformRollback";

  private readonly props: TerraformRollbackStepProps;

  constructor(props: TerraformRollbackStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      provisionerIdentifier: p.provisionerIdentifier,
      ...(p.skipRefreshCommand !== undefined && {
        skipRefreshCommand: p.skipRefreshCommand,
      }),
      ...(p.commandFlags !== undefined && {
        commandFlags: renderCliFlags(p.commandFlags),
      }),
      ...(p.delegateSelectors !== undefined && {
        delegateSelectors: p.delegateSelectors,
      }),
    };
  }
}
