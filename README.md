# Harness Development Kit

TypeScript constructs that synthesize [Harness.io](https://www.harness.io/) pipeline YAML — the CDK pattern for CI/CD pipelines.

## Quick Start

```ts
import { CustomStage, Pipeline, ShellScriptStep } from "harness-development-kit";

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

## Motivation

Harness pipelines are defined as YAML. This library lets you write them as TypeScript using a CDK-inspired API:

- **`Pipeline`** — top-level construct (like `App`)
- **`Stage`** — logical grouping (like `Stack`)
- **`Step`** — individual actions (like `Construct`)
- **`synth()`** — renders to Harness pipeline YAML

Every construct has `bind()`, `validate()`, and `toJson()` — the same lifecycle as CDK.

## Installation

```sh
npm install harness-development-kit
```

## High-Level Constructs

These wrap multiple low-level steps into a single stage item:

| Construct | What it renders |
|---|---|
| `CdkDeploy` | Clone → (optional Diff) → Deploy (containerized step group) |
| `TerraformApply` | Apply (or Plan + Apply grouped) |

### CDK Deployment

```ts
import { App, Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { CdkDeploy, CustomStage, Pipeline } from "harness-development-kit";

const app = new App();
const storage = new StorageStack(app, "Storage");

const pipeline = new Pipeline({
  name: "StorageService",
  projectIdentifier: "default_project",
  repository: { connectorRef: "github", name: "my-app" },
  runtime: {
    connectorRef: "k8s_cluster",
    namespace: "harness-builds",
    serviceAccountName: "cdk-deployer",
  },
  delegateSelectors: ["cdk-delegate"],
  cdk: {
    registryConnectorRef: "dockerhub",
    accountId: "111122223333",
    region: "us-east-1",
  },
});

pipeline.addStage(
  new CustomStage({ name: "Prod" }).addStep(
    new CdkDeploy({ stacks: [storage], diff: true }),
  ),
);

console.log(pipeline.synth());
```

`CdkDeploy` automatically builds a containerized step group with:

1. `GitCloneStep` — clones the repository
2. (optional) `AwsCdkDiffStep` — runs `cdk diff`
3. `AwsCdkDeployStep` — runs `cdk deploy`

Pipeline-level `repository`, `runtime`, `delegateSelectors`, and `cdk` config are inherited by every `CdkDeploy`, with per-step overrides available via props.

### Terraform Apply

```ts
const pipeline = new Pipeline({
  projectIdentifier: "default_project",
  repository: { connectorRef: "github", name: "infra", appPath: "terraform" },
});

pipeline.addStage(
  new CustomStage({ name: "Deploy" }).addStep(
    new TerraformApply({ plan: true }),
  ),
);
```

`TerraformApply` with `plan: true` groups a `TerraformPlanStep` and `TerraformApplyStep` together. Terraform steps run directly on the delegate — no runtime cluster is required.

## Low-Level Steps

| Step | Type | Containerized? | Description |
|---|---|---|---|
| `ShellScriptStep` | `ShellScript` | No | Inline shell script (Bash, PowerShell, Pwsh, Sh) |
| `GitCloneStep` | `GitClone` | Yes | Clone a repository into the step group workspace |
| `WaitStep` | `Wait` | No | Pause the pipeline (e.g. bake period) |
| `AwsCdkBootstrapStep` | `AwsCdkBootstrap` | Yes | Run `cdk bootstrap` |
| `AwsCdkSynthStep` | `AwsCdkSynth` | Yes | Run `cdk synth` |
| `AwsCdkDiffStep` | `AwsCdkDiff` | Yes | Run `cdk diff` |
| `AwsCdkDeployStep` | `AwsCdkDeploy` | Yes | Run `cdk deploy` |
| `TerraformPlanStep` | `TerraformPlan` | No | Run `terraform plan` |
| `TerraformApplyStep` | `TerraformApply` | No | Run `terraform apply` |
| `TerraformDestroyStep` | `TerraformDestroy` | No | Run `terraform destroy` |

## API Reference

### Pipeline

```ts
new Pipeline({
  name: "MyPipeline",
  projectIdentifier: "default_project",       // required
  identifier?: "My_Pipeline",                   // auto-derived from name
  orgIdentifier?: "default",
  description?: "Optional description",
  tags?: { env: "prod" },
  stages?: Stage[],
  repository?: RepoProps,                       // shared by containerized steps
  runtime?: KubernetesInfraProps,               // where containers run
  delegateSelectors?: string[],                 // delegate agent tags
  cdk?: CdkDefaults,                            // CDK config inherited by CdkDeploy
});
```

| Method | Description |
|---|---|
| `addStage(stage)` | Add a stage (returns `this` for chaining) |
| `validate()` | Returns validation errors (empty if valid) |
| `synth()` | Validates and renders to Harness pipeline YAML (throws on error) |

### Stage

| Class | Stage Type | Description |
|---|---|---|
| `CustomStage` | `Custom` | A sequence of execution items with no infrastructure attached |

```ts
new CustomStage({ name: "Build" })
  .addStep(new ShellScriptStep({ script: "..." }))
  .addStep(new CdkDeploy({ stacks: [...] }));
```

### Step Group

```ts
new StepGroup({
  name: "Deploy",
  kubernetesInfra: {
    connectorRef: "k8s_cluster",
    namespace: "harness-builds",
    serviceAccountName: "cdk-deployer",  // IRSA support
  },
  sharedPaths: ["/shared"],               // cross-step workspace sharing
  steps: [...],
});
```

### ShellScriptStep

```ts
new ShellScriptStep({
  name: "Build",
  script: 'echo "Building..."',
  shell: "Bash",                          // | "PowerShell" | "Pwsh" | "Sh"
  timeout: "10m",                         // default
  environmentVariables: [{ name: "NODE_ENV", type: "String", value: "production" }],
  outputVariables: [{ name: "VERSION", type: "String" }],
});
```

### WaitStep

```ts
new WaitStep({
  name: "Bake",
  duration: "12h",                        // e.g. "30m", "1d"
});
```

### Terraform Steps

```ts
// Plan (stores encrypted plan for later Apply)
new TerraformPlanStep({
  provisionerIdentifier: "my-infra",
  config: {
    configFiles: {
      type: "Github",
      connectorRef: "github",
      repoName: "infra",
      branch: "main",
      folderPath: "terraform",
    },
    varFiles: [{ identifier: "prod", content: "..." }],
    backendConfig: "...",
    targets: ["aws_s3_bucket.data"],
    workspace: "prod",
  },
});

// Apply (inherits from prior plan)
new TerraformApplyStep({
  provisionerIdentifier: "my-infra",
  // omit config to inherit from Plan
});

// Destroy (inherits from prior Plan or Apply)
new TerraformDestroyStep({
  inheritFrom: "Plan",
});
```

## Common Patterns

### Multi-Environment Promotion

```ts
const pipeline = new Pipeline({
  name: "StorageService",
  projectIdentifier: "default_project",
  repository: { connectorRef: "github", name: "my-app" },
  runtime: { connectorRef: "k8s_cluster", namespace: "harness-builds" },
  cdk: { registryConnectorRef: "dockerhub", accountId: "111122223333" },
});

pipeline
  .addStage(new CustomStage({ name: "Alpha" }).addStep(
    new CdkDeploy({ stacks: [alpha] }).addStep(new WaitStep({ duration: "12h" })),
  ))
  .addStage(new CustomStage({ name: "Beta" }).addStep(
    new CdkDeploy({ stacks: [beta] }).addStep(new WaitStep({ duration: "12h" })),
  ))
  .addStage(new CustomStage({ name: "Prod" }).addStep(
    new CdkDeploy({ stacks: [prod], diff: true }),
  ));
```

### Pipeline-Level Defaults with Per-Step Overrides

```ts
const pipeline = new Pipeline({
  repository: { connectorRef: "github", name: "my-app" },
  runtime: { connectorRef: "k8s_cluster", namespace: "builds" },
  cdk: { registryConnectorRef: "dockerhub", accountId: "111122223333" },
});

pipeline.addStage(
  new CustomStage({ name: "Override" }).addStep(
    new CdkDeploy({
      stacks: [someStack],
      repository: { connectorRef: "gitlab", name: "some-app" }, // overrides pipeline
      runtime: { connectorRef: "openshift", namespace: "other" }, // overrides pipeline
      overrides: { region: "eu-west-1" }, // partial override of cdk defaults
    }),
  ),
);
```

## CDK Parallel

This library mirrors the AWS CDK architecture:

| CDK | Harness Kit | Purpose |
|---|---|---|
| `App` | `Pipeline` | Top-level construct |
| `Stack` | `Stage` | Logical grouping |
| `Construct` | `Step` / `ExecutionItem` | Reusable building block |
| `synth()` | `synth()` | Render to output |
| `bind(scope)` | `bind(context)` | Lazy resolution with shared config |
| `CfnOutput` | `CfnOutput` | Stack output property |

The key difference: CDK synthesizes *infrastructure* into CloudFormation; this library synthesizes *pipelines* into Harness YAML.

## Running Examples

```sh
# Basic pipeline
npx tsx example.ts

# CDK multi-env promotion
npx tsx example-cdk.ts
```

## Development

```sh
npm install
npm run build    # TypeScript compilation
npm test         # Vitest tests
```

## License

ISC
