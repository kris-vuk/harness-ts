import { Step, type StepProps } from "./step.js";
import {
  type ImagePullPolicy,
  type ContainerResource,
} from "./aws-cdk-steps.js";

/**
 * The CI (Integration) step family — the build/test steps that run inside a
 * {@link CIStage}. Every class extends the abstract {@link Step} directly (no
 * shared base class), following the flat step lineage. Specs mirror the v0
 * pipeline schema (`RunStepInfo`, `RunTestsStepInfo`, `PluginStepInfo`,
 * `BackgroundStepInfo`, `GitCloneStepInfo`, `ActionStepInfo`,
 * `BitriseStepInfo`). Fields Harness accepts as either a literal or a runtime
 * expression string are typed as such.
 */

/** Shell used by `Run`/`RunTests`/`Background` steps (`shell`). */
export type CIShell = "Sh" | "Bash" | "Powershell" | "Pwsh" | "Python";

/** An output variable exported by a step (`OutputNGVariable`). */
export interface CIOutputVariable {
  name: string;
}

/**
 * A test report attached to a step (`UnitTestReport`). Only the `JUnit`
 * variant exists in the schema: a set of result-file globs.
 */
export interface JUnitReport {
  type: "JUnit";
  paths: string[] | string;
}

function renderReports(report: JUnitReport): Record<string, unknown> {
  return { type: report.type, spec: { paths: report.paths } };
}

function renderOutputVariables(
  vars: CIOutputVariable[] | string,
): unknown {
  if (typeof vars === "string") return vars;
  return vars.map((v) => ({ name: v.name }));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface RunStepProps extends StepProps {
  /** Shell command(s) to run. */
  command: string;
  /** Container image the command runs in (required off Harness Cloud). */
  image?: string;
  /** Container-registry connector for `image`. */
  connectorRef?: string;
  shell?: CIShell;
  envVariables?: Record<string, string> | string;
  outputVariables?: CIOutputVariable[] | string;
  reports?: JUnitReport;
  imagePullPolicy?: ImagePullPolicy;
  privileged?: boolean | string;
  runAsUser?: number | string;
  resources?: ContainerResource;
}

/**
 * A CI `Run` step (`type: Run`): executes shell commands in a container.
 * Renders `RunStepInfo`.
 */
export class RunStep extends Step {
  readonly stepType = "Run";

  private readonly props: RunStepProps;

  constructor(props: RunStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.command.trim() === "") {
      errors.push("command must not be empty");
    }
    if (this.props.image !== undefined && this.props.connectorRef === undefined) {
      errors.push("connectorRef is required when image is set");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      command: p.command,
      ...(p.connectorRef !== undefined && { connectorRef: p.connectorRef }),
      ...(p.image !== undefined && { image: p.image }),
      ...(p.shell !== undefined && { shell: p.shell }),
      ...(p.envVariables !== undefined && { envVariables: p.envVariables }),
      ...(p.outputVariables !== undefined && {
        outputVariables: renderOutputVariables(p.outputVariables),
      }),
      ...(p.reports !== undefined && { reports: renderReports(p.reports) }),
      ...(p.imagePullPolicy !== undefined && { imagePullPolicy: p.imagePullPolicy }),
      ...(p.privileged !== undefined && { privileged: p.privileged }),
      ...(p.runAsUser !== undefined && { runAsUser: p.runAsUser }),
      ...(p.resources !== undefined && { resources: p.resources }),
    };
  }
}

// ---------------------------------------------------------------------------
// RunTests
// ---------------------------------------------------------------------------

/** Build tool for a `RunTests` step (`buildTool`). */
export type BuildTool =
  | "Maven"
  | "Bazel"
  | "Gradle"
  | "Dotnet"
  | "Nunitconsole"
  | "SBT"
  | "Pytest"
  | "Unittest"
  | "Rspec";

/** Source language for a `RunTests` step (`language`). */
export type TestLanguage =
  | "Java"
  | "Kotlin"
  | "Scala"
  | "Csharp"
  | "Python"
  | "Ruby";

/** Strategy for splitting tests across parallel runners (`testSplitStrategy`). */
export type TestSplitStrategy = "ClassTiming" | "TestCount";

export interface RunTestsStepProps extends StepProps {
  buildTool: BuildTool;
  language: TestLanguage;
  args?: string;
  packages?: string;
  namespaces?: string;
  image?: string;
  connectorRef?: string;
  shell?: CIShell;
  /** Run only the tests Harness selects via Test Intelligence. */
  runOnlySelectedTests?: boolean | string;
  enableTestSplitting?: boolean;
  testSplitStrategy?: TestSplitStrategy;
  preCommand?: string;
  postCommand?: string;
  testRoot?: string;
  testGlobs?: string;
  testAnnotations?: string;
  envVariables?: Record<string, string> | string;
  outputVariables?: CIOutputVariable[] | string;
  reports?: JUnitReport;
  imagePullPolicy?: ImagePullPolicy;
  privileged?: boolean | string;
  runAsUser?: number | string;
  resources?: ContainerResource;
}

/**
 * A CI `RunTests` step (`type: RunTests`): runs tests with Test Intelligence.
 * Renders `RunTestsStepInfo`.
 */
export class RunTestsStep extends Step {
  readonly stepType = "RunTests";

  private readonly props: RunTestsStepProps;

  constructor(props: RunTestsStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.image !== undefined && this.props.connectorRef === undefined) {
      errors.push("connectorRef is required when image is set");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      buildTool: p.buildTool,
      language: p.language,
      ...(p.args !== undefined && { args: p.args }),
      ...(p.packages !== undefined && { packages: p.packages }),
      ...(p.namespaces !== undefined && { namespaces: p.namespaces }),
      ...(p.connectorRef !== undefined && { connectorRef: p.connectorRef }),
      ...(p.image !== undefined && { image: p.image }),
      ...(p.shell !== undefined && { shell: p.shell }),
      ...(p.runOnlySelectedTests !== undefined && {
        runOnlySelectedTests: p.runOnlySelectedTests,
      }),
      ...(p.enableTestSplitting !== undefined && {
        enableTestSplitting: p.enableTestSplitting,
      }),
      ...(p.testSplitStrategy !== undefined && {
        testSplitStrategy: p.testSplitStrategy,
      }),
      ...(p.preCommand !== undefined && { preCommand: p.preCommand }),
      ...(p.postCommand !== undefined && { postCommand: p.postCommand }),
      ...(p.testRoot !== undefined && { testRoot: p.testRoot }),
      ...(p.testGlobs !== undefined && { testGlobs: p.testGlobs }),
      ...(p.testAnnotations !== undefined && { testAnnotations: p.testAnnotations }),
      ...(p.envVariables !== undefined && { envVariables: p.envVariables }),
      ...(p.outputVariables !== undefined && {
        outputVariables: renderOutputVariables(p.outputVariables),
      }),
      ...(p.reports !== undefined && { reports: renderReports(p.reports) }),
      ...(p.imagePullPolicy !== undefined && { imagePullPolicy: p.imagePullPolicy }),
      ...(p.privileged !== undefined && { privileged: p.privileged }),
      ...(p.runAsUser !== undefined && { runAsUser: p.runAsUser }),
      ...(p.resources !== undefined && { resources: p.resources }),
    };
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface PluginStepProps extends StepProps {
  /** Plugin container image, e.g. "plugins/docker". */
  image?: string;
  connectorRef?: string;
  /** Drone/Harness plugin reference (`uses`), e.g. a normalized action. */
  uses?: string;
  /** Plugin settings passed as `PLUGIN_*` env vars. */
  settings?: Record<string, string> | string;
  entrypoint?: string[] | string;
  reports?: JUnitReport;
  imagePullPolicy?: ImagePullPolicy;
  privileged?: boolean | string;
  runAsUser?: number | string;
  resources?: ContainerResource;
}

/**
 * A CI `Plugin` step (`type: Plugin`): runs a Drone/Harness plugin container.
 * Renders `PluginStepInfo`.
 */
export class PluginStep extends Step {
  readonly stepType = "Plugin";

  private readonly props: PluginStepProps;

  constructor(props: PluginStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.image === undefined && this.props.uses === undefined) {
      errors.push("either image or uses must be set");
    }
    if (this.props.image !== undefined && this.props.connectorRef === undefined) {
      errors.push("connectorRef is required when image is set");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      ...(p.connectorRef !== undefined && { connectorRef: p.connectorRef }),
      ...(p.image !== undefined && { image: p.image }),
      ...(p.uses !== undefined && { uses: p.uses }),
      ...(p.settings !== undefined && { settings: p.settings }),
      ...(p.entrypoint !== undefined && { entrypoint: p.entrypoint }),
      ...(p.reports !== undefined && { reports: renderReports(p.reports) }),
      ...(p.imagePullPolicy !== undefined && { imagePullPolicy: p.imagePullPolicy }),
      ...(p.privileged !== undefined && { privileged: p.privileged }),
      ...(p.runAsUser !== undefined && { runAsUser: p.runAsUser }),
      ...(p.resources !== undefined && { resources: p.resources }),
    };
  }
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

export interface BackgroundStepProps extends StepProps {
  /** Container image for the background service. */
  image?: string;
  connectorRef?: string;
  /** Command to launch the service; left running for later steps. */
  command?: string;
  shell?: CIShell;
  entrypoint?: string[] | string;
  envVariables?: Record<string, string> | string;
  /** Host<->container port mappings. */
  portBindings?: Record<string, string> | string;
  imagePullPolicy?: ImagePullPolicy;
  privileged?: boolean | string;
  runAsUser?: number | string;
  resources?: ContainerResource;
}

/**
 * A CI `Background` step (`type: Background`): starts a long-running service
 * (e.g. a database) alongside the build. Renders `BackgroundStepInfo`.
 */
export class BackgroundStep extends Step {
  readonly stepType = "Background";

  private readonly props: BackgroundStepProps;

  constructor(props: BackgroundStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.image !== undefined && this.props.connectorRef === undefined) {
      errors.push("connectorRef is required when image is set");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      ...(p.connectorRef !== undefined && { connectorRef: p.connectorRef }),
      ...(p.image !== undefined && { image: p.image }),
      ...(p.command !== undefined && { command: p.command }),
      ...(p.shell !== undefined && { shell: p.shell }),
      ...(p.entrypoint !== undefined && { entrypoint: p.entrypoint }),
      ...(p.envVariables !== undefined && { envVariables: p.envVariables }),
      ...(p.portBindings !== undefined && { portBindings: p.portBindings }),
      ...(p.imagePullPolicy !== undefined && { imagePullPolicy: p.imagePullPolicy }),
      ...(p.privileged !== undefined && { privileged: p.privileged }),
      ...(p.runAsUser !== undefined && { runAsUser: p.runAsUser }),
      ...(p.resources !== undefined && { resources: p.resources }),
    };
  }
}

// ---------------------------------------------------------------------------
// GitClone
// ---------------------------------------------------------------------------

/** A `Build` reference: which branch/tag/PR/commit to clone (`Build`). */
export type GitBuild =
  | { type: "branch"; branch: string }
  | { type: "tag"; tag: string }
  | { type: "PR"; number: string | number }
  | { type: "commitSha"; commitSha: string };

function renderBuild(build: GitBuild): Record<string, unknown> {
  switch (build.type) {
    case "branch":
      return { type: "branch", spec: { branch: build.branch } };
    case "tag":
      return { type: "tag", spec: { tag: build.tag } };
    case "PR":
      return { type: "PR", spec: { number: build.number } };
    case "commitSha":
      return { type: "commitSha", spec: { commitSha: build.commitSha } };
  }
}

export interface GitCloneStepProps extends StepProps {
  /** Code-repo connector. */
  connectorRef?: string;
  /** Repository name (when the connector is account-level). */
  repoName?: string;
  /** Which ref to clone. */
  build: GitBuild;
  cloneDirectory?: string;
  depth?: number | string;
  sslVerify?: boolean | string;
  lfs?: boolean | string;
  fetchTags?: boolean | string;
  resources?: ContainerResource;
  runAsUser?: number | string;
}

/**
 * A CI `GitClone` step (`type: GitClone`): clones an additional repository
 * into the workspace. Renders `GitCloneStepInfo`.
 */
export class GitCloneStep extends Step {
  readonly stepType = "GitClone";

  private readonly props: GitCloneStepProps;

  constructor(props: GitCloneStepProps) {
    super(props);
    this.props = props;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      ...(p.connectorRef !== undefined && { connectorRef: p.connectorRef }),
      ...(p.repoName !== undefined && { repoName: p.repoName }),
      build: renderBuild(p.build),
      ...(p.cloneDirectory !== undefined && { cloneDirectory: p.cloneDirectory }),
      ...(p.depth !== undefined && { depth: p.depth }),
      ...(p.sslVerify !== undefined && { sslVerify: p.sslVerify }),
      ...(p.lfs !== undefined && { lfs: p.lfs }),
      ...(p.fetchTags !== undefined && { fetchTags: p.fetchTags }),
      ...(p.resources !== undefined && { resources: p.resources }),
      ...(p.runAsUser !== undefined && { runAsUser: p.runAsUser }),
    };
  }
}

// ---------------------------------------------------------------------------
// Action (GitHub Action)
// ---------------------------------------------------------------------------

export interface ActionStepProps extends StepProps {
  /** The GitHub Action to run, e.g. "actions/checkout@v4". */
  uses: string;
  /** Action inputs (the `with:` block). */
  with?: Record<string, string> | string;
  /** Environment variables for the action. */
  env?: Record<string, string> | string;
}

/**
 * A CI `Action` step (`type: Action`): runs a GitHub Action. Renders
 * `ActionStepInfo`.
 */
export class ActionStep extends Step {
  readonly stepType = "Action";

  private readonly props: ActionStepProps;

  constructor(props: ActionStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.uses.trim() === "") errors.push("uses must not be empty");
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      uses: p.uses,
      ...(p.with !== undefined && { with: p.with }),
      ...(p.env !== undefined && { env: p.env }),
    };
  }
}

// ---------------------------------------------------------------------------
// Bitrise
// ---------------------------------------------------------------------------

export interface BitriseStepProps extends StepProps {
  /** The Bitrise step to run, e.g. "https://github.com/bitrise-steplib/...". */
  uses: string;
  with?: Record<string, string> | string;
  env?: Record<string, string> | string;
}

/**
 * A CI `Bitrise` step (`type: Bitrise`): runs a Bitrise step. Renders
 * `BitriseStepInfo`.
 */
export class BitriseStep extends Step {
  readonly stepType = "Bitrise";

  private readonly props: BitriseStepProps;

  constructor(props: BitriseStepProps) {
    super(props);
    this.props = props;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.props.uses.trim() === "") errors.push("uses must not be empty");
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const p = this.props;
    return {
      uses: p.uses,
      ...(p.with !== undefined && { with: p.with }),
      ...(p.env !== undefined && { env: p.env }),
    };
  }
}
