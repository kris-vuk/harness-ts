import { App, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AwsCdkDeployStep, CustomStage, Pipeline, Stage } from "./src";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";

// --------------- Base Pipeline --------------- //

const pipeline = new Pipeline({
  name: "TestPipeline",
  projectIdentifier: "default_project",
  orgIdentifier: "test_org"
});

// --------------- Base Stack Stuff --------------- //

class SimpleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Bucket(this, "MyBucket", {
      bucketName: "my-unique-bucket-name-12345", // optional; must be globally unique
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // deletes the bucket on `cdk destroy`
      autoDeleteObjects: true, // empties it first so DESTROY succeeds
    });
  }
}

const app = new App();
const stack = new SimpleStack(app, "SimpleStack", {
  env: { account: "1234567890", region: "us-east-1" }
});

// --------------- Add Stages --------------- //

const alphaStage = new CustomStage({ name: "alpha" });
alphaStage.addStep(new AwsCdkDeployStep(stack))
pipeline.addStage(alphaStage)

const gammaStage = new CustomStage({ name: "gamma" });
gammaStage.addStep(new AwsCdkDeployStep(stack))
pipeline.addStage(gammaStage)

const prodStage = new CustomStage({ name: "prod" });
prodStage.addStep(new AwsCdkDeployStep(stack))
pipeline.addStage(prodStage)