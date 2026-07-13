# harness-ts

TypeScript constructs that synthesize [Harness.io](https://www.harness.io/) pipeline YAML.

Instead of hand-writing Harness pipeline YAML, you compose a typed construct tree
— `Pipeline` → `Stage` → `Step` — and call `synth()` to render valid Harness YAML.
The construct tree is modeled directly on the [Harness v0 pipeline schema][schema],
so field names and shapes match what Harness expects.

[schema]: https://raw.githubusercontent.com/harness/harness-schema/main/v0/pipeline.json

## Quick Start

```ts
import { Pipeline, CustomStage, ShellScriptStep } from "./src/index.js";

const pipeline = new Pipeline({
  name: "MyPipeline",
  projectIdentifier: "default_project",
});

// A deployment progression: pre-prod, then each prod region in turn.
for (const stage of ["alpha", "gamma", "prod_dub", "prod_pdx", "prod_iad"]) {
  pipeline.addStage(
    new CustomStage({ name: stage }).addStep(
      new ShellScriptStep({
        name: "Deploy",
        script: `echo "Deploying to ${stage}..."`,
      }),
    ),
  );
}

console.log(pipeline.synth()); // prints Harness pipeline YAML
```

Run it:

```sh
npm install
npx tsx example.ts
```

> **Note on imports.** Everything is re-exported from the package root
> ([`src/index.ts`](src/index.ts)), which forwards the construct barrel at
> [`src/constructs/index.ts`](src/constructs/index.ts). You can import named
> constructs from either. The examples below import from individual construct
> files to make each type's home obvious. **If you installed this from npm,**
> replace the `./src/...` paths with the package name — e.g.
> `import { Pipeline } from "harness-ts";`.

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

## Construct levels (L1 / L2 / L3)

Constructs are organized into three levels of abstraction. **This library
currently ships L1 only** — the levels are defined up front so higher layers
are built on a deliberate foundation.

| Level | What it is | User thinks in terms of |
|---|---|---|
| **L1** | A 1:1 typed mirror of the Harness schema — one construct per schema type, fields named as the schema names them, no opinions. Anything expressible in raw YAML is expressible here, and nothing more. | the Harness schema |
| **L2** | One construct per schema type, with opinions: sensible defaults, inferred fields, helper methods. Renders through the L1 underneath. | the resource |
| **L3** | One construct per *goal*, expanding into several resources wired together correctly — the user states intent, the construct encodes the recipe. | the outcome |

Dependency direction is strictly downward (L3 → L2 → L1, never the reverse),
and every higher level keeps an escape hatch to the level below, so an
unmodeled schema corner never forces a return to hand-written YAML. The full
definitions and rules live in [`src/constructs/LEVELS.md`](src/constructs/LEVELS.md).

Everything documented below is L1.

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
import { DeploymentStage } from "./src/constructs/level-1/deployment-stage.js";
import { K8sRollingDeployStep } from "./src/constructs/level-1/kubernetes-steps.js";

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
import { CIStage } from "./src/constructs/level-1/ci-stage.js";
import { RunStep } from "./src/constructs/level-1/ci-steps.js";

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

See [`src/constructs/level-1/CONSTRUCTS.md`](src/constructs/level-1/CONSTRUCTS.md) for the full
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
} from "./src/constructs/level-1/terraform-steps.js";

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
import { StepGroup } from "./src/constructs/level-1/step-group.js";
import { ParallelGroup } from "./src/constructs/level-1/parallel-group.js";

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

## Triggers

A pipeline runs from its first stage; there is no "starting step". To start a
pipeline automatically when a source repo is updated, use a **trigger** — a
top-level resource, separate from the pipeline document, that references a
pipeline and renders its own YAML (`trigger.synth()`).

`GithubPushTrigger` watches a GitHub repo (via an existing Git connector) and
starts the pipeline when a push matches the watched branch. Attach it with
`pipeline.addTrigger(...)` — sugar that back-fills the pipeline/org/project
identifiers into the trigger:

```ts
import { GithubPushTrigger } from "./src/constructs/level-1/pipeline/triggers/github-push-trigger.js";

pipeline.addTrigger(
  new GithubPushTrigger({
    name: "on push to main",
    connectorRef: "github_conn",  // an existing Git connector
    repoName: "my-org/my-service",
    branch: "main",               // -> payloadConditions: targetBranch Equals main
  }),
);
```

The trigger still renders to its **own** YAML document (Harness models triggers
as sibling entities, not part of the pipeline). `pipeline.build()` writes it
alongside the pipeline automatically — see below — and `pipeline.triggers.synth()`
returns one YAML string per attached trigger. To reference a pipeline you don't
hold the object for, set `pipelineIdentifier` (and `projectIdentifier`) directly
and call `trigger.synth()` yourself.

By default it passes the pushed branch into the run's CI codebase
(`build.spec.branch: <+trigger.branch>`); override with `inputYaml`, or set
`inputYaml: false` to omit it. Add `payloadConditions` for finer matching and
`branchOperator` (`Equals` / `StartsWith` / `Regex` / …) to change how `branch`
is matched. The trigger and the pipeline are synthesized to separate YAML
documents.

## Writing YAML to disk on build (`pipeline.build()`)

`pipeline.synth()` returns the pipeline YAML **string**; `pipeline.triggers.synth()`
returns one string per attached trigger. To write everything to files on every
build — one `.harness/<identifier>.yaml` per pipeline/trigger — call
`pipeline.build()`:

```ts
// harness.ts
import { pipeline } from "./my-pipeline.js"; // pipeline.addTrigger(...) applied

pipeline.build();          // -> .harness/<pipeline identifier>.yaml
                           //    + one file per attached trigger
// pipeline.build("out");  // override the output directory (defaults to ".harness")
```

Wire it to an npm script:

```jsonc
// package.json
"scripts": { "synth": "tsx harness.ts" }
```

`npm run synth` then writes one file per resource and returns the absolute paths
written. Notes:

- **The output directory is cleared on every build.** `build()` removes and
  recreates `outdir` (default `.harness`), so YAML from renamed or removed
  pipelines/triggers never lingers. This clear happens only *after* rendering
  succeeds — a validation error leaves the existing output untouched. Point
  `build()` at a directory it owns, not one with hand-authored files.
- **Attached triggers ride along.** `build()` also writes any trigger added via
  `pipeline.addTrigger(...)`, each to its own `<trigger identifier>.yaml`.
- **File name** is the resource identifier; give the pipeline or trigger a
  distinct `identifier` to control it.
- **Validation first.** The pipeline and every trigger are rendered (and
  therefore validated) before anything is written, so an invalid pipeline or
  trigger throws and leaves no partial output.
- **Collisions throw.** The pipeline and a trigger resolving to the same file is
  an error — give one a distinct identifier.

## Storing the pipeline definition in git

The constructs above describe *what the pipeline does*. Separately, you can
declare *where the pipeline's own YAML lives* — the git repo that stores the
pipeline definition itself, so Harness keeps its in-account copy in sync as that
repo updates (Harness "Git Experience" / remote pipelines).

> **This is the pipeline-definition repo, not a source/app repo.** A
> `GithubPushTrigger` watches an application repo and *runs* the pipeline on
> push. `PipelineGitConfig` points at the repo that holds the pipeline YAML and
> governs how Harness *stores and syncs the definition*. They are unrelated and
> can be used together.

Git-sync metadata (`storeType: REMOTE`, connector, repo, branch, file path) is
**not** part of the v0 pipeline document, so it isn't rendered by
`pipeline.synth()`. Like a trigger, `PipelineGitConfig` is a separate resource
that *references* a pipeline and renders that entity-level "git details" block:

```ts
import { PipelineGitConfig } from "./src/constructs/level-1/pipeline/pipeline-git-config.js";

const gitConfig = new PipelineGitConfig({
  pipeline,                             // supplies the pipeline identifier
  connectorRef: "github_conn",          // existing Git connector for the defs repo
  repoName: "my-org/pipeline-defs",     // repo that stores the pipeline YAML
  branch: "main",
  filePath: ".harness/my_pipeline.yaml",
});

gitConfig.toGitDetails();
// { storeType: "REMOTE", connectorRef: "github_conn",
//   repoName: "my-org/pipeline-defs", branch: "main",
//   filePath: ".harness/my_pipeline.yaml" }
```

Use `gitFetchType: "Commit"` with a `commitId` to pin a specific commit instead
of tracking the branch tip.

### The auto-update loop

`PipelineGitConfig` produces the metadata; it does not move any bytes. Because
`synth()` returns a YAML **string** (there is no output directory — the library
never writes files), delivering the definition to the repo is a consumer step.
The full loop:

1. Compose the construct tree and run `npm run synth` (the [`pipeline.build()`](#writing-yaml-to-disk-on-build-pipelinebuild)
   step above) to write `.harness/<identifier>.yaml`. Point `filePath` at that
   same path.
2. Commit/push the `.harness` file to the defs repo.
3. Harness, having been told the pipeline is `REMOTE` (via `toGitDetails()` on a
   create/import API call, or the UI), syncs its stored copy from that file when
   the repo updates.

So steps 1–2 are this library plus a `git commit`; step 3 is the one-time
Harness create/import that registers the pipeline as remote.

## Development

```sh
npm install
npm run typecheck   # tsc, no emit
npm run build       # tsc -p tsconfig.build.json -> dist/
npm test            # vitest
npx tsx example.ts  # run the sample pipeline
```

## Status

This is an evolving, schema-driven construct tree, currently
[L1-only](src/constructs/LEVELS.md). Coverage so far:
**4 of 12 stage types** and a growing set of step families (general, approval,
Kubernetes, AWS CDK, CI, Terraform, feature flag). The remaining step families
(Helm, ECS, ASG, Azure, GCP, Lambda/SAM, GitOps, STO scanners, and more) are
tracked in [`src/constructs/level-1/CONSTRUCTS.md`](src/constructs/level-1/CONSTRUCTS.md).

Known gaps:

- Test coverage is early — schema-validation and render tests exist for a subset
  of constructs; broader round-trip coverage is planned.

## License

MIT — see [LICENSE](LICENSE).
