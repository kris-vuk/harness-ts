import { Stage, type StageProps, type ExecutionItem } from "./stage.js";

/** Deployment types supported by a CD stage per the v0 schema. */
export type DeploymentType =
  | "Kubernetes"
  | "NativeHelm"
  | "Ssh"
  | "WinRm"
  | "ServerlessAwsLambda"
  | "AzureWebApp"
  | "AzureFunction"
  | "CustomDeployment"
  | "ECS"
  | "Elastigroup"
  | "TAS"
  | "Asg"
  | "GoogleCloudFunctions"
  | "AwsLambda"
  | "AWS_SAM"
  | "GoogleCloudRun"
  | "AzureContainerApps"
  | "Salesforce"
  | "GoogleManagedInstanceGroup";

/** The service to deploy (`ServiceYamlV2`). */
export interface DeploymentServiceProps {
  /** Reference to an existing Harness service. */
  serviceRef: string;
  /** Runtime inputs for the service's referenced template/artifacts. */
  serviceInputs?: Record<string, unknown>;
}

/** An infrastructure the environment deploys to (`InfraStructureDefinitionYaml`). */
export interface InfrastructureDefinitionProps {
  /** Reference to an existing infrastructure definition. */
  identifier: string;
  /** Runtime inputs for the infrastructure definition. */
  inputs?: Record<string, unknown>;
}

/** The environment to deploy into (`EnvironmentYamlV2`). */
export interface DeploymentEnvironmentProps {
  /** Reference to an existing Harness environment. */
  environmentRef: string;
  /** Deploy to every infrastructure in the environment. Defaults to false. */
  deployToAll?: boolean;
  /** The specific infrastructures to deploy to (when not `deployToAll`). */
  infrastructureDefinitions?: InfrastructureDefinitionProps[];
}

export interface DeploymentStageProps extends StageProps {
  deploymentType: DeploymentType;
  service: DeploymentServiceProps;
  environment: DeploymentEnvironmentProps;
  /** The deployment execution steps (e.g. Rollout, Canary). */
  steps?: ExecutionItem[];
  /** Steps run when the deployment fails and rolls back. */
  rollbackSteps?: ExecutionItem[];
  /** Deploy via GitOps clusters rather than an infrastructure. */
  gitOpsEnabled?: boolean;
}

/**
 * A Harness Deployment (CD) stage (`type: Deployment`): deploys a service to
 * an environment. Renders the `DeploymentStageConfig` spec for the common
 * single-service / single-environment path — `service`, `environment`, and an
 * `execution` with `steps` (and optional `rollbackSteps`). Multi-service and
 * multi-environment variants (`services`, `environments`, `environmentGroup`)
 * can be added later without changing this surface.
 */
export class DeploymentStage extends Stage {
  readonly stageType = "Deployment";

  private readonly deploymentType: DeploymentType;
  private readonly service: DeploymentServiceProps;
  private readonly environment: DeploymentEnvironmentProps;
  private readonly steps: ExecutionItem[] = [];
  private readonly rollbackSteps: ExecutionItem[] = [];
  private readonly gitOpsEnabled?: boolean;

  constructor(props: DeploymentStageProps) {
    super(props);
    this.deploymentType = props.deploymentType;
    this.service = props.service;
    this.environment = props.environment;
    this.gitOpsEnabled = props.gitOpsEnabled;
    for (const step of props.steps ?? []) {
      this.steps.push(step);
    }
    for (const step of props.rollbackSteps ?? []) {
      this.rollbackSteps.push(step);
    }
  }

  addStep(item: ExecutionItem): this {
    this.steps.push(item);
    return this;
  }

  addRollbackStep(item: ExecutionItem): this {
    this.rollbackSteps.push(item);
    return this;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.service.serviceRef.trim() === "") {
      errors.push("service.serviceRef must not be empty");
    }
    if (this.environment.environmentRef.trim() === "") {
      errors.push("environment.environmentRef must not be empty");
    }
    const infra = this.environment.infrastructureDefinitions ?? [];
    if (!this.environment.deployToAll && infra.length === 0) {
      errors.push(
        "environment must specify infrastructureDefinitions or set deployToAll",
      );
    }
    if (this.steps.length === 0) {
      errors.push("stage must contain at least one step");
    }
    errors.push(...this.validateItems(this.steps, "step"));
    errors.push(...this.validateItems(this.rollbackSteps, "rollback step"));
    return errors;
  }

  private validateItems(items: ExecutionItem[], label: string): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.identifier)) {
        errors.push(`duplicate ${label} identifier "${item.identifier}"`);
      }
      seen.add(item.identifier);
      errors.push(...item.validate().map((e) => `"${item.identifier}": ${e}`));
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    const infra = this.environment.infrastructureDefinitions ?? [];
    return {
      deploymentType: this.deploymentType,
      service: {
        serviceRef: this.service.serviceRef,
        ...(this.service.serviceInputs !== undefined && {
          serviceInputs: this.service.serviceInputs,
        }),
      },
      environment: {
        environmentRef: this.environment.environmentRef,
        deployToAll: this.environment.deployToAll ?? false,
        ...(infra.length > 0 && {
          infrastructureDefinitions: infra.map((def) => ({
            identifier: def.identifier,
            ...(def.inputs !== undefined && { inputs: def.inputs }),
          })),
        }),
      },
      ...(this.gitOpsEnabled !== undefined && { gitOpsEnabled: this.gitOpsEnabled }),
      execution: {
        steps: this.steps.map((item) => item.toJson()),
        ...(this.rollbackSteps.length > 0 && {
          rollbackSteps: this.rollbackSteps.map((item) => item.toJson()),
        }),
      },
    };
  }
}
