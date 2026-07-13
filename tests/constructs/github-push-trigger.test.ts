import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import { GithubPushTrigger, Pipeline } from "../../src/constructs/level-1/index.js";

function samplePipeline(): Pipeline {
  return new Pipeline({
    name: "My Pipeline",
    projectIdentifier: "testproj",
    orgIdentifier: "myorg",
  });
}

function baseTrigger(): GithubPushTrigger {
  return new GithubPushTrigger({
    name: "On Push",
    connectorRef: "github_conn",
    repoName: "my-org/app",
    branch: "main",
  });
}

describe("GithubPushTrigger", () => {
  test("addTrigger back-fills the pipeline's identifiers", () => {
    const trigger = baseTrigger();
    samplePipeline().addTrigger(trigger);

    expect(trigger.pipelineIdentifier).toBe("My_Pipeline");
    expect(trigger.orgIdentifier).toBe("myorg");
    expect(trigger.projectIdentifier).toBe("testproj");

    const doc = parse(trigger.synth()).trigger;
    expect(doc.pipelineIdentifier).toBe("My_Pipeline");
    expect(doc.orgIdentifier).toBe("myorg");
    expect(doc.projectIdentifier).toBe("testproj");
  });

  test("explicit identifiers win over the attached pipeline", () => {
    const trigger = new GithubPushTrigger({
      name: "On Push",
      connectorRef: "github_conn",
      repoName: "my-org/app",
      branch: "main",
      pipelineIdentifier: "Other_Pipeline",
      projectIdentifier: "otherproj",
    });
    samplePipeline().addTrigger(trigger);

    expect(trigger.pipelineIdentifier).toBe("Other_Pipeline");
    expect(trigger.projectIdentifier).toBe("otherproj");
    // org still falls back to the attached pipeline.
    expect(trigger.orgIdentifier).toBe("myorg");
  });

  test("synths standalone when identifiers are supplied directly", () => {
    const trigger = new GithubPushTrigger({
      name: "On Push",
      connectorRef: "github_conn",
      repoName: "my-org/app",
      branch: "main",
      pipelineIdentifier: "Standalone",
      projectIdentifier: "proj",
    });

    expect(trigger.validate()).toEqual([]);
    expect(trigger.orgIdentifier).toBe("default");
  });

  test("is invalid until attached to a pipeline or given a pipelineIdentifier", () => {
    const trigger = baseTrigger();

    expect(trigger.pipelineIdentifier).toBeUndefined();
    expect(trigger.validate()).toContain(
      "trigger is not attached to a pipeline; add it via " +
        "pipeline.addTrigger(trigger) or set pipelineIdentifier",
    );
    expect(() => trigger.synth()).toThrow(/is invalid/);
  });
});
