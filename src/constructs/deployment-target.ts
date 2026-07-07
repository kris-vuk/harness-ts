/**
 * Value objects describing *what* a Deployment stage deploys and *where*: the
 * service (`ServiceYamlV2`), the environment (`EnvironmentYamlV2`), and the
 * infrastructure definitions within it (`InfraStructureDefinitionYaml`). These
 * model the common single-service / single-environment path; the multi-service
 * and environment-group variants can be layered on later.
 */

/** An infrastructure the environment deploys to (`InfraStructureDefinitionYaml`). */
export interface InfrastructureDefinition {
  /** Reference to an existing infrastructure definition. */
  identifier: string;
  /** Runtime inputs for the infrastructure definition. */
  inputs?: Record<string, unknown>;
}

/** The service to deploy (`ServiceYamlV2`). */
export interface DeploymentService {
  /** Reference to an existing Harness service. */
  serviceRef: string;
  /** Runtime inputs for the service's referenced template/artifacts. */
  serviceInputs?: Record<string, unknown>;
}

/** The environment to deploy into (`EnvironmentYamlV2`). */
export interface DeploymentEnvironment {
  /** Reference to an existing Harness environment. */
  environmentRef: string;
  /** Deploy to every infrastructure in the environment. Defaults to false. */
  deployToAll?: boolean;
  /** The specific infrastructures to deploy to (when not `deployToAll`). */
  infrastructureDefinitions?: InfrastructureDefinition[];
}

/** Renders an {@link InfrastructureDefinition} to its schema object. */
export function renderInfrastructureDefinition(
  def: InfrastructureDefinition,
): Record<string, unknown> {
  return {
    identifier: def.identifier,
    ...(def.inputs !== undefined && { inputs: def.inputs }),
  };
}

/** Renders a {@link DeploymentService} to its `service` object. */
export function renderDeploymentService(
  s: DeploymentService,
): Record<string, unknown> {
  return {
    serviceRef: s.serviceRef,
    ...(s.serviceInputs !== undefined && { serviceInputs: s.serviceInputs }),
  };
}

/** Renders a {@link DeploymentEnvironment} to its `environment` object. */
export function renderDeploymentEnvironment(
  e: DeploymentEnvironment,
): Record<string, unknown> {
  const infra = e.infrastructureDefinitions ?? [];
  return {
    environmentRef: e.environmentRef,
    deployToAll: e.deployToAll ?? false,
    ...(infra.length > 0 && {
      infrastructureDefinitions: infra.map(renderInfrastructureDefinition),
    }),
  };
}

/**
 * Returns problems with a {@link DeploymentService} / {@link DeploymentEnvironment}
 * pair; empty when valid. Shared so a Deployment stage can validate its target
 * without duplicating the rules.
 */
export function validateDeploymentTarget(
  service: DeploymentService,
  environment: DeploymentEnvironment,
): string[] {
  const errors: string[] = [];
  if (service.serviceRef.trim() === "") {
    errors.push("service.serviceRef must not be empty");
  }
  if (environment.environmentRef.trim() === "") {
    errors.push("environment.environmentRef must not be empty");
  }
  const infra = environment.infrastructureDefinitions ?? [];
  if (!environment.deployToAll && infra.length === 0) {
    errors.push(
      "environment must specify infrastructureDefinitions or set deployToAll",
    );
  }
  return errors;
}
