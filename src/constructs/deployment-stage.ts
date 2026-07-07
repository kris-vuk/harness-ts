import { Stage, type StageProps, type ExecutionItem } from "./stage.js";
import {
  type DeploymentService,
  type DeploymentEnvironment,
  type InfrastructureDefinition,
  renderDeploymentService,
  renderDeploymentEnvironment,
  validateDeploymentTarget,
} from "./deployment-target.js";

/**
 * @deprecated Use {@link DeploymentService} from `deployment-target.ts`.
 * Retained as an alias for source compatibility.
 */
export type DeploymentServiceProps = DeploymentService;
/**
 * @deprecated Use {@link DeploymentEnvironment} from `deployment-target.ts`.
 * Retained as an alias for source compatibility.
 */
export type DeploymentEnvironmentProps = DeploymentEnvironment;
/**
 * @deprecated Use {@link InfrastructureDefinition} from `deployment-target.ts`.
 * Retained as an alias for source compatibility.
 */
export type InfrastructureDefinitionProps = InfrastructureDefinition;

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

export interface DeploymentStageProps extends StageProps {
  deploymentType: DeploymentType;
  service: DeploymentService;
  environment: DeploymentEnvironment;
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
  private readonly service: DeploymentService;
  private readonly environment: DeploymentEnvironment;
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
    errors.push(...validateDeploymentTarget(this.service, this.environment));
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
    return {
      deploymentType: this.deploymentType,
      service: renderDeploymentService(this.service),
      environment: renderDeploymentEnvironment(this.environment),
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
