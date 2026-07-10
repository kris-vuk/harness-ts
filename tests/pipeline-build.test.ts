import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
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

function sampleTrigger(name = "On Push"): GithubPushTrigger {
  return new GithubPushTrigger({
    name,
    connectorRef: "github_conn",
    repoName: "my-org/app",
    branch: "main",
  });
}

describe("Pipeline.build", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-build-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("writes the pipeline and each attached trigger to its own file", () => {
    const pipeline = samplePipeline().addTrigger(sampleTrigger());

    const written = pipeline.build(dir);

    expect(readdirSync(dir).sort()).toEqual(["My_Pipeline.yaml", "On_Push.yaml"]);
    expect(written).toHaveLength(2);
    expect(readFileSync(join(dir, "My_Pipeline.yaml"), "utf8")).toContain(
      "identifier: My_Pipeline",
    );
    expect(readFileSync(join(dir, "On_Push.yaml"), "utf8")).toContain(
      "pipelineIdentifier: My_Pipeline",
    );
  });

  test("writes only the pipeline when it has no triggers", () => {
    const written = samplePipeline().build(dir);
    expect(written).toHaveLength(1);
    expect(readdirSync(dir)).toEqual(["My_Pipeline.yaml"]);
  });

  test("clears stale files from the output dir on each build", () => {
    writeFileSync(join(dir, "stale.yaml"), "old: true");
    const pipeline = samplePipeline().addTrigger(sampleTrigger());

    pipeline.build(dir);

    // stale.yaml is gone; only the current pipeline + trigger remain.
    expect(readdirSync(dir).sort()).toEqual(["My_Pipeline.yaml", "On_Push.yaml"]);
  });

  test("a render error leaves the existing output untouched", () => {
    writeFileSync(join(dir, "existing.yaml"), "keep: me");
    const invalid = new Pipeline({ name: "Empty", projectIdentifier: "p" });

    expect(() => invalid.build(dir)).toThrow(/must contain at least one stage/);

    // Nothing was cleared, because rendering failed before touching the dir.
    expect(readdirSync(dir)).toEqual(["existing.yaml"]);
  });

  test("creates the output directory when missing", () => {
    const nested = join(dir, "nested", ".harness");
    samplePipeline().build(nested);
    expect(readdirSync(nested)).toEqual(["My_Pipeline.yaml"]);
  });

  test("defaults outdir to .harness", () => {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      samplePipeline().build();
      expect(readdirSync(join(dir, ".harness"))).toEqual(["My_Pipeline.yaml"]);
    } finally {
      process.chdir(cwd);
    }
  });

  test("throws when the pipeline and a trigger collide on one file", () => {
    const pipeline = samplePipeline("Dup").addTrigger(sampleTrigger("Dup"));
    expect(() => pipeline.build(dir)).toThrow(/two resources write to/);
    expect(readdirSync(dir)).toEqual([]);
  });

  test("an invalid pipeline throws and writes nothing", () => {
    const invalid = new Pipeline({ name: "Empty", projectIdentifier: "p" });
    expect(() => invalid.build(dir)).toThrow(/must contain at least one stage/);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("pipeline.triggers", () => {
  test("synth() renders one YAML string per attached trigger", () => {
    const pipeline = samplePipeline()
      .addTrigger(sampleTrigger("On Push"))
      .addTrigger(sampleTrigger("On Release"));

    const yamls = pipeline.triggers.synth();

    expect(pipeline.triggers.length).toBe(2);
    expect(yamls).toHaveLength(2);
    expect(yamls[0]).toContain("identifier: On_Push");
    expect(yamls[1]).toContain("identifier: On_Release");
    expect(yamls[0]).toContain("pipelineIdentifier: My_Pipeline");
  });

  test("is iterable and back-fills the pipeline identifier", () => {
    const pipeline = samplePipeline().addTrigger(sampleTrigger());
    const [first, ...rest] = [...pipeline.triggers];
    expect(rest).toHaveLength(0);
    expect(first?.identifier).toBe("On_Push");
    expect(first?.synth()).toContain("pipelineIdentifier: My_Pipeline");
  });
});
