import { CustomStage, Pipeline, ShellScriptStep } from "./src/index.js";

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
