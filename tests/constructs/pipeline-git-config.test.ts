import { describe, expect, test } from "vitest";
import { Pipeline, PipelineGitConfig } from "../../src/constructs/level-1/index.js";

function samplePipeline(): Pipeline {
  return new Pipeline({ name: "My Pipeline", projectIdentifier: "testproj" });
}

describe("PipelineGitConfig", () => {
  test("renders REMOTE git details pointing at the pipeline-definition repo", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "github_conn",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
    });

    expect(config.toGitDetails()).toEqual({
      storeType: "REMOTE",
      connectorRef: "github_conn",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
    });
  });

  test("derives the pipeline identifier from the referenced pipeline", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "github_conn",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
    });

    expect(config.pipelineIdentifier).toBe("My_Pipeline");
  });

  test("Commit fetch type includes the pinned commit", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "github_conn",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
      gitFetchType: "Commit",
      commitId: "abc123",
    });

    expect(config.toGitDetails()).toMatchObject({ commitId: "abc123" });
  });

  test("Commit fetch type without a commitId is invalid", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "github_conn",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
      gitFetchType: "Commit",
    });

    expect(config.validate()).toContain(
      'gitFetchType "Commit" requires a commitId',
    );
  });

  test("empty required fields are reported", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "",
      repoName: "",
      branch: "",
      filePath: "",
    });

    expect(config.validate()).toEqual([
      "connectorRef must not be empty",
      "repoName must not be empty",
      "branch must not be empty",
      "filePath must not be empty",
    ]);
  });

  test("toGitDetails throws when invalid", () => {
    const config = new PipelineGitConfig({
      pipeline: samplePipeline(),
      connectorRef: "",
      repoName: "my-org/pipeline-defs",
      branch: "main",
      filePath: ".harness/my_pipeline.yaml",
    });

    expect(() => config.toGitDetails()).toThrow(/connectorRef must not be empty/);
  });
});
