import { Step, type StepProps } from "./step.js";

/**
 * The AWS CDK step family. Every class extends the abstract {@link Step}
 * directly — there is intentionally no shared base class — but because these
 * are container steps that share a large common surface (`image`,
 * `connectorRef`, `appPath`, AWS connector/region/role, container resources,
 * …), that surface is factored into the {@link AwsCdkContainer} interface plus
 * the `renderCdkContainer`/`validateCdkContainer` helpers. Each concrete step
 * still owns its lineage (`AwsCdk*Step -> Step -> ExecutionItem`).
 *
 * Specs follow the v0 pipeline schema (`AwsCdk*StepInfo`, under
 * `definitions.pipeline.steps.common`). Fields that Harness accepts as either
 * a literal or a runtime expression string are typed as such.
 */

/** Container image pull policy (`imagePullPolicy`). */
export type ImagePullPolicy = "Always" | "Never" | "IfNotPresent";

/** CPU / memory limits or requests for a container step (`Limits`). */
export interface ResourceLimits {
  /** e.g. "512Mi", "1Gi". */
  memory?: string;
  /** e.g. "500m", "1". */
  cpu?: string;
}

/** Container resource limits/requests (`ContainerResource`). */
export interface ContainerResource {
  limits?: ResourceLimits;
  requests?: ResourceLimits;
}

/**
 * The common container/AWS surface shared by the CDK bootstrap, synth, diff,
 * deploy, and destroy steps.
 */
export interface AwsCdkContainer {
  /** CDK CLI container image, e.g. "harness/cdk:latest". */
  image: string;
  /** Container-registry connector for `image`. */
  connectorRef: string;
  /** Path to the CDK app within the manifest. */
  appPath?: string;
  /** AWS connector used to authenticate to the account. */
  awsConnectorRef?: string;
  region?: string;
  /** IAM role ARN to assume. */
  roleArn?: string;
  /** Extra CLI options passed to the `cdk` command. */
  commandOptions?: string[] | string;
  /** Environment variables for the container. */
  envVariables?: Record<string, string> | string;
  imagePullPolicy?: ImagePullPolicy;
  privileged?: boolean | string;
  runAsUser?: number | string;
  resources?: ContainerResource;
  delegateSelectors?: string[];
}

function extractContainer(p: AwsCdkContainer): AwsCdkContainer {
  return {
    image: p.image,
    connectorRef: p.connectorRef,
    appPath: p.appPath,
    awsConnectorRef: p.awsConnectorRef,
    region: p.region,
    roleArn: p.roleArn,
    commandOptions: p.commandOptions,
    envVariables: p.envVariables,
    imagePullPolicy: p.imagePullPolicy,
    privileged: p.privileged,
    runAsUser: p.runAsUser,
    resources: p.resources,
    delegateSelectors: p.delegateSelectors,
  };
}

function validateCdkContainer(c: AwsCdkContainer): string[] {
  const errors: string[] = [];
  if (c.image.trim() === "") errors.push("image must not be empty");
  if (c.connectorRef.trim() === "") errors.push("connectorRef must not be empty");
  return errors;
}

function renderCdkContainer(c: AwsCdkContainer): Record<string, unknown> {
  return {
    connectorRef: c.connectorRef,
    image: c.image,
    ...(c.appPath !== undefined && { appPath: c.appPath }),
    ...(c.awsConnectorRef !== undefined && { awsConnectorRef: c.awsConnectorRef }),
    ...(c.region !== undefined && { region: c.region }),
    ...(c.roleArn !== undefined && { roleArn: c.roleArn }),
    ...(c.commandOptions !== undefined && { commandOptions: c.commandOptions }),
    ...(c.envVariables !== undefined && { envVariables: c.envVariables }),
    ...(c.imagePullPolicy !== undefined && {
      imagePullPolicy: c.imagePullPolicy,
    }),
    ...(c.privileged !== undefined && { privileged: c.privileged }),
    ...(c.runAsUser !== undefined && { runAsUser: c.runAsUser }),
    ...(c.resources !== undefined && { resources: c.resources }),
    ...(c.delegateSelectors !== undefined && {
      delegateSelectors: c.delegateSelectors,
    }),
  };
}

// ---------------------------------------------------------------------------
// AwsCdkBootstrap
// ---------------------------------------------------------------------------

export interface AwsCdkBootstrapStepProps extends StepProps, AwsCdkContainer {}

/** A Harness `AwsCdkBootstrap` step: runs `cdk bootstrap`. */
export class AwsCdkBootstrapStep extends Step {
  readonly stepType = "AwsCdkBootstrap";

  private readonly container: AwsCdkContainer;

  constructor(props: AwsCdkBootstrapStepProps) {
    super(props);
    this.container = extractContainer(props);
  }

  override validate(): string[] {
    return [...super.validate(), ...validateCdkContainer(this.container)];
  }

  protected renderSpec(): Record<string, unknown> {
    return renderCdkContainer(this.container);
  }
}

// ---------------------------------------------------------------------------
// AwsCdkSynth
// ---------------------------------------------------------------------------

export interface AwsCdkSynthStepProps extends StepProps, AwsCdkContainer {
  /** Stacks to synthesize; omit to synth all. */
  stackNames?: string[] | string;
  /** Export the synthesized CloudFormation template as an output. */
  exportTemplate?: boolean;
}

/** A Harness `AwsCdkSynth` step: runs `cdk synth`. */
export class AwsCdkSynthStep extends Step {
  readonly stepType = "AwsCdkSynth";

  private readonly container: AwsCdkContainer;
  private readonly stackNames?: string[] | string;
  private readonly exportTemplate?: boolean;

  constructor(props: AwsCdkSynthStepProps) {
    super(props);
    this.container = extractContainer(props);
    this.stackNames = props.stackNames;
    this.exportTemplate = props.exportTemplate;
  }

  override validate(): string[] {
    return [...super.validate(), ...validateCdkContainer(this.container)];
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...renderCdkContainer(this.container),
      ...(this.stackNames !== undefined && { stackNames: this.stackNames }),
      ...(this.exportTemplate !== undefined && {
        exportTemplate: this.exportTemplate,
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// AwsCdkDiff
// ---------------------------------------------------------------------------

export interface AwsCdkDiffStepProps extends StepProps, AwsCdkContainer {
  stackNames?: string[] | string;
}

/** A Harness `AwsCdkDiff` step: runs `cdk diff`. */
export class AwsCdkDiffStep extends Step {
  readonly stepType = "AwsCdkDiff";

  private readonly container: AwsCdkContainer;
  private readonly stackNames?: string[] | string;

  constructor(props: AwsCdkDiffStepProps) {
    super(props);
    this.container = extractContainer(props);
    this.stackNames = props.stackNames;
  }

  override validate(): string[] {
    return [...super.validate(), ...validateCdkContainer(this.container)];
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...renderCdkContainer(this.container),
      ...(this.stackNames !== undefined && { stackNames: this.stackNames }),
    };
  }
}

// ---------------------------------------------------------------------------
// AwsCdkDeploy
// ---------------------------------------------------------------------------

export interface AwsCdkDeployStepProps extends StepProps, AwsCdkContainer {
  /** Provisioner identifier used to correlate deploy/rollback state. */
  provisionerIdentifier: string;
  stackNames?: string[] | string;
  /** CDK deploy parameters (`--parameters`). */
  parameters?: Record<string, unknown>;
}

/** A Harness `AwsCdkDeploy` step: runs `cdk deploy`. */
export class AwsCdkDeployStep extends Step {
  readonly stepType = "AwsCdkDeploy";

  private readonly container: AwsCdkContainer;
  private readonly provisionerIdentifier: string;
  private readonly stackNames?: string[] | string;
  private readonly parameters?: Record<string, unknown>;

  constructor(props: AwsCdkDeployStepProps) {
    super(props);
    this.container = extractContainer(props);
    this.provisionerIdentifier = props.provisionerIdentifier;
    this.stackNames = props.stackNames;
    this.parameters = props.parameters;
  }

  override validate(): string[] {
    const errors = [...super.validate(), ...validateCdkContainer(this.container)];
    if (this.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...renderCdkContainer(this.container),
      provisionerIdentifier: this.provisionerIdentifier,
      ...(this.stackNames !== undefined && { stackNames: this.stackNames }),
      ...(this.parameters !== undefined && { parameters: this.parameters }),
    };
  }
}

// ---------------------------------------------------------------------------
// AwsCdkDestroy
// ---------------------------------------------------------------------------

export interface AwsCdkDestroyStepProps extends StepProps, AwsCdkContainer {
  stackNames?: string[] | string;
}

/** A Harness `AwsCdkDestroy` step: runs `cdk destroy`. */
export class AwsCdkDestroyStep extends Step {
  readonly stepType = "AwsCdkDestroy";

  private readonly container: AwsCdkContainer;
  private readonly stackNames?: string[] | string;

  constructor(props: AwsCdkDestroyStepProps) {
    super(props);
    this.container = extractContainer(props);
    this.stackNames = props.stackNames;
  }

  override validate(): string[] {
    return [...super.validate(), ...validateCdkContainer(this.container)];
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...renderCdkContainer(this.container),
      ...(this.stackNames !== undefined && { stackNames: this.stackNames }),
    };
  }
}

// ---------------------------------------------------------------------------
// AwsCdkRollback
// ---------------------------------------------------------------------------

export interface AwsCdkRollbackStepProps extends StepProps {
  /** Provisioner identifier of the deploy step to roll back. */
  provisionerIdentifier: string;
  envVariables?: Record<string, string> | string;
  delegateSelectors?: string[];
}

/**
 * A Harness `AwsCdkRollback` step: rolls back an `AwsCdkDeploy` identified by
 * its `provisionerIdentifier`. Unlike the other CDK steps this is not a
 * container step, so it carries a minimal spec.
 */
export class AwsCdkRollbackStep extends Step {
  readonly stepType = "AwsCdkRollback";

  private readonly provisionerIdentifier: string;
  private readonly envVariables?: Record<string, string> | string;
  private readonly delegateSelectors?: string[];

  constructor(props: AwsCdkRollbackStepProps) {
    super(props);
    this.provisionerIdentifier = props.provisionerIdentifier;
    this.envVariables = props.envVariables;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.provisionerIdentifier.trim() === "") {
      errors.push("provisionerIdentifier must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      provisionerIdentifier: this.provisionerIdentifier,
      ...(this.envVariables !== undefined && { envVariables: this.envVariables }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}
