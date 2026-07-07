import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  App,
  CustomStage,
  GithubPushTrigger,
  Pipeline,
  ShellScriptStep,
} from "../src/index.js";

function samplePipeline(name = "My Pipeline"): Pipeline {
  return new Pipeline({ name, projectIdentifier: "testproj" }).addStage(
    new CustomStage({ name: "Build" }).addStep(
      new ShellScriptStep({ name: "Run", script: "echo hi" }),
    ),
  );
}

describe("App", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-app-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes one <identifier>.yaml file per resource", () => {
    const pipeline = samplePipeline();
    const trigger = new GithubPushTrigger({
      name: "On Push",
      pipeline,
      connectorRef: "github_conn",
      repoName: "my-org/app",
      branch: "main",
    });

    const written = new App({ outdir: dir }).add(pipeline).add(trigger).synth();

    expect(readdirSync(dir).sort()).toEqual(["My_Pipeline.yaml", "On_Push.yaml"]);
    expect(written).toHaveLength(2);
    expect(readFileSync(join(dir, "My_Pipeline.yaml"), "utf8")).toContain(
      "identifier: My_Pipeline",
    );
  });

  test("creates the output directory when missing", () => {
    const nested = join(dir, "nested", ".harness");
    new App({ outdir: nested }).add(samplePipeline()).synth();
    expect(readdirSync(nested)).toEqual(["My_Pipeline.yaml"]);
  });

  test("fileName override controls the output file name", () => {
    new App({ outdir: dir })
      .add(samplePipeline(), { fileName: "custom" })
      .synth();
    expect(readdirSync(dir)).toEqual(["custom.yaml"]);
  });

  test("defaults outdir to .harness", () => {
    expect(new App().outdir).toBe(".harness");
  });

  test("throws when two resources collide on one file", () => {
    const app = new App({ outdir: dir })
      .add(samplePipeline("Dup"))
      .add(samplePipeline("Dup"));
    expect(() => app.synth()).toThrow(/two resources write to/);
  });

  test("an invalid resource throws and writes nothing", () => {
    const invalid = new Pipeline({ name: "Empty", projectIdentifier: "p" });
    const app = new App({ outdir: dir }).add(samplePipeline()).add(invalid);
    expect(() => app.synth()).toThrow(/must contain at least one stage/);
    expect(readdirSync(dir)).toEqual([]);
  });
});
