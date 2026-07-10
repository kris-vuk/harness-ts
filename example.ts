import { CustomStage } from "./src/constructs/custom-stage.js";
import { Pipeline } from "./src/constructs/pipeline/pipeline.js";
import { ShellScriptStep } from "./src/constructs/shell-script-step.js";


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

console.log(pipeline.synth());
