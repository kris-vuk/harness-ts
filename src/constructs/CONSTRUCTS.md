# Constructs inventory

Tracks the TypeScript construct tree under `src/constructs/` that synthesizes
Harness pipeline YAML, modeled on the [v0 pipeline schema][schema]. Every
construct exposes `toJson()` + `validate()`; `Pipeline` also has `synth()`
(validate + `yaml.stringify`).

**Lineage:** `PipelineChild` ← `Pipeline`; `Stage` (abstract) ← concrete
stages; `ExecutionItem` ← `Step` (abstract) ← concrete steps, and ←
`ParallelGroup` / `StepGroup`. Step families are **flat** — each concrete step
`extends Step` directly, no per-family base class.

Schema totals: **12 stage types**, **~270 step-type discriminators** (plus the
STO/security scanners under the `security` container).

Legend: ✅ done · 🚧 in progress · ⬜ not started

[schema]: https://raw.githubusercontent.com/harness/harness-schema/main/v0/pipeline.json

---

## Core primitives

| Construct | File | Status |
| --- | --- | --- |
| `Pipeline` | `pipeline.ts` | ✅ |
| `Stage` (abstract base) | `stage.ts` | ✅ |
| `Step` (abstract base) | `step.ts` | ✅ |
| `ParallelGroup` | `parallel-group.ts` | ✅ |
| `StepGroup` | `step-group.ts` | ✅ |

## Value objects

Typed replacements for the loose `Record<string, unknown>` fields (union/interface + `render*` fn).

| Value object | File | Status |
| --- | --- | --- |
| `NGVariable` (String/Secret/Number) | `ng-variable.ts` | ✅ |
| `StepWhen` / `StageWhen` | `when-condition.ts` | ✅ |
| `FailureStrategy` + `FailureAction` | `failure-strategy.ts` | ✅ |
| `Strategy` (matrix/parallelism/repeat) | `strategy.ts` | ✅ |
| `NotificationRule` / `NotificationChannel` / `PipelineEvent` | `notification.ts` | ✅ |
| `FlowControl` / `Barrier` config | `flow-control.ts` | ✅ |
| `TemplateLink` (`TemplateLinkConfig`) | `template-link.ts` | ✅ |
| `PolicyConfig` (`enforce`) | `policy-config.ts` | ✅ |
| `DeploymentService` / `DeploymentEnvironment` / `InfrastructureDefinition` | `deployment-target.ts` | ✅ |

Still pass-through `Record` on the bases: `runMode`, `properties`,
`stepGroupInfra`, `platform`.

## Stages (12)

| Stage type | Construct | Status |
| --- | --- | --- |
| `Custom` | `CustomStage` | ✅ |
| `Approval` | `ApprovalStage` | ✅ |
| `Deployment` | `DeploymentStage` | ✅ |
| `CI` | `CIStage` | ✅ |
| `SecurityTests` | — | ⬜ |
| `FeatureFlag` | — | ⬜ |
| `Pipeline` | — | ⬜ |
| `IACM` | — | ⬜ |
| `IDP` | — | ⬜ |
| `DRTest` | — | ⬜ |
| `CompositeLoadTest` | — | ⬜ |
| `Dynamic` | — | ⬜ |

---

## Steps

### ✅ Done

**General / utility** (`*-step.ts`)

| Step | Type | Status |
| --- | --- | --- |
| `ShellScriptStep` | `ShellScript` | ✅ |
| `WaitStep` | `Wait` | ✅ |
| `HttpStep` | `Http` | ✅ |
| `EmailStep` | `Email` | ✅ |
| `BarrierStep` | `Barrier` | ✅ |
| `QueueStep` | `Queue` | ✅ |
| `PolicyStep` | `Policy` | ✅ |

**Approval** (`approval-steps.ts`)

| Step | Type | Status |
| --- | --- | --- |
| `HarnessApprovalStep` | `HarnessApproval` | ✅ |
| `JiraApprovalStep` | `JiraApproval` | ✅ |
| `ServiceNowApprovalStep` | `ServiceNowApproval` | ✅ |
| `CustomApprovalStep` | `CustomApproval` | ✅ |

**Kubernetes** (`kubernetes-steps.ts`) — all 17 ✅

| Step | Type |
| --- | --- |
| `K8sRollingDeployStep` | `K8sRollingDeploy` |
| `K8sRollingRollbackStep` | `K8sRollingRollback` |
| `K8sApplyStep` | `K8sApply` |
| `K8sDeleteStep` | `K8sDelete` |
| `K8sScaleStep` | `K8sScale` |
| `K8sBlueGreenDeployStep` | `K8sBlueGreenDeploy` |
| `K8sCanaryDeployStep` | `K8sCanaryDeploy` |
| `K8sCanaryDeleteStep` | `K8sCanaryDelete` |
| `K8sBGSwapServicesStep` | `K8sBGSwapServices` |
| `K8sDiffStep` | `K8sDiff` |
| `K8sDryRunStep` | `K8sDryRun` |
| `K8sPatchStep` | `K8sPatch` |
| `K8sRolloutStep` | `K8sRollout` |
| `K8sTrafficRoutingStep` | `K8sTrafficRouting` |
| `K8sBlueGreenStageScaleDownStep` | `K8sBlueGreenStageScaleDown` |
| `K8sBlueGreenStageScaleUpStep` | `K8sBlueGreenStageScaleUp` |
| `K8sProgressiveCanaryRollbackStep` | `K8sProgressiveCanaryRollback` |

**AWS CDK** (`aws-cdk-steps.ts`) — all 6 ✅ (shared `AwsCdkContainer` interface + render/validate helpers)

| Step | Type |
| --- | --- |
| `AwsCdkBootstrapStep` | `AwsCdkBootstrap` |
| `AwsCdkSynthStep` | `AwsCdkSynth` |
| `AwsCdkDiffStep` | `AwsCdkDiff` |
| `AwsCdkDeployStep` | `AwsCdkDeploy` |
| `AwsCdkDestroyStep` | `AwsCdkDestroy` |
| `AwsCdkRollbackStep` | `AwsCdkRollback` |

**Feature Flag** (`flag-configuration-step.ts`)

| Step | Type | Status |
| --- | --- | --- |
| `FlagConfigurationStep` | `FlagConfiguration` | ✅ |

**CI build/test** (`ci-steps.ts`) — 7 core steps ✅

| Step | Type |
| --- | --- |
| `RunStep` | `Run` |
| `RunTestsStep` | `RunTests` |
| `PluginStep` | `Plugin` |
| `BackgroundStep` | `Background` |
| `GitCloneStep` | `GitClone` |
| `ActionStep` | `Action` |
| `BitriseStep` | `Bitrise` |

**Terraform** (`terraform-steps.ts`) — 4 core steps ✅ (shared `TerraformExecutionConfig` + `GitStore`/`TerraformVarFile`/`TerraformBackendConfig`/`TerraformCliFlag` value objects; env vars reuse `NGVariable`)

| Step | Type |
| --- | --- |
| `TerraformApplyStep` | `TerraformApply` |
| `TerraformPlanStep` | `TerraformPlan` |
| `TerraformDestroyStep` | `TerraformDestroy` |
| `TerraformRollbackStep` | `TerraformRollback` |

### ⬜ Not started — step families

Roughly prioritized; counts are approximate distinct step types. Expand a
family into a per-step checklist when work on it begins.

| Family | ~Count | Notes |
| --- | --- | --- |
| Helm | 7 | `HelmDeploy`, `HelmRollback`, `HelmDelete`, `HelmBGDeploy`, `HelmBlueGreenSwapStep`, `HelmCanary{Deploy,Delete}` |
| Terraform/Terragrunt (remaining) | ~11 | core Terraform 4 done (`terraform-steps.ts`); left: `TerraformCloud{Run,Rollback}`, `Terragrunt{Apply,Plan,Destroy,Rollback}`, `ShellScriptProvision`, `CreateResource` |
| ECS | 13 | `Ecs{RollingDeploy,RollingRollback,CanaryDeploy,CanaryDelete,Scale,RunTask,ServiceSetup,UpgradeContainer,BasicRollback}`, `EcsBlueGreen*` |
| ASG | 13 | `Asg{Setup,RollingDeploy,RollingRollback,Canary*,BlueGreen*,Scale,ShiftTraffic,SteadyState,PhasedDeploy,Rollback}` |
| Azure | 13 | ARM/Blueprint, WebApp slots, Functions, Container Apps |
| Google Cloud | ~20 | Cloud Run, MIG, Cloud Functions (gen1/gen2), Agent Runtime |
| AWS Lambda / SAM | 8 | `AwsLambda*`, `AwsSam{Build,Deploy,Rollback}` |
| CloudFormation | 4 | `CreateStack`, `DeleteStack`, `RollbackStack`, `DownloadAwsS3` |
| Serverless | 6 | `ServerlessAwsLambda*` (+ V2) |
| Elastigroup (Spot) | 6 | `Elastigroup*` |
| TAS (Tanzu) | ~11 | `TasRolling*`, `TanzuCommand`, `*AppSetup`, `AppResize`, `AppRollback`, `Swap*`, `RouteMapping` |
| GitOps | ~10 | `GitOps*`, `UpdateGitOpsApp`, `MergePR`, `RevertPR`, `DirectPush` |
| Jira / ServiceNow create-update | 5 | `Jira{Create,Update}`, `ServiceNow{Create,Update,ImportSet}` |
| Salesforce | 11 | `Salesforce*` |
| CI build/push (remaining) | ~15 | core 7 done (`ci-steps.ts`); left: `BuildAndPush{Docker,ECR,GCR,GAR,ACR}`, `RestoreCache*`/`SaveCache*` (S3/GCS/Azure), `*Upload`/`UploadTo*` (S3/GCS/Artifactory/Har) |
| STO scanners | ~54 | under `security` container; per-tool step types |
| SSCA | ~12 | `Ssca*`, `CdSsca*`, `SlsaVerification`, `EnforceAttestation` |
| DB DevOps | 5 | `DBSchema{Apply,Rollback}`, `DBTestAndPreview`, `FlywayCommand`, `LiquibaseCommand` |
| FME (Split.io) | ~26 | `FmeFlag*`, `FmeSegment*`, `FmeFlagset*`, `FmeMetricCheck` |
| IACM | 13 | `IACM*` plugins/scanners/agents |
| IDP (Internal Dev Portal) | ~13 | `IdpAction`, `CookieCutter`, catalog/repo/project self-service |
| AI / MLOps | ~8 | `AIExperiment`, `AIVerifyNG`, `Ai{Eval,Verify,TestAutomation}`, `Agent`, `AnalyzeDeploymentImpact` |
| Build systems | 2 | `JenkinsBuild`, `BambooBuild` |
| Chaos | 1 | `Chaos` |
| Heavyweight utility | 5 | `Command`, `Container`, `Verify`, `LoadTest`, `RONotify`/`SlackNotify` |
| Misc / traffic | ~6 | `StandAloneTrafficShiftRollback`, `FetchInstanceScript`, `DownloadManifests`, `DownloadHarnessStore`, `DownloadGcs`, `FilesUpload` |

---

## Cross-cutting TODO

- [ ] **vitest specs** — round-trip render tests for the K8s family, `StepGroup`, and the value objects (nothing under test yet).
- [ ] **Root-index consolidation** — wire `src/constructs` into `src/index.ts`; currently blocked because `Pipeline`/`Stage`/`Step` clash with the legacy `src/pipeline|stage|step` trees the root index still points at.
- [x] Whole-repo `tsc` is green (the legacy `example*.ts` files that broke it have been removed); the `src/constructs` subtree typechecks clean. `tsconfig.json` still lists the removed `example*.ts` in `include` — harmless, but worth pruning.
