import { describe, expect, test } from "vitest";
import {
  CIStage,
  Pipeline,
  type PipelineChild,
  ShellScriptStep,
} from "../../src/constructs/level-1/index.js";
import { expectValidPipeline, validateAgainstSchema } from "./harness-schema.js";

/**
 * Builds a minimal but complete pipeline wrapping the given stages. Construct
 * tests use this to embed the construct under test in a schema-valid context.
 */
function pipelineWith(...stages: PipelineChild[]): Pipeline {
  return new Pipeline({
    name: "Test Pipeline",
    projectIdentifier: "testproj",
    orgIdentifier: "default",
    stages,
  });
}

describe("Harness schema validation", () => {
  test("the bundled schema compiles and rejects an empty document", () => {
    // Guards against a re-downloaded schema reintroducing an ajv-incompatible
    // node: if compile fails, importing the helper throws before this runs.
    const { valid, errors } = validateAgainstSchema({});
    expect(valid).toBe(false);
    expect(errors.join("\n")).toContain("pipeline");
  });

  test("a CI stage with a ShellScript step validates against the schema", () => {
    const pipeline = pipelineWith(
      new CIStage({
        name: "Build",
        platform: { os: "Linux", arch: "Amd64" },
        runtime: { type: "Cloud" },
        cloneCodebase: false,
        steps: [
          new ShellScriptStep({
            name: "Run",
            script: "echo hi",
            timeout: "10m",
          }),
        ],
      }),
    );

    expectValidPipeline(pipeline);
  });
});
