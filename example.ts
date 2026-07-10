import { CustomStage } from "./src/constructs/custom-stage.js";
import { Pipeline } from "./src/constructs/pipeline/pipeline.js";
import { ShellScriptStep } from "./src/constructs/shell-script-step.js";
import { GithubPushTrigger } from "./src/constructs/pipeline/triggers/github-push-trigger.js";


const pipeline = new Pipeline({
  name: "TestPipeline",
  projectIdentifier: "default_project",
});

pipeline.addStage(
  new CustomStage({ name: "EmptyStage" }).addStep(
    new ShellScriptStep({
      name: "EmptyShellScript",
      script: 'echo "Empty Stage"',
    }),
  ),
);

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
