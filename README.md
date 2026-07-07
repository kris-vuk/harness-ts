# Harness Development Kit

TypeScript constructs that synthesize [Harness.io](https://www.harness.io/) pipeline YAML.

Instead of hand-writing Harness pipeline YAML, you compose a typed construct tree
— `Pipeline` → `Stage` → `Step` — and call `synth()` to render valid Harness YAML.
The construct tree is modeled directly on the [Harness v0 pipeline schema][schema],
so field names and shapes match what Harness expects.

[schema]: https://raw.githubusercontent.com/harness/harness-schema/main/v0/pipeline.json

## Quick Start

```ts
import { Pipeline } from "./src/constructs/pipeline.js";
import { CustomStage } from "./src/constructs/custom-stage.js";
import { ShellScriptStep } from "./src/constructs/shell-script-step.js";

const pipeline = new Pipeline({
  name: "MyPipeline",
  projectIdentifier: "default_project",
});

pipeline.addStage(
  new CustomStage({ name: "Build" }).addStep(
    new ShellScriptStep({
      name: "Build",
      script: 'echo "Building..."',
    }),
  ),
);

console.log(pipeline.synth()); // prints Harness pipeline YAML
```

Run it:

```sh
npm install
npx tsx example.ts
```

> **Note on imports.** The construct barrel lives at
> [`src/constructs/index.ts`](src/constructs/index.ts). The package root
> (`src/index.ts`) is not yet wired up — see [Status](#status) — so import from
> the construct files (or the barrel) directly, as the examples above do.

## Model

The construct tree mirrors the Harness schema hierarchy. Every construct exposes
the same lifecycle:

| Method | Description |
|---|---|
| `toJson()` | Renders this construct's schema object (e.g. a `{ stage: ... }` entry). |
| `validate()` | Returns a list of problems; empty when valid. Recurses into children. |
| `synth()` | *(`Pipeline` only)* Validates, then renders the whole pipeline to YAML. Throws if invalid. |

The hierarchy:

- **`Pipeline`** — the top-level `{ pipeline: { ... } }` document. Holds stages.
- **`Stage`** (abstract) — a `- stage:` entry. Concrete types: `CustomStage`,
  `ApprovalStage`, `DeploymentStage`, `CIStage`.
- **`Step`** (abstract) — a `{ step: { ... } }` execution item. Many concrete types (below).
- **`StepGroup`** / **`ParallelGroup`** — containers that group steps (sequential
  group with its own identifier, or a concurrent `parallel` block).

Identifiers are auto-derived from the display `name` (`"My Stage"` → `"My_Stage"`)
unless you pass an explicit `identifier`. Validation enforces the Harness
identifier rules and rejects duplicate identifiers within a scope.

## Stages

| Construct | Type | Purpose |
|---|---|---|
| `CustomStage` | `Custom` | A plain sequence of execution items — no service/infrastructure attached. |
| `ApprovalStage` | `Approval` | A gate: manual (`HarnessApproval`) or Jira/ServiceNow/custom approval steps. |
| `DeploymentStage` | `Deployment` | Deploys a service to an environment (single-service / single-environment path). |
| `CIStage` | `CI` | Builds and tests code on Harness Cloud or a self-managed cluster. |

Every stage takes shared `StageProps` (`name`, `identifier?`, `description?`,
`tags?`, `variables?`, `when?`, `failureStrategies?`, `delegateSelectors?`,
`strategy?`, `timeout?`) plus type-specific fields.

### Deployment stage

```ts
import { DeploymentStage } from "./src/constructs/deployment-stage.js";
import { K8sRollingDeployStep } from "./src/constructs/kubernetes-steps.js";

new DeploymentStage({
  name: "Deploy Prod",
  deploymentType: "Kubernetes",
  service: { serviceRef: "my_service" },
  environment: {
    environmentRef: "prod",
    infrastructureDefinitions: [{ identifier: "prod_k8s" }],
  },
}).addStep(new K8sRollingDeployStep({ name: "Rollout" }));
```

### CI stage

```ts
import { CIStage } from "./src/constructs/ci-stage.js";
import { RunStep } from "./src/constructs/ci-steps.js";

// Harness Cloud (hosted machines)
new CIStage({
  name: "Build",
  platform: { os: "Linux", arch: "Amd64" },
  runtime: { type: "Cloud" },
}).addStep(new RunStep({ name: "Test", command: "npm test" }));

// or self-managed Kubernetes
new CIStage({
  name: "Build",
  infrastructure: {
    type: "KubernetesDirect",
    connectorRef: "k8s_cluster",
    namespace: "harness-builds",
  },
}).addStep(new RunStep({ name: "Test", command: "npm test" }));
```

## Steps

Every step takes shared `StepProps` (`name`, `identifier?`, `description?`,
`timeout?`, `when?`, `failureStrategies?`, `strategy?`, `enforce?`) plus a
type-specific `spec`.

**General / utility**

| Step | Type |
|---|---|
| `ShellScriptStep` | `ShellScript` |
| `WaitStep` | `Wait` |
| `HttpStep` | `Http` |
| `EmailStep` | `Email` |
| `BarrierStep` | `Barrier` |
| `QueueStep` | `Queue` |
| `PolicyStep` | `Policy` |

**Approval** — `HarnessApprovalStep`, `JiraApprovalStep`, `ServiceNowApprovalStep`, `CustomApprovalStep`

**Feature Flag** — `FlagConfigurationStep`

**Kubernetes** (all 17) — `K8sRollingDeployStep`, `K8sRollingRollbackStep`,
`K8sApplyStep`, `K8sDeleteStep`, `K8sScaleStep`, `K8sBlueGreenDeployStep`,
`K8sCanaryDeployStep`, `K8sCanaryDeleteStep`, `K8sBGSwapServicesStep`,
`K8sDiffStep`, `K8sDryRunStep`, `K8sPatchStep`, `K8sRolloutStep`,
`K8sTrafficRoutingStep`, `K8sBlueGreenStageScaleDownStep`,
`K8sBlueGreenStageScaleUpStep`, `K8sProgressiveCanaryRollbackStep`

**AWS CDK** — `AwsCdkBootstrapStep`, `AwsCdkSynthStep`, `AwsCdkDiffStep`, `AwsCdkDeployStep`, `AwsCdkDestroyStep`, `AwsCdkRollbackStep`

**CI build/test** — `RunStep`, `RunTestsStep`, `PluginStep`, `BackgroundStep`, `GitCloneStep`, `ActionStep`, `BitriseStep`

**Terraform** — `TerraformPlanStep`, `TerraformApplyStep`, `TerraformDestroyStep`, `TerraformRollbackStep`

See [`src/constructs/CONSTRUCTS.md`](src/constructs/CONSTRUCTS.md) for the full
inventory, including step families not yet implemented.

### ShellScriptStep

```ts
new ShellScriptStep({
  name: "Build",
  script: 'echo "Building..."',
  shell: "Bash",                          // "Bash" | "PowerShell"; default "Bash"
  timeout: "10m",
  environmentVariables: [{ name: "NODE_ENV", type: "String", value: "production" }],
  outputVariables: [{ name: "VERSION", type: "String", value: "v" }],
});
```

### WaitStep

```ts
new WaitStep({ name: "Bake", duration: "12h" });   // e.g. "30m", "1d"
```

### Terraform steps

```ts
import {
  TerraformPlanStep,
  TerraformApplyStep,
} from "./src/constructs/terraform-steps.js";

// Plan (stores an encrypted plan for a later Apply)
new TerraformPlanStep({
  name: "Plan",
  provisionerIdentifier: "my_infra",
  command: "Apply",
  secretManagerRef: "harness_secret_manager",
  configuration: {
    configFiles: {
      type: "Github",
      connectorRef: "github",
      gitFetchType: "Branch",
      branch: "main",
      repoName: "infra",
      folderPath: "terraform",
    },
  },
});

// Apply, inheriting the prior plan
new TerraformApplyStep({
  name: "Apply",
  provisionerIdentifier: "my_infra",
  configurationType: "InheritFromPlan",
});
```

## Value objects

Several schema blocks are modeled as typed value objects (an interface/union plus
a `render*` function) rather than loose records, so they validate at the type level:

| Value object | Models |
|---|---|
| `NGVariable` | Pipeline/stage/step-group variables (`String` / `Secret` / `Number`). |
| `StepWhen` / `StageWhen` | Conditional execution (`when`). |
| `FailureStrategy` | Failure-handling rules. |
| `Strategy` | Matrix / parallelism / repeat looping. |
| `NotificationRule` | Pipeline notifications and channels. |
| `FlowControl` / `Barrier` | Barrier / flow-control config. |
| `TemplateLink` | References to Harness templates. |
| `PolicyConfig` | OPA policy enforcement (`enforce`). |
| `DeploymentService` / `DeploymentEnvironment` / `InfrastructureDefinition` | Deployment stage targets. |

## Grouping steps

```ts
import { StepGroup } from "./src/constructs/step-group.js";
import { ParallelGroup } from "./src/constructs/parallel-group.js";

// Sequential, named group (has its own identifier; can carry when/failureStrategies)
new StepGroup({
  name: "Deploy",
  steps: [stepA, stepB],
});

// Concurrent block (renders `{ parallel: [...] }`; no identifier of its own)
new ParallelGroup({ steps: [stepA, stepB] });
```

Groups are themselves execution items, so they nest and can be added to any stage
via `addStep()`.

## Development

```sh
npm install
npm run typecheck   # tsc, no emit
npm run build       # tsc -p tsconfig.build.json -> dist/
npm test            # vitest
npx tsx example.ts  # run the sample pipeline
```

## Status

This is an evolving, schema-driven construct tree. Coverage so far:
**4 of 12 stage types** and a growing set of step families (general, approval,
Kubernetes, AWS CDK, CI, Terraform, feature flag). The remaining step families
(Helm, ECS, ASG, Azure, GCP, Lambda/SAM, GitOps, STO scanners, and more) are
tracked in [`src/constructs/CONSTRUCTS.md`](src/constructs/CONSTRUCTS.md).

Known gaps:

- The package root (`src/index.ts`) is empty; the construct barrel at
  `src/constructs/index.ts` is the entry point today. Consolidating them is
  blocked on a name clash with a legacy tree and tracked in `CONSTRUCTS.md`.
- No test suite yet — round-trip render tests are planned.

## License

MIT — see [LICENSE](LICENSE).
