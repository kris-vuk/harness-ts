/**
 * CDK stacks and the Harness pipeline that promotes them through
 * alpha -> beta -> prod, in one file.
 *
 * Run `npx tsx example-cdk.ts` to print the pipeline YAML. Inside Harness,
 * the same file is executed by the CDK CLI (via cdk.json) to synthesize
 * the stacks being deployed.
 */
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { CdkDeploy, CustomStage, Pipeline, WaitStep } from "./src/index.js";

// --- Define infrastructure --------------------------------------------------

const app = new App();

// The account each stack deploys into is a property of the CDK app: the
// stack's env. The pipeline's cdk.accountId only asserts these match.
const ACCOUNT = "950509372541";
const ENV = { account: ACCOUNT, region: "us-east-1" };

class StorageStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id, { env: ENV });
    const bucket = new Bucket(this, "ArtifactBucket");
    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
  }
}

const alpha = new StorageStack(app, "StorageAlpha");
const beta = new StorageStack(app, "StorageBeta");
const prod = new StorageStack(app, "StorageProd");

app.synth();

// --- The pipeline: stages are environments, steps are what happens in them --

const pipeline = new Pipeline({
  name: "StorageService",
  projectIdentifier: "default_project",
  repository: { connectorRef: "account.Harness", name: "harness-development-kit" },
  runtime: {
    connectorRef: "K8_Cluster",
    namespace: "harness-builds",
    serviceAccountName: "cdk-deployer",
  },
  // Pin the work to an existing delegate by its tag/name (optional).
  delegateSelectors: ["cdk-delegate"],
  cdk: {
    registryConnectorRef: "dockerhub",
    // The bare ":1.3.0" tag does not exist; tags are pinned by runtime + arch.
    // Verify the exact tag on hub.docker.com/r/harness/aws-cdk-plugin/tags and
    // match your node architecture (amd64 shown; swap to -arm64 if needed).
    image: "harness/aws-cdk-plugin:1.3.0-2.1019.2-linux-amd64-unified",
    accountId: ACCOUNT, // guardrail: stacks must declare env.account = ACCOUNT
    region: "us-east-1",
  },
});

pipeline
  .addStage(
    new CustomStage({ name: "Alpha" })
      .addStep(new CdkDeploy({ stacks: [alpha] }))
      .addStep(new WaitStep({ name: "Bake", duration: "12h" })),
  )
  .addStage(
    new CustomStage({ name: "Beta" })
      .addStep(new CdkDeploy({ stacks: [beta] }))
      .addStep(new WaitStep({ name: "Bake", duration: "12h" })),
  )
  .addStage(
    new CustomStage({ name: "Prod" }).addStep(new CdkDeploy({ stacks: [prod], diff: true })),
  );

if (!process.env.CDK_OUTDIR) {
  console.log(pipeline.synth());
}
