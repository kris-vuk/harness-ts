import { CustomStage } from "./src/constructs/level-1/custom-stage.js";
import { Pipeline } from "./src/constructs/level-1/pipeline/pipeline.js";
import { ShellScriptStep } from "./src/constructs/level-1/shell-script-step.js";
import { GithubPushTrigger } from "./src/constructs/level-1/pipeline/triggers/github-push-trigger.js";


const pipeline = new Pipeline({
  name: "TestPipeline",
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

// Start a run whenever main is pushed. addTrigger back-fills the pipeline's
// identifiers into the trigger, and the trigger renders its own YAML document.
pipeline.addTrigger(
  new GithubPushTrigger({
    name: "ServiceRepoRunTrigger",
    connectorRef: "account.my_github_connector",
    repoName: "my-org/my-service",
    branch: "main",
  }),
);

// Write the pipeline and each attached trigger to `.harness/`. build() renders
// and validates everything first, so an invalid pipeline writes nothing.
const written = pipeline.build();
console.log(`Wrote ${written.length} file(s) to .harness/:`);
for (const path of written) {
  console.log(`  ${path}`);
}
